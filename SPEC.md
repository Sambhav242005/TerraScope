# Specification — Flood-preparedness prototype

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](docs/CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


## Automatic planning — latest product contract

The system proactively discovers/refreshes supported data, generates candidate placements and evaluates scenarios after region/objective selection; repeated manual prompting is not the intended workflow. See docs/PRODUCT_AUTONOMY.md for end-user jobs and automatic/manual ownership, and docs/AGENT_HARNESS.md for local agent roles, durable execution and verification. These extend the scope to R01–R18 and supersede manual-first assumptions below. Architecture is documented; autonomous services and model integrations are not implemented. Development must proactively research prerequisites and judge changes against the final user journey.

## Current contract override

Required: single-view environmental simulation; local tool-using research/planning model; storage-candidate search; rainfall/river depth calculations; intervention placement; ENSO context. See docs/REQUIREMENTS.md R01–R14 and its tool/data contracts. AI orchestrates and explains; GIS/hydraulic/environmental tools supply numerical results. Distinguish water-surface elevation with datum, depth above ground and rise from baseline. Solar/wind/vegetation placement remains required, with unsupported calculations explicitly unavailable.

Local inference must not be replaced by templates or silent cloud calls. Review/task contracts below are historical/optional, not the main journey.


Status: a bounded TerraScope prototype is implemented; the full scientific contracts below remain the target. Implemented records are in src/flood/model.ts; query provenance is in public/data/manifest.json. See docs/DELIVERY.md for actual coverage.

## Scope and modes

One selected real case. Label modes explicitly:
- Historical reconstruction uses observed/reconstructed event inputs after the fact.
- Retrospective forecast test uses only information actually available before a cutoff.
- Hypothetical scenario uses modified assumptions and is not an official prediction.

OSM is the required geographic-context source. Select compliant tile hosting/extracts after access/cost review. Terrain, weather, hydrology, land records and assets are separately sourced. Public display does not imply bulk-access rights.

## Proposed contracts

| Record | Required information |
| --- | --- |
| DatasetRecord | Provider, URL, license/attribution, version/checksum, extent, CRS, vertical datum where relevant, resolution/accuracy, units, valid/issue/availability/retrieval times, processing and missing-data mask |
| CaseDefinition | Region/river, event interval/timezone, forecast cutoff, dataset IDs and review status |
| Scenario | Case, rainfall/forecast members, initial wetness/river state, upstream/downstream boundaries, supported modifications and model version/settings |
| RunResult | Scenario hash, model version, outputs/units, uncertainty method, quality flags, computation status and reproducibility metadata |
| AssetRecord | Source ID, geometry/category, optional parcel ID, exposure attributes, verification time/confidence; minimal personal data |
| FieldObservation | Location/accuracy, capture time, submitter/reviewer roles, media references, measurement method, uncertainty and review/conflict history |
| DraftPlan | Referenced results/assets/observations, guidance citations, proposed actions, dependencies, unknowns and human review status |

Partial contracts are implemented: versioned local workspace, OSM assets, reviewer/note/status records, hourly illustrative reservoir results and source manifest. Full survey/forecast/validation contracts and team evidence history remain pending.

## Scientific boundaries

Runoff depends on catchment rainfall and initial conditions; routing depends on network/channel conditions. Inundation requires suitable geometry and boundary conditions. Erosion, landslides, structural failure and embankment breaches are separate processes, not conclusions from water depth alone. An elevation-fill visualization is not a validated forecast.

Do not claim parcel-level precision from coarse weather/elevation. Resampling creates no new information. Hazard/asset intersection indicates potential exposure, not certain loss. Reservoir operations and breach assumptions must be explicit. Never invent unobserved conditions.

Use matched forcing in comparisons. Assess sensitivity to rainfall, wetness, roughness and boundaries. Preserve raw inputs read-only and version preprocessing. Calculations must be reproducible and independent of animation.

## Verification and planning

Tasks: proposed, assigned, evidence received, reviewed, unresolved/closed. New observations may justify a rerun; preserve prior results and change history. Field checks are local, not global validation; urgent official guidance does not wait for this workflow.

LLM: source-linked explanation and draft actions grounded in approved plans. VLM: suggested document extraction and visible-damage flags, reviewed by people. Neither provides missing measurements, certifies infrastructure, sets authoritative warning thresholds or sends public orders. Provider and budget remain open.

## Evaluation and alert trade-offs

Different actions need different thresholds. User favors higher penalties for missed severe events; no numerical weighting is approved. Evaluate recall, precision, false-alarm burden, lead time, calibration and spatial/asset errors. Use held-out events and non-event periods, simple baselines and official warnings. One successful replay is insufficient for operational readiness.

## Proposed architecture and storage

Retain React/TypeScript UI unless evidence justifies changing it. Separate ingestion/validation, model runner, versioned results, map viewer, comparison, verification, AI drafting and export. Heavy processing runs offline or on an explicitly provisioned service. Check Embarko capabilities before choosing deployment; no backend assumption is settled.

New scenario storage must not reinterpret echoes-last-glasswing-v2 game saves. Validate persistence and recover from corrupt/unavailable storage. Secrets stay server-side. Sensitive survey/media access needs explicit design before collection.

## Acceptance

Traceable real case; honest mode labels; reproducible calculations; baseline/holdout evaluation; visible uncertainty/missing data; bounded human-reviewed AI planning; desktop/phone/keyboard/fallback usability; recorded physical-phone performance; authorized external release only. TODO.md and docs/VALIDATION.md specify evidence gates.


## Visual history revision — 4 November 2026

RiverHistory consumes flow-history.json and rain-history.json (2015-01-01–2024-12-31). Dates join by calendar label while keeping UTC/IST distinctions explicit; null rainfall remains null. Graph scale and monthly peak colors are fixed to the full ten-year discharge maximum, not flood-risk thresholds. Monthly tiles jump to the observed-in-this-model maximum date; replay advances daily or weekly and pauses explicitly. CSV includes every daily row. No water depth or flood extent is inferred.
