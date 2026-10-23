#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
bash scripts/download-pilot.sh
pilot='.data/lidar/PNOA_2024_BAL_462-4382_H31_NPC03.laz'
if [[ ! -f .data/lidar/inspection.json ]]; then
 .venv-lidar/bin/python scripts/inspect_laz.py "$pilot" --sha256 --output .data/lidar/inspection.json > /dev/null
fi
if [[ ! -f .data/terrain/manifest.json ]]; then
 .venv-lidar/bin/python scripts/build_terrain.py "$pilot" --output .data/terrain --resolution 1.5 \
  --vertical-reference 'Z nativa del LAZ. Datum vertical no confirmado; no usar como cota ortométrica validada.' \
  --source-spec 'Archivo del usuario PNOA_2024_BAL_462-4382_H31_NPC03.laz. LAS 1.4, clase 2. Conformidad PNOA pendiente de contrastar con ficha CNIG.'
fi
if [[ ! -f .data/terrain/preview.json || ! -f .data/terrain/preview.png ]]; then
 .venv-lidar/bin/python scripts/render_terrain.py .data/terrain
fi
.venv-lidar/bin/python - <<'PY'
import json
from pathlib import Path
import rasterio
root = Path('.data/terrain')
m = json.loads((root/'manifest.json').read_text())
assert m['source_inspection']['sha256'] == 'ef6745d44519a57b2015b5afa2d7e7dfdc3f99d2638deb4d7c2473c1a20a2f1f', 'El MDT procede de otra versión del piloto.'
assert m['status'] == 'candidate_not_validated', 'Revisa el estado de validación antes de reutilizar los productos.'
with rasterio.open(root/'dtm.tif') as src:
 assert src.crs.to_epsg() == 25831 and src.count == 1 and src.nodata == -9999, 'Metadatos del MDT incompatibles.'
 assert src.width == m['width'] and src.height == m['height'], 'Dimensiones del MDT incompatibles.'
print('Piloto disponible: MDT real provisional, sin validación vertical ni hidrológica.')
PY
if [[ ! -f .data/surfaces/pnoa-bal-462-4382-v3/surface.json ]]; then
 .venv-lidar/bin/python scripts/optimize_surface.py .data/terrain .data/surfaces/pnoa-bal-462-4382-v3
 .venv-lidar/bin/python scripts/build_hydrology.py .data/surfaces/pnoa-bal-462-4382-v3
fi
