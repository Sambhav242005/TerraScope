import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  loadRenewableResource,
  parseRenewableResource,
  percentile,
  statsOf,
  RENEWABLE_RESOURCE_URL,
} from '../src/flood/renewableResource.ts';

const ARTIFACT = 'public/data/renewable-resource-gandak.json';

// --- Fixture builders (deterministic; no network, no clocks) -------------

function isoDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** One row per month of 2021 with deliberately distinct season values:
 *  June-September GHI = 5, all other months = 40 (max physical GHI here is ~30,
 *  but the library bound is 50, so this is a legal synthetic fixture and the
 *  split is unambiguous). Wind constant 4 m/s everywhere. */
function seasonSplitFixture() {
  const rows = [];
  for (let m = 1; m <= 12; m += 1) {
    const monsoon = m >= 6 && m <= 9;
    rows.push({
      date: isoDate(2021, m, 15),
      ghi: monsoon ? 5 : 40,
      wind10: 3,
      wind100: 4,
      windDir10: 270,
      windDir100: 270,
    });
  }
  return rows;
}

/** 60 rows with genuinely spread values (both series), sequential dates from 2020-03-01. */
function spreadFixture() {
  const rows = [];
  let day = new Date(Date.UTC(2020, 2, 1));
  for (let i = 0; i < 60; i += 1) {
    rows.push({
      date: day.toISOString().slice(0, 10),
      ghi: ((i * 37) % 29) + 5,      // 5..33, irregular
      wind10: ((i * 13) % 6) + 0.5,  // 0.5..5.5
      wind100: ((i * 17) % 9) + 1,   // 1..9.something
      windDir10: (i * 29) % 360,
      windDir100: 270 + ((i % 5) - 2), // near 270
    });
    day = new Date(day.getTime() + 86400000);
  }
  return rows;
}

function payloadOf(rows) {
  return {
    latitude: 26.5,
    longitude: 84.25,
    timezone: 'Asia/Kolkata',
    daily_units: {
      time: 'iso8601',
      shortwave_radiation_sum: 'MJ/m²',
      wind_speed_10m_mean: 'm/s',
      wind_speed_100m_mean: 'm/s',
    },
    daily: {
      time: rows.map((r) => r.date),
      shortwave_radiation_sum: rows.map((r) => r.ghi),
      wind_speed_10m_mean: rows.map((r) => r.wind10),
      wind_speed_100m_mean: rows.map((r) => r.wind100),
      wind_direction_10m_dominant: rows.map((r) => r.windDir10 ?? null),
      wind_direction_100m_dominant: rows.map((r) => r.windDir100 ?? null),
    },
    provenance: {
      url: 'https://archive-api.open-meteo.com/v1/archive?example=fixture',
      retrieved: '2026-11-15T00:00:00.000Z',
      retrievedDate: '2026-11-15',
      model: 'ERA5 (models=era5)',
      resolution: '0.25 degree (ERA5 grid)',
      license: 'CC BY 4.0 (fixture)',
      coverageStart: rows[0]?.date ?? null,
      coverageEnd: rows[rows.length - 1]?.date ?? null,
      dayCount: rows.length,
    },
  };
}

// --- Library: percentile core ---------------------------------------------

test('percentile: type-7 interpolation, deterministic, no input mutation', () => {
  const values = [40, 5, 5, 40, 5, 40, 5, 40];
  const before = [...values];
  assert.equal(percentile(values, 0), 5);
  assert.equal(percentile(values, 0.5), 22.5);
  assert.equal(percentile(values, 1), 40);
  assert.deepEqual(values, before);
  assert.equal(percentile([7], 0.9), 7);
  assert.throws(() => percentile([], 0.5));
  assert.throws(() => percentile([1], 1.5));
});

// --- statsOf: ordering, splits, nulls, refusals ---------------------------

test('p90 > p50 > p10 on both GHI and wind100 (spread fixture)', () => {
  const s = statsOf(spreadFixture());
  assert.equal(s.ok, true);
  assert.ok(s.ghi.p90 > s.ghi.p50 && s.ghi.p50 > s.ghi.p10, 'ghi ordering');
  assert.ok(s.wind100.p90 > s.wind100.p50 && s.wind100.p50 > s.wind100.p10, 'wind100 ordering');
  assert.equal(s.ghi.n, 60);
  assert.equal(s.wind100.n, 60);
  assert.equal(s.ghi.missing, 0);
  assert.equal(s.wind100.missing, 0);
});

