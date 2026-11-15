# Renewable resource baseline — Gandak corridor (screening only)

> Date: 15 November 2026 · Status: **screening aid, not evidence.** No R07 completion is claimed. Companion report: `artifacts/agents/FIX-renewable-resource.md`. Scope: GitHub issue #7 (R07), smallest shippable slice recommended in `artifacts/agents/E-renewables-environment.md` §7.
> **This file supports a readout; it is not evidence of resource on any rooftop, array field, farm or turbine site.** It is one reanalysis grid cell, reconstructed after the fact, with no local measurement behind it.

## What this is

Daily, 2015-01-01..2024-12-31, at one cell:

- `ghi` — daily sum of surface solar shortwave downward radiation (GHI), **MJ/m²/day** (`shortwave_radiation_sum`)
- `wind_10m` — daily **mean** 10 m wind speed, **m/s** (`wind_speed_10m_mean`, `wind_speed_unit=ms`)
- `wind_100m` — daily **mean** 100 m wind speed, **m/s** (`wind_speed_100m_mean`, `wind_speed_unit=ms`)
- `wind_direction_10m_dominant` / `wind_direction_100m_dominant` — dominant (vector) daily direction, **degrees true** — used only to derive a vector-averaged bearing in the library; not a compass rose of hourly vectors

All served from the Open-Meteo Historical Weather API (`models=era5`, Copernicus ERA5 reanalysis). Hourly data is deliberately **not** in the repo.

## Which cell, and why

**26.5°N, 84.25°E** — the same requested/returned cell recorded in `public/data/manifest.json` for `rain-history` and the original 25 Sep–3 Oct 2024 ERA5 snapshot (`public/data/rain-history.json` records `latitude: 26.5, longitude: 84.25`; requested and returned coincide). Docs (`docs/DATA.md` "Connected development data — 4 November 2026" and "Visual history revision — 4 November 2026") record this as the corridor's ERA5 daily-history anchor: 3,653 daily values 2015–2024, same license and representativeness limits.

Reasons: (1) it keeps the renewable baseline readable side-by-side with the repo's only multi-year daily reanalysis history (rainfall), which is the Gandak corridor evidence this work feeds; (2) the GloFAS discharge cell (25.775°N, 85.125°E) is a river cell on a different model/grid and would answer a different question; (3) it is the cell the R07 brief itself names as "the existing Sonpur sample cell (26.5N/84.25E or configurable)". Note honestly: this cell sits ~50 km north of the 84.75–85.55°E / 25.35–26.0°N context window; it is a corridor evidence anchor, not a point inside the map's inner box, and it represents no finer claim.

## Exact query (verbatim)

```
GET https://archive-api.open-meteo.com/v1/archive?latitude=26.5&longitude=84.25&start_date=2015-01-01&end_date=2024-12-31&daily=shortwave_radiation_sum,wind_speed_10m_mean,wind_speed_100m_mean,wind_direction_10m_dominant,wind_direction_100m_dominant&models=era5&timezone=Asia%2FKolkata&wind_speed_unit=ms
```

Fetch command (15 November 2026, read-only GET, HTTP 200, 132,788 bytes raw; final file 134,652 bytes):

```
curl.exe -s -o <tmp>\renewable-gandak-raw.json -w "HTTP_CODE:%{http_code} SIZE:%{size_download}\n" "https://archive-api.open-meteo.com/v1/archive?latitude=26.5&longitude=84.25&start_date=2015-01-01&end_date=2024-12-31&daily=shortwave_radiation_sum,wind_speed_10m_mean,wind_speed_100m_mean,wind_direction_10m_dominant,wind_direction_100m_dominant&models=era5&timezone=Asia%2FKolkata&wind_speed_unit=ms"
```

Retrieved: **2026-11-15T14:38:38Z**. SHA-256 of `public/data/renewable-resource-gandak.json` (raw Open-Meteo response + a top-level `provenance` object added; daily arrays unchanged): `af7875c8e76d13312b00f20f4e909e1a05a0dcd994d0ab51abfd8136304dc14c`.

Returned cell: latitude 26.5, longitude 84.25 (requested = returned), ERA5 elevation 70.0 m, timezone Asia/Kolkata (IST calendar days, same convention as `rain-history.json`).

### Resolution — the true value, not the hoped one

ERA5 is **0.25°**. The ERA5-Land stream (~0.1°, the `~0.1°` this slice originally hoped for) was probed at this cell on 2026-11-15 with the same variables and returned **all-null** for every requested variable, including 10 m wind and GHI. It is therefore not used and is documented as unavailable here. Anyone quoting "0.1° resolution" for this file is wrong.

### Units and aggregation

Daily aggregates are computed by Open-Meteo from ERA5 hourly fields. GHI daily sum (MJ/m²/day; 1 MJ/m²/day ≈ 0.2778 kWh/m²/day). Wind speeds are daily means in m/s (`wind_speed_unit=ms`; the API default is km/h — the m/s unit is explicitly encoded in the URL). Directions are the provider's dominant daily (vector) direction in degrees, not vector means computed by this repo.

### Coverage and gaps

3,653 / 3,653 days present, 2015-01-01..2024-12-31, **zero nulls** in all five series (checked 2026-11-15). Per-year tallies: 2015:365, 2016:366, 2017:365, 2018:365, 2019:365, 2020:366, 2021:365, 2022:365, 2023:365, 2024:366. Dates are consecutive (no missing calendar days). ERA5 archive publication delay is ~5 days; 2024-12-31 precedes any such cutoff, so the record is complete as served. **No missing days are fabricated, imputed or zero-filled anywhere in this slice.** If a future refresh ever hits a gap, it stays a gap and the library refuses rather than invents.

