#!/usr/bin/env python3
"""Build provisional static D8 hydrology products from a projected COG MDT."""
import argparse
from collections import deque
import hashlib
import heapq
import json
import math
from pathlib import Path
import tempfile

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.shutil import copy as raster_copy
from rasterio.transform import from_bounds, xy
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_bounds

from optimize_surface import RADIUS, tile_range

NEIGHBOURS = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def priority_flood(elevation, valid):
    """Fill depressions and record an acyclic route across every created flat."""
    rows, cols = elevation.shape
    filled = elevation.astype('float64', copy=True)
    visited = ~valid.copy()
    parent = np.full(rows * cols, -1, dtype='int64')
    heap = []
    for row in range(rows):
        for col in range(cols):
            if not valid[row, col]:
                continue
            boundary = row in (0, rows - 1) or col in (0, cols - 1)
            if not boundary:
                boundary = any(not valid[row + dr, col + dc] for dr, dc in NEIGHBOURS)
            if boundary:
                visited[row, col] = True
                heapq.heappush(heap, (float(filled[row, col]), row, col))
    if not heap:
        raise ValueError('El MDT no tiene un borde de drenaje válido.')
    while heap:
        level, row, col = heapq.heappop(heap)
        here = row * cols + col
        for dr, dc in NEIGHBOURS:
            nr, nc = row + dr, col + dc
            if nr < 0 or nr >= rows or nc < 0 or nc >= cols or visited[nr, nc]:
                continue
            visited[nr, nc] = True
            parent[nr * cols + nc] = here
            filled[nr, nc] = max(float(elevation[nr, nc]), level)
            heapq.heappush(heap, (float(filled[nr, nc]), nr, nc))
    if np.any(valid & ~visited):
        raise ValueError('Hay celdas válidas desconectadas del borde del MDT.')
    return filled, parent


def d8_routes(filled, valid, parent, xres, yres):
    rows, cols = filled.shape
    downstream = np.full(rows * cols, -1, dtype='int64')
    direction = np.full((rows, cols), 255, dtype='uint8')
    distances = [yres, math.hypot(xres, yres), xres, math.hypot(xres, yres),
                 yres, math.hypot(xres, yres), xres, math.hypot(xres, yres)]
    for row, col in np.argwhere(valid):
        best = -1
        best_slope = 0.0
        for code, ((dr, dc), distance) in enumerate(zip(NEIGHBOURS, distances), 1):
            nr, nc = row + dr, col + dc
            if 0 <= nr < rows and 0 <= nc < cols and valid[nr, nc]:
                slope = (filled[row, col] - filled[nr, nc]) / distance
                if slope > best_slope:
                    best_slope, best = slope, nr * cols + nc
        here = row * cols + col
        target = best if best >= 0 else int(parent[here])
        if target >= 0:
            downstream[here] = target
            tr, tc = divmod(target, cols)
            direction[row, col] = NEIGHBOURS.index((tr - row, tc - col)) + 1
        else:
            direction[row, col] = 0
    return downstream, direction


def accumulation(downstream, valid):
    flat_valid = valid.ravel()
    indegree = np.zeros(downstream.size, dtype='int32')
    targets = downstream[flat_valid & (downstream >= 0)]
    np.add.at(indegree, targets, 1)
    queue = deque(np.flatnonzero(flat_valid & (indegree == 0)).tolist())
    result = np.zeros(downstream.size, dtype='float64')
    result[flat_valid] = 1
    processed = 0
    while queue:
        cell = queue.popleft()
        processed += 1
        target = downstream[cell]
        if target >= 0:
            result[target] += result[cell]
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(int(target))
    if processed != int(flat_valid.sum()):
        raise ValueError('La dirección D8 contiene un ciclo.')
    return result.reshape(valid.shape)


