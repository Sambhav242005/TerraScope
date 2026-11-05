# Placement evidence checks ? 5 November 2026

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


Implemented partial R03/R06/R11/R14/R15/R16. This is deterministic geographic screening, not AI, engineering approval or a calibrated suitability model. R01?R18 remain in scope; no catchment, hydraulics, wake/energy model, optimization or autonomous local agent is completed here.

## User journey and rules

A map click, candidate adoption or coordinate form creates a reversible proposal. Current proposals are checked automatically when the evidence bundle loads and whenever proposals change. Restored proposals are checked afresh; no old validation verdict is trusted. Proposals/checks list and the Why this location panel remain available without selecting a map marker. A source failure yields unknown with retry; retry rechecks existing objects without creating duplicates. A mapped channel conflict remains an investigatory proposal and is not silently deleted or approved.

Conventional land-based wind, ground solar and basin footprints crossing mapped river/water, road centerlines or buildings show a mapped conflict. Vegetation overlaps ask about bank/infrastructure position and riparian connectivity instead of claiming any water overlap is unsuitable. An adopted natural-storage candidate overlapping existing water also remains an investigation: this does not mandate excavation or imply that existing ponds must be rejected. No-hit never becomes suitable/safe; footprints outside every source are explicitly outside available coverage.

## Inputs, provenance and methods

`scripts/build-placement-evidence.py` derives `public/data/placement-evidence.json` from the archived `artifacts/osm-source.xml` and the two pinned NRSC images in `public/data/nrsc/manifest.json`. It has no network operations. It requires Pillow for decoding source pixels; it does not edit the displayed images. It records source URLs, retrieval dates, bounds and SHA-256 fingerprints. 9,175 features, approximately 3.45 MB uncompressed; no real-phone speed/memory claim. Rebuild the bundle after changing source snapshots and reload the application. A stale bundle is not a live data-refresh service.

- **OSM:** bbox 85.14,25.68,85.19,25.73; archived 4 November 2026. Closed water/river polygons, river and highway centerlines and building footprints only. Raw water subtype/names retained: Ganges way/44448297 and Gandak way/22825284. ODbL, OpenStreetMap contributors. Relations/incomplete ways omitted. Complete ways may extend outside the query bounds, so positive intersections outside remain evidence, but absence there is unknown. Decorative trees, illustrative heights and DEM depressions are excluded. OSM is not a channel survey, current inspection or land-title source.
- **NRSC:** 1 October 2024 10Hr and 2 October 2024 06Hr (provider hour timezone unverified); bbox 85.05,25.6,85.3,25.85. Source: NRSC, ISRO/DOS, attributed non-commercial development snapshots. Exact original-image hash verified before deriving cells. A disclosed rendered-map-color heuristic selects R<80, G>180, B>180, alpha>128. Selected cells become horizontal row-run rectangles using the source image's EPSG:3857 registration, then geographic WGS84 corners. Watermark/background/transparent/unmarked pixels never become evidence of no flood. This is provider-map-color overlap screening, not a validated classification mask, flood probability or depth. Native sensor resolution, accuracy, permanent-water treatment, coverage masks and publication latency remain unverified. Do not use this as forecast input or claim current exposure.

All intersection coordinates are geographic WGS84 longitude/latitude; no vertical datum or height calculation is used. Manually placed objects have an explicitly assumed area-equivalent square centered on the pin, using local metres-per-degree spacing. This is an approximate screening envelope, not known panel orientation, turbine setback, rotor clearance, cadastral parcel or actual construction footprint. Adopted candidates retain the DEM polygon including holes. Footprint outlines are dashed and accompany text findings. Road widths are unknown: only centerline crossing is checked; there is no invented setback or completeness claim. Boundary touch counts as a potential conflict. Polygon containment, crossing edges, holes and line crossings are checked independently of camera, frame rate and layer visibility.

The pure `checkPlacement()` implementation validates metadata/geometries and returns source/feature references, findings and kind-specific unknowns. It never returns a pass/suitable verdict or invented confidence percentage. Land rights, drainage, soil/foundations, wind/solar resource, current water, bathymetry, outlet/overflow and model effects remain unassessed where applicable. No safer alternate location is recommended from absence of mapped constraints.

