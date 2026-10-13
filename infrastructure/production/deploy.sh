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
if ! docker compose --env-file "$env_file" -f "$compose_file" up -d --remove-orphans --wait; then
  echo "Deployment did not become healthy. Current status and recent logs:" >&2
  docker compose --env-file "$env_file" -f "$compose_file" ps >&2 || true
  docker compose --env-file "$env_file" -f "$compose_file" logs --tail=100 \
    postgres api web caddy >&2 || true
  exit 1
fi
docker compose --env-file "$env_file" -f "$compose_file" ps
