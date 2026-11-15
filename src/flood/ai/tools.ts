// Decision-support tools for the "Ask the map" workspace (R02/R12 support).
// Every tool is deterministic and reads only data the app already loads or
// verified run records. No tool invents a number: missing evidence is reported
// as unavailable, never as zero. Tools return citations so any answer can
// point back to a dataset, a run or a documented gap.
//
// These tools are also the function schemas exposed to a local model (see
// llmAdapter.ts). A model may call them but cannot weaken them.
import { buildFindings } from "../findingsCore.ts";
import { HISTORICAL_ENSO_SERIES } from "../enso.ts";
import type { HistoryRow } from "../historySeries.ts";
import type { ScreeningRun } from "../storage/storageSearch.ts";

export type EvidenceCitation = {
  id: string;
  detail: string;
};

export type ToolResult<T> =
  | { ok: true; value: T; citations: EvidenceCitation[] }
  | { ok: false; reason: string; citations: EvidenceCitation[] };

export type DecisionContext = {
  history: HistoryRow[] | null;
  manifest: Array<{ id: string; retrieved?: string; sha256?: string }>;
  ensoYear: number;
  storageRun: ScreeningRun | null;
  proposalCount: number;
  replayDate: string;
};

const retrieved = (manifest: DecisionContext["manifest"], id: string): string => {
  const m = manifest.find((e) => e.id === id);
  if (!m?.retrieved) return "retrieval date unknown";
  const base = `retrieved ${String(m.retrieved).slice(0, 10)}`;
  return m.sha256 ? `${base}, sha256 ${m.sha256.slice(0, 12)}…` : base;
};

export function toolPeakDischarge(ctx: DecisionContext): ToolResult<{ peakM3s: number; date: string }> {
  if (!ctx.history) {
    return { ok: false, reason: "2015–2024 record unavailable (flow/rain fetch failed)", citations: [{ id: "flow-history", detail: "fetch failed — nothing substituted" }] };
  }
  const flows = ctx.history.filter((r) => r.flow != null) as Array<HistoryRow & { flow: number }>;
  if (flows.length === 0) {
    return { ok: false, reason: "No non-null daily flow values in the local record", citations: [{ id: "flow-history", detail: "empty after filtering nulls" }] };
  }
  let peak = flows[0];
  for (const r of flows) if (r.flow > peak.flow) peak = r;
  return {
    ok: true,
    value: { peakM3s: Math.round(peak.flow), date: peak.date },
    citations: [{ id: "flow-history", detail: `GloFAS via Open-Meteo, ${retrieved(ctx.manifest, "flow-history")}; cell 25.775°N 85.125°E (UTC)` }],
  };
}

export function toolP90Band(ctx: DecisionContext): ToolResult<{ p90M3s: number; aboveCount: number; totalDays: number }> {
  if (!ctx.history) return { ok: false, reason: "2015–2024 record unavailable", citations: [{ id: "flow-history", detail: "fetch failed" }] };
  const flows = ctx.history.filter((r) => r.flow != null).map((r) => r.flow as number).sort((a, b) => a - b);
  if (flows.length === 0) return { ok: false, reason: "No non-null flow values", citations: [{ id: "flow-history", detail: "empty" }] };
  const p90 = flows[Math.ceil(0.9 * flows.length) - 1];
  const above = flows.filter((v) => v >= p90).length;
  return {
    ok: true,
    value: { p90M3s: Math.round(p90), aboveCount: above, totalDays: flows.length },
    citations: [{ id: "flow-history", detail: `descriptive percentile band of ${flows.length} non-null daily values; not an alert threshold` }],
  };
}

