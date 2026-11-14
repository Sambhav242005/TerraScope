import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildResultTimeline,
  summarizeStates,
  summarizeYear,
} from '../src/flood/resultTimelineCore.ts';

const DAYS = [
  '2024-09-25', '2024-09-26', '2024-09-27', '2024-09-28', '2024-09-29',
  '2024-09-30', '2024-10-01', '2024-10-02', '2024-10-03',
];
const RAIN = [12.5, 30.1, 8.2, null, 4.4, 55.0, 21.3, 0, 3.3];
const FLOW = [1200, 1500, 1800, 2200, null, 3100, 4200, 5100, 4800];

function base(overrides = {}) {
  return {
    days: DAYS,
    dailyRain: RAIN,
    discharge: FLOW,
    waterOn: false,
    waterLevel: 50,
    storageRun: null,
    interventions: [],
    ...overrides,
  };
}

test('buildResultTimeline emits rainfall, discharge and NRSC for every day in the window', () => {
  const entries = buildResultTimeline(base());
  assert.equal(entries.length, DAYS.length * 3);
  const byKind = (k) => entries.filter((e) => e.kind === k);
  assert.equal(byKind('rainfall').length, 9);
  assert.equal(byKind('discharge').length, 9);
  assert.equal(byKind('nrsc').length, 9);
});

test('missing rainfall becomes an explicit gap, never zero', () => {
  const entries = buildResultTimeline(base());
  const gap = entries.find((e) => e.id === 'rainfall-2024-09-28');
  assert.equal(gap.state, 'gap');
  assert.match(gap.detail, /not zero/i);
  assert.ok(!/0\.0 mm/.test(gap.title));
});

test('missing discharge becomes an explicit gap, never zero', () => {
  const entries = buildResultTimeline(base());
  const gap = entries.find((e) => e.id === 'discharge-2024-09-29');
  assert.equal(gap.state, 'gap');
  assert.match(gap.detail, /not zero/i);
});

test('NRSC entries are available only on the published dates and gaps elsewhere', () => {
  const entries = buildResultTimeline(base());
  const byDay = new Map(entries.filter((e) => e.kind === 'nrsc').map((e) => [e.day, e.state]));
  assert.equal(byDay.get('2024-10-01'), 'available');
  assert.equal(byDay.get('2024-10-02'), 'available');
  for (const day of DAYS) {
    if (day !== '2024-10-01' && day !== '2024-10-02') assert.equal(byDay.get(day), 'gap');
  }
});

test('water-level scenario appears as a scenario input only when enabled', () => {
  const off = buildResultTimeline(base());
  assert.equal(off.filter((e) => e.kind === 'water-scenario').length, 0);
  const on = buildResultTimeline(base({ waterOn: true, waterLevel: 46.5 }));
  const input = on.find((e) => e.kind === 'water-scenario');
  assert.equal(input.state, 'input');
  assert.match(input.title, /46\.5 m/);
  assert.match(input.detail, /not a prediction/i);
});

test('failed screening run records an explicit gap with its start timestamp', () => {
  const startedAt = '2026-11-14T10:00:00.000Z';
  const run = {
    schema: 'terrascope-storage-v1', waterEvidenceVersion: 2, id: 'storage-screening-abc-1',
    configHash: 'abc123def456', config: {}, status: 'failed', startedAt, finishedAt: null, attempt: 1,
    tilesFetched: 4, tilesTotal: 6, candidates: [], candidateCountTotal: 0,
    error: 'terrain tile unavailable', limitations: ['terrain coverage unknown'], water: null,
    provenance: { runKind: 'historical-terrain-screening', waterRetrievedAt: null, method: 'priority-flood-d8-v1' },
  };
  const entries = buildResultTimeline(base({ storageRun: run }));
  const entry = entries.find((e) => e.kind === 'storage-run');
  assert.equal(entry.state, 'gap');
  assert.equal(entry.time, startedAt);
  assert.match(entry.detail, /terrain tile unavailable/);
});

