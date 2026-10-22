#!/usr/bin/env python3
"""Create candidate bare-earth and simplified-building COGs, never certified hydrology."""
import argparse
import json
import math
from pathlib import Path
import laspy
import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.transform import from_origin
from rasterio.warp import transform_geom
from scipy.ndimage import distance_transform_edt
from inspect_laz import inspect

NODATA = -9999.0


def build(path, output, resolution, vertical_reference, source_spec, buildings=None):
    if resolution <= 0 or not math.isfinite(resolution):
        raise ValueError('Resolución inválida.')
    output = Path(output)
    if output.exists() and any(output.iterdir()):
        raise ValueError('La carpeta de salida debe estar vacía para conservar los productos anteriores.')
    report = inspect(path, checksum=True)
    with laspy.open(path) as reader:
        crs = reader.header.parse_crs()
        if not crs or not crs.is_projected or any(a.unit_name != 'metre' for a in crs.axis_info[:2]):
            raise ValueError('Se necesita un CRS proyectado en metros documentado en el LAS/LAZ.')
        if not report['valid_ground_points']:
            raise ValueError('No hay terreno de clase 2 utilizable. No se reclasifica vegetación automáticamente.')
        bounds = report['bounds']
        left = math.floor(bounds['min'][0] / resolution) * resolution
        top = math.ceil(bounds['max'][1] / resolution) * resolution
        width = max(1, math.ceil((bounds['max'][0] - left) / resolution))
        height = max(1, math.ceil((top - bounds['min'][1]) / resolution))
        if width * height > 20_000_000:
            raise ValueError('Más de 20 millones de celdas. Divide el área antes de procesar; no reduzcas la calidad sin evaluarla.')
        shape = (height, width)
        sums = np.zeros(shape, dtype='float64')
        counts = np.zeros(shape, dtype='uint32')
        dimensions = set(reader.header.point_format.dimension_names)
        used = 0
        for pts in reader.chunk_iterator(1_000_000):
            valid = np.asarray(pts.classification) == 2
            for flag in ('withheld', 'overlap', 'synthetic'):
                if flag in dimensions:
                    valid &= ~np.asarray(getattr(pts, flag), dtype=bool)
            xs, ys, zs = np.asarray(pts.x)[valid], np.asarray(pts.y)[valid], np.asarray(pts.z)[valid]
            rows = np.minimum(((top - ys) / resolution).astype(int), height - 1)
            cols = np.minimum(((xs - left) / resolution).astype(int), width - 1)
            np.add.at(sums, (rows, cols), zs)
            np.add.at(counts, (rows, cols), 1)
            used += len(zs)
        valid = counts > 0
        dtm = np.full(shape, NODATA, dtype='float32')
        dtm[valid] = (sums[valid] / counts[valid]).astype('float32')
        del sums
        # Fill at most one pixel from measured terrain. Larger gaps remain NoData.
        distance, nearest = distance_transform_edt(~valid, return_indices=True)
        interpolate = (~valid) & (distance <= 1.0)
        dtm[interpolate] = dtm[tuple(nearest[:, interpolate])]
        transform = from_origin(left, top, resolution, resolution)
        model = dtm.copy()
        building_report = []
        if buildings:
            collection = json.loads(Path(buildings).read_text())
            if collection.get('type') != 'FeatureCollection' or collection.get('crs'):
                raise ValueError('Huellas: usa FeatureCollection GeoJSON WGS84 sin campo crs.')
            for i, feature in enumerate(collection['features']):
                if feature.get('properties', {}).get('verified') is not True:
                    raise ValueError(f'Edificio {i}: falta properties.verified=true. Verifica las huellas primero.')
                geom = feature['geometry']
                if geom['type'] not in ('Polygon', 'MultiPolygon'):
                    raise ValueError('Las huellas deben ser polígonos.')
                projected = transform_geom('EPSG:4326', crs, geom)
                def positions(coordinates):
                    if isinstance(coordinates[0], (int, float)):
                        yield coordinates
                    else:
                        for c in coordinates:
                            yield from positions(c)
                for x, y, *_ in positions(projected['coordinates']):
                    if not (left <= x <= left + width * resolution and top - height * resolution <= y <= top):
                        raise ValueError(f'Edificio {i} cruza el borde del MDT. Amplía la cobertura antes de modelarlo.')
                mask = geometry_mask([projected], out_shape=shape, transform=transform, invert=True)
                if not mask.any():
                    raise ValueError(f'Edificio {i} menor que la malla. Revisa resolución o geometría.')
                if np.any(dtm[mask] == NODATA):
                    raise ValueError(f'Edificio {i} sobre terreno sin datos. No se inventan cotas.')
                elevation = float(dtm[mask].max()) + 10.0
                model[mask] = elevation
                building_report.append({'id': feature.get('id', i), 'constant_elevation_m': elevation, 'cells': int(mask.sum())})
        output.mkdir(parents=True, exist_ok=True)
        profile = dict(driver='COG', height=height, width=width, count=1, dtype='float32', crs=crs,
                       transform=transform, nodata=NODATA, compress='DEFLATE', blocksize=512, overview_resampling='average')
        products = {'dtm.tif': dtm}
        if buildings:
            products['terrain-buildings.tif'] = model
        for name, data in products.items():
            with rasterio.open(output / name, 'w', **profile) as dst:
                dst.write(data, 1)
                dst.update_tags(vertical_reference=vertical_reference, source_spec=source_spec,
                                validation='candidate_not_validated', method='ground_class_2_cell_mean_nearest_gap_1px')
        manifest = {
            'status': 'candidate_not_validated', 'hydrology_ready': False,
            'source_inspection': report, 'source_spec': source_spec,
            'vertical_reference': vertical_reference, 'resolution_m': resolution,
            'width': width, 'height': height, 'used_ground_points': used,
            'measured_cells': int(valid.sum()), 'interpolated_cells': int(interpolate.sum()),
            'nodata_cells': int((dtm == NODATA).sum()),
            'ground_method': 'Mean of class-2 points per cell; excludes withheld, overlap and synthetic. Nearest neighbour for gaps <=1 cell only.',
            'buildings_method': 'Verified footprints: maximum DTM elevation under footprint + 10 m. Constant per building. Not real building height or a DSM.',
            'buildings': building_report, 'products': list(products),
            'limitations': ['Requires independent PNOA specification and vertical-reference verification.',
                           'Requires control points, residual/error analysis and seam validation.',
                           'No hydrological conditioning, culvert corrections or complete catchment boundaries inferred.',
                           'Neighbouring tiles may be required; tile edges are not catchment limits.']
        }
        (output / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
        return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--resolution', type=float, required=True)
    parser.add_argument('--vertical-reference', required=True)
    parser.add_argument('--source-spec', required=True)
    parser.add_argument('--buildings', type=Path)
    args = parser.parse_args()
    try:
        result = build(args.file, args.output, args.resolution, args.vertical_reference, args.source_spec, args.buildings)
        print(json.dumps({k: v for k, v in result.items() if k != 'source_inspection'}, indent=2, ensure_ascii=False))
    except Exception as error:
        parser.exit(1, f'Preparación fallida: {error}\n')


if __name__ == '__main__':
    main()
