#!/usr/bin/env node
// TerraScope local-model benchmark runner (R02 / issue #2 support).
//
// Measures an OpenAI-compatible endpoint (Ollama / llama.cpp / LM Studio on this
// machine or an authorized LAN host) against TerraScope's tool catalog, using the
// same question templates every run. NO model is required to read this file, and
// the test suite injects a synthetic fixture server instead of a real model.
//
// What this is NOT: it does not install anything, does not produce numbers unless
// you point it at a real endpoint, and does not close issue #2 by itself. A
// cloud-hosted Qwen (e.g. via Groq) is NOT local inference and must not be
// reported as satisfying R02.
//
// Safety contract:
// - The only network calls are POST requests to the --base URL you give it, plus
//   (optionally) a streaming POST to the same URL for the first-token probe.
// - It never executes model output or downloaded code.
// - The API key is read from the env var named by --api-key-env, never from the
//   command line. It is never printed, never written to disk. The serialized
//   report is grepped for the key and for generic bearer/token patterns before
//   it is saved; any match is redacted and the read-back file is verified again.
// - It writes exactly one file: --out.
// - Exit codes: 0 = PASS (all gates green), 1 = FAIL (gates not met or endpoint
//   errors), 2 = configuration error (bad args, endpoint unreachable at probe).
//
// Determinism-ish: temperature 0, seed 42 (servers may ignore seed), fixed
// prompts, same questions every run. Rep ordering is sequential.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const BENCH_VERSION = "1.0.0";
export const SCHEMA_VERSION = "terrascope-local-model-bench/v1";
export const DEFAULT_BASE = "http://127.0.0.1:11434";
export const DEFAULT_REPS = 50;
export const MAX_REPS = 1000;
export const REP_TIMEOUT_MS = 45000;
export const PROBE_TIMEOUT_MS = 5000;
export const FIRST_TOKEN_TIMEOUT_MS = 15000;
export const SEED = 42;
export const TEMPERATURE = 0;
export const MAX_TOKENS_PER_REP = 512;

// Pre-registered acceptance gates (docs/local-model-benchmark.md §Gates).
export const GATE_TOOL_CALL_VALID = 0.9; // >=
export const GATE_PARSE_FAILURE = 0.05; // <=
export const GATE_UNKNOWN_TOOL = 0.02; // <=

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
    this.exitCode = 2;
  }
}

// ---------------------------------------------------------------------------
// Embedded snapshot of TOOL_CATALOG (src/flood/ai/tools.ts, 15 Nov 2026).
// The runner validates the model against this snapshot. It is compared against
// the repository source textually (no code is imported or executed); any drift
// is recorded in the report as catalog.driftDetected.
// ---------------------------------------------------------------------------
export const CATALOG_SNAPSHOT = [
  { name: "peak_discharge", description: "Peak daily GloFAS-modeled discharge and date for the 2015–2024 record", parameters: { type: "object", properties: {}, required: [] } },
  { name: "p90_band", description: "Descriptive top-10% discharge band over the 2015–2024 record", parameters: { type: "object", properties: {}, required: [] } },
  { name: "monsoon_analogs", description: "Jun–Sep rainfall 2022–2024 totals with ONI context", parameters: { type: "object", properties: {}, required: [] } },
  { name: "enso_context", description: "ONI (ASO) phase/anomaly for a year in the local table", parameters: { type: "object", properties: { year: { type: "integer" } }, required: [] } },
  { name: "storage_candidates", description: "Total and top-N geometric capacities from the terrain screening", parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 10 } }, required: [] } },
  { name: "storage_detail", description: "One candidate from the screening record by id", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "data_sources", description: "Datasets registered in the source manifest", parameters: { type: "object", properties: {}, required: [] } },
  { name: "nrsc_coverage", description: "Dates and bounds with observed NRSC flood imagery", parameters: { type: "object", properties: {}, required: [] } },
  { name: "current_findings", description: "Titles of the auto-derived findings currently shown in the workspace", parameters: { type: "object", properties: {}, required: [] } },
];

const normalize = (s) => String(s).replace(/\s+/g, " ").trim();

/** Exact (whitespace-normalized) text of the TOOL_CATALOG array literal, copied from src/flood/ai/tools.ts. */
const EMBEDDED_CATALOG_SOURCE = `[
  { name: "peak_discharge", description: "Peak daily GloFAS-modeled discharge and date for the 2015–2024 record", parameters: { type: "object", properties: {}, required: [] } },
  { name: "p90_band", description: "Descriptive top-10% discharge band over the 2015–2024 record", parameters: { type: "object", properties: {}, required: [] } },
  { name: "monsoon_analogs", description: "Jun–Sep rainfall 2022–2024 totals with ONI context", parameters: { type: "object", properties: {}, required: [] } },
  { name: "enso_context", description: "ONI (ASO) phase/anomaly for a year in the local table", parameters: { type: "object", properties: { year: { type: "integer" } }, required: [] } },
  { name: "storage_candidates", description: "Total and top-N geometric capacities from the terrain screening", parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 10 } }, required: [] } },
  { name: "storage_detail", description: "One candidate from the screening record by id", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "data_sources", description: "Datasets registered in the source manifest", parameters: { type: "object", properties: {}, required: [] } },
  { name: "nrsc_coverage", description: "Dates and bounds with observed NRSC flood imagery", parameters: { type: "object", properties: {}, required: [] } },
  { name: "current_findings", description: "Titles of the auto-derived findings currently shown in the workspace", parameters: { type: "object", properties: {}, required: [] } },
]`;