## Comparison correction

Both reference and changed-assumption runs now use the same archived hourly rainfall and user rainfall multiplier. Reference loss=0.35 and response time=8 h; changed loss/time come from the explicit controls. Both start with zero storage. Exports include referenceSettings, comparisonKind=matched-rainfall-parameter-sensitivity and placedInterventionsApplied=false. Adding/removing pins does not change these curves. This is a parameter experiment, not before/after intervention hydrology. The previous Local AI Planning Synthesis / Simulated retention card has been replaced by a truthful screening/proposal summary. Missing screening outputs no longer become zero in that summary. Inspector volumes and nameplate ratings are labelled assumptions or DEM geometry, not measured available storage or generation.

## Evidence and verification

- Geometry tests: contained/crossing polygons, holes, touching boundaries, road crossings, absent/outside evidence, kind-specific treatment, malformed input, determinism and immutability.
- Real-input tests identify Ganges and Gandak, dated NRSC map-color overlap and no-coverage handling; fingerprints match the archived inputs.
- `python tests/placement_evidence_test.py`: 2 checks independently match every exported color cell to the original RGBA pixels and Mercator registration; transparent/white/black watermark-like pixels do not trigger the classifier. This tests transcription, not scientific detection accuracy.
- `node tests/placement-validation-check.mjs`: eight integrated checks: real channel conflict, restored-proposal recheck, vegetation investigation, dated NRSC warning, out-of-coverage unknown, matched forcing/export and pin invariance, 360px coordinate/focus path, failed-source retry without duplication. Evidence: `artifacts/placement-validation-report.json` and `artifacts/placement-{channel-conflict,mobile-check,matched-comparison}.png`.
- Updated existing flood/intervention browser tests pass; the general world checks also pass. These do not establish persistent single-world navigation, physical-phone performance, scientific suitability or local AI.

## Primary research basis

The DOE explicitly recommends assessing river/body-of-water and stormwater flooding for PV sites: https://www.energy.gov/cmei/femp/preventing-and-mitigating-flood-damage-solar-photovoltaic-systems . This is general siting guidance, not Indian regulatory approval or a local threshold.

San Diego County describes detention as temporary storage followed by controlled discharge, with outlet/overflow structures: https://www.sandiegocounty.gov/content/sdc/dpw/watersheds/DevelopmentandConstruction/S-BMPs/Fact_Sheets/Detention_Basins.html . It supports preserving the catchment/outlet prerequisites; no jurisdiction-specific coefficient is transplanted here.

NRSC terms: https://www.nrsc.gov.in/nrscnew/termsConditions.php . Source access audit: docs/research/indian-data-access.md. Context7 was unavailable; official Pillow and MDN documentation were consulted for image reading/fetch mechanics. Modern Web Guidance accessibility was applied to labels, focus, native disclosure controls and meaningful status text.

## Next scientific dependencies

P1: catchment/inflow routing, real outlet/culvert and bathymetric/current-water evidence, baseline/intervention adapters under identical forcing and boundary conditions, downstream checks and independent evaluation. P2: separately supported solar energy/surface and wind resource/wake adapters with their inputs/uncertainties. P3: bounded candidate optimization with explicit exclusions and unknowns, followed by a real local tool-using agent/harness. These remain pending rather than being represented by better-looking pins or favorable graphs.

## Final verification and adjacent evidence correction

Final checks: 85/85 JavaScript unit tests; 2/2 independent pixel/registration tests; eight integrated placement checks; existing flood (13), intervention and world browser checks pass. Production build passes with the pre-existing large-bundle warning. Browser assertions are software evidence, not surveyed-site validation.

During review, `storageSearch.ts` was found to count distinct mapped water features as overlapping cells. It now counts each overlapping candidate cell once while retaining all feature IDs, including coincident polygons. A regression checks full-bowl and duplicate-water coverage. New runs record waterEvidenceVersion=2. Legacy sessions retain geometry and mapped-presence status but their incorrect numeric overlap counts/area become null with a re-run limitation; existing terrain and proposals are not discarded. These are still cell-center area approximations, not exact water boundaries or available capacity.
