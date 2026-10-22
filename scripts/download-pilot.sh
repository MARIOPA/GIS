#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
mkdir -p .data/lidar
pilot='.data/lidar/PNOA_2024_BAL_462-4382_H31_NPC03.laz'
expected_sha='ef6745d44519a57b2015b5afa2d7e7dfdc3f99d2638deb4d7c2473c1a20a2f1f'
verify() { printf '%s  %s\n' "$expected_sha" "$1" | sha256sum --check --status; }
if [[ -f "$pilot" ]]; then
  verify "$pilot" || { printf '%s\n' 'El piloto existente no coincide con la copia inspeccionada. Se conserva; revisa el archivo.' >&2; exit 1; }
  exit 0
fi
part="$(mktemp .data/lidar/pilot.XXXXXX.part)"
trap 'rm -f -- "$part"' EXIT
curl --fail --location --silent --show-error --max-time 180 --max-filesize 100000000 \
 'https://drive.usercontent.google.com/download?id=1TmMVfsj-dibz6rWYn8IS9mODRV8rSDpT&export=download&confirm=t' -o "$part"
verify "$part" || { printf '%s\n' 'La descarga no coincide con el SHA256 de la copia inspeccionada; no se utilizará.' >&2; exit 1; }
mv -- "$part" "$pilot"
