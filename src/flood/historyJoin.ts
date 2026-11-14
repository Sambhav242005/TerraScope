// Pure join of the 2015–2024 GloFAS discharge and ERA5 rainfall series.
// Shared by RiverHistory, the result timeline, findings and ENSO analogs.
// No JSX — importable from the Node test runner.

export type HistorySeries = {
  daily: {
    time: string[];
    river_discharge?: (number | null)[];
    precipitation_sum?: (number | null)[];
  };
};
export type HistoryRow = { date: string; flow: number | null; rain: number | null };

const valid = (x: unknown): x is number | null =>
  x === null || (typeof x === "number" && Number.isFinite(x) && x >= 0);

export function joinHistory(flow: HistorySeries, rain: HistorySeries): HistoryRow[] {
  const values = flow.daily?.river_discharge;
  const rains = rain.daily?.precipitation_sum;
  if (
    !values ||
    !rains ||
    flow.daily.time.length !== values.length ||
    rain.daily.time.length !== rains.length ||
    !values.every(valid) ||
    !rains.every(valid)
  )
    throw Error("Invalid historical values");
  const byDate = new Map(rain.daily.time.map((d, i) => [d, rains[i]]));
  return flow.daily.time.map((date, i) => ({
    date,
    flow: values[i],
    rain: byDate.get(date) ?? null,
  }));
}
