/**
 * DEM-error-aware capacity range for candidate water-storage depressions.
 *
 * WHAT THIS IS
 *   For a candidate depression already present in a storage-screening record
 *   (src/flood/storage/storageSearch.ts `StoredCandidate`), this module
 *   propagates DEM *vertical* error into the
 *   `geometricCapacityM3` figure and reports an illustrative interval
 *   (P10 / P50 / P90) for the two standard variants of the error model:
 *
 *     correlated   — floor and rim perturbed by one shared draw
 *                    (same DEM, common-mode / bias-class error);
 *     uncorrelated — floor and rim perturbed independently
 *                    (differential / random-class error).
 *
 *   The output is labelled, verbatim, as
 *     "illustrative range from DEM vertical error only; not a tolerance on
 *      available storage"
 *   everywhere it is surfaced. It is an error-propagation readout for a
 *   screening number, nothing more.
 *
 * WHAT THIS IS NOT (read before wiring any UI)
 *   - Not available storage. `availableStorageM3` stays `null` wherever this
 *     range is shown: current occupancy, infiltration, outlet geometry,
 *     permitting and tenure are all unknown and are not modeled here.
 *   - Not a forecast, geotechnical certificate, or engineering tolerance.
 *   - Not evidence of constraint coverage. DEM error is NOT the same as
 *     missing constraint evidence: a zero-width range would still say
 *     nothing about buildings, roads, water, ownership or ecology. Unknown
 *     constraints stay unknown; an error bar never converts them to "clear".
 *   - Not a bathymetric or stage–discharge model. The rim-area
 *     approximation used here is the repo's own internal approximation, not
 *     surveyed hydraulics.
 *   - Not a DEM selection. Swapping terrarium for Copernicus GLO-30 changes
 *     every quoted elevation; that is a separate, explicit migration with a
 *     delta report, never a silent substitution.
 *
 * ERROR MODEL (documented defaults, overridable via options)
 *   - Vertical error is Gaussian with standard deviation `sigmaM`.
 *     Default `DEFAULT_SIGMA_M` = 2.5 m. Copernicus GLO-30 / Mapzen
 *     terrarium-class products: population-mean absolute vertical error is
 *     commonly in the ~2–3 m band on flat terrain, and in flat agricultural
 *     terrain height error dominates volumetric error. The COP-DEM provider
 *     documentation quoted in-repo (artifacts/agents/B-storage-candidates.md
 *     §3.3) records "< 4 m LE90 absolute, < 2 m relative on slopes ≤ 20%"
 *     (COP-DEM page; EGM2008 datum; DOI 10.5270/ESA-c5d3d65). THE EXACT 2.5 m
 *     FIGURE IS NOT VERIFIED IN THIS REPOSITORY: it is a documented default
 *     assumption for flat-terrain σ_h, never a measured value. The exact
 *     figure is documented in the provider notes — callers must supply it;
 *     default is 2.5 m as a documented assumption, never as a measured value.
 *     Callers screening low-slope agricultural terrain should treat 2.5 m as
 *     a placeholder to be replaced by the provider figure for the DEM
 *     actually in use, or by a site-specific estimate.
 *   - Only elevations are perturbed. Footprint area, cell lattice, and the
 *     identities of floor/rim cells are treated as error-free.
 *   - Footprint-derived rim area is UNVERIFIED: the approximation
 *     d(capacity)/d(rim elevation) = footprintAreaM2 has no survey behind it
 *     and is not a measured shoreline.
 *   - Capacity is propagated as V(d') = V0 × (d'/d)^q with
 *     d  = maximumDepthToSpillM (= spillElevationM − minimumElevationM),
 *     d' = perturbed depth,
 *     K  = V0 / (footprintAreaM2 × d)   ∈ (0, 1]  (shape factor),
 *     q  = 1 / K, clamped to MAX_SHAPE_EXPONENT (32) so the model stays
 *          finite; q clamp is documented, never silently applied to real
 *          bowls whose K is far above the sliver regime.
 *     This is the rim-area-from-footprint approximation: the derivative of
 *     V(d') at d' = d is exactly footprintAreaM2, independent of bowl shape.
 *     Sanity bounds: 0 < V0 ≤ A·d (every submerged cell lies between floor
 *     and rim), so K ∈ (0, 1]; a perfect cone gives K = 1/3, a flat-bottomed
 *     bowl gives K → 1.
 *   - Correlated variant: ε_rim = ε_floor (one shared draw). Because the
 *     geometric capacity depends on elevation *differences*, common-mode
 *     vertical error never moves the estimate; the correlated band is
 *     degenerate (exactly V0) and is reported anyway, honestly, rather than
 *     omitted.
 *   - Uncorrelated variant: ε_rim ⊥ ε_floor. The perturbed depth is
 *     d' = d + ε_rim − ε_floor; differential error moves the estimate.
 *   - If a perturbed sample would place the floor at or above the rim
 *     (d' ≤ 0), the depression vanishes in that sample: the sample volume is
 *     0 and `clippedToZeroCount` is incremented. Samples are NEVER redrawn —
 *     silently resampling would fabricate a physically meaningful-looking
 *     interval from a failed world.
 *
 * DETERMINISM / SEED
 *   Default stream: mulberry32(CAPACITY_RANGE_SEED), Box–Muller normal
 *   sampling. Same inputs + same default options ⇒ bitwise-identical output.
 *   CAPACITY_RANGE_SEED = 20261115 (authoring date 2026-11-15; arbitrary but
 *   FIXED — never re-seeded per run). Callers may pass `options.rng`
 *   (a [0,1) uniform stream) to supply their own stream for tests; with an
 *   external rng, `seed` is reported as null because the stream is not a
 *   known seed. Percentiles use linear interpolation on sorted samples
 *   ("type 7", the NumPy default).
 *
 * REFUSALS ({ ok: false, reason }) — never NaN, never Infinity, never a
 *   silently-defaulted number:
 *   - any of the five inputs is missing/null/non-finite;
 *   - floor ≥ rim (no positive depth) or capacity ≤ 0 or footprint area
 *     unknown/non-positive;
 *   - maximumDepthToSpillM inconsistent with spill − floor beyond
 *     DEPTH_CONSISTENCY_REL_TOL (0.5 %) + DEPTH_CONSISTENCY_ABS_TOL_M
 *     (1e-6 m) — the aggregate fields no longer describe one depression;
 *   - capacity exceeds the footprint × depth upper bound beyond
 *     VOLUME_BOUND_REL_TOL — inputs are inconsistent;
 *   - depth below DEPTH_MIN_M (1e-6 m, one micrometre — absurd next to any
 *     DEM posting) or σ / sample-count outside documented bounds;
 *   - any computed output statistic is non-finite (defensive, unreachable
 *     after the input guards; reported as refusal rather than emitted).
 *   Missing evidence is NEVER reported as zero capacity and NEVER as a
 *   range; refusal carries a human-readable reason.
 *
 * PROVENANCE / UNCERTAINTY (every output, always)
 *   Units m³; method id `CAPACITY_RANGE_METHOD`; inputs are the record's
 *   own numbers (no re-read of the DEM); provenance of the σ default: see
 *   docs/capacity-range-notes.md. The interval communicates ONLY DEM
 *   vertical-error propagation. It is not a confidence interval in the
 *   statistical sense (the error model is an assumption, not a fitted
 *   distribution), not a bound on available storage, and not valid after a
 *   DEM swap without re-running.
 */

