#!/usr/bin/env bash
# Additive, reviewed host preparation. Does not register/start any runner or app,
# install a sudo rule, activate a release or write an imported Caddy site.
set -euo pipefail

[[ ${1:-} == --install && $# == 1 ]] || { echo 'Usage: sudo bash bootstrap-host.sh --install' >&2; exit 64; }
[[ $(id -u) == 0 ]] || { echo 'Root required for isolated host preparation.' >&2; exit 77; }
[[ $(hostname -s) == dg-vps-08 ]] || { echo 'Unexpected hostname.' >&2; exit 78; }
[[ $(sha256sum /etc/machine-id | cut -d ' ' -f 1) == 4c306aaa5338d05ce10f127bea80dafaf7e62b1500be34cdff3b5ddd617e7bd7 ]] || { echo 'Unexpected machine binding.' >&2; exit 78; }
[[ $(uname -m) == x86_64 ]] || { echo 'Expected x86_64.' >&2; exit 78; }
[[ ! -e /srv/castiq-staging/current && ! -L /srv/castiq-staging/current ]] || { echo 'Existing current release: preparation must not modify this environment.' >&2; exit 78; }
for unit in castiq-staging.service castiq-staging-worker.service castiq-staging-runner.service; do
  if systemctl is-active --quiet "$unit"; then
    echo "Existing active unit: $unit; preparation must not modify this environment." >&2
    exit 78
  fi
done
[[ -z $(ss -H -ltn '( sport = :4184 )') ]] || { echo 'Reserved staging port4184 is already in use.' >&2; exit 78; }
template_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
node_root=/opt/castiq/node-v24.18.0-linux-x64
node_archive=node-v24.18.0-linux-x64.tar.xz
node_sha=55aa7153f9d88f28d765fcdad5ae6945b5c0f98a36881703817e4c450fa76742
runner_root=/var/lib/castiq-runner/actions-runner
runner_archive=actions-runner-linux-x64-2.338.2.tar.gz
runner_sha=baebf204307bac6193480852732f0aba2ae97b6c5597c244f4d5558390147c40

copy_own_file() {
  local source=$1 target=$2 mode=$3
  if [[ -e $target || -L $target ]]; then
    if [[ ! -f $target || -L $target ]] || ! cmp -s -- "$source" "$target"; then
      echo "Refusing existing different file: $target" >&2
      exit 73
    fi
    [[ $(stat -c '%U:%G' "$target") == root:root ]] || { echo "Refusing unexpected file ownership: $target" >&2; exit 73; }
  else
    install -o root -g root -m "$mode" -- "$source" "$target"
  fi
}

for account in castiq-app castiq-build castiq-runner; do
  if getent passwd "$account" >/dev/null; then
    [[ $(getent passwd "$account" | cut -d: -f6) == "/var/lib/$account" ]] || { echo "Unexpected existing account: $account" >&2; exit 73; }
  else
    useradd --system --user-group --create-home --home-dir "/var/lib/$account" --shell /usr/sbin/nologin "$account"
  fi
done
if ! getent group dg-build >/dev/null; then groupadd --system dg-build; fi
usermod -a -G dg-build castiq-build

# Root controls the release tree and all privileged configuration. The only
# application-writable tree is its uploads directory.
install -d -o root -g root -m 0755 /srv/castiq-staging /srv/castiq-staging/candidates /srv/castiq-staging/releases
install -d -o root -g root -m 0700 /srv/castiq-staging/locks /etc/castiq-staging /etc/castiq-staging/runtime /etc/castiq-staging/runtime.d /etc/castiq-staging/releases.d /etc/castiq-staging/pending
install -d -o root -g castiq-app -m 0750 /srv/castiq-staging/shared
install -d -o castiq-app -g castiq-app -m 0700 /srv/castiq-staging/shared/uploads
install -d -o castiq-build -g castiq-build -m 0700 /var/lib/castiq-build/work /var/lib/castiq-build/npm-cache
install -d -o castiq-runner -g castiq-runner -m 0700 /var/lib/castiq-runner/actions-runner
install -d -o root -g root -m 0755 /opt/castiq /usr/local/libexec

tmpfile=$(mktemp)
trap 'rm -f -- "$tmpfile"; [[ -z ${download_dir:-} ]] || rm -rf -- "$download_dir"; [[ -z ${runner_download_dir:-} ]] || rm -rf -- "$runner_download_dir"' EXIT
printf 'f /run/lock/dg-build.lock 0660 root dg-build -\n' > "$tmpfile"
if [[ -e /run/lock/dg-build.lock || -L /run/lock/dg-build.lock ]]; then
  [[ -f /run/lock/dg-build.lock && ! -L /run/lock/dg-build.lock && $(stat -c '%U:%G:%a' /run/lock/dg-build.lock) == root:dg-build:660 ]] || { echo 'Refusing an incompatible pre-existing shared build lock.' >&2; exit 73; }
fi
copy_own_file "$tmpfile" /etc/tmpfiles.d/castiq-staging-build-lock.conf 0644
systemd-tmpfiles --create /etc/tmpfiles.d/castiq-staging-build-lock.conf

if [[ ! -e $node_root ]]; then
  download_dir=$(mktemp -d /opt/castiq/.node-download.XXXXXXXX)
  curl --fail --silent --show-error --proto '=https' --tlsv1.2 "https://nodejs.org/dist/v24.18.0/$node_archive" -o "$download_dir/$node_archive"
  printf '%s  %s\n' "$node_sha" "$download_dir/$node_archive" | sha256sum --check --status
  tar -xJf "$download_dir/$node_archive" --directory "$download_dir" --no-same-owner
  chown -R root:root "$download_dir/node-v24.18.0-linux-x64"
  chmod -R go-w "$download_dir/node-v24.18.0-linux-x64"
  mv -- "$download_dir/node-v24.18.0-linux-x64" "$node_root"
fi
[[ $($node_root/bin/node --version) == v24.18.0 ]] || { echo 'Unexpected Node version.' >&2; exit 78; }
[[ $(PATH="$node_root/bin:$PATH" "$node_root/bin/npm" --version) == 11.16.0 ]] || { echo 'Unexpected npm version.' >&2; exit 78; }
[[ $(stat -c '%U:%G' "$node_root") == root:root ]] || { echo 'Unexpected runtime ownership.' >&2; exit 78; }

if [[ ! -e $runner_root/run.sh ]]; then
  [[ -z $(find "$runner_root" -mindepth 1 -maxdepth 1 -print -quit) ]] || { echo 'Refusing a non-empty runner directory without its expected launcher.' >&2; exit 73; }
  runner_download_dir=$(mktemp -d /var/lib/castiq-runner/.runner-download.XXXXXXXX)
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 "https://github.com/actions/runner/releases/download/v2.338.2/$runner_archive" -o "$runner_download_dir/$runner_archive"
  printf '%s  %s\n' "$runner_sha" "$runner_download_dir/$runner_archive" | sha256sum --check --status
  tar -xzf "$runner_download_dir/$runner_archive" --directory "$runner_root" --no-same-owner
  chown -R castiq-runner:castiq-runner "$runner_root"
  rm -rf -- "$runner_download_dir"
fi
[[ $(runuser -u castiq-runner -- "$runner_root/bin/Runner.Listener" --version) == 2.338.2 ]] || { echo 'Unexpected runner version or missing runtime prerequisites.' >&2; exit 78; }

for unit in castiq-staging.service castiq-staging-worker.service castiq-staging-runner.service; do
  copy_own_file "$template_root/$unit" "/etc/systemd/system/$unit" 0644
done
copy_own_file "$template_root/Caddyfile.pending" /etc/castiq-staging/pending/Caddyfile.pending 0600
copy_own_file "$template_root/probe-network-isolation.py" /usr/local/libexec/castiq-network-isolation-probe.py 0644
systemctl daemon-reload
systemd-analyze verify /etc/systemd/system/castiq-staging.service /etc/systemd/system/castiq-staging-worker.service /etc/systemd/system/castiq-staging-runner.service
for unit in castiq-staging.service castiq-staging-worker.service castiq-staging-runner.service; do
  [[ $(systemctl is-active "$unit" || true) == inactive ]] || { echo "Unexpected active unit: $unit" >&2; exit 78; }
  [[ $(systemctl is-enabled "$unit" || true) == disabled ]] || { echo "Unexpected enabled unit: $unit" >&2; exit 78; }
done
[[ ! -e /srv/castiq-staging/current && ! -L /srv/castiq-staging/current ]] || { echo 'Unexpected current release: preparation does not touch it.' >&2; exit 78; }
printf 'Prepared isolated accounts, Node v24.18.0/npm11.16.0, directories and inactive units; no release or public route activated.\n'
