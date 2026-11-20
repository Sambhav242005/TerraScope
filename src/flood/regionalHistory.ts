import { distanceKm } from "./model.ts";

export type HistoryRequest = { lat: number; lon: number; start: string; end: string };
export type RegionalSeries = {
  version: 1;
  kind: "rain" | "flow";
  request: HistoryRequest;
  latitude: number;
  longitude: number;
  dates: string[];
  values: (number | null)[];
  hourly?: { time: string[]; precipitation: (number | null)[] };
  url: string;
  retrieved: string;
  sha256: string;
  model: string;
  resolution: string;
  units: string;
  timezone: "UTC";
  riverMatch: "unverified";
};
export type HistoryPart = { series: RegionalSeries | null; error: string | null; cached: boolean };
const DAY = 86400000;
export const HISTORY_LIMIT_DAYS = 366;
export const HISTORY_CACHE_KEY = "terrascope.regional-history.v1";

export function requestDays(request: HistoryRequest, now = new Date()): string[] {
  if (![request.lat, request.lon].every(Number.isFinite) || Math.abs(request.lat) > 85 || Math.abs(request.lon) > 180) throw Error("Choose coordinates within ±85° latitude and ±180° longitude.");
  const parse = (value: string) => {
    const time = Date.parse(value + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw Error("Choose valid start and end dates.");
    return time;
  };
  const start = parse(request.start), end = parse(request.end);
  if (request.start < "1984-01-01" || end > now.getTime() - 7 * DAY) throw Error("Historical dates must be from 1984 and at least 7 days old.");
  const length = (end - start) / DAY + 1;
  if (length < 1 || length > HISTORY_LIMIT_DAYS) throw Error("Choose an ordered period of up to 366 days.");
  return Array.from({ length }, (_, i) => new Date(start + i * DAY).toISOString().slice(0, 10));
}

export function historyKey(request: HistoryRequest, kind: RegionalSeries["kind"]): string {
  return [1, kind, request.lat, request.lon, request.start, request.end].join(":");
}

export function historyUrl(request: HistoryRequest, kind: RegionalSeries["kind"]): string {
  requestDays(request);
  const url = new URL(kind === "rain" ? "https://archive-api.open-meteo.com/v1/archive" : "https://flood-api.open-meteo.com/v1/flood");
  url.search = new URLSearchParams({
    latitude: String(request.lat), longitude: String(request.lon), start_date: request.start, end_date: request.end,
    timezone: "GMT", cell_selection: "nearest",
    ...(kind === "rain" ? { hourly: "precipitation", models: "era5" } : { daily: "river_discharge" }),
  }).toString();
  return url.href;
}

function values(raw: unknown, length: number): (number | null)[] {
  if (!Array.isArray(raw) || raw.length !== length || raw.some(n => n !== null && (typeof n !== "number" || !Number.isFinite(n) || n < 0))) throw Error("History has malformed values or an incomplete time axis.");
  return raw;
}

export function parseRegionalSeries(raw: any, request: HistoryRequest, kind: RegionalSeries["kind"], retrieved: string, sha256: string): RegionalSeries {
  const days = requestDays(request);
  if (raw?.error) throw Error("Provider could not supply this history.");
  if (typeof raw?.latitude !== "number" || typeof raw?.longitude !== "number" ||
      !Number.isFinite(raw.latitude) || !Number.isFinite(raw.longitude) ||
      Math.abs(raw.latitude) > 90 || Math.abs(raw.longitude) > 180 ||
      distanceKm(request, { lat: raw.latitude, lon: raw.longitude }) > (kind === "rain" ? 40 : 20)) throw Error("Returned history cell is outside the selected area.");
  if (raw.utc_offset_seconds !== 0) throw Error("History must retain the original UTC dates.");
  const time = kind === "rain" ? raw.hourly?.time : raw.daily?.time;
  const expected = kind === "rain" ? days.flatMap(day => Array.from({ length: 24 }, (_, h) => day + "T" + String(h).padStart(2, "0") + ":00")) : days;
  if (!Array.isArray(time) || time.length !== expected.length || expected.some((t, i) => time[i] !== t)) throw Error("Returned history dates do not match the requested coverage.");
  const units = kind === "rain" ? raw.hourly_units?.precipitation : raw.daily_units?.river_discharge;
  if (units !== (kind === "rain" ? "mm" : "m³/s")) throw Error("Unexpected history units.");
  const data = values(kind === "rain" ? raw.hourly.precipitation : raw.daily.river_discharge, expected.length);
  const daily = kind === "rain" ? days.map((_, i) => {
    const hours = data.slice(i * 24, i * 24 + 24);
    return hours.some(n => n === null) ? null : hours.reduce<number>((sum, n) => sum + n!, 0);
  }) : data;
  return {
    version: 1, kind, request: { ...request }, latitude: raw.latitude, longitude: raw.longitude,
    dates: days, values: daily, ...(kind === "rain" ? { hourly: { time, precipitation: data } } : {}),
    url: historyUrl(request, kind), retrieved, sha256, units, timezone: "UTC", riverMatch: "unverified",
    model: kind === "rain" ? "ERA5 reanalysis" : "GloFAS v4 seamless historical model output; exact upstream run/version not returned",
    resolution: kind === "rain" ? "0.25° (~25 km), hourly aggregated to UTC days" : "0.05° (~5 km), daily",
  };
}

export async function downloadHistory(request: HistoryRequest, kind: RegionalSeries["kind"], signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<RegionalSeries> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException("History request timed out", "TimeoutError")), 20000);
  try {
    const response = await fetcher(historyUrl(request, kind), { signal: controller.signal });
    if (!response.ok) throw Error("History service returned HTTP " + response.status + ". Retry when the service is available.");
    const reader = response.body?.getReader();
    if (!reader) throw Error("History response has no body.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1500000) throw Error("History exceeded its 1.5 MB download budget.");
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    controller.signal.throwIfAborted();
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    const hash = await crypto.subtle.digest("SHA-256", body);
    controller.signal.throwIfAborted();
    const sha = Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("");
    return parseRegionalSeries(JSON.parse(new TextDecoder().decode(body)), request, kind, new Date().toISOString(), sha);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}

// Keep at most eight validated, versioned response snapshots. Storage failures leave live data usable.
export function readHistoryCache(storage: Pick<Storage, "getItem">, request: HistoryRequest, kind: RegionalSeries["kind"], now = new Date()): RegionalSeries | null {
  try {
    const entries = JSON.parse(storage.getItem(HISTORY_CACHE_KEY) ?? "[]");
    if (!Array.isArray(entries)) return null;
    const entry = entries.find(e => e?.version === 1 && historyKey(e.request, e.kind) === historyKey(request, kind));
    if (!entry || entry.kind !== kind || entry.units !== (kind === "rain" ? "mm" : "m³/s") || entry.timezone !== "UTC" ||
        entry.url !== historyUrl(request, kind) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isFinite(Date.parse(entry.retrieved)) ||
        Date.parse(entry.retrieved) > now.getTime() || now.getTime() - Date.parse(entry.retrieved) > 7 * DAY) return null;
    const raw = {
      latitude: entry.latitude, longitude: entry.longitude, utc_offset_seconds: 0,
      hourly: entry.hourly, hourly_units: { precipitation: "mm" },
      daily: { time: entry.dates, river_discharge: entry.values }, daily_units: { river_discharge: "m³/s" },
    };
    return parseRegionalSeries(raw, request, kind, entry.retrieved, entry.sha256);
  } catch { return null; }
}

export function saveHistoryCache(storage: Pick<Storage, "getItem" | "setItem">, series: RegionalSeries): boolean {
  try {
    const parsed = JSON.parse(storage.getItem(HISTORY_CACHE_KEY) ?? "[]");
    const old = Array.isArray(parsed) ? parsed : [];
    const key = historyKey(series.request, series.kind);
    const retained = old.filter(e => {
      try { return historyKey(e.request, e.kind) !== key; } catch { return false; }
    });
    storage.setItem(HISTORY_CACHE_KEY, JSON.stringify([series, ...retained].slice(0, 8)));
    return true;
  } catch { return false; }
}