/** Textual (non-executing) drift check of CATALOG_SNAPSHOT vs the repo source. */
export function checkCatalogDrift(repoRoot) {
  try {
    const toolsPath = resolve(repoRoot, "src", "flood", "ai", "tools.ts");
    if (!existsSync(toolsPath)) {
      return { status: "not-verified", driftDetected: null, detail: `source not found at ${toolsPath}` };
    }
    const src = readFileSync(toolsPath, "utf8");
    const blockMatch = src.match(/export const TOOL_CATALOG = (\[[\s\S]*?\]) as const;/);
    if (!blockMatch) {
      return { status: "not-verified", driftDetected: null, detail: "TOOL_CATALOG block not found in source" };
    }
    const srcBlock = normalize(blockMatch[1]);
    const embedded = normalize(EMBEDDED_CATALOG_SOURCE);
    if (srcBlock === embedded) {
      return { status: "checked", driftDetected: false, detail: "embedded snapshot matches src/flood/ai/tools.ts (exact after whitespace normalization; no code executed)" };
    }
    const missingTools = CATALOG_SNAPSHOT.filter((t) => !srcBlock.includes(`name: "${t.name}"`)).map((t) => t.name);
    return {
      status: "checked",
      driftDetected: true,
      detail: `embedded snapshot differs from src/flood/ai/tools.ts (missing tools: ${missingTools.join(", ") || "none — schema/description text drifted"}). Update CATALOG_SNAPSHOT and EMBEDDED_CATALOG_SOURCE in scripts/bench-local-model.mjs before trusting gate results.`,
    };
  } catch (err) {
    return { status: "not-verified", driftDetected: null, detail: `drift check failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
export function parseArgs(argv, env = process.env) {
  const args = {
    base: DEFAULT_BASE,
    model: null,
    reps: DEFAULT_REPS,
    apiKeyEnv: null,
    out: null,
    help: false,
  };
  const takeValue = (i, flag) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new ConfigError(`${flag} requires a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--base":
        args.base = takeValue(i, "--base");
        i += 1;
        break;
      case "--model":
        args.model = takeValue(i, "--model").trim();
        i += 1;
        break;
      case "--reps": {
        const raw = takeValue(i, "--reps");
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > MAX_REPS) {
          throw new ConfigError(`--reps must be an integer between 1 and ${MAX_REPS} (got ${JSON.stringify(raw)})`);
        }
        args.reps = n;
        i += 1;
        break;
      }
      case "--api-key-env": {
        const name = takeValue(i, "--api-key-env").trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
          throw new ConfigError(`--api-key-env must be a valid environment variable name (got ${JSON.stringify(name)})`);
        }
        const key = env?.[name];
        if (!key || !String(key).trim()) {
          throw new ConfigError(`--api-key-env ${name}: environment variable is not set or is empty (refusing to guess a key)`);
        }
        args.apiKeyEnv = name;
        i += 1;
        break;
      }
      case "--out":
        args.out = takeValue(i, "--out");
        i += 1;
        break;
      default:
        throw new ConfigError(`unknown argument: ${a} (see --help)`);
    }
  }
  if (args.help) return args;
  if (!args.model) throw new ConfigError("--model is required (e.g. --model qwen2.5:7b-instruct)");
  try {
    const url = new URL(args.base);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new ConfigError(`--base must use http:// or https:// (got ${JSON.stringify(args.base)})`);
    }
  } catch (err) {
    if (err instanceof ConfigError) throw err;
    throw new ConfigError(`--base is not a valid URL: ${JSON.stringify(args.base)}`);
  }
  if (!args.out) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    args.out = `artifacts/bench-local-model-${ts}.json`;
  }
  return args;
}

export const USAGE = `Usage: node scripts/bench-local-model.mjs --model <name> [options]

Options:
  --base <url>        OpenAI-compatible endpoint (default http://127.0.0.1:11434 — Ollama's default).
                      Honors base URLs ending in /v1 (e.g. https://api.groq.com/openai/v1).
  --model <name>      Model identifier to send in the request body (required).
  --reps <n>          Repetitions per tool-call shape, 1–${MAX_REPS} (default ${DEFAULT_REPS}). Total reps = 4 shapes × reps.
  --api-key-env <ENV> Read the API key from this environment variable (never from a flag, never printed,
                      never written to disk). Omit for keyless local endpoints.
  --out <file>        Report output path (default artifacts/bench-local-model-<timestamp>.json).
  --help              Show this text.

Exit codes: 0 = PASS (all pre-registered gates green) · 1 = FAIL (gates not met / endpoint errors) · 2 = configuration error.

This benchmark measures tool-calling reliability and latency of the configured endpoint only.
A cloud endpoint such as Groq is NOT local inference and does not satisfy R02.`;

