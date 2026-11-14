# TODO — Build the flood-preparedness prototype

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](docs/CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


## Active execution order — supersedes earlier review-first tasks

- [x] Header simplification and user onboarding guide (14 November 2026, partial R01/R13/R14): solved multi-story header clutter by consolidating topbar and casebar into a single 52px row and condensing commandbar into a 40px utility strip with direct placement tools. Added an accessible "What am I looking at?" onboarding guide specifically for lay users explaining natural basins, water level simulations, and interventions. Fixed MapView attribution UTF-8 character encoding corruption. All 98 unit tests and browser check suites (flood-check, world-check, intervention-check, placement-iterative, placement-validation, search-area-collision, nrsc-check, renewables-3d) pass. Verified 360px mobile viewport without horizontal overflow.

- [x] R03/R13/R14 partial (14 November 2026): candidate details show a deterministic DEM transect through the lowest candidate cell, floor/spill labels and an expandable sample table. Missing transect terrain withholds the chart; invalid optional saved profiles are discarded without deleting candidates; older records offer re-screening. Evidence: tests/candidate-profile.test.js (6 tests), storage-search integration assertions, 98/98 unit tests and production build pass. No browser/device verification of this slice; no catchment, surveyed section, bathymetry or hydraulic capability added.

- [x] R03 partial: implement and test deterministic terrain-depression screening, spill elevations and geometric stage-volume capacity. Evidence: src/flood/naturalStorage.ts, seven tests including an independent 50-grid oracle, docs/NATURAL_STORAGE.md. Not a real-area result or completed storage-search feature.
- [x] R03 integration (candidate-storage slice): runtime ingestion of georeferenced terrarium DEM terrain, per-candidate OSM mapped-water evidence, and candidate polygons displayed in the single world with automatic run on area selection. Evidence: `npm test` 59 pass / 0 fail (38 new: terrain-geo 9, terrain-grid 8, candidate-geometry 6, osm-water 8, storage-search 7; 21 pre-existing green); `npm run build` passes; src/flood/storage/{geo,terrainGrid,candidateGeometry,osmWater,storageSearch}.ts, src/flood/MapView.tsx, src/flood/WorldMap.tsx, src/App.tsx, src/style.css; docs/NATURAL_STORAGE.md. Browser smoke test not yet performed.
- [ ] R03 remaining: catchment/outlet analysis, land-cover/constraint intersection, geographic export and an AI/agent hook for the candidate-storage slice (no AI hook exists yet).
- [ ] R03 open gaps: catchment areas and inflow timing (no delineation); spill/outlet channel geometry not surveyed ("spill" = highest rim cell in the DEM).
- [ ] R03 open gaps: no bathymetry — current water volume/occupancy unknown, availableStorageM3 stays null; seasonal water behaviour not modeled (OSM water is mapped presence only).
- [ ] R03 open gaps: OSM multipolygon water relations and open ways unsupported (counted and disclosed); soil/groundwater/embankment/ownership not assessed.
- [x] R03 verification: browser smoke test of the storage slice performed 4 Nov 2026 with an automated Chromium run against the real dev app and real network data — 12/12 functional steps, 0 console errors/warnings, evidence at artifacts/storage-candidates-browser.json and artifacts/01-09*.png (in-app desktop-browser check unavailable; screenshots use 390px desktop emulation, so a physical-phone performance check remains open).
- [x] R04/R05/R10/R13 partial — map-visible replay and terrain water scenario (14 Nov 2026): replay day updates a labeled GloFAS sample-cell discharge marker; NRSC observed snapshots auto-load only on 1-2 Oct 2024 with no interpolation; an off-by-default 44-64 m flat water surface paints DEM cells below it with illustrative relative depth bands. Merged headers into one 84px bar and compacted the map summary, layer toggle and timeline (158px). Evidence: `npm run build` passes; `npm test` 92/92; flood-check 13/13; placement-iterative 5/5; placement-validation 7 checks; world-check 6/6; NRSC, search/area/collision checks pass; artifacts/replay-ui-1-initial.png through replay-ui-6-3d.png and artifacts/replay-simulation-gallery.html. Not a flood forecast, extent or validated hydrology.
- [ ] R04/R05/R13 open gaps: no calibrated hydraulic/stage-discharge solver, vertical-datum alignment, channel cross-sections, bathymetry, embankments or gauge calibration, so water-surface elevation is user-set and terrain-only; DEM includes buildings/vegetation; no timing, rise-from-baseline or missing-data mask; no physical-phone performance recording.

Automation correction: R15–R18, docs/PRODUCT_AUTONOMY.md and docs/AGENT_HARNESS.md supersede prompt-by-prompt/manual-first assumptions below.

- [x] Define final-product jobs, automatic/manual ownership, proactive agent roles and harness acceptance contract. Documentation only.
- [ ] R15/R18: Build a region/objective bootstrap that starts discovery and analysis without repeated prompts; verify one complete supported journey before adding isolated widgets.
- [ ] R16: Implement registered source discovery/ingestion, coverage/freshness checks, alternative-source handling, versioned caching and dependency invalidation. Prove a second supported region needs no code changes.
- [ ] R17: Implement persisted job graph, local model adapter, scoped workers, idempotency, checkpoint/restart, retry limits, budgets, cancellation and separate verification. Exercise known-good/bad, offline, duplicate-trigger and interrupted-run cases.

Scope: docs/REQUIREMENTS.md R01–R14:
- [x] Record user-confirmed single-view, local AI, storage, placement, renewable and ENSO requirements; document our scope failures in MISTAKE.md.
- [ ] R01: Consolidate the existing UI into one persistent 3D world with filters, contextual panels and shared area/time/scenario state. Retain all workspace lenses and test suites without separate full-page tab reloads. Evidence: `tests/world-check.mjs`, `tests/flood-check.mjs`, `tests/history-check.mjs`, `tests/intervention-check.mjs` all 100% green.
- [ ] R02/R12: Audit hardware, choose and benchmark a local model/runtime, connect real retrieval and structured GIS/model tools.
- [ ] R06: Implement reversible placement/drawing and parameter editing for storage, solar, wind and vegetation, with keyboard alternatives and persistence. Distinguish placement-only objects from supported calculation inputs. Evidence: `src/flood/intervention.ts`, `tests/intervention.test.js` (4 unit tests), `tests/intervention-check.mjs` (E2E test), MapView pins, candidate depression adoption button.
- [ ] R03/R11: Audit terrain/surveys/constraints and implement tool-based storage-candidate search.
- [ ] R04/R05/R13: Benchmark and connect a suitable spatial hydraulic model; produce real depth/elevation/time fields and map playback.
- [ ] R08/R10: Connect dated ENSO context and event/year selection in the same view. Evaluate regional/seasonal relevance; no fixed rainfall factor or future-data leakage. Evidence: `src/flood/enso.ts`, NOAA CPC ONI 2015-2024 data, `tests/enso.test.js`, casebar ENSO live badge.
- [ ] R07: Complete the supplied renewable evidence matrix; implement supported energy/wake/land-surface adapters.
- [ ] R09: Retain forest/land-use, drought/fire and other environmental processes.
- [ ] R14: For every delivery, report requirement IDs, actual evidence, outstanding dependencies and scope changes.

Authoritative execution backlog. The bounded software prototype is implemented (see docs/DELIVERY.md). The broader research/operational items below remain pending unless explicitly checked. A checked task requires the stated evidence; estimates and attractive screenshots do not count as validation. TASKS.md summarizes status without duplicating this backlog.

## 0. Lock the first scientific question

- [ ] **Choose one pilot and event.** Compare the exact Nepal event the user identifies with one Bihar/UP river reach. Audit rainfall/gauge archives, survey quality, observed flood footprints, data rights and reviewer availability. Record the choice and rejected alternatives in DECISION.md. Done when a bounded area/event and obtainable reference observations are documented.
- [ ] **Choose the honest demonstration mode.** Inventory forecasts and their issue/availability times. If archives are missing, select historical reconstruction rather than calling realized-rainfall playback a forecast. Done when every input fits the selected mode.
- [ ] **Define the user and outcome.** Specify whether the first user is a student analyst, field coordinator or district planner; define one decision the prototype helps prepare. Default proposal: inspect exposed resources and draft verification/preparation tasks. Done when one end-to-end case can be explained without claiming certified warnings.
- [ ] **Confirm scope, name and budget.** Resolve TerraScope naming, API/compute allowance, local experts and hosting limits. Keep one case, optional3D and explicit unknowns. Do not make paid commitments without authorization.

Gate A: no new scientific UI claims until the case and data feasibility are documented. Work on generic accessible map/panel scaffolding can proceed while data questions remain open.

## 1. Obtain and audit data

- [ ] **Create a versioned source manifest.** Use docs/DATA.md as the starting inventory. Record source URL/license, version/checksum, bounds, CRS/datum, units, resolution, observation/issue/publication/retrieval times and processing. Done when every displayed layer can open its provenance card.
- [ ] **Prepare OSM context.** Obtain a bounded licensed extract or compliant tile service for roads/buildings/waterways. Keep attribution visible and check caching/offline policies; no mass downloads from public tile servers. Done when the selected area loads with documented terms and missing coverage.
- [ ] **Acquire terrain and river surveys.** Begin with elevation screening, then seek river cross-sections, bathymetry, levee/embankment crests, culvert sizes and local benchmarks. Verify vertical datum alignment. Done when the team can justify the spatial precision of intended outputs; otherwise downgrade to screening.
- [ ] **Acquire land records separately.** Check state Bhu-Naksha/revenue access for selected parcels and survey IDs. Verify georeferencing, survey age, access/export permissions and boundary uncertainty. Keep legal records distinct from OSM/physical surveys; avoid unnecessary ownership names. Done when a sample aligns with independent control points or is explicitly marked unaligned/unavailable.
- [ ] **Acquire rainfall and hydrology.** Obtain event observations plus pre-event rainfall/river state, forecast archives if available, upstream flows and relevant operations/boundary records. Preserve latency and gaps. Done when a complete input timeline can be reproduced without future leakage.
- [ ] **Acquire land cover, soil and assets.** Check dated land-cover maps, soil/infiltration parameters and sourced homes/crops/roads/facilities/shelters. Record unknown capacities and incomplete maps. Done when exposure calculations use defensible geometries and never treat missing assets as absent.
- [ ] **Reserve independent outcome evidence.** Obtain flood footprints, high-water marks, gauge records and documented impacts for evaluation. Keep calibration and held-out sets separate. Done when the held-out reference is fixed before fitting.

Gate B: produce a data-availability report with usable, restricted, missing and unsuitable inputs. Do not silently replace missing measurements with invented constants.

## 2. Build the data pipeline and map foundation

- [x] **Preserve the old application.** Before replacing source, create an isolated branch/copy or clear legacy entry point; retain existing saves/tests as historical. Do not convert game saves into environmental cases. Done when old work is recoverable and new storage is independent.
- [ ] **Normalize scientific inputs.** Implement unit/CRS/timezone conversion, vertical-datum checks, missing-data masks, bounds checks and immutable raw-data storage. Test mismatched units, shifted rasters and publication dates. Done when a small known fixture aligns correctly and bad inputs fail visibly.
- [ ] **Prepare efficient browser assets.** Clip data to the pilot, generate appropriate tiles/overviews and versioned manifests. Serve lightweight results rather than loading national rasters on a phone. Done when measured transfer/memory costs are recorded.
- [ ] **Implement map and layer inspection.** OSM context, terrain option, legends, attribution, source details, time selector and accessible tables. Add stale/missing-data and failed-layer states. Done when essential actions work without3D and at360px.

## 3. Select and implement a defensible model

- [ ] **Compare candidate approaches.** Evaluate a simple baseline, rainfall-runoff/routing and any hydraulic solver against available geometry, compute, licensing and validation needs. Use current primary documentation and domain review; record why the selected model is appropriate. Do not begin with a custom global climate engine.
- [ ] **Define initial/boundary conditions.** State initial soil wetness, river levels, upstream inflows, downstream conditions, roughness and operations assumptions. Mark breach scenarios separately. Done when no parameter is an unexplained magic constant.
- [ ] **Build a reproducible runner.** Separate ingestion, calculation and rendering; store input hashes, model version, settings, status and outputs. Include units, numerical/conservation checks where applicable, and explicit solver failure. Done when identical inputs reproduce documented tolerances regardless of frame rate.
- [ ] **Implement the baseline replay.** Reconstruct the historical event with the appropriate input mode and compare with references. Do not tune solely until the map looks convincing. Done when errors and failures are reported, not hidden.
- [ ] **Add bounded uncertainty/sensitivity runs.** Vary supported rainfall members, wetness, roughness and boundary assumptions. Explain whether ranges are ensemble spread, sensitivity bounds or calibrated probabilities. Done when the UI cannot mislabel a sensitivity band as a probability.
- [ ] **Add only supported counterfactuals.** Keep forcing comparable; change explicitly modeled land cover, drainage or storage parameters. Do not implement forest restoration as an automatic flood-reduction multiplier. Done when the mechanism, scale and limitations of each option are documented.

Gate C: no precise depth/arrival-time labels until the selected model and input quality support them. Screening-only delivery is acceptable if clearly disclosed.

## 4. Evaluate honestly

- [ ] **Freeze the evaluation protocol.** Follow docs/VALIDATION.md: pre-event cutoff, availability timestamps, train/calibration/test separation, official/simple baselines and non-event periods. Done when the test event cannot influence fitting or thresholds.
- [ ] **Measure predictive and spatial skill.** Report appropriate flow/stage/depth/extent errors, recall, precision, false-alarm burden and useful lead time. Include missing ground truth and uncertainty in the report. Done when figures can be regenerated from saved runs.
- [ ] **Evaluate safety trade-offs.** Plot thresholds against missed severe events, false alerts and action costs; include the warn-everywhere baseline. Have domain reviewers assess weights and action levels. Done when the chosen demonstration threshold has a written rationale; it remains non-operational.
- [ ] **Separate failure causes.** Analyze rainfall forecast error, terrain/channel error, missing operations, numerical failure and exposure-map error. Done when limitations affect the displayed confidence and claims.

## 5. Exposure and human verification

- [ ] **Implement asset overlays.** Intersect supported hazard outputs with sourced assets; avoid duplicate counts and report coverage. Distinguish potential exposure from damage/loss. Done when sampled intersections are manually checked.
- [ ] **Build a verification queue.** Request location/time-stamped evidence for obstructions, asset status and survey gaps. Add assignment, evidence, reviewer notes and unresolved/conflicting states. Demo-only identities/media must be labeled.
- [ ] **Define field procedures with experts.** Specify measurement methods, safe observation boundaries, coordinate/height references and consent. Do not direct volunteers into floodwater or hazardous structures. Done when the prototype's task language is reviewed and it does not delay official warnings.
- [ ] **Support versioned corrections.** Approved observations may update inputs and trigger reruns. Preserve old results, reasons and provenance. Done when the before/after change is auditable and unsupported observations do not silently override measured data.

## 6. LLM/VLM assistance and counter-planning

- [ ] **Build an approved guidance collection.** Use relevant disaster plans/SOPs with source, date, jurisdiction and review status. Retrieve only relevant passages and cite them. Done when draft actions are traceable to inputs and applicable guidance.
- [ ] **Implement bounded LLM drafts.** Produce situation summary, exposed-resource list, verification requests, preparation options and unresolved dependencies. Missing shelter capacity/routes/contacts remain unknown. Done when every numerical claim comes from a referenced result, not model invention.
- [ ] **Add optional VLM extraction.** Start with reviewed survey-document transcription or field-image issue flags. Store original evidence and extraction confidence. Done when reviewers can correct mistakes; no photo-only depth or structural-safety certification.
- [ ] **Compare preparedness options.** Explore resource pre-positioning, equipment protection, shelter availability and access alternatives against explicit constraints. Route safety/capacity must be verified. Structural schemes require engineer review and downstream-risk analysis.
- [ ] **Test AI failure cases.** Missing/conflicting evidence, irrelevant SOPs, malicious text inside documents, stale data and unsupported certainty. Done when the system refuses to fabricate evidence, keeps drafts clearly labeled and requires review before export as an approved plan.

## 7. Product quality and mobile verification

- [ ] **Complete one clear journey.** Select case → replay → inspect resource → request verification → review evidence → draft plan. Keep scientific labels and uncertainty in the main flow, not buried in a disclaimer.
- [ ] **Test accessibility/fallbacks.** Keyboard, focus order, touch,360px, zoom, reduced motion, pause,2D/table fallback, failed WebGL/network and corrupted saved state. Done when documented browser checks pass.
- [ ] **Measure a physical phone.** Record device, OS/browser, network, dataset size, loading time, memory/interaction behavior and frame timing. Review recordings for camera/state glitches. Use tiled/adaptive detail and offscreen suspension as needed; target30 FPS for animated map views without claiming unmeasured success.
- [ ] **Review with a new user and domain reviewer.** Can they distinguish observations, scenarios and predictions? Can they identify uncertainty and next verification steps? Record findings and fix misleading language.

## 8. Competition delivery

- [ ] **Recheck Embarko and IIT Indore rules.** Record official source/date, eligibility, current deadlines and required artifacts. Do not rely on archived game-plan dates or assume one entry meets both competitions.
- [ ] **Validate hosting feasibility.** Check static assets, data size, backend/API needs, secrets, cost and persistent hosting. Package a cached historical case for a dependable demo; explain offline/precomputed results honestly.
- [ ] **Prepare reviewable release.** Run relevant model/build/browser checks, source/license audit, real-device review and content/claim review. Include scientific limitations and reproducibility notes.
- [ ] **Prepare video and submission text.** Show a real interaction, evidence, limits, human review and the actual authorized Embarko deployment process. Do not use generated concept imagery as footage of working features.
- [ ] **Obtain external-action authorization.** Present the finished release/video/text for deployment, publishing or submission as applicable. Do not send messages, warnings or entries merely because this checklist mentions them.

## 9. Separate renewable-energy research backlog

- [ ] Preserve and review the supplied full research brief in docs/research/renewables-question.md.
- [ ] Build the verified literature/evidence matrix described in docs/RESEARCH.md, including the unverified numerical claims.
- [ ] Specify energy/momentum budgets, compare alternative explanations and design reproducible illustrative experiments.
- [ ] Evaluate expert-grade regional modeling only after defining scale, validation data, compute and reviewer access.
- [ ] Add renewable siting or local environmental scenarios to the product only when their mechanisms and uncertainty are supported. Do not imply validated global effects.

## Definition of first-release completion

One selected, traceable real case; honest reconstruction/forecast labeling; reproducible supported model or clearly bounded screening; independent evaluation; inspectable resources; reviewed verification workflow and source-linked draft plan; usable mobile/fallback experience; authorized competition delivery. If a gate fails, narrow and relabel the deliverable rather than fabricate missing capabilities.

## Completed prototype evidence — 4 November 2026

- [x] Bounded historical-data view with OSM basemap, terrain option, nine facility records, source cards, time selection and CSV table export. Evidence: public/data/manifest.json; tests/flood-check.mjs.
- [x] Pure illustrative reservoir calculation with explicit assumptions, missing-data rejection, deterministic outputs, conservation checks and export. Evidence: tests/flood-model.test.js (six tests). This does not complete the calibrated modeling/evaluation gates above.
- [x] Local resource selection/addition, reviewer assignment, notes, queue/evidence/review status, saved-state recovery and draft editing/export. Local template only; no LLM/VLM or external team dispatch.
- [x] Main browser journey at desktop and 360px, replay pause, focus return, corrupted save, missing rainfall and WebGL fallback checked. Evidence: artifacts/flood-browser-report.json. Physical phone and domain review remain unchecked.
- [ ] Replace provisional data context with a scientifically reviewed event, surveyed geometry, observed outcomes, approved solver/evaluation and real forecast archives.
- [ ] Configure an authorized LLM/VLM provider, reviewed guidance retrieval and a team evidence backend before describing those capabilities as implemented.


## Visual feedback revision

- [x] Remove the resource-search circle, its toggle and map legend; retain only a clearly named radius filter for the facility list.
- [x] Fetch, fingerprint and display ten full years (2015–2024) of daily modeled discharge and ERA5 rainfall, with full CSV export.
- [x] Implement annual daily replay, date scrubber, synchronized flow column/change indicator and monthly peak tiles on a fixed cross-year scale. Evidence: artifacts/history-report.json (nine checks).
- [ ] Obtain independently sourced dated flood footprints or validated hydraulic depths and implement an actual rising/spreading flood layer. Do not treat the discharge chart/column as completion of this spatial visualization.

## Latest priority override — real 3D simulation research, 4 November 2026

The user has rejected the review-centered product direction. Prior workflow tasks above are historical/deferred and are not the next delivery target. See docs/3D_SIMULATION_RESEARCH.md for evidence, candidate tools, local data gaps and execution gates.

- [x] Research area-to-3D tools and independent hydraulic modeling; document primary sources and unverified coverage/performance.
- [ ] Remove review-centric navigation/panels while preserving existing local saved records.
- [ ] Audit pilot geometry and flood evidence; benchmark an established hydraulic solver before connecting real modeled depth/extent to 3D playback.
- [ ] Deliver scenario -> calculated water spread -> inspect depth -> baseline comparison, with documented input limits and physical-phone measurement.

## Satellite view and recorded walkthrough ? 5 November 2026

- [x] R01/R11/R13: Add Street/Satellite raster switch in both existing map views with keyboard-operable pressed-state buttons, attribution and imagery-date caveat. This does not resolve the separate map-remount/navigation finding.
- [x] R14: Discover actual controls and rehearse satellite/2D/terrain/history playback at 1280?720, plus a 360px emulated layout. Evidence: scripts/record-satellite-demo.mjs and artifacts/satellite-rehearsal.json. Successful live imagery responses and canvas identity across the basemap switch are asserted. No physical-phone performance claim.
- [ ] R02/R06/R08/R12/R17: Earlier review findings remain open: hard-coded AI/simulation claims, incomplete editing/keyboard placement, fixed ENSO year and absent local inference/harness. This demonstration does not validate those capabilities.

- [x] R14: Recorded the rehearsed walkthrough with cursor and explanatory subtitles: artifacts/terrascope-satellite-demo.webm; assertions: artifacts/satellite-recording.json. Build and 65 unit tests pass; existing large-bundle warning remains.

## Indian-source integration ? 5 November 2026

- [x] R04/R11/R14: Fetch and display two bounded historical NRSC Bihar flood-map snapshots with fixed-date controls, attribution, provenance hashes and explicit unknown coverage. Evidence: public/data/nrsc/manifest.json; scripts/refresh-nrsc-flood.py; src/flood/nrsc.ts; tests/nrsc.test.js. This is provider historical inundation context, not depth modeling or storage validation.
- [ ] R03/R11/R16: Obtain permitted CartoDEM tiles with version/datum metadata and usable Sonpur drainage/water-body vectors; add ingestion/coverage checks before replacing existing candidate-search inputs. Login, service response and regional coverage remain unresolved.
- [ ] R04/R05: Recover sensor/quality/coverage metadata and independently evaluate observations; connect supported water-depth/time calculations. Two dated map images do not complete these requirements.

- [x] R14: NRSC integration verification: 66/66 unit tests and production build pass (existing bundle warning). tests/nrsc-check.mjs passes both image selections, hide, same-canvas check, fixed-date/unknown-coverage labels and 360px keyboard focus; evidence artifacts/nrsc-overlay-report.json. Emulation only, not a physical-phone test.

## Placement review priority ? 5 November 2026

- [x] P0 / R03/R06/R11/R14/R15: Automatic bounded footprint checks with named channel/road/water/building conflicts, dated provider-map-color warnings, source/feature references, assumed footprints, coordinate alternative, persistence recheck and failure/retry. Evidence: docs/PLACEMENT_VALIDATION.md; tests/placement-validation-check.mjs; artifacts/placement-validation-report.json. Does not certify suitability or complete R06.
- [x] R14: Remove fake local-AI/simulated-retention summary; distinguish assumed ratings/volumes, geometric screening and unavailable effects. Compare uses matched rainfall and exports explicit settings; placed pins remain excluded.
- [ ] P1 / R03/R04/R05/R06: Connected catchment/inflow/culvert/outlet and bathymetric/current-water inputs; matched-forcing intervention adapters, downstream impacts, uncertainty and independent validation.
- [ ] P2 / R07/R09: Solar resource/generation/land-surface and wind-resource/wake models, with separately evaluated mechanisms and environmental tradeoffs.
- [ ] P3 / R02/R12/R15?R18: Automatic candidate optimization and real local agent/harness; do not call a no-hit site safe or claim a static checker is AI.

Earlier R01/R06/R08-R10 completion boxes have been reopened: view remounting, incomplete placement editing/effects and fixed ENSO year remain known gaps. No requirement is cancelled.

- [x] Placement delivery verification: 85 unit tests + 2 independent pixel/registration tests, eight integrated placement checks, updated flood/intervention browser suites and world checks pass. Production build passes with existing bundle warning. Physical-phone performance and scientific validation remain unmeasured.
- [x] Correct adjacent mapped-water cell-count bug; version new water metrics and invalidate legacy numeric counts while preserving terrain/mapped-presence evidence. Evidence: tests/storage-search.test.js.

## Iterative placement spot checks ? 14 November 2026

- [x] P0 / R03/R06/R11/R13/R15/R16: Fix repeated spot-check loop. Every new click is re-checked against its own area; missing coverage automatically moves the review area, fetches bounded OSM evidence and re-checks once; failures offer a same-spot retry without duplicate proposals; blocked attempts are never saved; stale notices and attempt state are cleared. Visual feedback: amber checking footprint, red blocked/failed footprint, red conflict-feature outlines, coordinate banner, status chip and alert box. Riparian vegetation overlap is admitted as an investigation while land footprints at the same mapped river stay blocked. Evidence: docs/PLACEMENT_VALIDATION.md; tests/placement-iterative-check.mjs (5 checks); tests/placement-validation-check.mjs (7 checks, updated for rejection); artifacts/placement-iterative-report.json and placement-validation-report.json; 92/92 unit tests; production build passes with existing bundle warning. Headless 360px emulation only, no physical-phone test. Does not complete R06 drawing/move/parameter editing or any effect model.


## Renewable 3D visuals ? 5 November 2026

Partial R06/R13: grouped 3D solar tables and individual 3D turbines are connected to existing proposals, selection, removal and evidence checks. Dimensions are illustrative; no energy/wake/environmental model or placement approval is implied. Evidence and limitations: docs/RENEWABLE_3D.md. All other requirements remain active.


## Collision prevention and area search ? 5 November 2026

Partial R01/R03/R06/R11/R13/R15/R16: new conflicting placements are rejected; conflicting/unchecked saved models are hidden without deleting proposals. Other-proposal envelopes and the illustrative rotor span are checked. Submitted place search and coordinate/map area selection move the camera and fetch bounded OSM constraints for supported new areas, with failed/loading/outside coverage blocking placement. Selected areas persist. Sonpur historical/scientific inputs are explicitly not relocated. Evidence, access limits and remaining gaps: docs/AREA_SEARCH_COLLISIONS.md. No requirement is cancelled or fully completed by this slice.

Header simplification (partial R01/R13/R14): search and placement toolbar now collapse using native disclosures; entered search text survives collapse. Build and desktop/360px browser checks passed; screenshots artifacts/compact-header-desktop.png and compact-header-mobile.png. Full navigation consolidation remains open.

Header follow-up (partial R01/R13): merged search, placement and proposal controls into one wrapping command row; compressed context strip and increased desktop world height to viewport minus 175px (minimum 540px). Build and desktop/360px disclosure/input continuity checks passed. Existing bundle warning remains.

Recording viewport follow-up (R13/R14): 1280x1100 walkthrough with desktop map capped at 650px to keep history graph and playback controls visible together. Build and compact-header checks pass; taller walkthrough rehearsed with real data. See artifacts/tall-demo.

Repository preparation (R14): added .gitignore, public .env.example and docs/GITHUB_SETUP.md. Source and bundled data retained; local outputs excluded. No commit, remote, license selection or publication performed.
