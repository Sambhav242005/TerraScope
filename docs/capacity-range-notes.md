# DEM-error-aware capacity range — notes

**Status:** pure math + tests, no UI wiring. Orchestrator wires the candidate
panel afterward. Method id `monte-carlo-lite-rim-area-v1`; implementation
`src/flood/storage/capacityRange.ts`; tests `tests/capacityRange.test.js`.
Requirement context: R03 (candidate water-storage search) gap G9 — sensitivity /
uncertainty analysis — in `artifacts/agents/B-storage-candidates.md`; gate V3.
Date: 2026-11-15.

---

## 1. What it computes, exactly

For one candidate depression already present in a screening record
(`StoredCandidate` in `src/flood/storage/storageSearch.ts`), given:

| input | record field | unit |
|---|---|---|
| spill (rim) elevation | `spillElevationM` | m |
| floor elevation | `minimumElevationM` | m |
| geometric empty-basin capacity | `geometricCapacityM3` | m³ |
| footprint area | `footprintAreaM2` | m² |
| maximum depth to spill | `maximumDepthToSpillM` | m |

the module reports an **illustrative interval** for the propagated
`geometricCapacityM3`, for two error variants:

- **correlated** — floor and rim perturbed by one shared draw (same DEM;
  common-mode / bias-class error). Because geometric capacity depends on
  elevation *differences*, this variant never moves the estimate; it is
  reported (degenerate, exactly the input capacity) rather than silently
  dropped.
- **uncorrelated** — floor and rim perturbed independently (differential /
  random-class error); this variant moves the estimate and carries the real
  uncertainty signal.

Output (when accepted): P10 / P50 / P90 (linear interpolation on sorted
samples, "type 7"), mean, std-dev, min, max, `clippedToZeroCount` per variant.

**Exact label every surface must render verbatim:**

> `illustrative range from DEM vertical error only; not a tolerance on available storage`

`availableStorageM3` remains `null` wherever this range is shown.

## 2. Formulas

- Depth: `d = spillElevationM − minimumElevationM` (== `maximumDepthToSpillM`;
  consistency enforced to 0.5 % + 1e-6 m, else refusal).
- Shape factor: `K = V0 / (A · d) ∈ (0, 1]`
  (a flat-bottomed bowl K → 1; a perfect cone K = 1/3).
- Shape exponent: `q = 1 / K`, clamped to `MAX_SHAPE_EXPONENT = 32` (documented
  clamp; unreachable for any real bowl, whose K is far above the sliver regime).
- **Rim-area-from-footprint stage model** (the repo's internal approximation,
  not surveyed hydraulics):
  `V(d') = V0 · (d'/d)^q`, where `d'` is the perturbed depth.
  Differentiating at `d' = d` gives exactly `dV/dd' = A` for every bowl shape —
  rim sensitivity equals the footprint-area approximation for all K. This
  property is unit-tested.
- Perturbation: `d' = d + ε_rim − ε_floor`; correlated variant uses
  `ε_rim = ε_floor`. `ε ~ N(0, σ_h)`, σ_h from the documented error model.
- `d' ≤ 0` ⇒ the depression vanishes in that sample: volume 0,
  `clippedToZeroCount += 1`, samples are **never redrawn**.
- Defaults: σ_h = 2.5 m (see §3), `samples = 2000` per variant, mulberry32
  PRNG with fixed seed `CAPACITY_RANGE_SEED = 20261115`, Box–Muller normal
  sampling. Both variants share one base stream (directly comparable).
  Same inputs + same options ⇒ bitwise-identical output (unit-tested).
  Callers may pass `options.rng` for their own stream (tests); then `seed` is
  reported `null`.

## 3. The 2.5 m figure — provenance and honesty status

- In-repo, the re-verified provider statement is from the **Copernicus DEM
  (COP-DEM) product page** (live-fetched 2026-11-15, recorded in
  `artifacts/agents/B-storage-candidates.md` §3.3): GLO-30 / GLO-90 free,
  registration required, **EGM2008 (EPSG:3855)** vertical datum,
  **"< 4 m LE90 absolute vertical accuracy, < 2 m relative on slopes ≤ 20%"**;
  dataset IDs `COP-DEM_GLO-30-DGED/DTED`; DOI 10.5270/ESA-c5d3d65;
  TanDEM-X core 2011–2015.
- Mapzen terrarium (current runtime source) is a **mixed-source composite**
  with an **unverified vertical datum**; no provider root-mean-square or LE90
  figure for it is recorded in-repo at all
  (`src/flood/storage/terrainGrid.ts` provenance constant;
  docs/NATURAL_STORAGE.md).
- **The exact 2.5 m σ_h figure is NOT verified anywhere in this repository.**
  The exact figure is documented in the provider notes — callers must supply
  it; default is 2.5 m as a documented assumption, never as a measured value.
  Population-mean absolute vertical error of Copernicus GLO-30 / Mapzen
  terrarium-class products is commonly quoted in the ~2–3 m band on flat
  agricultural terrain, where height error dominates volumetric error — use
  that band as context, not as a substitute for the provider figure for the
  specific DEM in use. Any surfacing layer or caller with a better local
  estimate MUST pass `options.sigmaM`.
