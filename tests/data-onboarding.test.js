import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOnboardingReport,
  checkManifestEntry,
  onboardNewAreaPlan,
  retrievalAgeDays,
  DEPENDENCIES,
  ONBOARDING_LIMITS,
} from '../src/flood/dataOnboarding.ts';

const NOW = new Date('2026-11-14T00:00:00.000Z');

function entry(overrides = {}) {
  return {
    id: 'rainfall',
    url: 'https://example.invalid/rainfall',
    sha256: 'a'.repeat(64),
    retrieved: '2026-11-01T00:00:00Z',
    status: 'downloaded',
    provider: 'Copernicus ERA5',
    license: 'CC BY 4.0',
    uncertainty: 'reanalysis, not catchment average',
    processing: 'hourly summed to IST days',
    coverageStart: '2024-09-25',
    coverageEnd: '2024-10-03',
    ...overrides,
  };
}

test('retrievalAgeDays parses ISO dates and rejects garbage', () => {
  assert.equal(retrievalAgeDays('2026-11-01T00:00:00Z', NOW), 13);
  assert.equal(retrievalAgeDays('2026-11-14T00:00:00Z', NOW), 0);
  assert.equal(retrievalAgeDays('not-a-date', NOW), null);
});

test('a fully populated manifest entry passes schema, coverage, license and freshness rules', () => {
  const checks = checkManifestEntry(entry(), NOW);
  const byCheck = Object.fromEntries(checks.map((c) => [c.check, c]));
  assert.equal(byCheck.schema.verdict, 'pass');
  assert.equal(byCheck.coverage.verdict, 'pass');
  assert.equal(byCheck.license.verdict, 'pass');
  assert.equal(byCheck.freshness.verdict, 'n/a'); // archived series pinned by sha256
});

test('missing required keys fail the schema check with the names of the offenders', () => {
  const checks = checkManifestEntry(entry({ url: undefined, license: undefined, uncertainty: undefined }), NOW);
  const schema = checks.find((c) => c.check === 'schema');
  assert.equal(schema.verdict, 'fail');
  assert.match(schema.detail, /url/);
  assert.match(schema.detail, /license/);
  assert.match(schema.detail, /uncertainty/);
});

test('malformed sha256 fails schema rather than being ignored', () => {
  const checks = checkManifestEntry(entry({ sha256: 'xyz' }), NOW);
  assert.equal(checks.find((c) => c.check === 'schema').verdict, 'fail');
});

test('out-of-order coverage bounds fail the coverage check', () => {
  const checks = checkManifestEntry(entry({ coverageStart: '2024-10-03', coverageEnd: '2024-09-25' }), NOW);
  assert.equal(checks.find((c) => c.check === 'coverage').verdict, 'fail');
});

test('map snapshots report n/a coverage instead of faking a time range', () => {
  const checks = checkManifestEntry(entry({ id: 'assets', coverageStart: null, coverageEnd: null }), NOW);
  assert.equal(checks.find((c) => c.check === 'coverage').verdict, 'n/a');
});

test('archived series are not marked stale by age; current layers are', () => {
  const archived = checkManifestEntry(entry({ id: 'flow-history', retrieved: '2025-01-01T00:00:00Z' }), NOW);
  assert.equal(archived.find((c) => c.check === 'freshness').verdict, 'n/a');
  const current = checkManifestEntry(entry({ id: 'assets', retrieved: '2025-01-01T00:00:00Z', coverageStart: null, coverageEnd: null }), NOW);
  assert.equal(current.find((c) => c.check === 'freshness').verdict, 'fail');
});

test('warn and fail bands for current layers', () => {
  const nowIso = (daysAgo) => new Date(NOW.getTime() - daysAgo * 86400000).toISOString();
  const warn = checkManifestEntry(entry({ id: 'assets', retrieved: nowIso(120), coverageStart: null, coverageEnd: null }), NOW);
  assert.equal(warn.find((c) => c.check === 'freshness').verdict, 'warn');
  const stale = checkManifestEntry(entry({ id: 'assets', retrieved: nowIso(200), coverageStart: null, coverageEnd: null }), NOW);
  assert.equal(stale.find((c) => c.check === 'freshness').verdict, 'fail');
});

test('dependency registry lists every load-bearing dataset with consumers', () => {
  for (const dep of DEPENDENCIES) {
    assert.ok(dep.usedBy.length > 0, `${dep.dataset} must name at least one consumer`);
    assert.equal(typeof dep.loadBearing, 'boolean');
  }
  const loadBearing = DEPENDENCIES.filter((d) => d.loadBearing).map((d) => d.dataset);
  for (const required of ['rainfall', 'discharge', 'flow-history', 'rain-history', 'osm-evidence', 'terrarium-dem']) {
    assert.ok(loadBearing.includes(required), `${required} must be load-bearing`);
  }
});

test('onboarding plan does not relocate historical series to a new area', () => {
  const plan = onboardNewAreaPlan({ lat: 25.7, lon: 85.2 });
  const historical = plan.steps.find((s) => /historical/i.test(s.action));
  assert.ok(historical, 'plan must include a historical-series boundary step');
  assert.match(historical.failure, /not relocated|never relocated/i);
});

test('onboarding plan covers fetch, coverage, NRSC, terrain and dependencies', () => {
  const plan = onboardNewAreaPlan({ lat: 25.7, lon: 85.2 });
  const actions = plan.steps.map((s) => s.action).join(' ');
  assert.match(actions, /bounded.*OSM/i);
  assert.match(actions, /coverage/i);
  assert.match(actions, /NRSC/i);
  assert.match(actions, /terrarium/i);
  assert.match(actions, /dependen/i);
  assert.deepEqual(plan.steps.map((s) => s.order), [1, 2, 3, 4, 5, 6]);
});

test('buildOnboardingReport aggregates verdicts and keeps the limits visible', () => {
  const report = buildOnboardingReport([entry(), entry({ id: 'assets', coverageStart: null, coverageEnd: null, retrieved: '2025-01-01T00:00:00Z' })], NOW);
  assert.equal(report.summary.fail, 1); // stale assets layer
  assert.equal(report.summary.pass, 5); // 3 archived passes + assets schema/license
  assert.equal(report.generatedAt, NOW.toISOString());
  assert.ok(ONBOARDING_LIMITS.some((l) => /missing coverage/i.test(l)));
});

test('buildOnboardingReport is deterministic', () => {
  const a = JSON.stringify(buildOnboardingReport([entry()], NOW));
  const b = JSON.stringify(buildOnboardingReport([entry()], NOW));
  assert.equal(a, b);
});
