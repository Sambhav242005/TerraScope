# Lessons and mistakes to avoid

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](docs/CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


## Scope failures acknowledged — 4 November 2026

- I still designed a prompt-by-prompt assistant after the user asked for automatic planning. Correction: region/objective selection triggers supported discovery, candidate generation and analysis; manual steps are overrides or real access boundaries.
- I relied on the developer/user to identify every missing feature and source. Correction: proactively research dependencies and evaluate the complete user job; record data versus connector versus model versus UX gaps.
- I described agents without specifying their execution environment. Correction: local inference plus persisted jobs, budgets, recovery, scoped tools and independent checks are required; documentation is not a running harness.

These are mistakes in our work, not requests for the user to simplify their goal.

- I narrowed the environmental simulator to flood-map presentation and review forms, losing local AI, storage search, placement, renewable effects and global context. Correction: track R01–R14 in docs/REQUIREMENTS.md on every implementation pass.
- I substituted my own one-time research for the product's local research agent. Correction: demonstrate actual local inference, cited retrieval, spatial tool calls and result-backed plans; templates do not count.
- I split a continuous job across work tabs. Correction: one persistent world with filters, contextual panels, placement controls and shared scenario/time state.
- I polished and tilted the map before delivering environmental calculations. Correction: candidate storage search and supported water-depth results take priority over cosmetic changes.
- I left the renewable research brief and solar/wind placement disconnected from active delivery. Correction: retain their scope explicitly; unsupported effects remain pending rather than quietly disappearing.
- I failed to capture global context. The user has confirmed El Niño / La Niña (ENSO). Correction: source dated regional/seasonal context without inventing a fixed rainfall multiplier.
- I appended corrections while old headings still described review as the active product. Correction: current scope must appear at the top of project documents; conflicting older sections are historical.
- I did not make missing core capabilities clear enough. Correction: distinguish documented, prototyped, connected, calculated, validated and device-tested.

Before changes: read docs/REQUIREMENTS.md, identify affected IDs and preserve all other requirements. After changes: record evidence and missing dependencies. Never silently substitute cloud inference for local AI or an animation for a calculated result.


1. Building before agreeing on purpose. The functional wildlife prototype did not meet the desired environmental-planning experience. Select a scientific question and case before adding scope.
2. Mistaking visual polish for validity. Generated terrain and charts are not data. The mockup's lower flood-flow curve incorrectly suggested a proven benefit.
3. Confusing rainfall, discharge, river stage and inundation. Give each correct units, time interpretation and datum.
4. Treating real input data as proof of predictive accuracy. Calibration, independent evaluation and uncertainty still matter.
5. Using future information in a claimed forecast. Realized rainfall, post-event imagery, later corrections and test labels must not leak across the cutoff.
6. Applying a universal rainfall threshold. Upstream rainfall, wetness, stage, channel capacity, drainage and backwater change outcomes.
7. Treating cadastral maps as topographic/channel surveys. Legal boundaries and elevations are different. OSM is not ownership evidence.
8. Hard-coding benefits. Forests do not always prevent floods; solar does not universally cool air. Context and scale matter.
9. Equating turbine wakes with cloud trapping. Local effects do not establish controllable regional rainfall.
10. Rewarding warnings everywhere. Weight severe missed events more heavily while measuring false alarms, lead time and operational burden.
11. Letting AI invent capacities, safe routes, contacts or engineering judgments. Cite evidence; preserve unknowns; require review.
12. Treating one field visit as full validation. Observations have location/time/measurement uncertainty and limited coverage.
13. Calling desktop viewport emulation a phone test. Record actual device conditions and review temporal behavior in videos.
14. Building a global system before validating one case. Data access, surveys and independent outcomes are the first constraints.
15. Reusing legacy tests as flood-model evidence. Old ecology/terrain tests validate only the old application.
16. Confusing AI drafts with official warnings. Human/authority decisions remain outside autonomous prototype actions.

Historical graphics and implementation lessons remain in docs/archive/living-valley/MISTAKE.md. They are not scientific evidence.

## Findings during this implementation

- A successful basemap render did not mean the GeoJSON overlay worked: MapLibre 6 requires Vite's bundled worker URL. Fixed and checked in the browser.
- Empty SVG paths caused console errors before data loaded. Empty series now render without an invalid path.
- The mobile layers panel initially overlapped the legend; map spacing was increased and the viewport retested.
- Multiple Overpass queries failed. Bounded OSM API extraction succeeded; missing service responses were never replaced with fictional facilities.
- Browser automation found persistence, fallback and interaction issues that screenshots alone cannot establish. The workflow is exercised sequentially and recorded to video, while physical-phone testing remains open.


## Visual history revision — 4 November 2026

A resource-search circle looked like a hazard footprint even with a label. Removed it rather than trying to explain it better. A nine-day detail window is not adequate long-term environmental context; added ten complete years. Visualizing discharge is useful but does not fulfill the still-open requirement to show which land floods.

## Placement-review correction ? 5 November 2026

Unvalidated pins were called simulated retention and a static summary was branded local AI. Corrected those claims, made missing screening results unknown and added automatic source-linked overlap warnings. The turquoise DEM depression overlay must not be described as historical inundation; observed provider maps and terrain screening are different inputs. Absence of mapped overlap never clears a site. Reference/scenario runoff runs must share rainfall before discussing parameter effects; pins remain excluded until a supported adapter is implemented.


Warning-only placement checks still drew panels through buildings. New proposals now reject known conflicts before insertion; conflicting saved models are hidden but retained for correction. A searched region must not relabel Sonpur historical data as local evidence.