/** Exact label every surfacing layer must use for this interval. */
export const CAPACITY_RANGE_LABEL =
  "illustrative range from DEM vertical error only; not a tolerance on available storage";
export const CAPACITY_RANGE_METHOD = "monte-carlo-lite-rim-area-v1";

/** Documented flat-terrain vertical-error assumption. NOT a measured value;
 * see module doc and docs/capacity-range-notes.md. Callers must supply the
 * provider figure for the DEM in use when it is known. */
export const DEFAULT_SIGMA_M = 2.5;
/** Default Monte Carlo-lite draws per variant. */
export const DEFAULT_SAMPLES = 2000;
/** Fixed mulberry32 seed (authoring date 2026-11-15); documented, never re-rolled per run. */
export const CAPACITY_RANGE_SEED = 20261115;
/** Hard bound on the shape exponent to keep the power model finite. */
export const MAX_SHAPE_EXPONENT = 32;
/** Reject depth sliver below one micrometre; DEMs post at metre scale. */
export const DEPTH_MIN_M = 1e-6;
export const MIN_SAMPLES = 64;
export const MAX_SAMPLES = 100_000;
export const MAX_SIGMA_M = 1000;
export const DEPTH_CONSISTENCY_REL_TOL = 0.005;
export const DEPTH_CONSISTENCY_ABS_TOL_M = 1e-6;
export const VOLUME_BOUND_REL_TOL = 1e-9;