/** Mirror of chatCompletionsUrl in src/flood/ai/llmAdapter.ts (reimplemented, not imported). */
export function chatCompletionsUrl(baseUrl) {
  const trimmed = String(baseUrl).trim().replace(/\/+$/, "");
  if (/\/v1$/.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

// ---------------------------------------------------------------------------
// Tiny JSON-schema validator for the catalog subset (object + scalar props).
// Unknown properties are tolerated (the catalog does not set additionalProperties:false).
// ---------------------------------------------------------------------------
export function validateToolArgs(schema, args) {
  const errors = [];
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    return { ok: false, errors: ["arguments must be a JSON object"] };
  }
  const required = Array.isArray(schema?.required) ? schema.required : [];
  for (const key of required) {
    if (!(key in args)) errors.push(`missing required property "${key}"`);
  }
  const properties = schema?.properties ?? {};
  for (const [key, sub] of Object.entries(properties)) {
    if (!(key in args)) continue;
    const value = args[key];
    const type = sub?.type;
    if (type === "integer") {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        errors.push(`property "${key}" must be an integer (got ${JSON.stringify(value)})`);
        continue;
      }
      if (typeof sub.minimum === "number" && value < sub.minimum) errors.push(`property "${key}"=${value} below minimum ${sub.minimum}`);
      if (typeof sub.maximum === "number" && value > sub.maximum) errors.push(`property "${key}"=${value} above maximum ${sub.maximum}`);
    } else if (type === "string") {
      if (typeof value !== "string") errors.push(`property "${key}" must be a string (got ${JSON.stringify(value)})`);
      else if (sub.minLength != null && value.length < sub.minLength) errors.push(`property "${key}" shorter than minLength ${sub.minLength}`);
    } else if (type === "number") {
      if (typeof value !== "number" || Number.isNaN(value)) errors.push(`property "${key}" must be a number (got ${JSON.stringify(value)})`);
    } else if (type === "boolean") {
      if (typeof value !== "boolean") errors.push(`property "${key}" must be a boolean (got ${JSON.stringify(value)})`);
    } else if (type === "object") {
      if (value === null || typeof value !== "object" || Array.isArray(value)) errors.push(`property "${key}" must be an object`);
    } else if (type === "array") {
      if (!Array.isArray(value)) errors.push(`property "${key}" must be an array`);
    }
  }
  return { ok: errors.length === 0, errors };
}

const catalogByName = () => new Map(CATALOG_SNAPSHOT.map((t) => [t.name, t]));

/** The four gating shapes, chosen to mirror src/flood/ai/tools.ts schemas. */
export const SHAPES = [
  {
    id: "peak_discharge",
    tool: "peak_discharge",
    argsForRep: () => ({}),
    question: () => "Using only the available tools, call peak_discharge to get the peak daily discharge for the 2015–2024 record.",
  },
  {
    id: "storage_candidates",
    tool: "storage_candidates",
    argsForRep: (i) => ({ limit: (i % 10) + 1 }),
    question: (i) => `Using only the available tools, call storage_candidates with limit ${(i % 10) + 1} to list the top geometric storage candidates.`,
  },
  {
    id: "storage_detail",
    tool: "storage_detail",
    argsForRep: () => ({ id: "ST-0001" }),
    question: () => 'Using only the available tools, call storage_detail for candidate id "ST-0001".',
  },
  {
    id: "enso_context",
    tool: "enso_context",
    argsForRep: (i) => ({ year: 2015 + (i % 10) }),
    question: (i) => `Using only the available tools, call enso_context for the year ${2015 + (i % 10)}.`,
  },
];

export const MINIMAL_SYSTEM_PROMPT =
  "You are TerraScope's decision-support desk. You have access to a fixed set of tools. " +
  "When the user asks you to call a specific tool, call it with arguments matching its JSON schema. " +
  "Do not invent tools. If no tool fits the request, say so.";

export const OPENAI_TOOLS = CATALOG_SNAPSHOT.map((t) => ({
  type: "function",
  function: { name: t.name, description: t.description, parameters: t.parameters },
}));

// ---------------------------------------------------------------------------
// Response classification
// ---------------------------------------------------------------------------
/**
 * Classify one model reply. Returns a mutually exclusive class plus flags.
 * Classes: registry-valid | wrong-tool | unknown-tool | wrong-args | non-JSON | prose-only | timeout | error.
 * registryAcceptable (name in catalog + args parse + schema-valid) is the gate metric;
 * a known-but-wrong tool still counts as registryAcceptable (the registry would accept it)
 * and is reported as class "wrong-tool".
 */
