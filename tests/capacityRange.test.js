import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCapacityRange,
  geometricCapacityForDepthM3,
  CAPACITY_RANGE_LABEL,
  CAPACITY_RANGE_METHOD,
  CAPACITY_RANGE_SEED,
  DEFAULT_SIGMA_M,
  DEFAULT_SAMPLES,
  MAX_SHAPE_EXPONENT,
} from '../src/flood/storage/capacityRange.ts';

// A shallow Bihar-plain example: ~2 m below spill, 12,000 m2 footprint,
// K ~ 0.6 (bowl shape between cone and flat-bottomed).
const BASE = {
  spillElevationM: 102,
  minimumElevationM: 100,
  geometricCapacityM3: 14_400,
  footprintAreaM2: 12_000,
  maximumDepthToSpillM: 2,
};

const finiteFields = (range) => {
  const all = [];
  for (const key of ['correlated', 'uncorrelated']) {
    const v = range.variants[key];
    all.push(v.p10M3, v.p50M3, v.p90M3, v.meanM3, v.stdDevM3, v.minM3, v.maxM3);
  }
  return all;
};

test('label and method are the exact required strings', () => {
  assert.equal(CAPACITY_RANGE_LABEL, 'illustrative range from DEM vertical error only; not a tolerance on available storage');
  assert.equal(CAPACITY_RANGE_METHOD, 'monte-carlo-lite-rim-area-v1');
  assert.equal(DEFAULT_SIGMA_M, 2.5);
  assert.equal(DEFAULT_SAMPLES, 2000);
  assert.equal(CAPACITY_RANGE_SEED, 20261115);
  assert.equal(MAX_SHAPE_EXPONENT, 32);
});

test('happy path returns ok with finite ordered variants', () => {
  const r = computeCapacityRange(BASE);
  assert.equal(r.ok, true);
  assert.equal(r.label, CAPACITY_RANGE_LABEL);
  assert.equal(r.seed, CAPACITY_RANGE_SEED);
  assert.equal(r.availableStorageM3, null);
  assert.equal(r.rimAreaM2, BASE.footprintAreaM2);
  assert.equal(r.depthM, 2);
  assert.ok(r.shapeFactorK > 0 && r.shapeFactorK <= 1);
  assert.ok(r.shapeExponent >= 1 && r.shapeExponent <= MAX_SHAPE_EXPONENT);
  for (const v of Object.values(r.variants)) {
    assert.ok(v.p10M3 <= v.p50M3 && v.p50M3 <= v.p90M3);
    assert.ok(v.samplesDrawn === DEFAULT_SAMPLES);
  }
  for (const v of finiteFields(r)) assert.ok(Number.isFinite(v));
  // Uncorrelated differential error must move the estimate; correlated cannot.
  assert.ok(r.variants.uncorrelated.p90M3 > r.variants.uncorrelated.p10M3);
  assert.equal(r.variants.correlated.p10M3, BASE.geometricCapacityM3);
  assert.equal(r.variants.correlated.p50M3, BASE.geometricCapacityM3);
  assert.equal(r.variants.correlated.p90M3, BASE.geometricCapacityM3);
  assert.equal(r.variants.correlated.stdDevM3, 0);
});

test('exact-zero error case reproduces the input capacity', () => {
  const r = computeCapacityRange(BASE, { sigmaM: 0 });
  assert.equal(r.ok, true);
  assert.equal(r.sigmaM, 0);
  for (const key of ['correlated', 'uncorrelated']) {
    const v = r.variants[key];
    assert.ok(Math.abs(v.p10M3 - BASE.geometricCapacityM3) < 1e-9);
    assert.ok(Math.abs(v.p50M3 - BASE.geometricCapacityM3) < 1e-9);
    assert.ok(Math.abs(v.p90M3 - BASE.geometricCapacityM3) < 1e-9);
    assert.equal(v.clippedToZeroCount, 0);
    assert.equal(v.stdDevM3, 0);
  }
});