- A DEM swap (terrarium ↔ GLO-30) is **not** a parameter tweak: it changes
  every quoted elevation and every capacity. It requires a re-run and a
  side-by-side delta report (see B-storage-candidates.md §3.3). Numbers from
  this module are only valid for the DEM they were computed from.

## 4. Nullness semantics

| situation | result |
|---|---|
| footprint area unknown (`null` / `undefined` / non-finite) | `{ ok: false, reason }` — **refusal, never zero** |
| capacity missing / non-finite / ≤ 0 | refusal — never zero, never reconstructed from area × depth |
| floor ≥ rim | refusal — no positive depth exists |
| stated depth inconsistent with spill − floor (> 0.5 %) | refusal — aggregate fields do not describe one depression |
| `V0 > A·d` (capacity exceeds footprint × depth) | refusal — inputs inconsistent |
| depth < 1e-6 m (micrometre sliver) | refusal — DEM posting dwarfs it |
| σ / sample bounds violated / non-finite stats | refusal |
| missing tiles / missing DEM at screening time | **outside this module's scope** — screening already fails the run explicitly; nothing here repairs it |

Missing data is never zero, never "safe", never interpolated. Refusal carries
a human-readable `reason` and is the only admissible failure shape.

## 5. DEM error is NOT the same as missing constraint evidence

- This module quantifies **DEM vertical-error propagation into a screening
  volume**. It says nothing about buildings, roads, water, embankments,
  ownership, ecology, infiltration, outlet control, or occupancy.
- A zero-width interval would still convey nothing about constraint coverage.
  Unknown constraints stay `unknown` / `unavailable` in the run record; they
  are never upgraded by an error bar, and never downgraded to "clear".
- Constraint findings (G2/V1 in the candidate report) are separate evidence
  with their own refusal semantics (`coverage: unavailable`). The two must
  not be merged, averaged, or co-badged in any UI.
- `availableStorageM3` is `null` before and after any use of this module.

## 6. Assumptions and unverified items (carry verbatim into any UI note)

1. Rim area ≈ footprint area — **unverified** against any survey; not a
   measured shoreline; bathymetry unknown.
2. σ_h = 2.5 m default — assumption, never a measured value (§3).
3. Only elevations perturbed; footprint area, lattice, floor/rim cell
   identities treated as exact.
4. Correlated and uncorrelated variants share one random stream; neither is a
   confidence interval (the "distribution" is an assumed Gaussian, not fitted).
5. `clippedToZeroCount > 0` means some draws imagine a vanished depression —
   reported, never redrawn, never hidden.
6. The interval is not portable across DEMs, zooms, or datum transforms.
7. `d' ≤ 0` handling (volume 0, clipped count) understates symmetric noise in
   very shallow bowls; that is deliberate honesty, not a bias correction.

## 7. Refusals (machine-readable `{ ok: false, reason }`)

Every refusal path is listed in §4. Summary: non-finite/missing inputs,
non-positive capacity or area, floor ≥ rim, depth–spill/floor inconsistency,
capacity beyond the footprint × depth bound, micrometre depths, σ out of
[0, 1000] m, samples out of [64, 100 000], non-integer seed, non-finite
output statistics. The module never throws for bad data and never emits
NaN/Infinity.

## 8. What was deliberately NOT computed

- Per-cell stage-volume propagation (requires the DEM lattice, not aggregates;
  the record deliberately carries only aggregates).
- Elevation-error **spatial correlation length** (assumed cell-local;
  a full geostatistical model needs per-cell residuals, which this repo does
  not store).
- Datum offset vs. any local benchmark (none exists in-repo).
- Horizontal error, cell-size error, polygon/footprint uncertainty.
- Available storage, suitability, constraint coverage, flood effect — all
  explicitly out of scope (see §5).

## 9. UI wiring guidance for the orchestrator

- Render the interval with the exact label string from
  `CAPACITY_RANGE_LABEL`. Do not paraphrase to "confidence interval",
  "likely storage", "tolerance", "accuracy" or "error margin".
- Show both variants or clearly caption which is shown; correlated is expected
  degenerate and is shown for symmetry, not for information.
- Keep `availableStorageM3: null` rendered as unknown, adjacent to this range.
- Do not merge with constraint findings. Do not draw a tolerance band on any
  capacity chart without the method id and the label.
- Nothing here is hydrological validation; software correctness is not validation (docs/NATURAL_STORAGE.md).

## 10. Citation list (DEM error sources)

- Copernicus DEM GLO-30/GLO-90 — Copernicus Data Space Ecosystem, COP-DEM
  product page; DOI 10.5270/ESA-c5d3d65; "< 4 m LE90 absolute, < 2 m relative
  on slopes ≤ 20 %"; EGM2008; 1″ posting; in-repo record:
  artifacts/agents/B-storage-candidates.md §3.3 (live-verified 2026-11-15).
- Mapzen terrarium open elevation tiles — mixed-source composite; vertical
  datum unverified; in-repo: `src/flood/storage/terrainGrid.ts:17-32`;
  limitations: docs/NATURAL_STORAGE.md.
- CartoDEM — evaluated Sept 2011 docs (8 m LE90) in
  docs/research/indian-data-access.md — **not acquired, not usable, login
  denied**; listed only so no one cites it as a local reference.
- HydroBASINS v1c — unrelated to vertical error; hydro-conditioned topology,
  per docs/DATA.md. Listed to prevent mis-citation.
