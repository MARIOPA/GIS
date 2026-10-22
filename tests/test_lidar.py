"""Synthetic fixtures test the tools, not the user's PNOA tile or PNOA compliance."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
import laspy
import numpy as np
import rasterio
from pyproj import CRS, Transformer
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from inspect_laz import inspect
from build_terrain import build


class LidarToolsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        h = laspy.LasHeader(point_format=6, version='1.4')
        h.add_crs(CRS.from_epsg(25831))
        h.scales = [0.001, 0.001, 0.001]
        h.offsets = [462000, 4382000, 0]
        self.las = laspy.LasData(h)
        xx, yy = np.meshgrid(np.arange(5) + 0.5, np.arange(5) + 0.5)
        self.las.x = 462000 + xx.ravel()
        self.las.y = 4382000 + yy.ravel()
        self.las.z = 20 + np.arange(25) * 0.1
        self.las.classification = np.full(25, 2, dtype=np.uint8)
        self.las.classification[0] = 5  # Vegetation must never become a building obstacle.
        self.las.withheld[1] = 1
        self.las.overlap[2] = 1
        self.las.synthetic[3] = 1
        self.path = self.root / 'synthetic.laz'
        self.las.write(self.path)

    def tearDown(self):
        self.temp.cleanup()

    def test_streamed_metadata_and_flags(self):
        p = inspect(self.path, checksum=True)
        self.assertEqual(p['scanned_points'], 25)
        self.assertEqual(p['valid_ground_points'], 21)
        self.assertEqual(p['classifications'][5], 1)
        self.assertEqual(p['flags']['withheld'], 1)
        self.assertEqual(p['crs_authority'], ['EPSG', '25831'])
        self.assertEqual(len(p['sha256']), 64)
        self.assertFalse(p['vertical_reference_in_crs'])
        self.assertFalse(inspect(self.path, header_only=True)['complete_scan'])

    def test_candidate_cog_and_constant_building_obstacle(self):
        transform = Transformer.from_crs(25831, 4326, always_xy=True)
        ring = [transform.transform(x, y) for x, y in [(462001, 4382001), (462004, 4382001), (462004, 4382004), (462001, 4382004), (462001, 4382001)]]
        footprint = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'id': 'b1', 'geometry': {'type': 'Polygon', 'coordinates': [ring]}, 'properties': {'verified': True}}]}
        buildings = self.root / 'buildings.geojson'
        buildings.write_text(json.dumps(footprint))
        output = self.root / 'products'
        result = build(self.path, output, 1.0, 'SYNTHETIC TEST ONLY', 'SYNTHETIC TEST ONLY', buildings)
        self.assertFalse(result['hydrology_ready'])
        self.assertEqual(result['status'], 'candidate_not_validated')
        with rasterio.open(output / 'dtm.tif') as dtm, rasterio.open(output / 'terrain-buildings.tif') as obstacles:
            ground = dtm.read(1)
            surface = obstacles.read(1)
            changed = surface != ground
            self.assertEqual(dtm.tags(ns='IMAGE_STRUCTURE')['LAYOUT'], 'COG')
            self.assertGreater(int(changed.sum()), 0)
            self.assertTrue(np.all(surface[changed] == result['buildings'][0]['constant_elevation_m']))
            self.assertAlmostEqual(float(ground[changed].max()) + 10, float(surface[changed].max()), places=5)
            self.assertEqual(dtm.crs.to_epsg(), 25831)
        with self.assertRaises(ValueError):
            build(self.path, output, 1.0, 'test', 'test', buildings)
        footprint['features'][0]['properties']['verified'] = False
        buildings.write_text(json.dumps(footprint))
        with self.assertRaises(ValueError):
            build(self.path, self.root / 'bad', 1.0, 'test', 'test', buildings)

    def test_missing_ground_is_rejected(self):
        self.las.classification = np.full(25, 5, dtype=np.uint8)
        self.las.write(self.path)
        with self.assertRaises(ValueError):
            build(self.path, self.root / 'no-ground', 1.0, 'test', 'test')


if __name__ == '__main__':
    unittest.main()
