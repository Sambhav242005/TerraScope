// Pure, screening-grade readout of the bundled Open-Meteo/ERA5 daily resource
// series (public/data/renewable-resource-gandak.json): GHI and 10 m / 100 m
// mean wind at the canonical Gandak-corridor analysis cell (26.5 N, 84.25 E —
// the same cell public/data/rain-history.json records; see
// docs/research/renewable-resource-gandak.md).
//
// Scope discipline (R07 "smallest shippable slice"):
//   - reanalysis screening only; NOT a yield forecast, NOT site measurement,
//     NOT a capacity factor, NOT an NPV/payback input;
//   - never imputes, never zero-fills; missing (null) values are excluded from
//     every statistic and counted in `missing`; series with zero valid values
//     produce a structured refusal, not a number;
//   - garbage (non-finite numbers, physically impossible magnitudes, bad dates)
//     produces a structured refusal, not a silently filtered result;
//   - deterministic: same input rows -> byte-identical output (no clocks, no RNG).
//
// Sources (only what was actually used, retrieved 2026-11-15):
//   [1] Open-Meteo Historical Weather API — Copernicus ERA5 reanalysis, daily
//       aggregates at 26.5 N / 84.25 E, 2015-01-01..2024-12-31 (GHI daily sum,
//       daily mean wind at 10 and 100 m, dominant directions):
//       https://archive-api.open-meteo.com/v1/archive
//       docs: https://open-meteo.com/en/docs/historical-weather-api
//       terms: https://open-meteo.com/en/terms (free API is non-commercial)
//       data license: CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/deed.en
//   [2] ERA5 single levels (Copernicus Climate Change Service / ECMWF),
//       0.25 degree hourly reanalysis — reconstruction, not a forecast issued
//       before the event and not a turbine-scale wind measurement:
//       https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels
//   NASA POWER was NOT used for this slice (named here only so nobody assumes
//   it was). No local pyranometer/anemometer/lidar campaign exists for the
//   Gandak corridor; nothing here validates a rooftop, array or turbine site.
//   100 m wind is modelled by ERA5; a power-law shear between 10 m and 100 m is
//   assumed by construction of the grid, not by any measurement at this site.

export const RENEWABLE_RESOURCE_URL = "/data/renewable-resource-gandak.json";

export const RENEWABLE_RESOURCE_SOURCES: readonly string[] = [
  "Open-Meteo Historical Weather API (Copernicus ERA5 reanalysis), daily aggregates, 26.5 N / 84.25 E, 2015-01-01..2024-12-31 — https://archive-api.open-meteo.com/v1/archive (docs: https://open-meteo.com/en/docs/historical-weather-api); retrieved 2026-11-15; CC BY 4.0 data (https://creativecommons.org/licenses/by/4.0/deed.en) under Open-Meteo free API non-commercial terms (https://open-meteo.com/en/terms). Attribution: Copernicus Climate Change Service (C3S) / ECMWF ERA5 via Open-Meteo.",
  "ERA5 single levels (Copernicus Climate Change Service / ECMWF), 0.25 degree hourly reanalysis — reconstruction, not a forecast issued before the event and not a turbine-scale wind measurement — https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels",
  "No local measurement campaign exists for the Gandak corridor; these are gridded reanalysis estimates for one sample cell, not rooftop/array/turbine-site evidence. 100 m wind is ERA5-modelled; shear between 10 m and 100 m reflects the reanalysis grid, not a local tower.",
];

export type RenewableRow = {
  /** ISO calendar date, yyyy-mm-dd. */
  date: string;
  /** Daily sum of GHI, MJ/m2/day. null = missing (never zero-filled). */
  ghi: number | null;
  /** Daily mean 10 m wind speed, m/s. null = missing. */
  wind10: number | null;
  /** Daily mean 100 m wind speed, m/s. null = missing. */
  wind100: number | null;
  /** Dominant daily 10 m wind direction, degrees true [0,360]. Optional. */
  windDir10?: number | null;
  /** Dominant daily 100 m wind direction, degrees true [0,360]. Optional. */
  windDir100?: number | null;
};

export type RenewableResourceMeta = {
  url: string;
  retrieved: string | null;
  retrievedDate: string | null;
  model: string | null;
  resolution: string | null;
  license: string | null;
  timezone: string | null;
  coverageStart: string | null;
  coverageEnd: string | null;
  dayCount: number | null;
};

export type RenewableResourceResult =
  | { ok: true; rows: RenewableRow[]; meta: RenewableResourceMeta }
  | { ok: false; reason: string; detail?: string; sources: readonly string[] };

