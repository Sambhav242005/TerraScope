> HISTORICAL / SUPERSEDED: Preserved for context only. The current environmental scenario and flood-preparedness direction is in the root PROJECT.md, AGENTS.md and TODO.md. Claims and instructions below are not current product requirements.

# Product specification

## Scope and status

This is the intended first-release specification, not a description of implemented software. Confirmed user requirements are recorded in `DECISION.md`; operational defaults below may be revised after prototype testing.

Build one fictional ecological investigation, **The Last Glasswing**. Support the journey from evidence collection to a hypothesis, intervention experiments, Quantum decision-tree exploration, object histories in 4D, and a verdict. No login or runtime API key is required.

## Case and investigation

The authored drought must lower freshwater before edible vegetation declines, followed by nutritional stress and Glasswing collapse. Predator pressure exists but is not the primary cause.

Five clues: rainfall records, ancient pollen, Glasswing fossils, predator tracks, and population chronology. Each clue has an observation and provenance; do not state the final causal verdict during discovery. Submit one of three hypotheses—water-driven food loss, predation, or food loss independent of water—with at least two discovered clues. Submission unlocks intervention exploration even when the hypothesis is wrong.

The verdict distinguishes evidence quality from intervention success. A lucky successful intervention does not automatically prove the original reasoning correct.

## Simulation

- Use a deterministic, bounded annual population/ecosystem model for years 0–30 inclusive, with rainfall, temperature, freshwater, edible vegetation, predator pressure, births, deaths, and population.
- Keep a fixed case seed and initial state. Random variation, if used, must be indexed by year and process so branch execution order or conditional random calls cannot change shared environmental inputs.
- Generate the baseline once. For each intervention year, fork its pre-intervention state and calculate all alternatives with the same climate forcing.
- Choose an intervention year from 0–29. Preserve the original state for year 0; apply interventions at the start of transition from year t to t+1. Earlier snapshots must match baseline exactly.
- Freshwater restoration supplies sustained water; predator removal eliminates modeled predator mortality from activation onward; emergency food supplements nutrition for three annual transitions.
- Extinction is absorbing: once population is zero, no intervention resurrects it. To attempt rescue, choose an earlier year.
- Calibrate explicit equations and parameters before UI integration. Required relationships: baseline extinction; sufficiently early water restoration permits recovery; predator removal alone does not fix starvation; temporary food delays collapse without solving water loss.
- Combination results come from the same equations, never a hand-authored outcome lookup. Record parameters and calibration evidence in tests when the engine is implemented.

This is a simplified fictional model, not a scientifically validated predictor of real ecosystems.

## Quantum Phase

The three decisions are freshwater restoration, predator removal, and emergency food, each enabled or disabled. Render their Cartesian product as a binary decision tree with eight terminal histories, including the unchanged baseline.

Use stable IDs `000` through `111` in water/predator/food bit order; optional display numbers 01–08 follow that order. A selected leaf highlights only its complete ancestor route and opens its 4D history. Internal nodes may expand/collapse branches; they do not represent a fully resolved history.

Changing the intervention year recalculates results while preserving the selected combination. Explain that all tree decisions apply at the same chosen year. Display final population and extinction year where applicable; do not invent survival probabilities.

Permit baseline-versus-selected comparison with aligned years and equal environmental inputs. Preserve year and camera when changing histories where possible; clear object selection with an explanation if the entity does not exist in the new history.

## 4D exploration

The scene projects space and time into a navigable 3D view. Start with seven overview samples, including both endpoints. Year selection can inspect every annual snapshot. All view data comes from the selected simulation history.

Temporal positions use an explicit view transform: each object's world position plus an offset along the displayed time axis. Camera motion and time-spacing changes affect rendering only. Include year labels so spatial displacement cannot be mistaken for literal organism travel.

Support orbit, pan, zoom, reset, object selection, time-plane selection, year scrubbing, and spacing adjustment. Selected objects show their available states and associated values. Maintain stable identities for persistent trees/river reaches. Represent Glasswings as cohorts/population markers at annual resolution; never fabricate a decades-long individual life.

Provide a flat timeline and data alternative with equivalent selection and outcome information. On rendering failure, preserve progress and offer this alternative rather than a blank screen.

## Internal contracts

These are internal concepts, not network APIs. No public server API is planned.

| Contract | Required responsibility |
| --- | --- |
| CaseDefinition | Case ID/version, seed, initial conditions, climate forcing, parameters, evidence definitions |
| InterventionSelection | Start year and water/predator/food booleans |
| EcosystemSnapshot | Year and bounded ecological state; population and extinction state |
| SimulationResult | Stable combination ID, seed, selection, immutable yearly snapshots and outcome |
| EntityHistory | Stable entity ID, entity/cohort kind, valid time range, sampled states linked to result |
| InvestigationProgress | Save version, case version, discovered clues, hypothesis, selected history/year |
| ViewState | Camera, selected entity, selected year, time spacing and display preferences |

Separate rendering trajectories from ecological state. Cache by case/parameter version, seed, intervention year, and combination; invalidate when any of these change. Do not persist derived histories if they can be regenerated deterministically.

## Technical working default

Use TypeScript with React/Vite for the app, a pure TypeScript engine, Three.js for the 3D viewport, and lightweight SVG/HTML for the decision tree and charts. Use localStorage for versioned progress. Vitest and Playwright are proposed for model and journey tests. Check current documentation through Context7 before setup or library-specific implementation; choose exact versions then. This stack is a proposal, not a user-confirmed constraint.

## Persistence and failure behavior

Restore progress after refresh. Handle unavailable storage without blocking play. Validate saves; incompatible or corrupt data should produce a clear restart option rather than an application crash. Support explicit reset/replay. Cancel or disregard stale computations when the player changes years rapidly.

## Acceptance tests

- Identical inputs reproduce every snapshot, including across different branch evaluation orders.
- No-intervention branch equals baseline; all histories share the same pre-intervention prefix.
- Early freshwater rescue, predator-only failure, and temporary-food delay meet the calibrated case expectations.
- Exactly eight unique combinations exist; each tree path, label, selected history, and displayed result agree.
- Population and environmental values stay bounded; extinct populations remain zero.
- Every displayed year, value, and object state maps to the selected result; visual controls cannot mutate simulation data.
- Year switching, history switching, rewind, reset, and refresh retain coherent state.
- Keyboard and touch can complete the investigation and inspect all histories. A 360px viewport has no page-level horizontal overflow.
- Reduced motion and rendering/storage failure alternatives work.
- Record performance on named desktop/mobile devices after the prototype; agree a measurable target from that evidence before final optimization.
- A new player can finish the core investigation in approximately 3–5 minutes without opening every history.
