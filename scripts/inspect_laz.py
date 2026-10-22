#!/usr/bin/env python3
"""Inspect real LAS/LAZ metadata and classification without loading the cloud into RAM."""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import laspy
import numpy as np


def inspect(path, header_only=False, checksum=False):
    path = Path(path)
    with laspy.open(path) as reader:
        h = reader.header
        crs = h.parse_crs()
        dimensions = set(h.point_format.dimension_names)
        area = float((h.maxs[0] - h.mins[0]) * (h.maxs[1] - h.mins[1]))
        report = {
            'file': path.name, 'bytes': path.stat().st_size,
            'las_version': str(h.version), 'point_format': h.point_format.id,
            'declared_points': h.point_count, 'compressed': h.are_points_compressed,
            'bounds': {'min': h.mins.tolist(), 'max': h.maxs.tolist()},
            'scale': h.scales.tolist(), 'offset': h.offsets.tolist(),
            'crs': crs.to_json_dict() if crs else None,
            'crs_authority': list(crs.to_authority()) if crs and crs.to_authority() else None,
            'axis_units': [a.unit_name for a in crs.axis_info] if crs else [],
            'vertical_reference_in_crs': any(c.is_vertical for c in crs.sub_crs_list) if crs else False,
            'bbox_area_native_units2': area,
            'classifications': {}, 'flags': {}, 'scanned_points': 0,
            'valid_ground_points': 0, 'complete_scan': not header_only,
            'notes': ['La densidad sobre el rectángulo envolvente no mide la cobertura efectiva.',
                      'La referencia vertical debe contrastarse con la ficha y las especificaciones del vuelo.']
        }
        counts, flags = collections.Counter(), collections.Counter()
        for points in (() if header_only else reader.chunk_iterator(1_000_000)):
            cls = np.asarray(points.classification)
            values, frequencies = np.unique(cls, return_counts=True)
            counts.update({int(v): int(n) for v, n in zip(values, frequencies)})
            excluded = np.zeros(len(points), dtype=bool)
            for flag in ('withheld', 'overlap', 'synthetic', 'key_point'):
                if flag in dimensions:
                    values = np.asarray(getattr(points, flag), dtype=bool)
                    flags[flag] += int(values.sum())
                    if flag in ('withheld', 'overlap', 'synthetic'):
                        excluded |= values
            report['valid_ground_points'] += int(((cls == 2) & ~excluded).sum())
            report['scanned_points'] += len(points)
        report['classifications'] = dict(counts)
        report['flags'] = dict(flags)
        if not header_only and report['scanned_points'] != h.point_count:
            raise ValueError('El recuento leído no coincide con la cabecera.')
        is_metric = bool(crs and crs.is_projected and all(a.unit_name == 'metre' for a in crs.axis_info[:2]))
        if is_metric and area > 0:
            report['nominal_density_pts_m2'] = h.point_count / area
            ground_density = report['valid_ground_points'] / area if not header_only else None
            report['valid_ground_density_pts_m2'] = ground_density
            report['candidate_resolution_m'] = max(0.5, math.ceil(math.sqrt(4 / ground_density) * 4) / 4) if ground_density else None
        if not crs:
            report['notes'].append('CRS ausente: no procesar hasta documentarlo.')
    if checksum:
        digest = hashlib.sha256()
        with path.open('rb') as source:
            for chunk in iter(lambda: source.read(8 * 1024 * 1024), b''):
                digest.update(chunk)
        report['sha256'] = digest.hexdigest()
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file')
    parser.add_argument('--header-only', action='store_true')
    parser.add_argument('--sha256', action='store_true')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        report = inspect(args.file, args.header_only, args.sha256)
        text = json.dumps(report, indent=2, ensure_ascii=False)
        if args.output:
            if args.output.exists():
                raise ValueError('El informe ya existe; elige otra ruta para conservarlo.')
            args.output.write_text(text + '\n')
        print(text)
    except Exception as error:
        parser.exit(1, f'Inspección fallida: {error}\n')


if __name__ == '__main__':
    main()
