> HISTORICAL / SUPERSEDED: Preserved for context only. The current environmental scenario and flood-preparedness direction is in the root PROJECT.md, AGENTS.md and TODO.md. Claims and instructions below are not current product requirements.

# Visual and interaction design

## Direction

A cinematic natural-history laboratory surrounding a tactile 3D ecological world. Use charcoal and deep forest surfaces, warm ivory text, amber selections, and restrained cyan temporal traces. Elegant serif display headings pair with a highly legible interface typeface. Exact fonts and color tokens remain to be selected and checked for contrast.

Favor generous space, quiet controls, and a dominant world viewport. Avoid neon overload, ornamental dashboard metrics, and flat infographic treatment of the main scene.

## Visual reference

![3D Quantum and time-view concept](docs/references/quantum-4d-concept-v3.png)

This generated image establishes depth, materials, lighting, and overall composition. It is not a pixel-perfect implementation contract. Its branch highlighting, intervention wording, tree conditions, and same-butterfly-over-decades implication contain inconsistencies; follow `SPEC.md` for behavior.

## Core screens

1. **Case introduction:** Glasswing specimen, vanished habitat, a short mystery premise, and Begin investigation.
2. **World explorer:** an interactive valley with five discoverable evidence locations, year controls, and an evidence journal.
3. **Hypothesis lab:** select a cause and at least two clues, then submit the explanation.
4. **Quantum Phase:** explore the connected decision tree and select a terminal history.
5. **4D explorer:** inspect the selected history through persistent objects and time positions.
6. **Compare and verdict:** compare the original and selected history, explain the causal chain, and replay.

## Quantum Phase composition

On desktop, reserve roughly 25–35% of the workspace for the tree and the rest for the selected history's viewport. The tree has three binary levels in this order: **Restore freshwater? → Remove predators? → Add emergency food?** Each branch is explicitly Yes or No. All choices apply at one selected intervention year; tree depth is not elapsed time.

Display eight numbered terminal nodes with accessible names describing their combinations. Highlight exactly one complete root-to-leaf route. Clicking a leaf loads its history directly into the 4D viewport. Expose the selected combination and intervention year beside the viewport. Support keyboard selection and a readable list equivalent on small screens.

## 4D world composition

- Use one continuous 3D coordinate space with an elevated perspective camera, ground reference grid, and a clearly labeled time direction.
- Show repeated states of recognizable objects along time, connected by restrained trajectories. Render solid foreground objects, translucent temporal copies, and thin time planes.
- Provide real spatial volume: dimensional terrain edges, rounded tree crowns, branching trunks, modeled creature bodies, believable material response, contact shadows, and occlusion.
- Selecting an object emphasizes its entire available history while reducing unrelated detail. Selecting a time plane emphasizes objects at that moment.
- Default to seven representative time samples over the complete history; permit inspection of every stored year. Mark birth, death, and extinction endpoints rather than extending objects beyond their existence.
- Keep paths and labels readable during orbiting. Provide Orbit, Pan, Zoom, Reset view, a year scrubber, and Time spacing.
- Time spacing changes visual separation only; it never changes ecological inputs or results.

The 4D view is a projection of spatial states plus time into an explorable 3D scene. It should make simultaneous moments understandable rather than imply a literal fourth spatial dimension.

## Identity and timescale

Over the 30-year case, Glasswing markers represent a population/cohort history, clearly labeled as such. A selected individual can be shown only across its actual modeled lifespan. Trees and river reaches may persist across years with stable IDs. Do not show a butterfly moving continuously for 30 years while labeling it the same individual.

Creature movement between annual states is illustrative unless a separate fine-grained simulation supplies those positions. The interface must not present decorative movement as measured evidence.

## Responsive and accessible behavior

Desktop uses the linked tree/viewport composition. Mobile opens the selected history in a full-width viewport with a clear return-to-tree action; controls and evidence use accessible sheets. All essential actions work without hover or precise dragging. Use touch targets of at least 44 CSS pixels, visible focus, text-plus-color status, and readable contrast.

Reduced-motion mode removes automatic camera movement and looping decorative effects. A flat, labeled history/table alternative exposes the same years, outcomes, and object information when 3D is unavailable or unsuitable.

## Visual acceptance

The viewer must immediately recognize a connected decision tree, its selected outcome, and several moments of that outcome coexisting in depth. Orbiting must reveal object volume. Time spacing must separate temporal copies. The scene must remain legible without requiring the user to decipher overlapping trails.
