> HISTORICAL / SUPERSEDED: Preserved for context only. The current environmental scenario and flood-preparedness direction is in the root PROJECT.md, AGENTS.md and TODO.md. Claims and instructions below are not current product requirements.

# Agent instructions — Echoes of Extinction

## Read first

Read `PROJECT.md`, `SPEC.md`, `DESIGN.md`, `DECISION.md`, and `MISTAKE.md` before implementation. Use `TASKS.md` to track verified progress. The latest explicit user instruction overrides these documents; record resulting decisions rather than silently changing scope.

## Product invariants

- Build an ecological detective game: evidence → hypothesis → intervention → comparison → verdict.
- Quantum Phase is a connected decision tree with eight terminal histories. Selecting a terminal history opens that history's 4D view. Do not replace it with a gallery of outcome cards.
- The 4D view is an orbitable 3D visualization of objects through time. Multiple moments coexist in one frame. A playback slider alone does not satisfy this requirement.
- Use one coherent simulation result for the world, evidence, charts, decision-tree outcomes, and time view. Never invent successful outcomes for visual effect.
- Preserve the mystery until the player submits an evidence-supported hypothesis.
- Treat the visual reference as art direction, not authoritative labels, branch wiring, ecological data, or a promise of real-time rendering quality.

## Working rules

- Inspect existing files before editing; preserve unrelated user changes.
- Keep simulation logic independent of rendering and UI state.
- Use stable entity identities, deterministic seeds, and immutable history results.
- Keep the first release browser-only, with one case and no paid runtime API or account requirement.
- Verify meaningful behavior after changes. Test simulation invariants and user journeys rather than mirroring implementation details.
- Check desktop, touch, keyboard access, reduced motion, and a 360px viewport.
- Update affected documents when behavior changes. Mark tasks complete only after their acceptance criteria pass.
- Do not publish, submit a competition entry, or send messages to others without user authorization.

## Current documentation — Context7

Use Context7 MCP to fetch current documentation whenever a task involves a library, framework, SDK, API, CLI tool, or cloud service, including syntax, configuration, migration, setup, and library-specific debugging. Prefer it over web search for library documentation.

1. Start with `resolve-library-id` using the library name and documentation question, unless an exact `/org/project` ID was supplied.
2. Choose by name match, relevance, snippet coverage, source reputation, and benchmark score. Use version-specific IDs when a version is requested; retry alternate names if results are poor.
3. Call `query-docs` for one concept at a time. Combine concepts only when their interaction is the question.
4. Base implementation guidance on the fetched documentation. If Context7 is unavailable, report that and consult official primary documentation; never pretend it was used.

Context7 is unnecessary for general programming concepts, business-logic debugging, ordinary refactoring, code review, or writing standalone scripts that do not require library-specific guidance.

## Evidence and communication

Report what changed, what was checked, and any remaining limitation. Distinguish implemented behavior from planned behavior and generated concept art. Do not claim deployment, performance, scientific validation, or test success without evidence.
