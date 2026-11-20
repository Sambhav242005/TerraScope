# TerraScope visual audit

20 November 2026. Baseline `81d4c2c`. Headless Microsoft Edge at 1440 × 960 and 360 × 800, reduced motion on. The 360px context also exercised an emulated tap. I opened the rendered screenshots and contact sheets and checked key states at full size.

The design reference available in the workspace was the map-first sequence in [Visual planning](VISUAL_PLANNING_PLAN.md), with an earlier TerraScope render in `artifacts/terrascope-desktop.png`. I inspected the archived original-plan explorer image as historical context. A separate received concept image was unavailable, so direct visual comparison against it is unchecked.

## Coverage ledger

| Surface and requirement | Visually inspected | Unchecked or limited |
| --- | --- | --- |
| Map and placement, R01/R03/R06/R13 | Street and tilted terrain, satellite control, layers panel and its six switches, withheld Indian evidence, event measurements, placement tools and coordinate form, empty proposals disclosure, candidate detail and transect samples. Desktop fixture captures include a pending adoption and blocked duplicate in conversation. | Full satellite tile coverage, each switch in both states, actual NRSC imagery, all four proposal types and models, successful drag and nudge, failed-area retry UI and all placement-inspector disclosures. |
| Search and area, R01/R03/R16 | Search form, area coordinates disclosure, fixture result and selection, empty and 503 responses, selected-area evidence disclosure. | Live geocoder completion and invalid coordinate inputs. External tile availability varied during captures. |
| Candidates and field work, R03/R11/R17 | Findings, storage limitations and run provenance when available, resource form, review-centre coordinates, field checks list and an unsaved observation in its inspector. | All candidate and resource variants, persisted field review lifecycle and screening interruption/retry. |
| Comparison and replay, R04/R05/R10 | Geometry baseline toggle, runoff comparison and calculation disclosure, event play and pause, replay date, charts, water scenario, event and multiyear result panels, historical table. | Populated geometry comparison with several alternatives, water-depth validity, every historical date/speed and optional NRSC map replay. |
| Conversation, R02/R12/R17 | Closed and open, evidence-only response, model settings and forced connection failure, draft download disclosure, fixture planning confirmation and duplicate rejection. | Live model, cloud credentials, timeout and every planned-action substate. Fixture browser checks exercised focus, adoption, reject, undo, removal, stale action and evidence selection. |
| Environment and climate, R08/R19–R21 | Environment overview, modeled air, Bihar forest survey, corridor report, flood atlas, regional station inventory and remaining gaps disclosures, ENSO dialog. | Full network and data failure matrix, every report scroll position, licensed observed flood imagery and CPCB observations. |
| Sources, guide and draft, R11/R13/R14/R16 | Guide, source cards, eight dataset-fingerprint disclosures, onboarding checks, historical-data dialog and generated preparedness draft. Browser check verifies both local markdown downloads. | CSV and workspace export content, every source-link destination and every modal reading position. |
| Accessibility and responsive layout, R01/R13/R14/R18 | Keyboard focus styling, modal keyboard behavior, 360px layout and emulated touch selection. | Physical phone, assistive technology, other browsers, motion-enabled interactions and every interactive control by keyboard. |

## Changes and evidence

- The map starts top-down with 3D one click away. Map context controls sit above the canvas, the air layer explanation lives in Layers, and mobile tools and context destinations wrap into view. Conversation starts closed and opens as a desktop dock or a 360px sheet.
- The context close button stays compact as content scrolls. Selecting a place closes its search disclosure. Selecting a saved proposal opens its inspector. Resource entry focuses its form. The comparison distinguishes geometry from the illustrative runoff experiment and keeps the model limitations with the controls.
- Native modal dialogs keep the command bar behind the backdrop. Focus indicators work on interactive elements, and the result timeline scrolls into view on open and restores native `hidden="until-found"` behavior.
- Reproduce captures with `node scripts/audit-landscape.mjs artifacts/ui-audit/final` against the local app. The baseline and final PNGs, contact sheets and per-state capture reports are local under `artifacts/ui-audit/`. The script records failed capture attempts and document overflow. These artifacts contain diagnostic screenshots and stay outside version control.
- Modern Web Guidance applied `accessibility` for native modal focus and `:focus-visible`, `form-factor-adaptation` for wrapping controls and larger header targets, and `content-first-noise-reduction` for the compact map controls and optional draft disclosure.
- Automated verification passed 297 unit tests, the production build, 13 result timeline checks, eight decision desk checks and the fixture model planning journey. The build still reports the bundle-size advisory.

The separate demo rehearsal page arrived in commit `c072117` during this audit. I inspected its desktop and 360px initial and disclosure states, including the missing-video fallback. Cue editing, local video playback and microphone behavior are unchecked.

This audit updates the UI evidence for the listed requirements. The scientific validation, autonomous planning and connected data work remain tracked in [TODO](../TODO.md) and the [requirement register](REQUIREMENTS.md).
