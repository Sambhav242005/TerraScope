# Local-model benchmark — operator guide (R02 / issue #2)

`scripts/bench-local-model.mjs` measures a **locally served, OpenAI-compatible model** (Ollama / llama.cpp / LM Studio on this machine or an authorized LAN host) against TerraScope's tool catalog. It exists to make "R02 is satisfied" a falsifiable claim: a model either meets the pre-registered tool-call gates or it does not.

**It does not install anything, does not download models, and does not close issue #2 by itself.** It has never been run against a real local model as part of this delivery (no model is installed); the test suite uses a synthetic fixture server.

> Honest scoping: a cloud-hosted Qwen (e.g. via Groq) is **not local inference** and does not satisfy R02. Benchmarking that endpoint proves the adapter path only. Local inference means the model runs on this machine or an authorized local/LAN host, offline from third-party inference providers.

## Requirements

- Node ≥ 20 (repo toolchain; verified on Node v26.13.0). **No new dependencies.**
- A running OpenAI-compatible endpoint serving the model you want to measure.
  - Ollama: `ollama serve` (default `http://127.0.0.1:11434`)
  - llama.cpp: `llama-server.exe -m <model> -ngl <N> --ctx-size 2048 --port 8080` (default `http://127.0.0.1:8080`)
  - LM Studio: local server on its default port (commonly 1234)
- The hardware audit from [F-local-ai analysis](../artifacts/agents/F-local-ai.md) §2.1 (CPU/RAM/GPU/disk recorded) — do this **before** quoting any number. The bench measures an endpoint; it cannot tell you whether the machine is suitable.

## The exact command to run after installing a model

Ollama example (keyless local endpoint):

```powershell
ollama pull qwen2.5:7b-instruct
node scripts/bench-local-model.mjs --model qwen2.5:7b-instruct
```

llama.cpp example:

```powershell
llama-server.exe -m C:\models\qwen2.5-7b-instruct-q4_k_m.gguf -ngl 0 --ctx-size 2048 --port 8080
node scripts/bench-local-model.mjs --base http://127.0.0.1:8080 --model qwen2.5-7b-instruct-q4_k_m
```

Authenticated endpoint (key read from an environment variable — never a flag, never printed, never written to disk):

```powershell
$env:LOCAL_LLM_KEY = "…"          # or set permanently in the user environment
node scripts/bench-local-model.mjs --base http://127.0.0.1:8080 --model <model> --api-key-env LOCAL_LLM_KEY
```

All options:

| Flag | Default | Meaning |
| --- | --- | --- |
| `--base <url>` | `http://127.0.0.1:11434` | OpenAI-compatible endpoint. Honors base URLs ending in `/v1` (e.g. `https://api.groq.com/openai/v1`). |
| `--model <name>` | *(required)* | Model id sent in the request body. |
| `--reps <n>` | `50` | Repetitions **per shape**; 4 shapes ⇒ total reps = 4 × n (default 200). 1–1000. |
| `--api-key-env <ENV>` | none | Read the API key from this environment variable. If unset/empty, the run stops with exit 2. |
| `--out <file>` | `artifacts/bench-local-model-<timestamp>.json` | The only file written. |
| `--help` | — | Usage text; exit 0. |

Exit codes: **0 = PASS** · **1 = FAIL** (gates unmet or mid-run endpoint errors) · **2 = configuration error** (bad args, or the 5 s probe could not reach the endpoint — the report is still written, with `verdict: "FAIL"` and `probe.ok: false`).

Determinism-ish: fixed question templates, temperature 0, `seed: 42` (servers may ignore `seed`), sequential requests, same questions every run.

## What it measures

For each of the four gating shapes (chosen from `TOOL_CATALOG` in `src/flood/ai/tools.ts`), `reps` times:

| Shape | Schema under test | Varying argument |
| --- | --- | --- |
| `peak_discharge` | `{}` no args | none |
| `storage_candidates` | optional integer `limit` ∈ 1–10 | `limit` cycles 1–10 |
| `storage_detail` | **required** string `id` | fixed `"ST-0001"` (synthetic label; existence not checked) |
| `enso_context` | optional integer `year` | `year` cycles 2015–2024 |

Each response is classified (mutually exclusive) as one of:

`registry-valid` (name in `TOOL_CATALOG`, args parse, schema-valid, expected tool) · `wrong-tool` (catalog tool, schema-valid, wrong tool for the question — still **registry-acceptable**) · `unknown-tool` (name not in the catalog) · `wrong-args` (catalog tool, args schema-invalid) · `non-JSON` (arguments unparseable, or a JSON-like content block unparseable) · `prose-only` (no tool call at all) · `timeout` (no response within 45 s) · `error` (HTTP non-2xx / network failure / malformed envelope).

Gate metric details (see report fields): the **tool-call-valid rate counts "registry-acceptable"** — name in catalog + args schema-valid — matching the F-analysis §3.3 rule that the registry (not the benchmark) is the acceptor, and that unknown-tool emissions count as failures. `wrong-tool` is reported as a separate diagnostic rate, not as a gate.

Also recorded: per-shape and overall mean + nearest-rank **p95** latency; **first-token latency** from one streamed probe (labelled a single sample, or `not-measured` with a reason — never fabricated); **tok/s** only if the endpoint returns `usage` (approximate, includes prompt evaluation; `not-measured` otherwise); a **catalog drift check** comparing the embedded schema snapshot against `src/flood/ai/tools.ts` textually (no code executed).

## Pre-registered acceptance gates

