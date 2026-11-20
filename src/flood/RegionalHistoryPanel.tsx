import { useState } from "react";
import { requestDays, type HistoryPart, type HistoryRequest } from "./regionalHistory";

export function historyStatus(part: HistoryPart) {
  if (part.error) return "Unavailable";
  if (!part.series) return "Downloading…";
  const count = part.series.values.filter(n => n !== null).length;
  return `${count}/${part.series.dates.length} days · ${part.cached ? "cached" : "downloaded"}`;
}

export default function RegionalHistoryPanel({ request, label, rain, flow, onDates, onRetry }: {
  request: HistoryRequest; label: string; rain: HistoryPart; flow: HistoryPart;
  onDates: (start: string, end: string) => void; onRetry: () => void;
}) {
  const [start, setStart] = useState(request.start);
  const [end, setEnd] = useState(request.end);
  const [error, setError] = useState("");
  return <section className="regional-history" aria-labelledby="regional-history-title">
    <h2 id="regional-history-title">History for {label}</h2>
    <p>Automatic downloads for {request.lat.toFixed(4)}°, {request.lon.toFixed(4)}°. Replay uses UTC days.</p>
    <details><summary>Change history dates</summary><form aria-label="Historical data dates" onSubmit={event => {
      event.preventDefault();
      try { requestDays({ ...request, start, end }); setError(""); onDates(start, end); }
      catch (e) { setError(e instanceof Error ? e.message : "Check the dates."); }
    }}>
      <label htmlFor="history-start">Start date</label>
      <input id="history-start" name="start" type="date" required value={start} min="1984-01-01" onChange={e => setStart(e.target.value)} />
      <label htmlFor="history-end">End date</label>
      <input id="history-end" name="end" type="date" required value={end} min={start} onChange={e => setEnd(e.target.value)} aria-describedby="history-date-help" />
      <small id="history-date-help">Up to 366 days per request, ending at least 7 days ago.</small>
      <button type="submit">Load dates</button>
      {error && <p role="alert">{error}</p>}
    </form></details>
    <p role="status">Rainfall {historyStatus(rain)}. River flow {historyStatus(flow)}.</p>
    {[rain, flow].map((part, index) => <article key={index}>
      <h3>{index === 0 ? "Rainfall · ERA5 reanalysis" : "River flow · GloFAS modeled discharge"}</h3>
      {part.error && <p role="alert">{part.error}</p>}
      {part.series && <>
        <p>{part.series.dates[0]} to {part.series.dates.at(-1)} · {part.series.values.filter(v => v === null).length} missing days.</p>
        <p>Returned cell {part.series.latitude.toFixed(4)}°, {part.series.longitude.toFixed(4)}° · {part.series.resolution} · {part.series.units}.</p>
        <p>{part.series.model}. {index === 0 ? "Sample-cell precipitation, including snow; catchment-average rainfall is unavailable." : "River match unverified. A nearby grid cell can represent another channel. No river identity, depth or observed flood extent is inferred."}</p>
        <p>Downloaded {new Date(part.series.retrieved).toLocaleString("en-GB")} · Open-Meteo / Copernicus · CC BY 4.0 data.</p>
        <p><a href={part.series.url} target="_blank" rel="noreferrer">Exact source query</a> · <a href="https://open-meteo.com/en/terms" target="_blank" rel="noreferrer">Service terms (free use is non-commercial)</a></p>
        <details><summary>Response fingerprint</summary><code>{part.series.sha256}</code></details>
      </>}
    </article>)}
    <button type="button" onClick={onRetry}>Refresh history</button>
    <p>Missing values stay unavailable. These historical model outputs support review; they provide no operational forecast or storage benefit calculation.</p>
  </section>;
}
