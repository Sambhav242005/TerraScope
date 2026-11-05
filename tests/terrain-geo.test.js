import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TILE_SIZE_PX,
  metersPerDegreeLat,
  metersPerDegreeLon,
  kmToDegreesLat,
  kmToDegreesLon,
  analysisBoxDeg,
  globalPixelX,
  lonAtGlobalPixelX,
  globalPixelYFromLat,
  latAtGlobalPixelY,
  metersPerPixelAt,
  tilesCoveringBox,
  chooseZoomForBox,
  planGridForBox,
} from '../src/flood/storage/geo.ts';

const BIHAR = { lat: 25.71, lon: 85.16 };
const DEG = Math.PI / 180;

test('metric degree polynomials are plausible and internally consistent near Bihar', () => {
  const latM = metersPerDegreeLat(BIHAR.lat);
  const lonM = metersPerDegreeLon(BIHAR.lat);
  // Absolute sanity: roughly 110.8 km/deg north-south and 100.4 km/deg east-west.
  assert.ok(latM > 110_500 && latM < 111_000, `latM=${latM}`);
  assert.ok(lonM > 99_800 && lonM < 100_800, `lonM=${lonM}`);
  // Independent cross-check of the two polynomials: their ratio should be
  // close to cos(lat) (WGS84 ellipsoid adds a small correction).
  const cosRatio = lonM / latM;
  assert.ok(Math.abs(cosRatio - Math.cos(BIHAR.lat * DEG)) < 0.007);
  // And the absolute shortfall from a spherical approximation stays sub-km.
  assert.ok(Math.abs(lonM - latM * Math.cos(BIHAR.lat * DEG)) < 600);
  // Latitude scale increases towards the poles, longitude scale shrinks.
  assert.ok(metersPerDegreeLat(60) > metersPerDegreeLat(0));
  assert.ok(metersPerDegreeLon(60) < metersPerDegreeLon(0));
});

test('kmToDegreesLat/Lon invert metersPerDegree within floating tolerance', () => {
  for (const lat of [0, 25.7, 45, 60, -33]) {
    for (const km of [0.03, 1, 3.6, 20]) {
      const dLat = kmToDegreesLat(km, lat);
      const dLon = kmToDegreesLon(km, lat);
      assert.ok(Math.abs(dLat * metersPerDegreeLat(lat) - km * 1000) < 1e-6);
      assert.ok(Math.abs(dLon * metersPerDegreeLon(lat) - km * 1000) < 1e-6);
      assert.ok(dLat > 0 && dLon > 0);
    }
  }
  assert.throws(() => kmToDegreesLat(0, 25.7));
  assert.throws(() => kmToDegreesLon(-1, 25.7));
  assert.throws(() => kmToDegreesLat(NaN, 25.7));
});

test('analysisBoxDeg is symmetric and the context ring only grows the box', () => {
  const half = 3.6;
  const plain = analysisBoxDeg(BIHAR, half, 0);
  const ring = analysisBoxDeg(BIHAR, half, 0.35);
  assert.ok(Math.abs((plain.north + plain.south) / 2 - BIHAR.lat) < 1e-12);
  assert.ok(Math.abs((plain.east + plain.west) / 2 - BIHAR.lon) < 1e-12);
  const expectedLat = kmToDegreesLat(half, BIHAR.lat);
  const expectedLon = kmToDegreesLon(half, BIHAR.lat);
  assert.ok(Math.abs(plain.north - BIHAR.lat - expectedLat) < 1e-12);
  assert.ok(Math.abs(BIHAR.lat - plain.south - expectedLat) < 1e-12);
  assert.ok(Math.abs(plain.east - BIHAR.lon - expectedLon) < 1e-12);
  assert.ok(Math.abs(BIHAR.lon - plain.west - expectedLon) < 1e-12);
  // grew by exactly 1 + contextRingRatio on every side
  assert.ok(Math.abs(ring.north - BIHAR.lat - expectedLat * 1.35) < 1e-12);
  assert.ok(Math.abs(BIHAR.lat - ring.south - expectedLat * 1.35) < 1e-12);
  assert.ok(Math.abs(ring.east - BIHAR.lon - expectedLon * 1.35) < 1e-12);
  assert.ok(Math.abs(BIHAR.lon - ring.west - expectedLon * 1.35) < 1e-12);
  assert.ok(ring.north > plain.north && ring.south < plain.south);
  assert.ok(ring.east > plain.east && ring.west < plain.west);
  assert.throws(() => analysisBoxDeg(BIHAR, 0, 0.35));
  assert.throws(() => analysisBoxDeg(BIHAR, 3.6, -0.1));
});

