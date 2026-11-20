// Timestamped scenario-result timeline for the shared Explore view.
// Deterministic: same inputs produce the same entries. Missing records are
// explicit gaps — never zero, never interpolated.
import { NRSC_SNAPSHOTS_ENABLED, NRSC_FLOOD_SNAPSHOTS } from "./nrsc.ts";
import type { ScreeningRun } from "./storage/storageSearch";
import type { Intervention } from "./intervention";
import type { RegionalSeries } from "./regionalHistory";

export type ResultState = "available" | "gap" | "input";
export type ResultKind =
  | "rainfall"
  | "discharge"
  | "nrsc"
  | "water-scenario"
  | "storage-run"
  | "intervention";

export type ResultEntry = {
  id: string;
  kind: ResultKind;
  /** Event-window date (YYYY-MM-DD) when bound to a day; null for run/action entries. */
  day: string | null;
  /** ISO 8601 timestamp when the source records one (runs/actions); null for day-bound entries. */
  time: string | null;
  title: string;
  detail: string;
  state: ResultState;
};

export type ResultTimelineInput = {
  /** Event window dates, ISO YYYY-MM-DD, in order. */
  days: string[];
  /** Daily ERA5 rainfall (mm) aligned with days; null when the record is missing. */
  dailyRain: Array<number | null>;
  /** Daily GloFAS discharge (m3/s) aligned with days; null/undefined when missing. */
  discharge: Array<number | null | undefined>;
  waterOn: boolean;
  waterLevel: number;
  storageRun: ScreeningRun | null;
  interventions: Intervention[];
  /** Override for the build constant; tests only. Defaults to NRSC_SNAPSHOTS_ENABLED. */
  nrscEnabled?: boolean;
  regional?: { rain: RegionalSeries | null; flow: RegionalSeries | null };
};

const number = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? null : v;

const fmt = (v: number, digits: number, unit: string) =>
  `${v.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${unit}`;

