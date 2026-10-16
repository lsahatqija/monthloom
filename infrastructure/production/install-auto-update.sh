#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ "$EUID" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

if [[ "$repo_root" != "/opt/monthloom" ]]; then
  echo "The systemd units expect the repository at /opt/monthloom; found $repo_root." >&2
  exit 1
fi

if [[ ! -f "$repo_root/.env.production" ]]; then
  echo "Missing $repo_root/.env.production." >&2
  exit 1
fi

chmod 0755 "$repo_root/infrastructure/production/update.sh"
chmod 0755 "$repo_root/infrastructure/production/backup.sh"
chmod 0755 "$repo_root/infrastructure/production/verify-encrypted-storage.sh"
install -m 0644 "$repo_root/infrastructure/production/systemd/monthloom-update.service" \
  /etc/systemd/system/monthloom-update.service
install -m 0644 "$repo_root/infrastructure/production/systemd/monthloom-update.timer" \
  /etc/systemd/system/monthloom-update.timer

systemctl daemon-reload
systemctl enable --now monthloom-update.timer
systemctl list-timers monthloom-update.timer --no-pager
