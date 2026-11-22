#!/usr/bin/env bash
# Canonical additive two-environment preparation; no app activation or routing.
set -euo pipefail
[[ ${1:-} == --install ]] || { echo 'Usage: sudo bash bootstrap-host.sh --install [--environment staging|production|both]' >&2; exit 64; }
template_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
exec /usr/bin/python3 "$template_root/native-host.py" "$@"
