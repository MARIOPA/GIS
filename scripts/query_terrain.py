#!/usr/bin/env python3
"""Windowed, server-side samples of a local DTM; no synthetic elevations."""
import json
from pathlib import Path
import sys
import math
import rasterio
import numpy as np
from pyproj import Transformer

root = Path(sys.argv[1])
request = json.load(sys.stdin)
with rasterio.open(root / 'dtm.tif') as src:
    to_native = Transformer.from_crs(4326, src.crs, always_xy=True)
    to_geo = Transformer.from_crs(src.crs, 4326, always_xy=True)
    if request['kind'] == 'point':
        xy = to_native.transform(request['lng'], request['lat'])
        value = next(src.sample([xy], masked=True))[0]
        z = None if np.ma.is_masked(value) else float(value)
        if z is not None and not math.isfinite(z):
            z = None
        result = {'elevation': z, 'status': 'outside_or_nodata' if z is None else 'candidate_not_validated',
                  'unit': 'native_Z', 'source': 'dtm.tif', 'vertical_validated': False}
    else:
        points = [to_native.transform(*p[:2]) for p in request['coordinates']]
        segments = [math.dist(a, b) for a, b in zip(points, points[1:])]
        total = sum(segments)
        if not total or total > 100000:
            raise ValueError('La línea debe tener entre 0 y 100 km.')
        count = min(400, max(2, math.ceil(total / max(src.res)) + 1))
        distances = [i * total / (count - 1) for i in range(count)]
        samples, j, prior = [], 0, 0
        for distance in distances:
            while j < len(segments) - 1 and distance > prior + segments[j]:
                prior += segments[j]
                j += 1
            ratio = (distance - prior) / segments[j] if segments[j] else 0
            a, b = points[j], points[j + 1]
            samples.append((a[0] + ratio * (b[0] - a[0]), a[1] + ratio * (b[1] - a[1])))
        values = []
        for distance, xy, sample in zip(distances, samples, src.sample(samples, masked=True)):
            value = sample[0]
            z = None if bool(sample.mask[0]) else float(value)
            if z is not None and not math.isfinite(z):
                z = None
            lng, lat = to_geo.transform(*xy)
            values.append({'distance_m': distance, 'elevation': z, 'lng': lng, 'lat': lat})
        result = {'samples': values, 'length_m': total, 'status': 'candidate_not_validated', 'vertical_validated': False, 'source': 'dtm.tif'}
    print(json.dumps(result, allow_nan=False))
