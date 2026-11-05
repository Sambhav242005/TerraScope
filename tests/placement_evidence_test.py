"""Independent pixel/registration check; this does not validate flood detection."""
import importlib.util
import json
import math
import unittest
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('builder',ROOT/'scripts/build-placement-evidence.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
class PixelEvidenceTests(unittest.TestCase):
    def test_unknown_background_watermark_and_transparency_do_not_become_evidence(self):
        for rgba in [(255,255,255,255),(0,0,0,255),(0,255,255,0),(0,255,255,128),(80,255,255,255),(255,255,255,0)]:
            self.assertFalse(builder.cyan(rgba))
        self.assertTrue(builder.cyan((0,255,255,255)))
    def test_all_exported_cells_match_raw_display_colors_and_mercator_registration(self):
        bundle=json.loads((ROOT/'public/data/placement-evidence.json').read_text(encoding='utf-8'))
        manifest=json.loads((ROOT/'public/data/nrsc/manifest.json').read_text())
        west,south,east,north=manifest['bbox']
        my=lambda lat:math.log(math.tan(math.pi/4+math.radians(lat)/2))
        for record in manifest['snapshots']:
            rgba=Image.open(ROOT/('public'+record['image'])).convert('RGBA')
            pixels=set()
            for f in bundle['features']:
                if f['sourceId']!='nrsc-'+record['id']:continue
                _,row,span=f['id'].rsplit('/',2);y=int(row[3:]);start,end=map(int,span.split('-'))
                for x in range(start,end):pixels.add((x,y))
                corner=f['geometry']['coordinates'][0][0]
                self.assertAlmostEqual((corner[0]-west)/(east-west)*512,start,places=7)
                self.assertAlmostEqual((my(north)-my(corner[1]))/(my(north)-my(south))*512,y,places=7)
            oracle={(x,y) for y in range(512) for x in range(512) if rgba.getpixel((x,y))[0]<80 and min(rgba.getpixel((x,y))[1:3])>180 and rgba.getpixel((x,y))[3]>128}
            self.assertEqual(pixels,oracle)
if __name__=='__main__':unittest.main()
