> HISTORICAL / SUPERSEDED: Preserved for context only. The current environmental scenario and flood-preparedness direction is in the root PROJECT.md, AGENTS.md and TODO.md. Claims and instructions below are not current product requirements.

# Demo specification

## Scope

One playable mystery, **The Last Glasswing**. The original Evolution Detective investigation remains the gameplay foundation. The approved Living 3D Valley enhancement changes the habitat renderer and adds resource-responsive surrounding fauna. No Quantum/4D features, intervention combinations, multiplayer, accounts, procedural cases or live AI services.

## Investigation

Five clues: rainfall records, ancient pollen, nutritional stress in fossils, predator tracks and population chronology. Discover clues before selecting a hypothesis; experimentation requires at least two collected supporting clues. The final explanation is drought → freshwater loss → edible vegetation loss → starvation. Do not present the causal verdict before experimentation.

## Model contract

`src/engine/model.ts` exports `simulate(intervention, startYear, seed)`, `Snapshot`, `evidence` and `interventionLabels`. Interventions are `none`, `water`, `predators`, `food`. Years 0–30 are returned; default rewind14, seed42.

Every snapshot contains rainfall, water, vegetation, predators (indices0–1), nonnegative Glasswing `population`, and frozen `species: Readonly<Record<SpeciesId, number>>`. The ten stable IDs are deer, rabbit, fox, squirrel, songbird, owl, fish, frog, turtle, glasswing. `species.glasswing` always equals `population`. Definitions and habitats are exported by `src/engine/species.ts`.

Weather is indexed by year/seed independently of intervention. Water responds to rainfall with lag; vegetation responds to water; Glasswing births/deaths depend on nutrition and predation. The continuous internal Glasswing population is rounded for display; values below four are extinct and remain zero.

Interventions begin after the selected year's snapshot. Water restoration is sustained; the predator intervention removes the Glasswing predation pathway; feeding lasts three updates. Default calibrated results remain: baseline extinct24, predator intervention extinct24, feeding extinct25, water survives30. These are computed outcomes, never UI lookup rules. Feeding too early may expire before the crisis. Late intervention cannot resurrect extinction.

Other species respond with lag toward resource-specific population targets. They do not feed back into the calibrated Glasswing equations. Foxes and owls remain ambient fauna under the Glasswing predator intervention. These surrounding populations are simplified deterministic proxies, not a validated multi-species food web. All counts are nonnegative integers; the resource equations and stable IDs are independent of rendering.

Evidence chronology derives from baseline threshold crossings. Creature paths and gait animation are illustrative and do not change population results. The case is fictional, not a real-world ecological forecast.

## Rendering

Show the selected snapshot as one living 3D valley. The renderer consumes snapshots and cannot change ecology. Population and resource values determine animal availability, foliage and water appearance. Keep equivalent labeled clue buttons and ecological information outside the 3D canvas. Provide a usable fallback if rendering is unavailable. No time tunnel or Quantum interface.

## Persistence

Version2 uses `echoes-last-glasswing-v2`. If absent, a validated version1 record under the legacy key migrates without losing clues, hypothesis, support, stage or intervention. Derived results are recalculated rather than trusted from storage. Interrupted playback restores at rewind. Reject duplicate/unknown clues, unsupported hypotheses, out-of-range years and incompatible/corrupt data. Storage failure must not block the session.

## Acceptance

Preserve calibrated Glasswing results, shared climate and pre-intervention histories. Species maps have all ten finite nonnegative integer counts; Glasswing identity matches the legacy count. Scene availability follows those counts. Validate full investigation, restore/replay, alternative results, 360px layout, keyboard, reduced motion, fallback and current rendering behavior before claiming delivery. Physical-device performance and observed player timing remain separate validation.
