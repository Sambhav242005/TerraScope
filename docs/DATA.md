# Data sources and feasibility register

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


Status: ERA5/GloFAS snapshots, OSM context/resources and terrain are connected as detailed below. Other entries remain candidate sources; integration is not scientific validation. Check current access, terms, coverage and latency for the selected pilot. No API availability is assumed merely because a portal is public.

## Proposed inputs

| Need | Candidate source | Use and limitation |
| --- | --- | --- |
| Geographic context | [OpenStreetMap](https://www.openstreetmap.org/copyright) | Roads, buildings, waterways and places; coverage varies, not legal ownership or surveyed channel geometry. Preserve attribution. |
| Map hosting | [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/) | Choose compliant provider/self-hosting; public tile servers are not a bulk/offline distribution service. |
| Elevation | [Copernicus DEM GLO-30](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) | Approximately30m surface-elevation product; includes surface objects and is not a surveyed bare-earth/channel model. Check datum, voids and accuracy. |
| Historical precipitation | [NASA GPM IMERG](https://gpm.nasa.gov/data/imerg) | Satellite estimates, approximately0.1-degree grid and half-hourly products; runs differ in latency/corrections. Not building-scale rainfall. |
| Historical meteorology | [ERA5 single levels](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview) | Hourly reanalysis, commonly0.25-degree grid. Reconstruction is not a forecast issued before the event or turbine-scale wind. |
| Land cover | [ESA WorldCover](https://esa-worldcover.org/en/data-access) |10m2020/2021 maps. Check event-date suitability; classifications are not ownership, infiltration measurements or forest-age records. |
| Forecast guidance | [IMD flash-flood guidance](https://hydro.imd.gov.in/national/) | Official guidance and meteorological context. Verify archived issue-time products, coverage and access before hindcast use. |
| River forecasts/observations | [CWC service description](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2238024&lang=1&reg=1) | Seek relevant gauge data, forecast archives and inundation outputs; coverage and permissible reuse must be checked per basin. Benchmark official warnings. |
| Bihar services | [Bihar FMISC](https://fmiscwrdbihar.gov.in/fmis/Default.aspx) | Starting point for local forecast/inundation and basin information; do not assume all records are downloadable. |
| Cadastral records | [NIC Bhu-Naksha](https://bhunaksha.nic.in/bhunaksha/index.jsp), [DILRMP](https://www.dilrmp.gov.in/) | State-specific parcel/record access. Confirm permissions, georeferencing, survey date and relationship to legal records. Not elevation surveys. |
| Nepal event evidence | [DHM September2024 report](https://dhm.gov.np/uploads/dhm/downloads/Situational_Report_on_Extreme_Precipitation_and_Flooding_Event_of_27-29_September_2024.pdf) | Candidate historical context only; user has not confirmed this is the intended disaster. Seek original measurements and issued forecasts. |
| Preparedness guidance | [NDMA flood guidelines](https://www.nidm.gov.in/PDF/guidelines/floods.pdf) | Background guidance; supplement with current local plans, shelter inventories and authority-approved procedures. |

## Essential gaps to resolve locally

River cross-sections/bathymetry; embankment crest and culvert surveys; accurate local terrain benchmarks; soil/infiltration data; operations/release records; independent flood footprints/high-water marks; asset locations and verified shelter capacities. Global datasets alone do not automatically resolve these gaps. Authority contact/access requests require user authorization before messaging.

## Provenance and security

Each dataset needs provider/URL, license/attribution, version/checksum, extent, CRS/vertical datum, units, resolution/accuracy, valid/issue/publication/availability/retrieval times, transformations and missing masks. Distinguish acquisition date from the time a forecast user could access the product. Preserve raw inputs and version processed derivatives.

Do not upload landowner details or field photos to an external AI service without an appropriate consent/access decision. Use only necessary parcel identifiers/geometry in public demonstrations. Restrict sensitive inventories; keep secrets out of frontend bundles.

## Access audit before ingestion

Verify pilot coverage, account/key requirements, permitted downloads/redistribution, cost/rate limits, archives, publication delay and reproducibility. Mark each source usable, restricted, unavailable or unsuitable. Public viewability is not proof of an API or an unrestricted license. Never replace missing measurements silently.

## Other references

- [Embarko challenge](https://embarko.ai/challenge): recheck current rules and hosting before delivery.
- [IIT Indore hackathon](https://mfsos.iiti.ac.in/conclave_hackathon.php): recheck eligibility, dates and track requirements.
- [AlphaEarth announcement](https://deepmind.google/blog/alphaearth-foundations-helps-map-our-planet-in-unprecedented-detail/): possible future classification/change-detection input; not a physical simulation engine.

## Connected development data — 4 November 2026

The following are integrated in the prototype. Candidate sources above remain unconnected unless listed here. Machine-readable query URLs, hashes, processing, units, resolution and caveats: public/data/manifest.json. Refresh script: scripts/refresh-case.py. Original rainfall/discharge JSON are retained without numerical edits.

| Dataset | Actual content | Limitations / terms |
| --- | --- | --- |
| ERA5 via Open-Meteo | 216 hourly precipitation values, 25 Sep–3 Oct 2024, requested 26.5 N / 84.25 E; summed into IST calendar days | Approximately 0.25 degrees. Sample cell, not catchment average. Historical reanalysis, not gauge/issue-time forecast. CC BY 4.0 data; free API non-commercial terms. |
| GloFAS via Open-Meteo | Nine daily modeled discharge values, returned 25.775002 N / 85.125 E | Approximately 5 km / 0.05 degrees; default GloFAS v4 seamless per provider docs, exact upstream run ID not supplied. UTC dates retained. River-cell assignment unverified. No gauge/skill claim. |
| OpenStreetMap | Nine current school/hospital/police amenities from bbox 85.14,25.68,85.19,25.73 | ODbL; attribution visible. Bounded/incomplete extract. Name and amenity tags only in public snapshot. Way positions are mean vertex coordinates, not surveyed entrances. Current records may postdate 2024. |
| OSM raster context | Normal viewport requests to tile.openstreetmap.org | Visible contributor attribution; normal browser caching; no tile bulk extraction, prefetch or offline package. Configure a suitable host for scale. |
| Terrain | Mapzen Terrarium raster DEM from AWS public terrain tiles | Geographic context, exaggeration 1; underlying sources/datum/accuracy vary. No channel survey or parcel precision. Source attribution visible. |

Access verified during development for the three stored datasets. Overpass endpoints timed out; the bounded OSM map API succeeded. Sources:

- https://open-meteo.com/en/docs/historical-weather-api
- https://open-meteo.com/en/docs/flood-api
- https://open-meteo.com/en/terms
- https://www.openstreetmap.org/copyright
- https://operations.osmfoundation.org/policies/tiles/
- https://registry.opendata.aws/terrain-tiles/
- https://github.com/tilezen/joerd/blob/master/docs/attribution.md

Not obtained: cadastral parcels, channel cross-sections, embankment/culvert levels, gauges, archived issue-time forecasts, observed event footprints, surveyed facility capacities and an approved local SOP corpus. No calibrated flood depth, arrival time or exposure intersection is calculated. A review radius is only a search filter. Guidance link is a reference for human review, not a retrieved/approved local plan.



## Visual history revision — 4 November 2026

Added flow-history.json and rain-history.json, requested 2015-01-01–2024-12-31 at the same respective grid cells. Each contains 3,653 daily timestamps, downloaded 4 November 2026. Queries, SHA-256 fingerprints, returned coordinates, model, units and limitations are in public/data/manifest.json. Flow is daily GloFAS m³/s (UTC); rainfall is daily ERA5 precipitation sum in mm (IST). Same licensing/representativeness limits as the original snapshots. No flooded-area measurements were obtained.

## Runtime fetches — candidate storage screening, 4 November 2026

Fetched when a screening run executes (src/flood/storage/), not offline snapshots stored in the repository; retrieval times are recorded per run in the run record, not in public/data/manifest.json. Missing data is an explicit run failure or a disclosed limitation — never treated as zero or as an absence of storage.

| Dataset | Source / retrieval pattern | Format, units, license and limits |
| --- | --- | --- |
| Mapzen Terrain Tiles terrarium DEM | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`, fetched per tile at run time (src/flood/storage/terrainGrid.ts) | Terrarium PNG, 256×256; elevation decoded as (R×256 + G + B/256) − 32768 in metres. Vertical datum: "Terrarium composite (mixed sources; approximately orthometric). Vertical datum alignment to local benchmarks is unverified." Resolution varies by tile zoom — metresPerPixel is recorded per run. Surface model: buildings/vegetation/embankments appear as terrain, rivers/lakes may carry artificial or approximate elevations, no bathymetry. Any missing tile fails the run ("not an absence of storage"). Open data; see the Mapzen attribution page (https://github.com/tilezen/joerd/blob/master/docs/attribution.md) and AWS terrain tiles (https://registry.opendata.aws/terrain-tiles/). |
| OpenStreetMap water polygons | `https://api.openstreetmap.org/api/0.6/map.json?bbox=…`, bounded to the analysis inner box; code refuses queries above 0.2 sq deg (API cap 0.25 sq deg) (src/flood/storage/osmWater.ts) | ODbL; "© OpenStreetMap contributors (ODbL)". Parser exclusions: multipolygon relations and open/incomplete ways are not parsed — skipped counts appear in run provenance and limitations. Fetch failure does not fail the run: candidates report water evidence "unavailable" with a data-gap limitation. Mapped presence only — not a hydrograph, gauge record or ownership evidence. |

## Satellite context ? 5 November 2026

R01/R11/R13: Street/Satellite buttons in each MapView switch raster visibility without recreating that map or changing its camera. Satellite mode hides illustrative scene geometry so it cannot obscure the imagery. Esri World Imagery tiles are requested only for normal viewport display from https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}. Provider attribution and the source/terms link remain visible. This composite imagery has varying acquisition dates and resolution; dates and per-pixel provenance have not been ingested. It is geographic context, not event-aligned flood evidence, survey geometry or a calculation input. No offline redistribution or production hosting/license clearance is claimed. Source metadata: https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=pjson. MapLibre raster/visibility contract: https://maplibre.org/maplibre-style-spec/layers/.

## Connected Indian flood context ? 5 November 2026

R04/R11/R14/R16 (partial): Two bounded NRSC/ISRO Bihar historical inundation-map snapshots are now selectable under Indian evidence in each map's basemap controls. Bbox: 85.05?85.30 E, 25.60?25.85 N. Provider labels: 1 October 2024 10Hr and 2 October 2024 06Hr; timezone and exact acquisition interpretation unverified. WMS source uses the `flood:` workspace prefix and the direct `/bhuvan/wms` endpoint on bhuvan-gp1.nrsc.gov.in, as resolved from the official viewer and client script. Arbitrary viewport requests against GWC failed grid alignment and are not used.

The script `scripts/refresh-nrsc-flood.py` explicitly fetches two 512?512 PNGs with a 25-second timeout and 2 MB response cap each, checks MIME/signature/dimensions, and records URLs, SHA-256, retrieval times, bounds and limitations in `public/data/nrsc/manifest.json`. WMS requests use EPSG:3857 so image-source corners align in the same display projection. Requested display pixel size is not sensor resolution. A successful image is not scientific validation; visible maps were inspected, not used to calculate depth, area, capacity or benefits. Provider watermark retained.

Source: NRSC, ISRO/DOS ? https://www.nrsc.gov.in. Official selector: https://bhuvan-app1.nrsc.gov.in/disaster/usrtasks/flood/flood.php?uname=empty. Client request conventions: https://bhuvan-app1.nrsc.gov.in/disaster/usrtasks/flood/js/v16.js. Terms: https://www.nrsc.gov.in/nrscnew/termsConditions.php. Attributed non-commercial development snapshots only; no commercial/offline tile rights or production deployment clearance claimed.

The observation date remains explicit and independent of historical discharge replay. Unmarked pixels, transparent areas and areas outside the snapshot are unknown, not dry or safe. Permanent-water handling, sensor/native resolution, detection error, masks and publication latency remain unverified. Two other inspected date/hour requests returned only the provider watermark and were excluded; absence of colored pixels was not interpreted as no flood. No temporal interpolation or flood animation is derived from these images.

CartoDEM download still requires the documented login flow; no authenticated tile was acquired. SISDP capabilities partially arrived before timeout and advertised DRAIN_PHASE_II bounds away from Sonpur; this is not verified drainage coverage for the pilot. No blockage, bathymetry, culvert or available-storage evidence is inferred. Existing Mapzen/OSM/Esri inputs remain identified by their actual sources; they were not relabeled as Indian data.

## Derived placement-screening evidence ? 5 November 2026

`public/data/placement-evidence.json` derives bounded OSM channel/water/road/building geometry from the archived OSM XML and map-color cells from two pinned NRSC historical display PNGs. Source URLs, retrieval dates, SHA-256, geographic coverage and limitations are retained per source; processing and exact color/projection caveats are in docs/PLACEMENT_VALIDATION.md. No DEM depression is classified as an observed flood. Positive map-color overlap is only a dated screening warning; unmarked pixels remain unknown. No new drainage survey, elevation survey, soil, foundation, outlet or engineering suitability data has been obtained.

Mapped-water candidate overlap counting was corrected to count unique candidate cells rather than features (waterEvidenceVersion=2). Legacy numeric overlap metrics are invalidated without removing terrain geometry or mapped-presence records. This does not determine available storm storage.


## Collision prevention and area search ? 5 November 2026

Partial R01/R03/R06/R11/R13/R15/R16: new conflicting placements are rejected; conflicting/unchecked saved models are hidden without deleting proposals. Other-proposal envelopes and the illustrative rotor span are checked. Submitted place search and coordinate/map area selection move the camera and fetch bounded OSM constraints for supported new areas, with failed/loading/outside coverage blocking placement. Selected areas persist. Sonpur historical/scientific inputs are explicitly not relocated. Evidence, access limits and remaining gaps: docs/AREA_SEARCH_COLLISIONS.md. No requirement is cancelled or fully completed by this slice.