export type PercentileBlock = {
  p10: number | null;
  p50: number | null;
  p90: number | null;
  mean: number | null;
  /** count of valid (non-null, in-bounds) values used */
  n: number;
  /** count of null (missing) values skipped; never imputed */
  missing: number;
};

export type Wind100Block = PercentileBlock & {
  /** Vector-averaged dominant 100 m wind direction, degrees true [0,360).
   *  Present only when >= MIN_DIRECTION_SAMPLES valid directions exist;
   *  otherwise absent — never guessed. */
  dominantBearing?: number;
};

export type RenewableStatsResult =
  | {
      ok: true;
      ghi: PercentileBlock;
      wind100: Wind100Block;
      /** GHI statistics for June-September (monsoon) days only. */
      monsoonghiJunSep: PercentileBlock;
      /** GHI statistics for October-May (dry season) days only. */
      dryghiOctMay: PercentileBlock;
      /** Rows that could not be used at all (structurally broken). Always 0 on ok:true. */
      malformedRows: number;
      sources: readonly string[];
    }
  | { ok: false; reason: string; detail?: string; sources: readonly string[] };

const GHI_MAX_MJ = 50; // sanity bound: ~13.9 kWh/m2/day; ERA5 daily GHI peaks well below this
const WIND_MAX_MS = 75; // sanity bound; ERA5 daily mean wind at this cell never approaches it
const MIN_DIRECTION_SAMPLES = 30;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealCalendarDate(m: RegExpMatchArray): boolean {
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
  );
}

function isValidGhi(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= GHI_MAX_MJ;
}
function isValidWind(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= WIND_MAX_MS;
}
function isValidDirection(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 360;
}

/** Percentile with linear interpolation between closest ranks (type 7, the
 *  numpy/R default). Input need not be sorted. NaN-free by construction:
 *  callers pass only finite, in-bounds values. Deterministic. */
export function percentile(values: readonly number[], q: number): number {
  if (values.length === 0) throw new Error("percentile of empty series");
  if (!(q >= 0 && q <= 1)) throw new Error("q must be in [0,1]");
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 1) return s[0];
  const rank = (s.length - 1) * q;
  const lo = Math.floor(rank);
  const frac = rank - lo;
  const hi = Math.min(lo + 1, s.length - 1);
  return s[lo] + frac * (s[hi] - s[lo]);
}

function meanOf(values: readonly number[]): number {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function percentileBlock(values: readonly (number | null)[]): PercentileBlock {
  const valid: number[] = [];
  let missing = 0;
  for (const v of values) {
    if (v === null) missing += 1;
    else valid.push(v);
  }
  if (valid.length === 0) {
    return { p10: null, p50: null, p90: null, mean: null, n: 0, missing };
  }
  return {
    p10: percentile(valid, 0.1),
    p50: percentile(valid, 0.5),
    p90: percentile(valid, 0.9),
    mean: meanOf(valid),
    n: valid.length,
    missing,
  };
}

function dominantBearingOf(directions: readonly (number | null)[]): number | undefined {
  let sin = 0;
  let cos = 0;
  let n = 0;
  for (const d of directions) {
    if (d === null) continue;
    const rad = (d * Math.PI) / 180;
    sin += Math.sin(rad);
    cos += Math.cos(rad);
    n += 1;
  }
  if (n < MIN_DIRECTION_SAMPLES) return undefined;
  const deg = (Math.atan2(sin / n, cos / n) * 180) / Math.PI;
  return (deg + 360) % 360;
}

type RawDaily = {
  time?: unknown;
  shortwave_radiation_sum?: unknown;
  wind_speed_10m_mean?: unknown;
  wind_speed_100m_mean?: unknown;
  wind_direction_10m_dominant?: unknown;
  wind_direction_100m_dominant?: unknown;
};

function asNullableNumberArray(v: unknown, len: number, name: string): (number | null)[] {
  if (!Array.isArray(v) || v.length !== len) {
    throw new Error(`daily.${name}: expected array of length ${len}`);
  }
  return v.map((x, i) => {
    if (x === null) return null;
    if (typeof x === "number" && Number.isFinite(x)) return x;
    throw new Error(`daily.${name}[${i}]: expected number or null`);
  });
}

function metaFrom(json: Record<string, unknown>, provenance: Record<string, unknown> | null): RenewableResourceMeta {
  const prov = provenance ?? {};
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    url: str(prov.url) ?? "",
    retrieved: str(prov.retrieved),
    retrievedDate: str(prov.retrievedDate),
    model: str(prov.model),
    resolution: str(prov.resolution),
    license: str(prov.license),
    timezone: str(json.timezone),
    coverageStart: str(prov.coverageStart),
    coverageEnd: str(prov.coverageEnd),
    dayCount: num(prov.dayCount),
  };
}

