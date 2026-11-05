# Local agents and execution harness

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


Status: architecture and acceptance contract only. No installed model, scheduler or running workers are implied. Product agents below are distinct from development-session assistants.

## Agent roles

Use a supervisor with scoped workers sharing durable records, not unrestricted conversational agents passing summaries around. Initially reuse one local model sequentially with separate task contexts to fit available memory; parallel inference is an optimization to benchmark, not a requirement to load many models.

| Role | Trigger and responsibility | Output |
| --- | --- | --- |
| Coordinator | New region/objective, changed inputs or refresh due; schedules bounded dependencies | Versioned analysis plan and job graph |
| Evidence researcher | Missing/stale sources or explicit scientific gap | Retrieved source records, rejected sources and unresolved claims |
| Data curator | Source discovered or updated | Validated dataset manifest, transformations and coverage report |
| Spatial/scenario worker | Baseline ready or constraints changed | Tool-generated candidates, proposed placements and solver-ready scenarios |
| Model runner | Validated scenario queued | Scientific tool run, diagnostic logs and versioned output fields; no LLM-invented numbers |
| Verifier | Candidate/result ready | Schema/unit/provenance checks, benchmark evidence and failed checks; separate from proposer |
| Planning/explanation worker | Checked results available | Cited comparison, tradeoffs and counter-plan linked to geometry/run IDs |

Deterministic jobs should stay code, not consume an LLM call merely to appear agentic. Verification is not majority voting between models. Use independent observations, locked tests and tool outputs. All workers read original source/run artifacts by ID rather than relying on paraphrased handoffs.

## Harness responsibilities

Persist RegionObjective, AgentJob, SourceRecord, DatasetVersion, Scenario, ScientificRun, Finding and EvaluationRecord. Jobs carry IDs, input hash, dependency versions, role/tool scope, attempt count, heartbeat, budget, output references and timestamps. Findings track evidence, geometry, superseded state and user visibility.

State machine: queued -> running -> succeeded or partial or failed; interruption -> checkpointed/retryable; policy/input dependency -> blocked; user cancel -> cancelled. Stale results are retained but marked and never displayed as current. Use leases, bounded retries/backoff, idempotency keys and atomic result publication to survive restart and avoid double processing. Cache by validated input/model hash, not prompt similarity.

Bound every run by time, model tokens, tool calls, download bytes, compute and storage limits. Stop or degrade explicitly when exhausted. Limit concurrency to measured resources. Network outages and rate limits schedule a later eligible retry; they must not create busy loops. Data/provider licenses control refresh and retention. Source refresh is cadence/change-aware; successful checks with no changes do not rerun every solver.

## Allowed surfaces

- Locked for a run: evaluation rules, source trust policy, model adapter definitions, unit/datum checks and tool permissions. Agents cannot weaken these to pass their own work.
- Editable: research plans, candidate proposals, scenario inputs and citations within registered schemas and budgets.
- Append-only: tool events, failure logs, rejected candidates, provenance and evaluation results. Corrections supersede earlier records.
- Outside autonomous analysis: credentials, production code/model deployment, paid commitments beyond configuration, external communications and physical/official decisions.

Retrieved documents are untrusted evidence. Validate tool arguments; allow only registered dataset/model operations and scoped paths/endpoints. No arbitrary shell/network execution from a research document. Separate local service authentication from the public UI. Use research-sandbox jobs for proposed new methods; passing a benchmark does not auto-install code or replace the established model.

## Evaluation suite to implement

1. Known-good source/result passes; unsupported numerical claims and unretrieved citations fail.
2. Missing terrain/datum or incompatible units blocks the affected calculation, while unrelated exploration remains available.
3. Hostile text in a retrieved document cannot alter tool scope, policies or evaluation rules.
4. A repeated trigger and restart do not duplicate downloads/runs; outputs match fixed-input reproducibility tolerances.
5. Updated data invalidates only dependent results; expired data is visibly stale.
6. Timeout, offline source, corrupted cache, crashed local model and exhausted budgets recover or terminate clearly.
7. Candidate search is tested on known feasible/infeasible synthetic fixtures; real-site suitability remains a separate validation question.
8. Scientific evaluation uses held-out events/non-events, uncertainty and baselines. Agent eloquence is not numerical skill.
9. Compare single-agent and scoped-worker pipelines on quality, latency, memory and cost. Remove roles that add overhead without benefit.
10. One-view flow completes without manually choosing each source, prompting every step or drawing every candidate.

## Development harness

Before implementation, map the change to requirements and the end-to-end user journey, inspect current evidence and proactively research relevant primary sources. Identify missing prerequisites without asking the user to enumerate them. Implement routine reversible work within authorization; ask only for genuinely unavailable preferences/access or consequential decisions. Preserve scope and show dependency blockers.

After implementation, record changed requirement IDs, check results, actual artifacts and unimplemented gaps. Update MISTAKE.md when a failure exposes a repeatable cause. Keep research conclusions separate from verified implementation. Never mark an agent service complete because its prompts or architecture document exist.
