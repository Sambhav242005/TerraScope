// Offline decision-support responder (R02/R12 scaffolding).
//
// HONEST MODE: this is a deterministic evidence responder, NOT a language model.
// It matches the question to the app's own datasets/run records and answers
// with cited values. It cannot discuss flood physics beyond those sources,
// never invents measurements and refuses when evidence is missing.
// When a local model is reachable (see llmAdapter.ts), the same tools feed it;
// this module remains the fallback and the no-model demo path.
import {
  toolDataSources,
  toolEnso,
  toolFindings,
  toolMonsoonAnalogs,
  toolNrscCoverage,
  toolP90Band,
  toolPeakDischarge,
  toolStorageCandidates,
  type DecisionContext,
  type EvidenceCitation,
} from "./tools.ts";

export type DecisionAnswer = {
  text: string;
  citations: EvidenceCitation[];
  /** What confidence the answer deserves; honest labeling, never "verified". */
  mode: "deterministic-evidence";
};

const DISCLAIMER =
  "Deterministic evidence answer — local AI is not connected. Figures come from the app's data and run records, not from a model. This is not a forecast, not engineering advice, and not an authorisation to act.";

type Intent =
  | "greeting"
  | "storage"
  | "peak"
  | "p90"
  | "monsoon"
  | "enso"
  | "nrsc"
  | "sources"
  | "findings"
  | "plan"
  | "advisory"
  | "help"
  | "unknown";

function classify(question: string): Intent {
  const q = question.toLowerCase();
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const has = (...words: string[]) => words.some((w) => new RegExp(`\\b${escape(w)}`, "i").test(q));
  if (has("hello", "hi ", "hii", "hey")) return "greeting";
  if (has("peak", "highest flow", "maximum flow", "max discharge")) return "peak";
  if (has("p90", "90th", "top 10", "percentile")) return "p90";
  if (has("monsoon", "rain", "rainfall", "2022", "2023", "2024")) return "monsoon";
  if (has("enso", "nino", "niña", "el niño", "el nino", "la niña", "la nina", "oni")) return "enso";
  if (has("nrsc", "satellite", "imagery", "snapshot", "inset")) return "nrsc";
  if (has("advisor", "advisory", "alert", "warning", "broadcast", "evacuate")) return "advisory";
  if (has("plan", "counter-plan", "counter plan", "proposal", "compare", "strategy")) return "plan";
  if (has("storage", "candidate", "depression", "reservoir", "pond", "basin", "bowl")) return "storage";
  if (has("source", "data", "manifest", "dataset")) return "sources";
  if (has("finding", "insight", "takeaway", "what am i seeing")) return "findings";
  if (has("help", "what can you", "what do you know", "capabilities")) return "help";
  return "unknown";
}

const helpText =
  "I can answer from this workspace's evidence: the 2015–2024 GloFAS/ERA5 record (peak, top-10% band, monsoon rainfall vs ONI context), the terrain-screening storage candidates, NRSC observed imagery coverage (1–2 Oct 2024 only), the datasets in the manifest, and the findings shown in Explore. Ask me things like “peak flow?”, “storage candidates?”, “how did the 2024 monsoon look?”, or “what does the evidence support for a pre-monsoon brief?”. I will not issue warnings, declare routes safe or certify a structure — those stay with authorised officials and field surveys.";