export function classifyReply(message, expectedTool) {
  const catalog = catalogByName();
  const finish = (base) => ({ ...base, expectedTool });
  const content = typeof message?.content === "string" ? message.content : "";
  const nativeCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];

  const parseArgsString = (raw) => {
    if (raw == null || String(raw).trim() === "") return { ok: true, value: {} };
    try {
      const v = JSON.parse(String(raw));
      if (v === null || typeof v !== "object" || Array.isArray(v)) {
        return { ok: false, error: "arguments JSON parsed but is not an object" };
      }
      return { ok: true, value: v };
    } catch {
      return { ok: false, error: "arguments are not parseable JSON" };
    }
  };

  const evaluate = (name, rawArgs, viaContent) => {
    const tool = catalog.get(name);
    if (!tool) {
      return finish({ classification: "unknown-tool", registryAcceptable: false, toolName: name, semanticMatch: false, unknownTool: true, viaContent, detail: `tool "${name}" is not in TOOL_CATALOG` });
    }
    const parsed = parseArgsString(rawArgs);
    if (!parsed.ok) {
      return finish({ classification: "non-JSON", registryAcceptable: false, toolName: name, semanticMatch: false, unknownTool: false, viaContent, detail: parsed.error });
    }
    const validation = validateToolArgs(tool.parameters, parsed.value);
    if (!validation.ok) {
      return finish({ classification: "wrong-args", registryAcceptable: false, toolName: name, semanticMatch: false, unknownTool: false, viaContent, detail: validation.errors.join("; ") });
    }
    const semanticMatch = name === expectedTool;
    return finish({
      classification: semanticMatch ? "registry-valid" : "wrong-tool",
      registryAcceptable: true,
      toolName: name,
      semanticMatch,
      unknownTool: false,
      viaContent,
      detail: semanticMatch ? "registry-acceptable call, expected tool" : `registry-acceptable call, but expected ${expectedTool}`,
    });
  };

  if (nativeCalls.length > 0) {
    const call = nativeCalls[0];
    const name = String(call?.function?.name ?? "");
    return evaluate(name, call?.function?.arguments, false);
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return finish({ classification: "prose-only", registryAcceptable: false, toolName: null, semanticMatch: false, unknownTool: false, viaContent: false, detail: "empty content, no tool calls" });
  }
  // Fallback: some endpoints emit the tool call as raw JSON in content instead of tool_calls.
  // Only a fully-parseable embedded object with a string "name" is treated as a call at all.
  const fenceless = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (fenceless.startsWith("{")) {
    const greedy = fenceless.match(/\{[\s\S]*\}/)?.[0];
    const candidates = greedy && greedy !== fenceless ? [fenceless, greedy] : [fenceless];
    let parsed = null;
    for (const candidate of candidates) {
      try {
        parsed = JSON.parse(candidate);
        break;
      } catch {
        // try the next candidate
      }
    }
    if (parsed === null) {
      return finish({ classification: "non-JSON", registryAcceptable: false, toolName: null, semanticMatch: false, unknownTool: false, viaContent: true, detail: "content starts with a JSON-like block that is not parseable" });
    }
    if (typeof parsed.name === "string") {
      let rawArgs = parsed.arguments ?? parsed.parameters ?? {};
      if (rawArgs && typeof rawArgs === "object") rawArgs = JSON.stringify(rawArgs);
      return evaluate(parsed.name, rawArgs, true);
    }
    // Parseable JSON object without a tool-call shape → prose-only, not a failed parse.
    return finish({ classification: "prose-only", registryAcceptable: false, toolName: null, semanticMatch: false, unknownTool: false, viaContent: true, detail: "content contains JSON but not a tool-call object ({name, arguments})" });
  }
  return finish({ classification: "prose-only", registryAcceptable: false, toolName: null, semanticMatch: false, unknownTool: false, viaContent: false, detail: "no tool calls; content treated as prose" });
}

/** p-th percentile (0–100) of an already-sorted ascending array; nearest-rank method. */
export function percentile(sortedAsc, p) {
  if (!Array.isArray(sortedAsc) || sortedAsc.length === 0) return null;
  const rank = Math.ceil((p / 100) * sortedAsc.length);
  const idx = Math.min(Math.max(rank - 1, 0), sortedAsc.length - 1);
  return sortedAsc[idx];
}