def write_cog(path, values, source, dtype, nodata):
    with tempfile.TemporaryDirectory(prefix='torrents-hydrology-cog-') as work:
        temporary = Path(work) / 'working.tif'
        profile = source.profile.copy()
        profile.update(driver='GTiff', dtype=dtype, nodata=nodata, tiled=True,
                       blockxsize=256, blockysize=256, compress='DEFLATE')
        with rasterio.open(temporary, 'w', **profile) as target:
            target.write(values.astype(dtype), 1)
            factors = [f for f in (2, 4, 8, 16, 32, 64) if min(source.width, source.height) // f >= 1]
            target.build_overviews(factors, Resampling.average if dtype != 'uint8' else Resampling.nearest)
        raster_copy(temporary, path, driver='COG', BLOCKSIZE=256, COMPRESS='DEFLATE',
                    PREDICTOR='FLOATING_POINT' if dtype.startswith('float') else 'STANDARD',
                    OVERVIEWS='FORCE_USE_EXISTING')


def write_tiles(rgba, source, bounds, output, folder, minzoom, maxzoom):
    with tempfile.TemporaryDirectory(prefix='torrents-hydrology-display-') as work:
        image = Path(work) / 'display.tif'
        with rasterio.open(image, 'w', driver='GTiff', width=source.width, height=source.height,
                           count=4, dtype='uint8', crs=source.crs, transform=source.transform) as target:
            target.write(rgba.transpose(2, 0, 1))
            target.colorinterp = (rasterio.enums.ColorInterp.red, rasterio.enums.ColorInterp.green,
                                  rasterio.enums.ColorInterp.blue, rasterio.enums.ColorInterp.alpha)
        with rasterio.open(image) as display:
            for zoom in range(minzoom, maxzoom + 1):
                xs, ys = tile_range(bounds, zoom)
                span = 2 * RADIUS / (2 ** zoom)
                for x in xs:
                    for y in ys:
                        west, north = -RADIUS + x * span, RADIUS - y * span
                        transform = from_bounds(west, north - span, west + span, north, 256, 256)
                        with WarpedVRT(display, crs='EPSG:3857', transform=transform, width=256,
                                       height=256, resampling=Resampling.average) as vrt:
                            pixels = vrt.read()
                        path = output / folder / str(zoom) / str(x) / f'{y}.png'
                        path.parent.mkdir(parents=True, exist_ok=True)
                        with rasterio.open(path, 'w', driver='PNG', width=256, height=256,
                                           count=4, dtype='uint8') as target:
                            target.write(pixels)


def build(surface, minzoom=8, maxzoom=17, network_min_area_m2=2500):
    surface = Path(surface).resolve()
    with rasterio.open(surface / 'dtm.tif') as source:
        masked = source.read(1, masked=True)
        valid = ~np.ma.getmaskarray(masked)
        elevation = masked.filled(np.nan).astype('float64')
        filled, parent = priority_flood(elevation, valid)
        downstream, direction = d8_routes(filled, valid, parent, abs(source.res[0]), abs(source.res[1]))
        cells = accumulation(downstream, valid)
        cell_area = abs(source.res[0] * source.res[1])
        area = cells * cell_area
        depth = np.where(valid, np.maximum(0, filled - elevation), -9999)
        conditioned = np.where(valid, filled, -9999)
        area_raster = np.where(valid, area, -9999)
        direction_raster = np.where(valid, direction, 255)
        write_cog(surface / 'conditioned-dtm.tif', conditioned, source, 'float32', -9999)
        write_cog(surface / 'depression-depth.tif', depth, source, 'float32', -9999)
        write_cog(surface / 'flow-accumulation.tif', area_raster, source, 'float32', -9999)
        write_cog(surface / 'flow-direction.tif', direction_raster, source, 'uint8', 255)
        bounds = transform_bounds(source.crs, 'EPSG:4326', *source.bounds, densify_pts=21)
        alpha_depth = np.zeros(depth.shape, dtype='uint8')
        positive = depth[(depth > 0) & valid]
        depth_scale = float(np.percentile(positive, 98)) if positive.size else 1.0
        alpha_depth[valid] = (np.clip(depth[valid] / max(depth_scale, 0.01), 0, 1) * 190).astype('uint8')
        depression_rgba = np.dstack([
            np.full(depth.shape, 34, dtype='uint8'), np.full(depth.shape, 128, dtype='uint8'),
            np.full(depth.shape, 184, dtype='uint8'), alpha_depth,
        ])
        log_area = np.zeros(area.shape, dtype='float64')
        log_area[valid] = np.log1p(area[valid])
        lo = math.log1p(network_min_area_m2 / 4)
        hi = float(np.percentile(log_area[valid], 99.8))
        accumulation_alpha = np.zeros(area.shape, dtype='uint8')
        accumulation_alpha[valid] = (np.clip((log_area[valid] - lo) / max(hi - lo, 0.01), 0, 1) * 180).astype('uint8')
        accumulation_rgba = np.dstack([
            np.full(area.shape, 23, dtype='uint8'), np.full(area.shape, 104, dtype='uint8'),
            np.full(area.shape, 153, dtype='uint8'), accumulation_alpha,
        ])
        write_tiles(depression_rgba, source, bounds, surface, 'depressions', minzoom, maxzoom)
        write_tiles(accumulation_rgba, source, bounds, surface, 'accumulation', minzoom, maxzoom)
        transformer = Transformer.from_crs(source.crs, 4326, always_xy=True)
        rows, cols = source.shape
        features = []
        for cell in np.flatnonzero(valid.ravel() & (area.ravel() >= network_min_area_m2) & (downstream >= 0)):
            target = int(downstream[cell])
            row, col = divmod(int(cell), cols)
            target_row, target_col = divmod(target, cols)
            x1, y1 = xy(source.transform, row, col)
            x2, y2 = xy(source.transform, target_row, target_col)
            lon1, lat1 = transformer.transform(x1, y1)
            lon2, lat2 = transformer.transform(x2, y2)
            features.append({'type': 'Feature', 'properties': {'area_m2': round(float(area[row, col]), 2)},
                             'geometry': {'type': 'LineString', 'coordinates': [[lon1, lat1], [lon2, lat2]]}})
        (surface / 'flow-network.geojson').write_text(json.dumps(
            {'type': 'FeatureCollection', 'features': features}, separators=(',', ':')) + '\n', encoding='utf-8')
        info = {
            'schema_version': 1,
            'algorithm': 'Priority-Flood depression filling + D8 single-flow direction',
            'cell_area_m2': cell_area,
            'valid_cells': int(valid.sum()),
            'filled_cells': int(np.count_nonzero((depth > 1e-6) & valid)),
            'maximum_fill_depth_m': float(depth[valid].max()),
            'fill_volume_m3': float(depth[valid].sum() * cell_area),
            'maximum_contributing_area_m2': float(area[valid].max()),
            'network_minimum_area_m2': network_min_area_m2,
            'network_segments': len(features),
            'status': 'provisional_unvalidated',
            'limitations': 'Borde de la tesela abierto; sin alcantarillas, puentes, edificios, rugosidad ni lluvia.',
        }
        (surface / 'hydrology.json').write_text(json.dumps(info, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    report = json.loads((surface / 'surface.json').read_text(encoding='utf-8'))
    report['hydrology_ready'] = True
    report['hydrology'] = info
    (surface / 'surface.json').write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    records = {
        path.relative_to(surface).as_posix(): {'sha256': sha256(path), 'bytes': path.stat().st_size}
        for path in sorted(surface.rglob('*'))
        if path.is_file() and path.name != 'checksums.json'
    }
    (surface / 'checksums.json').write_text(
        json.dumps(records, indent=2) + '\n', encoding='utf-8')
    return info


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('surface', type=Path)
    parser.add_argument('--minzoom', type=int, default=8)
    parser.add_argument('--maxzoom', type=int, default=17)
    parser.add_argument('--network-min-area-m2', type=float, default=2500)
    args = parser.parse_args()
    print(json.dumps(build(args.surface, args.minzoom, args.maxzoom, args.network_min_area_m2),
                     indent=2, ensure_ascii=False))