export function answerQuestion(question: string, ctx: DecisionContext): DecisionAnswer {
  const intent = classify(question);
  const cites: EvidenceCitation[] = [];
  let text = "";

  switch (intent) {
    case "greeting":
      text = "Hello. I'm the evidence desk for this workspace — not a language model and not a forecaster. Ask me about the river record, the storage screening, the data sources, or the findings; or ask for a pre-monsoon brief draft.";
      break;
    case "peak": {
      const r = toolPeakDischarge(ctx);
      cites.push(...r.citations);
      text = r.ok
        ? `The 2015–2024 local record peaks at ${r.value.peakM3s.toLocaleString("en-GB")} m³/s on ${r.value.date}. GloFAS modeled output at the sample cell — not a gauge record, not an issue-time forecast, and the cell assignment is unverified.`
        : `I can't state a peak — ${r.reason}. Missing evidence is not zero.`;
      break;
    }
    case "p90": {
      const r = toolP90Band(ctx);
      cites.push(...r.citations);
      text = r.ok
        ? `${r.value.aboveCount} of ${r.value.totalDays} days in the local record sit at or above ${r.value.p90M3s.toLocaleString("en-GB")} m³/s (the record's top 10%). This is a descriptive percentile of one sample cell, not an alert threshold or severity class.`
        : `I can't state the band — ${r.reason}.`;
      break;
    }
    case "monsoon": {
      const r = toolMonsoonAnalogs(ctx);
      cites.push(...r.citations);
      text = r.ok
        ? `Jun–Sep rainfall with ONI context: ${r.value.summary}. Three years say nothing about attribution or local depth; ENSO is probabilistic context, never a multiplier you can apply to a local forecast.`
        : `I can't compare monsoons — ${r.reason}.`;
      break;
    }
    case "enso": {
      const year = ctx.ensoYear;
      const r = toolEnso(ctx, year);
      cites.push(...r.citations);
      text = r.ok
        ? `${year} ASO context: ${r.value.phase}, ONI ${r.value.oniC >= 0 ? "+" : ""}${r.value.oniC}°C. This is an analyzed index for the selected event year, not a forecast issued before it. The dated 12 Nov 2026 El Niño Advisory is context a human reviewer can open from the ENSO badge; it is deliberately not an app input.`
        : `${r.reason}.`;
      break;
    }
    case "nrsc": {
      const r = toolNrscCoverage();
      cites.push(...r.citations);
      text = r.ok
        ? `Observed NRSC coverage in this workspace: ${r.value.window}. Unmarked pixels are unknown, never dry or safe; no observed footprint exists for any other date, and nothing is interpolated.`
        : `I can't state the NRSC window — ${r.reason}.`;
      break;
    }
    case "storage": {
      const r = toolStorageCandidates(ctx, 3);
      cites.push(...r.citations);
      if (!r.ok) {
        text = `The storage screening hasn't produced usable results yet — ${r.reason}. Re-run it from the candidates card and ask again.`;
      } else {
        const top = r.value.top.map((c) => `${c.label ?? c.id}: ${c.capacityM3.toLocaleString("en-GB")} m³ to spill (max depth ${c.maxDepthToSpillM.toFixed(1)} m)`).join("; ");
        text = `${r.value.total} DEM depressions screened so far. Top geometric capacities: ${top}. All figures are geometric bowl capacities of terrain-grid cells, not surveyed reservoirs, not contributing-watershed routing, and not available storm storage. Suitability is unassessed.`;
      }
      break;
    }
    case "sources": {
      const r = toolDataSources(ctx);
      cites.push(...r.citations);
      text = r.ok
        ? `The manifest registers these datasets: ${r.value.ids.join(", ")}. Each carries source, retrieval date and hash. Open “Data & sources” for licences, provenance and the onboarding verdicts.`
        : `I can't list the manifest — ${r.reason}.`;
      break;
    }
    case "findings": {
      const r = toolFindings(ctx);
      cites.push(...r.citations);
      if (!r.ok) {
        text = `I can't read the findings — ${r.reason}.`;
      } else {
        text = r.value.titles.length
          ? `The workspace findings currently read: ${r.value.titles.map((t, i) => `${i + 1}. ${t}`).join(" ")} Details and evidence IDs are in the findings card.`
          : "No findings are available yet.";
      }
      break;
    }
    case "advisory":
      text =
        "I cannot issue or broadcast any advisory, alert or order — and nobody should allow software to. What I can do: draft a pre-monsoon brief for a human authorised officer (use “Draft pre-monsoon advisory” below), listing observed coverage, the modeled record, screening results and missing evidence, clearly marked as a draft. The officer, not this tool, decides and sends. Official warnings remain with NDMA/IMD/CWC and the district administration.";
      cites.push({ id: "protocol", detail: "this workspace never transmits alerts; drafting only, human approval required" });
      break;
    case "plan":
      text =
        "A plan/counter-plan comparison must stay tied to runs and data, never to rhetoric. Use “Draft decision brief” below: it assembles the peak band, monsoon/ENSO context, NRSC coverage and the top storage candidates into a one-page brief with explicit unknowns, ready for a planning meeting. The comparison it scaffolds is between “act on the current screening” and “do nothing pending survey” — both with consequences, both cited. I will not pick between them for you.";
      cites.push({ id: "protocol", detail: "decision support only; the accountable planner chooses and owns the action" });
      break;
    case "help":
      text = helpText;
      break;
    case "unknown":
    default:
      text = `I don't have grounded evidence for that in this workspace. ${helpText}`;
      break;
  }

  return { text, citations: cites, mode: "deterministic-evidence" };
}