export function mean(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function summarizeSamples(samples) {
  const latencies = samples.map((s) => s.latencyMs).filter((v) => typeof v === "number");
  const sorted = [...latencies].sort((a, b) => a - b);
  const counts = {};
  for (const s of samples) counts[s.classification] = (counts[s.classification] ?? 0) + 1;
  const total = samples.length;
  const rate = (n) => (total ? n / total : 0);
  const registryAcceptable = samples.filter((s) => s.registryAcceptable).length;
  const semanticMatch = samples.filter((s) => s.semanticMatch).length;
  const wrongTool = counts["wrong-tool"] ?? 0;
  const unknownTool = counts["unknown-tool"] ?? 0;
  const nonJson = counts["non-JSON"] ?? 0;
  return {
    reps: total,
    counts,
    toolCallValidRate: rate(registryAcceptable),
    semanticMatchRate: rate(semanticMatch),
    wrongToolRate: rate(wrongTool),
    unknownToolRate: rate(unknownTool),
    parseFailureRate: rate(nonJson),
    meanLatencyMs: mean(latencies),
    p95LatencyMs: percentile(sorted, 95),
  };
}

export function computeGates(overall) {
  const mk = (value, threshold, comparator) => ({ value, threshold, comparator, pass: comparator === ">=" ? value >= threshold : value <= threshold });
  const toolCallValidRate = mk(overall.toolCallValidRate, GATE_TOOL_CALL_VALID, ">=");
  const parseFailureRate = mk(overall.parseFailureRate, GATE_PARSE_FAILURE, "<=");
  const unknownToolRate = mk(overall.unknownToolRate, GATE_UNKNOWN_TOOL, "<=");
  return { toolCallValidRate, parseFailureRate, unknownToolRate, allPass: toolCallValidRate.pass && parseFailureRate.pass && unknownToolRate.pass };
}

// ---------------------------------------------------------------------------
// Secret redaction (defense in depth before the report touches disk)
// ---------------------------------------------------------------------------
export function redactSecrets(text, secrets = []) {
  let out = String(text);
  let redactions = 0;
  for (const secret of secrets) {
    if (!secret) continue;
    const needle = String(secret);
    if (needle.length < 4) continue; // avoid redacting trivial substrings
    let idx = out.indexOf(needle);
    while (idx !== -1) {
      out = out.slice(0, idx) + "[REDACTED]" + out.slice(idx + needle.length);
      redactions += 1;
      idx = out.indexOf(needle);
    }
  }
  const patterns = [/Bearer\s+[A-Za-z0-9._\-+/]{8,}/gi, /\b(gsk|sk|rk|pk)_[A-Za-z0-9_\-]{8,}/g];
  for (const re of patterns) {
    out = out.replace(re, (m) => {
      redactions += 1;
      return m.startsWith("Bearer") ? "Bearer [REDACTED]" : "[REDACTED]";
    });
  }
  return { text: out, redactions };
}

// ---------------------------------------------------------------------------
// Network layer (POST only; redaction applied by callers)
// ---------------------------------------------------------------------------
async function postChatCompletion({ base, model, body, apiKey, timeoutMs, fetchImpl }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let timedOut = false;
  ctrl.signal.addEventListener("abort", () => { timedOut = true; }, { once: true });
  const t0 = Date.now();
  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const url = chatCompletionsUrl(base);
    const res = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify({ model, ...body }), signal: ctrl.signal });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      return { ok: false, kind: "http-error", status: res.status, detail: `HTTP ${res.status}${bodyText ? `: ${bodyText.slice(0, 140)}` : ""}`, latencyMs };
    }
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object") {
      return { ok: false, kind: "malformed", detail: "response body is not JSON", latencyMs };
    }
    return { ok: true, data, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    if (timedOut || (err && err.name === "AbortError")) {
      return { ok: false, kind: "timeout", detail: `no response within ${timeoutMs} ms`, latencyMs };
    }
    return { ok: false, kind: "network", detail: err instanceof Error ? err.message : String(err), latencyMs };
  } finally {
    clearTimeout(timer);
  }
}

function buildRepRequest(shape, repIndex) {
  return {
    messages: [
      { role: "system", content: MINIMAL_SYSTEM_PROMPT },
      { role: "user", content: shape.question(repIndex) },
    ],
    tools: OPENAI_TOOLS,
    tool_choice: "auto",
    max_tokens: MAX_TOKENS_PER_REP,
    temperature: TEMPERATURE,
    seed: SEED,
  };
}

export async function probeEndpoint({ base, model, apiKey, fetchImpl }) {
  const result = await postChatCompletion({
    base,
    model,
    body: { messages: [{ role: "user", content: "ping" }], max_tokens: 1, temperature: 0 },
    apiKey,
    timeoutMs: PROBE_TIMEOUT_MS,
    fetchImpl,
  });
  if (result.ok) return { ok: true, detail: `endpoint answered (model "${model}")`, latencyMs: result.latencyMs };
  return { ok: false, detail: `probe failed: ${result.detail}`, latencyMs: result.latencyMs };
}

