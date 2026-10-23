import sys
from pathlib import Path
import unittest

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_hydrology import accumulation, d8_routes, priority_flood


class HydrologyTest(unittest.TestCase):
    def test_priority_flood_fills_pit_and_d8_routes_every_cell_to_edge(self):
        elevation = np.array([
            [9, 8, 7, 6, 5],
            [9, 7, 6, 5, 4],
            [9, 7, 0, 5, 3],
            [9, 7, 6, 5, 2],
            [9, 8, 7, 6, 1],
        ], dtype='float64')
        valid = np.ones(elevation.shape, dtype=bool)
        filled, parent = priority_flood(elevation, valid)
        self.assertEqual(filled[2, 2], 5)
        downstream, direction = d8_routes(filled, valid, parent, 1, 1)
        result = accumulation(downstream, valid)
        self.assertTrue(np.all(direction != 255))
        self.assertEqual(result.max(), elevation.size)
        self.assertEqual(direction[4, 4], 0)

    def test_nodata_hole_is_an_open_drainage_boundary(self):
        elevation = np.full((5, 5), 10.0)
        elevation[2, 2] = np.nan
        elevation[2, 1] = 5
        valid = np.isfinite(elevation)
        filled, parent = priority_flood(elevation, valid)
        self.assertEqual(filled[2, 1], 5)
        downstream, _ = d8_routes(filled, valid, parent, 1, 1)
        accumulation(downstream, valid)


if __name__ == '__main__':
    unittest.main()
