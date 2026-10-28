#!/usr/bin/env bash
set -euo pipefail
torrents_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
destination="${1:-${XDG_DATA_HOME:-$HOME/.local/share}/torrents/0.5.0}"
destination="$(realpath -m -- "$destination")"
if [[ "$destination" == "$torrents_dir" || "$destination" == "$torrents_dir/"* ]]; then
  echo 'Elige un destino fuera de la carpeta portable original.'
  exit 1
fi
if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
  echo 'Este paquete requiere Linux x64 con glibc 2.28 o posterior (Ubuntu 22.04/24.04, Debian 12 o similar).'
  exit 1
fi
if [[ -e "$destination" ]]; then
  echo "El destino ya existe. No se sobrescriben proyectos: $destination"
  exit 1
fi
mkdir -p -- "$(dirname -- "$destination")"
stage="$(mktemp -d "$(dirname -- "$destination")/.torrents-install-XXXXXX")"
find "$torrents_dir" -mindepth 1 -maxdepth 1 ! -name .data -exec cp -a -- {} "$stage/" \;
"$stage/runtime/node/bin/node" --version
"$stage/runtime/python/bin/python3" -c 'import rasterio, numpy, pyproj; print("Terreno disponible")'
mv -- "$stage" "$destination"
# A relocatable shell launcher avoids editing PATH or requiring administrator privileges.
echo "Instalado en $destination"
echo "Importar MDT: bash \"$destination/importar-mdt.sh\" /ruta/al/mdt-piloto.zip"
echo "Abrir: bash \"$destination/abrir-torrents.sh\""
