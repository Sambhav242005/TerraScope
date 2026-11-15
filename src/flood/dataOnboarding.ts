// Data onboarding and dependency tracking (R16).
// Every external or bundled dataset the app depends on is registered here with
// its schema contract, coverage, freshness policy and who consumes it.
// Deterministic: the same manifest and the same `now` produce the same report.
import { NRSC_FLOOD_SNAPSHOTS, NRSC_BOUNDS } from "./nrsc.ts";

export type Verdict = "pass" | "warn" | "fail" | "n/a";

export type OnboardingCheck = {
  dataset: string;
  check: "schema" | "coverage" | "freshness" | "license" | "failure";
  verdict: Verdict;
  detail: string;
};

export type Dependency = {
  dataset: string;
  usedBy: string[];
  /** True when a wrong/missing version of this dataset changes displayed numbers. */
  loadBearing: boolean;
};

export const DEPENDENCIES: Dependency[] = [
  { dataset: "rainfall", usedBy: ["Explore replay (rainfall chart)", "Runoff comparison", "Historical data table", "CSV export", "ENSO analog analysis"], loadBearing: true },
  { dataset: "discharge", usedBy: ["Explore replay (discharge chart + map marker)", "River history view", "Runoff comparison", "Historical data table", "CSV export", "ENSO analog analysis"], loadBearing: true },
  { dataset: "assets", usedBy: ["Map amenities", "Placement checks", "Field checks", "Response plan draft"], loadBearing: true },
  { dataset: "flow-history", usedBy: ["River history view", "Result timeline", "ENSO analog analysis"], loadBearing: true },
  { dataset: "rain-history", usedBy: ["River history view", "Result timeline", "ENSO analog analysis"], loadBearing: true },
  { dataset: "scene-geometry", usedBy: ["3D explorer (illustrative extrusion)"], loadBearing: false },
  { dataset: "nrsc-snapshots", usedBy: ["Explore replay (date-matched overlay)", "Placement evidence (map-color overlap, dated)"], loadBearing: true },
  { dataset: "terrarium-dem", usedBy: ["Candidate storage screening", "DEM transect profiles", "Terrain water-level scenario"], loadBearing: true },
  { dataset: "osm-evidence", usedBy: ["Candidate storage screening (water)", "Placement checks (refetch)", "Selected-area coverage"], loadBearing: true },
  { dataset: "hydrobasins-as12-sonpur", usedBy: ["Natural water-storage candidates (sub-basin context)", "Sub-basins map layer"], loadBearing: false },
];

