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
        baseUrl: String(parsed.baseUrl ?? "http://127.0.0.1:11434"),
        model: String(parsed.model ?? ""),
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      };
    }
  } catch {
    // corrupted config → defaults
  }
  return { baseUrl: "http://127.0.0.1:11434", model: "", apiKey: "" };
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

export default function DecisionDesk({
  context,
  onClose,
}: {
  context: DecisionContext;
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
    const result = await probeLocalModel(config);
    setProbe(result.ok ? "ok" : "fail");
    setProbeDetail(
      result.ok
        ? `${result.detail}${result.latencyMs != null ? ` · ${result.latencyMs} ms` : ""}`
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
          <p>Evidence-backed answers for whoever steers the decision. Not a forecaster, not an engineer, not an authority.</p>
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

      <details className="desk-config">
        <summary>Local model (optional) — bring your own</summary>
        <button type="button" className="desk-preset" onClick={() => { setConfig({ ...config, baseUrl: "https://api.groq.com/openai/v1", model: "qwen/qwen3.8-27b" }); setProbe("idle"); setProbeDetail(""); }}>
          Groq preset: qwen/qwen3.8-27b
        </button>
        <label>
          Base URL
          <input
            type="url"
            value={config.baseUrl}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder="http://127.0.0.1:11434"
            aria-label="Local model base URL"
          />
        </label>
        <label>
          Model name
          <input
            type="text"
            value={config.model}
            onChange={(e) => { setConfig({ ...config, model: e.target.value }); setProbe("idle"); }}
            placeholder="e.g. qwen/qwen3.8-27b (Groq) or qwen2.5:7b (Ollama)"
            aria-label="Local model name"
          />
        </label>
        <label>
          API key (optional — stored only in this browser, never in the app)
          <input
            type="password"
            value={config.apiKey ?? ""}
            onChange={(e) => { setConfig({ ...config, apiKey: e.target.value }); setProbe("idle"); }}
            placeholder="Only if your endpoint requires one (e.g. Groq)"
            aria-label="API key for the model endpoint"
            autoComplete="off"
          />
        </label>
        <button type="button" onClick={() => void checkConnection()} disabled={probe === "checking" || !modelConfigured}>
          {probe === "checking" ? <Loader2 size={13} className="spin" aria-hidden="true" /> : null}
          {probe === "checking" ? "Checking…" : "Check connection"}
        </button>
        {probeDetail && (
          <p className={`desk-probe-detail desk-probe-${probe}`} role="status">
            {probeDetail}
          </p>
        )}
        <p className="desk-config-note">
          Any OpenAI-compatible endpoint works (Ollama at 127.0.0.1:11434, llama.cpp server, LM Studio — or cloud such as Groq). The model gets the same workspace tools as the offline responder: it can call them, never invent numbers, and never send anything. If the base URL is not this machine’s localhost (e.g. Groq), your questions and workspace snippets are sent there and it is labelled cloud — not local AI. Keys are stored only in this browser’s localStorage; they are never committed to the repository. Without a reachable model, answers use deterministic evidence. Free-tier Groq can be over capacity or rate-limited; when the model fails, the answer falls back to deterministic evidence and says so.
        </p>
      </details>

      <div className="desk-drafts">
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
          Both drafts download a markdown file for a human to review. TerraScope never sends, posts or registers anything; issuing a warning or an order is exclusively the authorised officer’s act.
        </p>
      </div>
    </section>
  );
}
