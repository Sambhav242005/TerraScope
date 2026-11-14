// Durable local execution harness (R17) for deterministic tools.
// Deterministic jobs stay code; they do not consume an LLM call.
// Persisted jobs, restart recovery, bounded budgets, scope registry and a
// separate output verifier — nothing here trusts a tool's own claim.
import { SCREENING_METHOD } from "./storage/storageSearch.ts";

export type HarnessStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type HarnessJobKind = "storage-screening";
export const HARNESS_SCHEMA = "terrascope-harness-v1";
/** Only these tools may run under the harness; everything else is out of scope. */
export const SCOPED_TOOLS: Record<HarnessJobKind, string> = {
  "storage-screening": SCREENING_METHOD,
};

export type HarnessOutput = {
  status: "succeeded" | "failed" | "insufficient-data" | "cancelled";
  runId: string;
  configHash: string;
  method: string;
  tilesFetched: number;
  tilesTotal: number;
  candidateCountTotal: number;
};
export type HarnessBudget = {
  maxAttempts: number;
  maxWallMs: number;
  maxTiles: number | null;
};
export type HarnessCheckpoint = { tilesFetched: number | null; tilesTotal: number | null };
export type HarnessJob = {
  schema: typeof HARNESS_SCHEMA;
  id: string;
  kind: HarnessJobKind;
  inputHash: string;
  input: Record<string, unknown>;
  tool: string;
  status: HarnessStatus;
  attempts: number;
  maxAttempts: number;
  maxWallMs: number;
  maxTiles: number | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
  checkpoint: HarnessCheckpoint | null;
  output: HarnessOutput | null;
  error: string | null;
  supersededBy: string | null;
};
export type HarnessEvent = { at: string; jobId: string; kind: string; detail: string };
export type HarnessState = { jobs: HarnessJob[]; events: HarnessEvent[] };

export const DEFAULT_BUDGET: HarnessBudget = { maxAttempts: 3, maxWallMs: 180_000, maxTiles: 25 };
const MAX_EVENTS = 200;

export function emptyHarness(): HarnessState {
  return { jobs: [], events: [] };
}

/** FNV-1a — deterministic, dependency-free, stable across restarts/machines. */
export function hashInput(input: unknown): string {
  const text = JSON.stringify(input ?? null);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function appendEvent(state: HarnessState, at: string, jobId: string, kind: string, detail: string): HarnessState {
  const events = [...state.events, { at, jobId, kind, detail }].slice(-MAX_EVENTS);
  return { ...state, events };
}

function updateJob(state: HarnessState, id: string, patch: Partial<HarnessJob>): HarnessState {
  return {
    ...state,
    jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)),
  };
}

/** Enqueue idempotently: an open (queued|running) job for the same kind+input is reused, not duplicated. */
export function enqueue(
  state: HarnessState,
  kind: HarnessJobKind,
  input: Record<string, unknown>,
  budget: HarnessBudget,
  now: Date,
): { state: HarnessState; job: HarnessJob; created: boolean } {
  const tool = SCOPED_TOOLS[kind];
  if (!tool) throw new Error(`Tool scope rejected: ${String(kind)} is not a registered harness tool.`);
  const inputHash = hashInput({ kind, input });
  const open = state.jobs.find(
    (job) => job.kind === kind && job.inputHash === inputHash && (job.status === "queued" || job.status === "running"),
  );
  if (open) {
    return {
      state: appendEvent(state, now.toISOString(), open.id, "enqueue-reused", `input ${inputHash} already has an open job`),
      job: open,
      created: false,
    };
  }
  const seq = state.jobs.filter((job) => job.inputHash === inputHash).length + 1;
  const job: HarnessJob = {
    schema: HARNESS_SCHEMA,
    id: `harness-${inputHash}-${seq}`,
    kind,
    inputHash,
    input,
    tool,
    status: "queued",
    attempts: 0,
    maxAttempts: budget.maxAttempts,
    maxWallMs: budget.maxWallMs,
    maxTiles: budget.maxTiles,
    queuedAt: now.toISOString(),
    startedAt: null,
    finishedAt: null,
    heartbeatAt: null,
    checkpoint: null,
    output: null,
    error: null,
    supersededBy: null,
  };
  return {
    state: appendEvent({ ...state, jobs: [...state.jobs, job] }, now.toISOString(), job.id, "enqueued", `input ${inputHash}`),
    job,
    created: true,
  };
}

