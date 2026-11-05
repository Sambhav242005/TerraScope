import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runStorageScreening,
  configHash,
  SCREENING_METHOD,
} from '../src/flood/storage/storageSearch.ts';
import {
  analysisBoxDeg,
  planGridForBox,
  metersPerDegreeLat,
  metersPerDegreeLon,
  lonAtGlobalPixelX,
  latAtGlobalPixelY,
} from '../src/flood/storage/geo.ts';

const CENTER = { lat: 25.71, lon: 85.16 };
const BASE_ELEVATION_M = 100;
const BOWL_RADIUS_M = 250;
const BOWL_DEPTH_M = 12;

function config(overrides = {}) {
  return {
    center: { ...CENTER },
    halfSpanKm: 1.0,
    contextRingRatio: 0.35,
    maxTiles: 4,
    ...overrides,
  };
}

function bowlElevationM(lon, lat) {
  const dx = (lon - CENTER.lon) * metersPerDegreeLon(CENTER.lat);
  const dy = (lat - CENTER.lat) * metersPerDegreeLat(CENTER.lat);
  const t = (dx * dx + dy * dy) / (BOWL_RADIUS_M * BOWL_RADIUS_M);
  return BASE_ELEVATION_M - (t < 1 ? BOWL_DEPTH_M * (1 - t) : 0);
}

function writeElevation(rgba, offset, elevationM) {
  const n = elevationM + 32768;
  rgba[offset] = Math.floor(n / 256);
  rgba[offset + 1] = Math.floor(n % 256);
  rgba[offset + 2] = Math.floor((n - Math.floor(n)) * 256);
  rgba[offset + 3] = 255;
}

function parseTileUrl(url) {
  const m = url.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/);
  assert.ok(m, `unexpected tile URL ${url}`);
  return { z: Number(m[1]), x: Number(m[2]), y: Number(m[3]) };
}

function makeTile({ z, x, y }) {
  const rgba = new Uint8ClampedArray(256 * 256 * 4);
  const lons = Array.from({ length: 256 }, (_, px) => lonAtGlobalPixelX(z, x * 256 + px));
  const lats = Array.from({ length: 256 }, (_, py) => latAtGlobalPixelY(z, y * 256 + py));
  for (let py = 0; py < 256; py++) {
    for (let px = 0; px < 256; px++) {
      const value = bowlElevationM(lons[px], lats[py]);
      writeElevation(rgba, (py * 256 + px) * 4, value);
    }
  }
  return rgba;
}

function tileFetcher({ failAtCall = null } = {}) {
  const calls = [];
  const fetchTile = async (url) => {
    calls.push(url);
    if (failAtCall !== null && calls.length === failAtCall) throw new Error('synthetic tile 503');
    return makeTile(parseTileUrl(url));
  };
  return { calls, fetchTile };
}

function waterDocument(center = CENTER) {
  const dLat = 0.0025;
  const dLon = 0.0025;
  const nodes = [
    { type: 'node', id: 5, lat: center.lat + dLat, lon: center.lon - dLon },
    { type: 'node', id: 6, lat: center.lat + dLat, lon: center.lon + dLon },
    { type: 'node', id: 7, lat: center.lat - dLat, lon: center.lon + dLon },
    { type: 'node', id: 8, lat: center.lat - dLat, lon: center.lon - dLon },
    { type: 'node', id: 9, lat: center.lat + dLat, lon: center.lon - dLon },
  ];
  return {
    version: '0.6',
    elements: [
      {
        type: 'way',
        id: 1,
        nodes: [5, 6, 7, 8, 9],
        tags: { natural: 'water', name: 'Gadheri Talab' },
      },
      ...nodes,
    ],
  };
}

async function baselineRun(extra = {}) {
  const fetcher = tileFetcher();
  const run = await runStorageScreening(config(), {
    signal: new AbortController().signal,
    fetchTile: fetcher.fetchTile,
    fetchWaterJson: async () => waterDocument(),
    ...extra,
  });
  return { run, fetcher };
}

test('configHash is deterministic, stable under 1e-6 rounding and config-sensitive', () => {
  const a = config();
  assert.equal(configHash(a), configHash(config()));
  assert.equal(configHash(a), configHash(config({ center: { lat: CENTER.lat + 4e-7, lon: CENTER.lon - 4e-7 } })));
  assert.notEqual(configHash(a), configHash(config({ halfSpanKm: 1.001 })));
  assert.notEqual(configHash(a), configHash(config({ contextRingRatio: 0.36 })));
  assert.notEqual(configHash(a), configHash(config({ maxTiles: 5 })));
  assert.notEqual(configHash(a), configHash(config({ center: { lat: CENTER.lat + 1e-5, lon: CENTER.lon } })));
  assert.match(configHash(a), /^[0-9a-f]{8}$/);
});