/** Validate the raw Open-Meteo daily response + bundled provenance block and
 *  return one row per calendar day. Nulls are preserved as gaps; they are
 *  never converted to 0. Throws nothing — every failure is a structured
 *  refusal. */
export function parseRenewableResource(json: unknown): RenewableResourceResult {
  const sources = RENEWABLE_RESOURCE_SOURCES;
  if (typeof json !== "object" || json === null) {
    return { ok: false, reason: "malformed-payload", detail: "top-level value is not an object", sources };
  }
  const root = json as Record<string, unknown>;
  const daily = root.daily as RawDaily | undefined;
  if (typeof daily !== "object" || daily === null) {
    return { ok: false, reason: "malformed-payload", detail: "missing daily block", sources };
  }
  const times = daily.time;
  if (!Array.isArray(times) || times.length === 0) {
    return { ok: false, reason: "malformed-payload", detail: "daily.time is empty or not an array", sources };
  }
  const dates: string[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const t = times[i];
    if (typeof t !== "string") {
      return { ok: false, reason: "malformed-payload", detail: `daily.time[${i}] is not a string`, sources };
    }
    const m = ISO_DATE.exec(t);
    if (!m || !isRealCalendarDate(m)) {
      return { ok: false, reason: "malformed-payload", detail: `daily.time[${i}]=${JSON.stringify(t)} is not a real yyyy-mm-dd date`, sources };
    }
    dates.push(t);
  }
  let ghi: (number | null)[], wind10: (number | null)[], wind100: (number | null)[];
  let windDir10: (number | null)[] | null = null, windDir100: (number | null)[] | null = null;
  try {
    ghi = asNullableNumberArray(daily.shortwave_radiation_sum, dates.length, "shortwave_radiation_sum");
    wind10 = asNullableNumberArray(daily.wind_speed_10m_mean, dates.length, "wind_speed_10m_mean");
    wind100 = asNullableNumberArray(daily.wind_speed_100m_mean, dates.length, "wind_speed_100m_mean");
    if (daily.wind_direction_10m_dominant !== undefined) {
      windDir10 = asNullableNumberArray(daily.wind_direction_10m_dominant, dates.length, "wind_direction_10m_dominant");
    }
    if (daily.wind_direction_100m_dominant !== undefined) {
      windDir100 = asNullableNumberArray(daily.wind_direction_100m_dominant, dates.length, "wind_direction_100m_dominant");
    }
  } catch (err) {
    return { ok: false, reason: "malformed-payload", detail: err instanceof Error ? err.message : String(err), sources };
  }
  // In-bounds checks (refuse rather than silently drop): catches unit mix-ups.
  for (let i = 0; i < dates.length; i += 1) {
    const g = ghi[i], w10 = wind10[i], w100 = wind100[i];
    if (g !== null && !isValidGhi(g)) return { ok: false, reason: "out-of-bounds", detail: `ghi[${i}]=${g} (MJ/m2/day) outside [0,${GHI_MAX_MJ}]`, sources };
    if (w10 !== null && !isValidWind(w10)) return { ok: false, reason: "out-of-bounds", detail: `wind_10m[${i}]=${w10} (m/s) outside [0,${WIND_MAX_MS}]`, sources };
    if (w100 !== null && !isValidWind(w100)) return { ok: false, reason: "out-of-bounds", detail: `wind_100m[${i}]=${w100} (m/s) outside [0,${WIND_MAX_MS}]`, sources };
    if (windDir10 && windDir10[i] !== null && !isValidDirection(windDir10[i])) return { ok: false, reason: "out-of-bounds", detail: `wind_direction_10m[${i}]=${windDir10[i]} outside [0,360]`, sources };
    if (windDir100 && windDir100[i] !== null && !isValidDirection(windDir100[i])) return { ok: false, reason: "out-of-bounds", detail: `wind_direction_100m[${i}]=${windDir100[i]} outside [0,360]`, sources };
  }
  const provenance = (typeof root.provenance === "object" && root.provenance !== null
    ? (root.provenance as Record<string, unknown>)
    : null);
  const rows: RenewableRow[] = dates.map((date, i) => {
    const row: RenewableRow = { date, ghi: ghi[i], wind10: wind10[i], wind100: wind100[i] };
    if (windDir10) row.windDir10 = windDir10[i];
    if (windDir100) row.windDir100 = windDir100[i];
    return row;
  });
  return { ok: true, rows, meta: metaFrom(root, provenance) };
}

/** Fetch and parse the bundled resource file. `fetchImpl` is injected (tests
 *  pass a stub); nothing here touches the network by itself. Every failure —
 *  network, HTTP status, bad JSON, bad payload — is a structured refusal. */