export type CapacityRangeInput = {
  /** Spill (rim) elevation in metres — mirrors `StoredCandidate.spillElevationM`. */
  spillElevationM: number | null | undefined;
  /** Floor (minimum) elevation in metres — mirrors `StoredCandidate.minimumElevationM`. */
  minimumElevationM: number | null | undefined;
  /** Geometric empty-basin capacity to the rim in m³ — mirrors `StoredCandidate.geometricCapacityM3`. */
  geometricCapacityM3: number | null | undefined;
  /** Footprint area in m², or null when unknown — mirrors `StoredCandidate.footprintAreaM2`. */
  footprintAreaM2: number | null | undefined;
  /** Maximum depth to spill in metres — mirrors `StoredCandidate.maximumDepthToSpillM`. */
  maximumDepthToSpillM: number | null | undefined;
};

export type CapacityRangeOptions = {
  /** Vertical-error standard deviation, metres. Default DEFAULT_SIGMA_M (2.5). */
  sigmaM?: number;
  /** Draws per variant. Integer in [MIN_SAMPLES, MAX_SAMPLES]. Default DEFAULT_SAMPLES. */
  samples?: number;
  /** mulberry32 seed. Default CAPACITY_RANGE_SEED. Ignored when `rng` is supplied. */
  seed?: number;
  /** Caller-supplied uniform [0,1) stream (tests). When set, `seed` is reported as null. */
  rng?: () => number;
};

export type CapacityVariantSummary = {
  variant: "correlated" | "uncorrelated";
  /** Linear-interpolation ("type 7") percentiles of rim-perturbed capacity, m³. */
  p10M3: number;
  p50M3: number;
  p90M3: number;
  meanM3: number;
  stdDevM3: number;
  minM3: number;
  maxM3: number;
  samplesDrawn: number;
  /** Samples whose perturbed floor would sit at/above the rim; counted, value 0, never redrawn. */
  clippedToZeroCount: number;
};

export type CapacityRangeOk = {
  ok: true;
  method: typeof CAPACITY_RANGE_METHOD;
  /** Exact required label string; surfacing layers must render this verbatim. */
  label: typeof CAPACITY_RANGE_LABEL;
  sigmaM: number;
  samples: number;
  /** Applied seed, or null when the caller supplied its own rng. */
  seed: number | null;
  /** d = maximumDepthToSpillM (= spill − floor), metres. */
  depthM: number;
  /** Shape factor K = V0 / (A·d) ∈ (0, 1]. */
  shapeFactorK: number;
  /** Shape exponent q = 1/K clamped to MAX_SHAPE_EXPONENT. */
  shapeExponent: number;
  /** Rim-area-from-footprint approximation in use, m² (== footprintAreaM2). */
  rimAreaM2: number;
  variants: {
    correlated: CapacityVariantSummary;
    uncorrelated: CapacityVariantSummary;
  };
  assumptions: string[];
  notComputed: string[];
  /** Always null: this range is never a statement about available storage. */
  availableStorageM3: null;
};

export type CapacityRangeRefusal = { ok: false; reason: string };
export type CapacityRangeResult = CapacityRangeOk | CapacityRangeRefusal;

// ------------------------------------------------------------- deterministics

/** mulberry32 — small, fast, fixed-stream non-cryptographic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draws via Box–Muller (Marsaglia polar method), one cached spare. */
function makeNormal(rng: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = rng() * 2 - 1;
      v = rng() * 2 - 1;
      s = u * u + v * v;
    } while (s === 0 || s >= 1);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * mul;
    return u * mul;
  };
}

