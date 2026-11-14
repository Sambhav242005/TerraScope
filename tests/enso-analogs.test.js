import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAnalogRows, analogSummary } from '../src/flood/ensoAnalogs.ts';

// Joined 2015–2024 daily record, as produced by joinHistory.
const time = [];
for (const y of [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]) {
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 28; d++) {
      time.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }
}
const rowsFor = (flow, rain) =>
  time.map((date, i) => ({ date, flow: flow(date, i), rain: rain(date, i) }));

test('buildAnalogRows joins ONI years with peak discharge and monsoon rain', () => {
  const rows = rowsFor(
    (d) => (d.startsWith('2024-') ? 1000 : 100),
    (d) => (d >= '2024-06-01' && d <= '2024-09-30' ? 5 : 0),
  );
  const analogs = buildAnalogRows(rows);
  const row2024 = analogs.find((r) => r.year === 2024);
  assert.equal(row2024.phase, 'Neutral');
  assert.equal(row2024.peakFlow, 1000);
  assert.equal(row2024.peakFlowDate, '2024-01-01');
  assert.equal(row2024.monsoonRainMm, 4 * 28 * 5);
});

test('peak discharge picks the highest day and its date', () => {
  const rows = [
    { date: '2020-01-01', flow: 50, rain: 0 },
    { date: '2020-07-15', flow: 999, rain: 1 },
    { date: '2020-07-20', flow: 800, rain: 1 },
    { date: '2020-12-31', flow: 60, rain: 0 },
  ];
  const analogs = buildAnalogRows(rows);
  const row = analogs.find((r) => r.year === 2020);
  assert.equal(row.peakFlow, 999);
  assert.equal(row.peakFlowDate, '2020-07-15');
});

test('missing days are counted, never zeroed or interpolated', () => {
  const rows = [
    { date: '2019-06-01', flow: null, rain: 3 },
    { date: '2019-06-02', flow: 400, rain: 2 },
    { date: '2019-06-03', flow: null, rain: 5 },
  ];
  const analogs = buildAnalogRows(rows);
  const row = analogs.find((r) => r.year === 2019);
  assert.equal(row.peakFlow, 400);
  assert.equal(row.flowGaps, 2);
  assert.equal(row.flowDays, 1);
  assert.equal(row.rainDays, 3);
  assert.equal(row.rainGaps, 0);
  assert.equal(row.monsoonRainMm, 10);
});

test('out-of-monsoon months do not contribute to the monsoon rain total', () => {
  const rows = [
    { date: '2019-03-01', flow: 100, rain: 50 },
    { date: '2019-03-02', flow: 200, rain: 60 },
  ];
  const analogs = buildAnalogRows(rows);
  const row = analogs.find((r) => r.year === 2019);
  assert.equal(row.monsoonRainMm, null);
  assert.equal(row.rainDays, 0);
});

test('years absent from the record report gaps and no peak', () => {
  const rows = [
    { date: '2015-06-01', flow: 100, rain: 1 },
    { date: '2015-06-02', flow: 200, rain: 2 },
  ];
  const analogs = buildAnalogRows(rows);
  const row2017 = analogs.find((r) => r.year === 2017);
  assert.equal(row2017.peakFlow, null);
  assert.equal(row2017.flowDays, 0);
  assert.equal(row2017.monsoonRainMm, null);
});

test('analogSummary groups phases correctly', () => {
  const rows = time.map((date) => ({ date, flow: 100, rain: 1 }));
  const summary = analogSummary(buildAnalogRows(rows));
  assert.deepEqual(summary.elNinoYears, [2015, 2018, 2023]);
  assert.deepEqual(summary.laNinaYears, [2016, 2017, 2020, 2021, 2022]);
  assert.deepEqual(summary.neutralYears, [2019, 2024]);
});

test('buildAnalogRows is deterministic and sorted by year', () => {
  const rows = time.map((date) => ({ date, flow: 42, rain: 1 }));
  const a = JSON.stringify(buildAnalogRows(rows));
  const b = JSON.stringify(buildAnalogRows(rows));
  assert.equal(a, b);
  assert.deepEqual(buildAnalogRows(rows).map((r) => r.year), [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
});

test('empty record throws rather than fabricate', () => {
  assert.throws(() => buildAnalogRows([]));
});
