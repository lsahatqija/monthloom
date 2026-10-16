#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${ENV_FILE:-$repo_root/.env.production}"

die() {
  echo "Encrypted-storage check failed: $*" >&2
  exit 1
}

read_env_value() {
  local key="$1"
  local value
  value="$(sed -n "s/^${key}=//p" "$env_file" | tail -n 1 | tr -d '\r')"
  printf '%s' "$value"
}

[[ -f "$env_file" ]] || die "missing $env_file"
command -v findmnt >/dev/null 2>&1 || die "findmnt is required"
command -v lsblk >/dev/null 2>&1 || die "lsblk is required"

storage_root="${ENCRYPTED_STORAGE_ROOT:-$(read_env_value ENCRYPTED_STORAGE_ROOT)}"
[[ -n "$storage_root" ]] || die "ENCRYPTED_STORAGE_ROOT is not set"
[[ "$storage_root" == /* ]] || die "ENCRYPTED_STORAGE_ROOT must be an absolute path"
[[ "$storage_root" != "/" ]] || die "ENCRYPTED_STORAGE_ROOT must not be /"
[[ "$storage_root" =~ ^/[A-Za-z0-9._/-]+$ ]] ||
  die "ENCRYPTED_STORAGE_ROOT contains unsupported characters"
[[ -d "$storage_root" ]] || die "$storage_root does not exist"
[[ ! -L "$storage_root" ]] || die "$storage_root must not be a symbolic link"

mount_source="$(findmnt --noheadings --output SOURCE --target "$storage_root" | head -n 1 | xargs)"
[[ -n "$mount_source" ]] || die "could not resolve the filesystem backing $storage_root"

# findmnt can append a btrfs subvolume suffix such as [/@]; lsblk needs the block-device part.
block_source="${mount_source%%\[*}"
[[ "$block_source" == /dev/* ]] ||
  die "$storage_root is backed by $mount_source, not a verifiable block device"

block_types="$(lsblk --inverse --noheadings --output TYPE "$block_source" 2>/dev/null |
  sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
if ! grep -qx crypt <<<"$block_types"; then
  die "$storage_root is not backed by a dm-crypt/LUKS block-device chain (source: $mount_source)"
fi

mount_options="$(findmnt --noheadings --output OPTIONS --target "$storage_root" | head -n 1)"
case ",$mount_options," in
  *,rw,*) ;;
  *) die "$storage_root is not mounted read/write" ;;
esac

postgres_dir="$storage_root/postgres"
[[ -d "$postgres_dir" ]] || die "$postgres_dir does not exist; create it before deployment"
[[ ! -L "$postgres_dir" ]] || die "$postgres_dir must not be a symbolic link"

resolved_root="$(readlink -f "$storage_root")"
resolved_postgres="$(readlink -f "$postgres_dir")"
case "$resolved_postgres" in
  "$resolved_root"/*) ;;
  *) die "$postgres_dir resolves outside the encrypted storage root" ;;
esac

echo "Encrypted storage verified: $postgres_dir is backed by $mount_source."
