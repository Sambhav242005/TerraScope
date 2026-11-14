// ENSO analog analysis: joins the dated NOAA CPC ONI series (src/flood/enso.ts)
// with the local 2015–2024 GloFAS/ERA5 daily records to show what co-occurred.
// Descriptive only — small sample, not a prediction, and never a rainfall multiplier.
import { HISTORICAL_ENSO_SERIES, type EnsoPhase } from "./enso.ts";

export type AnalogRow = {
  year: number;
  season: string;
  phase: EnsoPhase;
  oniAnomalyC: number;
  /** Peak daily GloFAS discharge and its date (any month); null when no record exists. */
  peakFlow: number | null;
  peakFlowDate: string | null;
  /** Jun–Sep (SW monsoon) ERA5 precipitation total in mm; null when no rain days are recorded. */
  monsoonRainMm: number | null;
  flowDays: number;
  rainDays: number;
  flowGaps: number;
  rainGaps: number;
};

import type { HistoryRow } from "./historySeries.ts";

type Row = HistoryRow;

const monsoon = (iso: string) => {
  const month = iso.slice(5, 7);
  return month >= "06" && month <= "09";
};

/** `rows` are the joined 2015–2024 daily records (GloFAS discharge UTC, ERA5 rainfall IST). */
export function buildAnalogRows(rows: Row[]): AnalogRow[] {
  if (!rows?.length) {
    throw new Error("History datasets could not be loaded for ENSO analog analysis.");
  }

  const rowsOut: AnalogRow[] = [];
  for (const [yearText, record] of Object.entries(HISTORICAL_ENSO_SERIES)) {
    const year = Number(yearText);
    if (!Number.isFinite(year)) continue;
    let peakFlow: number | null = null;
    let peakFlowDate: string | null = null;
    let flowDays = 0;
    let flowGaps = 0;
    let rainDays = 0;
    let rainGaps = 0;
    let monsoonRainMm: number | null = null;

    for (const row of rows) {
      const date = row.date;
      if (!date.startsWith(`${year}-`)) continue;
      const discharge = row.flow;
      if (discharge == null) flowGaps++;
      else {
        flowDays++;
        if (peakFlow == null || discharge > peakFlow) {
          peakFlow = discharge;
          peakFlowDate = date;
        }
      }
      if (monsoon(date)) {
        if (row.rain == null) rainGaps++;
        else {
          rainDays++;
          monsoonRainMm = (monsoonRainMm ?? 0) + row.rain;
        }
      }
    }
    rowsOut.push({
      year,
      season: record.season,
      phase: record.phase,
      oniAnomalyC: record.oniAnomalyC,
      peakFlow,
      peakFlowDate,
      monsoonRainMm,
      flowDays,
      rainDays,
      flowGaps,
      rainGaps,
    });
  }
  return rowsOut.sort((a, b) => a.year - b.year);
}

export function analogSummary(rows: AnalogRow[]): {
  elNinoYears: number[];
  laNinaYears: number[];
  neutralYears: number[];
} {
  return {
    elNinoYears: rows.filter((r) => r.phase === "El Niño").map((r) => r.year),
    laNinaYears: rows.filter((r) => r.phase === "La Niña").map((r) => r.year),
    neutralYears: rows.filter((r) => r.phase === "Neutral").map((r) => r.year),
  };
}