export async function measureFirstToken({ base, model, apiKey, fetchImpl }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FIRST_TOKEN_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const res = await fetchImpl(chatCompletionsUrl(base), {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with the single word: ready" }],
        max_tokens: 8,
        temperature: TEMPERATURE,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      const bodyText = await res.text().catch(() => "");
      return { status: "not-measured", reason: `stream request answered HTTP ${res.status}${bodyText ? `: ${bodyText.slice(0, 120)}` : ""}`, sampleSize: 0 };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let firstTokenMs = null;
    let usage = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const chunk = JSON.parse(data);
          if (chunk?.usage) usage = chunk.usage;
          const delta = chunk?.choices?.[0]?.delta;
          const hasToken = delta && (typeof delta.content === "string" && delta.content.length > 0 || Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0);
          if (hasToken && firstTokenMs === null) firstTokenMs = Date.now() - t0;
        } catch {
          // Ignore unparseable SSE lines; not every server flushes clean JSON per line.
        }
      }
    }
    if (firstTokenMs === null) {
      return { status: "not-measured", reason: "stream completed without any token chunk (endpoint may not support stream_options or SSE)", sampleSize: 0 };
    }
    return { status: "measured", latencyMs: firstTokenMs, sampleSize: 1, streamedUsage: usage ?? null, note: "single sample; time to first SSE delta with content or tool_calls" };
  } catch (err) {
    const reason = err && err.name === "AbortError" ? `stream first-token probe timed out after ${FIRST_TOKEN_TIMEOUT_MS} ms` : `stream probe failed: ${err instanceof Error ? err.message : String(err)}`;
    return { status: "not-measured", reason, sampleSize: 0 };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Benchmark orchestration
// ---------------------------------------------------------------------------
export async function runBench(options) {
  const {
    base,
    model,
    reps,
    apiKey = null,
    apiKeyEnv = null,
    repTimeoutMs = REP_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
    repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
    now = () => Date.now(),
  } = options;

  const drift = checkCatalogDrift(repoRoot);
  const probe = await probeEndpoint({ base, model, apiKey, fetchImpl });

  const emptyShapes = () => SHAPES.map((shape) => ({ id: shape.id, tool: shape.tool, reps: 0, samples: [], counts: {}, toolCallValidRate: 0, semanticMatchRate: 0, wrongToolRate: 0, unknownToolRate: 0, parseFailureRate: 0, meanLatencyMs: null, p95LatencyMs: null }));

  const report = {
    schema: SCHEMA_VERSION,
    tool: { name: "bench-local-model", version: BENCH_VERSION },
    generatedAt: new Date(now()).toISOString(),
    config: {
      baseUrl: base,
      model,
      repsPerShape: reps,
      shapes: SHAPES.length,
      totalReps: SHAPES.length * reps,
      apiKeyEnv: apiKeyEnv ?? null,
      apiKeyPresent: Boolean(apiKey),
      temperature: TEMPERATURE,
      seed: SEED,
      maxTokensPerRep: MAX_TOKENS_PER_REP,
      repTimeoutMs,
      systemPrompt: "minimal embedded prompt (not the app's 9-rule SYSTEM_PROMPT); fixed question templates per shape",
      throughputNote: "repetitions are sequential; no concurrency is measured",
    },
    scopeNote:
      "This benchmark measures tool-calling reliability and latency of the configured OpenAI-compatible endpoint only. " +
      "A cloud-hosted model (e.g. Qwen via Groq) is NOT local inference and does not satisfy R02 / issue #2. " +
      "PASS means the endpoint meets the pre-registered tool-call gates; it is not validated hydrology, not an operational forecast, " +
      "and not authorization for any warning, order, evacuation or placement. Below the gates, the app must fall back to the " +
      "deterministic evidence responder and label the answer as such.",
    catalog: { source: "embedded-snapshot", driftChecked: drift.status === "checked", driftDetected: drift.driftDetected, detail: drift.detail },
    probe,
    firstToken: { status: "not-measured", reason: "not attempted (probe failed)", sampleSize: 0 },
    usage: { status: "not-measured", promptTokens: 0, completionTokens: 0, approxCompletionTokPerSec: null, note: "endpoint did not return usage in any response (or run did not execute)" },
    budgetAudit: {
      toolCallsPerRep: 1,
      toolRounds: 1,
      note: "the bench issues one single-turn request per rep with no tool chaining, so the app's <=4 tool-call / <=45 s / one-round budgets are not exercised here; repTimeoutMs mirrors the app's 45 s total budget",
    },
    shapes: emptyShapes(),
    overall: null,
    gates: null,
    verdict: "FAIL",
    verdictLabel: "",
    caveats: [
      "A Groq-hosted Qwen (or any cloud Qwen) is not local inference; passing this bench against a cloud endpoint demonstrates tool-calling reliability only, never R02 completion.",
      "PASS is not validated hydrology, not an operational forecast and not an authorization to act. Issuing any warning, order or evacuation remains the authorised officer's act.",
      "Geometric storage candidates are screening outputs, not surveyed or feasible sites; NRSC context exists only for 1–2 Oct 2024.",
      "Latency is measured sequentially, one request in flight; throughput under concurrency is unmeasured.",
      "tok/s (when the endpoint returns usage) is approximate and includes prompt evaluation; it is not a llama-bench decode-rate measurement.",
      "First-token latency is a single streamed sample; treat it as indicative only.",
      "The embedded catalog snapshot can drift from src/flood/ai/tools.ts; check catalog.driftDetected in this report.",
      "No measurements in this report were invented; any quantity not measured is explicitly labelled not-measured.",
      "The bench does not install models or runtimes and does not by itself close issue #2; pair a PASS report with the hardware audit and human review per docs/REQUIREMENTS.md.",
    ],
    refusals: [
      "Groq/cloud inference is not local inference (docs/DELIVERY.md:115); failure or absence of a local model must surface as the labelled deterministic fallback, never as a fabricated answer.",
      "No measurement (tok/s, latency, memory, accuracy) may be reported as measured unless this script produced it against the configured endpoint.",
      "No model may grade its own output; all verdicts here are computed by this script, not by the model under test.",
      "Neither this benchmark nor its PASS closes GitHub issue #2; closure additionally requires the hardware audit and recorded model/version/latency evidence reviewed by a human.",
      "This benchmark must never be run against endpoints you do not control without explicit authorization; it sends the workspace's tool schemas and prompts to the configured base URL.",
    ],
  };

  if (!probe.ok) {
    report.verdict = "FAIL";
    report.verdictLabel =
      "FAIL (endpoint unreachable at probe) — the benchmark did not run. This is a configuration/endpoint problem, not a model score. " +
      "Check --base, that the runtime is serving (e.g. `ollama serve`), and the model name. Exit code 2.";
    report.overall = summarizeSamples([]);
    report.gates = computeGates({ ...report.overall, toolCallValidRate: 0, parseFailureRate: 1, unknownToolRate: 1 });
    return { report, exitCode: 2 };
  }

  // First-token latency (streaming probe; never fabricated).
  report.firstToken = await measureFirstToken({ base, model, apiKey, fetchImpl });

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let usageReps = 0;
  let usageLatencyMs = 0;

  for (const shape of SHAPES) {
    const samples = [];
    for (let i = 0; i < reps; i += 1) {
      const started = now();
      const response = await postChatCompletion({
        base,
        model,
        body: buildRepRequest(shape, i),
        apiKey,
        timeoutMs: repTimeoutMs,
        fetchImpl,
      });
      const elapsed = now() - started;
      if (!response.ok) {
        const cls = response.kind === "timeout" ? "timeout" : "error";
        samples.push({ rep: i, classification: cls, registryAcceptable: false, semanticMatch: false, unknownTool: false, viaContent: false, toolName: null, latencyMs: response.latencyMs ?? elapsed, detail: response.detail });
        continue;
      }
      const message = response.data?.choices?.[0]?.message;
      if (!message) {
        samples.push({ rep: i, classification: "error", registryAcceptable: false, semanticMatch: false, unknownTool: false, viaContent: false, toolName: null, latencyMs: response.latencyMs, detail: "response envelope has no choices[0].message" });
        continue;
      }
      const usage = response.data?.usage;
      if (usage && Number.isFinite(usage.completion_tokens)) {
        totalPromptTokens += Number(usage.prompt_tokens ?? 0) || 0;
        totalCompletionTokens += Number(usage.completion_tokens);
        usageReps += 1;
        usageLatencyMs += response.latencyMs;
      }
      const classified = classifyReply(message, shape.tool);
      samples.push({ rep: i, ...classified, latencyMs: response.latencyMs, args: undefined });
    }
    const summary = summarizeSamples(samples);
    report.shapes[SHAPES.indexOf(shape)] = {
      id: shape.id,
      tool: shape.tool,
      ...summary,
      samples,
    };
  }

  const allSamples = report.shapes.flatMap((s) => s.samples);
  report.overall = summarizeSamples(allSamples);
  report.gates = computeGates(report.overall);

  if (usageReps > 0 && usageLatencyMs > 0) {
    report.usage = {
      status: "measured",
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      approxCompletionTokPerSec: totalCompletionTokens / (usageLatencyMs / 1000),
      note: `approximate: ${usageReps}/${allSamples.length} reps returned usage; tokens divided by total round-trip time, so prompt evaluation is included — not a decode-rate measurement`,
    };
  }
  // Stream-only usage (firstToken.streamedUsage) is reported under firstToken only;
  // the aggregate here counts non-streaming rep responses, so it never mixes units.

  const gates = report.gates;
  if (gates.allPass) {
    report.verdict = "PASS";
    report.verdictLabel =
      "PASS — endpoint meets the pre-registered tool-call gates (registry-acceptable ≥90%, parse-failure ≤5%, unknown-tool ≤2%). " +
      "This does NOT close issue #2: attach this report plus the hardware audit to the issue for human review.";
  } else {
    const failures = [
      !gates.toolCallValidRate.pass ? `tool-call-valid ${(gates.toolCallValidRate.value * 100).toFixed(1)}% < 90%` : null,
      !gates.parseFailureRate.pass ? `parse-failure ${(gates.parseFailureRate.value * 100).toFixed(1)}% > 5%` : null,
      !gates.unknownToolRate.pass ? `unknown-tool ${(gates.unknownToolRate.value * 100).toFixed(1)}% > 2%` : null,
    ].filter(Boolean);
    report.verdict = "FAIL";
    report.verdictLabel =
      `FAIL — ${failures.join("; ")}. Do not claim local AI capability with this configuration. ` +
      "The app must fall back to the deterministic evidence responder and label answers 'deterministic evidence (local AI not connected)'.";
  }

  return { report, exitCode: gates.allPass ? 0 : 1 };
}

export function formatVerdictSummary(report, reportPath) {
  const pct = (v) => (v == null ? "n/a" : `${(v * 100).toFixed(1)}%`);
  const ms = (v) => (v == null ? "n/a" : `${Math.round(v)} ms`);
  const gates = report.gates;
  const lines = [
    "",
    "TerraScope local-model benchmark — verdict",
    `  Endpoint : ${report.config.baseUrl}`,
    `  Model    : ${report.config.model}`,
    `  Reps     : ${report.config.repsPerShape} per shape × ${report.config.shapes} shapes = ${report.config.totalReps} reps (sequential, temperature ${report.config.temperature}, seed ${report.config.seed})`,
    `  Catalog  : embedded snapshot${report.catalog.driftDetected === true ? " — DRIFT DETECTED vs src/flood/ai/tools.ts (see report)" : report.catalog.driftChecked ? " (no drift detected)" : " (drift not verified)"}`,
    `  Probe    : ${report.probe.ok ? "ok" : "FAILED"}${report.probe.latencyMs != null ? ` (${ms(report.probe.latencyMs)})` : ""} — ${report.probe.detail}`,
  ];
  if (report.overall) {
    lines.push(
      `  Overall  : tool-call-valid ${pct(report.overall.toolCallValidRate)} · unknown-tool ${pct(report.overall.unknownToolRate)} · wrong-tool ${pct(report.overall.wrongToolRate)} · parse-failure ${pct(report.overall.parseFailureRate)} · prose-only ${pct((report.overall.counts["prose-only"] ?? 0) / Math.max(report.overall.reps, 1))} · error ${pct((report.overall.counts["error"] ?? 0) / Math.max(report.overall.reps, 1))} · timeout ${pct((report.overall.counts["timeout"] ?? 0) / Math.max(report.overall.reps, 1))}`,
      `  Latency  : mean ${ms(report.overall.meanLatencyMs)} · p95 ${ms(report.overall.p95LatencyMs)}`,
    );
  }
  for (const shape of report.shapes) {
    lines.push(`    - ${shape.id.padEnd(18)} valid ${pct(shape.toolCallValidRate)} · mean ${ms(shape.meanLatencyMs)} · p95 ${ms(shape.p95LatencyMs)}`);
  }
  lines.push(
    `  First-token: ${report.firstToken.status === "measured" ? `${ms(report.firstToken.latencyMs)} (1 sample)` : `not measured (${report.firstToken.reason ?? "unknown reason"})`}`,
    `  tok/s       : ${report.usage.status === "measured" && report.usage.approxCompletionTokPerSec != null ? `~${report.usage.approxCompletionTokPerSec.toFixed(2)} (approximate; includes prompt eval)` : "not measured (endpoint returned no usage)"}`,
    `  Gates       : tool-call-valid ${pct(gates?.toolCallValidRate?.value)} (>=${GATE_TOOL_CALL_VALID * 100}%) ${gates?.toolCallValidRate?.pass ? "PASS" : "FAIL"} · parse-failure ${pct(gates?.parseFailureRate?.value)} (<=${GATE_PARSE_FAILURE * 100}%) ${gates?.parseFailureRate?.pass ? "PASS" : "FAIL"} · unknown-tool ${pct(gates?.unknownToolRate?.value)} (<=${GATE_UNKNOWN_TOOL * 100}%) ${gates?.unknownToolRate?.pass ? "PASS" : "FAIL"}`,
    `  VERDICT     : ${report.verdictLabel}`,
    `  Report      : ${reportPath}`,
    "",
    "  Reminder: a cloud endpoint (Groq etc.) is not local inference. R02/issue #2 needs a local model, this report, the hardware audit, and human review.",
    "",
  );
  return lines.join("\n");
}

/** Serialize the report, redact secrets, write the file, verify the read-back. */
export function writeReportRedacted(report, outPath, secrets) {
  const abs = resolve(outPath);
  mkdirSync(dirname(abs), { recursive: true });
  const serialize = (r) => redactSecrets(JSON.stringify(r, null, 2), secrets);
  const first = serialize(report);
  writeFileSync(abs, first.text, "utf8");
  // Belt and braces: the file on disk must not contain the key.
  const readBack = redactSecrets(readFileSync(abs, "utf8"), secrets);
  report.outputRedactions = first.redactions + readBack.redactions;
  const withCount = serialize(report);
  writeFileSync(abs, withCount.text, "utf8");
  const finalCheck = redactSecrets(readFileSync(abs, "utf8"), secrets);
  if (finalCheck.redactions > 0) {
    writeFileSync(abs, finalCheck.text, "utf8");
  }
  return { path: abs, redactions: report.outputRedactions + finalCheck.redactions };
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  let args;
  try {
    args = parseArgs(argv, env);
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`bench-local-model: ${err.message}\nRun with --help for usage.\n`);
      return 2;
    }
    throw err;
  }
  if (args.help) {
    process.stdout.write(USAGE + "\n");
    return 0;
  }
  const apiKey = args.apiKeyEnv ? env[args.apiKeyEnv] : null;
  const { report, exitCode } = await runBench({
    base: args.base,
    model: args.model,
    reps: args.reps,
    apiKey,
    apiKeyEnv: args.apiKeyEnv,
    repoRoot: resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  });
  const { path: reportPath } = writeReportRedacted(report, args.out, apiKey ? [apiKey] : []);
  const summary = formatVerdictSummary(report, reportPath);
  // Defense in depth: redact even the printed summary.
  process.stdout.write(redactSecrets(summary, apiKey ? [apiKey] : []).text + "\n");
  return exitCode;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().then((code) => {
    process.exit(code);
  }).catch((err) => {
    process.stderr.write(`bench-local-model: fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  });
}
