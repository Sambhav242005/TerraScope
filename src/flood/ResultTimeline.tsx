import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, CloudRain, History, Waves, X } from "lucide-react";
import {
  buildResultTimeline,
  summarizeStates,
  summarizeYear,
  type ResultEntry,
  type ResultState,
} from "./resultTimelineCore";
import { loadHistorySeries, type HistoryRow } from "./historySeries";
import type { ScreeningRun } from "./storage/storageSearch";
import type { Intervention } from "./intervention";

const STATE_LABEL: Record<ResultState, string> = {
  available: "recorded",
  gap: "gap",
  input: "input",
};

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[(m ?? 1) - 1]} ${y}`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Entry({ entry }: { entry: ResultEntry }) {
  return (
    <li className={`result-entry result-entry-${entry.state}`}>
      <div className="result-entry-head">
        <span className={`result-chip result-chip-${entry.state}`}>{STATE_LABEL[entry.state]}</span>
        {entry.time ? (
          <time className="result-time" dateTime={entry.time}>{formatTime(entry.time)}</time>
        ) : entry.day ? (
          <time className="result-time" dateTime={entry.day}>{formatDay(entry.day)}</time>
        ) : (
          <span className="result-time">untimed</span>
        )}
      </div>
      <strong className="result-entry-title">{entry.title}</strong>
      <span className="result-entry-detail">{entry.detail}</span>
    </li>
  );
}

export default function ResultTimeline({
  days,
  dailyRain,
  discharge,
  waterOn,
  waterLevel,
  storageRun,
  interventions,
  onOpenHistory,
  onClose,
  open,
  onOpen,
}: {
  days: string[];
  dailyRain: Array<number | null>;
  discharge: Array<number | null | undefined>;
  waterOn: boolean;
  waterLevel: number;
  storageRun: ScreeningRun | null;
  interventions: Intervention[];
  onOpenHistory: () => void;
  onClose: () => void;
  /** Controls the `hidden="until-found"` panel rather than mounting/unmounting it, so in-page find can reveal it. */
  open: boolean;
  /** Called when the browser reveals the panel via find-in-page (beforematch). */
  onOpen: () => void;
}) {
  const [mode, setMode] = useState<"event" | "history">("event");
  const [year, setYear] = useState("2024");
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [historyError, setHistoryError] = useState("");
  const hostRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (mode !== "history" || rows) return;
    let live = true;
    loadHistorySeries().then(
      (data) => {
        if (live) setRows(data);
      },
      (e: Error) => {
        if (live) setHistoryError(e.message);
      },
    );
    return () => {
      live = false;
    };
  }, [mode, rows]);

  // Keep the panel mounted and collapse it with hidden="until-found" so in-page
  // find can reveal it; sync the App toggle from beforematch.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const reveal = () => onOpen();
    el.addEventListener("beforematch", reveal);
    if (open) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "until-found");
    return () => el.removeEventListener("beforematch", reveal);
  }, [open, onOpen]);

  useEffect(() => {
    if (!open) return;
    hostRef.current?.scrollIntoView({ block: "nearest" });
    titleRef.current?.focus({ preventScroll: true });
  }, [open]);

  const entries = useMemo(
    () =>
      buildResultTimeline({
        days,
        dailyRain,
        discharge,
        waterOn,
        waterLevel,
        storageRun,
        interventions,
      }),
    [days, dailyRain, discharge, waterOn, waterLevel, storageRun, interventions],
  );
  const summary = useMemo(() => summarizeStates(entries), [entries]);
  const eventEntries = entries.filter((e) => e.day !== null || e.kind === "water-scenario");
  const runEntries = entries.filter((e) => e.time !== null);

  const years = useMemo(
    () => (rows ? Array.from(new Set(rows.map((r) => r.date.slice(0, 4)))).sort() : ["2015", "2024"]),
    [rows],
  );
  const yearSummary = useMemo(
    () => (rows ? summarizeYear(year, rows) : null),
    [rows, year],
  );

  return (
    <div id="result-timeline" ref={hostRef}>
      <div className="result-timeline">
        <div className="result-timeline-head">
          <h2 className="result-timeline-title" ref={titleRef} tabIndex={-1}>
            <History size={14} aria-hidden="true" />
            Scenario result timeline
          </h2>
          <div className="result-timeline-controls">
            <label className="sr-only" htmlFor="result-event-picker">Event or year context</label>
            <select
              id="result-event-picker"
              value={mode}
              onChange={(e) => setMode(e.target.value as "event" | "history")}
            >
              <option value="event">Sep–Oct 2024 event replay (25 Sep – 3 Oct)</option>
              <option value="history">2015–2024 multiyear history (daily)</option>
            </select>
            <button type="button" className="text-action" onClick={onOpenHistory}>
              Open interactive history
              <ArrowUpRight size={13} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Hide scenario result timeline">
              <X size={16} aria-hidden="true" />
            </button>
            </div>
        </div>
      {mode === "event" ? (
        <>
          <p className="result-timeline-note">
            Every record carries its own timestamp or date. A <em>gap</em> means no record — missing data is
            never treated as zero or interpolated.
          </p>
          <div className="result-columns">
            <div>
              <h3 className="result-subhead"><CloudRain size={13} aria-hidden="true" /> Event window, day by day</h3>
              <ul className="result-entries" role="list">
                {eventEntries.map((entry) => (
                  <Entry key={entry.id} entry={entry} />
                ))}
              </ul>
            </div>
            <div>
              <h3 className="result-subhead"><Waves size={13} aria-hidden="true" /> Runs and actions, timestamped</h3>
              {runEntries.length === 0 ? (
                <p className="result-empty">
                  No timestamped runs or placed proposals yet. The automatic candidate screening
                  runs ~2&nbsp;s after the review area settles, or place a proposal from a tool.
                </p>
              ) : (
                <ul className="result-entries" role="list">
                  {runEntries.map((entry) => (
                    <Entry key={entry.id} entry={entry} />
                  ))}
                </ul>
              )}
            </div>
          </div>
          <p className="result-summary">
            {summary.available} recorded · {summary.gap} gaps · {summary.input} scenario input{summary.input === 1 ? "" : "s"} in this window
          </p>
        </>
      ) : (
        <div className="result-history">
          {historyError ? (
            <p className="result-empty">History data unavailable: {historyError}</p>
          ) : !yearSummary ? (
            <p className="result-empty">Loading 2015–2024 daily history…</p>
          ) : (
            <>
              <div className="result-history-controls">
                <label htmlFor="result-year-picker">History year</label>
                <select id="result-year-picker" value={year} onChange={(e) => setYear(e.target.value)}>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <dl className="result-history-stats">
                <div>
                  <dt>Days with discharge record</dt>
                  <dd>{yearSummary.flowDays} / {yearSummary.days}</dd>
                </div>
                <div>
                  <dt>Discharge gaps</dt>
                  <dd>{yearSummary.flowGaps}</dd>
                </div>
                <div>
                  <dt>Peak discharge</dt>
                  <dd>{yearSummary.maxFlow == null ? "No record" : `${Math.round(yearSummary.maxFlow).toLocaleString("en-GB")} m³/s on ${formatDay(yearSummary.maxFlowDate ?? year)}`}</dd>
                </div>
                <div>
                  <dt>Rainfall gaps</dt>
                  <dd>{yearSummary.rainGaps}</dd>
                </div>
              </dl>
              <p className="result-timeline-note">
                Gaps are shown as missing, never as zero or interpolated. Playback and CSV export for this
                record live in the interactive history view.
              </p>
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
