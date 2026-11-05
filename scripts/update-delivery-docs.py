from pathlib import Path
p=Path('src/App.tsx');s=p.read_text(encoding='utf-8').replace('retrieved:string;status:string','retrieved:string;status:string;units?:string;resolution?:string;timezone?:string;model?:string;uncertainty?:string')
s=s.replace('<small>Retrieved {m.retrieved}', '<small>{m.model}<br/>{m.units} · {m.resolution}<br/>Time reference: {m.timezone}</small><small>Retrieved {m.retrieved}')
p.write_text(s,encoding='utf-8')
p=Path('tests/flood-check.mjs');s=p.read_text(encoding='utf-8').replace("const browser=", "const base=process.env.DEMO_URL??'http://127.0.0.1:5173';\nconst browser=").replace("goto('http://127.0.0.1:5173')",'goto(base)');p.write_text(s,encoding='utf-8')
# Correct stale implementation claims while preserving future scientific requirements.
p=Path('AGENTS.md');s=p.read_text(encoding='utf-8').replace('Pilot selection is pending.','Gandak/Sonpur, Bihar, 25 September–3 October 2024 is the provisional development case; final scientific pilot approval is pending.').replace('Existing code remains the fictional Glasswing game. Do not describe it as real hydrology.','The active UI is the TerraScope historical-data and resource-review prototype. It includes real ERA5/GloFAS snapshots, OSM context and a clearly illustrative linear-reservoir experiment. It is not validated hydrology or an operational forecast. Legacy game source is preserved in docs/archive/living-valley/source. Read docs/DELIVERY.md for implementation evidence and missing integrations.');p.write_text(s,encoding='utf-8')
p=Path('PROJECT.md');s=p.read_text(encoding='utf-8');start=s.index('The repository still runs');end=s.index('\n\nThe generated',start);s=s[:start]+'''The active application is now TerraScope: a map-first historical-data replay and preparedness workspace. Gandak/Sonpur, Bihar (25 September–3 October 2024) is the provisional development case. Nine current OSM amenities, ERA5 hourly rainfall and GloFAS daily modeled discharge are bundled with query URLs and hashes. Users can inspect resources, record local checks, compare explicit illustrative runoff assumptions, edit a source-linked checklist and export data/workspace records. Changes persist locally.

This is a functional screening/workflow prototype, not a validated inundation simulation or historical forecast-skill demonstration. No surveys, cadastral records, forecast archives, LLM/VLM provider, team backend or independent event labels are connected. Source details and testing evidence are in docs/DELIVERY.md and docs/DATA.md.''' +s[end:];s=s.replace('Open: pilot district/river, exact event/date,','Open: final scientific pilot/event approval,');p.write_text(s,encoding='utf-8')
p=Path('SPEC.md');s=p.read_text(encoding='utf-8').replace('Status: proposed target, not existing functionality. The current source remains the fictional valley.','Status: a bounded TerraScope prototype is implemented; the full scientific contracts below remain the target. Implemented records are in src/flood/model.ts; query provenance is in public/data/manifest.json. See docs/DELIVERY.md for actual coverage.').replace('These contracts are not yet implemented.','Partial contracts are implemented: versioned local workspace, OSM assets, reviewer/note/status records, hourly illustrative reservoir results and source manifest. Full survey/forecast/validation contracts and team evidence history remain pending.');p.write_text(s,encoding='utf-8')
p=Path('DESIGN.md');s=p.read_text(encoding='utf-8').replace('Mobile: one bottom sheet at a time, touch-sized actions, a2D default/fallback when appropriate.','Implemented mobile: stacked map, active workspace panel and timeline, with collapsible layers, touch controls and non-map coordinate/resource/table access. A dedicated bottom sheet and adaptive 2D default remain possible refinements.');s+='\n## Implemented prototype (4 November 2026)\n\nForest-green/off-white map workspace; Explore, Compare, Field checks and Response plan panels; nine-day replay; true OSM tiles and optional Mapzen terrain. The dashed blue circle is explicitly a user-defined review radius, never flood extent. Scenario results appear only after Run comparison. See artifacts/terrascope-desktop.png and artifacts/terrascope-mobile.png for actual application captures.\n';p.write_text(s,encoding='utf-8')
p=Path('DECISION.md');s=p.read_text(encoding='utf-8');s+='''
## Implemented development defaults — 4 November 2026

- Gandak/Sonpur, Bihar, 25 September–3 October 2024 is the provisional development context. This does not confirm a specific historical flood impact, Nepal event or calibrated case. Independent outcome evidence remains missing.
- Use archived ERA5 sample-cell rainfall and GloFAS modeled discharge as separate historical series. Do not present the ERA5 cell as catchment-averaged forcing or GloFAS as gauged/validated discharge. Issue-time archives were not obtained.
- Use a bounded OSM API extract after Overpass endpoints timed out. Nine current facilities; way positions are mean vertices, not surveyed entrances. Retain only necessary name/amenity tags in the public extract.
- Implement a separate, transparent linear reservoir sensitivity experiment in equivalent mm/h. Zero initial storage, explicit rainfall multiplier/loss/response-time settings. No spatial flood boundary, risk score, probability, structural efficacy or warning threshold is generated.
- Implement local field notes and a deterministic source-linked draft worksheet. No LLM/VLM credentials or team backend were available; do not impersonate AI analysis or notifications.
- Preserve the old application files before replacing the entry UI. New storage uses terrascope-v1 and terrascope-draft; legacy saves remain untouched.
- The current release completes a reviewable software prototype, not the broader scientific validation or competition submission gates.
''';p.write_text(s,encoding='utf-8')
p=Path('MISTAKE.md');s=p.read_text(encoding='utf-8');s+='''
## Findings during this implementation

- A successful basemap render did not mean the GeoJSON overlay worked: MapLibre 6 requires Vite's bundled worker URL. Fixed and checked in the browser.
- Empty SVG paths caused console errors before data loaded. Empty series now render without an invalid path.
- The mobile layers panel initially overlapped the legend; map spacing was increased and the viewport retested.
- Multiple Overpass queries failed. Bounded OSM API extraction succeeded; missing service responses were never replaced with fictional facilities.
- Browser automation found persistence, fallback and interaction issues that screenshots alone cannot establish. The workflow is exercised sequentially and recorded to video, while physical-phone testing remains open.
''';p.write_text(s,encoding='utf-8')
p=Path('TODO.md');s=p.read_text(encoding='utf-8').replace('All implementation items below are pending.','The bounded software prototype is implemented (see docs/DELIVERY.md). The broader research/operational items below remain pending unless explicitly checked.');s=s.replace('- [ ] **Preserve the old application.**','- [x] **Preserve the old application.**');s+='''
## Completed prototype evidence — 4 November 2026

- [x] Bounded historical-data view with OSM basemap, terrain option, nine facility records, source cards, time selection and CSV table export. Evidence: public/data/manifest.json; tests/flood-check.mjs.
- [x] Pure illustrative reservoir calculation with explicit assumptions, missing-data rejection, deterministic outputs, conservation checks and export. Evidence: tests/flood-model.test.js (six tests). This does not complete the calibrated modeling/evaluation gates above.
- [x] Local resource selection/addition, reviewer assignment, notes, queue/evidence/review status, saved-state recovery and draft editing/export. Local template only; no LLM/VLM or external team dispatch.
- [x] Main browser journey at desktop and 360px, replay pause, focus return, corrupted save, missing rainfall and WebGL fallback checked. Evidence: artifacts/flood-browser-report.json. Physical phone and domain review remain unchecked.
- [ ] Replace provisional data context with a scientifically reviewed event, surveyed geometry, observed outcomes, approved solver/evaluation and real forecast archives.
- [ ] Configure an authorized LLM/VLM provider, reviewed guidance retrieval and a team evidence backend before describing those capabilities as implemented.
''';p.write_text(s,encoding='utf-8')
p=Path('TASKS.md');p.write_text('''# Current status

The TerraScope software prototype is implemented. The authoritative research and delivery backlog remains TODO.md.

Implemented: OSM map/terrain, nine real mapped amenities, ERA5/GloFAS historical snapshots, replay/table, explicit illustrative runoff comparison, local field checks, source-linked template draft, persistence and exports.

Verified: build; six flood-specific tests plus eight preserved legacy tests; browser journey, 360px viewport, missing-data/WebGL fallback and saved-state recovery. Evidence: docs/DELIVERY.md and artifacts/flood-browser-report.json.

Pending: final scientific case selection, channel/cadastral surveys, observed outcomes, calibrated inundation/forecast validation, LLM/VLM provider, team backend, physical-phone test, domain review and authorized competition deployment/submission.
''',encoding='utf-8')
