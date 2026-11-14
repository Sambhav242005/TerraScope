// Shared, cached loader for the 2015–2024 daily GloFAS/ERA5 records.
// One fetch for the whole app; imported by history surfaces and findings.
import { joinHistory, type HistoryRow } from "./historyJoin.ts";

export type { HistoryRow };

let cache: Promise<HistoryRow[]> | null = null;

export function loadHistorySeries(): Promise<HistoryRow[]> {
  if (!cache) {
    const pending = (async () => {
      const [flowRes, rainRes] = await Promise.all(
        ["flow-history", "rain-history"].map((name) => fetch(`/data/${name}.json`)),
      );
      if (!flowRes.ok || !rainRes.ok) {
        throw new Error("History datasets could not be loaded.");
      }
      const [flow, rain] = await Promise.all([flowRes.json(), rainRes.json()]);
      return joinHistory(flow, rain);
    })();
    cache = pending;
    pending.catch(() => {
      // Do not cache a failed load; a later navigation can retry.
      if (cache === pending) cache = null;
    });
  }
  return cache;
}
