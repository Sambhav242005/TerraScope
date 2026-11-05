# Delivery record — TerraScope prototype

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


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

TODO.md preserves the full research gates: choose/review the final historical event; obtain surveys, gauges and independent labels; freeze an evaluation protocol; select/calibrate/validate a solver; test held-out events/non-events and official/simple baselines; obtain approved local guidance; add authenticated team evidence and an authorized AI provider; test a real phone; review terms and competition requirements before any authorized publication.

No deployment, entry submission, messages to field teams or public warnings were performed.

Final production check: the thirteen browser checks also passed against the built preview at port 4173, including the emitted MapLibre worker. Data/source button has an explicit accessible label when its text is hidden on narrow screens. The app is left open locally for review.


## Visual history revision — 4 November 2026

New default River history passes nine browser checks in tests/history-check.mjs: ten-year data/120 tiles, synchronized flow rise, leap years, peak selection, replay/pause, full export, circle removal, 360px layout and no unhandled errors. Existing thirteen workflow checks also pass with explicit Explore navigation. Production build passes. Evidence: artifacts/history-report.json; artifacts/history-desktop.png; artifacts/history-mobile.png; artifacts/history-video. No physical-phone or inundation validation claim. The requested actual mapped flood-rise/spread visualization is still outstanding.
