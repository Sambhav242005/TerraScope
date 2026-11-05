"""Derive bounded display-evidence geometry; not a suitability or hazard model.

Uses archived OSM XML and pinned NRSC PNGs. No network requests. Requires Pillow.
Watermark/background pixels never become flood geometry. Missing pixels are unknown.
"""
import hashlib
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def cyan(pixel):
    r, g, b, a = pixel
    return r < 80 and g > 180 and b > 180 and a > 128


def build():
    raw = ROOT / 'artifacts/osm-source.xml'
    root = ET.parse(raw).getroot()
    nodes = {n.attrib['id']: [float(n.attrib['lon']), float(n.attrib['lat'])]
             for n in root.findall('node')}
    sources = [dict(id='osm-context-20261104', label='OSM mapped channels, water, roads and buildings',
                    url='https://api.openstreetmap.org/api/0.6/map?bbox=85.14,25.68,85.19,25.73',
                    retrievedAt='2026-11-04', sha256=digest(raw), coverage=[85.14,25.68,85.19,25.73],
                    limitations=['Incomplete mapping; relations and incomplete ways omitted. No-hit is not clearance.',
                                 'Roads are centerlines, with unknown width; no regulatory setbacks inferred.',
                                 'Coordinates: geographic WGS84 longitude/latitude. No vertical datum is used for these intersections.',
                                 'Mapped water and current OSM features are not event depths, surveys or title records.'])]
    features = []
    skipped = 0
    for way in root.findall('way'):
        tags = {t.attrib['k']: t.attrib['v'] for t in way.findall('tag')}
        refs = [n.attrib['ref'] for n in way.findall('nd')]
        if not refs or any(ref not in nodes for ref in refs):
            skipped += 1
            continue
        points = [nodes[r] for r in refs]
        closed = len(points) >= 4 and points[0] == points[-1]
        if tags.get('natural') == 'water' or tags.get('waterway') == 'riverbank':
            kind = 'river' if tags.get('water') == 'river' or tags.get('waterway') == 'riverbank' else 'water'
            if not closed:
                skipped += 1
                continue
        elif 'highway' in tags:
            kind = 'road'
        elif tags.get('waterway') == 'river':
            kind = 'river'
        elif 'building' in tags and closed:
            kind = 'building'
        else:
            continue
        polygon = closed and kind in ('water', 'building', 'river') and tags.get('waterway') != 'river'
        features.append(dict(id='way/' + way.attrib['id'], kind=kind,
                             label=kind if kind == 'building' else tags.get('name:en', tags.get('name', kind)), sourceId=sources[0]['id'],
                             geometry=dict(type='Polygon' if polygon else 'LineString',
                                           coordinates=[points] if polygon else points)))

    manifest = json.loads((ROOT / 'public/data/nrsc/manifest.json').read_text(encoding='utf-8'))
    west,south,east,north = manifest['bbox']
    merc_y = lambda lat: math.log(math.tan(math.pi/4 + math.radians(lat)/2))
    for snap in manifest['snapshots']:
        path = ROOT / ('public' + snap['image'])
        if digest(path) != snap['sha256']:
            raise ValueError('NRSC input differs from its pinned manifest')
        source_id = 'nrsc-' + snap['id']
        sources.append(dict(id=source_id, label='NRSC provider-map-color screening ' + snap['date'],
                            url=manifest['sourcePage'], retrievedAt=snap['retrievedAt'], date=snap['providerTimeLabel'],
                            sha256=snap['sha256'], coverage=manifest['bbox'], limitations=manifest['limitations'] + [
                                'Display-color heuristic: R<80, G>180, B>180, alpha>128. Not a validated flood mask.',
                                'Positive overlap is a map-evidence warning only. Transparent, watermark and unmarked pixels are unknown.']))
        with Image.open(path) as image:
            rgba = image.convert('RGBA')
            w,h = rgba.size
            if (w,h) != (512,512):
                raise ValueError('Unexpected snapshot size')
            def corner(x,y):
                my = merc_y(north) + y/h * (merc_y(south)-merc_y(north))
                return [west + x/w*(east-west), math.degrees(2*math.atan(math.exp(my))-math.pi/2)]
            # Encode exact selected display cells as horizontal row-run rectangles.
            # Do not estimate inundated area or infer safety from other cells.
            for y in range(h):
                x = 0
                while x < w:
                    if not cyan(rgba.getpixel((x,y))):
                        x += 1
                        continue
                    start = x
                    while x < w and cyan(rgba.getpixel((x,y))):
                        x += 1
                    ring = [corner(start,y),corner(x,y),corner(x,y+1),corner(start,y+1),corner(start,y)]
                    features.append(dict(id=f'{source_id}/row{y}/{start}-{x}', kind='historical-flood',
                                         sourceId=source_id, label=snap['providerTimeLabel'],
                                         geometry=dict(type='Polygon',coordinates=[ring])))
    evidence = dict(method='archived-map-evidence-v1', sources=sources, features=features,
                    omittedOsmRelations=len(root.findall('relation')), skippedWays=skipped)
    path = ROOT / 'public/data/placement-evidence.json'
    path.write_text(json.dumps(evidence, separators=(',',':'), ensure_ascii=False), encoding='utf-8')
    print(f'{len(features)} evidence features; {path.stat().st_size} bytes')


if __name__ == '__main__':
    build()
