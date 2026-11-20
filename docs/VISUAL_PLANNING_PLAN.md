# Visual planning for government staff

Date: 17 November 2026. Status: proposed implementation plan; no application changes or deployment in this planning pass. TODO.md remains the authoritative backlog. All R01-R18 requirements remain in scope.

## User and intended outcome

The user clarified the audience: general government staff who have an idea for a real place and want to see how it could work, explore predictions where supported, and understand why. They should be able to refine a plan conversationally, like iterative coding, with visible geographic changes and minimal navigation. Metrics support the visual explanation; they are not the primary journey.

Confirmed preference: Ollama with `lfm3:1.7b`. Model suitability is still to be measured. The remaining design and deployment choices below are recommendations, not completed capabilities.

## Deployment and existing work recovered

Source thread: [continue](t3-thread://v2/bcd48a53-37d7-4f9c-9c4c-504642115e72/f2179104-e731-4fa5-8eaf-c85028a33e50), especially messages at positions 1270 and 1814. Also checked docs/DELIVERY.md, docs/CURRENT_STATUS.md, the requirement register, product autonomy/harness contracts and local-model benchmark guide.

- Public address: https://terrascope-floods.embarko.app . Independently returned HTTP 200 and the TerraScope page title on 17 November 2026. This is reachability evidence only; no current browser journey or deployed revision was verified.
- Last recorded deployment: `cmwhzsqda06pr13bar90va12g`, serving commit `61faf14`; deployment documentation pushed through `5bc8f76`, per the source thread. The thread reports a claimed deployment, with credentials stored outside the repository. No credential was needed for this plan.
- Existing foundation: real historical ERA5/GloFAS series, OSM context, terrain candidate screening, HydroBASINS context, proposal persistence and movement checks, optional 3D, timeline, source registry, a deterministic screening harness, and an AI adapter/tool catalog.
- The thread reports 277 passing unit tests after its fix slices; those historical results were not rerun here. Local inference was not established by that work. The benchmark runner existed but had not measured a real model.
- Public NRSC rasters remain excluded because hosting rights are not cleared. Preserve the withholding and provenance behavior in future packaging.
- Current gaps: multiple work tabs, an answer-oriented AI panel, incomplete editing/effect hooks, no validated spatial flood-depth/timing calculation, and no verified physical-phone performance.

## First complete journey

1. A government user selects a place and says: "Find places to store monsoon water near this settlement and show me the alternatives."
2. The system identifies the area/objective, checks coverage, and automatically starts the supported source and candidate jobs. Only consequential ambiguity requires a question.
3. Candidates appear as actual polygons on the persistent map. The system highlights evidence and exclusions with short anchored explanations, such as mapped roads crossing a candidate. It does not infer catchment inflow from a depression alone.
4. The user says "Use this one, move the proposed boundary away from the road, and compare another option." The proposal changes visibly; admission checks rerun; undo restores the prior version.
5. Baseline, A and B share the same camera, time and forcing. Available geometry/constraint comparisons appear immediately. Physical effects appear only when a compatible model and inputs exist. Unsupported effects have a concise, localized explanation and the next required input.
6. "Why here?" highlights the referenced evidence on the map. "Show the change over time" plays the appropriate historical or computed result, preserving its mode label.
7. The user saves or exports a visual plan with geometry, alternatives, citations, assumptions and unresolved inputs.

The same interaction pattern must extend to solar, wind and vegetation. Starting with storage provides a complete first slice without cancelling the other processes.

## Proposed delivery sequence and gates

### 1. Establish local inference and the connection path — R02/R12/R17

- Audit actual hardware and runtime availability; verify model license and pin the model digest/quantization and runtime version. Download/install only during implementation, not this planning pass.
- Run the existing benchmark against `lfm3:1.7b`. Extend the evaluation with actual user intents, follow-up references ("move that one"), valid spatial arguments, correct tool selection, grounded explanations, unsupported requests and hostile retrieved content. Preserve the existing acceptance gates; report wrong-tool rate separately because registry-valid calls alone do not prove task success.
- Keep inference tasks small: extract intent, choose among scoped operations, explain checked results. Code schedules dependencies, executes GIS/scientific operations and verifies outputs. Use one model sequentially initially.
- Reuse the existing adapter where compatible; verify tool round trips and cancellation against the real runtime. Model failure must show an explicit disconnected/failed state; deterministic evidence remains available under its own label.
- Initial topology: desktop UI plus local companion/service and Ollama on the same machine. Test the hosted UI connection under actual browser origin/local-network restrictions; provide a locally served UI path if direct hosted access fails.
- Later phone/multi-user topology: authenticated office-controlled gateway to the local inference/job host. A phone's localhost is not the office computer. Do not expose the raw Ollama endpoint publicly or assume Embarko supplies inference hardware.

Gate: recorded real inference, correct tool actions, citation checks, hardware/memory/latency measurements, and a working browser-to-local-service path. A failed gate produces measured findings, not an unasked model substitution.

### 2. Make the map the workspace — R01/R10/R13

- Keep one map mounted with shared region, camera, selected object, scenario and date. Bring history, comparisons, evidence and field information into contextual overlays; preserve saved records and useful existing features.
- Use one compact place/objective bar, a conversation composer, contextual object controls and a timeline when the selected task needs time. Show only relevant layers automatically, with manual overrides.
- Use proposal outlines/geometry, source-linked annotations, candidate highlights and stable-scale baseline/proposal comparison. Distinguish observation, reconstruction, user scenario and calculated output through text/patterns as well as color.
- Support pause, reduced motion, keyboard/coordinate editing, 2D/table alternatives and a mobile sheet that leaves the map usable. Apply modern-web-guidance search/retrieval and cross-check during frontend implementation.

Gate: complete the first journey without work-tab navigation; preserve state across overlays; verify desktop/360px, keyboard and touch interactions. Record real-phone performance separately when a physical device is available.

### 3. Connect conversation to reversible spatial actions — R02/R03/R06/R11/R12/R15/R16/R17

- Add typed tools for area/objective selection, coverage lookup, candidate search/detail, proposal creation/edit/move/delete, comparison requests, and evidence highlighting. Use geometry/object IDs rather than model-invented coordinates where possible.
- Validate every argument and placement through the existing admission checks. Publish edits atomically; support undo/redo and restore history. Recheck changed geometry and invalidate only dependent results.
- Extend the existing screening harness into a persistent job graph with budgets, cancellation, bounded retries, restart recovery and an independent result verifier. Browser-tab execution remains in-session until a local service is implemented and verified.
- Add registered retrieval/source tools with hashes, dates, licensing and coverage checks. Existing local-record lookup alone does not satisfy research. Retrieved text cannot change tool permissions.

Gate: idea -> automatically sourced candidates -> visible proposal -> conversational edit -> undo -> cited comparison, including timeout, offline, duplicate, corrupted-cache and interrupted-run cases.

### 4. Make effects visible and scientifically supported — R03/R04/R05/R07/R08/R09/R10/R11/R13

- Maintain a capability registry stating required inputs, model/version, output fields, spatial/temporal support and validation state for each process. Distinguish a missing dataset, connector, model and UI integration.
- Read docs/VALIDATION.md before modeling and docs/RESEARCH.md before renewable research. Audit terrain datum, outlets, bathymetry, gauges, boundaries and independent reference data before selecting a hydraulic solver.
- Implement matched baseline/proposal runs and verified adapters before showing physical benefits. Render available spatial outputs with units, time, resolution, uncertainty and missing-data masks. Playback must derive from versioned fields, independently of camera/frame rate.
- Keep current history and terrain-only scenarios clearly identified. A flat level control is not predictive water rise; neither a discharge marker nor decorative flow arrows establishes flood extent or travel time.
- Extend supported solar/wind energy and environmental-effect adapters, then vegetation/land-cover processes with their own evidence and evaluation. Retain drought/fire scope. Dated ENSO context requires explicit user confirmation before any supported analytical use; no fixed rainfall multiplier.

Gate: independently checked outputs, reproducibility, held-out events/non-events and baseline comparisons where applicable. Unsupported processes stay pending with specific dependencies, rather than being hidden or visually invented.

### 5. Verify the user outcome and release — R01-R18, especially R14/R18

- Exercise a realistic government planning task: identify the proposal, explain why it was suggested, compare alternatives, change a constraint and recover a previous version. Measure manual steps, completion, latency and explanation comprehension; do not invent performance targets from no baseline.
- Run relevant unit/integration checks and production build; inspect the real rendered journey, record motion and state changes, and test offline/model-failure states. Validate drag gestures as well as keyboard movement.
- Keep R01-R18 traced in TODO.md and delivery evidence. Existing partial completions do not close the wider autonomy/model obligations.
- Prepare the Embarko package using current provider documentation, retaining NRSC exclusions and keeping local-service secrets/model files out of the public UI bundle. Verify a rollback artifact and deployed build identity before release.
- This turn requests a plan first. Execute implementation/release only in a subsequent authorized phase. Do not submit challenge entries or post/send material as part of this work.

## Current sources checked for this plan

- [Ollama LFM3 1.7B model page](https://ollama.com/library/lfm3:1.7b), checked 17 November 2026: exact tag exists and lists tool/structured-output use; cautions against complex multistep reasoning. This supports testing the model, not assuming its reliability in TerraScope.
- [Ollama FAQ](https://github.com/ollama/ollama/blob/main/docs/faq.mdx) and [host configuration](https://github.com/ollama/ollama/blob/main/envconfig/config.go), retrieved using Context7 `/ollama/ollama`: local loopback default and configurable allowed origins. Browser connection/security behavior remains an implementation test, not a guaranteed consequence of setting an origin.

## Evidence of this planning pass

Read the supplied deployment thread through its last messages, checked project contracts and current adapter/benchmark documentation, confirmed the public page's HTTP response/title, and verified the requested model tag and Ollama connection documentation. No model installation, application modification, test execution, deployment or public communication occurred.
