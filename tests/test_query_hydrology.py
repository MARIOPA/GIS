import sys
from pathlib import Path
import unittest

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from query_hydrology import downstream_cells, stationary_flood, watershed_mask


class QueryHydrologyTest(unittest.TestCase):
    def setUp(self):
        self.valid = np.ones((3, 3), dtype=bool)
        self.direction = np.array([
            [4, 5, 6],
            [3, 3, 0],
            [2, 1, 8],
        ], dtype='uint8')

    def test_watershed_and_downstream_endpoint_follow_d8(self):
        basin = watershed_mask(self.direction, self.valid, 1, 1)
        self.assertEqual(int(basin.sum()), 8)
        self.assertEqual(downstream_cells(self.direction, self.valid, 1, 1), [(1, 1), (1, 2)])

    def test_stationary_event_stores_water_in_depression_and_spills_excess(self):
        elevation = np.full((3, 3), 2.0)
        elevation[1, 1] = 1.0
        conditioned = elevation.copy()
        conditioned[1, 1] = 2.0
        depth, stats = stationary_flood(
            elevation, conditioned, self.direction, self.valid, rainfall_mm=100, cell_area=1
        )
        self.assertAlmostEqual(float(depth[1, 1]), 0.8, places=5)
        self.assertAlmostEqual(stats['stored_volume_m3'], 0.8, places=5)
        depth, stats = stationary_flood(
            elevation, conditioned, self.direction, self.valid, rainfall_mm=200, cell_area=1
        )
        self.assertAlmostEqual(float(depth[1, 1]), 1.0, places=5)
        self.assertGreater(stats['boundary_outflow_m3'], 0)


if __name__ == '__main__':
    unittest.main()
