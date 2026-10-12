#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

env_file="${ENV_FILE:-.env.production}"
compose_file="${COMPOSE_FILE:-compose.prod.yml}"
backup_root="${BACKUP_DIR:-/var/backups/monthloom}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="$backup_root/$timestamp"

install -d -m 700 "$destination"

docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
  sh -c 'pg_dump --clean --if-exists --no-owner -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -9 > "$destination/postgres.sql.gz"

docker run --rm \
  -v monthloom-prod_uploads_data:/source:ro \
  -v "$destination:/backup" \
  alpine:3.22 tar -czf /backup/uploads.tar.gz -C /source .

sha256sum "$destination"/* > "$destination/SHA256SUMS"
echo "Backup created in $destination. Copy it to encrypted off-server storage."
