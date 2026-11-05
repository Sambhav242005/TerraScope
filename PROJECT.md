# Project — Environmental scenario and flood preparedness

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](docs/CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


## Automatic planning — latest product contract

The system proactively discovers/refreshes supported data, generates candidate placements and evaluates scenarios after region/objective selection; repeated manual prompting is not the intended workflow. See docs/PRODUCT_AUTONOMY.md for end-user jobs and automatic/manual ownership, and docs/AGENT_HARNESS.md for local agent roles, durable execution and verification. These extend the scope to R01–R18 and supersede manual-first assumptions below. Architecture is documented; autonomous services and model integrations are not implemented. Development must proactively research prerequisites and judge changes against the final user journey.

## Active scope correction — 4 November 2026

Build a single-view local-AI-assisted environmental planning simulator: research sources, find candidate water-storage areas, calculate heavy-rainfall/river impacts and water rise, place storage/solar/wind/vegetation interventions, compare supported effects and include ENSO context. OSM remains geographic context. [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md), R01–R14, is the confirmed scope register.

This supersedes review-centric product descriptions below. Local AI, placement, spatial flood calculations and ENSO integration are not implemented. The attached renewable research scope remains active. Staged delivery must not silently cancel requirements.


## Current direction

Build an interactive real-data workspace to explore environmental change, identify potentially exposed resources, verify conditions locally and prepare evidence-linked actions for human review. OpenStreetMap is the confirmed map-context source. TerraScope is a provisional concept name, not an approved repository rename.

The key question: given rainfall forecasts and current catchment/river conditions, what could be affected, how soon, and what should be verified or prepared?

## Actual implementation status

The active application is now TerraScope: a map-first historical-data replay and preparedness workspace. Gandak/Sonpur, Bihar (25 September–3 October 2024) is the provisional development case. Nine current OSM amenities, ERA5 hourly rainfall and GloFAS daily modeled discharge are bundled with query URLs and hashes. Users can inspect resources, record local checks, compare explicit illustrative runoff assumptions, edit a source-linked checklist and export data/workspace records. Changes persist locally.

This is a functional screening/workflow prototype, not a validated inundation simulation or historical forecast-skill demonstration. No surveys, cadastral records, forecast archives, LLM/VLM provider, team backend or independent event labels are connected. Source details and testing evidence are in docs/DELIVERY.md and docs/DATA.md.

The generated environmental concept image has illustrative terrain and charts. Its lower proposed hydrograph is not a calculated benefit and must not become a target outcome.

## Proposed first delivery

One real watershed/river reach, a small set of settlements and one documented historical flood. Display OSM context with independent terrain, rainfall, land cover, river observations and verified assets. Provide provenance, historical playback, baseline comparison, asset inspection, a field-verification queue and an evidence-linked draft preparedness plan.

An exact Nepal event remains unresolved. Bihar or Uttar Pradesh is a candidate recurring-flood pilot. Choose one initial case based on data/survey availability, independent event observations and reviewer access. These are candidates, not an instruction to build all regions.

If archived forecasts issued before the event cannot be obtained, deliver historical reconstruction and label it accordingly. Precise inundation depths require suitable surveys and validated hydraulics; coarse screening must be labeled as screening.

## Parallel research track

Preserve the user's solar/wind research question: how energy extraction, albedo, roughness and heat redistribution affect local environments and potentially larger-scale climate. Verify literature and distinguish observations from simulations and speculation. This is separate from the initial flood product and must not supply unsupported rainfall-control assumptions.

## Competition positioning

Embarko: polished, original, mobile-friendly end-to-end demonstration with honest limitations and a clear deployment story. IIT Indore: potential Theme B research entry if predictive evaluation is demonstrated. Check current eligibility, dates, hosting capabilities and submission requirements before acting. Links are in docs/DATA.md. No deployment, public alerts or submission is authorized by this documentation task.

## Exclusions and unresolved choices

Exclude nationwide/global operational forecasting, arbitrary cloud trapping, automatic evacuation orders, certified engineering advice, complete cadastral coverage and validated global renewable-energy feedbacks from the first release. Wildlife gameplay and Quantum/4D are superseded.

Open: final scientific pilot/event approval, survey and gauge access, reviewer availability, solver, compute/API budget, hosting architecture and final name. TODO.md defines execution gates.


## Visual history revision — 4 November 2026

The default entry is now River history: 2015–2024 daily ERA5/GloFAS estimates (3,653 days), a year selector, synchronized daily flow visualization and 120-month comparison grid. The resource map retains the nine-day event-detail window. The search circle is removed entirely. Actual flood extent/depth visualization remains pending observed footprints or validated hydraulic outputs.

## Candidate storage screening — 4 November 2026

Candidate natural water-storage screening (terrain depressions from Mapzen terrarium DEM + OSM mapped-water evidence) enabled end-to-end in the Explore/3D workspace with auto-run on area selection; unit tests and build verified; see docs/NATURAL_STORAGE.md.