export function buildResultTimeline(input: ResultTimelineInput): ResultEntry[] {
  const nrscEnabled = input.nrscEnabled ?? NRSC_SNAPSHOTS_ENABLED;
  const { days, dailyRain, discharge, waterOn, waterLevel, storageRun, interventions } = input;
  const entries: ResultEntry[] = [];

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const regionalRain = input.regional?.rain;
    const regionalFlow = input.regional?.flow;
    const rain = number(dailyRain[i] ?? null);
    entries.push({
      id: `rainfall-${day}`,
      kind: "rainfall",
      day,
      time: null,
      title: rain == null ? "ERA5 rainfall — no record" : `ERA5 rainfall — ${fmt(rain, 1, "mm")}`,
      detail: input.regional ? (regionalRain ? `UTC day ${day} · ERA5 at ${regionalRain.latitude}, ${regionalRain.longitude} · ${regionalRain.resolution} · sample-cell precipitation, not catchment rainfall. Response ${regionalRain.sha256}.` : `Selected-area rainfall unavailable for ${day}.`) :
        rain == null
          ? `No ERA5 record for ${day}; missing data is not zero and missing hourly values are not interpolated. Sample cell 26.5°N, 84.25°E (IST day).`
          : `IST day ${day} · ERA5 sample cell 26.5°N, 84.25°E · hourly reanalysis summed; not catchment-average or gauge rainfall.`,
      state: rain == null ? "gap" : "available",
    });

    const flow = number(discharge?.[i]);
    entries.push({
      id: `discharge-${day}`,
      kind: "discharge",
      day,
      time: null,
      title: flow == null ? "GloFAS discharge — no record" : `GloFAS discharge — ${fmt(flow, 0, "m³/s")}`,
      detail: input.regional ? (regionalFlow ? `UTC day ${day} · GloFAS at ${regionalFlow.latitude}, ${regionalFlow.longitude} · ${regionalFlow.resolution} · river match unverified. Response ${regionalFlow.sha256}.` : `Selected-area discharge unavailable for ${day}.`) :
        flow == null
          ? `No GloFAS record for ${day}; missing data is not zero. Model output, not a gauge observation.`
          : `UTC day ${day} · GloFAS model at 25.775°N, 85.125°E · not a gauge reading or an issue-time forecast.`,
      state: flow == null ? "gap" : "available",
    });

    const snapshot = nrscEnabled && !input.regional
      ? NRSC_FLOOD_SNAPSHOTS.find((s) => s.id.startsWith(day))
      : undefined;
    const DAYS_OBSERVED = ["2024-10-01", "2024-10-02"];
    const withheld = !input.regional && !nrscEnabled && DAYS_OBSERVED.includes(day);
    entries.push(
      snapshot
        ? {
            id: `nrsc-${snapshot.id}`,
            kind: "nrsc",
            day,
            time: null,
            title: "NRSC observed snapshot",
            detail: `${snapshot.label} · auto-loads only on its own date; nothing is interpolated. Unmarked pixels, transparent areas and outside-coverage are unknown, not dry or safe.`,
            state: "available",
          }
        : {
            id: `nrsc-${day}`,
            kind: "nrsc",
            day,
            time: null,
            title: withheld ? "NRSC snapshot withheld" : "No observed NRSC snapshot",
            detail: input.regional ? `No licensed observed footprint connected for the selected area on ${day}.` : withheld
              ? "An NRSC observation exists for this day in the project's development build, but the maps may not be redistributed on a public host (production rights not cleared). Extent here is unknown."
              : `No NRSC observation for ${day}; only 1 and 2 Oct 2024 are published. Nothing is interpolated - unmarked pixels are unknown, not dry.`,
            state: "gap",
          },
    );
  }

  if (waterOn) {
    entries.push({
      id: "water-scenario",
      kind: "water-scenario",
      day: null,
      time: null,
      title: `Water-level scenario — ${fmt(waterLevel, 1, "m")} surface`,
      detail:
        "User-set flat terrain surface painted over the DEM. Scenario input, not a prediction — no datum, stage-discharge relation, timing, bathymetry or embankments. The DEM includes buildings/vegetation.",
      state: "input",
    });
  }

  if (storageRun) {
    const started = storageRun.startedAt;
    const succeeded = storageRun.status === "succeeded";
    const label =
      storageRun.status === "succeeded"
        ? `Candidate screening — ${storageRun.candidateCountTotal} depression${storageRun.candidateCountTotal === 1 ? "" : "s"} found`
        : `Candidate screening — ${storageRun.status}`;
    const waterNote = storageRun.provenance.waterRetrievedAt
      ? ` Water evidence fetched ${new Date(storageRun.provenance.waterRetrievedAt).toLocaleString("en-GB")}.`
      : "";
    entries.push({
      id: `storage-run-${storageRun.id}`,
      kind: "storage-run",
      day: null,
      time: started,
      title: label,
      detail: succeeded
        ? `Run ${storageRun.id} · config ${storageRun.configHash.slice(0, 12)} · ${storageRun.tilesFetched}/${storageRun.tilesTotal} tiles · water derived list ${storageRun.provenance.runKind}.${waterNote}`
        : `Run ${storageRun.id} · ${storageRun.error ?? storageRun.limitations.join(" ") ?? "no result produced"}.${waterNote}`,
      state: succeeded ? "available" : "gap",
    });
  }

  const actions = [...interventions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const item of actions) {
    entries.push({
      id: `intervention-${item.id}`,
      kind: "intervention",
      day: null,
      time: item.createdAt,
      title: `Proposal placed — ${item.name}`,
      detail: `Kind ${item.kind} at ${item.lat.toFixed(4)}, ${item.lon.toFixed(4)} · status ${item.status} · requires environmental, cadastral and engineering verification.`,
      state: "available",
    });
  }

  return entries;
}

export type GapSummary = { available: number; gap: number; input: number };

export function summarizeStates(entries: ResultEntry[]): GapSummary {
  const summary: GapSummary = { available: 0, gap: 0, input: 0 };
  for (const entry of entries) summary[entry.state]++;
  return summary;
}

export type YearSummary = {
  year: string;
  days: number;
  flowDays: number;
  flowGaps: number;
  maxFlow: number | null;
  maxFlowDate: string | null;
  rainGaps: number;
};

export function summarizeYear(
  year: string,
  rows: Array<{ date: string; flow: number | null; rain: number | null }>,
): YearSummary {
  const yearRows = rows.filter((r) => r.date.startsWith(`${year}-`));
  let flowDays = 0;
  let flowGaps = 0;
  let rainGaps = 0;
  let maxFlow: number | null = null;
  let maxFlowDate: string | null = null;
  for (const r of yearRows) {
    if (r.flow == null) flowGaps++;
    else {
      flowDays++;
      if (maxFlow == null || r.flow > maxFlow) {
        maxFlow = r.flow;
        maxFlowDate = r.date;
      }
    }
    if (r.rain == null) rainGaps++;
  }
  return { year, days: yearRows.length, flowDays, flowGaps, maxFlow, maxFlowDate, rainGaps };
}