export function toolMonsoonAnalogs(ctx: DecisionContext): ToolResult<{ summary: string }> {
  if (!ctx.history) return { ok: false, reason: "2015–2024 record unavailable", citations: [{ id: "rain-history", detail: "fetch failed" }] };
  const parts: string[] = [];
  for (const year of [2022, 2023, 2024]) {
    const rows = ctx.history.filter((r) => r.date.startsWith(`${year}-`) && r.date.slice(5, 7) >= "06" && r.date.slice(5, 7) <= "09" && r.rain != null);
    const oni = HISTORICAL_ENSO_SERIES[year];
    const oniText = oni ? `${oni.phase}, ONI ${oni.oniAnomalyC >= 0 ? "+" : ""}${oni.oniAnomalyC}°C` : "ONI unknown";
    if (rows.length === 0) parts.push(`${year}: no rainfall record (${oniText})`);
    else parts.push(`${year}: ${Math.round(rows.reduce((a, r) => a + (r.rain as number), 0)).toLocaleString("en-GB")} mm (${oniText})`);
  }
  return {
    ok: true,
    value: { summary: parts.join(" · ") },
    citations: [
      { id: "rain-history", detail: `ERA5 via Open-Meteo, ${retrieved(ctx.manifest, "rain-history")}` },
      { id: "enso-oni-table", detail: "NOAA CPC Oceanic Niño Index (ASO), 1991–2020 climatology" },
    ],
  };
}

export function toolEnso(ctx: DecisionContext, year = ctx.ensoYear): ToolResult<{ phase: string; oniC: number }> {
  const oni = HISTORICAL_ENSO_SERIES[year];
  if (!oni) return { ok: false, reason: `ENSO ${year}: not in the local ONI ASO table`, citations: [{ id: "enso-oni-table", detail: "no record for this year; do not infer one" }] };
  return {
    ok: true,
    value: { phase: oni.phase, oniC: oni.oniAnomalyC },
    citations: [{ id: "enso-oni-table", detail: `NOAA CPC ONI (ASO) ${year}: ${oni.phase}, ONI ${oni.oniAnomalyC >= 0 ? "+" : ""}${oni.oniAnomalyC}°C` }],
  };
}

export function toolStorageCandidates(ctx: DecisionContext, limit = 5): ToolResult<{ total: number; top: Array<{ id: string; label: string; capacityM3: number; maxDepthToSpillM: number }> }> {
  if (!ctx.storageRun) {
    return { ok: false, reason: "Storage screening has not completed for this session", citations: [{ id: "storage-screening", detail: "no completed run record" }] };
  }
  const top = [...ctx.storageRun.candidates]
    .sort((a, b) => b.geometricCapacityM3 - a.geometricCapacityM3)
    .slice(0, limit)
    .map((c) => ({ id: c.id, label: c.label, capacityM3: Math.round(c.geometricCapacityM3), maxDepthToSpillM: Number(c.maximumDepthToSpillM.toFixed(2)) }));
  return {
    ok: true,
    value: { total: ctx.storageRun.candidateCountTotal, top },
    citations: [
      { id: "storage-screening", detail: `deterministic terrain screening (${ctx.storageRun.provenance.terrainSource}, ${ctx.storageRun.tilesFetched}/${ctx.storageRun.tilesTotal} tiles, config ${ctx.storageRun.configHash.slice(0, 12)}…)` },
    ],
  };
}

export function toolStorageDetail(ctx: DecisionContext, id: string): ToolResult<{ found: boolean } & Record<string, unknown>> {
  const candidate = ctx.storageRun?.candidates.find((c) => c.id === id);
  if (!candidate) {
    return { ok: false, reason: `Candidate ${id} is not in this session's screening record`, citations: [{ id: "storage-screening", detail: "no such candidate" }] };
  }
  return {
    ok: true,
    value: {
      found: true,
      id: candidate.id,
      label: candidate.label,
      centroid: candidate.centroid,
      capacityM3: Math.round(candidate.geometricCapacityM3),
      maxDepthToSpillM: candidate.maximumDepthToSpillM,
      footprintM2: candidate.footprintAreaM2,
      spillElevationM: candidate.spillElevationM,
      runLimitations: ctx.storageRun?.limitations ?? [],
    },
    citations: [{ id: "storage-screening", detail: `candidate ${candidate.id}, geometric capacity only; not surveyed, not validated` }],
  };
}

