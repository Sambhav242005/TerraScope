import type { Intervention } from './intervention';
import type { PlacementCheck, PlacementEvidence } from './placementCheck';

export default function PlacementReview({ item, check, evidence, state, retry, close, remove }: {
  item: Intervention; check: PlacementCheck | null; evidence: PlacementEvidence | null;
  state: 'loading' | 'ready' | 'failed'; retry: () => void;
  close?: () => void; remove?: () => void;
}) {
  return <section className={`placement-review ${check?.status ?? 'unknown'}`} aria-label="Placement evidence check">
    <div className="placement-review-head"><h3>Why this location?</h3>{close && <button onClick={close} aria-label="Close placement review">×</button>}</div>
    <p><strong>{item.name}</strong><br/><small>{item.lat.toFixed(5)}°N, {item.lon.toFixed(5)}°E</small></p>
    {check?.status === "conflict" && <p className="placement-model-note">This saved proposal conflicts with mapped or proposed objects. Its 3D model is hidden. Delete it and place it elsewhere.</p>}
    <p role="status"><strong>{state === 'loading' ? 'Checking map evidence…' : check?.headline ?? 'Evidence check unavailable — suitability unknown'}</strong></p>
    {item.kind === 'solar_array' && <p className="small-copy">3D visual: 48 grouped panel tables at an illustrative 20? tilt, scaled to the assumed site area. Table count is not a capacity calculation.</p>}
    {item.kind === 'wind_turbine' && <p className="small-copy">3D visual: one turbine, illustrative 80 m hub and 66 m rotor diameter. Static blades; no wind-operation or wake simulation.</p>}
    <p className="placement-model-note">Placement only — effect model unavailable. This proposal does not change the runoff graph, weather or water levels.</p>
    {(state === 'failed' || (!check && state !== 'loading')) && <button onClick={retry}>Retry evidence checks</button>}
    {check && <>
      <p className="small-copy">{check.footprintMethod} The outline is a screening footprint, not a surveyed design or setback.</p>
      {check.findings.length > 0 && <ul className="placement-findings">{check.findings.map((f, i) => <li key={i}>
        <strong>{f.message}</strong>
        <details><summary>Matched evidence references</summary>
          <small>Sources: {f.sourceIds.join(', ')}.</small><br/>
          <small>Features: {f.featureIds.slice(0, 8).join(', ')}{f.featureIds.length > 8 ? `; ${f.featureIds.length - 8} more in the source geometry bundle` : ''}.</small>
        </details>
      </li>)}</ul>}
      <details open={check.status !== 'conflict'}><summary>What is still unknown</summary><ul>{check.unknowns.map(s => <li key={s}>{s}</li>)}</ul></details>
      <details><summary>Evidence, dates and method</summary>
        <p>{check.method}. Geometry overlap, not a calibrated suitability model. No confidence percentage is available.</p>
        {evidence?.sources.map(source => <article key={source.id} className="placement-source">
          <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
          <small>{source.date ? `Provider label: ${source.date}. ` : ''}Retrieved {source.retrievedAt}. Bounds: {source.coverage.join(', ')}.</small>
          <ul>{source.limitations.map(s => <li key={s}>{s}</li>)}</ul>
          <small>Input SHA-256: <code>{source.sha256}</code></small>
        </article>)}
        <a href="/data/placement-evidence.json" target="_blank" rel="noreferrer">Inspect source geometries and IDs</a>
      </details>
    </>}
    <p className="small-copy">A no-overlap result is not approval. Catchments, outlets, foundations and land rights still require investigation. No safer alternative is claimed yet.</p>
    {remove && <button onClick={remove}>Delete proposal</button>}
  </section>;
}
