import { areaGaps, regionalReports, validLocation } from './catalog.ts';
import { emptyGeometry } from './contracts.ts';
import type { AirEvidence, AreaEvidenceCollection, AreaReview } from './contracts.ts';

export function airQueryUrl(latitude: number, longitude: number): string {
  if (!validLocation(latitude, longitude)) throw new Error('Invalid WGS84 coordinates');
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), hourly: 'pm2_5,us_aqi', domains: 'cams_global', timezone: 'GMT', forecast_days: '1' }).toString();
  return url.href;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid air response object');
  return value as Record<string, unknown>;
}
function measurement(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid air measurement');
  return value;
}
export function parseAir(value: unknown, latitude: number, longitude: number, now = new Date()): AirEvidence {
  const data = object(value), hourly = object(data.hourly), units = object(data.hourly_units);
  const lat = data.latitude, lon = data.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number' || !validLocation(lat, lon) || Math.abs(lat - latitude) > 1 || Math.min(Math.abs(lon - longitude), 360 - Math.abs(lon - longitude)) > 1) throw new Error('Air response outside requested area');
  if (data.utc_offset_seconds !== 0 || units.pm2_5 !== 'μg/m³' || units.us_aqi !== 'USAQI') throw new Error('Unexpected air units or timezone');
  const times = hourly.time, pm = hourly.pm2_5, aqi = hourly.us_aqi;
  if (!Array.isArray(times) || !Array.isArray(pm) || !Array.isArray(aqi) || !times.length || times.length > 48 || times.length !== pm.length || times.length !== aqi.length) throw new Error('Invalid air series');
  const epochs = times.map(t => {
    if (typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) throw new Error('Invalid air date');
    const epoch = Date.parse(t + ':00Z');
    if (!Number.isFinite(epoch) || new Date(epoch).toISOString().slice(0, 16) !== t) throw new Error('Invalid air date');
    return epoch;
  });
  if (epochs.some((e, i) => i > 0 && e - epochs[i - 1] !== 3600000)) throw new Error('Air dates not hourly and ordered');
  const values = pm.map(measurement), indices = aqi.map(measurement);
  // Most recent hour at or before now: never relabel a future forecast as current.
  let i = -1;
  epochs.forEach((e, index) => { if (e <= now.getTime()) i = index; });
  if (i < 0) throw new Error('Air series has no current or historical hour');
  const stale = now.getTime() - epochs[i] > 3 * 3600000;
  return {
    id: 'cams-global-air', kind: 'modeled-pollution', title: 'Air model near this area',
    summary: 'CAMS global model sample; not a local monitor. US AQI is not Indian National AQI.',
    provider: 'CAMS global atmospheric composition forecasts via Open-Meteo', version: 'CAMS global; upstream run ID not supplied',
    sourceUrl: 'https://open-meteo.com/en/docs/air-quality-api', queryUrl: airQueryUrl(latitude, longitude),
    retrievedAt: now.toISOString(), issuedAt: null, validTime: new Date(epochs[i]).toISOString(),
    bounds: [lon, lat, lon, lat], boundsMeaning: 'Returned model sample point only; no cell boundary inferred',
    resolution: '0.4° (~45 km) model; 3-hourly source interpolated by provider to hourly output',
    units: 'PM2.5: μg/m³; AQI: US AQI (dimensionless)',
    license: 'CC BY 4.0 data; attribute CAMS and Open-Meteo. Free API is non-commercial with rate limits.',
    uncertainty: 'Coarse model estimate; local variation unresolved. Forecast issue time/run identifier unavailable; not usable as an issue-time hindcast.',
    missingCoverage: values[i] === null || indices[i] === null ? 'One or more modeled values missing; null is not zero.' : 'No station observations, local validation or water/soil pollution data.',
    status: stale ? 'stale' : values[i] === null && indices[i] === null ? 'missing' : 'available',
    pm25: values[i], usAqi: indices[i], sample: [lon, lat],
  };
}
export function geometryForAir(air: AirEvidence | null): AreaEvidenceCollection {
  if (!air || air.status !== 'available') return emptyGeometry();
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: air.sample }, properties: {
    evidenceId: air.id, kind: air.kind, label: 'CAMS model sample · ~45 km · not a monitor', sourceUrl: air.sourceUrl,
    validTime: air.validTime, resolution: air.resolution, units: air.units, license: air.license,
  } }] };
}
export async function queryArea(latitude: number, longitude: number, signal: AbortSignal, fetcher: typeof fetch = fetch, now = new Date()): Promise<AreaReview> {
  const url = airQueryUrl(latitude, longitude);
  signal.throwIfAborted();
  const result: AreaReview = { latitude, longitude, reports: regionalReports(latitude, longitude), gaps: areaGaps(latitude, longitude), air: null, airError: null };
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 12000);
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Air service returned HTTP ${response.status}`);
    const raw = await response.text();
    if (raw.length > 100000) throw new Error('Air response exceeds size budget');
    controller.signal.throwIfAborted();
    result.air = parseAir(JSON.parse(raw), latitude, longitude, now);
  } catch {
    signal.throwIfAborted();
    result.airError = 'Air model unavailable: request failed, timed out or failed data validation. No replacement readings were generated.';
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
  signal.throwIfAborted();
  return result;
}
// Generation guard also protects against transports that resolve after cancellation.
export function createAreaLoader(query = queryArea) {
  let generation = 0;
  let active: AbortController | null = null;
  return {
    cancel() { generation++; active?.abort(); active = null; },
    async load(latitude: number, longitude: number, publish: (result: AreaReview) => void) {
      active?.abort();
      const controller = new AbortController(); active = controller;
      const own = ++generation;
      try {
        const result = await query(latitude, longitude, controller.signal);
        if (own === generation && !controller.signal.aborted) publish(result);
      } catch (error) { if (own === generation && !controller.signal.aborted) throw error; }
    },
  };
}