| Gate | Threshold | Meaning if violated |
| --- | --- | --- |
| tool-call-valid rate | **≥ 0.90** | Below 90%: the model is not installed-for-R02-purposes regardless of tok/s (F-analysis §3.3). |
| parse-failure rate (`non-JSON` ÷ total) | **≤ 0.05** | The adapter path that parses arguments degrades; check runtime/grammar support. |
| unknown-tool rate | **≤ 0.02** | Hallucinated tool names; registry would reject them in-app. |

Verdicts:

- **PASS** (exit 0) — all three gates green. Still not issue-#2 closure: pair the report with the hardware audit and human review (see below).
- **FAIL** (exit 1) — at least one gate red, or mid-run endpoint errors. The app must use the deterministic evidence responder and label answers accordingly; do not claim local AI with this configuration.
- **exit 2** — the benchmark could not run (bad flags, or unreachable endpoint at probe). Not a model score. Fix `--base` / start the runtime / check the model name, then re-run.

## Reading the report JSON

| Field | Meaning |
| --- | --- |
| `scopeNote` | Load-bearing reminder: Groq ≠ local inference; PASS ≠ operational authorization. |
| `config` | Base URL, model, reps, temperature/seed, whether an API key was present (never the value), `apiKeyEnv` **name** only. |
| `catalog` | `source: "embedded-snapshot"`, `driftChecked`, `driftDetected` — if `true`, update the snapshot in the script before trusting gates. |
| `probe` | 5 s reachability check (mirrors `probeLocalModel`). |
| `firstToken` | `status: "measured"` with `latencyMs` (1 sample), else `"not-measured"` + `reason`. |
| `usage` | `status: "measured"` → `approxCompletionTokPerSec` (approximate), else `not-measured`. |
| `shapes[]` / `overall` | Per-shape and total rep stats: classification counts, rates, mean/p95 latency, all samples. |
| `gates` | Each gate with value, threshold, comparator, pass/fail; `allPass`. |
| `verdict` / `verdictLabel` | `PASS` or `FAIL` + the human-readable consequence. |
| `budgetAudit` | Bench issues one single-turn request per rep; the app's ≤4-calls / ≤45 s / one-round budgets are not exercised here. |
| `caveats`, `refusals` | What the result does not mean; refusal list (see below). |
| `outputRedactions` | Count of redactions applied to the file (0 expected in normal operation). |

Safety mechanics: the runner makes **only POST requests to `--base`** (non-streaming reps + one optional SSE first-token probe). It never executes model output, never fetches anything else, and writes exactly one file. Before the report is written it is serialized, **grepped for the API key and for generic bearer/provider-token patterns** (`Bearer …`, `gsk_…`, `sk_…`, `rk_…`, `pk_…`); matches are redacted, the file is re-read and verified, and the summary printed to stdout is redacted the same way. The key is read only from the env var named by `--api-key-env` and is never accepted as a flag.

## Non-negotiable caveats

1. **Groq (or any cloud) is not local inference.** Running this bench against `https://api.groq.com/openai/v1` measures Qwen-via-Groq. That demonstrates the app's adapter end-to-end; it does not satisfy R02, does not evidence local inference, and must not be reported as doing so (`docs/DELIVERY.md:115`).
2. **PASS is not validated hydrology**, not an operational forecast, not an authorization for any action. Issuing warnings/orders/evacuations remains the authorised officer's act.
3. **Failure must surface, not hide.** If the endpoint is down, slow, or below the gates, the app falls back to the deterministic evidence responder **labelled as such** ("deterministic evidence — local AI not connected"). Never a silent or fabricated answer.
4. **No invented measurements.** If this file ever shows a tok/s, latency, or gate number without a run behind it, that is a report bug. `not-measured` is the honest value.
5. **One bench PASS does not close issue #2.** Closure needs: this report attached to the issue, the hardware audit recorded (CPU/RAM/GPU/VRAM/disk, runtime + version + flags, model name + quant + sha256 + license), and human review per `docs/REQUIREMENTS.md` (R14 discipline — TODO/REQUIREMENTS rows change only after review).
6. The embedded schema snapshot can drift from `src/flood/ai/tools.ts`; check `catalog.driftDetected` on every run.

## What this benchmark cannot do

- It cannot install, download or select a model, and cannot tell you whether a 7–8B Q4 fits your machine — that is the hardware audit (F-analysis §2).
- It cannot measure sustained decode rate like `llama-bench`; tok/s is approximate when returned at all.
- It cannot measure concurrency (requests are sequential).
- It cannot validate hydrology, NRSC/GloFAS fidelity, or candidate site feasibility. Geometric candidates are screening outputs, not surveyed sites.
- It cannot certify safety, suitability or closure of any requirement. It produces evidence for a human decision — nothing more.

## Attaching results to issue #2

1. Run the bench; keep the printed summary and the JSON report path it prints.
2. Sanity-check the report: `gates.allPass`, `catalog.driftDetected`, `outputRedactions` is 0 or small, `verdict` matches the gates.
3. If PASS: paste the summary + link/attach the JSON into issue #2 **as one piece of evidence alongside** the hardware audit. Do not close the issue from the bench alone.
4. If FAIL: record the FAIL report honestly; the decision is then (a) better local model/runtime/offload settings, or (b) stay on the labelled deterministic fallback. Never (c) relabel Groq as local.
5. `TODO.md` / `docs/REQUIREMENTS.md` rows move only after a human reviews the evidence.

## Reproducing the tests

`npm test` — the `tests/bench-local-model.test.js` suite (44 tests) runs entirely against a synthetic fixture HTTP server on an ephemeral port (`127.0.0.1:0`). No network, no model, no API key. It asserts classification of registry-valid / wrong-tool / unknown-tool / wrong-args / non-JSON / prose-only / timeout / error replies, gate math at the exact thresholds, redaction of keys from the written report, drift detection, and the exit-code paths.
