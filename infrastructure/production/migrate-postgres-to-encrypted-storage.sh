#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

env_file="${ENV_FILE:-$repo_root/.env.production}"
compose_file="${COMPOSE_FILE:-$repo_root/compose.prod.yml}"
legacy_volume="${LEGACY_POSTGRES_VOLUME:-monthloom-prod_postgres_data}"

die() {
  echo "PostgreSQL storage migration failed: $*" >&2
  exit 1
}

read_env_value() {
  local key="$1"
  local value
  value="$(sed -n "s/^${key}=//p" "$env_file" | tail -n 1 | tr -d '\r')"
  printf '%s' "$value"
}

[[ -f "$env_file" ]] || die "missing $env_file"
[[ "$EUID" -eq 0 ]] || die "run this migration with sudo"
command -v docker >/dev/null 2>&1 || die "docker is required"

storage_root="$(read_env_value ENCRYPTED_STORAGE_ROOT)"
[[ "$storage_root" =~ ^/[A-Za-z0-9._/-]+$ ]] ||
  die "ENCRYPTED_STORAGE_ROOT contains unsupported characters"
postgres_dir="$storage_root/postgres"

ENV_FILE="$env_file" bash "$repo_root/infrastructure/production/verify-encrypted-storage.sh"
docker volume inspect "$legacy_volume" >/dev/null 2>&1 ||
  die "legacy Docker volume does not exist: $legacy_volume"

if find "$postgres_dir" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
  die "$postgres_dir is not empty"
fi

printf 'This will stop the application and copy %s to %s.\n' "$legacy_volume" "$postgres_dir" >&2
printf 'Type MIGRATE-POSTGRES to continue: ' >&2
read -r confirmation
[[ "$confirmation" == "MIGRATE-POSTGRES" ]] || die "confirmation did not match"

# Create an independently encrypted logical recovery point before copying the physical data.
ENV_FILE="$env_file" COMPOSE_FILE="$compose_file" BACKUP_MANAGE_API=false \
  bash "$repo_root/infrastructure/production/backup.sh"

compose=(docker compose --env-file "$env_file" -f "$compose_file")
legacy_postgres_container="$("${compose[@]}" ps --quiet postgres)"
legacy_api_container="$("${compose[@]}" ps --quiet api)"
legacy_web_container="$("${compose[@]}" ps --quiet web)"
[[ -n "$legacy_postgres_container" ]] || die "the legacy PostgreSQL container is not running"
"${compose[@]}" stop api web postgres

copy_completed=false
restart_legacy_containers() {
  if [[ "$copy_completed" != true ]]; then
    echo "Copy did not complete; restarting the unchanged legacy containers." >&2
    docker start "$legacy_postgres_container" >/dev/null 2>&1 || true
    [[ -z "$legacy_api_container" ]] || docker start "$legacy_api_container" >/dev/null 2>&1 || true
    [[ -z "$legacy_web_container" ]] || docker start "$legacy_web_container" >/dev/null 2>&1 || true
  fi
}
trap restart_legacy_containers EXIT

# The source remains read-only and is intentionally retained after migration for manual rollback.
# tar preserves PostgreSQL's numeric ownership and permissions without placing data on plaintext
# host storage in between.
docker run --rm \
  --mount "type=volume,src=$legacy_volume,dst=/source,readonly" \
  --mount "type=bind,src=$postgres_dir,dst=/target" \
  alpine:3.22 sh -eu -c '
    set -o pipefail
    test -f /source/PG_VERSION
    test -z "$(find /target -mindepth 1 -maxdepth 1 -print -quit)"
    tar -C /source -cf - . | tar -C /target -xpf -
    test -f /target/PG_VERSION
  '
copy_completed=true

bash "$repo_root/infrastructure/production/deploy.sh"
trap - EXIT

echo "PostgreSQL now uses encrypted storage at $postgres_dir."
echo "The legacy volume $legacy_volume was retained; remove it only after a successful restore drill."
