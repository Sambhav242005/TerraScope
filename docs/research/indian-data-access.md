# Indian data access audit: Bhuvan / NRSC

Audit date: 5 November 2026 IST (network tests occurred 4 November, approximately 19:34–19:36 UTC). Research evidence only; no application integration or requirement completion is claimed. Scope: R03, R04, R11 and R16. No accounts, purchases or external messages were used. Context7 was unavailable in the parent task; API facts below come from official NRSC pages and direct responses.

## Assessment

Bhuvan is a useful Indian evidence source, but its viewers are not interchangeable with downloadable scientific inputs. CartoDEM is a surface model, not bathymetry. SISDP drainage is remotely sensed mapped context, not an observation of current culvert blockage. Flood observations, aggregate historical footprints and experimental low-lying-area products must remain distinct. A successful HTTP response is not proof of scientific coverage, redistribution permission or browser compatibility.

## Dataset and access register

### CartoDEM elevation

The official [CartoDEM evaluation report, September 2011, version 1](https://bhuvan-app3.nrsc.gov.in/data/download/tools/document/CartoDEMReadme_v1_u1_23082011.pdf), pp. 4, 16–18, describes Cartosat-1 PAN stereo, a land-surface model, geographic GeoTIFF, signed 16-bit elevations in metres, undefined value −999, WGS84 ellipsoidal heights, and 1/3, 1 and 3 arc-second postings (approximately 10, 30 and 90 m at the equator). It reports 8 m LE90 vertical accuracy and warns of matching/interpolation and mosaic artifacts. Its original product tiles are 7.5 arc minutes. These are **version-1 documentation**, not verified metadata for a newly downloaded V3 R1 tile.

The official [FAQ](https://bhuvan.nrsc.gov.in/wiki/index.php/Frequently_Asked_Questions) identifies the public one-arc-second product as approximately 30 m. [Bhuvan's handbook](https://bhuvan-app1.nrsc.gov.in/2dresources/documents/1_Bhuvan_User_Handbook.pdf), physiographical-base section, separately describes 30 m DSM dissemination and 1° tiles. Resolve version/tile differences from actual delivered metadata; do not copy the older tile size or vertical reference into every version.

Entry point: [Open Data Archive / NOEDA](https://bhuvan-app3.nrsc.gov.in/data/download/index.php). Official [download instructions](https://bhuvan-app3.nrsc.gov.in/data/download/help/source/html/steps_to_download_data.htm) require login for tile download, offer tile metadata and document a ten-tile/day Cartosat DEM limit. Treat that documented quota as subject to confirmation, not a tested current allowance. No authenticated download or V3 R1 inventory was tested. No raw-elevation WCS, public COG or machine-download API was established.

TerraScope implication: regional screening is plausible, but small berms, outlets and shallow storage can be below grid/error scales. DSM is not bare-earth survey or submerged bed elevation. Do not infer lake capacity from water-surface pixels. Check the actual product's vertical reference and any geoid transformation before comparing with gauge/survey levels; WGS84 horizontal coordinates alone do not establish a vertical datum. Never assume EGM96 merely because it is common elsewhere. The old report's drainage comparison converts heights to a common reference; that does not mean every distributed file already uses that reference.

### SISDP drainage and water bodies

The official [SISDP home page](https://bhuvanpanchayat.nrsc.gov.in/home.html) describes 2.5 m source imagery and thematic maps at 1:10,000, with an objective to update thematic data for 2015–16. The [NRSC July 2024 newsletter, p. 32](https://www.nrsc.gov.in/sites/default/files/pdf/ebooks/P2P_Jul_2024.pdf) dates SISDP-U implementation to 2019–2023. Implementation years are not imagery acquisition dates; obtain the regional edition/date before analysis. Mapping scale is not positional accuracy, feature completeness or raster pixel size.

The official [Panchayat products page](https://www.bhuvan-panchayat3.nrsc.gov.in/) publishes this drainage/water-body WMS:

```text
https://bhuvanpanchayat.nrsc.gov.in/geoserver2/SISDP_P2/wms
Layer: SISDP_P2:DRAIN_PHASE_II
Published example: SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png
```

The [official manual](https://bhuvanpanchayat.nrsc.gov.in/SISDP/BP-usermanual.pdf) documents WMS consumption and a data-download portal. Its indexed QGIS example shows EPSG:4326; the live capabilities were not obtained here. No verified vector schema, WFS, drainage download entitlement, regional completeness, vertical attributes or accuracy statement was obtained. The current products page specifically announces LULC downloads; that is not evidence that drainage vectors are equally downloadable. Login/approval restrictions for drainage download remain unresolved.

Use as mapped drainage/water-body context and a candidate-search constraint once coverage is verified. A mapped stream does not establish present connectivity, discharge, channel depth, culvert invert, obstruction or maintenance condition. Current blockage requires dated field/agency observations, photos with location and review, or inspection records. Absent mapped drainage must remain unknown rather than proof that no drain exists.

### Flood observations and historical layers

The official [NRSC flood-service description](https://www.nrsc.gov.in/nrscnew/bhuvan_this_week.php?week=2026-09-20) distinguishes satellite-derived recent inundation, historical/annual flood layers, hazard zones and low-lying areas. The [live flood layer selector](https://bhuvan-app1.nrsc.gov.in/disaster/usrtasks/flood/flood.php?uname=empty) exposes event/date selections and warns that its Kerala 11–21 August 2018 duration product depends on available satellite coverage. The same selector contains historical modeling reports: do not classify every item in this portal as a satellite observation.

Its HTML directly publishes the following WMS and layer:

```text
https://bhuvan-ras2.nrsc.gov.in/cgi-bin/mapserv.exe?map=/ms4w/apps/mapfiles/disaster_hyd.map
Layer: aggregate_flood_kerala_2018
```

Direct capabilities testing returned WMS 1.1.1 XML with EPSG:4326 and this layer, alongside several `low_lying_*` layers. This proves a discoverable service, not an event-complete archive. The Kerala aggregate is not a single acquisition or advance forecast. Exact sensor, acquisition times, effective resolution, detection method, permanent-water treatment, omission/commission error, publication latency and unknown/cloud/coverage masks must be recovered per product. No flood-depth or water-surface-elevation datum was established. Do not borrow another layer's resolution or interpret undetected inundation as dry ground.

### Basemap imagery and supplied viewers

The supplied [3D viewer](https://bhuvan-app1.nrsc.gov.in/globe/3d.php) and [2D viewer](https://bhuvan-app1.nrsc.gov.in/bhuvan2d/bhuvan/bhuvan2d.php) returned HTML without login. This does not test their rendered map or imagery requests. Bhuvan's [official WMS guide](https://bhuvan.nrsc.gov.in/wiki/index.php/How_to_use_WMS_services) documents a legacy satellite service, `http://bhuvan3.nrsc.gov.in/cgi-bin/bhuvan_islands_mha.exe`, layer `Bhuvan_satellite`, and thematic service `https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms`. The guide is old; its direct fetch returned 404 in this audit despite indexed documentation remaining available. Its example should be treated as discovery evidence, not a working integration recipe.

The [2015 content standards](https://bhuvan-app1.nrsc.gov.in/2dresources/documents/4_Bhuvan_Data_Content_And_Map_Standards.pdf) describe multiple imagery resolution tiers and geographic WGS84. They do not establish the acquisition date, native resolution or accuracy of a particular current viewport. Basemap display is context, not an event-aligned measurement, cadastral title, terrain survey or automatic source of building/channel heights. A current supported HTTPS imagery endpoint, regional acquisition metadata and browser behavior still need verification.

## Terms and hosting constraints

The current [NRSC terms page](https://www.nrsc.gov.in/nrscnew/termsConditions.php) describes a limited, non-exclusive, non-transferable license; permits non-commercial downloadable-content use with attribution and a link; permits value-added/derivative products; retains NRSC ownership of data/services; and leaves interpretation responsibility with users. Its specified attribution is “Source: NRSC, ISRO/DOS”. This is not a blanket open-data or commercial-redistribution license.

The [Bhuvan handbook terms](https://bhuvan-app1.nrsc.gov.in/2dresources/documents/1_Bhuvan_User_Handbook.pdf), terms-of-use section, apply to portal content and services. The [Panchayat page](https://www.bhuvan-panchayat3.nrsc.gov.in/) also says its pages may not be loaded in frames. Link to viewers rather than embedding their pages. Dataset-specific terms and third-party imagery rights must be captured at acquisition. No permission for bulk scraping, offline tile redistribution, commercial hosting, indefinite caching, service-level guarantees or unrestricted request volume was verified. CORS was not tested. Do not bypass login or treat a proxy as a licensing solution.

## Exact unauthenticated access evidence

Method: Python standard-library `urllib.request.urlopen`, certificate verification enabled, no credentials/cookies, GET, concurrent independent requests, 25-second timeout for the first batch. Bytes below are response-body bytes, not downloaded scientific datasets. Results describe this network/session only; timeouts are not proof of global outage or authentication requirements. Raw responses were inspected in memory and were not saved as repository artifacts.

| Request | UTC completion on 2026-11-04 | Observed result |
| --- | --- | --- |
| Supplied 3D URL above | 19:34:49.140 | HTTP 200, `text/html; charset=UTF-8`, 15,958 bytes |
| Supplied 2D URL above | 19:34:49.297 | HTTP 200, same type, 131,944 bytes |
| NOEDA entry point above | 19:34:49.101 | HTTP 200, same type, 13,249 bytes; HTML reports `bhuvanusername = "empty"` and Login |
| SISDP WMS + `?service=WMS&version=1.1.1&request=GetCapabilities` | 19:35:14.819 | `The read operation timed out` |
| General thematic WMS + same capabilities query | 19:35:14.019 | `The read operation timed out` |
| Flood selector URL above | 19:34:50.544 | HTTP 200, same HTML type, 1,245,383 bytes |
| Legacy satellite URL using HTTPS + `?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities` | 19:35:30.098 | `[Errno 11001] getaddrinfo failed`; HTTPS variant only, not an HTTP test |
| Disaster WMS above + `&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities` | 19:35:30.529 | HTTP 200, `application/vnd.ogc.wms_xml; charset=UTF-8`, 15,218 bytes |

A subsequent capabilities retrieval had SHA-256 `9ae3b0230572191e6d0a7b354db57241af7e31bc24b2930cef32a7b3d91fedb2`. An exact map request to the same disaster WMS appended:

```text
&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=aggregate_flood_kerala_2018&STYLES=&SRS=EPSG:4326&BBOX=75,8,78,13&WIDTH=256&HEIGHT=256&FORMAT=image/png
```

It returned HTTP 200, `image/png`, 415 bytes, PNG signature and 256×256 header, SHA-256 `e0ad5e0e24351da5a5c4bce512a0bf3f2d713484c6e75be495ecb6fc7eec227d`. **Pixels were not visually inspected; a small/blank response is possible.** This does not establish nonempty inundation coverage or scientific usability. No browser/CORS, feature-info, vector download, authenticated tile, raster-value or bathymetric retrieval succeeded or was claimed.

## Remaining requirement work

| Requirement | Evidence this audit adds | Still required |
| --- | --- | --- |
| R03 candidate storage | Indian DSM and mapped-water/drainage source paths identified | Obtain permitted versioned elevation/vector inputs; validate regional coverage/datum; delineate contributing catchments and connectivity; inspect outlets, bathymetry, soils, current levels and exclusions. Display approximate capacity assumptions and unknown usable storage. |
| R04 rainfall/river impacts | One flood WMS capabilities and map transport response tested | Recover event-specific observations and coverage masks; align dates/CRS with independent held-out events and non-events; implement/calibrate/evaluate the hydrology/hydraulics. Historical aggregates cannot validate timing or depth and cannot serve as issue-time forecast inputs. |
| R11 real geography/surveys | Official Indian source metadata and limitations identified | Obtain terrain/channel/structure surveys and benchmark datum; keep parcels/land rights separate; add per-layer provenance, coverage and uncertainty. Remote sensing supplies neither ownership authority nor present blockage inspection. |
| R16 automatic onboarding | Candidate service registry entries and concrete failure modes established | Implement bounded permitted connectors, capabilities/schema checks, extent/time discovery, provenance hashes, access state, retries/cache/refresh and dependency invalidation. Distinguish login restriction, network failure, missing coverage, missing connector and unsupported model. No automatic regional onboarding was implemented by this note. |

Next research gate: verify permitted access and an actual sample for the selected region before adopting any source. Gandak/Sonpur coverage and fitness remain unvalidated. Preserve unknowns if login, licensing or scientific metadata cannot be resolved; do not replace them with invented observations.
