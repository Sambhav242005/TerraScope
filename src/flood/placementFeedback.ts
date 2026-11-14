import type { PlacementCheck } from "./placementCheck";

const KIND_LABELS: Record<string, string> = {
  building: "Building",
  road: "Road",
  river: "River",
  water: "Water",
  "historical-flood": "Historical flood",
  proposal: "Proposal overlap",
};

/** Short words for a checked spot: the conflict kinds and the mapped feature
 *  names that produced them. The full finding sentences stay in the alert's
 *  Details disclosure and the review panel; this summary only drives the
 *  map-side status, which should read at a glance. */
export function summarizeAttempt(
  check: PlacementCheck | null | undefined,
  maxNames = 3,
): { kinds: string[]; kindLabels: string[]; names: string[] } {
  if (!check) return { kinds: [], kindLabels: [], names: [] };
  const kinds = [...new Set(check.findings.map((f) => f.kind))].filter(
    (k) => k !== "historical-flood",
  );
  // OSM sometimes labels a feature with its own kind ("river"); the chip
  // already says that, so only keep names that add information.
  const lowerKinds = new Set(kinds.map((k) => k.toLowerCase()));
  const names = [...new Set(check.findings.flatMap((f) => f.labels ?? []))]
    .filter((name) => !lowerKinds.has(name.trim().toLowerCase()))
    .slice(0, maxNames);
  return { kinds, kindLabels: kinds.map((k) => KIND_LABELS[k] ?? k), names };
}
