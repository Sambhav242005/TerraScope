// Meaningful findings for the review area, generated without per-step prompting (R15).
// Every finding is traceable to a local dataset or run record and is descriptive, not a warning.
import { HISTORICAL_ENSO_SERIES } from "./enso.ts";
import type { ScreeningRun } from "./storage/storageSearch.ts";
import type { HistoryRow } from "./historySeries.ts";

export type FindingTone = "info" | "watch";
export type Finding = {
  id: string;
  title: string;
  detail: string;
  evidence: string;
  tone: FindingTone;
};

export type FindingsInput = {
  history: HistoryRow[] | null;
  manifest: Array<{ id: string; retrieved?: string; sha256?: string }>;
  storageRun: ScreeningRun | null;
  proposalCount: number;
  replayDate: string;
  ensoYear: number;
};

const monsoon = (iso: string) => iso.slice(5, 7) >= "06" && iso.slice(5, 7) <= "09";

function retrieved(manifest: FindingsInput["manifest"], id: string): string {
  const m = manifest.find((e) => e.id === id);
  if (!m?.retrieved) return "retrieval date unknown";
  return `retrieved ${String(m.retrieved).slice(0, 10)}${m.sha256 ? `, sha256 ${m.sha256.slice(0, 12)}…` : ""}`;
}

export function buildFindings(input: FindingsInput): Finding[] {
  const { history, manifest, storageRun, proposalCount, replayDate, ensoYear } = input;
  const findings: Finding[] = [];

  if (!history) {
    findings.push({
      id: "history-unavailable",
      title: "2015–2024 record unavailable",
      detail: "Flow and rainfall findings were skipped. Nothing is substituted or treated as zero.",
      evidence: "flow-history.json / rain-history.json fetch failed",
      tone: "watch",
    });
  } else {
    const withFlow = history.filter((r) => r.flow != null);
    const flows = withFlow.map((r) => r.flow as number);
    if (flows.length > 0) {
      let peak = flows[0];
      let peakDate = withFlow[0].date;
      for (const r of withFlow) {
        if ((r.flow as number) > peak) {
          peak = r.flow as number;
          peakDate = r.date;
        }
      }
      findings.push({
        id: "peak-flow",
        title: `2015–2024 peak discharge: ${Math.round(peak).toLocaleString("en-GB")} m³/s (${peakDate})`,
        detail:
          "GloFAS modeled output at the 25.775°N, 85.125°E cell (UTC day). Not a gauge record and not an issue-time forecast; river-cell assignment is unverified.",
        evidence: `flow-history.json · ${retrieved(manifest, "flow-history")} · GloFAS via Open-Meteo`,
        tone: "info",
      });
      const sorted = [...flows].sort((a, b) => a - b);
      const p90 = sorted[Math.ceil(0.9 * sorted.length) - 1];
      const above = flows.filter((v) => v >= p90).length;
      findings.push({
        id: "p90-days",
        title: `${above} of ${flows.length} days sit in the record's top 10% (≥ ${Math.round(p90).toLocaleString("en-GB")} m³/s)`,
        detail:
          "Descriptive percentile band of this one sample cell over ten years. Not an alert threshold, severity class or advice; exceedance of it is not a hazard warning.",
        evidence: `flow-history.json · computed from ${flows.length} non-null daily values`,
        tone: "info",
      });

      // Monsoon rain totals for the last three years with ONI phases, as context.
      const monsoonYears = [2022, 2023, 2024];
      const parts: string[] = [];
      for (const year of monsoonYears) {
        const rows = history.filter((r) => r.date.startsWith(`${year}-`) && monsoon(r.date) && r.rain != null);
        if (rows.length === 0) {
          parts.push(`${year}: no rainfall record`);
          continue;
        }
        const total = rows.reduce((a, r) => a + (r.rain as number), 0);
        const oni = HISTORICAL_ENSO_SERIES[year];
        parts.push(
          `${year}: ${Math.round(total).toLocaleString("en-GB")} mm (${oni ? `${oni.phase}, ONI ${oni.oniAnomalyC > 0 ? "+" : ""}${oni.oniAnomalyC}°C` : "ONI unknown"})`,
        );
      }
      findings.push({
        id: "monsoon-analogs",
        title: "Jun–Sep rainfall 2022–2024 with ONI context",
        detail: `${parts.join(" · ")}. Three years say nothing about attribution; ENSO is probabilistic context, never a local depth multiplier.`,
        evidence: `rain-history.json · ${retrieved(manifest, "rain-history")} · ERA5 via Open-Meteo; ONI ASO, NOAA CPC`,
        tone: "info",
      });
    }
  }

  const oni = HISTORICAL_ENSO_SERIES[ensoYear];
  findings.push({
    id: "enso-current",
    title: oni ? `${ensoYear} ASO: ${oni.phase} (ONI ${oni.oniAnomalyC > 0 ? "+" : ""}${oni.oniAnomalyC}°C)` : `ENSO ${ensoYear}: not in the local ONI table`,
    detail:
      "ASO running-mean ONI for the selected event year. Analyzed index, not a forecast issued before the event; see the ENSO context panel for the dated series and analogs.",
    evidence: "NOAA CPC Oceanic Niño Index (ERSST.v5, 1991–2020 climatology)",
    tone: "info",
  });

  findings.push({
    id: "nrsc-window",
    title: "Observed NRSC coverage: 1–2 Oct 2024 only",
    detail: `No observed footprint exists inside this replay window for any other date; ${replayDate >= "2024-10-01" && replayDate <= "2024-10-02" ? `the replayed day (${replayDate}) is one of them.` : `the replayed day (${replayDate}) is not covered — nothing is interpolated.`} Unmarked pixels are unknown, never dry or safe.`,
    evidence: "NRSC/ISRO display maps, retrieved 2026-11-04, bounds 85.05–85.3E 25.6–25.85N",
    tone: "info",
  });

  if (storageRun) {
    if (storageRun.status === "succeeded") {
      findings.push({
        id: "storage-run",
        title: `${storageRun.candidateCountTotal.toLocaleString("en-GB")} candidate depressions screened`,
        detail:
          "Geometric DEM depressions with OSM mapped-water evidence. Terrain screening only: no catchments, outlets, bathymetry, water volume or land-rights assessment.",
        evidence: `storage run ${storageRun.id} · config ${storageRun.configHash.slice(0, 12)} · ${storageRun.tilesFetched}/${storageRun.tilesTotal} tiles`,
        tone: "info",
      });
    } else {
      findings.push({
        id: "storage-run",
        title: `Candidate screening ${storageRun.status}`,
        detail: storageRun.error ?? "No result was produced; terrain and analysis inputs stay unknown.",
        evidence: `storage run ${storageRun.id} · ${storageRun.status} started ${new Date(storageRun.startedAt).toLocaleString("en-GB")}`,
        tone: "watch",
      });
    }
  }

  if (proposalCount > 0) {
    findings.push({
      id: "proposals",
      title: `${proposalCount} proposed intervention${proposalCount === 1 ? "" : "s"} placed`,
      detail:
        "Proposals are reversible and are not calculation inputs. Placement checks verify map conflicts only; no effect model, approval or suitability is implied.",
      evidence: "saved interventions (this device); placement screening evidence",
      tone: "info",
    });
  }

  return findings;
}
