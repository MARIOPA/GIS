"""Check true raster preservation, zoom content, safe import and corrupt-package refusal."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

import numpy as np
import rasterio
from rasterio.transform import from_origin

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from optimize_surface import optimize
from import_surface import import_surface


class SurfaceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.original = self.root / 'original'
        self.original.mkdir()
        self.values = (np.arange(96 * 100).reshape(96, 100) * 0.01 + 150).astype('float32')
        self.values[:2, :2] = -9999
        with rasterio.open(self.original / 'dtm.tif', 'w', driver='GTiff', width=100, height=96,
                           count=1, dtype='float32', crs='EPSG:25831',
                           transform=from_origin(462000, 4382000, 1.5, 1.5), nodata=-9999) as dst:
            dst.write(self.values, 1)
        (self.original / 'manifest.json').write_text(json.dumps({
            'status': 'candidate_not_validated', 'hydrology_ready': False,
            'resolution_m': 1.5, 'source_inspection': {'sha256': '0' * 64},
            'vertical_reference': 'SYNTHETIC TEST ONLY'}))
        (self.original / 'preview.json').write_text(json.dumps({'status': 'candidate_not_validated'}))
        with rasterio.open(self.original / 'preview.png', 'w', driver='PNG', count=4,
                           width=1, height=1, dtype='uint8') as dst:
            dst.write(np.full((4, 1, 1), 255, dtype='uint8'))
        self.output = self.root / 'optimized'
        self.info = optimize(self.original, self.output, 14, 17)

    def tearDown(self):
        self.temp.cleanup()

    def package(self, filename='surface.zip'):
        path = self.root / filename
        with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as archive:
            for item in self.output.rglob('*'):
                if item.is_file():
                    archive.write(item, item.relative_to(self.output))
        return path

    def test_native_cells_preserved_and_each_zoom_has_real_pixels(self):
        with rasterio.open(self.output / 'dtm.tif') as src:
            np.testing.assert_array_equal(src.read(1), self.values)
            self.assertEqual(src.tags(ns='IMAGE_STRUCTURE')['LAYOUT'], 'COG')
            self.assertEqual(src.nodata, -9999)
            self.assertEqual(len(src.overviews(1)), 6)
        counts = []
        for zoom in range(14, 18):
            pixels = 0
            for path in (self.output / 'tiles' / str(zoom)).rglob('*.png'):
                with rasterio.open(path) as tile:
                    self.assertEqual(tile.shape, (256, 256))
                    pixels += np.count_nonzero(tile.read(4))
            self.assertGreater(pixels, 0)
            counts.append(pixels)
        self.assertGreater(counts[-1], counts[0])
        self.assertFalse(self.info['hydrology_ready'])

    def test_zip_import_is_repeatable_and_refuses_overwrite(self):
        archive = self.package()
        data = self.root / 'data'
        result = import_surface(archive, data)
        self.assertEqual(result['id'], 'pnoa-bal-462-4382-v1')
        self.assertFalse(result['hydrology_ready'])
        self.assertEqual(import_surface(archive, data)['id'], result['id'])
        installed = Path(result['directory'])
        (installed / 'surface.json').write_text('{}')
        with self.assertRaisesRegex(ValueError, 'dañada'):
            import_surface(archive, data)

    def test_corrupt_zip_and_traversal_leave_selection_unchanged(self):
        data = self.root / 'data'
        import_surface(self.output, data)
        pointer = (data / 'surface-selection.json').read_bytes()
        (self.output / 'preview.json').write_text('corrupted')
        with self.assertRaisesRegex(ValueError, 'dañado'):
            import_surface(self.package('corrupt.zip'), data)
        self.assertEqual((data / 'surface-selection.json').read_bytes(), pointer)
        malicious = self.root / 'bad.zip'
        with zipfile.ZipFile(malicious, 'w') as archive:
            archive.writestr('../escape.json', '{}')
        with self.assertRaisesRegex(ValueError, 'Ruta'):
            import_surface(malicious, data)
        self.assertFalse((data / 'escape.json').exists())
        self.assertEqual((data / 'surface-selection.json').read_bytes(), pointer)


if __name__ == '__main__':
    unittest.main()