test('monotone sanity: p10 <= p50 <= p90 holds even for degenerate series', () => {
  const flat = Array.from({ length: 30 }, (_, i) => ({
    date: isoDate(2022, 1, (i % 28) + 1),
    ghi: 12,
    wind10: 2,
    wind100: 3,
  }));
  const s = statsOf(flat);
  assert.equal(s.ok, true);
  assert.ok(s.ghi.p10 <= s.ghi.p50 && s.ghi.p50 <= s.ghi.p90);
  assert.ok(s.wind100.p10 <= s.wind100.p50 && s.wind100.p50 <= s.wind100.p90);
});

test('monsoon (Jun-Sep) vs dry (Oct-May) GHI split counts and values', () => {
  const s = statsOf(seasonSplitFixture());
  assert.equal(s.ok, true);
  assert.equal(s.monsoonghiJunSep.n, 4);
  assert.equal(s.dryghiOctMay.n, 8);
  assert.equal(s.monsoonghiJunSep.p10, 5);
  assert.equal(s.monsoonghiJunSep.p90, 5);
  assert.equal(s.dryghiOctMay.p10, 40);
  assert.equal(s.dryghiOctMay.p90, 40);
  assert.equal(s.monsoonghiJunSep.missing, 0);
  assert.equal(s.dryghiOctMay.missing, 0);
  assert.equal(s.monsoonghiJunSep.n + s.dryghiOctMay.n, 12);
});

test('rows with nulls: excluded + counted, never zero-filled; mean skips nulls', () => {
  const rows = spreadFixture().slice(0, 20).map((r, i) =>
    i % 5 === 0 ? { ...r, ghi: null, wind100: null } : { ...r },
  );
  const s = statsOf(rows);
  assert.equal(s.ok, true);
  assert.equal(s.ghi.missing, 4);
  assert.equal(s.wind100.missing, 4);
  assert.equal(s.ghi.n, 16);
  assert.equal(s.wind100.n, 16);
  const validGhi = rows.map((r) => r.ghi).filter((v) => v !== null);
  const expectedMean = validGhi.reduce((a, b) => a + b, 0) / validGhi.length;
  assert.ok(Math.abs(s.ghi.mean - expectedMean) < 1e-12);
  // null is never rendered as 0 anywhere:
  assert.notEqual(s.ghi.p50, 0);
  assert.notEqual(s.ghi.mean, 0);
});

test('all-null GHI series -> structured refusal (no fabricated stats)', () => {
  const rows = spreadFixture().slice(0, 10).map((r) => ({ ...r, ghi: null }));
  const s = statsOf(rows);
  assert.equal(s.ok, false);
  assert.equal(s.reason, 'insufficient-valid-values');
  assert.match(s.detail, /ghi/);
  assert.ok(Array.isArray(s.sources) && s.sources.length > 0);
});

test('all-null wind100 series -> structured refusal', () => {
  const rows = spreadFixture().slice(0, 10).map((r) => ({ ...r, wind100: null }));
  const s = statsOf(rows);
  assert.equal(s.ok, false);
  assert.equal(s.reason, 'insufficient-valid-values');
  assert.match(s.detail, /wind100/);
});

test('empty array -> structured refusal, not a crash', () => {
  const s = statsOf([]);
  assert.equal(s.ok, false);
  assert.equal(s.reason, 'empty-input');
  assert.match(s.detail, /empty series is not zero/i);
  assert.ok(Array.isArray(s.sources) && s.sources.length > 0);
});

test('non-array input -> structured refusal', () => {
  const s = statsOf(null);
  assert.equal(s.ok, false);
  assert.equal(s.reason, 'malformed-rows');
});

test('garbage rows are refused, not silently filtered', () => {
  const base = spreadFixture().slice(0, 5);
  const badDate = [...base];
  badDate[1] = { ...badDate[1], date: '2021-02-30' }; // not a real calendar date
  assert.equal(statsOf(badDate).reason, 'malformed-rows');
  const bigGhi = [...base];
  bigGhi[2] = { ...bigGhi[2], ghi: 999 };             // unit-mix-up guard
  assert.equal(statsOf(bigGhi).reason, 'malformed-rows');
  const nanWind = [...base];
  nanWind[3] = { ...nanWind[3], wind10: NaN };
  assert.equal(statsOf(nanWind).reason, 'malformed-rows');
  const negWind = [...base];
  negWind[0] = { ...negWind[0], wind100: -1 };
  assert.equal(statsOf(negWind).reason, 'malformed-rows');
  const badDir = [...base];
  badDir[4] = { ...badDir[4], windDir100: 400 };
  assert.equal(statsOf(badDir).reason, 'malformed-rows');
  const notObject = [...base];
  notObject[2] = null;
  assert.equal(statsOf(notObject).reason, 'malformed-rows');
});

