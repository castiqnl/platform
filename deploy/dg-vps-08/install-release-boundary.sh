#!/usr/bin/env bash
# Install only reviewed canonical per-environment helpers; never execute releases.
set -euo pipefail
[[ ${1:-} == --install ]] || { echo 'Usage: sudo bash install-release-boundary.sh --install [--replace-reviewed]' >&2; exit 64; }
template_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repository_root=$(cd -- "$template_root/../.." && pwd)
exec /usr/bin/python3 "$template_root/native-install-boundary.py" --source-root "$repository_root" "$@"
