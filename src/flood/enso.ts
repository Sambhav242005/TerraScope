/**
 * ENSO (El Niño - Southern Oscillation) Climate Context Module
 *
 * Sourced from NOAA CPC Oceanic Niño Index (ONI) 3-month running mean of ERSST.v5
 * SST anomalies in the Niño 3.4 region (5°N-5°S, 120°-170°W).
 * Base periods: 1991-2020 climatology.
 *
 * Scientific Caveat:
 * ENSO teleconnections to the Ganges-Brahmaputra basin are probabilistic and seasonal
 * (primarily influencing the southwest monsoon timing and intensity). ENSO status
 * does NOT act as an operational multiplier for instantaneous local river stage
 * or localized depression inundation.
 */

export type EnsoPhase = "El Niño" | "La Niña" | "Neutral";

export type EnsoRecord = {
  year: number;
  season: string; // e.g. "ASO" (Aug-Sep-Oct), "SON" (Sep-Oct-Nov)
  oniAnomalyC: number;
  phase: EnsoPhase;
  source: string;
  notes: string;
};

// Historical monsoon/post-monsoon (ASO/SON) values from NOAA CPC ONI archive
export const HISTORICAL_ENSO_SERIES: Record<number, EnsoRecord> = {
  2015: {
    year: 2015,
    season: "ASO",
    oniAnomalyC: 2.2,
    phase: "El Niño",
    source: "NOAA CPC Oceanic Niño Index (ERSST.v5)",
    notes: "Very strong El Niño event. Associated with regional monsoon rainfall deficits across parts of northern India.",
  },
  2016: {
    year: 2016,
    season: "ASO",
    oniAnomalyC: -0.6,
    phase: "La Niña",
    source: "NOAA CPC Oceanic Niño Index (ERSST.v5)",
    notes: "Weak La Niña following strong El Niño. Normal to above-normal post-monsoon catchment wetness.",
  },
  2017: {
    year: 2017,
    season: "ASO",
    oniAnomalyC: -0.6,
    phase: "La Niña",
    source: "NOAA CPC Oceanic Niño Index (ERSST.v5)",
    notes: "Weak La Niña phase during late monsoon.",
  },
  2018: {
    year: 2018,
    season: "ASO",
    oniAnomalyC: 0.5,
    phase: "El Niño",
    source: "NOAA CPC Oceanic Niño Index (ERSST.v5)",
    notes: "Weak borderline El Niño developing late in the season.",
  },
  2019: {
    year: 2019,
    season: "ASO",
    oniAnomalyC: 0.2,
    phase: "Neutral",
    source: "NOAA CPC Oceanic Niño Index (ERSST.v5)",
    notes: "ENSO neutral. Note strong positive Indian Ocean Dipole (IOD) occurred in 2019.",
  },
  2020: {
    year: 2020,
    season: "ASO",
    oniAnomalyC: -1.0,
    phase: "La Niña",
    source: "NOAA CPC Oceanic Niño Index (ERSST.v5)",
    notes: "Moderate La Niña phase (first year of 'triple-dip' La Niña).",
  },
  2021: {
    year: 2021,
    season: "ASO",
    oniAnomalyC: -0.8,
    phase: "La Niña",
    source: "NOAA CPC Oceanic Niño Index (ERSST.v5)",
    notes: "Moderate La Niña phase (second year).",
  },
  2022: {
    year: 2022,
    season: "ASO",
    oniAnomalyC: -1.0,
    phase: "La Niña",
    source: "NOAA CPC Oceanic Niño Index (ERSST.v5)",
    notes: "Moderate La Niña phase (third year).",
  },
  2023: {
    year: 2023,
    season: "ASO",
    oniAnomalyC: 1.6,
    phase: "El Niño",
    source: "NOAA CPC Oceanic Niño Index (ERSST.v5)",
    notes: "Strong El Niño event.",
  },
  2024: {
    year: 2024,
    season: "ASO",
    oniAnomalyC: -0.3,
    phase: "Neutral",
    source: "NOAA CPC Oceanic Niño Index (ERSST.v5)",
    notes: "Neutral transitioning toward weak La Niña during Sep-Oct 2024 flood event period.",
  },
};

export function getEnsoContextForYear(year: number): EnsoRecord {
  return (
    HISTORICAL_ENSO_SERIES[year] ?? {
      year,
      season: "ASO",
      oniAnomalyC: 0.0,
      phase: "Neutral",
      source: "NOAA CPC Oceanic Niño Index (ERSST.v5)",
      notes: "ENSO neutral climatology reference.",
    }
  );
}

export function getEnsoColor(phase: EnsoPhase): string {
  switch (phase) {
    case "El Niño":
      return "#d97706"; // warm amber
    case "La Niña":
      return "#0284c7"; // cool blue
    case "Neutral":
      return "#64748b"; // slate
  }
}