test('screening succeeds on a synthetic bowl and reports truthful provenance and geometry', async () => {
  const { run } = await baselineRun();
  assert.equal(run.status, 'succeeded', run.error ?? '');
  assert.equal(run.provenance.method, SCREENING_METHOD);
  assert.equal(SCREENING_METHOD, 'priority-flood-d8-v1');
  assert.ok(run.provenance.tileMatrixZoom >= 8);
  assert.equal(run.provenance.terrainSource, 'mapzen-terrarium-dem');
  assert.ok(run.provenance.metersPerPixel > 0);
  assert.ok(run.provenance.waterQueryUrl.includes('api.openstreetmap.org'));
  assert.ok(run.provenance.waterRetrievedAt);
  assert.ok(run.tilesFetched > 0);
  assert.equal(run.tilesFetched, run.tilesTotal);

  assert.ok(run.candidates.length >= 1);
  const best = run.candidates[0];
  assert.ok(best.geometricCapacityM3 > 0, `capacity=${best.geometricCapacityM3}`);
  assert.ok(best.maximumDepthToSpillM > 3 && best.maximumDepthToSpillM < 13, `depth=${best.maximumDepthToSpillM}`);
  assert.ok(best.spillElevationM >= BASE_ELEVATION_M && best.spillElevationM <= BASE_ELEVATION_M + 1);
  assert.ok(best.footprintAreaM2 > 1000, `area=${best.footprintAreaM2}`);
  assert.ok(best.minimumElevationM < BASE_ELEVATION_M);
  assert.deepEqual(best.polygon.outer[0], best.polygon.outer.at(-1));
  assert.ok(best.polygon.outer.length > 4);
  assert.equal(best.availableStorageM3, null);
  assert.equal(best.suitability, 'unassessed');
  assert.ok(Number.isFinite(best.centroid[0]) && Number.isFinite(best.centroid[1]));

  // The OSM square covers the bowl centre, so the largest candidate overlaps it.
  assert.equal(best.waterEvidence.status, 'overlaps');
  assert.ok(best.waterEvidence.overlapCells > 0);
  assert.ok(best.waterEvidence.overlapAreaM2 > 0);
  assert.equal(best.waterEvidence.features[0].id, 'way/1');
  assert.equal(best.waterEvidence.features[0].kind, 'water');
  assert.equal(best.waterEvidence.features[0].label, 'Gadheri Talab');

  // Tasks run in parallel over the same plan; the analysis grid is bounded.
  const plan = planGridForBox(
    analysisBoxDeg(config().center, config().halfSpanKm, config().contextRingRatio),
    config().maxTiles,
  );
  assert.equal(run.provenance.tileMatrixZoom, plan.zoom);
  assert.ok(plan.width * plan.height <= 1_000_000);
});

test('water retrieval failure keeps terrain results but marks evidence unavailable', async () => {
  const { run } = await baselineRun({
    fetchWaterJson: async () => {
      throw new Error('synthetic OSM outage');
    },
  });
  assert.equal(run.status, 'succeeded', run.error ?? '');
  assert.ok(run.limitations.some((line) => /unavailable/i.test(line)));
  assert.equal(run.provenance.waterRetrievedAt, null);
  assert.ok(run.candidates.length >= 1);
  for (const candidate of run.candidates) {
    assert.equal(candidate.waterEvidence.status, 'unavailable');
    assert.equal(candidate.waterEvidence.overlapCells, null);
    assert.equal(candidate.waterEvidence.overlapAreaM2, null);
    assert.deepEqual(candidate.waterEvidence.features, []);
  }
});

test('a single missing terrain tile fails the run instead of inventing depressions', async () => {
  const fetcher = tileFetcher({ failAtCall: 1 });
  const run = await runStorageScreening(config(), {
    signal: new AbortController().signal,
    fetchTile: fetcher.fetchTile,
    fetchWaterJson: async () => waterDocument(),
  });
  assert.equal(run.status, 'failed');
  assert.match(run.error, /not an absence of storage/);
  assert.deepEqual(run.candidates, []);
  assert.equal(run.candidateCountTotal, 0);
});

test('a pre-aborted signal produces a cancelled record', async () => {
  const controller = new AbortController();
  controller.abort();
  const run = await runStorageScreening(config(), {
    signal: controller.signal,
    fetchTile: async () => {
      const err = new Error('synthetic abort');
      err.name = 'AbortError';
      throw err;
    },
    fetchWaterJson: async () => waterDocument(),
  });
  assert.equal(run.status, 'cancelled');
  assert.deepEqual(run.candidates, []);
  assert.ok(run.error);
});

