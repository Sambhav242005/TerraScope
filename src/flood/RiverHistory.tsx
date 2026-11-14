import { useEffect, useMemo, useState, type ReactNode } from "react";
export type HistoryFrame={date:string;flow:number|null;rain:number|null;delta:number|null;maximum:number};
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Download,
  Pause,
  Play,
  Waves,
} from "lucide-react";
import "./history.css";
import { loadHistorySeries } from "./historySeries";
type Row = import("./historyJoin").HistoryRow;
const number = (v: number | null | undefined) =>
  v == null
    ? "Unavailable"
    : v.toLocaleString("en-GB", { maximumFractionDigits: 1 });
const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function RiverHistory({
  onMap,
  onSources,
  renderWorld,
}: {
  onMap: () => void;
  onSources: () => void;
  renderWorld?: (frame:HistoryFrame)=>ReactNode;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [selected, setSelected] = useState("2024-09-28"),
    [playing, setPlaying] = useState(false),
    [step, setStep] = useState(1);
  useEffect(() => {
    let live = true;
    loadHistorySeries().then(
      (data) => {
        if (live) setRows(data);
      },
      (e: Error) => {
        if (live) setError(e.message);
      },
    );
    return () => {
      live = false;
    };
  }, []);
  const years = useMemo(
    () => Array.from(new Set(rows.map((r) => r.date.slice(0, 4)))),
    [rows],
  );
  const year = selected.slice(0, 4);
  const yearRows = useMemo(
    () => rows.filter((r) => r.date.startsWith(year)),
    [rows, year],
  );
  const index = Math.max(
    0,
    yearRows.findIndex((r) => r.date === selected),
  );
  const current = yearRows[index];
  const prev = rows[rows.findIndex((r) => r.date === selected) - 1];
  const delta =
    current?.flow != null && prev?.flow != null
      ? current.flow - prev.flow
      : null;
  const max = useMemo(
    () =>
      Math.max(1, ...rows.flatMap((r) => (r.flow === null ? [] : [r.flow]))),
    [rows],
  );
  const rainMax = useMemo(
    () =>
      Math.max(1, ...rows.flatMap((r) => (r.rain === null ? [] : [r.rain]))),
    [rows],
  );
  const cells = useMemo(
    () =>
      years.map((y) => ({
        year: y,
        months: months.map((_, m) => {
          const group = rows.filter((r) =>
            r.date.startsWith(`${y}-${String(m + 1).padStart(2, "0")}`),
          );
          const known = group.filter(
            (r): r is Row & { flow: number } => r.flow !== null,
          );
          return {
            peak: known.length
              ? known.reduce((a, b) => (b.flow > a.flow ? b : a))
              : null,
            missing: group.length - known.length,
          };
        }),
      })),
    [rows, years],
  );
  useEffect(() => {
    if (!playing || !yearRows.length) return;
    const id = setInterval(() => {
      setSelected((d) => {
        const i = yearRows.findIndex((r) => r.date === d);
        if (i + step >= yearRows.length) {
          setPlaying(false);
          return yearRows.at(-1)!.date;
        }
        return yearRows[i + step].date;
      });
    }, 500);
    return () => clearInterval(id);
  }, [playing, yearRows, step]);
  function select(date: string) {
    setPlaying(false);
    setSelected(date);
  }
  const points = yearRows
    .map(
      (r, i) =>
        `${r.flow === null ? "" : `${i === 0 || yearRows[i - 1].flow === null ? "M" : "L"}${70 + (i / Math.max(1, yearRows.length - 1)) * 900},${290 - (r.flow / max) * 230}`}`,
    )
    .join(" ");
  const x = 70 + (index / Math.max(1, yearRows.length - 1)) * 900,
    y = 290 - ((current?.flow ?? 0) / max) * 230;
  const yearPeak = yearRows
    .filter((r) => r.flow !== null)
    .reduce<
      Row | undefined
    >((best, r) => (!best || r.flow! > best.flow! ? r : best), undefined);
  function exportHistory() {
    const csv =
      "date,modeled_discharge_m3_s_UTC,rainfall_mm_IST\n" +
      rows.map((r) => `${r.date},${r.flow ?? ""},${r.rain ?? ""}`).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "terrascope-2015-2024.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className={renderWorld?"river-history world-mode":"river-history"}>
      {renderWorld?.({date:selected,flow:current?.flow??null,rain:current?.rain??null,delta,maximum:max})}
      <section className="history-intro">
        <div>
          <span className="eyebrow">
            GANDAK CORRIDOR · HISTORICAL MODEL ESTIMATES
          </span>
          <h1>
            A river changes.
            <br />
            <em>See the whole story.</em>
          </h1>
          <p>
            Ten years. Daily detail. Explore seasonal flow, compare years, and
            replay the build-up and recession.
          </p>
        </div>
        <div className="history-range">
          <span>2015 — 2024</span>
          <strong>{rows.length ? number(rows.length) : "…"} days</strong>
          <button onClick={onSources}>
            Data & limitations <ArrowUpRight size={15} />
          </button>
        </div>
      </section>
      {error ? (
        <div className="history-error" role="alert">
          {error} Missing history is unavailable, not zero.{" "}
          <button onClick={onMap}>Open resource map</button>
        </div>
      ) : !rows.length ? (
        <p role="status">Loading ten years of history…</p>
      ) : (
        <>
          <section className="river-replay">
            <div className="replay-top">
              <div>
                <span className="eyebrow">01 / DAILY RIVER PULSE</span>
                <h2>
                  {year} <span>·</span>{" "}
                  {delta === null
                    ? "Flow unavailable"
                    : delta > 0
                      ? "Flow increasing"
                      : delta < 0
                        ? "Flow decreasing"
                        : "Flow steady"}
                </h2>
              </div>
              <label>
                Explore year
                <select
                  aria-label="History year"
                  value={year}
                  onChange={(e) => select(`${e.target.value}-01-01`)}
                >
                  {years.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </label>
              <button
                className="history-peak"
                onClick={() => yearPeak && select(yearPeak.date)}
              >
                Jump to year’s peak <ArrowUpRight size={15} />
              </button>
            </div>
            <div className="pulse-body">
              <div className="pulse-chart">
                <div className="pulse-heading">
                  <span>
                    Modeled river discharge <b>m³/s</b>
                  </span>
                  <span>Fixed scale across all ten years</span>
                </div>
                <svg
                  onClick={(e) => {
                    const box = e.currentTarget.getBoundingClientRect();
                    const relative =
                      ((e.clientX - box.left) / box.width) * 1010;
                    const i = Math.round(
                      Math.max(0, Math.min(1, (relative - 70) / 900)) *
                        (yearRows.length - 1),
                    );
                    select(yearRows[i].date);
                  }}
                  viewBox="0 0 1010 370"
                preserveAspectRatio={renderWorld?"none":"xMidYMid meet"}
                  role="img"
                  aria-label={`Daily discharge for ${year}; selected ${selected}, ${number(current?.flow)} cubic metres per second`}
                >
                  <defs>
                    <linearGradient id="river-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#61d0dd" stopOpacity=".6" />
                      <stop
                        offset="100%"
                        stopColor="#61d0dd"
                        stopOpacity=".03"
                      />
                    </linearGradient>
                  </defs>
                  {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                    <g key={t}>
                      <line
                        x1="70"
                        x2="970"
                        y1={290 - t * 230}
                        y2={290 - t * 230}
                        stroke="#31504f"
                        strokeDasharray="3 6"
                      />
                      <text
                        x="57"
                        y={294 - t * 230}
                        textAnchor="end"
                        fill="#94b2ac"
                        fontSize="13"
                      >
                        {Math.round(max * t).toLocaleString("en-GB")}
                      </text>
                    </g>
                  ))}
                  {yearRows.every((r) => r.flow !== null) && (
                    <path
                      d={`${points} L970 290 L70 290Z`}
                      fill="url(#river-fill)"
                    />
                  )}
                  <path
                    d={points}
                    fill="none"
                    stroke="#78dfdf"
                    strokeWidth="3"
                  />
                  {yearRows.map((r, i) =>
                    r.rain === null ? null : (
                      <rect
                        key={r.date}
                        x={70 + (i / yearRows.length) * 900}
                        y={340 - (r.rain / rainMax) * 35}
                        width={Math.max(1, 900 / yearRows.length - 1)}
                        height={(r.rain / rainMax) * 35}
                        fill="#8ca5ca"
                        opacity=".8"
                      />
                    ),
                  )}
                  {months.map((m, i) => (
                    <text
                      key={m}
                      x={70 + (i / 12) * 900}
                      y="363"
                      fill="#9bb5ac"
                      fontSize="14"
                    >
                      {m}
                    </text>
                  ))}
                  <line
                    x1={x}
                    x2={x}
                    y1="40"
                    y2="340"
                    stroke="#e1c478"
                    strokeWidth="1.5"
                  />
                  {current?.flow != null && (
                    <>
                      <circle
                        cx={x}
                        cy={y}
                        r="10"
                        fill="#75e1de"
                        opacity=".2"
                      />
                      <circle cx={x} cy={y} r="5" fill="#e1fdf8" />
                    </>
                  )}
                </svg>
                <div className="rain-legend">
                  <i />
                  Rainfall · sample cell · mm/day, IST · bar scale 0–
                  {Math.round(rainMax)}
                </div>
              </div>
              <aside className="pulse-reading">
                <span className="selected-date">
                  {new Date(selected + "T12:00:00Z").toLocaleDateString(
                    "en-GB",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    },
                  )}
                </span>
                <div className="flow-readout">
                  <strong>{number(current?.flow)}</strong>
                  <span>m³/s · modeled discharge</span>
                </div>
                <div
                  className={`flow-change ${delta != null && delta > 0 ? "rising" : ""}`}
                >
                  {delta != null && delta > 0 ? (
                    <ArrowUpRight size={22} />
                  ) : (
                    <ArrowDownRight size={22} />
                  )}
                  <span>
                    {delta === null
                      ? "Previous day unavailable"
                      : `${delta > 0 ? "+" : ""}${number(delta)} m³/s`}
                    <small>change from previous UTC day</small>
                  </span>
                </div>
                <div
                  className="flow-meter"
                  aria-label="Discharge relative to ten-year maximum"
                >
                  <div
                    style={{
                      height: `${current?.flow == null ? 0 : (current.flow / max) * 100}%`,
                    }}
                  />
                  <span>0 → ten-year maximum</span>
                </div>
                <div className="rain-reading">
                  <span>Rainfall · separate sample cell</span>
                  <strong>
                    {number(current?.rain)} <small>mm/day</small>
                  </strong>
                </div>
              </aside>
            </div>
            <div className="history-controls">
              <button
                className="history-play"
                aria-label={playing ? "Pause history" : "Play history"}
                onClick={() => {
                  if (index === yearRows.length - 1)
                    setSelected(yearRows[0].date);
                  setPlaying(!playing);
                }}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
                <span>{playing ? "Pause" : "Replay"}</span>
              </button>
              <input
                type="range"
                aria-label="History day"
                min="0"
                max={yearRows.length - 1}
                value={index}
                onChange={(e) => select(yearRows[Number(e.target.value)].date)}
              />
              <label className="history-date">
                <CalendarDays size={16} />
                <input
                  aria-label="History date"
                  type="date"
                  min="2015-01-01"
                  max="2024-12-31"
                  value={selected}
                  onChange={(e) => {
                    if (rows.some((r) => r.date === e.target.value))
                      select(e.target.value);
                  }}
                />
              </label>
              <select
                aria-label="Replay step"
                value={step}
                onChange={(e) => setStep(Number(e.target.value))}
              >
                <option value="1">1 day / step</option>
                <option value="7">7 days / step</option>
              </select>
            </div>
            <div className="pulse-caption">
              {renderWorld?"Scrub or play to update the map’s dated readings. The landscape is context; no flood-depth layer is connected.":"The cursor, flow column and daily readings update together. Column height encodes discharge—not river depth."}{" "}
              <button onClick={() => select("2024-09-28")}>
                Replay September 2024 <ChevronRight size={13} />
              </button>
            </div>
          </section>
          <section className="year-atlas">
            <div className="atlas-heading">
              <div>
                <span className="eyebrow">02 / TEN YEARS AT A GLANCE</span>
                <h2>When does the river run highest?</h2>
                <p>
                  Each tile shows that month’s peak modeled discharge. Select
                  one to jump to its peak day.
                </p>
              </div>
              <div className="atlas-key">
                <span>Lower flow</span>
                <i />
                <span>Higher flow</span>
              </div>
            </div>
            <div className="atlas-scroll">
              <div className="atlas-grid">
                <div className="atlas-row atlas-months">
                  <span>YEAR</span>
                  {months.map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
                {cells.map((row) => (
                  <div
                    className={`atlas-row ${row.year === year ? "selected-year" : ""}`}
                    key={row.year}
                  >
                    <button onClick={() => select(`${row.year}-01-01`)}>
                      {row.year}
                    </button>
                    {row.months.map((c, i) => (
                      <button
                        key={i}
                        disabled={!c.peak}
                        className={
                          selected.slice(0, 7) ===
                          `${row.year}-${String(i + 1).padStart(2, "0")}`
                            ? "selected-month"
                            : ""
                        }
                        style={{
                          color:
                            c.peak && c.peak.flow! / max > 0.5
                              ? "#f3fffa"
                              : "#214d46",
                          background: c.peak
                            ? `hsl(184 42% ${94 - (c.peak.flow! / max) * 63}%)`
                            : undefined,
                        }}
                        aria-label={`${months[i]} ${row.year}: ${c.peak ? number(c.peak.flow) + " m³/s peak on " + c.peak.date : "unavailable"}${c.missing ? ", incomplete month" : ""}`}
                        title={`${c.peak?.date ?? "Missing"} · ${number(c.peak?.flow)} m³/s${c.missing ? " · incomplete" : ""}`}
                        onClick={() => c.peak && select(c.peak.date)}
                      >
                        <span>
                          {c.peak
                            ? Math.round((c.peak.flow! / 1000) * 10) / 10
                            : "—"}
                        </span>
                        {c.missing > 0 && <small>*</small>}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="atlas-foot">
              <span>
                Tile values: × 1,000 m³/s. Colors indicate discharge, not flood
                severity. * Incomplete month.
              </span>
              <button onClick={exportHistory}>
                <Download size={14} />
                Download all 3,653 days
              </button>
            </div>
          </section>
          <section className="flood-gap">
            <Waves size={30} />
            <div>
              <h3>Where is the flood spreading?</h3>
              <p>
                Flood extent and water depth are not available in these
                datasets. This view shows river-flow history; it does not
                identify inundated land. Observed satellite flood footprints or
                a validated hydraulic result are needed for an honest
                expanding-water map.
              </p>
            </div>
            <button onClick={onMap}>
              Explore the OSM map <ArrowUpRight size={17} />
            </button>
          </section>
          <footer className="history-provenance">
            GloFAS daily modeled discharge · approximately 5 km · UTC. ERA5
            rainfall · 0.25° sample cell · IST. 2015–2024, retrieved 4 November
            2026 via Open-Meteo / Copernicus. River-cell assignment unverified.{" "}
            <button onClick={onSources}>
              Source queries & fingerprints ↗
            </button>
          </footer>
        </>
      )}
    </main>
  );
}
