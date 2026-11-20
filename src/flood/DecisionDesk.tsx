// "Ask the map" — decision workspace for anyone steering the decision
// (R02/R12 scaffolding; honestly labeled).
//
// Two honest paths:
//  1. No model configured (default): a deterministic evidence responder answers
//     from the workspace's own datasets and run records, cited per claim.
//  2. A local OpenAI-compatible model is configured and reachable: the same
//     workspace tools are attached; the model may call them; answers carry
//     the model name. If the probe/call fails, the panel falls back to path 1
//     and says so.
//
// Hard boundaries (never relaxed by this component):
//  - The app never sends alerts, advisories, orders or messages to anyone.
//    "Draft pre-monsoon advisory" downloads a reviewed-local markdown file
//    for a human authorised officer to issue, edit or discard.
//  - No number appears that is not in the workspace's evidence or tool output.
//  - Findings are not forecasts; nothing here replaces IMD/CWC bulletins or
//    district administration decisions.
import { useEffect, useMemo, useRef, useState } from "react";
import "../decision-desk.css";
import {
  BadgeCheck,
  CircleDashed,
  Copy,
  Download,
  Loader2,
  MessagesSquare,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { answerQuestion, type DecisionAnswer } from "./ai/responder";
import {
  buildDecisionBrief,
  buildPreMonsoonAdvisory,
} from "./ai/drafts";
import {
  askLocalModel,
  probeLocalModel,
  type LocalModelConfig,
} from "./ai/llmAdapter";
import type { DecisionContext, EvidenceCitation } from "./ai/tools";
import { LOCAL_MODEL_PRESET } from "./ai/localPreset";
import { askPlanningAction, type PlanningAction, type PlanningSnapshot } from "./ai/planning";

type DeskMessage = {
  role: "user" | "assistant";
  text: string;
  mode?: "deterministic-evidence" | "local-model" | "fallback";
  citations?: EvidenceCitation[];
  toolCalls?: Array<{ name: string; ok: boolean }>;
  model?: string;
};

const CONFIG_KEY = "terrascope.ai.config.v1";

function loadConfig(): LocalModelConfig {
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalModelConfig>;
      return {
        baseUrl: String(parsed.baseUrl ?? LOCAL_MODEL_PRESET.baseUrl),
        model: String(parsed.model ?? LOCAL_MODEL_PRESET.model),
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      };
    }
  } catch {
    // corrupted config → defaults
  }
  return { ...LOCAL_MODEL_PRESET };
}

