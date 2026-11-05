# Agent instructions

Read docs/REQUIREMENTS.md, PROJECT.md, DESIGN.md, SPEC.md, DECISION.md, MISTAKE.md, TODO.md and docs/DATA.md before implementation. Read docs/VALIDATION.md before modeling; docs/RESEARCH.md before solar/wind research. TODO.md is the authoritative execution backlog; TASKS.md is a summary. Report requirement IDs and evidence; never silently drop later requirements.

## Active direction

One persistent real-world view using OpenStreetMap, filters, contextual panels and placement tools. Local AI researches sources, invokes spatial/scientific tools and creates plans. Core scope includes candidate water-storage search, heavy-rainfall/river impacts and water rise, storage/solar/wind/vegetation placement, renewable environmental-effects research and user-confirmed ENSO context. The user rejected separate work tabs and a review-centered product. docs/REQUIREMENTS.md R01–R14 preserves the full scope; staged delivery is not cancellation. Gandak/Sonpur remains provisional, not a validated pilot. TerraScope is provisional.

The active UI is the TerraScope historical-data and resource-review prototype. It includes real ERA5/GloFAS snapshots, OSM context and a clearly illustrative linear-reservoir experiment. It is not validated hydrology or an operational forecast. Legacy game source is preserved in docs/archive/living-valley/source. Read docs/DELIVERY.md for implementation evidence and missing integrations. Old game and Quantum/4D requirements are superseded; archived instructions are historical, not current application requirements.

## Rules

- Design from the final product and end-to-end user job, not only the latest requested widget. Proactively research primary sources and discover missing prerequisites; do not wait for the user to enumerate features or data sources.
- Read docs/PRODUCT_AUTONOMY.md and docs/AGENT_HARNESS.md. Scope is R01–R18. Default product behavior after region/objective selection is automatic supported data discovery/refresh, candidate placement, scenario evaluation and meaningful findings within configured limits.
- Distinguish missing data from missing connectors, model capabilities and UX. Minimize routine manual work; document genuine access/configuration/scientific constraints. Do not imply an LLM can generate validated new physics or inaccessible surveys.
- Product agents must use scoped tools and a durable, bounded, independently checked harness. Architecture/prompts alone are not functioning agents. Do not claim background operation unless a service is running and verified.

- Distinguish observations, reconstructions, issue-time forecasts, user scenarios, model outputs and AI drafts.
- Every scientific output needs provenance/version, units, resolution, time coverage, assumptions and uncertainty. Missing data is not zero or safe.
- A replay using realized rainfall is not an advance forecast. Retrospective forecast inputs must have been available before the cutoff, including publication latency.
- Prevent train/test leakage. Test held-out events and non-events against simple baselines and official warnings.
- Penalize missed severe hazards while measuring false-alarm burden. No numerical alert threshold or operational authority has been approved.
- Distinguish cadastral parcels from terrain/channel surveys; OSM is not a land-title authority. Minimize personal ownership data.
- LLMs draft cited explanations/checklists; VLMs assist document/image review. Neither invents measurements, certifies structures, declares routes safe or authorizes evacuations.
- Field observations improve inputs but do not validate the whole model or delay urgent official guidance.
- Separate rendering and scientific calculation. Same versioned inputs/settings reproduce results independently of camera/frame rate.
- Support keyboard, touch,360px layouts, reduced motion, pause and non-3D map/table access. Measure on a real phone before claiming phone performance.
- Verify data access/licenses/attribution and hosting limitations. No client-side secrets.
- Do not deploy, submit entries, send warnings or message other people without authorization.
- Mark tasks complete only with evidence. Update docs when scope or implemented behavior changes.

## Context7

Use Context7 for library/framework/SDK/API/CLI/cloud-service usage, setup, syntax, configuration, migration and library-specific debugging, even if familiar. First resolve-library-id with name and question unless an exact /org/project ID was provided; select a relevant reputable match, then query-docs for one concept at a time. Retry ambiguous matches. Base guidance on retrieved docs.

General concepts, standalone scripts, business logic debugging, refactoring and code review do not require Context7. If unavailable, state this and use official primary documentation. Never claim it was used when it was not. Latest explicit user instructions override older project documents.
