# User-POV feature map (15 November 2026)

Written from the seat of **someone steering the decision** — a district or community coordinator, NGO staff, or a planner preparing a meeting — not from the seat of the developer. Status tags are honest: **Works** = usable today; **Works with limits** = the feature runs but the numbers are illustrative; **Withheld** = exists but excluded, with the reason; **Not built** = no artifact exists, do not look for one.

## The end-to-end journey

| Journey question | Where it happens | Status | What it actually is |
|---|---|---|---|
| "What did the late-Sep 2024 event look like?" | Bottom timeline; Explore → replay; River history | **Works with limits** | ERA5 rainfall + GloFAS modeled discharge, day by day, UTC. GloFAS is model output at one sample cell, not a gauge. Gaps are shown as gaps. |
| "Where would water spread?" | Water-level scenario slider (44–64 m flat surface) | **Works with limits** | A color-relief mask of DEM cells below a user-set level. Not depth, not extent, not a forecast. |
| "Show me the observed disaster" | Indian evidence (1–2 Oct 2024) | **Withheld** | Two NRSC/ISRO display maps exist in the project's development build but are excluded from the public build (non-commercial development snapshots; production rights not cleared). Public extent is unknown. |
| "Where can water be stored naturally?" | Natural water-storage candidates (Explore) | **Works with limits** | DEM depressions + OSM mapped water: capacity/depth/rim, sub-basin context, and an illustrative DEM-error capacity range (verbatim label; not a tolerance on available storage). Geometry, not reservoir design; suitability unassessed. |
| "What changed since I looked last time?" | Findings card (Explore) | **Works** | Recomputed change-driven summaries (peak, top-10% band, monsoon context, NRSC window) with evidence chips. A mirror, not an alarm. |
| "Who decides this?" | Ask the map (topbar) | **Works with limits** | Deterministic evidence responder by default; optional local model (Ollama) or cloud model (Groq preset, qwen/qwen3.8-27b). Keys stay in your browser; cloud is labeled cloud. The benchmark harness for local models exists (44 fixture tests) but no local model is installed, so local inference is not delivered. It never sends anything. |
| "Draft a decision brief" | Ask the map → "Decision brief draft" | **Works** | Local markdown download with both options, cited evidence and explicit unknowns. A human authorised officer issues; the app cannot. |
| "Where can I physically put things?" | Field checks (place + verify) | **Works with limits** | Solar/turbine/storage/vegetation placement vs. mapped buildings/roads/water; conflicts flagged automatically. Drag-to-move with re-admission is unit-tested (maplibre pin draggable); real pointer-drag browser acceptance is still unproven. Not certification. |
| "Did I foul up the data?" | Data & sources (topbar) | **Works** | Manifest of every dataset with retrieval date, hash, license verdicts; onboarding registry for new areas. |
| "Does my phone work?" | 360px layout, reduced motion | **Works with limits** | Layout measured via headless emulation; no physical-phone test ever claimed. |
| "Give me a model that predicts the 2027 flood" | — | **Not built** | No calibrated solver, no held-out event validation, no forecast. Requires gauges + validation; impossible to conjure. |

## Natural water storage — why it

Monsoon depressions and old channels on the Gandak–Ganges plain already pull water off the peak. They are
candidate retention sites for flood moderation and groundwater recharge — but only if elevation, outlet, depth,
land rights and usable volume are verified. TerraScope helps you **find the plausible shapes** so a field team
knows where to look first; it cannot grant ownership, guarantee safety, or certify capacity.

## What many needs still are not met (honest list)

- No flood extent/depth/timing layer, ever — needs a validated 2D model or NRSC clearance.
- No gauges ingested — needs a CWC/state-department request.
- No land rights — needs cadastral survey; the app stays out of it.
- Local AI (R02/R12) — Groq cloud path works today; **local** model not installed/benchmarked; R02/R12 open.
- Alerts/warnings — by design, permanently human-issued.
- Field verification — nothing replaces walking the bowl and measuring it.

## Precisely where every file lives

| Concern | File |
|---|---|
| App shell, routes, Export workspace | `src/App.tsx` |
| Natural storage screening (DEM depression search) | `src/flood/storage/*` |
| Sub-basin context (HydroBASINS v1c clipped to the window) | `src/flood/hydrobasins.ts`, `public/data/hydrobasins-as12-sonpur.json` |
| Replay timeline + year/event picker + gaps | `src/flood/ResultTimeline.tsx`, `src/flood/resultTimelineCore.ts` |
| Findings engine | `src/flood/findingsCore.ts` |
| Ask the map (evidence responder + local/cloud model adapter) | `src/flood/DecisionDesk.tsx`, `src/flood/ai/*` |
| ENSO context panel (dated CPC ONI table) | `src/flood/EnsoContext.tsx`, `src/flood/enso.ts` |
| Provenance/licensing registry and onboarding checks | `src/flood/dataOnboarding.ts`, `public/data/manifest.json` |
| Execution harness for deterministic jobs | `src/flood/harness.ts` |
| Requirement register, delivery log | `docs/REQUIREMENTS.md`, `docs/DELIVERY.md` |
