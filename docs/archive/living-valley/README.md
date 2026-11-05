> HISTORICAL / SUPERSEDED: Preserved for context only. The current environmental scenario and flood-preparedness direction is in the root PROJECT.md, AGENTS.md and TODO.md. Claims and instructions below are not current product requirements.

# Echoes of Extinction — The Last Glasswing

A playable browser demo of the original Evolution Detective plan: investigate five clues, choose a supported hypothesis, rewind, test one ecological intervention, compare timelines, and reach a verdict.

The Living 3D Valley enhancement adds an explorable spatial habitat and ten resource-responsive fauna types while preserving this investigation. The previous Quantum/4D prototype is superseded. Historical files live in docs/archive/time-laboratory; none are imported into the current app.

## Run

Use a current Node release (checked here with Node 26.13.0).

```sh
npm install
npm run dev
```

For the built preview:

```sh
npm run build
npm run preview -- --port 4173
```

Open http://127.0.0.1:4173/ after starting the preview. This address is local to this computer; the demo has not been publicly deployed.

## Checks

```sh
npm test
npm run build
node tests/investigation-check.mjs
```

The browser check expects the built preview at port4173 and Microsoft Edge installed. It checks a complete investigation, all three interventions, refresh restoration, mobile overflow, and runtime errors. Node's test runner imports the pure TypeScript model using native type stripping.

## Model and boundaries

The model is deterministic and fictional. Shared weather, water/vegetation lag, nutrition, and predation determine outcomes. At the default rewind year14: baseline and predator removal become extinct in year24; feeding delays extinction to year25; freshwater restoration survives. The comparison is computed, not a pre-scripted rescue animation.

The demo uses React/TypeScript, a living 3D valley with an accessible rendering fallback, SVG charts, React state and localStorage. It does not yet include final production artwork, share-card export, a submission video, or verified competition hosting integration. Plain CSS and React state replace optional styling/state libraries for this demo.

## Documentation consulted

Context7 was unavailable in this session. Official references used instead:

- [React with TypeScript](https://react.dev/learn/typescript)
- [Vite setup](https://vite.dev/guide/)
- [Playwright assertions](https://playwright.dev/docs/test-assertions)
- [Playwright emulation](https://playwright.dev/docs/emulation)

Modern Web Guidance motion informed opt-in playback, animation pause, and targeted reduced-motion behavior. The user-supplied original plan controls the visual direction and feature scope.

## Verified demo delivery

TypeScript/production build passed. Five model tests passed. Headless Edge checked the complete journey, all three intervention outcomes, pause/resume, refresh restoration, restart, corrupt saves, 360px overflow and reduced-motion mode with zero JavaScript errors. Desktop and mobile screenshots are stored under docs/original-plan-*.png.

The three-dimensional habitat and animal motion are presentation: movement is illustrative, while availability, foliage and river state consume simulation snapshots. Ten population types are carried in each snapshot. Surrounding fauna are simple water/vegetation-responsive proxies and do not feed back into the calibrated Glasswing model. Foxes and owls remain ambient wildlife when the separately modeled Glasswing predation pathway is removed. A physical-device accessibility/performance audit and observed 3–5 minute user test are still pending.


## Living Valley integration checks

Species integration preserved the three calibrated model tests and passed two added species tests (five total). TypeScript/production build passed with the integrated renderer. The updated full investigation browser check passed on the integrated dev preview: all three outcomes, playback pause/resume, refresh, restart, 360px overflow, reduced motion, corrupt version2 saves, legacy version1 migration and duplicate-evidence rejection, with zero JavaScript errors. Scene-specific rendering/device checks remain separate and are recorded by final delivery.

Progress now saves under `echoes-last-glasswing-v2`. Valid version1 saves under the prior key migrate on load. Clues, hypothesis, evidence support, rewind choice and stage are retained; computed timelines are regenerated. Corrupt/incompatible records restart safely, and unavailable storage does not prevent play.

`Snapshot.species` is an immutable map keyed by deer, rabbit, fox, squirrel, songbird, owl, fish, frog, turtle and glasswing. The Glasswing count equals the existing `population` field. Shared seed/weather and historical-prefix rules apply to the full snapshot.

## Living valley delivery — 2 November 2026

The browser scene now uses actual Three.js meshes, a downhill carved river, pond, ridge, forest, flowers, bridge and field station. Three seeded EZ-Tree branch variants are generated once by `scripts/generate-trees.mjs` and stored as reusable geometry. Dimensional crowns and all ten articulated animal types are original procedural geometry. No texture pack or external asset request is needed at runtime. Removing unused EZ-Tree textures reduced the production JavaScript from 3.21 MB gzip to approximately 283 KB gzip; Vite still reports a single-chunk size advisory.

Overview supports orbit, pan, zoom and reset. Walk uses WASD, drag-to-look, touch direction controls, terrain height, bridge crossing, tree/rock/station collision and water/boundary exclusion. Selecting an animal opens its observation card and Follow; Return restores the prior camera. Reduced motion makes follow a stationary view instead of automatically tracking. Pause life and experiment pause freeze ambient movement. The final verdict provides Explore the valley without erasing evidence.

At year0 there are up to54 representatives across ten species. Counts scale from snapshot populations, with zero living representatives for extinct species. Resource responses vary by species; fox/owl abundance also depends on modeled prey availability. Movement includes wandering, resting, hopping, wingbeats, grazing/drinking poses, squirrel climbing, predator proximity reactions, and nearby-group steering for deer, birds and fish. These are illustrative state-based behaviors, not individual lifetime simulation or validated ecology.

Eight model/habitat tests pass. Browser journey tests cover all outcomes, saved progress, migration, corrupt saves, restart and360px layout. The separate valley check covers ten species, water/land placement, pause, walk, follow/return, extinction visibility, reduced-motion camera, overflow and WebGL failure fallback. See `docs/valley-test-results.json` and `tests/valley-check.mjs`.

Measured headless Edge on Windows / NVIDIA GeForce RTX4070 Ti:75 FPS at1440×1000 and75 FPS at360×800 viewport emulation. The mobile-sized run used the same desktop GPU. A physical mobile device was unavailable; the30 FPS phone acceptance target remains unverified. Representative caps, distant tree simplification, offscreen suspension and adaptive pixel ratio/shadows limit rendering work.

References: [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [EZ-Tree, MIT](https://github.com/dgreenheck/ez-tree), [Mapgen4 terrain/river reference](https://github.com/redblobgames/mapgen4), [heightfield erosion reference](https://github.com/dandrino/terrain-erosion-3-ways). Terrain is authored and seeded, with a fixed downhill channel; no live erosion, Taichi or Code-as-World runtime is included.
