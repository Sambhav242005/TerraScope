# Real-world 3D and flood simulation research

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


Research date: 4 November 2026. Status: source-based feasibility assessment, not an implemented solver or a performance benchmark. Context7 was unavailable; official project and provider documentation was consulted instead.

## Product correction

The user wants an understandable, interactive environmental simulation in a dimensional real-world scene. Review queues and preparedness-draft panels are no longer the requested core experience. Removing those entry points remains implementation work; this research does not claim their removal. Preserve existing saved records when retiring their UI.

The central interaction should be: choose a bounded reach and event, change explicit rainfall/upstream-flow assumptions, calculate water spreading, play the result, inspect local modeled depth, and compare with the baseline. Later add terrain/storage/roughness interventions only when the solver and data support them.

## What area-to-3D tools actually provide

| Tool | Verified capability | Fit and constraint |
| --- | --- | --- |
| [OSM2World](https://osm2world.org/) | Converts OSM into 3D models; glTF/GLB/OBJ exports, multiple detail levels and web/desktop options | Strong candidate for a bounded, editable OSM-derived scene. Completeness and measured heights still depend on source data. Generated roofs/materials are not survey evidence. |
| [F4map](https://demo.f4map.com/) | Interactive OSM-based 3D viewer | Useful visual reference and coverage inspection. A public demo does not establish permission to copy its renderer or assets. |
| [Streets GL](https://github.com/StrandedKitty/streets-gl) | OpenStreetMap renderer using WebGL2 | Useful implementation/reference candidate for richer OSM scenes. No local integration, license audit or device benchmark performed here. |
| [Cesium content](https://cesium.com/platform/cesium-ion/content/) | Terrain, imagery, OSM buildings and partner photorealistic datasets; compatible with CesiumJS and other renderers | Candidate for geographic streaming and combining independent simulation outputs. Hosted content requires an account and applicable terms; source accuracy varies by location. |
| [Google Photorealistic 3D Tiles](https://mapsplatform.google.com/maps-products/map-tiles/) | Textured real-world meshes using the same 3D map source as Google Earth | Strong visual option where covered. Detailed Sonpur coverage has NOT been verified. Billing, attribution and content restrictions apply. |
| [Blosm](https://github.com/vvoovv/blosm) | Blender importer for terrain, OSM and Google 3D cities | Asset-preparation workflow, not a browser flood solver. Import capability does not override source-data reuse terms. |
| [OpenDroneMap](https://www.opendronemap.org/odm/) | Produces georeferenced maps and 3D models from camera imagery; accepts ground control | Route to a locally captured scene if appropriate imagery is obtained. Does not generate measured geometry from a place name alone. |

Google's [coverage documentation](https://developers.google.com/maps/documentation/javascript/3d/coverage) explicitly limits detailed surface data to highlighted coverage. A global map is not global detailed photogrammetry. Its [Map Tiles policies](https://developers.google.com/maps/documentation/tile/policies) restrict caching/storage and non-visualization use. Keep independently licensed hydraulic inputs separate; do not assume rendered Google geometry can be extracted as simulation terrain.

## Local evidence and data gaps

Current local scene contains 27 OSM building footprints with illustrative 6 m heights, plus decorative trees. These are disclosed in src/flood/WorldMap.tsx; they are not measured buildings. Current water footprints are static. The ten-year GloFAS discharge series and ERA5 rainfall series do not supply a spatial water-depth field.

[Copernicus DEM](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) offers global 30 m and 90 m surface models. Surface elevations include buildings/vegetation and are distinct from bare-earth terrain. They cannot resolve every local drain, embankment crest or channel cross-section. Vertical datum alignment and independent channel/structure information remain necessary before fine-scale depth claims.

Useful local sources discovered:

- [Bhuvan Ganga](https://bhuvan-app1.nrsc.gov.in/mowr_ganga/) lists annual and historical flood layers for Bihar and Uttar Pradesh. These are candidates for historical comparison, not a connected depth API. Download/API access, event coverage and reuse terms remain to be checked.
- [NRSC flood-hazard atlas information](https://www.nrsc.gov.in/nrscnew/resources_atlas_FloodHazard_Zonation.php) describes satellite-based Bihar hazard mapping. A multiyear hazard atlas is not the observed footprint of our specific 2024 event.
- [Bihar FMISC](https://www.fmiscwrdbihar.gov.in/fmis/) provides entry points for water-level forecasts and inundation maps. [BEAMS](https://beams.fmiscwrdbihar.gov.in/Alerttotalinfo/Floodforecasttotal.aspx) lists station information including Gandak sites. Archive access, units/datum, publication times, suitability for Sonpur and reuse permissions need verification.

No exact Nepal event has been confirmed. Do not claim prediction skill using post-event rainfall, satellite footprints or corrected reanalysis as if they were available in advance.

## Recommended architecture and first meaningful feature

Recommendation, not a completed selection: evaluate a small OSM2World-derived scene against a Cesium terrain/building scene on the same pilot bounds. Keep OSM as geographic context. Choose based on local coverage, scene legibility, licensing and measured phone performance, rather than global demo imagery.

Use an established hydraulic engine separately. [Deltares SFINCS](https://www.deltares.nl/en/software-and-data/products/sfincs) supports riverine and rainfall-driven flooding and is an appropriate candidate for an initial benchmark. The source is GPLv3; packaged Windows executables have separate freeware terms. A supported model family is not evidence of accuracy for our reach. Domain setup and validation are still required.

Proposed data flow: independent terrain/channel data + rainfall + upstream flow + downstream boundary + roughness/infiltration -> versioned solver run -> timestamped depth/extent outputs -> 3D playback and asset intersections. Do not use the current illustrative reservoir equation to fabricate inundation polygons.

Start with precomputed, explicitly selectable scenarios. Playback is immediate; changing arbitrary parameters requires a new run and must show pending/failed states honestly. Run computation locally or on a backend, while the phone streams bounded geometry and result frames. Account for downstream backwater at a river confluence, rather than estimating local flooding solely from local rainfall.

Visible interaction:

1. Select an event from multiyear history, then view its hourly or otherwise solver-supported timeline.
2. Pick a rainfall/river boundary scenario and run it.
3. Play rising, spreading and receding modeled water; use depth colors and a legend in metres.
4. Select a location to inspect its time series, input provenance and missing-data status.
5. Compare baseline and changed scenario with the same camera, timestamp and color scale. Highlight both improvements and worsening elsewhere.

No numerical depth, arrival time, protected-building count or benefit should appear until calculated from the versioned model. Data availability determines the supported resolution.

## Execution gates

- [ ] Retire Field checks/Response plan navigation and review-centric panels without deleting saved records.
- [ ] Audit one bounded reach: terrain, channel, structures, vertical datum, rainfall/flow boundaries and independent observed inundation. Do not silently substitute a visually richer location for the user's pilot.
- [ ] Compare the two scene approaches using the same real input extent; label unknown/generated heights. Verify data licenses and service terms.
- [ ] Run an established solver benchmark before the real reach. Test wetting/drying, conservation or solver diagnostics, reproducibility and failures.
- [ ] Produce a traceable historical run and compare against independent observations. Report disagreement and missing coverage.
- [ ] Connect actual depth/extent frames to playback; preserve missing masks, units, timestamps and model version.
- [ ] Add one supported scenario comparison. Do not claim forecasts or intervention efficacy from a reconstruction alone.
- [ ] Test keyboard, pause, reduced motion, non-3D output and 360 px layout; record physical phone model, browser, loading and frame timing. No mobile performance measurements were made in this research.

This research establishes viable building blocks and major data gaps. No external deployment, new provider account, paid service, solver integration or scientific validation was performed.