export function toolDataSources(ctx: DecisionContext): ToolResult<{ ids: string[] }> {
  const ids = ctx.manifest.map((m) => m.id);
  return {
    ok: true,
    value: { ids },
    citations: [{ id: "manifest", detail: `${ctx.manifest.length} manifest entries; each carries source, retrieval date and hash — see Data & sources` }],
  };
}

export function toolNrscCoverage(): ToolResult<{ window: string }> {
  return {
    ok: true,
    value: { window: "1–2 Oct 2024 only, bounds 85.05–85.3E / 25.6–25.85N" },
    citations: [{ id: "nrsc-flood", detail: "NRSC/ISRO display maps retrieved 2026-11-04; outside these dates/levels nothing is known from this source" }],
  };
}

export function toolFindings(ctx: DecisionContext): ToolResult<{ titles: string[] }> {
  const findings = buildFindings({
    history: ctx.history,
    manifest: ctx.manifest,
    storageRun: ctx.storageRun,
    proposalCount: ctx.proposalCount,
    replayDate: ctx.replayDate,
    ensoYear: ctx.ensoYear,
  });
  return {
    ok: true,
    value: { titles: findings.map((f) => f.title) },
    citations: findings.slice(0, 6).map((f) => ({ id: f.id, detail: f.evidence })),
  };
}

/** Tool catalog exported to a local model (name, description, JSON schema). */
export const TOOL_CATALOG = [
  { name: "peak_discharge", description: "Peak daily GloFAS-modeled discharge and date for the 2015–2024 record", parameters: { type: "object", properties: {}, required: [] } },
  { name: "p90_band", description: "Descriptive top-10% discharge band over the 2015–2024 record", parameters: { type: "object", properties: {}, required: [] } },
  { name: "monsoon_analogs", description: "Jun–Sep rainfall 2022–2024 totals with ONI context", parameters: { type: "object", properties: {}, required: [] } },
  { name: "enso_context", description: "ONI (ASO) phase/anomaly for a year in the local table", parameters: { type: "object", properties: { year: { type: "integer" } }, required: [] } },
  { name: "storage_candidates", description: "Total and top-N geometric capacities from the terrain screening", parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 10 } }, required: [] } },
  { name: "storage_detail", description: "One candidate from the screening record by id", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "data_sources", description: "Datasets registered in the source manifest", parameters: { type: "object", properties: {}, required: [] } },
  { name: "nrsc_coverage", description: "Dates and bounds with observed NRSC flood imagery", parameters: { type: "object", properties: {}, required: [] } },
  { name: "current_findings", description: "Titles of the auto-derived findings currently shown in the workspace", parameters: { type: "object", properties: {}, required: [] } },
] as const;

/** Dispatch one tool call. Unknown tools are rejected, never ignored. */
export function runTool(name: string, args: Record<string, unknown> | null, ctx: DecisionContext): string {
  const a = args ?? {};
  switch (name) {
    case "peak_discharge": return json(toolPeakDischarge(ctx));
    case "p90_band": return json(toolP90Band(ctx));
    case "monsoon_analogs": return json(toolMonsoonAnalogs(ctx));
    case "enso_context": {
      const year = Number.isInteger(a.year) ? (a.year as number) : ctx.ensoYear;
      return json(toolEnso(ctx, year));
    }
    case "storage_candidates": {
      const limit = typeof a.limit === "number" && a.limit >= 1 && a.limit <= 10 ? Math.floor(a.limit) : 5;
      return json(toolStorageCandidates(ctx, limit));
    }
    case "storage_detail": return json(toolStorageDetail(ctx, String(a.id ?? "")));
    case "data_sources": return json(toolDataSources(ctx));
    case "nrsc_coverage": return json(toolNrscCoverage());
    case "current_findings": return json(toolFindings(ctx));
    default: return JSON.stringify({ ok: false, reason: `Unknown tool "${name}" — rejected by the registry. Registered tools: ${TOOL_CATALOG.map((t) => t.name).join(", ")}`, citations: [] });
  }
}

const json = (result: ToolResult<unknown>): string => JSON.stringify(result);