## License status

CC BY 4.0 data — Copernicus ERA5 via Open-Meteo — with Open-Meteo's free API under **non-commercial** terms. Pointers: CC BY 4.0 (`https://creativecommons.org/licenses/by/4.0/deed.en`), Open-Meteo terms (`https://open-meteo.com/en/terms`), attribution: Copernicus Climate Change Service (C3S) / ECMWF ERA5 via Open-Meteo.com. Status of verification: consistent with the in-repo access audit (`docs/DATA.md` "Connected development data", retrieved 4 November 2026) and Copernicus's published ERA5 licensing. **This pass did not re-open the terms page** (network was restricted to the archive endpoint); the archive response itself carries no license field. The orchestrator must re-confirm before any public hosting — Open-Meteo's non-commercial terms conflict with commercial deployment even though the underlying Copernicus data is CC BY 4.0.

## What this dataset CANNOT say

1. **No yield claim.** No kWh, capacity factor, NPV, payback, LCOE or "generation" figure may be derived from or displayed beside this file without the full adapter + stated assumptions + validation event (see `docs/research/renewable-evidence-matrix.md` and `artifacts/agents/E-renewables-environment.md` §2.1/§2.5). `powerKw` nameplate defaults in the app remain placeholders.
2. **No local/site measurement.** This is a 0.25° reanalysis grid cell, not a pyranometer, anemometer, LiDAR or rooftop. No Bihar site campaign exists (matrix; E-analysis §1.3 item 3). "Screening" means *comparison of modelled grid cells*, nothing more.
3. **No local-site wind resource, ever.** Matrix line 44/190: no Bihar/India wind-resource study or cup-anemometer/lidar campaign exists in-repo or was found. ERA5 100 m wind at the cell centre is a model value; hub-height, shear and power-curve questions are unanswerable from this file alone.
4. **100 m shear assumption.** The 10→100 m profile in this file exists only because ERA5 models both levels. The power-law shear exponent α = ln(v100/v10)/ln(100/10) can be *computed* from these rows, but it is a property of the reanalysis grid (stability implicit in ERA5's boundary-layer scheme), **not** a measured tower profile; power-law vs log-law disagreement is unresolved here; monsoon stability vs winter inversion regimes (matrix 3.2) are unlabelled. Any α shown must carry "ERA5 grid, unvalidated locally".
5. **No soiling, dust, haze or paddy-residue aerosol effect.** Zero sources in the matrix cover module soiling; pre-monsoon dust and post-harvest biomass burning make soiling non-trivial in this region and nothing here quantifies it (E-analysis §2.1 item 3). ERA5 `dust_aerosol_optical_depth` would be context only, not a soiling ratio — and is not in this file.
6. **No DNI/DHI/GTI decomposition.** Only GHI (daily sum) is bundled. No tilted-array (GTI) number is derivable without extra assumptions (isotropic sky, albedo) that this slice refuses to make.
7. **No monsoon/convection/cloud-trapping claims.** All matrix 4.x/6.x items remain unsupported either direction, including "solar reduces flooding" and any PV/wind → rainfall/discharge effect (matrix items 1–2, 6.1–6.4). Absence of evidence here is not zero effect.
8. **No ENSO or fixed multiplier of any kind.** No teleconnection is represented; any ENSO context must follow the repo's existing user-confirmed rule and cite `docs/DELIVERY.md`.
9. **No interpolation or gap-filling.** Missing (null) days are absent, excluded from statistics, counted in `missing`, and never converted to 0.
10. **No rooftop/settlement-scale claim.** OSM rooftop/small-PV settlement scale remains unsupported (matrix 6.7).
11. **Not a measurement of the discharge/rainfall cells.** Different grids (GloFAS 0.05°, ERA5 0.25°); do not read this as river-gauge or catchment evidence.
12. **No causal or attribution statement** about any farm, village, embankment or canal near the cell.

## The rule

**`public/data/renewable-resource-gandak.json` is a screening aid.** Every readout built on it must carry: dataset + version, source URL, retrieval date, license, units, resolution (0.25°), coverage, and the banner — *"Reanalysis screening, 0.25° grid — not a yield forecast, not site measurement. No generation, NPV or capacity-factor claim is made or implied."* Unsupported items render **"Unavailable"**, never a best-effort number. Placement proposals remain placement-only (`docs/REQUIREMENTS.md:64`); this baseline changes nothing about that.

## Files in this slice

- `public/data/renewable-resource-gandak.json` — raw Open-Meteo daily response (3,653 days × 5 series) + top-level `provenance` object. 134,652 bytes.
- `src/flood/renewableResource.ts` — pure functions: `parseRenewableResource`, `loadRenewableResource(fetchImpl)`, `statsOf(rows)` (P10/P50/P90/mean per series, Jun–Sep vs Oct–May GHI split, vector-averaged `dominantBearing` when ≥30 valid directions exist, structured refusals; never imputes).
- `tests/renewableResource.test.js` — 21 fixture-based tests (no network); artifact presence guarded.
- `docs/research/renewable-resource-gandak.md` — this file.

`public/data/manifest.json` and all app/UI code are intentionally **not** edited here; wiring (manifest entry, onboarding registry, provenance card, comparative readout) is the orchestrator's job — see `artifacts/agents/FIX-renewable-resource.md`.
