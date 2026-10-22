#!/usr/bin/env bash
set -euo pipefail
torrents_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec "$torrents_dir/runtime/node/bin/node" "$torrents_dir/scripts/launch-local.mjs"
