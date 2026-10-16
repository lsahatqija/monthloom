#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

env_file="${ENV_FILE:-$repo_root/.env.production}"
compose_file="${COMPOSE_FILE:-$repo_root/compose.prod.yml}"
backup_root="${BACKUP_DIR:-/var/backups/monthloom}"
identity_file="${BACKUP_AGE_IDENTITY_FILE:-}"
assume_yes=false
verify_only=false

usage() {
  cat <<'EOF'
Usage: restore.sh [--verify-only] [--yes] BACKUP_ID_OR_DIRECTORY

Restores PostgreSQL from an authenticated, age-encrypted Monthloom backup. If BACKUP_ID is not
available locally and BACKUP_REMOTE is configured, it is fetched with rclone first.

Required environment:
  BACKUP_AGE_IDENTITY_FILE   Path to the age private identity (keep it off the app host normally)

Options:
  --verify-only   Fetch and fully authenticate/decompress the backup without changing PostgreSQL
  --yes   Skip the interactive backup-ID confirmation (for controlled recovery automation only)

This command restores the database only. The paired upload archive is retained and validated but
is not applied automatically, avoiding an unexpected destructive replacement of uploaded files.
EOF
}

die() {
  echo "Restore failed: $*" >&2
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

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      assume_yes=true
      shift
      ;;
    --verify-only)
      verify_only=true
      shift
      ;;
    --help | -h)
      usage
      exit 0
      ;;
    --*)
      die "unknown option: $1"
      ;;
    *) break ;;
  esac