export function start(state: HarnessState, id: string, now: Date): HarnessState {
  const job = state.jobs.find((j) => j.id === id);
  if (!job) throw new Error(`Unknown job ${id}`);
  if (job.status !== "queued") throw new Error(`Job ${id} is ${job.status}; only queued jobs can start.`);
  const attempt = job.attempts + 1;
  if (attempt > job.maxAttempts) {
    return appendEvent(
      updateJob(state, id, { status: "failed", finishedAt: now.toISOString(), error: "Attempt budget exhausted" }),
      now.toISOString(),
      id,
      "failed",
      "max attempts exceeded before start",
    );
  }
  return appendEvent(
    updateJob(state, id, {
      status: "running",
      attempts: attempt,
      startedAt: now.toISOString(),
      heartbeatAt: now.toISOString(),
      error: null,
    }),
    now.toISOString(),
    id,
    "started",
    `attempt ${attempt}/${job.maxAttempts}`,
  );
}

export function heartbeat(
  state: HarnessState,
  id: string,
  checkpoint: HarnessCheckpoint,
  now: Date,
): HarnessState {
  const job = state.jobs.find((j) => j.id === id);
  if (!job || job.status !== "running") return state; // a late heartbeat from a cancelled/failed job is ignored
  const started = job.startedAt ? Date.parse(job.startedAt) : NaN;
  if (Number.isFinite(started) && now.getTime() - started > job.maxWallMs) {
    return appendEvent(
      updateJob(state, id, {
        status: "failed",
        finishedAt: now.toISOString(),
        checkpoint,
        error: `Wall-clock budget exhausted (${job.maxWallMs} ms)`,
      }),
      now.toISOString(),
      id,
      "failed",
      "max wall-clock budget exceeded",
    );
  }
  if (job.maxTiles != null && checkpoint.tilesTotal != null && checkpoint.tilesTotal > job.maxTiles) {
    return appendEvent(
      updateJob(state, id, {
        status: "failed",
        finishedAt: now.toISOString(),
        checkpoint,
        error: `Tile budget exhausted (${checkpoint.tilesTotal} > ${job.maxTiles})`,
      }),
      now.toISOString(),
      id,
      "failed",
      "max tile budget exceeded",
    );
  }
  return updateJob(state, id, { heartbeatAt: now.toISOString(), checkpoint });
}

export function fail(state: HarnessState, id: string, error: string, now: Date): HarnessState {
  const job = state.jobs.find((j) => j.id === id);
  if (!job || (job.status !== "running" && job.status !== "queued")) return state;
  return appendEvent(
    updateJob(state, id, { status: "failed", finishedAt: now.toISOString(), error }),
    now.toISOString(),
    id,
    "failed",
    error,
  );
}

export function cancel(state: HarnessState, id: string, now: Date): HarnessState {
  const job = state.jobs.find((j) => j.id === id);
  if (!job || (job.status !== "queued" && job.status !== "running")) return state;
  return appendEvent(
    updateJob(state, id, { status: "cancelled", finishedAt: now.toISOString() }),
    now.toISOString(),
    id,
    "cancelled",
    "user cancel",
  );
}

/** The verifier is not the proposer: it checks shape, units, method and completion claims. */
export function verifyJobOutput(output: HarnessOutput): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!output || typeof output !== "object") return { ok: false, errors: ["Output is missing."] };
  if (!output.runId || typeof output.runId !== "string") errors.push("runId is missing.");
  if (!/^[0-9a-f]{8,64}$/i.test(output.configHash ?? "")) errors.push("configHash is missing or malformed.");
  if (output.method !== SCREENING_METHOD) errors.push(`Method is not the registered screener (${SCREENING_METHOD}).`);
  if (!Number.isInteger(output.tilesFetched) || !Number.isInteger(output.tilesTotal) || output.tilesTotal <= 0) {
    errors.push("Tile counts are missing or invalid.");
  } else if (output.status === "succeeded" && output.tilesFetched !== output.tilesTotal) {
    errors.push(`Output claims success with missing tiles (${output.tilesFetched}/${output.tilesTotal}).`);
  }
  if (!Number.isInteger(output.candidateCountTotal) || output.candidateCountTotal < 0) {
    errors.push("candidateCountTotal is missing or negative.");
  }
  if (output.status === "cancelled") errors.push("Cancelled outputs cannot be marked succeeded.");
  return { ok: errors.length === 0, errors };
}

