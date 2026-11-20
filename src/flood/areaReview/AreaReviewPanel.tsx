import { useEffect, useRef, useState } from 'react';
import { areaGaps, regionalReports, validLocation } from './catalog.ts';
import { emptyGeometry } from './contracts.ts';
import type { AreaEvidenceCollection, AreaReview, Evidence } from './contracts.ts';
import { createAreaLoader, geometryForAir } from './query.ts';
import './areaReview.css';

export interface AreaReviewPanelProps {
  latitude: number;
  longitude: number;
  onGeometryChange?: (geometry: AreaEvidenceCollection) => void;
  onReviewChange?: (review: AreaReview | null) => void;
  evidenceSelection?: { id: string } | null;
  active?: boolean;
}
function SourceDetails({ evidence: e, selection }: { evidence: Evidence; selection?: { id: string } | null }) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (selection?.id === e.id && details.current) {
      details.current.open = true;
      details.current.querySelector('summary')?.focus();
    }
  }, [selection, e.id]);
  return <details ref={details} className="area-review-source"><summary>{e.title} · {e.status}</summary>
    <p>{e.summary}</p>
    <dl><dt>Source / version</dt><dd><a href={e.sourceUrl} target="_blank" rel="noreferrer">{e.provider}</a> · {e.version}</dd>
      <dt>Evidence date</dt><dd>{e.validTime}; retrieved {e.retrievedAt}. Issue time: {e.issuedAt ?? 'not supplied'}.</dd>
      <dt>Scale / units</dt><dd>{e.resolution}. {e.units}.</dd>
      <dt>Coverage</dt><dd>{e.boundsMeaning} {e.missingCoverage}</dd>
      <dt>Limits / reuse</dt><dd>{e.uncertainty} {e.license}</dd></dl>
  </details>;
}
export function AreaReviewPanel({ latitude, longitude, onGeometryChange, onReviewChange, evidenceSelection, active }: AreaReviewPanelProps) {
  const loader = useRef(createAreaLoader());
  const callback = useRef(onGeometryChange);
  callback.current = onGeometryChange;
  const [review, setReview] = useState<AreaReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    callback.current?.(emptyGeometry());
    setReview(null); onReviewChange?.(null); setFailure(null);
    if (!validLocation(latitude, longitude)) { setLoading(false); return; }
    setLoading(true);
    // Debounce map movement; bounded, in-session lookup, not a background service.
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      void loader.current.load(latitude, longitude, result => {
        setReview(result); onReviewChange?.(result); setLoading(false);
        callback.current?.(geometryForAir(result.air));
        const sample = result.air;
        if (sample?.status === 'available') {
          const remaining = Date.parse(sample.validTime) + 3 * 3600000 + 1 - Date.now();
          expiry = setTimeout(() => {
            setReview({ ...result, air: { ...sample, status: 'stale' } });
            callback.current?.(emptyGeometry());
          }, Math.max(0, remaining));
        }
      }).catch(() => { setFailure('Area lookup failed. No inferred results are shown.'); setLoading(false); });
    }, 350);
    return () => { clearTimeout(timer); clearTimeout(expiry); loader.current.cancel(); callback.current?.(emptyGeometry()); };
  }, [latitude, longitude, onReviewChange]);
  if (!validLocation(latitude, longitude)) return <section className="area-review" aria-label="Area environment"><p>Choose valid latitude and longitude to look up area evidence.</p></section>;
  // Hide old results synchronously when the parent changes area, before effects run.
  const current = review?.latitude === latitude && review?.longitude === longitude ? review : null;
  const air = current?.air;
  const selection = active && current ? evidenceSelection : null;
  return <section className="area-review" aria-label="Area environment">
    <h2>Environment around this place</h2>
    <p className="area-review-intro">Regional records and air-model context for {latitude.toFixed(3)}°, {longitude.toFixed(3)}°. No site clearance is implied.</p>
    <p role="status">{loading ? 'Looking up air model… Regional references are ready.' : failure ?? current?.airError ?? (air ? `Air model: ${air.status} · ${air.validTime}` : 'Regional references; air model pending.')}</p>
    {air && <div className="area-review-air"><strong>Modeled air · ~45 km scale</strong>
      <p>PM2.5: {air.pm25 === null ? 'missing' : `${air.pm25.toFixed(1)} μg/m³`} · US AQI: {air.usAqi === null ? 'missing' : air.usAqi.toFixed(0)}</p>
      <p>Not a monitor reading or Indian AQI. {air.status === 'stale' ? 'Stale model timestamp; withheld from map.' : 'Current-model context, independent of historical playback.'}</p>
      <p>Data: <a href="https://atmosphere.copernicus.eu/">CAMS</a> via <a href="https://open-meteo.com/">Open-Meteo</a> · CC BY 4.0</p>
      <SourceDetails evidence={air} selection={selection} />
    </div>}
    {(current?.reports ?? regionalReports(latitude, longitude)).map(e => <SourceDetails key={e.id} evidence={e} selection={selection} />)}
    <details><summary>What remains unknown here</summary><ul>{areaGaps(latitude, longitude).map(g => <li key={g}>{g}</li>)}</ul></details>
  </section>;
}
