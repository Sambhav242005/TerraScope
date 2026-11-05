# Natural water-storage screening

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


Implemented 4 November 2026: src/flood/naturalStorage.ts exports findNaturalStorage. This is a deterministic analysis component for R03, not a completed autonomous agent tool. A screening pipeline (below) now connects it to the map as an end-to-end candidate-storage slice.

## What it calculates

An original implementation of [Priority-Flood (Barnes, Lehman and Mulla, 2014)](https://arxiv.org/abs/1511.04463) floods a bounded elevation grid inward from open edges. Eight-neighbour connectivity determines each cell's minimum escape elevation. Cells below that surface form potential terrain-storage depressions. The original terrain is preserved.

Input: row-major elevations in metres, width/height, positive cell dimensions in metres, source ID and vertical datum. The caller must provide georeferencing and a suitable metric raster, with documented preprocessing. Geographic degree spacing must not be supplied as metres. Null means missing; any missing cell returns insufficient-data with no capacity results. Invalid dimensions/nonfinite values/provenance are rejected. Grid limit: one million cells; no device-performance claim.

Output: filled elevations and candidate cell indices, footprint area in m², lowest elevation and spill elevation in metres with the input datum, maximum depth to spill in metres, geometric capacity in m³ and exact piecewise-linear stage-volume breakpoints for the raster. Capacity sums (spill elevation - terrain elevation) times cell area. Available storm storage is explicitly null; suitability is unassessed. IDs are stable only within the same raster/indexing, not persistent geographic feature IDs.

## Boundaries

This detects closed terrain depressions, not every natural pond, wetland or river-connected floodplain. A DEM cannot by itself establish that a depression is natural, environmentally appropriate or available for storage. Buildings, embankments, road fills and DEM artifacts can also create depressions. Pond-surface elevations may hide underwater bathymetry. Soil permeability, groundwater, existing water levels, outlet geometry, seasonal inundation, ecological constraints and land rights remain unknown.

Capacity assumes impermeable empty geometry up to spill. It is not current free capacity, forecast water depth, detention duration or avoided flooding. No rainfall/runoff model, catchment delineation, floodplain hydraulic exchange or engineering assessment is implemented here. Compound depressions are reported at final spill; internal sub-basin hierarchy is not resolved. Cropped boundaries act as outlets and can underestimate storage; inspect sufficient surrounding terrain. Coarse or surface DEM data must not imply surveyed precision.

## Verification

Seven tests in tests/natural-storage.test.js cover exact bowl capacity, diagonal drainage, flat/sloping terrain, separated/compound depressions, missing/invalid data, determinism and input preservation. Fifty seeded 5×5 grids are checked against an independent exhaustive elevation-threshold connectivity oracle. All 21 repository unit tests and the production build pass. Existing large-bundle warning remains. These are software checks, not real-area hydrological validation.

## Screening pipeline as delivered — 4 November 2026

An end-to-end slice now connects the component above to the map: R03 candidate search integrated with R15 automatic behaviour. Every run carries runKind "historical-terrain-screening". This is terrain screening against currently mapped water, not validated hydrology, not an operational forecast and not a background agent service.

### Inputs (fetched at run time, not stored in the repository)

- Terrain: Mapzen Terrain Tiles "terrarium" DEM PNGs fetched per tile from `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` (src/flood/storage/terrainGrid.ts). Decode: (R×256 + G + B/256) − 32768 metres, from Mapzen's terrarium format documentation. Provenance const TERRAIN_PROVENANCE, sourceId "mapzen-terrarium-dem". Vertical datum string: "Terrarium composite (mixed sources; approximately orthometric). Vertical datum alignment to local benchmarks is unverified." Caveats recorded per run: the DEM is a surface model (buildings, vegetation and embankments appear as terrain), rivers and lakes may carry artificial or approximate elevations, and there is no bathymetry.
- Existing water: an OpenStreetMap API v0.6 bounded map extract of the analysis inner box at run time (src/flood/storage/osmWater.ts). The code refuses queries above 0.2 sq deg; the API's own cap is 0.25 sq deg. Attribution "© OpenStreetMap contributors (ODbL)".

### Grid assembly (src/flood/storage/geo.ts)

Web-Mercator global-pixel math. The analysis box has a halfSpanKm default of 3.6 plus a surrounding context ring (ratio 0.35) so cropped raster edges act as far outlets. The grid is the raw terrarium pixel lattice with no resampling; one uniform cell size is derived from metres per pixel at the box's mean latitude. Any missing tile for the planned grid fails the run with an explicit message that a missing raster is "not an absence of storage".

### Screening

src/flood/storage/storageSearch.ts orchestrates config validation → grid plan → bounded parallel tile fetch (per-session cache, ≤16 tiles by default) → deterministic priority-flood depression screening reused from src/flood/naturalStorage.ts (method id "priority-flood-d8-v1"; that component was not modified).

### Water-evidence classification (src/flood/storage/osmWater.ts)

Closed ways tagged natural=wetland|water, landuse=reservoir|basin|pond or waterway=riverbank are parsed as water features; open/incomplete ways and multipolygon relations are NOT parsed — they are counted in run provenance and disclosed in limitations. Each candidate is tested using cell centres against the parsed polygons and classified as overlaps | none-mapped | unavailable.

### Run record and persistence

Run record schema "terrascope-storage-v1", with a deterministic FNV-1a configHash of the centre (rounded to 1e-6) + halfSpanKm + contextRingRatio + maxTiles, and status succeeded | failed | cancelled | insufficient-data. Provenance records method, terrain source/attribution/URL template, tile zoom, metres/pixel, vertical datum, caveats, the water query URL, water retrieved-at, skipped counts and runKind; a limitations array accompanies it. At most 200 candidates are listed, sorted by geometric capacity descending, with fields: id, label ("Terrain depression N"), polygon, centroid, bbox, spillElevationM, minimumElevationM, maximumDepthToSpillM, footprintAreaM2 (= cells × cellWidth × cellHeight), geometricCapacityM3 (geometric empty-basin volume to the lowest rim point from the DEM), availableStorageM3 = null (deliberately: current fulfilment unknown), suitability "unassessed" and waterEvidence {status overlaps|none-mapped|unavailable, overlapCells, overlapAreaM2, features[]}. Persistence uses localStorage key "terrascope-storage-v1", capped at 60 candidates and 120 water features; the persisted copy intentionally drops the run's `water` field and stores `storedWater` separately; existing user saves elsewhere are untouched.

### Failure semantics

A tile failure fails the run. A water-fetch failure does not: status stays "succeeded", every candidate's waterEvidence becomes "unavailable", and a limitation states this is a data gap, not evidence of absence.

### UI behaviour

- src/flood/MapView.tsx — optional props storage/selectedStorage/onSelectStorage/showCandidates/showWaterLayer; GeoJSON sources "storage-candidates" (teal fill and outline, selected candidate highlighted via case expressions) and "storage-water" (dashed line overlay); clicking a candidate polygon selects it and does not move the review centre; selecting a candidate eases the map to it; layer visibility toggles; attributions carried in the GeoJSON source definitions.
- src/flood/WorldMap.tsx — the 3D explorer tab forwards the same storage props to its inner MapView.
- src/App.tsx — session restore via loadStorageRun/loadStoredWater; (R15/R18) automatic screening starts about 2 s after the review centre settles, skipped if the new centre is within about 500 m of the last run or its rounded config hash matches; a new run aborts the previous one (AbortController) and cancelled runs do not overwrite existing results; a "Re-run" button and a "Cancel" affordance; side-panel section "Natural water-storage candidates" showing the running phase, explicit failed/insufficient-data messages, a candidate list (largest first) with capacity/depth/footprint chips and a water-evidence tag, and a detail card with all numbers plus explicit "Unknown" fields (water available now; suitability) and a written unknowns paragraph (catchment inflows, seasonal level, infiltration/groundwater, embankments, current volume, land ownership/protection status); "Limitations (N)" and "Run provenance" disclosures including a link to the exact OSM query used; layer-panel toggles "Candidate storage" and "Mapped water"; devices without localStorage get a session-only notice instead of silent data loss.
- src/style.css — .storage-* UI styles added.

### Verification for this slice

`npm test` → 59 pass, 0 fail (38 new tests: terrain-geo 9, terrain-grid 8, candidate-geometry 6, osm-water 8, storage-search 7; the 21 pre-existing tests remain green). `npm run build` (strict tsc --noEmit + vite build) passes. Browser smoke test performed 4 November 2026 by driving the real app in an automated local Chromium: 12/12 functional steps passed (auto-run on load and after a centre move, run record with provenance, candidate detail with explicit unknowns, layer toggles, map-click selection, Re-run, cancel with prior results kept, 3D explorer, 390px layout) with 0 console errors and 0 warnings; evidence: artifacts/storage-candidates-browser.json + artifacts/01–09 screenshots. This remains a software check, not real-area hydrological validation.

## Integration work still needed

1. Ingestion adapter with actual georeferencing, metric spacing, source version, terrain uncertainty and complete basin bounds.
2. Existing water/wetland/land-cover layers and seasonal observations to distinguish mapped natural storage from terrain candidates.
3. Catchment/inlet/outlet, culvert, channel and bathymetry information, existing water occupancy and constraints.
4. Geographic output and same-view candidate overlay; automatic invocation from region/objective jobs. (The same-view candidate overlay and automatic invocation now exist for this slice — see above; other forms of geographic output remain open.)
5. Model inflow/outflow, infiltration and river exchange before estimating available storage or intervention effects; compare with independent observations.

Open gaps in the delivered screening slice, 4 November 2026:

- Catchment areas and inflow timing are unknown; no catchment delineation is implemented.
- Spill/outlet channel geometry is not surveyed; "spill" is the highest cell on the depression rim in the DEM.
- No bathymetry; current water volume/occupancy is unknown and availableStorageM3 stays null.
- Seasonal water behaviour is not modeled; OSM mapped water is "mapped presence", not a hydrograph or gauge record.
- OSM multipolygon water relations are unsupported (counted and disclosed); open ways are skipped likewise.
- Soil infiltration, groundwater, embankment works, land ownership and protection status are not assessed.
- No operational alerting or warning authority is implied, and nothing here validates flood behaviour.
- The terrain run happens per-session; no cloud/background agent service is deployed and none is claimed.
- Browser smoke verification of this slice was performed on 4 November 2026 via automated Chromium against the running app (see the pipeline section above and artifacts/storage-candidates-browser.json). A physical-phone performance check is still outstanding; 390px screenshots are desktop emulation, not a device claim.

The AI should call this component and explain its results, not generate candidate capacity numbers itself. Natural storage should be inspected before proposing excavation; protect existing ecological functions rather than automatically assigning wetlands as spare storage.
