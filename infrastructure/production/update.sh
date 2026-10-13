#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

env_file="${ENV_FILE:-$repo_root/.env.production}"
compose_file="${COMPOSE_FILE:-$repo_root/compose.prod.yml}"
backup_root="${BACKUP_DIR:-/var/backups/monthloom}"
lock_file="${LOCK_FILE:-/run/lock/monthloom-update.lock}"
state_dir="${STATE_DIR:-/var/lib/monthloom-updater}"
failed_revision_file="$state_dir/failed-revision"

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file. Copy infrastructure/production/env.example and fill it in." >&2
  exit 1
fi

exec 9>"$lock_file"
if ! flock -n 9; then
  echo "Another Monthloom deployment or update is already running; skipping this poll."
  exit 0
fi

install -d -m 0700 "$state_dir"

image_tag="$(sed -n 's/^IMAGE_TAG=//p' "$env_file" | tail -n 1 | tr -d '\r')"
if [[ "$image_tag" != "latest" ]]; then
  echo "Automatic updates require IMAGE_TAG=latest; current value is '${image_tag:-unset}'." >&2
  exit 1
fi

compose=(docker compose --env-file "$env_file" -f "$compose_file")
api_ref="lsahatqija/monthloom:api-latest"
web_ref="lsahatqija/monthloom:web-latest"

"${compose[@]}" config --quiet
"${compose[@]}" pull api web

desired_api_id="$(docker image inspect --format '{{.Id}}' "$api_ref")"
desired_web_id="$(docker image inspect --format '{{.Id}}' "$web_ref")"
desired_api_revision="$(docker image inspect --format '{{with .Config.Labels}}{{index . "org.opencontainers.image.revision"}}{{end}}' "$api_ref")"
desired_web_revision="$(docker image inspect --format '{{with .Config.Labels}}{{index . "org.opencontainers.image.revision"}}{{end}}' "$web_ref")"

if [[ -z "$desired_api_revision" || "$desired_api_revision" == "<no value>" ]]; then
  echo "The pulled API image has no release revision label; skipping automatic deployment." >&2
  exit 1
fi
if [[ "$desired_api_revision" != "$desired_web_revision" ]]; then
  echo "API and web latest tags are from different revisions; publication is still in progress." >&2
  exit 0
fi

if [[ -f "$failed_revision_file" ]] &&
  [[ "$(tr -d '\r\n' < "$failed_revision_file")" == "$desired_api_revision" ]]; then
  echo "Revision $desired_api_revision previously failed; waiting for a new release or manual reset." >&2
  exit 1
fi

api_container_id="$("${compose[@]}" ps -q api)"
web_container_id="$("${compose[@]}" ps -q web)"

running_api_id=""
running_web_id=""
if [[ -n "$api_container_id" ]]; then
  running_api_id="$(docker container inspect --format '{{.Image}}' "$api_container_id")"
fi
if [[ -n "$web_container_id" ]]; then
  running_web_id="$(docker container inspect --format '{{.Image}}' "$web_container_id")"
fi

if [[ "$running_api_id" == "$desired_api_id" && "$running_web_id" == "$desired_web_id" ]]; then
  echo "Monthloom is already running the newest api-latest and web-latest images."
  exit 0
fi

echo "Monthloom revision $desired_api_revision is available; preparing the deployment."

can_rollback=false
if [[ -n "$running_api_id" && -n "$running_web_id" ]]; then
  can_rollback=true
  docker image tag "$running_api_id" lsahatqija/monthloom:api-rollback
  docker image tag "$running_web_id" lsahatqija/monthloom:web-rollback

  ENV_FILE="$env_file" COMPOSE_FILE="$compose_file" BACKUP_DIR="$backup_root" \
    "$repo_root/infrastructure/production/backup.sh"
else
  echo "No complete running application pair found; skipping the pre-deployment backup."
fi

if "${compose[@]}" up -d --remove-orphans --wait; then
  rm -f "$failed_revision_file"
  "${compose[@]}" ps
  echo "Monthloom was updated successfully."
  exit 0
fi

echo "The updated stack did not become healthy." >&2
printf '%s\n' "$desired_api_revision" > "$failed_revision_file"
if [[ "$can_rollback" == true ]]; then
  echo "Attempting to restore the previously running application images." >&2
  if IMAGE_TAG=rollback "${compose[@]}" up -d --remove-orphans --wait; then
    echo "Application image rollback completed. Investigate the failed release before retrying." >&2
  else
    echo "Automatic rollback also failed. Manual intervention is required." >&2
  fi
else
  echo "No previous application image pair was available for rollback." >&2
fi

exit 1