export async function loadRenewableResource(
  fetchImpl: (url: string) => Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>,
  url: string = RENEWABLE_RESOURCE_URL,
): Promise<RenewableResourceResult> {
  const sources = RENEWABLE_RESOURCE_SOURCES;
  let res: { ok: boolean; status?: number; json: () => Promise<unknown> };
  try {
    res = await fetchImpl(url);
  } catch (err) {
    return { ok: false, reason: "fetch-failed", detail: err instanceof Error ? err.message : String(err), sources };
  }
  if (!res || res.ok !== true) {
    return { ok: false, reason: "fetch-failed", detail: `HTTP ${res?.status ?? "unknown"}`, sources };
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch (err) {
    return { ok: false, reason: "fetch-failed", detail: `response is not valid JSON: ${err instanceof Error ? err.message : String(err)}`, sources };
  }
  return parseRenewableResource(json);
}

function monsoonMonth(month: number): boolean {
  return month >= 6 && month <= 9; // June-September, the Gandak monsoon window used across the repo
}

/** Compute the screening readout. Never throws; never imputes; empty input is
 *  a structured refusal. */
export function statsOf(rows: readonly RenewableRow[]): RenewableStatsResult {
  const sources = RENEWABLE_RESOURCE_SOURCES;
  if (!Array.isArray(rows)) {
    return { ok: false, reason: "malformed-rows", detail: "rows is not an array", sources };
  }
  if (rows.length === 0) {
    return { ok: false, reason: "empty-input", detail: "no rows supplied; an empty series is not zero", sources };
  }
  // Structural validation of every row: refuse rather than guess.
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i] as RenewableRow | null;
    if (typeof r !== "object" || r === null) {
      return { ok: false, reason: "malformed-rows", detail: `rows[${i}] is not an object`, sources };
    }
    const m = typeof r.date === "string" ? ISO_DATE.exec(r.date) : null;
    if (!m || !isRealCalendarDate(m)) {
      return { ok: false, reason: "malformed-rows", detail: `rows[${i}].date=${JSON.stringify(r.date)} is not a real yyyy-mm-dd date`, sources };
    }
    const triples: Array<[unknown, string, (v: unknown) => boolean]> = [
      [r.ghi, "ghi", isValidGhi],
      [r.wind10, "wind10", isValidWind],
      [r.wind100, "wind100", isValidWind],
    ];
    for (const [v, name, check] of triples) {
      if (v === null) continue; // missing: allowed, excluded + counted
      if (!check(v)) {
        return { ok: false, reason: "malformed-rows", detail: `rows[${i}].${name}=${String(v)} is out of bounds or non-finite`, sources };
      }
    }
    for (const [v, name] of [[r.windDir10, "windDir10"], [r.windDir100, "windDir100"]] as const) {
      if (v === undefined || v === null) continue;
      if (!isValidDirection(v)) {
        return { ok: false, reason: "malformed-rows", detail: `rows[${i}].${name}=${String(v)} outside [0,360]`, sources };
      }
    }
  }
  // Per-series percentile blocks (nulls excluded + counted, never zero-filled).
  const ghiBlock = percentileBlock(rows.map((r) => r.ghi));
  const wind100Base = percentileBlock(rows.map((r) => r.wind100));
  if (ghiBlock.n === 0 || wind100Base.n === 0) {
    return {
      ok: false,
      reason: "insufficient-valid-values",
      detail: `no valid values for ${ghiBlock.n === 0 ? "ghi" : ""}${ghiBlock.n === 0 && wind100Base.n === 0 ? " and " : ""}${wind100Base.n === 0 ? "wind100" : ""} (ghi n=${ghiBlock.n}, wind100 n=${wind100Base.n}; nulls are missing, never zero)`,
      sources,
    };
  }
  const wind100: Wind100Block = { ...wind100Base };
  const bearing = dominantBearingOf(rows.map((r) => r.windDir100 ?? null));
  if (bearing !== undefined) wind100.dominantBearing = bearing;
  const monsoonIdx: number[] = [];
  const dryIdx: number[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const month = Number(rows[i].date.slice(5, 7));
    (monsoonMonth(month) ? monsoonIdx : dryIdx).push(i);
  }
  const monsoonghiJunSep = percentileBlock(monsoonIdx.map((i) => rows[i].ghi));
  const dryghiOctMay = percentileBlock(dryIdx.map((i) => rows[i].ghi));
  return { ok: true, ghi: ghiBlock, wind100, monsoonghiJunSep, dryghiOctMay, malformedRows: 0, sources };
}