test('global pixel x/y round-trip across zooms and latitudes', () => {
  const lats = [0, 25.7, 45, -33, 60];
  const lons = [0, 85.16, -120, 179];
  for (const zoom of [0, 6, 10, 13, 16, 20]) {
    for (const lon of lons) {
      const back = lonAtGlobalPixelX(zoom, globalPixelX(zoom, lon));
      assert.ok(Math.abs(back - lon) < 1e-8, `lon ${lon} z${zoom} -> ${back}`);
    }
    for (const lat of lats) {
      const gy = globalPixelYFromLat(zoom, lat);
      const back = latAtGlobalPixelY(zoom, gy);
      assert.ok(Math.abs(back - lat) < 1e-8, `lat ${lat} z${zoom} -> ${back}`);
    }
    // north-up pixel y decreases as latitude increases
    assert.ok(globalPixelYFromLat(zoom, 25.7) < globalPixelYFromLat(zoom, 25.6));
  }
  assert.ok(globalPixelX(13, 85.16) > 0);
  assert.ok(TILE_SIZE_PX === 256);
});

test('metersPerPixelAt matches the Web-Mercator ground resolution at zoom 13', () => {
  const mpp = metersPerPixelAt(25.7, 13);
  assert.ok(Math.abs(mpp / 17.2 - 1) < 0.01, `mpp=${mpp}`);
  // Higher zoom is finer; higher latitude is coarser.
  assert.ok(metersPerPixelAt(25.7, 14) < mpp);
  assert.ok(metersPerPixelAt(60, 13) < mpp);
  assert.throws(() => metersPerPixelAt(25.7, 23));
  assert.throws(() => metersPerPixelAt(25.7, 1.5));
});

test('tilesCoveringBox treats exact tile boundaries as exclusive at the far edge', () => {
  // Away from the Mercator pole limit, on exact z13 tile boundaries.
  const y0 = 1_000_192; // 3907 * 256
  const one = {
    west: lonAtGlobalPixelX(13, 256),
    east: lonAtGlobalPixelX(13, 512),
    north: latAtGlobalPixelY(13, y0),
    south: latAtGlobalPixelY(13, y0 + 256),
  };
  assert.deepEqual(tilesCoveringBox(one, 13), [{ x: 1, y: 3907 }]);

  // Exactly two tiles by two tiles.
  const four = {
    west: lonAtGlobalPixelX(13, 256),
    east: lonAtGlobalPixelX(13, 768),
    north: latAtGlobalPixelY(13, y0),
    south: latAtGlobalPixelY(13, y0 + 512),
  };
  const fourTiles = tilesCoveringBox(four, 13);
  assert.equal(fourTiles.length, 4);
  assert.deepEqual(new Set(fourTiles.map((t) => `${t.x}/${t.y}`)), new Set([
    '1/3907', '2/3907', '1/3908', '2/3908',
  ]));

  // A 257px-wide odd span crosses a tile seam and needs two columns.
  const odd = {
    west: lonAtGlobalPixelX(13, 300),
    east: lonAtGlobalPixelX(13, 557),
    north: latAtGlobalPixelY(13, y0 + 300),
    south: latAtGlobalPixelY(13, y0 + 301),
  };
  const oddTiles = tilesCoveringBox(odd, 13);
  assert.equal(oddTiles.length, 2);
  assert.deepEqual(oddTiles.map((t) => t.x), [1, 2]);
  assert.deepEqual(oddTiles.map((t) => t.y), [3908, 3908]);
});

