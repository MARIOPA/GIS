#!/usr/bin/env python3
"""Lossless native COG + a display-only XYZ pyramid, with reproducible provenance."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import tempfile

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.shutil import copy as raster_copy
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_bounds, transform_geom

RADIUS = 20037508.342789244


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def tile_range(bounds, zoom):
    west, south, east, north = bounds
    n = 2 ** zoom
    def x(lon):
        return max(0, min(n - 1, int((lon + 180) / 360 * n)))
    def y(lat):
        lat = max(-85.05112878, min(85.05112878, lat))
        return max(0, min(n - 1, int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)))
    return range(x(west), x(east) + 1), range(y(north), y(south) + 1)


def optimize(source, output, minzoom=8, maxzoom=17):
    source, output = Path(source).resolve(), Path(output).resolve()
    if source == output or source in output.parents:
        raise ValueError('La salida debe estar fuera de la carpeta original.')
    if not 0 <= minzoom <= maxzoom <= 20:
        raise ValueError('Zoom inválido.')
    if output.exists() and any(output.iterdir()):
        raise ValueError('La carpeta de salida debe estar vacía.')
    manifest = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))
    with rasterio.open(source / 'dtm.tif') as src:
        bounds = transform_bounds(src.crs, 'EPSG:4326', *src.bounds, densify_pts=21)
        count = sum(len(xs) * len(ys) for xs, ys in (tile_range(bounds, z) for z in range(minzoom, maxzoom + 1)))
        if count > 20000:
            raise ValueError('Más de 20.000 teselas: divide y planifica la publicación por regiones.')
        output.mkdir(parents=True, exist_ok=True)
        # Build overviews explicitly, even for this small pilot. Never modify source cells.
        with tempfile.TemporaryDirectory(prefix='torrents-cog-') as work:
            temp = Path(work) / 'working.tif'
            profile = src.profile.copy()
            profile.update(driver='GTiff', tiled=True, blockxsize=256, blockysize=256, compress='DEFLATE')
            with rasterio.open(temp, 'w', **profile) as dst:
                for _, window in src.block_windows(1):
                    dst.write(src.read(window=window), window=window)
                dst.update_tags(**src.tags())
                factors = [f for f in (2, 4, 8, 16, 32, 64) if min(src.width, src.height) // f >= 1]
                dst.build_overviews(factors, Resampling.average)
                dst.update_tags(ns='rio_overview', resampling='average')
            raster_copy(temp, output / 'dtm.tif', driver='COG', BLOCKSIZE=256,
                        COMPRESS='DEFLATE', PREDICTOR='FLOATING_POINT', OVERVIEWS='FORCE_USE_EXISTING')
        # One global elevation palette, and hillshade from the full native raster.
        arr = src.read(1, masked=True)
        if arr.count() == 0:
            raise ValueError('El MDT no tiene celdas válidas.')
        values = arr.compressed()
        lo, hi = (float(v) for v in np.percentile(values, [2, 98]))
        raw = arr.filled(float(np.median(values)))
        dy, dx = np.gradient(raw, src.res[1], src.res[0])
        slope, aspect = np.arctan(np.hypot(dx, dy)), np.arctan2(-dx, dy)
        shade = np.clip(np.cos(np.pi / 4) * np.cos(slope) + np.sin(np.pi / 4) * np.sin(slope) * np.cos(7 * np.pi / 4 - aspect), 0.2, 1)
        t = np.clip((raw - lo) / max(0.001, hi - lo), 0, 1)
        low, high = np.array([47, 130, 130]), np.array([211, 227, 177])
        rgb = (low * (1 - t[:, :, None]) + high * t[:, :, None]).astype('uint8')
        rgba = np.concatenate([rgb, ((~np.ma.getmaskarray(arr))[:, :, None] * 255).astype('uint8')], axis=2)
        shadow = ((1 - shade) * 210).astype('uint8')
        hillshade_rgba = np.concatenate([
            np.zeros((*shadow.shape, 3), dtype='uint8'),
            (shadow * (~np.ma.getmaskarray(arr))).astype('uint8')[:, :, None],
        ], axis=2)
        with tempfile.TemporaryDirectory(prefix='torrents-display-') as work:
            def write_tiles(pixels_rgba, folder):
                image = Path(work) / f'{folder}.tif'
                with rasterio.open(image, 'w', driver='GTiff', width=src.width, height=src.height,
                                   count=4, dtype='uint8', crs=src.crs, transform=src.transform) as dst:
                    dst.write(pixels_rgba.transpose(2, 0, 1))
                    dst.colorinterp = (rasterio.enums.ColorInterp.red, rasterio.enums.ColorInterp.green,
                                       rasterio.enums.ColorInterp.blue, rasterio.enums.ColorInterp.alpha)
                display = rasterio.open(image)
                for z in range(minzoom, maxzoom + 1):
                    xs, ys = tile_range(bounds, z)
                    span = 2 * RADIUS / (2 ** z)
                    for x in xs:
                        for y in ys:
                            west, north = -RADIUS + x * span, RADIUS - y * span
                            transform = from_bounds(west, north - span, west + span, north, 256, 256)
                            with WarpedVRT(display, crs='EPSG:3857', transform=transform,
                                           width=256, height=256, resampling=Resampling.average) as vrt:
                                pixels = vrt.read()
                            path = output / folder / str(z) / str(x) / f'{y}.png'
                            path.parent.mkdir(parents=True, exist_ok=True)
                            with rasterio.open(path, 'w', driver='PNG', width=256, height=256, count=4, dtype='uint8') as dst:
                                dst.write(pixels)
                display.close()
            write_tiles(rgba, 'tiles')
            write_tiles(hillshade_rgba, 'hillshade')
        with tempfile.TemporaryDirectory(prefix='torrents-contours-') as work:
            projected = Path(work) / 'contours.geojson'
            try:
                subprocess.run([
                    'gdal_contour', '-q', '-a', 'elevation', '-i', '5',
                    '-f', 'GeoJSON', str(output / 'dtm.tif'), str(projected),
                ], check=True)
            except FileNotFoundError as error:
                raise ValueError('Se necesita gdal_contour para preparar curvas de nivel.') from error
            contours = json.loads(projected.read_text(encoding='utf-8'))
            features = []
            for feature in contours['features']:
                elevation = float(feature['properties']['elevation'])
                features.append({
                    'type': 'Feature',
                    'properties': {'elevation': elevation},
                    'geometry': transform_geom(src.crs, 'EPSG:4326', feature['geometry'], precision=7),
                })
            (output / 'contours.geojson').write_text(json.dumps({
                'type': 'FeatureCollection', 'features': features,
            }, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    for name in ('manifest.json', 'preview.png', 'preview.json'):
        shutil.copy2(source / name, output / name)
    with rasterio.open(output / 'dtm.tif') as optimized, rasterio.open(source / 'dtm.tif') as original:
        for _, window in original.block_windows(1):
            if not np.array_equal(original.read(window=window), optimized.read(window=window)):
                raise ValueError('La optimización cambió las cotas originales.')
        actual_factors = optimized.overviews(1)
    tile_info = {'scheme': 'xyz', 'tile_size': 256, 'minzoom': minzoom, 'maxzoom': maxzoom,
                 'bounds': list(bounds), 'count': count, 'palette_percentiles': [lo, hi],
                 'purpose': 'display_only_not_analysis'}
    (output / 'tiles.json').write_text(json.dumps(tile_info, indent=2) + '\n', encoding='utf-8')
    hillshade_info = {**tile_info, 'purpose': 'display_hillshade_only'}
    (output / 'hillshade.json').write_text(json.dumps(hillshade_info, indent=2) + '\n', encoding='utf-8')
    report = {'id': 'pnoa-bal-462-4382-v2', 'schema_version': 1,
              'source_laz_sha256': manifest['source_inspection']['sha256'],
              'original_dtm_sha256': sha256(source / 'dtm.tif'), 'dtm_sha256': sha256(output / 'dtm.tif'),
              'native_values_unchanged': True, 'native_resolution_m': manifest['resolution_m'],
              'cog_overviews': actual_factors, 'tiles': tile_info, 'hillshade': hillshade_info,
              'contours': {'minimum_interval_m': 5, 'feature_count': len(features)},
              'hydrology_ready': False, 'validation': manifest['status'],
              'vertical_reference': manifest['vertical_reference']}
    (output / 'surface.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    files = {str(p.relative_to(output)).replace('\\', '/'): {'sha256': sha256(p), 'bytes': p.stat().st_size}
             for p in sorted(output.rglob('*')) if p.is_file()}
    (output / 'checksums.json').write_text(json.dumps(files, indent=2) + '\n', encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--minzoom', type=int, default=8)
    parser.add_argument('--maxzoom', type=int, default=17)
    args = parser.parse_args()
    print(json.dumps(optimize(args.source, args.output, args.minzoom, args.maxzoom), indent=2, ensure_ascii=False))
