#!/usr/bin/env python3
"""Interactive watershed and stationary rain screening over the prepared D8 surface."""
import base64
from collections import deque
import json
import math
from pathlib import Path
import sys

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.features import shapes
from rasterio.io import MemoryFile
from rasterio.transform import rowcol, xy
from rasterio.warp import transform_geom


NEIGHBOURS = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]


def downstream_from_direction(direction, valid):
    rows, cols = direction.shape
    downstream = np.full(rows * cols, -1, dtype='int64')
    for row, col in np.argwhere(valid):
        code = int(direction[row, col])
        if not 1 <= code <= 8:
            continue
        dr, dc = NEIGHBOURS[code - 1]
        nr, nc = row + dr, col + dc
        if 0 <= nr < rows and 0 <= nc < cols and valid[nr, nc]:
            downstream[row * cols + col] = nr * cols + nc
    return downstream


def watershed_mask(direction, valid, outlet_row, outlet_col):
    rows, cols = direction.shape
    result = np.zeros(direction.shape, dtype=bool)
    result[outlet_row, outlet_col] = True
    queue = deque([(outlet_row, outlet_col)])
    while queue:
        row, col = queue.popleft()
        for nr in range(max(0, row - 1), min(rows, row + 2)):
            for nc in range(max(0, col - 1), min(cols, col + 2)):
                if result[nr, nc] or not valid[nr, nc] or (nr == row and nc == col):
                    continue
                delta = (row - nr, col - nc)
                if delta in NEIGHBOURS and int(direction[nr, nc]) == NEIGHBOURS.index(delta) + 1:
                    result[nr, nc] = True
                    queue.append((nr, nc))
    return result


def downstream_cells(direction, valid, start_row, start_col):
    rows, cols = direction.shape
    result = []
    seen = set()
    row, col = start_row, start_col
    while 0 <= row < rows and 0 <= col < cols and valid[row, col]:
        cell = row * cols + col
        if cell in seen:
            raise ValueError('La dirección D8 contiene un ciclo.')
        seen.add(cell)
        result.append((row, col))
        code = int(direction[row, col])
        if not 1 <= code <= 8:
            break
        dr, dc = NEIGHBOURS[code - 1]
        nr, nc = row + dr, col + dc
        if not (0 <= nr < rows and 0 <= nc < cols and valid[nr, nc]):
            break
        row, col = nr, nc
    return result


def label_components(mask):
    rows, cols = mask.shape
    labels = np.full(mask.shape, -1, dtype='int32')
    members = []
    for start_row, start_col in np.argwhere(mask):
        if labels[start_row, start_col] >= 0:
            continue
        label = len(members)
        labels[start_row, start_col] = label
        queue = deque([(int(start_row), int(start_col))])
        cells = []
        while queue:
            row, col = queue.popleft()
            cells.append(row * cols + col)
            for dr, dc in NEIGHBOURS:
                nr, nc = row + dr, col + dc
                if 0 <= nr < rows and 0 <= nc < cols and mask[nr, nc] and labels[nr, nc] < 0:
                    labels[nr, nc] = label
                    queue.append((nr, nc))
        members.append(np.asarray(cells, dtype='int64'))
    return labels, members


def stationary_flood(elevation, conditioned, direction, valid, rainfall_mm, cell_area):
    """Route an instantaneous uniform event through connected depression reservoirs."""
    rows, cols = elevation.shape
    capacity_depth = np.where(valid, np.maximum(0, conditioned - elevation), 0)
    component_labels, members = label_components(capacity_depth > 1e-6)
    component_count = len(members)
    node_map = np.full(direction.shape, -1, dtype='int64')
    node_map[component_labels >= 0] = component_labels[component_labels >= 0]
    normal = valid & (component_labels < 0)
    normal_cells = np.flatnonzero(normal.ravel())
    node_map.ravel()[normal_cells] = component_count + np.arange(normal_cells.size)
    node_count = component_count + normal_cells.size
    cell_nodes = node_map.ravel()
    downstream = downstream_from_direction(direction, valid)
    edges = np.full(node_count, -1, dtype='int64')

    for cell in normal_cells:
        target = int(downstream[cell])
        if target >= 0:
            edges[cell_nodes[cell]] = cell_nodes[target]
    flat_conditioned = conditioned.ravel()
    for label, cells in enumerate(members):
        candidates = []
        for cell in cells:
            target = int(downstream[cell])
            if target >= 0 and cell_nodes[target] != label:
                candidates.append(target)
        if candidates:
            target = min(candidates, key=lambda cell: float(flat_conditioned[cell]))
            edges[label] = cell_nodes[target]
    edges[edges == np.arange(node_count)] = -1

    indegree = np.zeros(node_count, dtype='int32')
    np.add.at(indegree, edges[edges >= 0], 1)
    queue = deque(np.flatnonzero(indegree == 0).tolist())
    volume = np.zeros(node_count, dtype='float64')
    rain_per_cell = max(0, float(rainfall_mm)) / 1000 * cell_area
    np.add.at(volume, cell_nodes[valid.ravel()], rain_per_cell)
    storage = np.zeros(component_count, dtype='float64')
    capacities = np.array([
        float(capacity_depth.ravel()[cells].sum() * cell_area) for cells in members
    ])
    processed = 0
    boundary_outflow = 0.0
    while queue:
        node = queue.popleft()
        processed += 1
        available = volume[node]
        if node < component_count:
            storage[node] = min(available, capacities[node])
            available -= storage[node]
        target = int(edges[node])
        if target >= 0:
            volume[target] += available
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)
        else:
            boundary_outflow += available
    if processed != node_count:
        raise ValueError('La red de drenaje contraída contiene un ciclo.')

    depth = np.zeros(elevation.shape, dtype='float32')
    flat_elevation = elevation.ravel()
    flat_capacity = capacity_depth.ravel()
    for label, cells in enumerate(members):
        wanted = storage[label] / cell_area
        if wanted <= 0:
            continue
        low = float(np.min(flat_elevation[cells]))
        high = float(np.max(conditioned.ravel()[cells]))
        for _ in range(35):
            level = (low + high) / 2
            held = np.minimum(np.maximum(level - flat_elevation[cells], 0), flat_capacity[cells]).sum()
            if held < wanted:
                low = level
            else:
                high = level
        depth.ravel()[cells] = np.minimum(
            np.maximum(high - flat_elevation[cells], 0), flat_capacity[cells]
        ).astype('float32')
    return depth, {
        'rainfall_mm': float(rainfall_mm),
        'stored_volume_m3': float(storage.sum()),
        'boundary_outflow_m3': float(boundary_outflow),
        'flooded_area_m2': float(np.count_nonzero(depth > 1e-6) * cell_area),
        'maximum_depth_m': float(depth.max()),
        'reservoirs': component_count,
    }


