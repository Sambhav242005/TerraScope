import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ConfigError,
  parseArgs,
  chatCompletionsUrl,
  validateToolArgs,
  classifyReply,
  percentile,
  summarizeSamples,
  computeGates,
  redactSecrets,
  runBench,
  writeReportRedacted,
  checkCatalogDrift,
  GATE_TOOL_CALL_VALID,
  SHAPES,
  CATALOG_SNAPSHOT,
} from '../scripts/bench-local-model.mjs';

// --- synthetic fixture server (no network, ephemeral port) -------------------
function makeFixture(handler) {
  const fixture = {
    server: null,
    url: null,
    requests: [],
    mode: 'perfect',
    close() {
      return new Promise((resolveClose) => fixture.server.close(resolveClose));
    },
  };
  fixture.server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      let parsed = null;
      try { parsed = JSON.parse(body); } catch { /* keep null */ }
      fixture.requests.push(parsed);
      handler(parsed, fixture, res);
    });
  });
  return fixture;
}

function listen(fixture) {
  return new Promise((resolveListen) => {
    fixture.server.listen(0, '127.0.0.1', () => {
      fixture.url = `http://127.0.0.1:${fixture.server.address().port}`;
      resolveListen(fixture);
    });
  });
}

const sendJson = (res, status, obj) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};

/** Perfect-answer fixture: emits a correct tool call for whichever shape was asked. */
function perfectReply(body) {
  const user = body?.messages?.find((m) => m.role === 'user')?.content ?? '';
  let name = null;
  let args = {};
  if (user.includes('peak_discharge')) {
    name = 'peak_discharge';
    args = {};
  } else if (user.includes('storage_candidates')) {
    name = 'storage_candidates';
    const m = user.match(/limit (\d+)/);
    args = { limit: m ? Number(m[1]) : 5 };
  } else if (user.includes('storage_detail')) {
    name = 'storage_detail';
    args = { id: 'ST-0001' };
  } else if (user.includes('enso_context')) {
    name = 'enso_context';
    const m = user.match(/year (\d+)/);
    args = { year: m ? Number(m[1]) : 2024 };
  }
  return { name, args };
}

function toolCallResponse(name, args) {
  return {
    choices: [
      { message: { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] } },
    ],
    usage: { prompt_tokens: 120, completion_tokens: 25 },
  };
}

function streamPerfect(res, body) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  const chunk = (delta, usage) => `data: ${JSON.stringify({ choices: [{ delta }], ...(usage ? { usage } : {}) })}\n\n`;
  res.write(chunk({ role: 'assistant' }));
  if (!Array.isArray(body?.tools)) {
    // First-token probe (no tools attached): emit a plain content delta.
    res.write(chunk({ content: 'ready' }));
  } else {
    const { name, args } = perfectReply(body);
    if (name) res.write(chunk({ tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] }));
  }
  res.write(chunk({}, { prompt_tokens: 120, completion_tokens: 25 }));
  res.write('data: [DONE]\n\n');
  res.end();
}

