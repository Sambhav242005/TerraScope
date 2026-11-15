# Delivery record — TerraScope prototype

> Current status (14 November 2026): [Latest delivery, verification and remaining gaps](CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R08, R10, R15, R16 and R17 were delivered on 14 November 2026; the other requirements remain active.


Date: 4 November 2026. Status: functional local software prototype; broader scientific/competition release gates remain open.

## Implemented

React/TypeScript workspace with MapLibre 6, real OSM raster context and optional terrain. A fixed provisional Gandak/Sonpur case includes 216 hourly ERA5 rainfall estimates, nine daily GloFAS modeled discharge values and nine mapped facilities. Saved source queries and hashes accompany the data.

Explore resources, move or type a review centre, change radius, add a user location, inspect source records, replay/pause dates and export the data table. Compare explicit illustrative rainfall/loss/storage settings with a deterministic linear reservoir. Record local reviewer/observation/status, create an editable source-linked preparedness worksheet and export results. Persist workspace and edited draft locally; recover safely from corrupt state. Accessible resource/form/table controls remain usable when WebGL fails.

The old entry UI and stylesheet are preserved in docs/archive/living-valley/source. Old engine/world modules and tests remain in place but are not imported by the active application. New local-storage keys are independent.

## Evidence

- `npm run build`: TypeScript and production bundling pass. Vite reports a large MapLibre-containing bundle; no performance claim is inferred from successful bundling.
- `npm test`: 14 passing tests, of which six are flood-prototype tests and eight are legacy ecology tests.
- `node tests/flood-check.mjs`: thirteen browser checks. Report: artifacts/flood-browser-report.json. Main sequence records video in artifacts/flood-video.
- Browser: Microsoft Edge 156.0.4314.58, Windows desktop. Viewports: 1440 × 1000 and 360 × 800; reduced-motion setting used in main workflow.
- Checks include map worker and real datasets, resource inventory, date playback/pause, scenario output, local evidence persistence, draft persistence/export, keyboard-accessible coordinate form, custom resources, narrow layout, malformed save, unavailable WebGL and failed rainfall input. Main journey has no unhandled exceptions or console errors.
- Actual screenshots: artifacts/terrascope-desktop.png, artifacts/terrascope-compare.png, artifacts/terrascope-mobile.png. These are application captures, not generated concept art.

No physical phone, full accessibility audit, FPS benchmark, domain reviewer or user study was available. Do not describe viewport emulation as mobile-device validation.

## Scientific and service boundaries

This is historical data replay plus proximity-based review and an educational sensitivity experiment. No measured flood footprint, inundation solver, operational warning, forecast skill, return period or alert threshold is produced. ERA5 and GloFAS are separate displayed series. The sample rainfall cell does not prove upstream catchment rainfall. The selected discharge grid cell is not independently river-matched. Current OSM coverage is not a 2024 inventory.

The illustrative model starts with zero storage, takes rainfall multiplier and loss fraction, and releases storage with factor 1 − exp(−1/lag) each hourly step. It conserves modeled effective input but has no calibrated area/soil/channel geometry or upstream/downstream boundary conditions. Output is mm/h; it is not the GloFAS hydrograph or river flood depth. Export includes model version, settings, timestamps, units and source manifest.

Field records stay on one device. No backend team assignment, media evidence, immutable review history, saved-workspace import, LLM/VLM API or retrieval corpus is connected. The draft is openly labeled a local fixed template. It never certifies routes, shelter capacity, structures or evacuation decisions.

## Remaining work

Candidate terrain inspection (14 November 2026; partial R03/R13/R14): `candidateProfile.ts` derives a bounded, deterministic transect from the same DEM grid and lowest cell used by screening. `CandidateProfileChart.tsx` and candidate details display floor/spill elevations in source DEM metres, distance in metres/kilometres and an accessible sample table. The full-depression spill point may lie outside the transect. Source provenance, resolution and retrieval remain attached to the screening run; vertical-datum alignment and real-site accuracy remain unverified. Missing samples produce no chart; malformed optional saved profiles are removed while retaining candidate records. Six profile tests plus storage-search integration assertions pass within the 98-test suite; production build passes with its existing bundle warning. No browser or physical-phone verification for this slice. Existing scientific and autonomous-service gaps remain open.

TODO.md preserves the full research gates: choose/review the final historical event; obtain surveys, gauges and independent labels; freeze an evaluation protocol; select/calibrate/validate a solver; test held-out events/non-events and official/simple baselines; obtain approved local guidance; add authenticated team evidence and an authorized AI provider; test a real phone; review terms and competition requirements before any authorized publication.

No deployment, entry submission, messages to field teams or public warnings were performed.

Final production check: the thirteen browser checks also passed against the built preview at port 4173, including the emitted MapLibre worker. Data/source button has an explicit accessible label when its text is hidden on narrow screens. The app is left open locally for review.


## Visual history revision — 4 November 2026

New default River history passes nine browser checks in tests/history-check.mjs: ten-year data/120 tiles, synchronized flow rise, leap years, peak selection, replay/pause, full export, circle removal, 360px layout and no unhandled errors. Existing thirteen workflow checks also pass with explicit Explore navigation. Production build passes. Evidence: artifacts/history-report.json; artifacts/history-desktop.png; artifacts/history-mobile.png; artifacts/history-video. No physical-phone or inundation validation claim. The requested actual mapped flood-rise/spread visualization is still outstanding.

## Scenario result timeline - 14 November 2026 (R10)

The Explore view now hosts a timestamped scenario result timeline, reachable from the replay control row ("Result timeline" button with `aria-expanded`; the panel stays mounted and collapses with `hidden="until-found"` with a `beforematch` re-sync so in-page find can reveal it — modern-web-guidance accordion and search-hidden-content patterns). Heading structure is h2/h3 with no landmark noise. It is part of the same view — no tab switch.

- The event picker switches the panel between the Sep–Oct 2024 replay window (25 Sep–3 Oct, the only hourly-granularity event) and a 2015–2024 multiyear readout with its own year picker: per-year days-with-discharge, explicit discharge gaps, explicit rainfall gaps and the year's peak discharge day.
- The event ledger shows one date-bound entry per day for ERA5 rainfall (mm, IST day, sample cell 26.5°N 84.25°E), GloFAS discharge (m³/s, UTC day, model cell 25.775°N 85.125°E — not a gauge or issue-time forecast) and NRSC coverage (available only on 1–2 Oct 2024; explicit "no observed snapshot" gaps on every other day; nothing interpolated).
- A runs-and-actions column lists timestamped entries: the automatic candidate-storage screening run (startedAt, status, candidate count, config hash, water-evidence retrieval time) and every placed proposal (createdAt, kind, coordinates, status).
- Missing data is always an explicit gap — never zero, never interpolated. 13 headless browser checks pass (toggle behaviour, hidden=until-found collapsed state, beforematch re-sync, 27 day-bound entries, NRSC gap preservation, history picker with 2015-2024, 2020 gap counts, heading structure, 360px no horizontal overflow, no console/page errors). 13 new unit tests (determinism, gap semantics, sorting, summarizeYear); 111/111 suite passes. Evidence: tests/result-timeline-check.mjs, tests/result-timeline.test.js, artifacts/result-timeline-report.json, artifacts/result-timeline-desktop.png, artifacts/result-timeline-360.png.
- Limits: multiyear mode is aggregate read-only stats with explicit gaps — interactive playback/export stay in the River history view (linked from the same flow via "Open interactive history"). Only the Sep–Oct 2024 window carries hourly rainfall, so "event" mode is the only replay-backed context. Headless-only; no physical-phone performance test. Not a flood forecast, extent or validated hydrology; NRSC remains display-evidence only.


## ENSO climate context, proactive findings and data onboarding - 14 November 2026

Three requirements advanced to delivered in one pass:

**R08 (ENSO).** The topbar ENSO badge is now a button opening a dated context panel: (1) the NOAA CPC Oceanic Niño Index (ASO running mean, ERSST.v5, Niño 3.4, 1991–2020 climatology) for 2015–2024 with source and method; (2) the current issue-time CPC ENSO Diagnostic Discussion — El Niño Advisory, issued 12 November 2026, Niño-3.4 +2.5°C — quoted with its date and retrieval timestamp, explicitly labeled as a probabilistic outlook that is not an analysis input to anything in the workspace; (3) location/season relevance for a Bihar Jun–Sep monsoon corridor; (4) a 2015–2024 analog table (phase, ONI, peak GloFAS discharge and its date, Jun–Sep ERA5 rainfall total) joined from the local record with explicit gap counting; (5) NOAA CPC advisory and ONI archive links for human review. No fixed rainfall multiplier exists anywhere in the code. Honest limits: ENSO-Bihar teleconnections are probabilistic and n=10; the 2024 flood event developed during ENSO-neutral; the app computes no local depth from ENSO.

**R15 (proactive findings).** The Explore side panel shows auto-derived findings with zero per-step prompting: peak 2015–2024 discharge (with the non-gauge, non-issue-time caveat and source fingerprint), a descriptive 90th-percentile band explicitly labeled not an alert threshold, 2022–2024 Jun–Sep monsoon rainfall with ONI phase context, NRSC coverage window for the replayed day, screening outcome with run provenance (or its explicit failure), and a count of placed proposals labeled as non-calculation inputs. Storage screening continues to auto-run ~2 s after the review centre settles (500 m/config-hash skip). Findings are recomputed change-driven (centre settle, replay date, run completion) and every item traces to a dataset/run record; they are descriptive, not a forecast or warning.

**R16 (onboarding and dependency tracking).** `src/flood/dataOnboarding.ts` registers every dataset the app uses with a schema contract (required keys + sha256 format), coverage bounds, a freshness policy (current-mapping layers only; archived ERA5/GloFAS series pinned by sha256 report n/a rather than "stale"), license and a dependency registry naming each dataset's consumers and load-bearing status. Checks run against the loaded manifest: 17 pass · 0 fail after completing missing manifest metadata (flow-history/rain-history processing, scene-geometry provider). The Sources modal renders the report, the dependency registry and the onboarding limits. A six-step new-area checklist (bounded OSM fetch → coverage refetch → NRSC bounds → budgeted terrain screening → historical-series boundary → dependency coverage) encodes how a supported new area onboards without per-location coding or uploads; failure modes block and stay visible, never silently clear a spot.

Evidence: `tests/enso-analogs.test.js`, `tests/findings.test.js`, `tests/data-onboarding.test.js` (suite 141/141); `tests/context-checks.mjs` — 23 headless browser checks pass against the production preview (findings card with 6 auto items, ENSO panel contents and focus handling, onboarding section verdicts, 360px no overflow, no console/page errors); flood-check 13/13; production build passes. Artifacts: artifacts/context-checks-report.json, artifacts/enso-findings-desktop.png, artifacts/enso-findings-360.png. Not delivered: issue-time outlook is used only as dated context (never as an input — the 12 Nov 2026 advisory states El Niño Advisory with ~79% chance of >+2.5°C through Jan–Mar 2027, but nothing in this app computes from it); R15/R16 have no background service (findings are derived inline in-session; full change-driven background refresh remains open); R07 remains open — see docs/research/renewable-evidence-matrix.md (new research document, does not close R07); R13 (phone), R12/R17 (local model/harness) and R01/R06 remain open.


## Durable execution harness - 14 November 2026 (R17)

The deterministic storage-screening tool now runs under a persisted local harness (`src/flood/harness.ts`). Jobs carry an ID, input hash, registered tool scope, attempts, wall-clock/tile budgets, heartbeat and checkpoints, an append-only event log and a completion stage gated by a verifier that is separate from the producer.

- Scope registry: only `storage-screening` → `priority-flood-d8-v1` may run under the harness; any other kind fails at enqueue. Deterministic jobs stay code — no LLM calls are made by the harness.
- Idempotency: `enqueue` reuses an open job for the same kind+input instead of duplicating it; cancelled jobs do not block re-enqueue.
- Restart recovery: `recoverStale` requeues stale running jobs (respecting the attempt budget) or fails them; it runs on app mount. Corrupted persisted caches are discarded, never interpreted.
- Budgets: wall-clock, tile count and max attempts are enforced in heartbeats; exhaustion fails the job with a recorded reason rather than hanging or degrading silently.
- Verification: `verifyJobOutput` checks run ID, config-hash format, pinned method, tile completeness on success and totals sanity; a claim of success with missing tiles, wrong method, missing run ID or cancelled status cannot publish. Older succeeded jobs for the same input are marked superseded (retained, never deleted).
- Events: append-only (`enqueued`, `enqueue-reused`, `started`, `verified`, `failed`, `cancelled`, `recovered`, `completion-rejected`), bounded to 200 in storage.
- App wiring: the auto storage screening enqueues/starts/heartbeats/completes a harness job with the run; the run-provenance panel renders "Harness <job> · verified" or the verification failure; cancel propagates. A real browser run on 14 Nov 2026 (909 tiles, real terrain fetch) produced job `harness-5055cb92-1` → `succeeded`, events enqueued → started → verified, persisted in localStorage key `terrascope.harness.v1`.

Evidence: `tests/harness.test.js` (21 adversarial tests: idempotent enqueue, scope rejection, heartbeat/tile/wall-clock budgets, verifier rejection of bad outputs, supersession, stale recovery, corrupt caches, roundtrip, cancellation); suite 162/162; production build passes; flood-check 13/13. Honest limits: exactly one registered harness tool (no LLM workers — that is by design per docs/AGENT_HARNESS.md: deterministic jobs stay code); no background service — the harness executes in-session inside the browser tab; live network auto-retry between jobs is deliberately not wired (an exhausted attempt budget fails the job; the user re-triggers explicitly); recovery after a hard browser kill relies on `recoverStale` on next mount, not on a live daemon.

## Sub-basin context (HydroBASINS v1c) - 14 November 2026

The candidate-storage slice gained real catchment topology from HydroBASINS v1c Asia (level 12, 15 arc-second derived, retrieved 14 Nov 2026, HydroSHEDS license, doi:10.1002/hyp.9740). `public/data/hydrobasins-as12-sonpur.json` ships 71 sub-basins clipped to the context window 84.75–85.55E, 25.35–26.0N, simplified to ~0.0003°; the source zip's sha256 is recorded in the manifest. Provenance and caveats: docs/DATA.md.

Candidate details now show the containing sub-basin (HYBAS_ID, upstream area at the sub-basin outlet, this sub-basin's area, main-stem distance) — e.g. "Sub-basin 412xxx… · upstream area at sub-basin outlet ~769,818 km² · this sub-basin N km² · HydroBASINS v1c (DEM-derived, not surveyed)". Points outside the context window report no lookup. A dashed sub-basin outline layer toggles from Map layers (off by default).

Evidence: `tests/hydrobasins.test.js` (artifact integrity, unique ids, area ordering, point-in-polygon incl. holes, Sonpur lookup, outside-window refusal); production build passes. Honest limits: DEM-derived delineation, not surveyed; in this plain reach level-12 basins are ~1.5–227 km², so a "contributing catchment" per candidate is a coarse bound, not a validated contributing area; UP_AREA is measured at the sub-basin outlet, not at the candidate; no flow routing between basins; no water-level or travel-time model; R03's remaining gaps (bathymetry, outlets, soils, groundwater, land rights) are unchanged. This does not validate any storage capacity figure.

## Ask the map — decision workspace scaffold (R02/R12 support) - 15 November 2026

New topbar control "Ask the map" opens a docked right-side panel ("decision workspace", in the one persistent view — no new tab) for anyone steering the decision. It implements the *interface and plumbing* of a local-LLM decision assistant without claiming any model exists:

- Offline, honest default: a deterministic evidence responder answers from the workspace's own data (2015–2024 GloFAS/ERA5 peak and top-10% band, monsoon/ONI analogs, NRSC coverage window, manifest registry, storage-screening results, auto-derived findings). Every answer carries evidence-id chips and the label "deterministic evidence". It cannot issue alerts, orders or authorisations; advisory/plan questions route to human-in-the-loop messaging. Unknown questions get an explicit refusal listing what can be evidenced.
- Optional local model path: an OpenAI-compatible adapter (Ollama / llama.cpp / LM Studio) with the same tools attached as function calls. Calls are bounded (45 s, ≤4 tool calls, one tool round); unknown tool names are rejected by the registry; failure falls back to the deterministic responder and says so; calls are accounted in localStorage (`terrascope.ai.calls.v1`). No model is installed or benchmarked - this requirement (R02/R12) is NOT met.
- Draft outputs: "Pre-monsoon advisory draft" and "Decision brief draft" download local markdown for a human authorised officer to review, edit and issue. The app never sends, posts, registers or broadcasts anything. Both drafts list explicit unknowns (cell-to-reach mapping, no gauge rating curve, NRSC window limited to 1–2 Oct 2024, ENSO as probabilistic context).
- Tool catalog and dispatch (`src/flood/ai/tools.ts`) are shared between the offline responder and the local-model path, so both answer identically on the same evidence.

Evidence: `tests/decision-desk.test.js` (14 unit tests incl. refusal paths, NaN/free checks, human-in-the-loop routing, draft disclaimers, unknown-tool rejection); `tests/decision-desk-check.mjs` (8 headless browser checks: honest default label, grounded cited answer, download capture, 360px, no console errors); `src/decision-desk.css`; suite now 183/183; production build passes. Limits: no language model is connected; the responder is a keyword-intent lookup, not reasoning; local-model quality is unproven until a model is installed and benchmarked; nothing here validates flood depth or timing; not an engineering or official-warning artifact.

## Replay and terrain water scenario - 14 November 2026

The Explore replay now changes the map, not only the rainfall/flow numbers. Advancing the replay day updates a labeled GloFAS sample-cell marker at 85.125 E, 25.775 N with the modeled discharge for that day; its small bar is relative to the replayed nine-day window, not depth or extent. On the two dates that have a provider snapshot (1 and 2 October 2024) the NRSC observed raster auto-loads and is removed on other days. Nothing is interpolated between archived dates.

A separate water-level control (off by default) paints every DEM cell below a user-set 44-64 m surface over the Gandak/Sonpur view, using an interpolated color ramp for relative depth bands. It is explicitly terrain-only: there is no stage-discharge solver, vertical datum, bathymetry, embankment routing or timing. It is a scenario visualization, not a forecast or an operational flood map, and the DEM includes buildings/vegetation as terrain.

The stacked headers were merged into one 84px header (brand/source row plus a 29px context strip) and the map summary, layer toggle, command row and timeline were compacted. Timeline height is 158px; the water control sits in its third column. Evidence: artifacts/replay-ui-1-initial.png, artifacts/replay-ui-2-water.png, artifacts/replay-ui-3-nrsc.png, artifacts/replay-ui-4-1024.png, artifacts/replay-ui-5-360.png, artifacts/replay-ui-6-3d.png and artifacts/replay-simulation-gallery.html. Build passes; 92 unit tests pass; flood-check 13/13, placement-iterative 5/5, placement-validation 7 checks, world-check 6/6, NRSC, search/area/collision and the iterative placement suite pass. 1024px and 360px captures have no horizontal overflow. No physical-phone performance or scientific validation claim.
