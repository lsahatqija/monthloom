#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

env_file="${ENV_FILE:-$repo_root/.env.production}"
compose_file="${COMPOSE_FILE:-$repo_root/compose.prod.yml}"
backup_root="${BACKUP_DIR:-/var/backups/monthloom}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="$backup_root/$timestamp"
partial="$backup_root/.${timestamp}.partial.$$"

die() {
  echo "Backup failed: $*" >&2
  exit 1
}

read_env_value() {
  local key="$1"
  local value
  value="$(sed -n "s/^${key}=//p" "$env_file" | tail -n 1 | tr -d '\r')"
  printf '%s' "$value"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required"
}

[[ -f "$env_file" ]] || die "missing $env_file"
[[ "$backup_root" == /* ]] || die "BACKUP_DIR must be an absolute path"
[[ "$backup_root" != "/" ]] || die "BACKUP_DIR must not be /"
require_command age
require_command docker
require_command flock
require_command gzip
require_command sha256sum

recipient="$(read_env_value BACKUP_AGE_RECIPIENT)"
[[ "$recipient" == age1* ]] || die "BACKUP_AGE_RECIPIENT must contain an age public recipient"
remote="$(read_env_value BACKUP_REMOTE)"
if [[ -n "$remote" ]]; then
  require_command rclone
fi

ENV_FILE="$env_file" bash "$repo_root/infrastructure/production/verify-encrypted-storage.sh"

lock_file="${BACKUP_LOCK_FILE:-/run/lock/monthloom-backup.lock}"
exec 8>"$lock_file"
flock -n 8 || die "another backup or restore is already running"

umask 077
install -d -m 0700 "$backup_root"
[[ ! -e "$destination" ]] || die "$destination already exists"
mkdir -m 0700 "$partial"

compose=(docker compose --env-file "$env_file" -f "$compose_file")
manage_api="${BACKUP_MANAGE_API:-true}"
[[ "$manage_api" == true || "$manage_api" == false ]] ||
  die "BACKUP_MANAGE_API must be true or false"
api_was_stopped=false
api_container_id=""
restart_api() {
  if [[ "$api_was_stopped" == true ]]; then
    docker start "$api_container_id" >/dev/null
    for _attempt in $(seq 1 45); do
      api_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$api_container_id")"
      if [[ "$api_health" == healthy || "$api_health" == running ]]; then
        api_was_stopped=false
        return
      fi
      [[ "$api_health" != unhealthy && "$api_health" != exited && "$api_health" != dead ]] ||
        die "API container did not recover after the backup (state: $api_health)"
      sleep 2
    done
    die "API container did not become healthy after the backup"
  fi
}
cleanup() {
  restart_api || true
  if [[ -d "$partial" ]]; then
    rm -rf -- "$partial"
  fi
}
trap cleanup EXIT

# Stop the only writer while capturing PostgreSQL and uploads so their snapshots agree. The web
# frontend remains available, but API requests briefly fail closed during this operation.
if [[ "$manage_api" == true && -n "$("${compose[@]}" ps --status running --quiet api)" ]]; then
  api_container_id="$("${compose[@]}" ps --status running --quiet api)"
  docker stop "$api_container_id" >/dev/null
  api_was_stopped=true
fi

"${compose[@]}" exec -T postgres \
  sh -eu -c 'pg_dump --clean --if-exists --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -9 \
  | age --encrypt --recipient "$recipient" --output "$partial/postgres.sql.gz.age"

# Uploads are included to preserve the consistency of file metadata in the database snapshot.
# The archive is streamed straight into age; no plaintext tar file is written to disk.
docker run --rm \
  --volume monthloom-prod_uploads_data:/source:ro \
  alpine:3.22 tar -czf - -C /source . \
  | age --encrypt --recipient "$recipient" --output "$partial/uploads.tar.gz.age"

restart_api

revision="$(git rev-parse --verify HEAD 2>/dev/null || printf 'unknown')"
cat > "$partial/MANIFEST" <<EOF
format=monthloom-backup-v2
created_at=$timestamp
git_revision=$revision
database_archive=postgres.sql.gz.age
uploads_archive=uploads.tar.gz.age
encryption=age
EOF

(
  cd "$partial"
  sha256sum MANIFEST postgres.sql.gz.age uploads.tar.gz.age > SHA256SUMS
  touch COMPLETE
)

mv -- "$partial" "$destination"
trap - EXIT

if [[ -n "$remote" ]]; then
  remote_destination="${remote%/}/$timestamp"
  # Ciphertexts are already authenticated by age. --immutable prevents accidental replacement of
  # an object with the same name on remotes that support the operation.
  rclone copy "$destination" "$remote_destination" --immutable
  echo "Encrypted backup copied to $remote_destination."
else
  echo "WARNING: BACKUP_REMOTE is not configured; this backup is only on the live host." >&2
fi

echo "Encrypted backup created in $destination."