function makeStandardFixture() {
  return makeFixture((body, fixture, res) => {
    if (body?.stream === true) {
      if (fixture.mode === 'stream-unsupported') {
        sendJson(res, 400, { error: { message: 'stream not supported' } });
        return;
      }
      if (fixture.mode === 'slow') {
        setTimeout(() => streamPerfect(res, body), 300);
        return;
      }
      streamPerfect(res, body);
      return;
    }
    switch (fixture.mode) {
      case 'perfect': {
        const { name, args } = perfectReply(body);
        sendJson(res, 200, toolCallResponse(name, args));
        return;
      }
      case 'perfect-no-usage': {
        const { name, args } = perfectReply(body);
        const out = toolCallResponse(name, args);
        delete out.usage;
        sendJson(res, 200, out);
        return;
      }
      case 'always-peak': {
        sendJson(res, 200, toolCallResponse('peak_discharge', {}));
        return;
      }
      case 'unknown-tool': {
        sendJson(res, 200, toolCallResponse('flood_forecaster', {}));
        return;
      }
      case 'bad-limit': {
        const user = body?.messages?.find((m) => m.role === 'user')?.content ?? '';
        if (user.includes('storage_candidates')) {
          sendJson(res, 200, toolCallResponse('storage_candidates', { limit: 99 }));
          return;
        }
        const { name, args } = perfectReply(body);
        sendJson(res, 200, toolCallResponse(name, args));
        return;
      }
      case 'prose': {
        sendJson(res, 200, { choices: [{ message: { role: 'assistant', content: 'The peak was 12,646 m³/s in the local record.' } }], usage: { prompt_tokens: 100, completion_tokens: 12 } });
        return;
      }
      case 'non-json-args': {
        sendJson(res, 200, { choices: [{ message: { role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'peak_discharge', arguments: '{not json' } }] } }] });
        return;
      }
      case 'http-500': {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('boom');
        return;
      }
      case 'reps-500-after-probe': {
        // Probe (single "ping" message, no tools, max_tokens 1) succeeds; every benchmark rep 500s.
        const isProbe = Array.isArray(body?.messages) && body.messages.length === 1 && body.messages[0]?.content === 'ping' && !Array.isArray(body?.tools);
        if (isProbe) {
          sendJson(res, 200, { choices: [{ message: { role: 'assistant', content: 'pong' } }] });
          return;
        }
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('boom');
        return;
      }
      case 'slow': {
        setTimeout(() => {
          const { name, args } = perfectReply(body);
          sendJson(res, 200, toolCallResponse(name, args));
        }, 300);
        return;
      }
      case 'malformed-envelope': {
        sendJson(res, 200, { unexpected: true });
        return;
      }
      default:
        sendJson(res, 500, { error: { message: `unknown fixture mode ${fixture.mode}` } });
    }
  });
}

let workDir;
before(() => {
  workDir = mkdtempSync(join(tmpdir(), 'bench-local-model-'));
});
after(() => {
  rmSync(workDir, { recursive: true, force: true });
});

// --- parseArgs ---------------------------------------------------------------
test('parseArgs requires --model', () => {
  assert.throws(() => parseArgs([], {}), ConfigError);
});

test('parseArgs applies defaults and a timestamped out path', () => {
  const args = parseArgs(['--model', 'qwen2.5:7b-instruct'], {});
  assert.equal(args.base, 'http://127.0.0.1:11434');
  assert.equal(args.reps, 50);
  assert.equal(args.apiKeyEnv, null);
  assert.match(args.out, /^artifacts\/bench-local-model-\d{4}-\d{2}-\d{2}T/);
});

test('parseArgs rejects non-integer, zero, and out-of-range --reps', () => {
  for (const bad of ['abc', '0', '-3', '2.5', '1001']) {
    assert.throws(() => parseArgs(['--model', 'm', '--reps', bad], {}), ConfigError, `reps=${bad}`);
  }
});

test('parseArgs rejects non-http --base and unparseable URLs', () => {
  assert.throws(() => parseArgs(['--model', 'm', '--base', 'ftp://example.com'], {}), ConfigError);
  assert.throws(() => parseArgs(['--model', 'm', '--base', 'not a url'], {}), ConfigError);
});

test('parseArgs rejects unknown flags', () => {
  assert.throws(() => parseArgs(['--model', 'm', '--frobnicate'], {}), ConfigError);
});

test('parseArgs --api-key-env fails when the variable is missing or empty', () => {
  assert.throws(() => parseArgs(['--model', 'm', '--api-key-env', 'MY_KEY'], {}), ConfigError);
  assert.throws(() => parseArgs(['--model', 'm', '--api-key-env', 'MY_KEY'], { MY_KEY: '   ' }), ConfigError);
  const ok = parseArgs(['--model', 'm', '--api-key-env', 'MY_KEY'], { MY_KEY: 'secret-value' });
  assert.equal(ok.apiKeyEnv, 'MY_KEY');
});

test('parseArgs --api-key-env rejects invalid env var names', () => {
  assert.throws(() => parseArgs(['--model', 'm', '--api-key-env', '1BAD;NAME'], { '1BAD;NAME': 'x' }), ConfigError);
});

