import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BUDGET,
  complete,
  emptyHarness,
  enqueue,
  fail,
  cancel,
  heartbeat,
  hashInput,
  loadJobs,
  recoverStale,
  saveJobs,
  start,
  summarizeHarness,
  verifyJobOutput,
} from '../src/flood/harness.ts';

const NOW = new Date('2026-11-14T12:00:00.000Z');
const LATER = new Date('2026-11-14T12:05:00.000Z');
const SOON = new Date('2026-11-14T12:00:30.000Z');
const INPUT = { lat: 25.71, lon: 85.16, configHash: 'abc123def456' };

function goodOutput(overrides = {}) {
  return {
    status: 'succeeded',
    runId: 'storage-screening-abc-1',
    configHash: 'abc123def456',
    method: 'priority-flood-d8-v1',
    tilesFetched: 25,
    tilesTotal: 25,
    candidateCountTotal: 1629,
    ...overrides,
  };
}

const memStore = () => {
  let value = null;
  return {
    getItem: () => value,
    setItem: (_k, v) => {
      value = v;
    },
  };
};

test('enqueue is idempotent for an open job with the same input', () => {
  const first = enqueue(emptyHarness(), 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  const second = enqueue(first.state, 'storage-screening', INPUT, DEFAULT_BUDGET, LATER);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.job.id, first.job.id);
  assert.equal(second.state.jobs.length, 1);
  assert.ok(second.state.events.some((e) => e.kind === 'enqueue-reused'));
});

