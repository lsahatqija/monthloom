#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

env_file="${ENV_FILE:-.env.production}"
compose_file="${COMPOSE_FILE:-compose.prod.yml}"
lock_file="${LOCK_FILE:-/run/lock/monthloom-update.lock}"

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file. Copy infrastructure/production/env.example and fill it in." >&2
  exit 1
fi

exec 9>"$lock_file"
flock 9

docker compose --env-file "$env_file" -f "$compose_file" config --quiet
docker compose --env-file "$env_file" -f "$compose_file" pull
docker compose --env-file "$env_file" -f "$compose_file" up -d --remove-orphans --wait
docker compose --env-file "$env_file" -f "$compose_file" ps