test('chatCompletionsUrl mirrors the app adapter semantics', () => {
  assert.equal(chatCompletionsUrl('http://127.0.0.1:11434'), 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(chatCompletionsUrl('http://127.0.0.1:11434/'), 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(chatCompletionsUrl('https://api.groq.com/openai/v1'), 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(chatCompletionsUrl('https://api.groq.com/openai/v1/'), 'https://api.groq.com/openai/v1/chat/completions');
});

// --- tiny schema validator ---------------------------------------------------
test('validateToolArgs accepts the empty object for no-arg tools', () => {
  const schema = CATALOG_SNAPSHOT.find((t) => t.name === 'peak_discharge').parameters;
  assert.equal(validateToolArgs(schema, {}).ok, true);
});

test('validateToolArgs enforces integer type and 1–10 range for storage_candidates.limit', () => {
  const schema = CATALOG_SNAPSHOT.find((t) => t.name === 'storage_candidates').parameters;
  assert.equal(validateToolArgs(schema, { limit: 5 }).ok, true);
  for (const bad of [0, 11, 1.5, '5', null]) {
    assert.equal(validateToolArgs(schema, { limit: bad }).ok, false, `limit=${JSON.stringify(bad)}`);
  }
});

test('validateToolArgs requires the storage_detail id string', () => {
  const schema = CATALOG_SNAPSHOT.find((t) => t.name === 'storage_detail').parameters;
  assert.equal(validateToolArgs(schema, { id: 'ST-0001' }).ok, true);
  assert.equal(validateToolArgs(schema, {}).ok, false);
  assert.equal(validateToolArgs(schema, { id: 42 }).ok, false);
});

test('validateToolArgs enforces integer year for enso_context and tolerates extra properties', () => {
  const schema = CATALOG_SNAPSHOT.find((t) => t.name === 'enso_context').parameters;
  assert.equal(validateToolArgs(schema, { year: 2024 }).ok, true);
  assert.equal(validateToolArgs(schema, { year: 20.5 }).ok, false);
  assert.equal(validateToolArgs(schema, { year: '2024' }).ok, false);
  assert.equal(validateToolArgs(schema, { year: 2024, extra: 'tolerated' }).ok, true);
});

test('validateToolArgs rejects non-object arguments', () => {
  assert.equal(validateToolArgs({ type: 'object', properties: {}, required: [] }, null).ok, false);
  assert.equal(validateToolArgs({ type: 'object', properties: {}, required: [] }, [1]).ok, false);
});

// --- response classification --------------------------------------------------
const msgWithCalls = (name, argumentsText) => ({
  role: 'assistant',
  content: '',
  tool_calls: [{ id: 'c1', type: 'function', function: { name, arguments: argumentsText } }],
});

test('classifyReply: registry-valid expected call', () => {
  const out = classifyReply(msgWithCalls('peak_discharge', '{}'), 'peak_discharge');
  assert.equal(out.classification, 'registry-valid');
  assert.equal(out.registryAcceptable, true);
  assert.equal(out.semanticMatch, true);
});

test('classifyReply: catalog tool with valid args but wrong tool is wrong-tool, still registry-acceptable', () => {
  const out = classifyReply(msgWithCalls('peak_discharge', '{}'), 'enso_context');
  assert.equal(out.classification, 'wrong-tool');
  assert.equal(out.registryAcceptable, true);
  assert.equal(out.semanticMatch, false);
});

test('classifyReply: hallucinated tool name is unknown-tool', () => {
  const out = classifyReply(msgWithCalls('flood_forecaster', '{}'), 'peak_discharge');
  assert.equal(out.classification, 'unknown-tool');
  assert.equal(out.registryAcceptable, false);
  assert.equal(out.unknownTool, true);
});

test('classifyReply: schema-invalid args are wrong-args', () => {
  const out = classifyReply(msgWithCalls('storage_candidates', '{"limit": 99}'), 'storage_candidates');
  assert.equal(out.classification, 'wrong-args');
  assert.equal(out.registryAcceptable, false);
});

test('classifyReply: unparseable arguments JSON is non-JSON', () => {
  const out = classifyReply(msgWithCalls('peak_discharge', '{oops'), 'peak_discharge');
  assert.equal(out.classification, 'non-JSON');
  assert.equal(out.registryAcceptable, false);
});

test('classifyReply: arguments parsed but not an object is non-JSON', () => {
  const out = classifyReply(msgWithCalls('peak_discharge', '[1,2]'), 'peak_discharge');
  assert.equal(out.classification, 'non-JSON');
});

test('classifyReply: plain prose with no calls is prose-only, empty content included', () => {
  assert.equal(classifyReply({ role: 'assistant', content: 'The peak was high.' }, 'peak_discharge').classification, 'prose-only');
  assert.equal(classifyReply({ role: 'assistant', content: '' }, 'peak_discharge').classification, 'prose-only');
});

test('classifyReply: raw JSON tool call in content is accepted with viaContent flag', () => {
  const out = classifyReply({ role: 'assistant', content: '{"name": "peak_discharge", "arguments": {}}' }, 'peak_discharge');
  assert.equal(out.classification, 'registry-valid');
  assert.equal(out.viaContent, true);
});

test('classifyReply: JSON-like content that is not parseable is non-JSON', () => {
  const out = classifyReply({ role: 'assistant', content: '{not valid json at all' }, 'peak_discharge');
  assert.equal(out.classification, 'non-JSON');
});

// --- statistics and gates -----------------------------------------------------
test('percentile uses nearest-rank, mean averages', () => {
  const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.equal(percentile(values, 95), 100);
  assert.equal(percentile(values, 50), 50);
  assert.equal(percentile([], 95), null);
});

test('computeGates passes at exactly the thresholds and fails just below', () => {
  const pass = computeGates({ toolCallValidRate: GATE_TOOL_CALL_VALID, parseFailureRate: 0.05, unknownToolRate: 0.02 });
  assert.equal(pass.allPass, true);
  const fail = computeGates({ toolCallValidRate: 0.8999, parseFailureRate: 0.05, unknownToolRate: 0.02 });
  assert.equal(fail.allPass, false);
  const failParse = computeGates({ toolCallValidRate: 1, parseFailureRate: 0.0501, unknownToolRate: 0 });
  assert.equal(failParse.allPass, false);
  const failUnknown = computeGates({ toolCallValidRate: 1, parseFailureRate: 0, unknownToolRate: 0.0201 });
  assert.equal(failUnknown.allPass, false);
});

test('summarizeSamples computes rates per classification bucket', () => {
  const samples = [
    ...Array.from({ length: 9 }, () => ({ classification: 'registry-valid', registryAcceptable: true, semanticMatch: true, unknownTool: false, latencyMs: 100 })),
    { classification: 'unknown-tool', registryAcceptable: false, semanticMatch: false, unknownTool: true, latencyMs: 200 },
  ];
  const s = summarizeSamples(samples);
  assert.equal(s.reps, 10);
  assert.equal(s.toolCallValidRate, 0.9);
  assert.equal(s.unknownToolRate, 0.1);
  assert.equal(s.meanLatencyMs, 110);
  assert.equal(s.p95LatencyMs, 200);
});

// --- redaction -----------------------------------------------------------------
test('redactSecrets removes exact keys, Bearer tokens and prefixed keys', () => {
  const secret = 'gsk_testsecret1234567890';
  const input = `Authorization: Bearer ${secret}; again ${secret} and gsk_otherkey987654321`;
  const { text, redactions } = redactSecrets(input, [secret]);
  assert.ok(!text.includes(secret));
  assert.ok(!text.includes('gsk_otherkey987654321'));
  assert.ok(redactions >= 3);
});

test('writeReportRedacted never persists the key, even if the endpoint echoes it', () => {
  const secret = 'gsk_echoedsecretabcdef123456';
  const outPath = join(workDir, 'echo-report.json');
  const report = { probe: { ok: true, detail: `server echoed ${secret} back` }, nested: { list: [secret] } };
  const result = writeReportRedacted(report, outPath, [secret]);
  const onDisk = readFileSync(result.path, 'utf8');
  assert.ok(!onDisk.includes(secret), 'key must not be on disk');
  assert.ok(result.redactions >= 2);
  const reparsed = JSON.parse(onDisk);
  assert.ok(reparsed.outputRedactions >= 2);
});

// --- drift check -----------------------------------------------------------------
test('checkCatalogDrift verifies against the repo source without executing it', () => {
  const drift = checkCatalogDrift(join(process.cwd()));
  assert.equal(drift.status, 'checked');
  assert.equal(drift.driftDetected, false, drift.detail);
  const missing = checkCatalogDrift(join(workDir, 'does-not-exist'));
  assert.equal(missing.status, 'not-verified');
  assert.equal(missing.driftDetected, null);
});

test('checkCatalogDrift reports drift when a fake source drops a schema field', () => {
  const fakeRoot = join(workDir, 'fake-repo');
  const fakeToolsDir = join(fakeRoot, 'src', 'flood', 'ai');
  mkdirSync(fakeToolsDir, { recursive: true });
  writeFileSync(
    join(fakeToolsDir, 'tools.ts'),
    'export const TOOL_CATALOG = [\n  { name: "peak_discharge", description: "Peak daily GloFAS-modeled discharge and date for the 2015–2024 record", parameters: { type: "object", properties: {}, required: [] } },\n] as const;\n',
    'utf8',
  );
  const drift = checkCatalogDrift(fakeRoot);
  assert.equal(drift.status, 'checked');
  assert.equal(drift.driftDetected, true);
  assert.match(drift.detail, /missing tools/i);
});

// --- end-to-end against the fixture ---------------------------------------------
async function withFixture(mode, fn) {
  const fixture = makeStandardFixture();
  fixture.mode = mode;
  await listen(fixture);
  try {
    return await fn(fixture);
  } finally {
    await fixture.close();
  }
}

test('perfect endpoint passes all gates and the report is written without the key', async () => {
  await withFixture('perfect', async (fixture) => {
    const outPath = join(workDir, 'perfect.json');
    const secret = 'gsk_fixturepattern1234567890';
    const { report, exitCode } = await runBench({ base: fixture.url, model: 'fixture-7b', reps: 5, apiKey: secret, apiKeyEnv: 'FIXTURE_KEY', repoRoot: process.cwd() });
    assert.equal(exitCode, 0);
    assert.equal(report.verdict, 'PASS');
    assert.equal(report.overall.reps, 20);
    assert.equal(report.overall.toolCallValidRate, 1);
    assert.equal(report.overall.unknownToolRate, 0);
    assert.equal(report.gates.allPass, true);
    assert.equal(report.usage.status, 'measured');
    assert.ok(report.usage.approxCompletionTokPerSec > 0);
    assert.equal(report.firstToken.status, 'measured');
    assert.equal(report.scopeNote.includes('NOT local inference'), true);
    const written = writeReportRedacted(report, outPath, [secret]);
    const onDisk = readFileSync(written.path, 'utf8');
    assert.ok(!onDisk.includes(secret));
    const parsed = JSON.parse(onDisk);
    assert.equal(parsed.config.apiKeyPresent, true);
    assert.equal(parsed.config.apiKeyEnv, 'FIXTURE_KEY');
    assert.ok(!JSON.stringify(parsed).includes(secret));
  });
});

test('fixture that names a hallucinated tool fails the unknown-tool gate', async () => {
  await withFixture('unknown-tool', async (fixture) => {
    const { report, exitCode } = await runBench({ base: fixture.url, model: 'fixture-7b', reps: 3, repoRoot: process.cwd() });
    assert.equal(exitCode, 1);
    assert.equal(report.verdict, 'FAIL');
    assert.equal(report.overall.unknownToolRate, 1);
    assert.equal(report.gates.unknownToolRate.pass, false);
  });
});

test('fixture returning out-of-range limit args yields wrong-args and a FAIL gate', async () => {
  await withFixture('bad-limit', async (fixture) => {
    const { report, exitCode } = await runBench({ base: fixture.url, model: 'fixture-7b', reps: 3, repoRoot: process.cwd() });
    assert.equal(exitCode, 1);
    const storage = report.shapes.find((s) => s.id === 'storage_candidates');
    assert.equal(storage.counts['wrong-args'], 3);
    assert.equal(report.overall.counts['wrong-args'], 3);
  });
});

test('fixture answering only prose fails tool-call-valid without counting as parse failure', async () => {
  await withFixture('prose', async (fixture) => {
    const { report, exitCode } = await runBench({ base: fixture.url, model: 'fixture-7b', reps: 2, repoRoot: process.cwd() });
    assert.equal(exitCode, 1);
    assert.equal(report.overall.toolCallValidRate, 0);
    assert.equal(report.overall.parseFailureRate, 0);
    assert.equal(report.overall.counts['prose-only'], 8);
  });
});

test('fixture answering HTTP 500 on the probe fails closed with exit-code 2 semantics', async () => {
  await withFixture('http-500', async (fixture) => {
    const { report, exitCode } = await runBench({ base: fixture.url, model: 'fixture-7b', reps: 2, repoRoot: process.cwd() });
    assert.equal(exitCode, 2);
    assert.equal(report.probe.ok, false);
    assert.equal(report.verdict, 'FAIL');
  });
});

test('endpoint that passes the probe but 500s the benchmark reps classifies error and exits 1', async () => {
  await withFixture('reps-500-after-probe', async (fixture) => {
    const { report, exitCode } = await runBench({ base: fixture.url, model: 'fixture-7b', reps: 2, repoRoot: process.cwd() });
    assert.equal(exitCode, 1);
    assert.equal(report.overall.counts.error, 8);
    assert.equal(report.overall.counts.timeout ?? 0, 0);
  });
});

test('slow fixture with a rep timeout classifies timeout reps', async () => {
  await withFixture('slow', async (fixture) => {
    const { report, exitCode } = await runBench({ base: fixture.url, model: 'fixture-7b', reps: 2, repTimeoutMs: 60, repoRoot: process.cwd() });
    assert.equal(exitCode, 1);
    assert.equal(report.overall.counts.timeout, 8);
  });
});

test('unparseable arguments JSON classifies non-JSON and trips the parse-failure gate', async () => {
  await withFixture('non-json-args', async (fixture) => {
    const { report, exitCode } = await runBench({ base: fixture.url, model: 'fixture-7b', reps: 2, repoRoot: process.cwd() });
    assert.equal(exitCode, 1);
    assert.equal(report.overall.parseFailureRate, 1);
    assert.equal(report.gates.parseFailureRate.pass, false);
  });
});

test('endpoint without usage reports usage as not-measured, never fabricates tok/s', async () => {
  await withFixture('perfect-no-usage', async (fixture) => {
    const { report } = await runBench({ base: fixture.url, model: 'fixture-7b', reps: 2, repoRoot: process.cwd() });
    assert.equal(report.usage.status, 'not-measured');
    assert.equal(report.usage.approxCompletionTokPerSec, null);
  });
});

test('endpoint without stream support reports first-token as not-measured with a reason', async () => {
  await withFixture('stream-unsupported', async (fixture) => {
    const { report } = await runBench({ base: fixture.url, model: 'fixture-7b', reps: 2, repoRoot: process.cwd() });
    assert.equal(report.firstToken.status, 'not-measured');
    assert.ok(report.firstToken.reason.length > 0);
  });
});

test('unreachable endpoint fails at probe with exit-code 2 semantics', async () => {
  const fixture = makeFixture(() => {});
  await listen(fixture);
  const closedUrl = fixture.url;
  await fixture.close();
  const { report, exitCode } = await runBench({ base: closedUrl, model: 'fixture-7b', reps: 2, repTimeoutMs: 500, repoRoot: process.cwd() });
  assert.equal(exitCode, 2);
  assert.equal(report.probe.ok, false);
  assert.equal(report.verdict, 'FAIL');
  assert.match(report.verdictLabel, /endpoint unreachable/i);
});

test('fixture that always answers peak_discharge keeps the gate green but reports wrong-tool rate honestly', async () => {
  await withFixture('always-peak', async (fixture) => {
    const { report, exitCode } = await runBench({ base: fixture.url, model: 'fixture-7b', reps: 3, repoRoot: process.cwd() });
    assert.equal(exitCode, 0);
    assert.equal(report.overall.toolCallValidRate, 1); // registry would accept every call
    assert.ok(report.overall.wrongToolRate > 0.5); // 3 of 4 shapes answer the wrong tool
    assert.equal(report.overall.semanticMatchRate, 0.25);
  });
});

test('malformed response envelope classifies error without crashing the run', async () => {
  await withFixture('malformed-envelope', async (fixture) => {
    const { report, exitCode } = await runBench({ base: fixture.url, model: 'fixture-7b', reps: 2, repoRoot: process.cwd() });
    assert.equal(exitCode, 1);
    assert.equal(report.overall.counts.error, 8);
  });
});

test('report always carries the scope note, caveats and refusal list', async () => {
  await withFixture('perfect', async (fixture) => {
    const { report } = await runBench({ base: fixture.url, model: 'fixture-7b', reps: 1, repoRoot: process.cwd() });
    assert.match(report.scopeNote, /NOT local inference/i);
    assert.ok(report.caveats.length >= 5);
    assert.ok(report.refusals.some((r) => /Groq/i.test(r)));
    assert.equal(report.schema, 'terrascope-local-model-bench/v1');
    assert.equal(report.catalog.source, 'embedded-snapshot');
    assert.equal(report.budgetAudit.toolCallsPerRep, 1);
  });
});

test('SHAPES matrix matches the four gating shapes from the F analysis', () => {
  assert.deepEqual(
    SHAPES.map((s) => s.id),
    ['peak_discharge', 'storage_candidates', 'storage_detail', 'enso_context'],
  );
});