/** Complete a job: verifier gates publication; older succeeded jobs for the same input are superseded, never deleted. */
export function complete(
  state: HarnessState,
  id: string,
  output: HarnessOutput,
  now: Date,
): { state: HarnessState; ok: boolean; errors: string[] } {
  const job = state.jobs.find((j) => j.id === id);
  if (!job || job.status !== "running") {
    return {
      state: appendEvent(state, now.toISOString(), id, "completion-rejected", "job is not running"),
      ok: false,
      errors: ["Job is not running; completion rejected."],
    };
  }
  const verdict = verifyJobOutput(output);
  if (!verdict.ok) {
    return {
      state: appendEvent(
        updateJob(state, id, { status: "failed", finishedAt: now.toISOString(), error: `Verification failed: ${verdict.errors.join(" ")}` }),
        now.toISOString(),
        id,
        "verification-failed",
        verdict.errors.join(" "),
      ),
      ok: false,
      errors: verdict.errors,
    };
  }
  const succeeded = updateJob(state, id, {
    status: "succeeded",
    finishedAt: now.toISOString(),
    output,
  });
  const superseded = {
    ...succeeded,
    jobs: succeeded.jobs.map((j) =>
      j.id !== id && j.kind === job.kind && j.inputHash === job.inputHash && j.status === "succeeded" && !j.supersededBy
        ? { ...j, supersededBy: id }
        : j,
    ),
  };
  return {
    state: appendEvent(superseded, now.toISOString(), id, "verified", `output ${output.runId} passed verification`),
    ok: true,
    errors: [],
  };
}

/** Restart recovery: stale running/queued jobs are requeued or failed per their attempt budget. */
export function recoverStale(state: HarnessState, now: Date, leaseMs = 120_000): HarnessState {
  let recovered: HarnessState = state;
  for (const job of state.jobs) {
    if (job.status !== "running") continue;
    const heartbeat = job.heartbeatAt ? Date.parse(job.heartbeatAt) : 0;
    if (now.getTime() - heartbeat <= leaseMs) continue;
    if (job.attempts < job.maxAttempts) {
      recovered = appendEvent(
        updateJob(recovered, job.id, { status: "queued", heartbeatAt: null, error: null }),
        now.toISOString(),
        job.id,
        "recovered",
        "stale lease; requeued for retry",
      );
    } else {
      recovered = appendEvent(
        updateJob(recovered, job.id, {
          status: "failed",
          finishedAt: now.toISOString(),
          error: "Stale lease; attempts exhausted",
        }),
        now.toISOString(),
        job.id,
        "failed",
        "stale lease; max attempts reached",
      );
    }
  }
  return recovered;
}

export function loadJobs(storage: { getItem(key: string): string | null }, key: string): HarnessState {
  try {
    const raw = storage.getItem(key);
    if (!raw) return emptyHarness();
    const parsed = JSON.parse(raw) as Partial<HarnessState>;
    if (!Array.isArray(parsed.jobs) || !Array.isArray(parsed.events)) return emptyHarness();
    const jobs = parsed.jobs.filter((job): job is HarnessJob =>
      Boolean(job) && job.schema === HARNESS_SCHEMA && typeof job.id === "string" && typeof job.inputHash === "string",
    );
    return { jobs, events: parsed.events.slice(-MAX_EVENTS) as HarnessEvent[] };
  } catch {
    return emptyHarness(); // corrupted cache never crashes the app; it is discarded, not interpreted
  }
}

export function saveJobs(
  storage: { setItem(key: string, value: string): void },
  key: string,
  state: HarnessState,
): boolean {
  try {
    storage.setItem(key, JSON.stringify({ jobs: state.jobs, events: state.events.slice(-MAX_EVENTS) }));
    return true;
  } catch {
    return false;
  }
}

export function summarizeHarness(state: HarnessState): { total: number; running: number; succeeded: number; failed: number; cancelled: number; queued: number } {
  const summary = { total: state.jobs.length, running: 0, succeeded: 0, failed: 0, cancelled: 0, queued: 0 };
  for (const job of state.jobs) {
    if (job.status === "running") summary.running++;
    else if (job.status === "succeeded") summary.succeeded++;
    else if (job.status === "failed") summary.failed++;
    else if (job.status === "cancelled") summary.cancelled++;
    else summary.queued++;
  }
  return summary;
}