test('a different input gets a different job and input hash', () => {
  const first = enqueue(emptyHarness(), 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  const other = enqueue(first.state, 'storage-screening', { ...INPUT, lat: 25.8 }, DEFAULT_BUDGET, LATER);
  assert.equal(other.created, true);
  assert.notEqual(other.job.inputHash, first.job.inputHash);
  assert.equal(other.state.jobs.length, 2);
});

test('hashInput is stable across calls', () => {
  assert.equal(hashInput({ kind: 'storage-screening', input: INPUT }), hashInput({ kind: 'storage-screening', input: INPUT }));
});

test('unregistered tool scope is rejected outright', () => {
  assert.throws(
    () => enqueue(emptyHarness(), 'not-a-tool', INPUT, DEFAULT_BUDGET, NOW),
    /scope rejected/i,
  );
});

test('start moves queued to running and increments attempts', () => {
  const { state, job } = enqueue(emptyHarness(), 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  const started = start(state, job.id, NOW);
  const after = started.jobs.find((j) => j.id === job.id);
  assert.equal(after.status, 'running');
  assert.equal(after.attempts, 1);
  assert.throws(() => start(started, job.id, LATER), /only queued/);
});

test('heartbeat keeps the lease alive with checkpoints', () => {
  const { state, job } = enqueue(emptyHarness(), 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  const started = start(state, job.id, NOW);
  const beaten = heartbeat(started, job.id, { tilesFetched: 10, tilesTotal: 25 }, SOON);
  const after = beaten.jobs.find((j) => j.id === job.id);
  assert.equal(after.checkpoint.tilesFetched, 10);
  assert.equal(after.status, 'running');
});

test('heartbeat ignores jobs that are not running', () => {
  const { state, job } = enqueue(emptyHarness(), 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  const cancelled = cancel(state, job.id, NOW);
  const beaten = heartbeat(cancelled, job.id, { tilesFetched: 5, tilesTotal: 25 }, LATER);
  assert.equal(beaten.jobs.find((j) => j.id === job.id).checkpoint, null);
});

test('wall-clock budget exhaustion fails the job with a recorded reason', () => {
  const { state, job } = enqueue(emptyHarness(), 'storage-screening', INPUT, { ...DEFAULT_BUDGET, maxWallMs: 1000 }, NOW);
  const started = start(state, job.id, NOW);
  const busted = heartbeat(started, job.id, { tilesFetched: 4, tilesTotal: 25 }, new Date(NOW.getTime() + 5000));
  const after = busted.jobs.find((j) => j.id === job.id);
  assert.equal(after.status, 'failed');
  assert.match(after.error, /wall-clock budget/i);
  assert.ok(busted.events.some((e) => e.kind === 'failed'));
});

test('tile budget overflow fails the job', () => {
  const { state, job } = enqueue(emptyHarness(), 'storage-screening', INPUT, { ...DEFAULT_BUDGET, maxTiles: 10 }, NOW);
  const started = start(state, job.id, NOW);
  const busted = heartbeat(started, job.id, { tilesFetched: 1, tilesTotal: 25 }, SOON);
  const after = busted.jobs.find((j) => j.id === job.id);
  assert.equal(after.status, 'failed');
  assert.match(after.error, /tile budget/i);
});

test('a failed output is never published as succeeded', () => {
  const { state, job } = enqueue(emptyHarness(), 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  const started = start(state, job.id, NOW);
  const { state: after, ok, errors } = complete(started, job.id, goodOutput({ runId: '' }), LATER);
  assert.equal(ok, false);
  assert.ok(errors.length > 0);
  assert.equal(after.jobs.find((j) => j.id === job.id).status, 'failed');
  assert.ok(after.events.some((e) => e.kind === 'verification-failed'));
});

test('success claiming incomplete tiles fails verification', () => {
  const { state, job } = enqueue(emptyHarness(), 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  const started = start(state, job.id, NOW);
  const { ok, errors } = complete(started, job.id, goodOutput({ tilesFetched: 20, tilesTotal: 25 }), LATER);
  assert.equal(ok, false);
  assert.match(errors.join(' '), /missing tiles/i);
});

test('wrong method is rejected by the verifier, not trusted', () => {
  const { state, job } = enqueue(emptyHarness(), 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  const started = start(state, job.id, NOW);
  const { ok } = complete(started, job.id, goodOutput({ method: 'hand-waved-model' }), LATER);
  assert.equal(ok, false);
});

test('cancelled output cannot be published as succeeded', () => {
  const { state, job } = enqueue(emptyHarness(), 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  const started = start(state, job.id, NOW);
  const { ok, errors } = complete(started, job.id, goodOutput({ status: 'cancelled' }), LATER);
  assert.equal(ok, false);
  assert.match(errors.join(' '), /cancelled/i);
});

test('a valid verified output completes and supersedes the older run for the same input', () => {
  const first = enqueue(emptyHarness(), 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  const started1 = start(first.state, first.job.id, NOW);
  const done1 = complete(started1, first.job.id, goodOutput({ runId: 'run-1' }), LATER);
  assert.equal(done1.ok, true);
  const second = enqueue(done1.state, 'storage-screening', INPUT, DEFAULT_BUDGET, LATER);
  const started2 = start(second.state, second.job.id, LATER);
  const done2 = complete(started2, second.job.id, goodOutput({ runId: 'run-2' }), LATER);
  assert.equal(done2.ok, true);
  const old = done2.state.jobs.find((j) => j.id === first.job.id);
  assert.equal(old.supersededBy, second.job.id);
  assert.equal(old.status, 'succeeded'); // retained, marked, not deleted
  assert.ok(done2.state.events.some((e) => e.kind === 'verified'));
});

test('recoverStale requeues a stale running job, then fails it when attempts are exhausted', () => {
  const { state, job } = enqueue(emptyHarness(), 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  const started = start(state, job.id, NOW);
  const stale = () => new Date(NOW.getTime() + 999_999);
  const stale1 = recoverStale(started, stale(), 120_000);
  assert.equal(stale1.jobs.find((j) => j.id === job.id).status, 'queued');
  assert.equal(stale1.jobs.find((j) => j.id === job.id).attempts, 1);
  const started2 = start(stale1, job.id, LATER);
  const stale2 = recoverStale(started2, stale(), 120_000);
  assert.equal(stale2.jobs.find((j) => j.id === job.id).status, 'queued');
  assert.equal(stale2.jobs.find((j) => j.id === job.id).attempts, 2);
  const started3 = start(stale2, job.id, LATER);
  const stale3 = recoverStale(started3, stale(), 120_000);
  const after = stale3.jobs.find((j) => j.id === job.id);
  assert.equal(after.status, 'failed');
  assert.equal(after.attempts, 3);
});

test('loadJobs discards corrupted caches instead of interpreting them', () => {
  assert.deepEqual(loadJobs({ getItem: () => '{not json' }, 'k'), { jobs: [], events: [] });
  assert.deepEqual(loadJobs({ getItem: () => '{"jobs": [{"not": "a job"}], "events": []}' }, 'k'), { jobs: [], events: [] });
  assert.deepEqual(loadJobs({ getItem: () => null }, 'k'), { jobs: [], events: [] });
});

test('saveJobs/loadJobs roundtrip preserves jobs and events', () => {
  const store = memStore();
  const { state, job } = enqueue(emptyHarness(), 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  assert.equal(saveJobs(store, 'terrascope.harness.v1', state), true);
  const restored = loadJobs(store, 'terrascope.harness.v1');
  assert.equal(restored.jobs.length, 1);
  assert.equal(restored.jobs[0].id, job.id);
  assert.ok(restored.events.length >= 1);
});

test('fail and cancel move open jobs to terminal states with reasons', () => {
  const { state, job } = enqueue(emptyHarness(), 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  const started = start(state, job.id, NOW);
  const failed = fail(started, job.id, 'terrain tile 12 unavailable', LATER);
  assert.equal(failed.jobs.find((j) => j.id === job.id).status, 'failed');
  const { state: state2, job: job2 } = enqueue(emptyHarness(), 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  const cancelled = cancel(state2, job2.id, NOW);
  assert.equal(cancelled.jobs.find((j) => j.id === job2.id).status, 'cancelled');
});

test('a cancelled job does not block re-enqueue of the same input', () => {
  const { state, job } = enqueue(emptyHarness(), 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  const cancelled = cancel(state, job.id, NOW);
  const again = enqueue(cancelled, 'storage-screening', INPUT, DEFAULT_BUDGET, LATER);
  assert.equal(again.created, true);
});

test('summarizeHarness counts terminal states', () => {
  let state = emptyHarness();
  const a = enqueue(state, 'storage-screening', INPUT, DEFAULT_BUDGET, NOW);
  state = a.state;
  const b = enqueue(state, 'storage-screening', { ...INPUT, lat: 25.9 }, DEFAULT_BUDGET, NOW);
  state = cancel(b.state, b.job.id, NOW);
  state = complete(start(state, a.job.id, NOW), a.job.id, goodOutput(), LATER).state;
  const summary = summarizeHarness(state);
  assert.equal(summary.total, 2);
  assert.equal(summary.cancelled, 1);
  assert.equal(summary.succeeded, 1);
});

test('verifyJobOutput rejects missing outputs and nonsense totals', () => {
  assert.deepEqual(verifyJobOutput(undefined).ok, false);
  assert.equal(verifyJobOutput(goodOutput({ tilesTotal: 0 })).ok, false);
  assert.equal(verifyJobOutput(goodOutput()).ok, true);
});