test('negative and zero inputs are rejected with structured refusals', () => {
  const inputCases = [
    ['negative capacity', { ...BASE, geometricCapacityM3: -1 }],
    ['zero capacity', { ...BASE, geometricCapacityM3: 0 }],
    ['zero area', { ...BASE, footprintAreaM2: 0 }],
    ['negative area', { ...BASE, footprintAreaM2: -5 }],
    ['floor above rim', { ...BASE, minimumElevationM: 103 }],
    ['floor equal to rim', { ...BASE, minimumElevationM: BASE.spillElevationM }],
    ['negative stated depth', { ...BASE, maximumDepthToSpillM: -2 }],
    ['zero stated depth', { ...BASE, maximumDepthToSpillM: 0 }],
  ];
  for (const [name, input] of inputCases) {
    const r = computeCapacityRange(input);
    assert.equal(r.ok, false, name);
    assert.equal(typeof r.reason, 'string');
    assert.ok(r.reason.length > 0);
  }
  const rSigma = computeCapacityRange(BASE, { sigmaM: -0.1 });
  assert.equal(rSigma.ok, false);
  assert.equal(typeof rSigma.reason, 'string');
});

test('NaN and Infinity inputs are rejected everywhere', () => {
  const poisoners = [
    ['spillElevationM', NaN], ['spillElevationM', Infinity], ['spillElevationM', -Infinity],
    ['minimumElevationM', NaN], ['minimumElevationM', Infinity],
    ['geometricCapacityM3', NaN], ['geometricCapacityM3', Infinity],
    ['footprintAreaM2', NaN], ['footprintAreaM2', Infinity],
    ['maximumDepthToSpillM', NaN], ['maximumDepthToSpillM', Infinity],
  ];
  for (const [field, bad] of poisoners) {
    const r = computeCapacityRange({ ...BASE, [field]: bad });
    assert.equal(r.ok, false, `${field} = ${bad}`);
    assert.equal(typeof r.reason, 'string');
  }
  // And on the options side.
  assert.equal(computeCapacityRange(BASE, { sigmaM: NaN }).ok, false);
  assert.equal(computeCapacityRange(BASE, { sigmaM: Infinity }).ok, false);
  assert.equal(computeCapacityRange(BASE, { samples: NaN }).ok, false);
  assert.equal(computeCapacityRange(BASE, { seed: NaN }).ok, false);
});

test('determinism: two runs with defaults are deep-equal', () => {
  const a = computeCapacityRange(BASE);
  const b = computeCapacityRange(BASE);
  assert.deepEqual(a, b);
  const c = computeCapacityRange({ ...BASE, geometricCapacityM3: 14_400.5 });
  const d = computeCapacityRange({ ...BASE, geometricCapacityM3: 14_400.5 });
  assert.deepEqual(c, d);
});

test('caller-supplied rng stream is honoured and reported as seed null', () => {
  let i = 0;
  const rng = () => {
    // Deterministic halftone of low-discrepancy fractions; never 0 or 1.
    i += 1;
    const v = (i * 0.6180339887498949) % 1;
    return Math.min(Math.max(v, 1e-9), 1 - 1e-9);
  };
  const r1 = computeCapacityRange(BASE, { rng });
  assert.equal(r1.ok, true);
  assert.equal(r1.seed, null);
  i = 0;
  const r2 = computeCapacityRange(BASE, { rng });
  assert.deepEqual(r1, r2);
});

test('rim-area approximation: dV/d(rim) equals footprint area for all bowl shapes, and is symmetric under common-mode shift', () => {
  // K values: flat-bottomed (K=1), mid bowl (K=0.6), cone (K=1/3).
  for (const k of [1, 0.6, 1 / 3]) {
    const depth = 2;
    const area = 12_000;
    const capacity = k * area * depth;
    const model = { depthM: depth, capacityM3: capacity, footprintAreaM2: area };
    const h = 1e-6;
    const dPlus = geometricCapacityForDepthM3(depth + h, model);
    const dMinus = geometricCapacityForDepthM3(depth - h, model);
    const derivative = (dPlus - dMinus) / (2 * h);
    assert.ok(
      Math.abs(derivative - area) / area < 1e-5,
      `K=${k}: dV/d(rim)=${derivative} m³/m should equal footprint area ${area} m²`,
    );
    // Shift invariance (correlated/common-mode): d' === d leaves V at V0.
    const atRim = geometricCapacityForDepthM3(depth, model);
    assert.ok(Math.abs(atRim - capacity) < 1e-6);
  }
});

test('refusal when footprint area is unknown or missing', () => {
  for (const unknown of [null, undefined, NaN]) {
    const r = computeCapacityRange({ ...BASE, footprintAreaM2: unknown });
    assert.equal(r.ok, false);
    assert.match(r.reason, /footprintAreaM2|area/i);
  }
});

