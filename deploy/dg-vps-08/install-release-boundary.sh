#!/usr/bin/env bash
# Install reviewed root-owned code only. Does not build, start or activate apps.
set -euo pipefail
[[ ${1:-} == --install && $# == 1 && $(id -u) == 0 ]] || { echo 'Usage as root: install-release-boundary.sh --install' >&2; exit 64; }
[[ $(hostname -s) == dg-vps-08 && $(sha256sum /etc/machine-id | cut -d ' ' -f 1) == 4c306aaa5338d05ce10f127bea80dafaf7e62b1500be34cdff3b5ddd617e7bd7 ]] || exit 78
[[ ! -e /srv/castiq-staging/current && ! -L /srv/castiq-staging/current ]] || { echo 'Initial boundary install refuses an existing environment.' >&2; exit 78; }
template_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repository_dir=$(cd -- "$template_dir/../.." && pwd)
install -d -o root -g root -m 0755 /usr/local/libexec/castiq-staging
copy_reviewed() {
  local source=$1 target=$2
  if [[ ! -f $source || -L $source || $(stat -c '%U:%G' "$source") != root:root ]] || (( (8#$(stat -c '%a' "$source") & 0022) != 0 )); then echo 'Use a root-owned, unwritable provision copy.' >&2; exit 73; fi
  if [[ -e $target || -L $target ]]; then
    if [[ ! -f $target || -L $target ]] || ! cmp -s -- "$source" "$target"; then echo "Refusing different installed boundary: $target" >&2; exit 73; fi
    [[ $(stat -c '%U:%G:%a' "$target") == root:root:755 ]] || exit 73
  else
    install -o root -g root -m 0755 -- "$source" "$target"
  fi
}
copy_reviewed "$template_dir/release.py" /usr/local/libexec/castiq-staging-release
copy_reviewed "$template_dir/healthcheck.mjs" /usr/local/libexec/castiq-staging/healthcheck.mjs
for name in release-gate.mjs configuration.mjs check-config.mjs; do
  copy_reviewed "$repository_dir/scripts/$name" "/usr/local/libexec/castiq-staging/$name"
done
digest=$(sha256sum /usr/local/libexec/castiq-staging-release | cut -d ' ' -f 1)
policy=$(mktemp)
trap 'rm -f -- "$policy"' EXIT
printf 'castiq-runner ALL=(root) NOPASSWD: sha256:%s /usr/local/libexec/castiq-staging-release ^(build [0-9a-f]{40} [1-9][0-9]*-[1-9][0-9]*|activate [0-9a-f]{40} [1-9][0-9]*-[1-9][0-9]* [A-Za-z0-9][A-Za-z0-9_-]* [A-Za-z0-9][A-Za-z0-9_-]*)$\n' "$digest" > "$policy"
chmod 0440 "$policy"
visudo -cf "$policy"
target_policy=/etc/sudoers.d/castiq-staging-release
if [[ -e $target_policy || -L $target_policy ]]; then
  if [[ ! -f $target_policy || -L $target_policy ]] || ! cmp -s -- "$policy" "$target_policy"; then echo 'Existing different sudo rule: refuse replacement.' >&2; exit 73; fi
else
  install -o root -g root -m 0440 "$policy" "$target_policy"
fi
visudo -cf "$target_policy"
echo 'Installed fixed release boundary and digest-restricted build/activate privilege. No release action executed.'
