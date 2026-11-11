#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

env_file="${ENV_FILE:-.env.production}"
compose_file="${COMPOSE_FILE:-compose.prod.yml}"
backup_root="${BACKUP_DIR:-/var/backups/monthloom}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="$backup_root/$timestamp"

report_backup() {
  local status="$1"
  local detail="$2"
  local statement="INSERT INTO operational_status (key, status, last_attempt_at, last_success_at, detail)
    VALUES ('backup', '$status', now(), CASE WHEN '$status' = 'healthy' THEN now() END, '$detail')
    ON CONFLICT (key) DO UPDATE SET status = EXCLUDED.status,
      last_attempt_at = EXCLUDED.last_attempt_at,
      last_success_at = CASE WHEN EXCLUDED.status = 'healthy' THEN EXCLUDED.last_attempt_at ELSE operational_status.last_success_at END,
      detail = EXCLUDED.detail"
  docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
    sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "$1"' _ "$statement" \
    >/dev/null
}

trap 'report_backup degraded "Latest backup failed." || true' ERR

install -d -m 700 "$destination"

docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
  sh -c 'pg_dump --clean --if-exists --no-owner -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -9 > "$destination/postgres.sql.gz"

docker run --rm \
  -v monthloom-prod_uploads_data:/source:ro \
  -v "$destination:/backup" \
  alpine:3.22 tar -czf /backup/uploads.tar.gz -C /source .

sha256sum "$destination"/* > "$destination/SHA256SUMS"
report_backup healthy "Latest backup completed successfully."
trap - ERR
echo "Backup created in $destination. Copy it to encrypted off-server storage."