def flood_png(depth, valid, minimum_depth):
    visible = valid & (depth >= max(0.001, minimum_depth))
    scale = np.clip(depth / max(0.5, float(depth.max())), 0, 1)
    rgba = np.zeros((*depth.shape, 4), dtype='uint8')
    rgba[..., 0] = (102 - 65 * scale).astype('uint8')
    rgba[..., 1] = (190 - 80 * scale).astype('uint8')
    rgba[..., 2] = (225 - 45 * scale).astype('uint8')
    rgba[..., 3] = np.where(visible, 120 + (110 * scale).astype('uint8'), 0)
    with MemoryFile() as memory:
        with memory.open(driver='PNG', width=depth.shape[1], height=depth.shape[0],
                         count=4, dtype='uint8') as target:
            target.write(rgba.transpose(2, 0, 1))
        return memory.read()


def query(surface, request):
    surface = Path(surface)
    with rasterio.open(surface / 'dtm.tif') as dtm, \
         rasterio.open(surface / 'flow-direction.tif') as flow, \
         rasterio.open(surface / 'conditioned-dtm.tif') as conditioned_source:
        elevation_data = dtm.read(1, masked=True)
        valid = ~np.ma.getmaskarray(elevation_data)
        elevation = elevation_data.filled(np.nan).astype('float64')
        direction = flow.read(1)
        conditioned = conditioned_source.read(1).astype('float64')
        to_native = Transformer.from_crs(4326, dtm.crs, always_xy=True)
        to_geo = Transformer.from_crs(dtm.crs, 4326, always_xy=True)
        if request['kind'] == 'watershed':
            native_x, native_y = to_native.transform(request['lng'], request['lat'])
            row, col = rowcol(dtm.transform, native_x, native_y)
            if not (0 <= row < dtm.height and 0 <= col < dtm.width and valid[row, col]):
                raise ValueError('El punto está fuera de la cobertura válida del MDT.')
            basin = watershed_mask(direction, valid, row, col)
            path_cells = downstream_cells(direction, valid, row, col)
            basin_features = []
            for geometry, value in shapes(basin.astype('uint8'), mask=basin, transform=dtm.transform):
                if value == 1:
                    basin_features.append({
                        'type': 'Feature',
                        'properties': {},
                        'geometry': transform_geom(dtm.crs, 'EPSG:4326', geometry, precision=7),
                    })
            native_path = [xy(dtm.transform, r, c) for r, c in path_cells]
            geographic_path = [list(to_geo.transform(x, y)) for x, y in native_path]
            distances = [math.dist(a, b) for a, b in zip(native_path, native_path[1:])]
            outlet = geographic_path[0]
            endpoint = geographic_path[-1]
            # GeoJSON requires a LineString to contain at least two positions.
            # A selected boundary cell can already be the final valid MDT cell.
            line_path = geographic_path if len(geographic_path) > 1 else geographic_path * 2
            return {
                'basin': {'type': 'FeatureCollection', 'features': basin_features},
                'downstream': {
                    'type': 'Feature', 'properties': {},
                    'geometry': {'type': 'LineString', 'coordinates': line_path},
                },
                'outlet': outlet,
                'endpoint': endpoint,
                'area_m2': float(basin.sum() * abs(dtm.res[0] * dtm.res[1])),
                'downstream_length_m': float(sum(distances)),
                'cells': int(basin.sum()),
                'status': 'provisional_unvalidated',
            }
        rainfall = min(500, max(0, float(request['rainfall_mm'])))
        minimum_depth = min(2, max(0, float(request.get('minimum_depth_m', 0.1))))
        depth, stats = stationary_flood(
            elevation, conditioned, direction, valid, rainfall, abs(dtm.res[0] * dtm.res[1])
        )
        image = base64.b64encode(flood_png(depth, valid, minimum_depth)).decode('ascii')
        corners_native = [
            (dtm.bounds.left, dtm.bounds.top), (dtm.bounds.right, dtm.bounds.top),
            (dtm.bounds.right, dtm.bounds.bottom), (dtm.bounds.left, dtm.bounds.bottom),
        ]
        return {
            **stats,
            'minimum_depth_m': minimum_depth,
            'image': 'data:image/png;base64,' + image,
            'coordinates': [list(to_geo.transform(*point)) for point in corners_native],
            'status': 'provisional_terrain_only',
            'limitations': 'Lluvia uniforme e instantánea; sin infiltración, drenaje, edificios ni correcciones verificadas.',
        }


if __name__ == '__main__':
    root = Path(sys.argv[1])
    request = json.load(sys.stdin)
    print(json.dumps(query(root, request), allow_nan=False, separators=(',', ':')))
