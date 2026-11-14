import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFindings } from '../src/flood/findingsCore.ts';

const MANIFEST = [
  { id: 'flow-history', retrieved: '2026-11-04T15:16:02.335801+00:00', sha256: '0a466f81b6633a3a91606e6ca69f2c6b915ef4dd8e1adad234a3d65c2280e791' },
  { id: 'rain-history', retrieved: '2026-11-04T15:16:02.483545+00:00', sha256: '2c97ce623d284d6081756144b1c3309a6e02b0747cebb9fab3df8b76ad9abc70' },
];

function makeHistory() {
  const rows = [];
  for (const y of [2022, 2023, 2024]) {
    for (let d = 1; d <= 28; d++) {
      const iso = `${y}-07-${String(d).padStart(2, '0')}`;
      rows.push({ date: iso, flow: y === 2024 ? 1000 + d : 100 + d, rain: y === 2024 ? 5 : 2 });
    }
  }
  return rows;
}

const BASE = {
  manifest: MANIFEST,
  storageRun: null,
  proposalCount: 0,
  replayDate: '2024-09-27',
  ensoYear: 2024,
};

test('history findings include the peak with date and an explicit non-gauge caveat', () => {
  const findings = buildFindings({ ...BASE, history: makeHistory() });
  const peak = findings.find((f) => f.id === 'peak-flow');
  assert.ok(peak);
  assert.match(peak.title, /1,028 m³\/s \(2024-07-28\)/);
  assert.match(peak.detail, /not a gauge/i);
  assert.match(peak.evidence, /flow-history\.json.*retrieved 2026-11-04/);
});

test('the 90th-percentile band is labeled descriptive, not an alert threshold', () => {
  const findings = buildFindings({ ...BASE, history: makeHistory() });
  const p90 = findings.find((f) => f.id === 'p90-days');
  assert.ok(p90);
  assert.match(p90.detail, /not an alert threshold/i);
});

test('monsoon analogs report 2022-2024 totals with ONI phases', () => {
  const findings = buildFindings({ ...BASE, history: makeHistory() });
  const analogs = findings.find((f) => f.id === 'monsoon-analogs');
  assert.ok(analogs);
  assert.match(analogs.detail, /2022/);
  assert.match(analogs.detail, /2024/);
  assert.match(analogs.detail, /El Niño|Neutral|La Niña/);
});

test('missing history yields an explicit unavailable finding, never substituted', () => {
  const findings = buildFindings({ ...BASE, history: null });
  const unavailable = findings.find((f) => f.id === 'history-unavailable');
  assert.ok(unavailable);
  assert.equal(unavailable.tone, 'watch');
  assert.ok(!findings.some((f) => f.id === 'peak-flow'));
});

test('storage run outcomes surface with provenance', () => {
  const run = {
    schema: 'terrascope-storage-v1', waterEvidenceVersion: 2, id: 'storage-screening-abc-1',
    configHash: 'deadbeefcafe1234', config: {}, status: 'succeeded', startedAt: '2026-11-14T10:00:00.000Z',
    finishedAt: '2026-11-14T10:01:00.000Z', attempt: 1, tilesFetched: 9, tilesTotal: 9,
    candidates: [], candidateCountTotal: 1629, error: null, limitations: [], water: null,
    provenance: { runKind: 'historical-terrain-screening', waterRetrievedAt: null, method: 'priority-flood-d8-v1' },
  };
  const findings = buildFindings({ ...BASE, history: makeHistory(), storageRun: run });
  const storage = findings.find((f) => f.id === 'storage-run');
  assert.match(storage.title, /1,629/);
  assert.match(storage.evidence, /config deadbeefcafe/);
});

test('failed screening surfaces as a watch finding', () => {
  const run = {
    schema: 'terrascope-storage-v1', waterEvidenceVersion: 2, id: 'storage-screening-bad-1',
    configHash: 'deadbeefcafe1234', config: {}, status: 'failed', startedAt: '2026-11-14T10:00:00.000Z',
    finishedAt: null, attempt: 1, tilesFetched: 0, tilesTotal: 9, candidates: [], candidateCountTotal: 0,
    error: 'terrain tile unavailable', limitations: [], water: null,
    provenance: { runKind: 'historical-terrain-screening', waterRetrievedAt: null, method: 'priority-flood-d8-v1' },
  };
  const findings = buildFindings({ ...BASE, history: makeHistory(), storageRun: run });
  const storage = findings.find((f) => f.id === 'storage-run');
  assert.equal(storage.tone, 'watch');
  assert.match(storage.detail, /terrain tile unavailable/);
});

test('NRSC finding distinguishes the replayed day from uncovered days', () => {
  const covered = buildFindings({ ...BASE, history: makeHistory(), replayDate: '2024-10-01' });
  assert.match(covered.find((f) => f.id === 'nrsc-window').detail, /is one of them/);
  const uncovered = buildFindings({ ...BASE, history: makeHistory(), replayDate: '2024-09-27' });
  assert.match(uncovered.find((f) => f.id === 'nrsc-window').detail, /not covered/i);
});

test('proposals are called out as non-calculation inputs', () => {
  const findings = buildFindings({ ...BASE, history: makeHistory(), proposalCount: 2 });
  const proposals = findings.find((f) => f.id === 'proposals');
  assert.ok(proposals);
  assert.match(proposals.detail, /not calculation inputs/i);
});

test('findings are deterministic for identical inputs', () => {
  const a = JSON.stringify(buildFindings({ ...BASE, history: makeHistory() }));
  const b = JSON.stringify(buildFindings({ ...BASE, history: makeHistory() }));
  assert.equal(a, b);
});
