# Placement edit slice — move a saved proposal (16 November 2026)

Scope: GitHub issue #6 (R06), slice (a) from artifacts/agents/D-placement.md — drag/nudge a saved proposal to a new spot with re-admission and an append-only edit audit. No drawing tool, no parameter editor, no deletion-audit, no effect model.

## What works (implemented, unit-tested)

- **Drag to move.** Proposal pins are created with `draggable: true` when `onMoveIntervention` is provided (src/flood/MapView.tsx, proposal-marker section; threaded through src/flood/WorldMap.tsx and both App.tsx render sites). maplibre-gl 6.16.0 (installed) documents `MarkerOptions.draggable` and `dragstart`/`drag`/`dragend` events in its type definitions, and the official draggable-marker example confirms custom elements fire `dragend`. **Runtime drag feel and touch behavior were NOT executed** — no browser was run (see Limits).
- **Snap-back.** On `dragend` the marker is immediately `setLngLat` back to the as-saved position; if the move is admitted, the `interventions` state changes and the marker effect rebuilds markers at the new spot. A rejected/blocked drop therefore leaves the visible pin at the saved position.
- **Re-admission on move.** `handleMoveIntervention` (src/App.tsx) builds a moved draft with the same id (`buildMoveDraft`), then runs the same `assessPlacement` admission used for fresh placements. Only a passing check persists the move. Mapped conflicts keep the proposal untouched and show the existing blocked-attempt feedback (red dashed footprint at the drop, `Not placed`-style banner/card with proposal-specific wording "Proposal was not moved"). Self-overlap is not a false conflict (`checkScenePlacement` skips identical ids); overlap with any other proposal still blocks.
- **Supplied footprints follow the pin.** A supplied candidate-polygon footprint is translated by the same lat/lon delta (`translateFootprint`, outer ring and holes) so the checked geometry never drifts from the pin.
- **Append-only audit.** Every confirmed move appends one `PlacementEdit` (`op: "move"`, `interventionId`, `at`, `before`/`after` geometry incl. footprint) to `saved.placementEdits` in `terrascope-v1`. Entries are never rewritten or deleted by any code path in this slice. Export spreads `...saved`, so exports include the audit. Load filters entries through `validatePlacementEdit`; legacy workspaces without the array load with an empty audit.
- **Keyboard/touch path.** N/E/S/W nudge buttons (~200 m) in the intervention inspector; each nudge goes through the same admission path. These are application-owned controls because custom marker elements do not inherit maplibre keyboard drag.
- **Camera neutral.** A move never calls `focusPlacement`/`moveAreaForCheck`; the camera and the reviewed area do not move for an ordinary edit. The out-of-coverage drop case is refused with an explicit message instead of relocating the reviewed area (see Refusals/limits).

## What was verified (unit tests + build only)

- `node --test tests/placement-edit.test.js` — 11/11 pass (move draft, footprint translation incl. holes + closed rings + shoelace invariance, coordinate limits, nudge math, audit pairing, validation, rejection of junk entries, admission on road vs clear spot, self-overlap, sequential append order, legacy filter).
- `npm test` — 274/276 pass; the 2 failures are pre-existing in `tests/bench-local-model.test.js` (untracked bench work in progress, identical failures on the pristine tree; untouched by this slice).
- `node --test` on the placement suite (placement-edit/placement-admission/placement-check/intervention/placement-evidence) — 38/38 pass before and after.
- `npm run build` — passes (`tsc --noEmit` zero errors; vite build ok; pre-existing chunk-size warning only).

## What was NOT done / not verified

- **No browser was run.** No Playwright, no server, no screenshots. Drag gesture behavior, touch behavior, 360px layout, console errors and the visual snap-back are unverified. Unit tests + build are the entire verification for this slice.
- The D-placement "drop outside loaded coverage triggers the bounded refetch" acceptance item is **deliberately not implemented**: it would relocate the reviewed area and zoom the camera for an ordinary edit (R01). Instead the move is refused with an explicit message. Re-attempt after selecting the area.
- No parameter editing, drawing tool, resize/rotate, delete-with-tombstone, undo/redo stack or effect re-run (R04/R05 blocked). Undo remains pop-last.
- The `usePlacementChecks` hook was not modified; checks recompute from the `interventions` array after a move (same mechanism as current renders).
- `handleMoveIntervention` / `handleNudgeIntervention` / the marker `dragend` handler live in component code and are not directly unit-tested; the pure functions they call are tested.
- Adopted-candidate moves keep `sourceCandidateId` and translated footprint, but no new catchment/outlet/bathymetry claims are made; moved proposals remain proposals, never calculation inputs.

## Honesty notes

- A successful move records "Admission re-checked against loaded map evidence… effects not calculated." All existing unknown labels remain; no suitability/approval wording is introduced.
- Absence of a mapped conflict after a move is not approval; coverage limits and every inherited unknown stay as documented in docs/PLACEMENT_VALIDATION.md.
- The audit is provenance for geometry only; it is not a surveyed boundary and not a calculation record.