test('successful screening run records its candidates and water retrieval time', () => {
  const run = {
    schema: 'terrascope-storage-v1', waterEvidenceVersion: 2, id: 'storage-screening-ok-1',
    configHash: 'def456abc123', config: {}, status: 'succeeded',
    startedAt: '2026-11-14T10:05:00.000Z', finishedAt: '2026-11-14T10:06:00.000Z', attempt: 1,
    tilesFetched: 6, tilesTotal: 6, candidates: [{ id: 'c1' }, { id: 'c2' }], candidateCountTotal: 2,
    error: null, limitations: [], water: null,
    provenance: { runKind: 'historical-terrain-screening', waterRetrievedAt: '2026-11-14T10:05:30.000Z', method: 'priority-flood-d8-v1' },
  };
  const entries = buildResultTimeline(base({ storageRun: run }));
  const entry = entries.find((e) => e.kind === 'storage-run');
  assert.equal(entry.state, 'available');
  assert.match(entry.title, /2 depressions/);
  assert.match(entry.detail, /Water evidence fetched/);
});

test('proposals appear as timestamped actions, sorted by creation time', () => {
  const interventions = [
    { id: 'i2', name: 'Later basin', kind: 'storage_basin', lat: 25.7, lon: 85.16, createdAt: '2026-11-14T09:00:00.000Z', areaM2: 12000, status: 'proposed' },
    { id: 'i1', name: 'Earlier array', kind: 'solar_array', lat: 25.71, lon: 85.17, createdAt: '2026-11-14T08:00:00.000Z', areaM2: 25000, status: 'proposed' },
  ];
  const entries = buildResultTimeline(base({ interventions }));
  const actions = entries.filter((e) => e.kind === 'intervention');
  assert.deepEqual(actions.map((a) => a.id), ['intervention-i1', 'intervention-i2']);
  assert.equal(actions[0].time, '2026-11-14T08:00:00.000Z');
});

test('empty window produces no entries and summarizeStates counts zeros', () => {
  const entries = buildResultTimeline(base({ days: [], dailyRain: [], discharge: [] }));
  assert.deepEqual(entries, []);
  assert.deepEqual(summarizeStates(entries), { available: 0, gap: 0, input: 0 });
});

test('summarizeStates counts available, gap and input entries', () => {
  const entries = buildResultTimeline(base({ waterOn: true, waterLevel: 50 }));
  const s = summarizeStates(entries);
  assert.equal(s.input, 1);
  assert.equal(s.gap + s.available, DAYS.length * 3);
});

test('summarizeYear counts days, gaps and the peak without inventing zeros', () => {
  const rows = [
    { date: '2024-01-01', flow: 100, rain: 2 },
    { date: '2024-01-02', flow: null, rain: 0 },
    { date: '2024-01-03', flow: 250, rain: null },
    { date: '2024-01-04', flow: 175, rain: 1 },
    { date: '2023-12-31', flow: 9999, rain: 0 },
  ];
  const summary = summarizeYear('2024', rows);
  assert.equal(summary.days, 4);
  assert.equal(summary.flowDays, 3);
  assert.equal(summary.flowGaps, 1);
  assert.equal(summary.rainGaps, 1);
  assert.equal(summary.maxFlow, 250);
  assert.equal(summary.maxFlowDate, '2024-01-03');
});

test('summarizeYear reports no peak when every day is missing', () => {
  const rows = [
    { date: '2019-03-01', flow: null, rain: null },
    { date: '2019-03-02', flow: null, rain: null },
  ];
  const summary = summarizeYear('2019', rows);
  assert.equal(summary.maxFlow, null);
  assert.equal(summary.maxFlowDate, null);
  assert.equal(summary.flowGaps, 2);
});

test('buildResultTimeline is deterministic', () => {
  const once = JSON.stringify(buildResultTimeline(base({ waterOn: true })));
  const twice = JSON.stringify(buildResultTimeline(base({ waterOn: true })));
  assert.equal(once, twice);
});
