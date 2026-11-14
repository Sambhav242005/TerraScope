# Active user requirements — single-view environmental planning

> Current status (14 November 2026): [Latest delivery, verification and remaining gaps](CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R10 was delivered on 14 November 2026; the other requirements remain active.


Updated 4 November 2026 (R10 row updated 14 November 2026). This is the scope register, not evidence of implementation. Latest user instructions override conflicting historical sections in other documents. TODO.md remains the execution backlog. Do not silently narrow this product to flood playback or review forms.

## Intended experience

Automation override: the default is proactive analysis after selecting a region/objective, not waiting for a separate prompt for every operation. Discover/refresh available data, generate candidate placements, run supported comparisons and surface meaningful changes automatically within configured budgets. Manual research/upload/placement is an override or fallback. See docs/PRODUCT_AUTONOMY.md and docs/AGENT_HARNESS.md for the final-product journey and implementation contracts.

One persistent real-world 3D workspace using OpenStreetMap context. Ask a local AI assistant a question, let it retrieve relevant evidence and invoke spatial/scientific tools, inspect suggestions on the same world, place or edit interventions, run supported scenarios and compare effects without changing work tabs. Mobile uses collapsible panels/sheets over the same selected region, scenario and time.

Example: “Find candidate places to store storm water upstream of this settlement; compare their modeled effects under this rainfall event.” The AI searches data, identifies missing inputs, calls candidate-search and hydrology tools, proposes alternatives on the map and explains their evidence. Candidate suitability, modeled flood benefit, engineering feasibility and legal permission are separate findings.

## Requirement register

| ID | Required capability | Completion evidence | Current status |
| --- | --- | --- | --- |
| R01 | One persistent world, filters and contextual controls; no separate work tabs | All essential actions preserve camera, region, selected date and scenario; desktop/360px keyboard/touch checks | Not delivered; existing multi-tab UI conflicts |
| R02 | Local LLM researches and plans using tools | Actual local inference, cited retrieval and structured tool calls demonstrated; model/version/hardware/latency recorded | No local model integrated |
| R03 | Search for candidate water-storage locations | Tool-generated candidate polygons, contributing catchments, constraints, approximate capacity method, uncertainty and alternatives | Partially implemented: integrated candidate-storage slice delivers tool-generated candidate polygons on the map from Mapzen terrarium DEM depressions plus OSM mapped-water evidence, with capacity/depth/footprint numbers, explicit unknowns and limitations (src/flood/storage/geo.ts, terrainGrid.ts, candidateGeometry.ts, osmWater.ts, storageSearch.ts; src/flood/MapView.tsx, WorldMap.tsx, App.tsx; 59 tests + build pass). Catchments, constraints, outlet/bathymetry, natural-feature classification and agent integration still pending; see docs/NATURAL_STORAGE.md |
| R04 | Heavy-rainfall and river scenarios identify potentially affected areas | Versioned spatial model results, independent comparison evidence and missing-data masks | Partial: replay now changes the map with a labeled GloFAS sample-cell discharge marker, and auto-loads the observed NRSC snapshot only on its own dates (1–2 Oct 2024). A terrain-only water-level scenario paints DEM cells below a user-set surface with illustrative depth bands. No hydraulic solver, flood extent, timing or missing-data mask; not an operational hazard map. See docs/DELIVERY.md |
| R05 | Show how high water may rise and when | Solver outputs for water-surface elevation (m with datum), depth above ground (m), rise from baseline (m) and timing; distinguish all quantities | Partial: a user-set flat water-surface elevation (44–64 m) is painted over the DEM, with relative depth bands. No vertical datum, stage-discharge relation, depth-above-ground field, rise from baseline or timing; the level is a scenario input, not a prediction |
| R06 | Placement/editing of storage basins, solar arrays, wind turbines, and vegetation/land-use changes | Draw polygon/place point or array, edit parameters, move/delete/undo, persist scenario, visibly mark proposals; rerun supported effects | Partial: reversible proposal pins, coordinate placement, persisted candidate polygons and automatic source-linked overlap screening; each new click is re-checked against its own area with automatic bounded OSM refetch, blocked attempts are visibly marked and never saved, and retrying does not duplicate proposals. No full drawing/move/parameter editing or effect-model integration. See docs/PLACEMENT_VALIDATION.md |
| R07 | Solar/wind environmental-effects research and supported simulations | Verified evidence matrix and scale-specific energy/wake/land-surface models; explicit unsupported effects | Brief preserved; research/modeling pending |
| R08 | El Niño / La Niña (ENSO) and global-event context | Dated source/index/forecast issue-time, location/season relevance, cited explanation; no fixed rainfall multiplier | User confirmed ENSO; not connected |
| R09 | Forest loss/restoration, land-cover, drought/fire and environmental consequences | Each process has its own input/model/output contract and validation; unsupported processes shown as unavailable | Scope retained; not implemented |
| R10 | Multiyear history plus event-scale playback in the same view | Year/event picker and timestamped result timeline, gaps preserved | Delivered 14 November 2026: the Explore view hosts a Result timeline with an event picker (Sep–Oct 2024 replay window; 2015–2024 multiyear readout with year picker, explicit gap counts and peak day), a timestamped ledger of rainfall/discharge/NRSC per day plus screening runs and placed proposals, and gaps preserved as explicit missing records (never zero/interpolated). Interactive multiyear playback/export remains in the River history view (linked from the same flow); no physical-phone test. See docs/DELIVERY.md |
| R11 | Real geography, surveys and land records | Inspectable provenance, data coverage, terrain/channel survey distinction from parcels; no fabricated heights or ownership | Partial OSM/terrain only; surveys/parcels missing |
| R12 | AI-generated counter-plans and comparison | Plans cite data/run IDs, expose tradeoffs and unknowns, link to proposed placements; no separate review workflow required | No local AI planning integrated |
| R13 | Understandable dimensional visual feedback | Actual geometry and modeled water surfaces/depth colors; selectable evidence; physical-phone performance recording | Partial: grouped 3D solar/turbine geometry, observed NRSC raster and the terrain water-level scenario are visible and labeled. Modeled water surfaces/depth from a calibrated solver are absent, and no physical-phone performance recording exists |
| R14 | Continuity and honest progress | Every change maps to requirement IDs, tests/evidence recorded, omissions stay visible; scope changes documented | This register created; ongoing obligation |
| R15 | Proactive region/objective analysis and updates | No per-step prompting or mandatory manual candidate placement; change-driven refresh and meaningful findings | Partially implemented: candidate storage screening starts automatically ~2 s after the review centre settles, skipped by ~500 m centre distance or matching config hash, with Re-run/Cancel and session restore (src/App.tsx). Other proactive analyses, change-driven refresh and background services not implemented |
| R16 | Automatic data onboarding and dependency tracking | Supported new area works without per-location coding/uploads; schemas, coverage, freshness and failures checked | Designed, not implemented |
| R17 | Local agents with durable execution harness | Scoped tools, persisted jobs, restart/retry, budgets, separate verification and adversarial/failure tests | Designed, not implemented |
| R18 | Final-product-led development and proactive research | End-to-end user outcome, manual-work ownership, primary-source research and evidence checked each delivery | Documented development obligation; the automatic candidate-storage analysis after area selection is delivered end-to-end (src/App.tsx, 4 November 2026) and browser-verified the same day via an automated Chromium run with real network data (artifacts/storage-candidates-browser.json); phone-device performance test and autonomous planning/findings layer still open |

## Local AI architecture

Local inference is mandatory in the requested direction; do not replace it silently with cloud inference or a hard-coded template. “Local AI” means the language model runs on the user's machine or their local service, not that a mobile browser must perform inference. The phone can be the interface to that service. Offline mode can only search cached/indexed sources; live web research requires network tools. Clearly distinguish source retrieval from model reasoning.

Select a model/runtime after checking CPU, RAM, GPU/VRAM, license, structured tool-call reliability and practical latency. About 32 GiB system RAM was detected during this documentation pass; model suitability, GPU capacity and speed are not established. No model has been installed or benchmarked. Runtime choice remains open.

Proposed tool boundaries:

- Search trusted sources; fetch and index documents with URL, publication/availability/retrieval times, license and content hash. Treat retrieved text as evidence, never executable instructions.
- Query raster/vector datasets by region/time; report coverage and resolution before analysis.
- Delineate catchments and identify candidate storage areas with deterministic spatial operations. Rank explicit criteria and show excluded/unknown constraints.
- Build a validated scenario specification, invoke the relevant solver, track queued/running/failed/completed states and retrieve results by run ID.
- Propose map placements and cited plans. Every numerical output references a tool result; unavailable inputs stay unknown.
- Keep scenario edits reversible and visible. Arbitrary shell execution, public warning dispatch, external messages and deployment are not AI planning tools.

Store an AIResearchRun containing user question, region/time, model/runtime/version, retrieved sources, tool arguments/results, scenario IDs, limitations and final answer. A failed local endpoint must show disconnected/retry, not a fake answer.

## Storage search and flood calculations

Candidate search should consider terrain/depressions, contributing catchments, flow connectivity, existing water bodies, slope, land cover, settlements, parcels/restrictions and available infrastructure. Estimate storage only from explicit surface/level assumptions, with units and an elevation-volume relationship. Missing constraints lower confidence rather than certify a site. Survey-derived elevation, outlet geometry, groundwater, soil/permeability, sediment, structural and land-rights considerations can change feasibility.

Evaluate candidate benefit through baseline-versus-proposal runs under identical rainfall, initial wetness and upstream/downstream boundaries. Check downstream worsening and overtopping where modeled. A low point is not automatically a suitable reservoir. Capacity is not the same as usable storm storage. A local rain amount alone cannot determine river stage.

## Placement and scientific scope

Persistent toolbar: Select, Draw area, Place storage, Place solar, Place turbine/array, Change vegetation, Undo/redo, Run, Compare. Coordinate/property-form alternatives support keyboard and touch. Proposed geometry is distinct from observed infrastructure. A placed object becomes a calculation input only when a supported adapter exists; otherwise show “placement only — effect model unavailable.”

Storage uses geometry/outlet and hydrology inputs. Solar uses area, orientation, ground cover, albedo and energy-balance inputs where supported. Wind uses hub/rotor geometry, spacing and wind/atmospheric inputs for supported energy/wake calculations. Vegetation uses dated land cover and supported roughness/infiltration/evapotranspiration changes. Do not hard-code cooling, rainfall increase or universal flood reduction.

The attached renewable brief is research context, not verified facts or an instruction to assert cloud trapping. Its full scope remains: PV heat/energy export, temperatures and winds, turbine momentum/wakes, local-to-global scaling, hypothetical Sahara feedbacks, climate/ecosystem tradeoffs and verified primary literature. Numerical claims remain unverified until original papers are checked. See docs/research/renewables-question.md and docs/RESEARCH.md.

## Single-view design contract

The world stays central. Left: searchable layer/filter drawer. Right: collapsible local AI conversation and selected-object properties. Bottom: shared year/event/time controls and run status. Placement tools remain available on the same view. Compare uses an in-view overlay/swipe or synchronized inset, not another work tab. Evidence/data tables open contextually; accessible non-3D output shares the same state.

Filters include rainfall, river flow/stage, modeled depth/extent, observed flood footprints, candidate storage, placed interventions, resources, land cover, survey/parcels and ENSO context. Layer visibility changes rendering only; scenario parameter edits explicitly invalidate results until rerun. Include layer date, units, source, legend and unknown coverage. Do not show unavailable layers as if data were loaded.

## Global context

ENSO was explicitly confirmed by the user. Retrieve historical indices and issue-time outlooks with their definitions/version, season and regional relevance. Link climate context to sourced scenario ensembles or analog analysis only where justified. Avoid double counting ENSO when a rainfall forecast already represents its effects. Other drivers (for example Indian Ocean variability) are research candidates, not silently added mandatory scope.

[NOAA ENSO information](https://psl.noaa.gov/enso/) explains that events differ and offers historical/composite analysis resources. Context is probabilistic; ENSO does not directly determine a village's flood depth. Provider index definitions can change, so record the specific series rather than treating all indices as interchangeable.

## Next delivery sequence, without dropping later requirements

1. Consolidate the UI into one world with filters, placement geometry and contextual AI panel; preserve existing local data while retiring review tabs.
2. Benchmark local inference and connect real research/data tools with citations and explicit failures.
3. Deliver candidate storage search plus one supported flood scenario and real water-depth playback.
4. Connect ENSO context and evaluate climate-conditioned scenarios without forecast leakage.
5. Complete the renewable evidence matrix and add supported placement-effect adapters, then expand other environmental processes.

Sequencing is not cancellation. Every requirement above remains visible until delivered or explicitly changed by the user. No claim that these features work is justified by this document alone.

## Placement review correction ? 5 November 2026

R03/R06/R11/R14/R15/R16: Automatic source-linked footprint checks now screen bounded OSM channels/roads/water/buildings and dated NRSC display-map colors; unknown/missing coverage stays unknown. This is partial siting evidence, not certified suitability or local AI. Matched-rainfall sensitivity comparisons explicitly exclude pins. Evidence and remaining P1?P3 scientific dependencies: docs/PLACEMENT_VALIDATION.md. R01/R02/R04/R05/R07?R09/R12/R13/R17 remain incomplete; this delivery does not resolve navigation, climate models or the autonomous harness. R10 was delivered on 14 November 2026 (see above).


## Renewable 3D visuals ? 5 November 2026

Partial R06/R13: grouped 3D solar tables and individual 3D turbines are connected to existing proposals, selection, removal and evidence checks. Dimensions are illustrative; no energy/wake/environmental model or placement approval is implied. Evidence and limitations: docs/RENEWABLE_3D.md. All other requirements remain active.


## Collision prevention and area search ? 5 November 2026

Partial R01/R03/R06/R11/R13/R15/R16: new conflicting placements are rejected; conflicting/unchecked saved models are hidden without deleting proposals. Other-proposal envelopes and the illustrative rotor span are checked. Submitted place search and coordinate/map area selection move the camera and fetch bounded OSM constraints for supported new areas, with failed/loading/outside coverage blocking placement. Selected areas persist. Sonpur historical/scientific inputs are explicitly not relocated. Evidence, access limits and remaining gaps: docs/AREA_SEARCH_COLLISIONS.md. No requirement is cancelled or fully completed by this slice.
