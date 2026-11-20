# Decisions

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](docs/CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


## Area environment scope — 17 November 2026

Confirmed additions R19–R21 retain R01–R18: area wildlife/forest reports, historical flood-area search, and air quality/pollution. Implementation uses constrained evidence types; report geography and search envelopes cannot become invented routes or flood polygons. No precise wildlife tracking data is stored or displayed. Missing routes do not mean no route.

Bounded delivery: automatic curated report lookup and live CAMS global modeled air lookup after area changes; a same-world contextual panel and optional model sample-point callback. Historical event footprints, current station observations and water/soil pollution remain specific connector/data/scientific dependencies. Existing NRSC public-build withholding remains. See `docs/research/area-environment-evidence.md`; no release or external communication is authorized by this slice.

## Automatic planning — latest product contract

The system proactively discovers/refreshes supported data, generates candidate placements and evaluates scenarios after region/objective selection; repeated manual prompting is not the intended workflow. See docs/PRODUCT_AUTONOMY.md for end-user jobs and automatic/manual ownership, and docs/AGENT_HARNESS.md for local agent roles, durable execution and verification. These extend the scope to R01–R18 and supersede manual-first assumptions below. Architecture is documented; autonomous services and model integrations are not implemented. Development must proactively research prerequisites and judge changes against the final user journey.

## Latest confirmed decisions — 4 November 2026

- D16: One persistent world with filters and contextual panels; no separate work tabs.
- D17: Local LLM must research sources, invoke spatial/scientific tools and create source-linked plans.
- D18: Candidate water-storage search and affected-area/water-rise calculations are core capabilities.
- D19: Placement of storage, solar, wind and vegetation/land-use interventions stays in scope.
- D20: User explicitly confirmed El Niño / La Niña (ENSO) as the intended global-event context.
- D21: Renewable research stays in the product scope, superseding D12. Sequencing calculations is not cancellation.
- D22: Retire review-centric navigation, superseding the workflow portions of D05/D09; retain survey/evidence inputs and saved records.
- D23: docs/REQUIREMENTS.md is the scope register; TODO.md is the execution backlog. Historical implementation records are not completion evidence for new requirements.

These decisions supersede conflicting earlier rows below.


Confirmed means explicit user direction; Proposed means a working recommendation; Open means unresolved. Earlier game designs are superseded.

| ID | Status | Decision |
| --- | --- | --- |
| D01 | Superseded | Quantum/4D laboratory, Glasswing investigation and animated wildlife are no longer active product requirements. Preserve history. |
| D02 | Confirmed | Explore a real-data environmental simulator with interactive changes and consequences. |
| D03 | Confirmed | Use OpenStreetMap for geographic context. |
| D04 | Confirmed | Test whether a real Nepal disaster could have been anticipated; exact event/date is open. |
| D05 | Confirmed | Include land-survey records and a field-team verification workflow. |
| D06 | Confirmed | Address recurring floods in Bihar/UP, resource protection and LLM/VLM-assisted planning. |
| D07 | Confirmed | Prioritize missed severe hazards; unlimited false alarms and numerical thresholds are not approved. |
| D08 | Confirmed | Aim toward Embarko and a substantive research project; public deployment/submission remains separately authorized. |
| D09 | Proposed | First deliver one river reach/watershed and documented flood replay with asset inspection, verification and draft plans. |
| D10 | Proposed | If issue-time forecasts cannot be obtained, deliver reconstruction and label it honestly. |
| D11 | Proposed | Keep heavy calculations offline/server-side; use mobile-friendly maps with optional3D. |
| D12 | Proposed | Separate solar/wind climate research from the flood-preparedness MVP. |
| D13 | Open | Pilot district/river, disaster date, available surveys/gauges/forecast archives, reviewers, solver, budgets and hosting architecture. |
| D14 | Open | TerraScope working name. Existing directory/package name stays unchanged. |
| D15 | Confirmed | Update Markdown and create TODO.md explaining what/how/verification; no application changes in this task. |

## Evidence rules

A detailed map is not a detailed measurement. Historical reconstruction is not advance prediction. AlphaEarth embeddings are not a physical intervention engine. The concept image's favorable hydrograph was illustrative and must not become a programmed scientific result.

## Decision gates

Select pilot after data audit. Select solver after survey/compute/evaluation feasibility. Set alert trade-offs with domain reviewers and evaluate them on held-out data. Record significant changes and reproducibility metadata. Check external rules before release; do not copy archived deadlines as current facts.

## Implemented development defaults — 4 November 2026

- Gandak/Sonpur, Bihar, 25 September–3 October 2024 is the provisional development context. This does not confirm a specific historical flood impact, Nepal event or calibrated case. Independent outcome evidence remains missing.
- Use archived ERA5 sample-cell rainfall and GloFAS modeled discharge as separate historical series. Do not present the ERA5 cell as catchment-averaged forcing or GloFAS as gauged/validated discharge. Issue-time archives were not obtained.
- Use a bounded OSM API extract after Overpass endpoints timed out. Nine current facilities; way positions are mean vertices, not surveyed entrances. Retain only necessary name/amenity tags in the public extract.
- Implement a separate, transparent linear reservoir sensitivity experiment in equivalent mm/h. Zero initial storage, explicit rainfall multiplier/loss/response-time settings. No spatial flood boundary, risk score, probability, structural efficacy or warning threshold is generated.
- Implement local field notes and a deterministic source-linked draft worksheet. No LLM/VLM credentials or team backend were available; do not impersonate AI analysis or notifications.
- Preserve the old application files before replacing the entry UI. New storage uses terrascope-v1 and terrascope-draft; legacy saves remain untouched.
- The current release completes a reviewable software prototype, not the broader scientific validation or competition submission gates.


## Visual history revision — 4 November 2026

User rejected the static resource emphasis, short time window and confusing blue circle. Removed the circle, made ten-year visual history the default, preserved resource review as a secondary workspace. Do not replace the circle with invented inundation geometry. Actual rising/spreading flood visualization is an outstanding separate deliverable requiring observed satellite footprints or validated hydraulic results.
