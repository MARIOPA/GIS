#!/usr/bin/env bash
set -euo pipefail
torrents_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ $# -ne 1 ]]; then
  echo 'Uso: bash importar-mdt.sh "/ruta/al/mdt-piloto.zip o carpeta sincronizada"'
  exit 1
fi
exec "$torrents_dir/runtime/node/bin/node" "$torrents_dir/scripts/surface.mjs" "$1"