test('determinism: same input -> byte-identical output', () => {
  const rows = spreadFixture();
  const a = JSON.stringify(statsOf(rows));
  const b = JSON.stringify(statsOf(rows));
  assert.equal(a, b);
  assert.deepEqual(statsOf(rows), statsOf(rows));
});

test('dominantBearing: present for vector-consistent directions, absent otherwise', () => {
  const withDir = statsOf(spreadFixture()); // 60 rows, windDir100 clustered near 270
  assert.equal(withDir.ok, true);
  assert.ok(typeof withDir.wind100.dominantBearing === 'number');
  assert.ok(
    Math.abs(withDir.wind100.dominantBearing - 270) < 1,
    `expected ~270, got ${withDir.wind100.dominantBearing}`,
  );
  const noDir = spreadFixture().map(({ windDir100, ...r }) => r);
  const s2 = statsOf(noDir);
  assert.equal(s2.ok, true);
  assert.equal(s2.wind100.dominantBearing, undefined);
  const fewDir = spreadFixture().slice(0, 10).map((r) => ({ ...r, windDir100: 90 })); // < 30 samples
  const s3 = statsOf(fewDir);
  assert.equal(s3.ok, true);
  assert.equal(s3.wind100.dominantBearing, undefined);
});

// --- parseRenewableResource: fixtures, no network --------------------------

test('parseRenewableResource: valid payload -> rows with nulls preserved', () => {
  const fixtureRows = spreadFixture().slice(0, 12).map((r, i) =>
    i === 3 ? { ...r, ghi: null, wind100: null } : r,
  );
  const p = parseRenewableResource(payloadOf(fixtureRows));
  assert.equal(p.ok, true);
  assert.equal(p.rows.length, 12);
  assert.equal(p.rows[3].ghi, null);
  assert.equal(p.rows[3].wind100, null);
  assert.equal(p.meta.model, 'ERA5 (models=era5)');
  assert.equal(p.meta.dayCount, 12);
  assert.equal(p.meta.coverageStart, fixtureRows[0].date);
});

test('parseRenewableResource: refuse malformed payloads with detail', () => {
  assert.equal(parseRenewableResource(null).reason, 'malformed-payload');
  assert.equal(parseRenewableResource({ daily: null }).reason, 'malformed-payload');
  assert.equal(parseRenewableResource({ daily: { time: [] } }).reason, 'malformed-payload');
  const mismatch = payloadOf(spreadFixture().slice(0, 5));
  mismatch.daily.shortwave_radiation_sum = [1, 2]; // length mismatch
  assert.equal(parseRenewableResource(mismatch).reason, 'malformed-payload');
  const badDate = payloadOf(spreadFixture().slice(0, 5));
  badDate.daily.time[2] = '15/03/2020';
  assert.equal(parseRenewableResource(badDate).reason, 'malformed-payload');
  const outOfBounds = payloadOf(spreadFixture().slice(0, 5));
  outOfBounds.daily.shortwave_radiation_sum[1] = 500;
  assert.equal(parseRenewableResource(outOfBounds).reason, 'out-of-bounds');
  const dirTooBig = payloadOf(spreadFixture().slice(0, 5));
  dirTooBig.daily.wind_direction_100m_dominant[0] = 361;
  assert.equal(parseRenewableResource(dirTooBig).reason, 'out-of-bounds');
});

// --- loadRenewableResource: injected fetch stubs only ----------------------

test('loadRenewableResource: HTTP failure -> structured refusal (no throw)', async () => {
  const res = await loadRenewableResource(async () => ({ ok: false, status: 503, json: async () => ({}) }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'fetch-failed');
  assert.match(res.detail, /503/);
});

test('loadRenewableResource: network throw -> structured refusal (no throw)', async () => {
  const res = await loadRenewableResource(async () => { throw new Error('ECONNREFUSED'); });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'fetch-failed');
  assert.match(res.detail, /ECONNREFUSED/);
});