function isLocalHost(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

function saveConfig(cfg: LocalModelConfig): void {
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    // best effort
  }
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const QUICK_PROMPTS = [
  "What's the peak in the local record?",
  "Which storage candidates matter?",
  "How did the 2024 monsoon look vs ENSO?",
  "What NRSC imagery exists?",
  "What does the evidence support for a pre-monsoon brief?",
];

function describeAction(action: PlanningAction, snapshot: PlanningSnapshot): string {
  switch (action.kind) {
    case "focus-candidate": return `Focus storage candidate #${action.candidateId}`;
    case "adopt-candidate": return `Add a planned basin for candidate #${action.candidateId}`;
    case "remove-proposal": return `Remove proposal ${action.proposalId}`;
    case "show-evidence": return `Open evidence ${action.evidenceId}`;
    case "undo": return `Undo last placement (${snapshot.proposalIds.at(-1) ?? "none"})`;
  }
}

// Require explicit intent before inference, and compare it with the returned
// action. A schema-valid action can still be unrelated to the user's request.
function requestedAction(question: string): string | null {
  const command = question.trim().replace(/[.!?]$/, "");
  if (/^undo(?: the)? last placement$/i.test(command)) return "undo";
  const match = /^(focus candidate|adopt candidate|remove proposal|show evidence) #?([\w-]+)$/i.exec(command);
  return match ? `${match[1].toLowerCase().replace(" ", "-")} ${match[2]}` : null;
}

function actionIntent(action: PlanningAction): string {
  switch (action.kind) {
    case "focus-candidate":
    case "adopt-candidate": return `${action.kind} ${action.candidateId}`;
    case "remove-proposal": return `${action.kind} ${action.proposalId}`;
    case "show-evidence": return `${action.kind} ${action.evidenceId}`;
    case "undo": return action.kind;
  }
}

export default function DecisionDesk({
  context,
  planningSnapshot,
  onApplyPlanningAction,
  onClose,
}: {
  context: DecisionContext;
  planningSnapshot: PlanningSnapshot;
  onApplyPlanningAction: (action: PlanningAction) => string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<DeskMessage[]>(() => [
    {
      role: "assistant",
      mode: "deterministic-evidence",
      text: "I’m the evidence desk for this workspace — not a forecaster, not a language model (unless you connect one below), and never an authority. Ask about the 2015–2024 record, the storage screening, NRSC coverage or the findings. I can also draft a pre-monsoon brief or a decision brief for a human officer to review.",
      citations: [{ id: "protocol", detail: "decision support only; nothing is sent, posted or authorised by this app" }],
    },
  ]);
  const [action, setAction] = useState<PlanningAction | null>(null);
  const [actionStatus, setActionStatus] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<LocalModelConfig>(() => loadConfig());
  const [probe, setProbe] = useState<"idle" | "checking" | "ok" | "fail">("idle");
  const [probeDetail, setProbeDetail] = useState("");
  const [audience, setAudience] = useState("District Disaster Management Authority / SDM, Sonpur");
  const [copied, setCopied] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, busy]);

  const modelConfigured = config.model.trim().length > 0;
  const localActive = probe === "ok" && modelConfigured;
  const cloudEndpoint = modelConfigured && !isLocalHost(config.baseUrl);
  const planningEnabled = localActive && config.baseUrl === LOCAL_MODEL_PRESET.baseUrl &&
    config.model === LOCAL_MODEL_PRESET.model && !config.apiKey;
  const actionStale = action !== null && action.revision !== planningSnapshot.revision;

  const proposeAction = async () => {
    if (!planningEnabled || busy || !input.trim()) return;
    setAction(null);
    const intent = requestedAction(input);
    if (!intent) {
      setActionStatus("Unsupported action. Use a listed map command and its exact ID.");
      return;
    }
    setBusy(true);
    setActionStatus("Checking the requested map action?");
    try {
      const proposal = await askPlanningAction(LOCAL_MODEL_PRESET, input.trim(), planningSnapshot);
      if (actionIntent(proposal) !== intent) throw new Error("The proposed action did not match your request.");
      setAction(proposal);
      setActionStatus("Map action ready for confirmation.");
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "No supported map action was proposed.");
    } finally {
      setBusy(false);
    }
  };

  const applyAction = () => {
    if (!action || !planningEnabled || busy) return;
    setAction(null);
    try {
      setActionStatus(onApplyPlanningAction(action));
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "The map action could not be applied.");
    }
  };

  const changeConfig = (next: LocalModelConfig) => {
    setConfig(next);
    setProbe("idle");
    setProbeDetail("");
    setAction(null);
    setActionStatus("");
  };

  const send = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || busy) return;
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    try {
      if (localActive) {
        try {
          const answer = await askLocalModel(config, question, context);
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              mode: "local-model",
              model: answer.model,
              text: answer.text,
              toolCalls: answer.toolCalls,
              citations: answer.toolCalls.map((c) => ({ id: `tool:${c.name}`, detail: c.ok ? "executed, ok" : "rejected by registry or failed" })),
            },
          ]);
          return;
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          const fallback: DecisionAnswer = answerQuestion(question, context);
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              mode: "fallback",
              text: `Local model unavailable (${reason.slice(0, 160)}). Showing the deterministic evidence answer instead:\n\n${fallback.text}`,
              citations: fallback.citations,
            },
          ]);
          return;
        }
      }
      const answer = answerQuestion(question, context);
      setMessages((m) => [...m, { role: "assistant", mode: answer.mode, text: answer.text, citations: answer.citations }]);
    } finally {
      setBusy(false);
    }
  };

  const checkConnection = async () => {
    saveConfig(config);
    setProbe("checking");
    setProbeDetail("");
    const loopback = isLocalHost(config.baseUrl);
    if (loopback) {
      // Browsers that have no granular permission descriptor still enforce their network policy.
      const permission = await navigator.permissions?.query({ name: "loopback-network" as PermissionName }).catch(() => null);
      if (permission?.state === "denied") {
        setProbe("fail");
        setProbeDetail("Allow local-network access for this site in browser settings, then check again.");
        return;
      }
    }
    const result = await probeLocalModel(config);
    setProbe(result.ok ? "ok" : "fail");
    setProbeDetail(
      result.ok
        ? `${result.detail}${result.latencyMs != null ? ` · ${result.latencyMs} ms` : ""}`
        : loopback
          ? `${result.detail}. Check the same-device server and browser local-network access. On a hosted page, the server must allow this exact site origin. You can also open the local TerraScope UI on this device.`
          : result.detail,
    );
  };

  const copy = async (idx: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(String(idx));
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      // clipboard may be unavailable; the text is visible anyway
    }
  };

  const modeChip = useMemo(() => {
    if (localActive) {
      return cloudEndpoint
        ? { label: `Cloud endpoint (${new URL(config.baseUrl).hostname}) — not local inference; questions leave this machine`, tone: "warn" as const }
        : { label: "Local model connected", tone: "live" as const };
    }
    if (modelConfigured) return { label: cloudEndpoint ? "Cloud endpoint configured — not connected (key/model needed)" : "Local model configured — not connected", tone: "warn" as const };
    return { label: "Local AI: not connected (deterministic evidence mode)", tone: "info" as const };
  }, [localActive, cloudEndpoint, modelConfigured, config.baseUrl]);

  return (
    <section className="decision-desk" role="dialog" aria-label="Ask the map — decision workspace">
      <header className="desk-header">
        <div>
          <strong>
            <MessagesSquare size={17} aria-hidden="true" /> Ask the map
          </strong>
        </div>
        <button className="desk-close" onClick={onClose} aria-label="Close the decision workspace">
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="desk-status" data-tone={modeChip.tone}>
        {modeChip.tone === "live" ? <BadgeCheck size={14} aria-hidden="true" /> : modeChip.tone === "warn" ? <CircleDashed size={14} aria-hidden="true" /> : <ShieldCheck size={14} aria-hidden="true" />}
        <span>{modeChip.label}</span>
      </div>

      <div className="desk-log" ref={logRef} aria-live="polite">
        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="desk-msg desk-msg-user">{msg.text}</div>
          ) : (
            <div key={i} className="desk-msg desk-msg-assistant">
              <p>{msg.text}</p>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <ul className="desk-tools" aria-label="Tools the model called">
                  {msg.toolCalls.map((c, j) => (
                    <li key={j} className={c.ok ? "tool-ok" : "tool-fail"}>{c.name}{c.ok ? "" : " (rejected)"}</li>
                  ))}
                </ul>
              )}
              {msg.citations && msg.citations.length > 0 && (
                <ul className="desk-citations" aria-label="Evidence cited">
                  {msg.citations.map((c, j) => (
                    <li key={j} title={c.detail}>{c.id}</li>
                  ))}
                </ul>
              )}
              <div className="desk-msg-foot">
                <span className="desk-mode">
                  {msg.mode === "local-model"
                    ? msg.toolCalls && msg.toolCalls.length === 0
                      ? `local model · ${msg.model} · no tools called — unverified`
                      : `local model · ${msg.model} · tools: ${msg.toolCalls?.length ?? 0}`
                    : msg.mode === "fallback"
                      ? "fallback (model unavailable)"
                      : "deterministic evidence"}
                </span>
                <button className="desk-copy" onClick={() => void copy(i, msg.text)} aria-label="Copy answer text">
                  {copied === String(i) ? <BadgeCheck size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                  {copied === String(i) ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="desk-msg desk-msg-assistant desk-pending">
            <Loader2 size={14} className="spin" aria-hidden="true" /> Gathering evidence…
          </div>
        )}
      </div>

      <div className="desk-chips" aria-label="Suggested questions">
        {QUICK_PROMPTS.map((q) => (
          <button key={q} onClick={() => void send(q)} disabled={busy}>{q}</button>
        ))}
      </div>

      <form
        className="desk-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the record, the screening, the data…"
          aria-label="Ask the map a question"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send question">
          <Send size={16} aria-hidden="true" />
        </button>
      </form>

      <div className="desk-config desk-planning">
        <button type="button" onClick={() => void proposeAction()} disabled={!planningEnabled || busy || !input.trim()}>
          Propose map action
        </button>
        <p className="desk-config-note">{planningEnabled
          ? "Commands: Focus candidate ID, Adopt candidate ID, Remove proposal ID, Undo last placement, or Show evidence ID."
          : "Connect the local planning preset to propose a map action."}</p>
        {planningEnabled && (
          <details className="desk-planning-targets">
            <summary>Available map IDs</summary>
            <dl>
              <dt>Candidates</dt><dd>{planningSnapshot.candidateIds.join(", ") || "None"}</dd>
              <dt>Proposals</dt><dd>{planningSnapshot.proposalIds.join(", ") || "None"}</dd>
              <dt>Evidence</dt><dd>{planningSnapshot.evidenceIds.join(", ") || "None"}</dd>
            </dl>
          </details>
        )}
        {action && (
          <div>
            <p>{describeAction(action, planningSnapshot)}</p>
            <button type="button" onClick={applyAction} disabled={actionStale || busy}>Apply map action</button>{" "}
            <button type="button" onClick={() => { setAction(null); setActionStatus(""); }}>Dismiss proposal</button>
          </div>
        )}
        <p className="desk-probe-detail" role="status">{actionStale ? "The workspace changed. Request a new map action." : actionStatus}</p>
      </div>

      <details className="desk-config">
        <summary>Model connection</summary>
        <button type="button" className="desk-preset" disabled={busy || probe === "checking"} onClick={() => changeConfig({ ...LOCAL_MODEL_PRESET })}>
          Use local planning preset ({LOCAL_MODEL_PRESET.model})
        </button>
        <label>
          Base URL
          <input
            type="url"
            value={config.baseUrl}
            onChange={(e) => changeConfig({ ...config, baseUrl: e.target.value })}
            disabled={busy || probe === "checking"}
            placeholder={LOCAL_MODEL_PRESET.baseUrl}
            aria-label="Local model base URL"
          />
        </label>
        <label>
          Model name
          <input
            type="text"
            value={config.model}
            onChange={(e) => changeConfig({ ...config, model: e.target.value })}
            disabled={busy || probe === "checking"}
            placeholder="e.g. qwen/qwen3.8-27b (Groq) or qwen2.5:7b (Ollama)"
            aria-label="Local model name"
          />
        </label>
        <label>
          API key (optional — stored only in this browser, never in the app)
          <input
            type="password"
            value={config.apiKey ?? ""}
            onChange={(e) => changeConfig({ ...config, apiKey: e.target.value })}
            disabled={busy || probe === "checking"}
            placeholder="Only if your endpoint requires one (e.g. Groq)"
            aria-label="API key for the model endpoint"
            autoComplete="off"
          />
        </label>
        <button type="button" onClick={() => void checkConnection()} disabled={busy || probe === "checking" || !modelConfigured}>
          {probe === "checking" ? <Loader2 size={13} className="spin" aria-hidden="true" /> : null}
          {probe === "checking" ? "Checking…" : "Check connection"}
        </button>
        {probeDetail && (
          <p className={`desk-probe-detail desk-probe-${probe}`} role="status">
            {probeDetail}
          </p>
        )}
        <p className="desk-config-note">
          The planning preset uses {LOCAL_MODEL_PRESET.model} on this device at {LOCAL_MODEL_PRESET.baseUrl}.
          Questions sent to a custom cloud endpoint leave this device. Evidence answers fall back to the deterministic responder when inference fails.
        </p>
      </details>

      <details className="desk-drafts">
        <summary>Download draft documents</summary>
        <label className="desk-audience">
          Advisory audience
          <input
            type="text"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            aria-label="Audience for the drafted advisory"
          />
        </label>
        <div className="desk-draft-actions">
          <button type="button" onClick={() => downloadText("pre-monsoon-advisory-draft.md", buildPreMonsoonAdvisory(context, audience).markdown)}>
            <Download size={13} aria-hidden="true" /> Pre-monsoon advisory draft
          </button>
          <button type="button" onClick={() => downloadText("decision-brief-draft.md", buildDecisionBrief(context).markdown)}>
            <Download size={13} aria-hidden="true" /> Decision brief draft
          </button>
        </div>
        <p className="desk-config-note">
          Markdown drafts for review by the authorised officer.
        </p>
      </details>
    </section>
  );
}
