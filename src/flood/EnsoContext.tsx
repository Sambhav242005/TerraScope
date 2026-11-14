import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ExternalLink, Waves, CloudRain } from "lucide-react";
import { buildAnalogRows, analogSummary, type AnalogRow } from "./ensoAnalogs";
import { loadHistorySeries } from "./historySeries";

function phaseLabel(row: AnalogRow): string {
  return row.phase;
}

export default function EnsoContext({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<AnalogRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    loadHistorySeries().then(
      (rows) => {
        if (live) setRows(buildAnalogRows(rows));
      },
      (e: Error) => {
        if (live) setError(e.message);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  const summary = useMemo(() => (rows ? analogSummary(rows) : null), [rows]);
  const row2024 = rows?.find((r) => r.year === 2024);

  return (
    <>
      <span className="eyebrow">ENSO — NOAA CPC OCEANIC NIÑO INDEX</span>
      <h1>What ENSO means for this corridor — and what it does not</h1>
      <p className="small-copy">
        El Niño–Southern Oscillation (ENSO) is a Pacific Ocean–climate pattern. Its monsoon-season phases
        (August–October running means, “ASO”) correlate <em>probabilistically</em> with the southwest monsoon
        (June–September) that governs Bihar’s rainfall — they do not set local stage depth, and no fixed rainfall
        multiplier is applied anywhere in this workspace.
      </p>

      <h2>Current outlook — issue-time CPC Diagnostic Discussion</h2>
      <div className="enso-advisory">
        <p className="advisory-status">
          <strong>El Niño Advisory</strong> — ENSO Diagnostic Discussion issued <strong>12 November 2026</strong> by the Climate Prediction Center (NCEP/NWS).
        </p>
        <p className="small-copy">
          <q>El Niño continues to strengthen, with a strong-to-very strong El Niño likely through January–March 2027 (remaining greater than a 79% chance).</q>{" "}
          Niño indices: +2.5°C (Niño-3.4), +3.6°C (Niño-3), +4.4°C (Niño-1+2); equatorial SST anomalies exceeded +4.0°C. Next Diagnostic Discussion scheduled for 10 December 2026.
        </p>
        <p className="small-copy">
          Retrieved 14 November 2026 for human review only. This advisory is dated and issue-time — unlike the analyzed ONI history above — but it is a probabilistic strength outlook, not a forecast of any specific monsoon, river stage or flood date in this corridor, and it is <strong>not an analysis input to anything in this workspace</strong>. No local effect or depth is derived from it. For current conditions, read the advisory at its source; superseding issues may exist by the time you read this.
        </p>
        <a className="text-action" href="https://cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml" target="_blank" rel="noreferrer">
          Read the 12 Nov 2026 Diagnostic Discussion (issue-time source) <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>

      <h2>Dated source and what it is</h2>
      <p className="small-copy">
        Index: NOAA CPC Oceanic Niño Index (ONI, ERSST.v5, Niño 3.4 region 5°N–5°S, 120°–170°W, 1991–2020
        climatology), ASO season for each year 2015–2024. The ONI is an <strong>analyzed</strong> value — a
        3-month running mean of observed SSTs. It is <strong>not</strong> a forecast issued before the event, and
        no issue-time CPC outlook has been retrieved or used as an analysis input. Treat it as dated climate
        context, not as a prediction of the 2024 flood.
      </p>

      <h2>Location and season relevance</h2>
      <p className="small-copy">
        The corridor sits in the lower Gandak/Ganga plain (Sonpur, Bihar). The southwest monsoon (June–September)
        supplies most annual rainfall here; ASO/SON is its tail. El Niño phases often suppress or delay northern
        monsoon rainfall; La Niña phases often favour it. 2019 also carried a strong positive Indian Ocean Dipole
        (not modeled here). Correlation is noisy at village scale — the 2024 event developed during ENSO-neutral
        conditions.
      </p>

      <h2>Analog years in the local record (2015–2024)</h2>
      {error ? (
        <p className="empty">Analog analysis unavailable: {error}</p>
      ) : !rows ? (
        <p className="small-copy">Loading the 2015–2024 daily record…</p>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <caption>
                Peak GloFAS discharge (any day, UTC) and June–September ERA5 rainfall total (IST), per year.
                Missing days are excluded and counted, never treated as zero.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Year</th>
                  <th scope="col">Season</th>
                  <th scope="col">ONI (°C)</th>
                  <th scope="col">Phase</th>
                  <th scope="col">Peak discharge</th>
                  <th scope="col">Monsoon rain (mm)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year} className={r.year === 2024 ? "enso-2024-row" : undefined}>
                    <th scope="row">{r.year}{r.year === 2024 ? " (event)" : ""}</th>
                    <td>{r.season}</td>
                    <td>{r.oniAnomalyC > 0 ? `+${r.oniAnomalyC.toFixed(1)}` : r.oniAnomalyC.toFixed(1)}</td>
                    <td>{phaseLabel(r)}</td>
                    <td>
                      {r.peakFlow == null
                        ? `No record (${r.flowGaps} gaps)`
                        : `${Math.round(r.peakFlow).toLocaleString("en-GB")} m³/s on ${r.peakFlowDate}`}
                    </td>
                    <td>
                      {r.monsoonRainMm == null
                        ? `No record (${r.rainGaps} gaps)`
                        : `${Math.round(r.monsoonRainMm).toLocaleString("en-GB")} mm`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summary && (
            <p className="small-copy">
              Phase counts in the record — El Niño: {summary.elNinoYears.join(", ") || "none"}; La Niña:{" "}
              {summary.laNinaYears.join(", ") || "none"}; Neutral: {summary.neutralYears.join(", ") || "none"}.
              Ten years is far too few to attribute any single flood year to ENSO, and ENSO status is not a
              gauge of depth.
            </p>
          )}
          {row2024 && (
            <p className="small-copy">
              <strong>The 2024 event:</strong> ENSO-neutral (ONI {row2024.oniAnomalyC}°C, {row2024.season}) while
              discharge peaked at {row2024.peakFlow == null ? "no record" : `${Math.round(row2024.peakFlow).toLocaleString("en-GB")} m³/s`}.
              2023 (+1.6°C El Niño) and 2020–2022 (La Niña) sit on either side of it in this table — context, not a
              forecast.
            </p>
          )}
        </>
      )}

      <h2>What this does not do</h2>
      <ul className="enso-limits">
        <li>No fixed rainfall multiplier and no ENSO-based stage/depth estimate — anywhere in this app.</li>
        <li>The 2015–2024 ONI values are analyzed, not issue-time. The 12 Nov 2026 advisory above is issue-time but probabilistic, and is not an input to anything here.</li>
        <li>Not a validated teleconnection model for the Gandak/Ganga corridor — no significance test is claimed for n=10 years.</li>
        <li>Rainfall is a 0.25° ERA5 sample cell (IST day); discharge is GloFAS model output at a grid cell (UTC day) — neither is a gauge.</li>
        <li>Missing days are counted and shown as gaps — never zero and never interpolated.</li>
      </ul>

      <div className="enso-links">
        <a className="text-action" href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensoadv.shtml" target="_blank" rel="noreferrer">
          NOAA CPC ENSO advisory (human review) <ExternalLink size={13} aria-hidden="true" />
        </a>
        <a className="text-action" href="https://origin.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/ONI_v5.php" target="_blank" rel="noreferrer">
          NOAA CPC ONI archive (the index used here) <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>

      <div className="enso-legend" aria-hidden="true">
        <Waves size={13} /> GloFAS discharge UTC · <CloudRain size={13} /> ERA5 rainfall IST · ONI ASO running mean
      </div>
      <button className="secondary full" onClick={onClose}>
        Close climate context
        <ChevronRight size={13} aria-hidden="true" />
      </button>
    </>
  );
}
