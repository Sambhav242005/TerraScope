> HISTORICAL / SUPERSEDED: Preserved for context only. The current environmental scenario and flood-preparedness direction is in the root PROJECT.md, AGENTS.md and TODO.md. Claims and instructions below are not current product requirements.

# Echoes of Extinction

> Every extinction leaves evidence. Can you uncover the truth—and change the past?

## Purpose

A browser-based ecological detective game in which players investigate a fictional extinction, test causal explanations, and explore alternative histories. The first case is **The Last Glasswing**, set in **Moonveil Valley**.

The defining experience combines a scientific mystery with a Quantum decision tree and a three-dimensional view of objects across time.

## Current status

Planning and visual exploration only. No application, simulation, tests, or deployment exist yet. These documents were created on 2 November 2026 from the supplied project brief and subsequent design discussion.

## Confirmed direction

- One polished case with a short core investigation and optional deeper exploration.
- Cinematic natural-history laboratory styling.
- Quantum Phase represents all eight on/off combinations of three interventions as a decision tree.
- Selecting a history opens its 4D view.
- The time view must show recognizable objects at successive moments together, with strong 3D depth and an explorable camera.
- The latest concept improves the desired depth; it has not received explicit final design approval.

## Document map

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Instructions for coding agents and contributors |
| `SPEC.md` | Intended behavior, data contracts, and acceptance criteria |
| `DESIGN.md` | Visual composition and interaction requirements |
| `DECISION.md` | Confirmed choices, working defaults, and open questions |
| `MISTAKE.md` | Rejected interpretations and errors to avoid |
| `TASKS.md` | Dependency-ordered implementation checklist |

Visual reference: [latest 3D concept](docs/references/quantum-4d-concept-v3.png).

## First case

Drought reduces freshwater, native edible plants decline, and Glasswings starve. Predator tracks provide a plausible competing explanation. Players inspect rainfall records, pollen, fossils, predator tracks, and population history before testing freshwater restoration, predator removal, and temporary feeding.

## Delivery boundaries

Target a 3–5 minute core case. Quantum and 4D exploration may take longer. Start with a browser-only static application and local progress saving. Defer accounts, multiplayer, procedural mysteries, multiple biomes, LLM dialogue, and real quantum computation.

The original 5–7 day estimate predates the expanded 3D requirements. Re-estimate after the visual/performance prototype. Embarko is the intended hosting/submission context from the original brief, but its current requirements, deadlines, and hosting limits must be verified before deployment work. No dates in the original brief should be treated as verified competition rules.

## Visual prototype — 2 November 2026

A runnable browser demonstration now exists in `src/`; see `README.md` for running instructions and verified checks. It demonstrates the eight-leaf decision tree linked to actual orbitable 3D object histories. It is explicitly labeled as a visual prototype with illustrative ecological data. The investigation and full game specification remain unimplemented. This supersedes the initial "planning only" status for the prototype only.