test('loadRenewableResource: response not JSON -> structured refusal', async () => {
  const res = await loadRenewableResource(async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'fetch-failed');
});

test('loadRenewableResource: fetches only the bundled path via injected fetch', async () => {
  const fixture = payloadOf(seasonSplitFixture());
  let seenUrl = null;
  const res = await loadRenewableResource(async (url) => {
    seenUrl = url;
    return { ok: true, json: async () => fixture };
  });
  assert.equal(res.ok, true);
  assert.equal(seenUrl, RENEWABLE_RESOURCE_URL);
  assert.equal(res.rows.length, 12);
  assert.equal(res.meta.url, fixture.provenance.url);
});

test('loadRenewableResource: garbage payload pass-through is a refusal, not a crash', async () => {
  const res = await loadRenewableResource(async () => ({ ok: true, json: async () => ({ hello: 'world' }) }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'malformed-payload');
});

// --- Bundled artifact (guarded: skips cleanly if the fetch had failed) ------

test('bundled renewable-resource-gandak.json parses and keeps provenance + full coverage', (t) => {
  if (!existsSync(ARTIFACT)) {
    t.diagnostic(`${ARTIFACT} absent — fetch must have failed; see artifacts/agents/FIX-renewable-resource.md`);
    return;
  }
  const raw = readFileSync(ARTIFACT, 'utf-8');
  const json = JSON.parse(raw); // must not throw
  assert.equal(json.provenance.id, 'renewable-resource-gandak');
  assert.match(json.provenance.url, /^https:\/\/archive-api\.open-meteo\.com\/v1\/archive\?/);
  assert.equal(json.provenance.coverageStart, '2015-01-01');
  assert.equal(json.provenance.coverageEnd, '2024-12-31');
  assert.equal(json.provenance.dayCount, 3653);
  assert.match(json.provenance.license, /CC BY 4\.0/);
  assert.equal(json.latitude, 26.5);
  assert.equal(json.longitude, 84.25);
  assert.equal(json.daily.time.length, 3653);
  assert.equal(json.daily.time[0], '2015-01-01');
  assert.equal(json.daily.time[json.daily.time.length - 1], '2024-12-31');
  // no gaps, no nulls in any served series
  for (let i = 1; i < json.daily.time.length; i += 1) {
    const prev = Date.parse(json.daily.time[i - 1] + 'T00:00:00Z');
    const cur = Date.parse(json.daily.time[i] + 'T00:00:00Z');
    assert.equal(cur - prev, 86400000, `gap before ${json.daily.time[i]}`);
  }
  for (const key of ['shortwave_radiation_sum', 'wind_speed_10m_mean', 'wind_speed_100m_mean']) {
    assert.equal(json.daily[key].filter((v) => v === null).length, 0, `${key} must have no nulls`);
  }
  // per-year tally
  const perYear = {};
  for (const t of json.daily.time) perYear[t.slice(0, 4)] = (perYear[t.slice(0, 4)] ?? 0) + 1;
  assert.deepEqual(perYear, {
    2015: 365, 2016: 366, 2017: 365, 2018: 365, 2019: 365,
    2020: 366, 2021: 365, 2022: 365, 2023: 365, 2024: 366,
  });
});

test('bundled artifact yields ordered screening stats via the library', (t) => {
  if (!existsSync(ARTIFACT)) {
    t.diagnostic(`${ARTIFACT} absent — see artifacts/agents/FIX-renewable-resource.md`);
    return;
  }
  const json = JSON.parse(readFileSync(ARTIFACT, 'utf-8'));
  const p = parseRenewableResource(json);
  assert.equal(p.ok, true);
  const s = statsOf(p.rows);
  assert.equal(s.ok, true);
  assert.ok(s.ghi.p90 > s.ghi.p50 && s.ghi.p50 > s.ghi.p10);
  assert.ok(s.wind100.p90 > s.wind100.p50 && s.wind100.p50 > s.wind100.p10);
  assert.equal(s.ghi.n, 3653);
  assert.equal(s.wind100.n, 3653);
  assert.equal(s.monsoonghiJunSep.n + s.dryghiOctMay.n, 3653);
  assert.ok(typeof s.wind100.dominantBearing === 'number');
  assert.ok(s.wind100.dominantBearing >= 0 && s.wind100.dominantBearing < 360);
  assert.match(s.sources[0], /archive-api\.open-meteo\.com/);
});
