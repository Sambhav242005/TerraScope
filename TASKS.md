# Current status

> Current status (14 November 2026): [Latest delivery, verification and remaining gaps](docs/CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R08, R10, R15 and R16 delivered 14 November 2026; the other requirements remain active.


## Automatic planning — latest product contract

The system proactively discovers/refreshes supported data, generates candidate placements and evaluates scenarios after region/objective selection; repeated manual prompting is not the intended workflow. See docs/PRODUCT_AUTONOMY.md for end-user jobs and automatic/manual ownership, and docs/AGENT_HARNESS.md for local agent roles, durable execution and verification. These extend the scope to R01–R18 and supersede manual-first assumptions below. Architecture is documented; autonomous services and model integrations are not implemented. Development must proactively research prerequisites and judge changes against the final user journey.

## Active scope — 4 November 2026

Read docs/REQUIREMENTS.md R01–R14 and the top of TODO.md. The requested product is one persistent world with filters, local AI research/planning, water-storage candidate search, supported flood depths, intervention placement, renewable environmental effects and ENSO context. Existing tabbed review/history UI is incomplete against this scope. No local LLM or spatial flood solver is connected. MISTAKE.md records the scope drift and prevention checks. Older prototype completion notes below apply only to their stated features.

The TerraScope software prototype is implemented. The authoritative research and delivery backlog remains TODO.md.

Implemented: OSM map/terrain, nine real mapped amenities, ERA5/GloFAS historical snapshots, replay/table, explicit illustrative runoff comparison, local field checks, source-linked template draft, persistence and exports.

Verified: build; six flood-specific tests plus eight preserved legacy tests; browser journey, 360px viewport, missing-data/WebGL fallback and saved-state recovery. Evidence: docs/DELIVERY.md and artifacts/flood-browser-report.json.

Pending: final scientific case selection, channel/cadastral surveys, observed outcomes, calibrated inundation/forecast validation, LLM/VLM provider, team backend, physical-phone test, domain review and authorized competition deployment/submission.


## Visual history revision — 4 November 2026

River history added: 2015–2024, 3,653 daily records, 120 monthly peak tiles, synchronized replay and CSV export. Search circle removed. Nine history-browser checks and the original thirteen workflow checks pass against the production preview. Actual spatial flood spread remains unimplemented, not represented by the flow column.

## Candidate storage screening — 4 November 2026

Candidate natural water-storage screening (terrain depressions from Mapzen terrarium DEM + OSM mapped-water evidence) enabled end-to-end in the Explore/3D workspace with auto-run on area selection; unit tests and build verified; see docs/NATURAL_STORAGE.md.