export type ManifestEntry = {
  id: string;
  url?: string;
  sha256?: string;
  retrieved: string;
  status: string;
  units?: string;
  model?: string;
  license?: string;
  provider?: string;
  coverageStart?: string | null;
  coverageEnd?: string | null;
  schemaVersion?: number;
  uncertainty?: string;
  processing?: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Retrieval age in days, or null when the retrieved value cannot be parsed. */
export function retrievalAgeDays(retrieved: string, now: Date): number | null {
  const ms = Date.parse(retrieved);
  if (Number.isNaN(ms)) return null;
  return Math.floor((now.getTime() - ms) / DAY_MS);
}

/** Historical archives change rarely and are pinned by sha256; freshness is not a correctness risk there. */
const IMMUTABLE_KINDS = new Set(["rainfall", "discharge", "flow-history", "rain-history", "scene-geometry"]);

export function checkManifestEntry(entry: ManifestEntry, now: Date): OnboardingCheck[] {
  const checks: OnboardingCheck[] = [];
  const id = entry.id;

  // Schema: required keys present and plausibly typed.
  const missing: string[] = [];
  if (!entry.id) missing.push("id");
  if (!entry.url) missing.push("url");
  if (!entry.status) missing.push("status");
  if (!entry.provider) missing.push("provider");
  if (!entry.license) missing.push("license");
  if (!entry.uncertainty) missing.push("uncertainty");
  if (!entry.processing) missing.push("processing");
  if (entry.sha256 !== undefined && !/^[0-9a-f]{64}$/i.test(entry.sha256)) missing.push("sha256(format)");
  checks.push({
    dataset: id,
    check: "schema",
    verdict: missing.length === 0 ? "pass" : "fail",
    detail:
      missing.length === 0
        ? "id, url, status, provider, license, processing and uncertainty are present; sha256 well-formed."
        : `Missing or malformed: ${missing.join(", ")}.`,
  });

  // Coverage: parseable bounds and start <= end for series datasets.
  const hasBounds = entry.coverageStart && entry.coverageEnd && ISO.test(entry.coverageStart) && ISO.test(entry.coverageEnd);
  if (hasBounds) {
    const okOrder = entry.coverageStart! <= entry.coverageEnd!;
    checks.push({
      dataset: id,
      check: "coverage",
      verdict: okOrder ? "pass" : "fail",
      detail: okOrder
        ? `Coverage ${entry.coverageStart} to ${entry.coverageEnd}.`
        : `Coverage bounds out of order: ${entry.coverageStart} to ${entry.coverageEnd}.`,
    });
  } else if (id === "assets" || id === "scene-geometry") {
    checks.push({ dataset: id, check: "coverage", verdict: "n/a", detail: "Map snapshot; coverage is the bounded extract, not a time range." });
  } else {
    checks.push({ dataset: id, check: "coverage", verdict: "fail", detail: "No parseable coverage window recorded." });
  }

  // Freshness: only meaningful for live/current layers. Archived series are pinned, not stale.
  const age = retrievalAgeDays(entry.retrieved, now);
  if (IMMUTABLE_KINDS.has(id)) {
    checks.push({
      dataset: id,
      check: "freshness",
      verdict: "n/a",
      detail: age == null ? "Retrieval date unparsable." : `Archived series, retrieved ${age} days ago; pinned by sha256, not a freshness risk.`,
    });
  } else if (age == null) {
    checks.push({ dataset: id, check: "freshness", verdict: "warn", detail: "Retrieval date could not be parsed." });
  } else if (age <= 90) {
    checks.push({ dataset: id, check: "freshness", verdict: "pass", detail: `Retrieved ${age} days ago.` });
  } else if (age <= 180) {
    checks.push({ dataset: id, check: "freshness", verdict: "warn", detail: `Retrieved ${age} days ago; current-mapping layer may be outdated.` });
  } else {
    checks.push({ dataset: id, check: "freshness", verdict: "fail", detail: `Retrieved ${age} days ago; current-mapping layer is stale (>180 days).` });
  }

  // License: presence is checked in schema; here require redistribution caveats to be stated.
  checks.push({
    dataset: id,
    check: "license",
    verdict: entry.license ? "pass" : "fail",
    detail: entry.license ? `License recorded: ${entry.license.split(";")[0].trim()}.` : "No license recorded.",
  });

  return checks;
}

export type OnboardingPlan = {
  area: { lat: number; lon: number };
  steps: Array<{ order: number; action: string; source?: string; failure: string }>;
};

/** The checklist a supported new area gets, without per-location coding. Mirrors the shipped OSM/terrain path. */
export function onboardNewAreaPlan(area: { lat: number; lon: number }): OnboardingPlan {
  return {
    area,
    steps: [
      {
        order: 1,
        action: `Fetch a bounded (±2 km) OSM extract for the selected area; hash it and key it by 5-decimal check-area key for cache reuse.`,
        source: "api.openstreetmap.org map request",
        failure: "Extract fetch fails or exceeds the 12 MB budget → placement blocked for the spot; historical series are NOT relocated to the new area.",
      },
      {
        order: 2,
        action: "Validate the extract (schema/shape), then check coverage for the clicked footprint: inside the box, outside → move review area and refetch once; failure outside coverage stays unknown, never 'suitable'.",
        source: "src/flood/areaEvidence.ts",
        failure: "Malformed extract or missing coverage → blocked attempt, visibly marked, never saved.",
      },
      {
        order: 3,
        action: "Check NRSC bounds against the footprint: NRSC snapshots auto-load only for 2024-10-01/02 inside their published bounds; nothing is interpolated.",
        source: `bounds ${NRSC_BOUNDS.join(",")}`,
        failure: "Footprint outside published bounds → no observed overlay; unmarked pixels remain unknown.",
      },
      {
        order: 4,
        action: "Run terrain screening on demand for the centre with Mapzen Terrarium tiles (budget-checked); missing tiles fail the run instead of inventing depressions.",
        source: "src/flood/storage/storageSearch.ts",
        failure: "Terrain fetch failure → run cancelled with error shown; water evidence may still be reported as unavailable.",
      },
      {
        order: 5,
        action: "Historical ERA5/GloFAS and 2015–2024 history series stay bound to Sonpur/26.5N·84.25E and 25.775N·85.125E; they are never relocated to the new area.",
        source: "public/data/manifest.json",
        failure: "Historical series are never relocated to another area; doing so is a data-category error and the UI labels their origin.",
      },
      {
        order: 6,
        action: "Report dependency coverage for the review centre: which features rerun (storage screening, placement checks), which do not (historical replay, NRSC).",
        source: "DEPENDENCIES registry",
        failure: "A load-bearing dataset missing its check → the affected feature blocks or shows unknown, never stale numbers.",
      },
    ],
  };
}

export type OnboardingReport = {
  generatedAt: string;
  checks: OnboardingCheck[];
  summary: { pass: number; warn: number; fail: number; notApplicable: number };
  dependencies: Dependency[];
};

export function buildOnboardingReport(manifest: ManifestEntry[], now: Date): OnboardingReport {
  const checks = manifest.flatMap((entry) => checkManifestEntry(entry, now));
  const summary = { pass: 0, warn: 0, fail: 0, notApplicable: 0 };
  for (const c of checks) {
    if (c.verdict === "pass") summary.pass++;
    else if (c.verdict === "warn") summary.warn++;
    else if (c.verdict === "fail") summary.fail++;
    else summary.notApplicable++;
  }
  return {
    generatedAt: now.toISOString(),
    checks,
    summary,
    dependencies: DEPENDENCIES,
  };
}

export const ONBOARDING_LIMITS = [
  "Historical series are not relocated to new areas; coverage for a new area comes only from its own OSM extract and the published NRSC bounds.",
  "Freshness checks apply to current-mapping layers; archived ERA5/GloFAS series are pinned by sha256 and are not 'stale' by age.",
  "Missing coverage is never a clearance; absence of a finding is not suitability.",
  "No schema check can reveal features that are unmapped or outside the bounded box; that residual is reported as coverage, not as suitability.",
];
