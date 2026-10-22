#!/usr/bin/env python3
"""Render a small real-data overview; the full DTM remains on the server."""
import json
from pathlib import Path
import sys
import numpy as np
import rasterio
from rasterio.vrt import WarpedVRT
from rasterio.enums import Resampling
from rasterio.warp import transform as transform_coords

root = Path(sys.argv[1])
manifest = json.loads((root / 'manifest.json').read_text())
with rasterio.open(root / 'dtm.tif') as src:
    with WarpedVRT(src, crs='EPSG:3857', resampling=Resampling.bilinear) as vrt:
        factor = min(1, 1024 / max(vrt.width, vrt.height))
        rows, cols = max(1, round(vrt.height * factor)), max(1, round(vrt.width * factor))
        arr = vrt.read(1, out_shape=(rows, cols), masked=True)
        valid = ~np.ma.getmaskarray(arr)
        values = arr.compressed()
        lo, hi = float(np.percentile(values, 2)), float(np.percentile(values, 98))
        raw = arr.filled(float(np.median(values)))
        dy, dx = np.gradient(raw, vrt.res[1] / factor, vrt.res[0] / factor)
        slope = np.arctan(np.hypot(dx, dy))
        aspect = np.arctan2(-dx, dy)
        shade = np.clip(np.cos(np.pi / 4) * np.cos(slope) + np.sin(np.pi / 4) * np.sin(slope) * np.cos(7 * np.pi / 4 - aspect), 0.2, 1)
        t = np.clip((raw - lo) / max(0.001, hi - lo), 0, 1)
        low, high = np.array([47, 130, 130]), np.array([211, 227, 177])
        rgb = ((low[None, None, :] * (1 - t[:, :, None]) + high[None, None, :] * t[:, :, None]) * (0.6 + shade[:, :, None] * 0.4)).astype('uint8')
        rgba = np.concatenate([rgb, (valid[:, :, None] * 255).astype('uint8')], axis=2)
        with rasterio.open(root / 'preview.png', 'w', driver='PNG', width=cols, height=rows, count=4, dtype='uint8') as out:
            out.write(rgba.transpose(2, 0, 1))
        b = vrt.bounds
        xs, ys = transform_coords('EPSG:3857', 'EPSG:4326', [b.left, b.right, b.right, b.left], [b.top, b.top, b.bottom, b.bottom])
        metadata = {'status': manifest['status'], 'coordinates': list(map(list, zip(xs, ys))),
                    'center': [sum(xs)/4, sum(ys)/4], 'resolution_m': manifest['resolution_m'],
                    'z_min': float(values.min()), 'z_max': float(values.max()),
                    'valid_fraction': float(valid.mean()), 'vertical_reference': manifest['vertical_reference'],
                    'source': manifest['source_inspection']['file']}
        (root / 'preview.json').write_text(json.dumps(metadata, indent=2, ensure_ascii=False)+'\n')
        print(json.dumps(metadata, indent=2, ensure_ascii=False))