test('chooseZoomForBox picks the highest zoom that fits the tile budget', () => {
  // 700px-wide box at z15, comfortably away from the pole.
  const box = {
    west: lonAtGlobalPixelX(15, 4_000_000),
    east: lonAtGlobalPixelX(15, 4_000_700),
    north: latAtGlobalPixelY(15, 4_000_000),
    south: latAtGlobalPixelY(15, 4_000_700),
  };
  assert.equal(tilesCoveringBox(box, 15).length, 9);
  assert.equal(tilesCoveringBox(box, 14).length, 4);
  assert.equal(chooseZoomForBox(box, 16), 15);
  assert.equal(chooseZoomForBox(box, 8), 14);
  assert.ok(tilesCoveringBox(box, chooseZoomForBox(box, 8)).length <= 8);

  // Gigantic boxes or impossible budgets are refused, not silently clipped.
  assert.throws(() => chooseZoomForBox({ south: -80, west: -179, north: 80, east: 179 }, 256));
  assert.throws(() => chooseZoomForBox(box, 0));
  assert.throws(() => chooseZoomForBox(box, 257));
});

test('planGridForBox snaps to the global pixel lattice and honors the tile budget', () => {
  const box = analysisBoxDeg(BIHAR, 3.6, 0.35);
  const plan = planGridForBox(box, 16);
  assert.ok(plan.tiles.length <= 16);
  assert.ok(plan.width * plan.height <= 1_000_000);
  assert.equal(plan.gx0, Math.floor(globalPixelX(plan.zoom, box.west)));
  assert.equal(plan.width, Math.ceil(globalPixelX(plan.zoom, box.east)) - plan.gx0);
  assert.equal(plan.gy0, Math.floor(globalPixelYFromLat(plan.zoom, box.north)));
  assert.equal(plan.height, Math.ceil(globalPixelYFromLat(plan.zoom, box.south)) - plan.gy0);
  // The snapped grid encloses the requested inner box.
  assert.ok(plan.gridBox.west <= box.west);
  assert.ok(plan.gridBox.east >= box.east);
  assert.ok(plan.gridBox.north >= box.north);
  assert.ok(plan.gridBox.south <= box.south);
  assert.equal(plan.meanLat, (box.north + box.south) / 2);
  assert.ok(Math.abs(plan.meterPerPxLat - metersPerPixelAt(plan.meanLat, plan.zoom)) < 1e-9);
  assert.ok(Math.abs(plan.meterPerPxLon - metersPerPixelAt(plan.meanLat, plan.zoom)) < 1e-9);
  assert.ok(plan.width >= 3 && plan.height >= 3);
});

test('planGridForBox steps zoom down until the cell cap is met, and throws when impossible', () => {
  // 120km-wide analysis box: zoom must fall well below 15 to stay under 1M cells.
  const huge = analysisBoxDeg(BIHAR, 20, 2);
  const plan = planGridForBox(huge, 64);
  assert.ok(plan.zoom < 15, `zoom=${plan.zoom}`);
  assert.ok(plan.width * plan.height <= 1_000_000);
  assert.ok(plan.tiles.length <= 64);
  assert.ok(plan.width >= 3 && plan.height >= 3);

  const tinyCap = planGridForBox(huge, 64, 20_000);
  assert.ok(tinyCap.width * tinyCap.height <= 20_000);
  assert.ok(tinyCap.tiles.length <= 64);

  // A one-cell cap cannot be satisfied at any supported zoom.
  assert.throws(() => planGridForBox(huge, 64, 1), /cell cap|collapses/i);
});
