# TerraScope — flood preparedness workspace

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](docs/CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


A working map-first prototype for historical environmental data, resource review and human-reviewed preparation. The development case is Gandak/Sonpur, Bihar, 25 September–3 October 2024.

## Run

```sh
npm install
npm run dev
npm run build
npm run preview -- --port 4173
```

Development: http://127.0.0.1:5173/ · Production preview: http://127.0.0.1:4173/

## Try the complete journey

1. Explore the OpenStreetMap map and the nine mapped facilities. Change the review radius or enter coordinates.
2. Play/pause the nine-day rainfall/discharge replay; inspect the table and download CSV.
3. Open Compare, change explicit assumptions and run the illustrative runoff experiment.
4. Select a resource, assign a reviewer and save an observation. Mark it locally reviewed after your review.
5. Open Response plan, generate/edit the worksheet and export it. This is a local template, not an LLM.

Workspace settings, local resources/checks and edited drafts persist on the same device. JSON workspace export is a record/backup; import and shared-team synchronization are not implemented. No external team is contacted.

## What the prototype does not establish

The blue map area is a review radius, not inundation. ERA5 rainfall is a sample-cell reanalysis estimate; GloFAS is historical modeled discharge, not a verified gauge or an advance forecast. The comparison is an uncalibrated linear-reservoir illustration in mm/h, disconnected from flood boundaries. Surveyed geometry, land records, independent outcome validation, real-time predictions and LLM/VLM services remain unconnected.

## Verify

```sh
npm test
node tests/flood-check.mjs
```

Browser checks use installed Microsoft Edge and default to port 5173; set DEMO_URL for another local server. Six flood-specific unit tests and thirteen browser checks are recorded. Eight preserved legacy ecology tests are separate and are not scientific flood validation. Physical-phone performance remains unmeasured.

## Data and deployment

Historical snapshots and query hashes are bundled in public/data. OSM/terrain tiles require internet. Refresh bounded data explicitly with `python scripts/refresh-case.py`; review changed hashes and records before release. VITE_OSM_TILES can specify a compliant alternative raster tile service, but its attribution must also be updated in MapView.tsx. Never place secrets in browser environment variables. Public OSM tiles are not an offline/bulk download service. The free Open-Meteo API is for non-commercial use; review terms for other deployment uses.

No external deployment or competition submission was performed. The existing game source is preserved under docs/archive/living-valley/source and its old save keys remain untouched.

## Documentation

- [Delivery evidence and limits](docs/DELIVERY.md)
- [Project](PROJECT.md), [design](DESIGN.md), [specification](SPEC.md)
- [Authoritative TODO](TODO.md), [status](TASKS.md), [decisions](DECISION.md), [lessons](MISTAKE.md)
- [Data provenance](docs/DATA.md), [scientific validation](docs/VALIDATION.md), [renewables research](docs/RESEARCH.md)


## Visual history revision — 4 November 2026

Start on River history to explore 2015–2024 (3,653 daily records). Pick a year, click a monthly peak tile or scrub/play the daily graph. Export the complete ten-year CSV. Explore opens the existing resource-review workspace. Run `node tests/history-check.mjs` against preview port 4173 for the new visual journey. The blue search circle has been removed; no actual flood extent or water depth is currently displayed.

## GitHub setup
See [GitHub preparation](docs/GITHUB_SETUP.md) for a fresh-clone workflow and initial publication commands. Local build outputs, dependencies, recordings and secrets are excluded by .gitignore.