test('a shared tiles cache prevents duplicate tile fetches on a rerun', async () => {
  const cache = new Map();
  let calls = 0;
  const fetchTile = async (url) => {
    calls++;
    return makeTile(parseTileUrl(url));
  };
  const deps = {
    signal: new AbortController().signal,
    fetchTile,
    fetchWaterJson: async () => waterDocument(),
    tilesCache: cache,
  };
  const first = await runStorageScreening(config(), deps);
  assert.equal(first.status, 'succeeded', first.error ?? '');
  const callsAfterFirst = calls;
  assert.ok(callsAfterFirst > 0);
  assert.equal(cache.size, first.tilesTotal);

  const second = await runStorageScreening(config(), { ...deps, signal: new AbortController().signal });
  assert.equal(second.status, 'succeeded', second.error ?? '');
  assert.equal(calls, callsAfterFirst, 'second run must serve every tile from the cache');
  assert.deepEqual(
    second.candidates.map((c) => c.id),
    first.candidates.map((c) => c.id),
  );
  assert.equal(second.configHash, first.configHash);
});

test('progress events cover terrain and water with a non-zero tile budget', async () => {
  const events = [];
  const { run } = await baselineRun({
    onProgress: (event) => events.push(event),
  });
  assert.equal(run.status, 'succeeded', run.error ?? '');
  const terrain = events.filter((e) => e.phase === 'terrain');
  const water = events.filter((e) => e.phase === 'water');
  assert.ok(terrain.length >= 1);
  assert.ok(water.length >= 1);
  assert.ok(terrain.every((e) => e.tilesTotal > 0));
  assert.ok(water.every((e) => e.tilesTotal > 0));
  assert.ok(events.some((e) => e.phase === 'analysing'));
});


test('mapped-water area counts unique candidate cells, retaining all overlapping feature IDs', async () => {
  // A mapped square wider than the whole synthetic bowl covers every candidate cell.
  const water = waterDocument();
  for (const node of water.elements.filter(e => e.type === 'node')) {
    node.lon = CENTER.lon + Math.sign(node.lon - CENTER.lon) * 0.01;
    node.lat = CENTER.lat + Math.sign(node.lat - CENTER.lat) * 0.01;
  }
  const { run: single } = await baselineRun({ fetchWaterJson: async () => water });
  assert.equal(single.status, 'succeeded', single.error ?? '');
  const plan = planGridForBox(
    analysisBoxDeg(config().center, config().halfSpanKm, config().contextRingRatio),
    config().maxTiles,
  );
  const cellAreaM2 = plan.meterPerPxLat * plan.meterPerPxLon;
  const candidate = single.candidates[0];
  const expectedCells = Math.round(candidate.footprintAreaM2 / cellAreaM2);
  assert.ok(expectedCells > 1, 'fixture must contain multiple candidate cells');
  assert.equal(candidate.waterEvidence.overlapCells, expectedCells);
  assert.equal(candidate.waterEvidence.overlapAreaM2, Math.round(expectedCells * cellAreaM2));
  assert.equal(candidate.waterEvidence.overlapAreaM2, Math.round(candidate.footprintAreaM2));

  // Coincident mapped water features must not double-count the same wet cells.
  const duplicate = structuredClone(water.elements.find(e => e.type === 'way'));
  duplicate.id = 2;
  duplicate.tags.name = 'Second mapping of the same water';
  water.elements.push(duplicate);
  const { run: overlapping } = await baselineRun({ fetchWaterJson: async () => water });
  assert.equal(overlapping.status, 'succeeded', overlapping.error ?? '');
  const evidence = overlapping.candidates[0].waterEvidence;
  assert.equal(evidence.overlapCells, expectedCells);
  assert.equal(evidence.overlapAreaM2, candidate.waterEvidence.overlapAreaM2);
  assert.deepEqual(evidence.features.map(f => f.id).sort(), ['way/1', 'way/2']);
});


test('legacy saved water counts are invalidated without discarding terrain geometry or mapped presence', async () => {
  const { loadStorageRun } = await import('../src/flood/storage/storageSearch.ts');
  const { run } = await baselineRun();
  const old = structuredClone(run);
  delete old.waterEvidenceVersion;
  old.candidates[0].waterEvidence = { status: 'overlaps', overlapCells: 1, overlapAreaM2: 100, features: [{id:'way/1',kind:'water',label:null}] };
  const previous=globalThis.localStorage;
  globalThis.localStorage={getItem:()=>JSON.stringify(old)};
  try {
    const loaded=loadStorageRun();
    assert.equal(loaded.waterEvidenceVersion,1);
    assert.deepEqual(loaded.candidates[0].polygon,run.candidates[0].polygon);
    assert.equal(loaded.candidates[0].waterEvidence.status,'overlaps');
    assert.equal(loaded.candidates[0].waterEvidence.overlapCells,null);
    assert.equal(loaded.candidates[0].waterEvidence.overlapAreaM2,null);
    assert.ok(loaded.limitations.some(s=>s.includes('Legacy mapped-water overlap')));
    globalThis.localStorage={getItem:()=>JSON.stringify(run)};
    assert.equal(loadStorageRun().waterEvidenceVersion,2);
  } finally { if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous; }
});
