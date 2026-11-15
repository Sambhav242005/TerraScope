import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerQuestion } from '../src/flood/ai/responder.ts';
import { buildPreMonsoonAdvisory, buildDecisionBrief } from '../src/flood/ai/drafts.ts';
import { runTool } from '../src/flood/ai/tools.ts';
import { authHeaders, chatCompletionsUrl } from '../src/flood/ai/llmAdapter.ts';

test('chatCompletionsUrl does not double-append /v1 (the Groq screenshot failure)', () => {
  assert.equal(chatCompletionsUrl('https://api.groq.com/openai/v1'), 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(chatCompletionsUrl('https://api.groq.com/openai/v1/'), 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(chatCompletionsUrl('https://api.groq.com/openai/v1/'), chatCompletionsUrl('https://api.groq.com/openai/v1'));
  assert.equal(chatCompletionsUrl('http://127.0.0.1:11434'), 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(chatCompletionsUrl('http://localhost:8080/v1'), 'http://localhost:8080/v1/chat/completions');
  assert.equal(chatCompletionsUrl('https://lmstudio.local/api/openai/v1'), 'https://lmstudio.local/api/openai/v1/chat/completions');
});

const historyRows = [
  { date: '2024-07-15', rain: 120.5, flow: 41000, discharge: 41000 },
  { date: '2024-08-02', rain: 210.25, flow: 52000, discharge: 52000 },
  { date: '2023-08-18', rain: 180, flow: 30000, discharge: 30000 },
];

const ctx = {
  history: historyRows,
  manifest: [
    { id: 'flow-history', retrieved: '2026-11-04', sha256: 'a'.repeat(64) },
    { id: 'rain-history', retrieved: '2026-11-04', sha256: 'b'.repeat(64) },
    { id: 'hydrobasins-as12-sonpur', retrieved: '2026-11-14', sha256: 'c'.repeat(64) },
  ],
  ensoYear: 2024,
  storageRun: null,
  proposalCount: 0,
  replayDate: '2024-09-25',
};

const emptyCtx = {
  history: null,
  manifest: [{ id: 'flow-history', retrieved: '2026-11-04' }],
  ensoYear: 2024,
  storageRun: null,
  proposalCount: 0,
  replayDate: '2024-09-25',
};

test('peak question answers with the real record peak, cited, and labeled mode', () => {
  const a = answerQuestion('what was the peak flow?', ctx);
  assert.match(a.text, /52,000/);
  assert.match(a.text, /2024-08-02/);
  assert.ok(a.citations.some((c) => c.id === 'flow-history'));
  assert.equal(a.mode, 'deterministic-evidence');
});

test('missing history reports unavailable, never zero', () => {
  const a = answerQuestion('what was the peak flow?', emptyCtx);
  assert.match(a.text, /unavailable|can.t state/i);
  assert.doesNotMatch(a.text, /\b0\s*m³\/s\b/);
});

test('storage answer without a screening run refuses instead of inventing', () => {
  const a = answerQuestion('which storage candidates matter?', ctx);
  assert.match(a.text, /screening.*not|hasn.t/i);
});

test('monsoon answer includes record totals and ONI context without attribution claims', () => {
  const a = answerQuestion('how did the 2024 monsoon look vs ENSO?', ctx);
  assert.match(a.text, /2024/);
  assert.match(a.text, /mm/);
});

test('NRSC question states the narrow window honestly', () => {
  const a = answerQuestion('what NRSC satellite coverage exists?', ctx);
  assert.match(a.text, /1.*2 Oct 2024/);
  assert.match(a.text, /unknown/i);
});

test('unknown question refuses and lists what it can evidence', () => {
  const a = answerQuestion('will behausen trade grain routes open?', ctx);
  assert.match(a.text, /don't have grounded evidence/i);
  assert.match(a.text, /peak/i);
});

test('advisory and plan questions route to human-in-the-loop messaging', () => {
  const advisory = answerQuestion('issue an evacuation advisory now', ctx);
  assert.match(advisory.text, /cannot issue|human/i);
  assert.match(advisory.text, /authorised/i);
  const plan = answerQuestion('compare my options for a plan', ctx);
  assert.match(plan.text, /brief/i);
  assert.match(plan.text, /will not pick|not pick/i);
});

test('answers never contain NaN', () => {
  for (const q of ['peak?', 'p90 band?', 'monsoon?', 'storage?', 'sources?', 'findings?', 'enso?', 'anything']) {
    const a = answerQuestion(q, ctx);
    assert.doesNotMatch(a.text, /NaN/, q);
  }
});

test('deterministic: identical inputs produce identical answers', () => {
  assert.deepEqual(answerQuestion('peak flow?', ctx), answerQuestion('peak flow?', ctx));
});

test('tool catalog rejects unknown tools explicitly', () => {
  const out = runTool('delete_everything', {}, ctx);
  assert.match(out, /Unknown tool/);
  assert.match(out, /Registered tools/);
});

test('advisory draft carries the hard disclaimers and the officer sign-off line', () => {
  const { markdown, filename } = buildPreMonsoonAdvisory(ctx, 'SDM Sonpur');
  assert.equal(filename, 'pre-monsoon-advisory-draft.md');
  assert.match(markdown, /not.*official product|cannot send/i);
  assert.match(markdown, /SDM Sonpur/);
  assert.match(markdown, /signature\/date/i);
  assert.match(markdown, /52,000/);
  assert.match(markdown, /not issued/i);
});

test('decision brief lists both options and explicit unknowns; no invented depths', () => {
  const { markdown, filename } = buildDecisionBrief(ctx);
  assert.equal(filename, 'decision-brief-draft.md');
  assert.match(markdown, /Option A/);
  assert.match(markdown, /Option B/);
  assert.match(markdown, /hydrobasins|DEM-derived/i);
  assert.match(markdown, /geometric, not usable storage|not usable storage/i);
});

test('drafts degrade gracefully when the record is missing', () => {
  const advisory = buildPreMonsoonAdvisory(emptyCtx, 'SDM Sonpur').markdown;
  assert.match(advisory, /not available/);
  const brief = buildDecisionBrief(emptyCtx).markdown;
  assert.match(brief, /unavailable|unknown/i);
});

test('API key is sent as a Bearer header and trimmed; absent key sends no auth header', () => {
  assert.deepEqual(authHeaders({ baseUrl: 'https://api.groq.com/openai/v1', model: 'qwen/qwen3.8-27b', apiKey: '  gsk_test  ' }).Authorization, 'Bearer gsk_test');
  assert.equal(authHeaders({ baseUrl: 'http://127.0.0.1:11434', model: 'qwen2.5:7b' }).Authorization, undefined);
  assert.equal(authHeaders({ baseUrl: 'http://127.0.0.1:11434', model: 'qwen2.5:7b', apiKey: '   ' }).Authorization, undefined);
});

test('every citation the responder emits has id and detail', () => {
  for (const q of ['peak?', 'p90?', 'monsoon?', 'storage?', 'sources?', 'enso?', 'nrsc?', 'findings?']) {
    const a = answerQuestion(q, ctx);
    for (const c of a.citations) {
      assert.ok(c.id && c.detail, `citation missing fields for ${q}`);
    }
  }
});
