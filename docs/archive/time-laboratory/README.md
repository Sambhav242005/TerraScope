> HISTORICAL / SUPERSEDED: Preserved for context only. The current environmental scenario and flood-preparedness direction is in the root PROJECT.md, AGENTS.md and TODO.md. Claims and instructions below are not current product requirements.

# Running the visual prototype

This is a local visual demonstration of the intended Quantum / 4D interaction, not the complete detective game.

## Run

Node.js 22.12+ or 20.19+ is required by Vite.

```text
npm install
npm run dev
```

For the production build:

```text
npm run build
npm run preview -- --port 4173
```

Open http://127.0.0.1:4173/ while the preview process is running. No account, API key, paid runtime service or external asset request is required. Nothing has been published.

## What works

- A connected binary decision tree with eight numbered leaves, IDs 000–111 in water/predator/food order. Exactly one route is highlighted; selecting its leaf changes the linked 3D history and all values.
- A real Three.js perspective scene with volume, light, shadow, continuous terrain base, modeled trees, river reaches and butterfly cohort markers.
- Seven simultaneous time samples. Year 0 and 30 remain visible; inspecting an intermediate year replaces the closest interior overview sample. Temporal positions follow actual years, not sample order.
- Orbit, pan, zoom, reset, time spacing, year inspection and object focus. Mouse and touch controls are available, plus explicit keyboard-accessible camera buttons.
- A narrow-layout history selector and expandable decision tree. A flat annual data table exposes the same result as the scene. A 3D failure opens the data alternative.
- A deterministic immutable illustrative model, independent of rendering. Every displayed value and ecological scene state comes from it. Butterfly markers represent successive cohorts, not a long-lived individual.

## Scope and limitations

The intervention year is fixed at 8. This prototype deliberately opens Quantum directly to demonstrate the visual interpretation; no investigation, clues, hypothesis gating, verdict, save system or calibrated game engine has been implemented. The example coefficients are a design fixture, not scientifically validated. Temporary food has little lasting effect under the capped illustrative model; do not use this to judge final ecological calibration. No performance claim for physical mobile hardware is made.

Geometry is procedural, with simple tree crowns and stylized glasswing shapes. It is interactive prototype art, not equivalent to the generated concept image. The scene is a projection of space plus time, not a literal fourth spatial dimension. Generic browser fonts are used without network font dependencies. Camera and focus controls intentionally do not animate automatically, including in reduced-motion mode.

## Verified on 2 November 2026

- `npm test`: 2 meaningful tests passed: all eight immutable, reproducible histories, shared pre-intervention prefix, bounded outputs, extinction absorption, and result protection from view changes.
- `npm run build`: passed. Vite reports a bundle-size warning (approximately 619 kB JavaScript, 157 kB gzip); the Three.js bundle has not been optimized for final release.
- Automated headless Microsoft Edge journey: all eight leaves, camera orbit position change, reset, annual selection, mobile history selection, no JavaScript errors, no page overflow at 360px, reduced-motion screenshot.
- Desktop and mobile screenshots inspected. An independent parent-agent browser review found tree wiring clear and accepted the polished visual demonstration.
- These are prototype checks, not completion of the full release acceptance criteria or physical-device touch/performance testing.

## Documentation and dependencies

Context7 tools were unavailable in the active tool inventory. The documented fallback was used: official Three.js OrbitControls documentation (https://threejs.org/docs/pages/OrbitControls.html) and Vite guide (https://vite.dev/guide/).

Pinned installed versions: Three.js 0.187.0, Vite 8.3.5, Playwright test 1.64.1. Check package.json/package-lock.json for the authoritative exact versions.

Modern Web Guidance was searched for canvas accessibility and 3D controls. The retrieved HTML-in-Canvas guide requires Chrome 157; it was not applied because the prototype keeps controls in ordinary accessible DOM and uses a plain WebGL canvas plus table alternative.

Design-taste app-screen draw: Achromatic ledger, seed 264327120. Existing documented forest/amber palette and serif title direction took precedence; the neutral-shell / color-on-data composition was retained. No stock photos, generated image background, or remote media are used. Visual critique: tree route and view linkage clear; depth and orbit evident; remaining limitations are intentionally stylized geometry and subtle year labels at the overview distance.