done
[[ $# -eq 1 ]] || {
  usage >&2
  exit 2
}
backup_reference="$1"

[[ -f "$env_file" ]] || die "missing $env_file"
[[ "$backup_root" == /* ]] || die "BACKUP_DIR must be an absolute path"
[[ "$backup_root" != "/" ]] || die "BACKUP_DIR must not be /"
[[ -n "$identity_file" ]] || die "BACKUP_AGE_IDENTITY_FILE is required"
[[ -f "$identity_file" ]] || die "age identity does not exist: $identity_file"
[[ ! -L "$identity_file" ]] || die "age identity must not be a symbolic link"
require_command age
require_command docker
require_command flock
require_command gzip
require_command sha256sum
require_command tar

identity_mode="$(stat -c '%a' "$identity_file")"
if (( (8#$identity_mode & 077) != 0 )); then
  die "age identity permissions must not allow group or other access (current mode: $identity_mode)"
fi

ENV_FILE="$env_file" bash "$repo_root/infrastructure/production/verify-encrypted-storage.sh"

update_lock_file="${UPDATE_LOCK_FILE:-/run/lock/monthloom-update.lock}"
backup_lock_file="${BACKUP_LOCK_FILE:-/run/lock/monthloom-backup.lock}"
exec 9>"$update_lock_file"
flock -n 9 || die "an application update or restore is already running"
exec 8>"$backup_lock_file"
flock -n 8 || die "a backup or restore is already running"

if [[ -d "$backup_reference" ]]; then
  backup_dir="$(cd "$backup_reference" && pwd)"
  backup_id="$(basename "$backup_dir")"
else
  [[ "$backup_reference" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] ||
    die "backup ID must have the form YYYYMMDDTHHMMSSZ"
  backup_id="$backup_reference"
  backup_dir="$backup_root/$backup_id"

  if [[ ! -d "$backup_dir" ]]; then
    remote="$(read_env_value BACKUP_REMOTE)"
    [[ -n "$remote" ]] || die "$backup_dir does not exist and BACKUP_REMOTE is not configured"
    require_command rclone
    install -d -m 0700 "$backup_root"
    download_dir="$backup_root/.${backup_id}.download.$$"
    trap 'rm -rf -- "$download_dir"' EXIT
    mkdir -m 0700 "$download_dir"
    rclone copy "${remote%/}/$backup_id" "$download_dir" --immutable
    [[ -f "$download_dir/COMPLETE" ]] || die "remote backup is incomplete"
    mv -- "$download_dir" "$backup_dir"
    trap - EXIT
  fi
fi

[[ -f "$backup_dir/COMPLETE" ]] || die "backup has no COMPLETE marker"
[[ -f "$backup_dir/MANIFEST" ]] || die "backup has no MANIFEST"
[[ -f "$backup_dir/SHA256SUMS" ]] || die "backup has no SHA256SUMS"
[[ -f "$backup_dir/postgres.sql.gz.age" ]] || die "database archive is missing"
[[ -f "$backup_dir/uploads.tar.gz.age" ]] || die "paired upload archive is missing"
grep -qx 'format=monthloom-backup-v2' "$backup_dir/MANIFEST" ||
  die "unsupported backup format"
[[ "$(wc -l < "$backup_dir/SHA256SUMS")" -eq 3 ]] || die "unexpected checksum manifest"
grep -Eq '^[0-9a-f]{64}  MANIFEST$' "$backup_dir/SHA256SUMS" ||
  die "manifest checksum is missing"
grep -Eq '^[0-9a-f]{64}  postgres\.sql\.gz\.age$' "$backup_dir/SHA256SUMS" ||
  die "database checksum is missing"
grep -Eq '^[0-9a-f]{64}  uploads\.tar\.gz\.age$' "$backup_dir/SHA256SUMS" ||
  die "upload checksum is missing"

(
  cd "$backup_dir"
  sha256sum --check --strict SHA256SUMS
)

# Authenticate and decompress the complete database stream before changing any live state.
age --decrypt --identity "$identity_file" "$backup_dir/postgres.sql.gz.age" | gzip --test
# Authenticate the paired upload archive too, even though this database-only recovery does not
# replace the upload volume automatically.
age --decrypt --identity "$identity_file" "$backup_dir/uploads.tar.gz.age" |
  tar -tzf - >/dev/null

if [[ "$verify_only" == true ]]; then
  echo "Backup $backup_id passed checksum, age authentication, gzip, and tar validation."
  exit 0
fi

if [[ "$assume_yes" != true ]]; then
  [[ -t 0 ]] || die "interactive confirmation requires a TTY; use --yes only for controlled recovery"
  printf 'Type the backup ID (%s) to replace the live database: ' "$backup_id" >&2
  read -r confirmation
  [[ "$confirmation" == "$backup_id" ]] || die "confirmation did not match"
fi

compose=(docker compose --env-file "$env_file" -f "$compose_file")
restore_db="monthloom_restore_$(date -u +%s)_$$"
previous_db="monthloom_previous_$(date -u +%s)_$$"
failed_db="monthloom_failed_$(date -u +%s)_$$"
swapped=false
api_container_id="$("${compose[@]}" ps --quiet api)"
web_container_id="$("${compose[@]}" ps --quiet web)"
services_stopped=false

cleanup_restore_database() {
  if [[ "$swapped" == false ]]; then
    "${compose[@]}" exec -T -e ML_RESTORE_DB="$restore_db" postgres sh -eu -c \
      'dropdb --if-exists --force -U "$POSTGRES_USER" "$ML_RESTORE_DB"' >/dev/null 2>&1 || true
    if [[ "$services_stopped" == true ]]; then
      [[ -z "$api_container_id" ]] || docker start "$api_container_id" >/dev/null 2>&1 || true
      [[ -z "$web_container_id" ]] || docker start "$web_container_id" >/dev/null 2>&1 || true
    fi
  fi
}
trap cleanup_restore_database EXIT

"${compose[@]}" stop api web
services_stopped=true
"${compose[@]}" up -d --wait postgres
"${compose[@]}" exec -T -e ML_RESTORE_DB="$restore_db" postgres sh -eu -c '
  dropdb --if-exists --force -U "$POSTGRES_USER" "$ML_RESTORE_DB"
  createdb -U "$POSTGRES_USER" --template=template0 "$ML_RESTORE_DB"
'

age --decrypt --identity "$identity_file" "$backup_dir/postgres.sql.gz.age" \
  | gzip --decompress \
  | "${compose[@]}" exec -T -e ML_RESTORE_DB="$restore_db" postgres sh -eu -c \
    'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$ML_RESTORE_DB"'

swap_database() {
  "${compose[@]}" exec -T \
    -e ML_RESTORE_DB="$restore_db" \
    -e ML_PREVIOUS_DB="$previous_db" \
    postgres sh -eu -c '
      psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
        --set=target="$POSTGRES_DB" \
        --set=restored="$ML_RESTORE_DB" <<"SQL"
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname IN (:'target', :'restored') AND pid <> pg_backend_pid();
SQL
      psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
        --set=target="$POSTGRES_DB" --set=previous="$ML_PREVIOUS_DB" \
        -c '"'"'ALTER DATABASE :"target" RENAME TO :"previous";'"'"'
      if ! psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
        --set=target="$POSTGRES_DB" --set=restored="$ML_RESTORE_DB" \
        -c '"'"'ALTER DATABASE :"restored" RENAME TO :"target";'"'"'; then
        psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
          --set=target="$POSTGRES_DB" --set=previous="$ML_PREVIOUS_DB" \
          -c '"'"'ALTER DATABASE :"previous" RENAME TO :"target";'"'"' || true
        exit 1
      fi
    '
}

rollback_database() {
  "${compose[@]}" stop api web >/dev/null 2>&1 || true
  "${compose[@]}" exec -T \
    -e ML_PREVIOUS_DB="$previous_db" \
    -e ML_FAILED_DB="$failed_db" \
    postgres sh -eu -c '
      psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
        --set=target="$POSTGRES_DB" \
        --set=previous="$ML_PREVIOUS_DB" \
        --set=failed="$ML_FAILED_DB" <<"SQL"
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname IN (:'target', :'previous') AND pid <> pg_backend_pid();
ALTER DATABASE :"target" RENAME TO :"failed";
ALTER DATABASE :"previous" RENAME TO :"target";
DROP DATABASE :"failed";
SQL
    '
  "${compose[@]}" up -d --wait postgres api web caddy >/dev/null 2>&1 || true
}

if ! swap_database; then
  echo "Database swap failed; the original database was kept in service." >&2
  exit 1
fi
swapped=true
services_stopped=false

if ! "${compose[@]}" up -d --wait postgres api web caddy; then
  echo "Restored application did not become healthy; rolling back to the previous database." >&2
  rollback_database
  exit 1
fi

"${compose[@]}" exec -T -e ML_PREVIOUS_DB="$previous_db" postgres sh -eu -c \
  'dropdb --if-exists --force -U "$POSTGRES_USER" "$ML_PREVIOUS_DB"'
trap - EXIT

echo "Database restored from $backup_id and all services are healthy."
echo "The paired upload archive was validated but not applied: $backup_dir/uploads.tar.gz.age"
