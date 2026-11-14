# Delivery record — TerraScope prototype

> Current status (14 November 2026): [Latest delivery, verification and remaining gaps](CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R10 was delivered on 14 November 2026; the other requirements R01-R18 remain active.


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

The Explore view now hosts a timestamped scenario result timeline, reachable from the replay control row ("Result timeline" button, `aria-expanded`/`aria-controls`). It is part of the same view — no tab switch.

- The event picker switches the panel between the Sep–Oct 2024 replay window (25 Sep–3 Oct, the only hourly-granularity event) and a 2015–2024 multiyear readout with its own year picker: per-year days-with-discharge, explicit discharge gaps, explicit rainfall gaps and the year's peak discharge day.
- The event ledger shows one date-bound entry per day for ERA5 rainfall (mm, IST day, sample cell 26.5°N 84.25°E), GloFAS discharge (m³/s, UTC day, model cell 25.775°N 85.125°E — not a gauge or issue-time forecast) and NRSC coverage (available only on 1–2 Oct 2024; explicit "no observed snapshot" gaps on every other day; nothing interpolated).
- A runs-and-actions column lists timestamped entries: the automatic candidate-storage screening run (startedAt, status, candidate count, config hash, water-evidence retrieval time) and every placed proposal (createdAt, kind, coordinates, status).
- Missing data is always an explicit gap — never zero, never interpolated. 11 headless browser checks pass (toggle behaviour, 27 day-bound entries, NRSC gap preservation, history picker with 2015–2024, 2020 gap counts, 360px no horizontal overflow, no console/page errors). 13 new unit tests (determinism, gap semantics, sorting, summarizeYear); 111/111 suite passes. Evidence: tests/result-timeline-check.mjs, tests/result-timeline.test.js, artifacts/result-timeline-report.json, artifacts/result-timeline-desktop.png, artifacts/result-timeline-360.png.
- Limits: multiyear mode is aggregate read-only stats with explicit gaps — interactive playback/export stay in the River history view (linked from the same flow via "Open interactive history"). Only the Sep–Oct 2024 window carries hourly rainfall, so "event" mode is the only replay-backed context. Headless-only; no physical-phone performance test. Not a flood forecast, extent or validated hydrology; NRSC remains display-evidence only.


## Replay and terrain water scenario - 14 November 2026

The Explore replay now changes the map, not only the rainfall/flow numbers. Advancing the replay day updates a labeled GloFAS sample-cell marker at 85.125 E, 25.775 N with the modeled discharge for that day; its small bar is relative to the replayed nine-day window, not depth or extent. On the two dates that have a provider snapshot (1 and 2 October 2024) the NRSC observed raster auto-loads and is removed on other days. Nothing is interpolated between archived dates.

A separate water-level control (off by default) paints every DEM cell below a user-set 44-64 m surface over the Gandak/Sonpur view, using an interpolated color ramp for relative depth bands. It is explicitly terrain-only: there is no stage-discharge solver, vertical datum, bathymetry, embankment routing or timing. It is a scenario visualization, not a forecast or an operational flood map, and the DEM includes buildings/vegetation as terrain.

The stacked headers were merged into one 84px header (brand/source row plus a 29px context strip) and the map summary, layer toggle, command row and timeline were compacted. Timeline height is 158px; the water control sits in its third column. Evidence: artifacts/replay-ui-1-initial.png, artifacts/replay-ui-2-water.png, artifacts/replay-ui-3-nrsc.png, artifacts/replay-ui-4-1024.png, artifacts/replay-ui-5-360.png, artifacts/replay-ui-6-3d.png and artifacts/replay-simulation-gallery.html. Build passes; 92 unit tests pass; flood-check 13/13, placement-iterative 5/5, placement-validation 7 checks, world-check 6/6, NRSC, search/area/collision and the iterative placement suite pass. 1024px and 360px captures have no horizontal overflow. No physical-phone performance or scientific validation claim.
