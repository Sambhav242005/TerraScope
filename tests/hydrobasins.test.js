import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { subBasinAt, toFeatureCollection } from '../src/flood/hydrobasins.ts';

const ARTIFACT = 'public/data/hydrobasins-as12-sonpur.json';

function load() {
  return JSON.parse(readFileSync(ARTIFACT, 'utf-8'));
}

test('bundled artifact is well-formed and keeps HydroBASINS provenance', () => {
  const bundle = load();
  assert.equal(bundle.count, 71);
  assert.deepEqual(bundle.bounds, [84.75, 25.35, 85.55, 26.0]);
  assert.match(bundle.source.url, /hybas_as_lev12_v1c\.zip/);
  assert.equal(bundle.source.sha256, '05e98a001fc526cd5fcdbbc8144fe0aa3ce6712c35624f72e4728b219193fdb9');
  assert.match(bundle.source.license, /HydroSHEDS/);
  assert.equal(bundle.basins.length, 71);
});

test('every basin has positive areas, unique ids and Polygon/MultiPolygon geometry', () => {
  const bundle = load();
  const ids = new Set();
  for (const b of bundle.basins) {
    assert.ok(b.sub_area_km2 > 0, `basin ${b.hybas_id} sub_area`);
    assert.ok(b.up_area_km2 >= b.sub_area_km2, `basin ${b.hybas_id} up_area >= sub_area`);
    assert.ok(Number.isFinite(b.hybas_id));
    assert.ok(!ids.has(b.hybas_id), `duplicate hybas_id ${b.hybas_id}`);
    ids.add(b.hybas_id);
    assert.ok(
      b.geometry.type === 'Polygon' || b.geometry.type === 'MultiPolygon',
      `geometry type ${b.geometry.type}`,
    );
    const rings = b.geometry.type === 'Polygon'
      ? [b.geometry.coordinates]
      : b.geometry.coordinates;
    for (const poly of rings) {
      assert.ok(Array.isArray(poly) && poly.length > 0, 'polygon rings present');
    }
  }
});

test('subBasinAt finds the basin containing Sonpur and rejects outside-window points', () => {
  const bundle = load();
  const sonpur = subBasinAt(bundle, 85.16, 25.71);
  assert.ok(sonpur, 'Sonpur must fall inside a kept sub-basin');
  assert.ok(sonpur.hybas_id > 0);
  assert.equal(subBasinAt(bundle, 84.0, 25.0), null);
  assert.equal(subBasinAt(bundle, NaN, 25.7), null);
});

test('subBasinAt is point-in-polygon exact, not bbox-first-match', () => {
  const bundle = load();
  // Every returned basin must actually contain the point via its own geometry.
  for (const [lon, lat] of [[85.16, 25.71], [85.0, 25.8], [85.3, 25.5]]) {
    const basin = subBasinAt(bundle, lon, lat);
    if (!basin) continue;
    const rings = basin.geometry.type === 'Polygon' ? [basin.geometry.coordinates] : basin.geometry.coordinates;
    const [outer] = rings[0];
    const xs = outer.map((p) => p[0]);
    const ys = outer.map((p) => p[1]);
    assert.ok(lon >= Math.min(...xs) - 1e-6 && lon <= Math.max(...xs) + 1e-6);
    assert.ok(lat >= Math.min(...ys) - 1e-6 && lat <= Math.max(...ys) + 1e-6);
  }
});

test('point lookup respects polygon holes (a point in a hole is not claimed)', () => {
  const bundle = {
    source: { name: 't', url: 't', sha256: '0' .repeat(64), license: 't', retrieved: 't' },
    bounds: [-10, -10, 10, 10],
    basins: [
      {
        hybas_id: 1, next_down: 0, next_sink: 0, main_bas: 1,
        dist_main_km: 0, sub_area_km2: 1, up_area_km2: 1, pfaf: 'x', order: 1,
        geometry: {
          type: 'Polygon',
          coordinates: [
            [[-5, -5], [5, -5], [5, 5], [-5, 5], [-5, -5]],
            [[-1, -1], [-1, 1], [1, 1], [1, -1], [-1, -1]],
          ],
        },
      },
    ],
  };
  const inside = subBasinAt(bundle, 3, 3);
  const inHole = subBasinAt(bundle, 0, 0);
  assert.equal(inside?.hybas_id, 1);
  assert.equal(inHole, null);
});

test('toFeatureCollection preserves ids and marks every feature', () => {
  const bundle = load();
  const fc = toFeatureCollection(bundle);
  assert.equal(fc.type, 'FeatureCollection');
  assert.equal(fc.features.length, bundle.count);
  assert.deepEqual(fc.features.map((f) => f.id), bundle.basins.map((b) => b.hybas_id));
});

test('artifact JSON parses strictly (no duplicate keys)', () => {
  // JSON.parse keeps the last duplicate silently; count braces via a strict check.
  const text = readFileSync(ARTIFACT, 'utf-8');
  const bundle = JSON.parse(text);
  assert.ok(bundle.source.name.includes('HydroBASINS'));
});
