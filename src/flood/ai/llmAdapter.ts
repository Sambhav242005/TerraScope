// Local model adapter for the "Ask the map" workspace (R02 wiring, unverified).
//
// Optional path: if the operator configures a local OpenAI-compatible endpoint
// (Ollama / llama.cpp / LM Studio on this machine or LAN), questions go to that
// model WITH the workspace tools attached. The model chooses tools; the app
// executes only registered tools with bounded budgets; nothing else is callable.
//
// Honest limits: no model is installed or benchmarked yet; this adapter does
// not turn the app into a forecaster and cannot relax any validation rule.
// If the endpoint is unreachable or malformed, callers MUST fall back to the
// deterministic responder and label the answer accordingly.
import { runTool, TOOL_CATALOG, type DecisionContext } from "./tools.ts";

export type LocalModelConfig = { baseUrl: string; model: string };

export type LocalModelAnswer = {
  text: string;
  toolCalls: Array<{ name: string; ok: boolean }>;
  mode: "local-model";
  model: string;
  latencyMs: number;
};

export const SYSTEM_PROMPT = [
  "You are the decision-support desk of TerraScope, a flood-preparedness workspace for the Gandak corridor (Bihar, India).",
  "Rules you must follow, always:",
  "1. Answer ONLY from tool outputs and the user's question. If the evidence is missing, say exactly what is missing.",
  "2. Never invent numbers, dates, gauge readings, depths, arrival times, extents or probabilities.",
  "3. Cite the evidence id in square brackets, e.g. [flow-history], [storage-screening], [enso-oni-table], [manifest].",
  "4. Keep answers under 200 words. End with what remains unknown or unverified.",
  "5. You never issue warnings, orders, evacuations or authorisations. You may describe what a human officer may consider; the officer decides.",
  "6. You are not a forecaster, not an engineer, not a land-title authority. Say so when the question crosses those lines.",
  "7. Respond in plain language a time-pressed senior officer can act on. No hedging filler; no salesmanship.",
].join("\n");

const OPENAI_TOOLS = TOOL_CATALOG.map((t) => ({
  type: "function" as const,
  function: { name: t.name, description: t.description, parameters: t.parameters },
}));

async function postJson(url: string, body: unknown, signal: AbortSignal): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

/** Lightweight reachability probe — one tiny completion, 5 s budget. */
export async function probeLocalModel(cfg: LocalModelConfig, signal?: AbortSignal): Promise<{ ok: boolean; detail: string; latencyMs?: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  const merged = signal ? anySignal([ctrl.signal, signal]) : ctrl.signal;
  const t0 = Date.now();
  try {
    const r = await postJson(
      `${cfg.baseUrl.replace(/\/+$/, "")}/v1/chat/completions`,
      { model: cfg.model, messages: [{ role: "user", content: "ping" }], max_tokens: 1, temperature: 0 },
      merged,
    );
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return { ok: false, detail: `endpoint answered ${r.status}${body ? `: ${body.slice(0, 140)}` : ""}` };
    }
    return { ok: true, detail: `model "${cfg.model}" reachable`, latencyMs: Date.now() - t0 };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return { ok: false, detail: "probe timed out (5 s) or endpoint aborted" };
    return { ok: false, detail: `unreachable: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    clearTimeout(timer);
  }
}

type ToolCall = { id?: string; function?: { name?: string; arguments?: string } };
type ChatChoice = { message?: { role?: string; content?: string | null; tool_calls?: ToolCall[] } };
type ChatResponse = { choices?: ChatChoice[]; error?: { message?: string } };

/**
 * Ask the local model with tools attached. Bounded: 45 s total, ≤4 tool calls,
 * one round of tool follow-up. Throws on failure — callers must fall back.
 */
export async function askLocalModel(cfg: LocalModelConfig, question: string, ctx: DecisionContext, signal?: AbortSignal): Promise<LocalModelAnswer> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  const merged = signal ? anySignal([ctrl.signal, signal]) : ctrl.signal;
  const base = `${cfg.baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;

  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: question },
  ];

  const toolCalls: LocalModelAnswer["toolCalls"] = [];
  try {
    // Round 1 (possibly with tools) → optional Round 2 after tool outputs.
    for (let round = 0; round < 2; round += 1) {
      const r = await postJson(base, { model: cfg.model, messages, tools: OPENAI_TOOLS, tool_choice: "auto", max_tokens: 700, temperature: 0.2 }, merged);
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        throw new Error(`endpoint answered ${r.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
      }
      const data = (await r.json()) as ChatResponse;
      if (data.error?.message) throw new Error(data.error.message);
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error("endpoint returned no message");

      const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
      if (calls.length === 0) {
        const text = (msg.content ?? "").trim();
        if (!text) throw new Error("endpoint returned empty content");
        logCall(cfg.model, toolCalls.length, true, Date.now() - t0);
        return { text, toolCalls, mode: "local-model", model: cfg.model, latencyMs: Date.now() - t0 };
      }
      if (toolCalls.length + calls.length > 4) {
        throw new Error("tool-call budget exceeded (4)");
      }
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls });
      for (const call of calls) {
        const name = String(call.function?.name ?? "");
        let args: Record<string, unknown> | null = null;
        try { args = call.function?.arguments ? (JSON.parse(call.function.arguments) as Record<string, unknown>) : null; } catch { args = null; }
        const output = runTool(name, args, ctx);
        let ok = true;
        try { ok = Boolean((JSON.parse(output) as { ok?: unknown }).ok); } catch { ok = false; }
        toolCalls.push({ name, ok });
        messages.push({ role: "tool", tool_call_id: call.id ?? name, name, content: output });
      }
    }
    throw new Error("model did not finish after its tool rounds");
  } catch (err) {
    logCall(cfg.model, toolCalls.length, false, Date.now() - t0);
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    clearTimeout(timer);
  }
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const ctrl = new AbortController();
  const abort = () => ctrl.abort();
  for (const s of signals) {
    if (s.aborted) return s;
    s.addEventListener("abort", abort, { once: true });
  }
  return ctrl.signal;
}

type CallLogEntry = { ts: string; model: string; toolCount: number; ok: boolean; latencyMs: number };

function logCall(model: string, toolCount: number, ok: boolean, latencyMs: number): void {
  try {
    const raw = window.localStorage.getItem("terrascope.ai.calls.v1");
    const list: CallLogEntry[] = raw ? (JSON.parse(raw) as CallLogEntry[]) : [];
    list.push({ ts: new Date().toISOString(), model, toolCount, ok, latencyMs });
    window.localStorage.setItem("terrascope.ai.calls.v1", JSON.stringify(list.slice(-50)));
  } catch {
    // Call accounting is best-effort; never blocks the answer.
  }
}