test('inconsistent aggregates are refused', () => {
  // Stated depth does not match spill − floor.
  const r1 = computeCapacityRange({ ...BASE, maximumDepthToSpillM: 3.5 });
  assert.equal(r1.ok, false);
  // Capacity violates the footprint × depth upper bound.
  const r2 = computeCapacityRange({ ...BASE, geometricCapacityM3: BASE.footprintAreaM2 * BASE.maximumDepthToSpillM * 1.5 });
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /bound|inconsistent/i);
  // Sliver depth refused.
  const r3 = computeCapacityRange({ ...BASE, minimumElevationM: 101.9999999, spillElevationM: 102, maximumDepthToSpillM: 1e-9 });
  assert.equal(r3.ok, false);
});

test('huge sigma on a shallow depression clips samples to zero, never NaN', () => {
  const shallow = { ...BASE, minimumElevationM: 101.6, maximumDepthToSpillM: 0.4, geometricCapacityM3: 1_500 };
  const r = computeCapacityRange(shallow, { sigmaM: 50, samples: 512 });
  assert.equal(r.ok, true);
  assert.ok(r.variants.uncorrelated.clippedToZeroCount > 0);
  for (const v of finiteFields(r)) assert.ok(Number.isFinite(v));
});

test('uncorrelated spread is reported as P10/P50/P90 around the input, honestly asymmetric', () => {
  const r = computeCapacityRange(BASE);
  assert.equal(r.ok, true);
  const v = r.variants.uncorrelated;
  // Differential σ is σ√2 ≈ 3.54 m on a 2 m-deep bowl: the distribution is
  // strongly asymmetric (clipped at zero), so the median can sit below V0.
  assert.ok(v.p50M3 > 0);
  assert.ok(v.p10M3 < v.p90M3);
  assert.ok(v.meanM3 < v.p90M3);
  assert.ok(v.maxM3 >= BASE.geometricCapacityM3);
});

test('samples bound enforced', () => {
  assert.equal(computeCapacityRange(BASE, { samples: 0 }).ok, false);
  assert.equal(computeCapacityRange(BASE, { samples: 10 }).ok, false);
  assert.equal(computeCapacityRange(BASE, { samples: 100_001 }).ok, false);
  assert.equal(computeCapacityRange(BASE, { samples: 64 }).ok, true);
  assert.equal(computeCapacityRange(BASE, { samples: 2.5 }).ok, false);
});

test('correlated variant is invariant under any common-mode shift (rim and floor move together)', () => {
  // For every bowl shape, a joint shift changes nothing: V stays V0.
  for (const k of [1, 0.6, 1 / 3]) {
    const depth = 2;
    const area = 12_000;
    const capacity = k * area * depth;
    const model = { depthM: depth, capacityM3: capacity, footprintAreaM2: area };
    assert.equal(geometricCapacityForDepthM3(depth, model), capacity);
  }
  const r = computeCapacityRange(BASE, { sigmaM: 10 });
  assert.equal(r.ok, true);
  assert.equal(r.variants.correlated.p10M3, BASE.geometricCapacityM3);
  assert.equal(r.variants.correlated.p50M3, BASE.geometricCapacityM3);
  assert.equal(r.variants.correlated.p90M3, BASE.geometricCapacityM3);
});

test('all reported percentiles stay finite for a near-cone sliver bowl', () => {
  // K just above the clamp floor: still must produce finite outputs.
  const r = computeCapacityRange({
    spillElevationM: 100.01,
    minimumElevationM: 100,
    geometricCapacityM3: 0.5,
    footprintAreaM2: 50_000,
    maximumDepthToSpillM: 0.01,
  });
  assert.equal(r.ok, true);
  for (const v of finiteFields(r)) assert.ok(Number.isFinite(v));
  assert.ok(r.shapeExponent <= MAX_SHAPE_EXPONENT);
});

test('output carries the notComputed and assumptions honesty blocks', () => {
  const r = computeCapacityRange(BASE);
  assert.equal(r.ok, true);
  assert.ok(Array.isArray(r.assumptions) && r.assumptions.length > 0);
  assert.ok(Array.isArray(r.notComputed) && r.notComputed.length > 0);
  assert.ok(r.notComputed.some((s) => /availableStorageM3|available storage/i.test(s)));
  assert.ok(r.notComputed.some((s) => /constraint|unknown/i.test(s)));
});
