import { useEffect, useState } from "react";
import { downloadHistory, historyKey, readHistoryCache, saveHistoryCache, type HistoryPart, type HistoryRequest } from "./regionalHistory";

export function useRegionalHistory(request: HistoryRequest | null) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; rain: HistoryPart; flow: HistoryPart }>({
    key: "", rain: { series: null, error: null, cached: false }, flow: { series: null, error: null, cached: false },
  });
  const key = request ? historyKey(request, "rain") : "";
  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    setState({ key, rain: { series: null, error: null, cached: false }, flow: { series: null, error: null, cached: false } });
    const timer = setTimeout(() => {
      for (const kind of ["rain", "flow"] as const) {
        void (async () => {
          let cached = null;
          try { if (!attempt) cached = readHistoryCache(localStorage, request, kind); } catch { /* Storage may be unavailable. */ }
          try {
            const series = cached ?? await downloadHistory(request, kind, controller.signal);
            if (controller.signal.aborted) return;
            if (!cached) { try { saveHistoryCache(localStorage, series); } catch { /* Live data remains usable. */ } }
            setState(previous => previous.key === key ? { ...previous, [kind]: { series, error: null, cached: !!cached } } : previous);
          } catch (error) {
            if (controller.signal.aborted) return;
            setState(previous => previous.key === key ? { ...previous, [kind]: { series: null, error: error instanceof Error ? error.message : "History unavailable.", cached: false } } : previous);
          }
        })();
      }
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, attempt]);
  const empty: HistoryPart = { series: null, error: null, cached: false };
  // Derive the guard during render, before the effect can run, so prior-region evidence never flashes.
  return { rain: state.key === key ? state.rain : empty, flow: state.key === key ? state.flow : empty, retry: () => setAttempt(a => a + 1) };
}