/** Linear-interpolation percentile on a pre-sorted array ("type 7"). */
function percentileSorted(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sorted[0];
  const idx = (n - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

// ---------------------------------------------------------------------- model

export type CapacityDepthModel = {
  /** Reference depth d = maximumDepthToSpillM, metres. */
  depthM: number;
  /** Reference geometric capacity V0 in m³. */
  capacityM3: number;
  /** Footprint area A in m² (rim-area-from-footprint). */
  footprintAreaM2: number;
};

/**
 * Rim-area-from-footprint stage model: V(d') = V0 × (d'/d)^q,
 * q = 1/K = A·d / V0 clamped to MAX_SHAPE_EXPONENT.
 *
 * The derivative at d' = d is exactly A (the footprint area) for every bowl
 * shape K ∈ (0, 1] — this is the approximation the repo uses internally to
 * relate rim height and capacity, not surveyed hydraulics.
 *
 * d' ≤ 0 (floor at/above rim) returns 0: the depression vanishes.
 * Never returns NaN; a non-finite result is returned as-is for the caller's
 * final finite-check (the input guards make this unreachable in practice).
 */
export function geometricCapacityForDepthM3(
  depthPrimeM: number,
  base: CapacityDepthModel,
): number {
  const { depthM, capacityM3, footprintAreaM2 } = base;
  if (depthPrimeM <= 0) return 0;
  const k = capacityM3 / (footprintAreaM2 * depthM);
  const q = Math.min(MAX_SHAPE_EXPONENT, 1 / Math.max(k, 1 / MAX_SHAPE_EXPONENT));
  const ratio = depthPrimeM / depthM;
  return capacityM3 * Math.pow(ratio, q);
}

// --------------------------------------------------------------------- result

const ASSUMPTIONS: readonly string[] = [
  `Vertical error is Gaussian with σ = sigmaM; the default 2.5 m is a documented flat-terrain assumption, never a measured value — the exact figure is documented in the provider notes and callers must supply it (docs/capacity-range-notes.md).`,
  "Geometric capacity propagated as V(d′) = V0 × (d′/d)^q, q = A·d / V0 clamped to 32; the derivative at the rim is exactly footprintAreaM2 (rim-area-from-footprint approximation).",
  "Rim area is approximated by footprint area. That approximation is UNVERIFIED against any survey and is not bathymetry.",
  "Footprint area, cell lattice and floor/rim cell identities are treated as error-free; only elevations are perturbed.",
  "Correlated variant: one shared vertical perturbation for floor and rim (same DEM; common-mode / bias-class error). Geometric capacity depends on elevation differences, so this variant never moves the estimate.",
  "Uncorrelated variant: independent floor and rim perturbations (differential / random-class error); this variant moves the estimate.",
  "Correlated and uncorrelated variants share one base random stream so the two are directly comparable; they are not independent experiments.",
  "A perturbed sample whose floor would sit at or above the rim is counted in clippedToZeroCount and assigned volume 0; samples are never redrawn.",
  "Deterministic: mulberry32(CAPACITY_RANGE_SEED) + Box–Muller by default; pass options.rng to supply a caller stream (seed reported null then).",
  "Percentiles are linear interpolation on sorted samples (“type 7”).",
];

const NOT_COMPUTED: readonly string[] = [
  "Available storage: current occupancy, infiltration, groundwater, outlet geometry — availableStorageM3 is null in the output; this range is never a statement about it.",
  "Constraint coverage (buildings, roads, mapped water, ownership, ecology): DEM error is not missing constraint evidence; unknown coverage stays unknown and is never converted to clear by this range.",
  "Hydraulics: routing, stage–discharge, fill/drain timing, flood extent, return periods.",
  "Datum alignment to any local benchmark; encodings/latency of the DEM; DEM solver swaps (terrarium ↔ GLO-30) without a re-run.",
  "A statistical confidence interval: the error model is an assumption, not a fitted distribution.",
];

type Normalized = {
  spill: number;
  floor: number;
  capacity: number;
  area: number;
  depth: number;
};

function fail(reason: string): CapacityRangeRefusal {
  return { ok: false, reason };
}

function finite(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Validate inputs and normalize. Returns either a normalized record or a
 * structured refusal; never throws for bad data, never returns NaN.
 */
function normalizeInput(input: CapacityRangeInput): Normalized | CapacityRangeRefusal {
  if (input === null || input === undefined || typeof input !== "object") {
    return fail("Input record is missing; pass spillElevationM, minimumElevationM, geometricCapacityM3, footprintAreaM2 and maximumDepthToSpillM.");
  }
  const { spillElevationM, minimumElevationM, geometricCapacityM3, footprintAreaM2, maximumDepthToSpillM } = input;
  if (!finite(spillElevationM))
    return fail("spillElevationM is missing or non-finite; refusing rather than inventing a rim.");
  if (!finite(minimumElevationM))
    return fail("minimumElevationM (floor) is missing or non-finite; refusing rather than inventing a floor.");
  if (!finite(geometricCapacityM3))
    return fail("geometricCapacityM3 is missing or non-finite; refusing rather than inventing a capacity.");
  if (footprintAreaM2 === null || footprintAreaM2 === undefined)
    return fail("footprintAreaM2 is unknown; refusing — a missing area is not a zero-area basin and is never computed as one.");
  if (!finite(footprintAreaM2))
    return fail("footprintAreaM2 is non-finite; refusing.");
  if (!finite(maximumDepthToSpillM))
    return fail("maximumDepthToSpillM is missing or non-finite; refusing.");
  const depth = spillElevationM - minimumElevationM;
  if (!(depth > 0))
    return fail(`Floor is at or above the rim (spill ${spillElevationM} m, floor ${minimumElevationM} m); no positive depth exists and no capacity range is computed.`);
  if (geometricCapacityM3 <= 0)
    return fail("geometricCapacityM3 is not positive; a zero/negative empty-basin capacity yields no range.");
  if (footprintAreaM2 <= 0)
    return fail("footprintAreaM2 is not positive; refusing — unknown or zero footprint cannot anchor a rim-area approximation.");
  const dStated = maximumDepthToSpillM;
  if (dStated <= 0)
    return fail("maximumDepthToSpillM is not positive; refusing.");
  if (dStated < DEPTH_MIN_M)
    return fail(`maximumDepthToSpillM (${dStated} m) is below one micrometre; any DEM posting dwarfs it — refusing to model a sliver.`);
  const depthTol = Math.max(DEPTH_CONSISTENCY_ABS_TOL_M, DEPTH_CONSISTENCY_REL_TOL * Math.abs(depth));
  if (Math.abs(dStated - depth) > depthTol)
    return fail(`maximumDepthToSpillM (${dStated} m) is inconsistent with spill − floor (${depth} m) beyond tolerance; the aggregate fields do not describe one depression — refusing.`);
  const bound = footprintAreaM2 * depth;
  if (geometricCapacityM3 > bound * (1 + VOLUME_BOUND_REL_TOL))
    return fail(`geometricCapacityM3 (${geometricCapacityM3} m³) exceeds the footprint × depth bound (${bound} m³); inputs are inconsistent — refusing.`);
  return { spill: spillElevationM, floor: minimumElevationM, capacity: geometricCapacityM3, area: footprintAreaM2, depth };
}

function summarize(
  variant: CapacityVariantSummary["variant"],
  samples: readonly number[],
  clippedToZeroCount: number,
): CapacityVariantSummary | CapacityRangeRefusal {
  const sorted = [...samples].sort((a, b) => a - b);
  const p10 = percentileSorted(sorted, 0.1);
  const p50 = percentileSorted(sorted, 0.5);
  const p90 = percentileSorted(sorted, 0.9);
  let sum = 0;
  for (const v of samples) sum += v;
  const mean = sum / samples.length;
  let sq = 0;
  for (const v of samples) {
    const d = v - mean;
    sq += d * d;
  }
  const stdDev = Math.sqrt(sq / samples.length);
  const stats = [p10, p50, p90, mean, stdDev, sorted[0], sorted[sorted.length - 1]];
  if (!stats.every(Number.isFinite))
    return fail("Capacity range is not numerically stable for these inputs; refusing rather than reporting a fabricated bound.");
  return {
    variant,
    p10M3: p10,
    p50M3: p50,
    p90M3: p90,
    meanM3: mean,
    stdDevM3: stdDev,
    minM3: sorted[0],
    maxM3: sorted[sorted.length - 1],
    samplesDrawn: samples.length,
    clippedToZeroCount,
  };
}

/**
 * Compute the DEM-error-aware illustrative capacity range for one candidate.
 *
 * @param input  The candidate's own aggregate numbers (see CapacityRangeInput).
 * @param options Documented overridable error model; see module doc.
 * @returns `{ ok: true, ... }` with labelled P10/P50/P90 intervals, or
 *          `{ ok: false, reason }` for any input it refuses to vouch for.
 *          Never throws for bad data; never emits NaN/Infinity.
 */
export function computeCapacityRange(
  input: CapacityRangeInput,
  options: CapacityRangeOptions = {},
): CapacityRangeResult {
  const normalized = normalizeInput(input);
  if ("ok" in normalized) return normalized;

  const sigma = options.sigmaM ?? DEFAULT_SIGMA_M;
  if (!finite(sigma) || sigma < 0)
    return fail("sigmaM is missing or negative; vertical error has no sign — refusing.");
  if (sigma > MAX_SIGMA_M)
    return fail(`sigmaM (${sigma} m) exceeds ${MAX_SIGMA_M} m; that is not a DEM vertical-error model — refusing.`);

  const samplesN = options.samples ?? DEFAULT_SAMPLES;
  if (typeof samplesN !== "number" || !Number.isInteger(samplesN) || samplesN < MIN_SAMPLES || samplesN > MAX_SAMPLES)
    return fail(`samples must be an integer in [${MIN_SAMPLES}, ${MAX_SAMPLES}]; got ${String(samplesN)} — refusing.`);

  const seeded = options.rng === undefined;
  const seed = options.seed ?? CAPACITY_RANGE_SEED;
  if (seeded && (typeof seed !== "number" || !Number.isFinite(seed) || !Number.isInteger(seed)))
    return fail("seed must be a finite integer; refusing.");
  const rng = options.rng ?? mulberry32(seed >>> 0);
  if (typeof rng !== "function")
    return fail("rng must be a function returning uniform [0,1) values; refusing.");
  const normal = makeNormal(rng);

  const { capacity, area, depth } = normalized;
  const k = capacity / (area * depth);
  const q = Math.min(MAX_SHAPE_EXPONENT, 1 / Math.max(k, 1 / MAX_SHAPE_EXPONENT));
  const model: CapacityDepthModel = { depthM: depth, capacityM3: capacity, footprintAreaM2: area };

  const correlatedSamples: number[] = [];
  const uncorrelatedSamples: number[] = [];
  let correlatedClipped = 0;
  let uncorrelatedClipped = 0;
  for (let i = 0; i < samplesN; i += 1) {
    const epsFloor = normal() * sigma;
    const epsRim = normal() * sigma;
    // Correlated variant: one shared vertical perturbation (f′ = floor+ε, s′ = spill+ε),
    // so the perturbed depth is d — common-mode error never moves V.
    const dCorrelated = depth;
    const dUncorrelated = depth + epsRim - epsFloor;
    if (dCorrelated <= 0) {
      correlatedClipped += 1;
      correlatedSamples.push(0);
    } else {
      correlatedSamples.push(geometricCapacityForDepthM3(dCorrelated, model));
    }
    if (dUncorrelated <= 0) {
      uncorrelatedClipped += 1;
      uncorrelatedSamples.push(0);
    } else {
      uncorrelatedSamples.push(geometricCapacityForDepthM3(dUncorrelated, model));
    }
  }

  const correlated = summarize("correlated", correlatedSamples, correlatedClipped);
  if ("ok" in correlated && correlated.ok === false) return correlated;
  const uncorrelated = summarize("uncorrelated", uncorrelatedSamples, uncorrelatedClipped);
  if ("ok" in uncorrelated && uncorrelated.ok === false) return uncorrelated;
  const corr = correlated as CapacityVariantSummary;
  const uncorr = uncorrelated as CapacityVariantSummary;
  if (!Number.isFinite(corr.p10M3) || !Number.isFinite(uncorr.p10M3))
    return fail("Capacity range is not numerically stable for these inputs; refusing rather than reporting a fabricated bound.");

  return {
    ok: true,
    method: CAPACITY_RANGE_METHOD,
    label: CAPACITY_RANGE_LABEL,
    sigmaM: sigma,
    samples: samplesN,
    seed: seeded ? (seed >>> 0) : null,
    depthM: depth,
    shapeFactorK: k,
    shapeExponent: q,
    rimAreaM2: area,
    variants: { correlated: corr, uncorrelated: uncorr },
    assumptions: [...ASSUMPTIONS],
    notComputed: [...NOT_COMPUTED],
    availableStorageM3: null,
  };
}
