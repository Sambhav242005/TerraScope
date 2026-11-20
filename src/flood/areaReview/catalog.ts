import type { Bounds, Evidence } from './contracts.ts';

// Discovery envelopes only. Never administrative boundaries or evidence footprints.
export const BIHAR_SEARCH: Bounds = [83.3, 24.2, 88.3, 27.6];
export function validLocation(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}
export function inBounds(latitude: number, longitude: number, b: Bounds): boolean {
  return validLocation(latitude, longitude) && latitude >= b[1] && latitude <= b[3] && longitude >= b[0] && longitude <= b[2];
}
const common = {
  retrievedAt: '2026-11-17', issuedAt: null, bounds: BIHAR_SEARCH,
  boundsMeaning: 'Approximate Bihar discovery envelope; not confirmed point coverage or a boundary.',
  status: 'report-only' as const, units: 'Report reference; no local measurement',
  license: 'Link/reference only; no report imagery or geometry redistributed.',
  missingCoverage: 'No site-level geometry ingested.',
  uncertainty: 'Regional context does not establish conditions at the selected point.',
};
export const reports: Evidence[] = [
  { ...common, id: 'fsi-isfr-2023', kind: 'forest-survey-report', title: 'Bihar forest survey · ISFR 2023',
    provider: 'Forest Survey of India', validTime: '2023 assessment',
    sourceUrl: 'https://fsi.nic.in/uploads/isfr2023/isfr_book_eng-vol-2_2023.pdf',
    resolution: 'State/district report; no site-level forest layer connected',
    summary: 'ISFR 2023 table 10.4.3 reports 62.79 km² forest cover for Saran district (2.38% of its calculated area). This district aggregate is not a selected-site measurement or evidence of an animal route.',
    units: 'District forest cover: km² and percent; not local cover',
    version: 'ISFR 2023 Volume II, printed p.40, table 10.4.3; SHA-256 86029d090ae3687a20f9353e86841959434e76b15f28a7bbc0511f853dbae344' },
  { ...common, id: 'moef-corridors-2023', kind: 'documented-corridor', title: 'Bihar corridor report · 2023',
    provider: 'Project Elephant / MoEFCC, state forest departments; WII technical support', version: 'Edition 1/2023', validTime: '2023 report',
    sourceUrl: 'https://moef.gov.in/uploads/2023/11/PE-Elephant-Corridor-of-India-2023.pdf',
    resolution: 'Regional report; indicative mapping, not delineated boundaries',
    summary: 'The report documents Jamui–Jhajha–Chakayi in Bihar, not a Sonpur route. No wildlife tracking points or route geometry are displayed.',
    missingCoverage: 'No verified selected-site corridor, habitat or sightings layer. Missing records do not mean no route exists.' },
  { ...common, id: 'nrsc-bihar-history', kind: 'historical-flood-atlas', title: 'Bihar historical flood atlas · 1998–2010',
    provider: 'NRSC / ISRO', version: 'Bihar flood hazard zonation atlas, historical satellite archive', validTime: '1998–2010 source observations',
    sourceUrl: 'https://www.nrsc.gov.in/nrscnew/resources_atlas_FloodHazard_Zonation.php?lang_code=en',
    resolution: 'District atlas reference; no event footprint resolution ingested',
    summary: 'Regional atlas compiled from historical satellite flood observations. It is not a dated footprint at this point, a present forecast, or a hydraulic simulation.',
    missingCoverage: 'Event-level footprint connector and public-display clearance remain missing. Existing NRSC rasters stay withheld.' },
  { ...common, id: 'cpcb-stations', kind: 'air-monitor-observation', title: 'Nearby regional monitoring references · CPCB',
    provider: 'Central Pollution Control Board', version: 'Station list dated 2021-02-02', validTime: '2021-02-02 station inventory; not current readings',
    sourceUrl: 'https://cpcb.nic.in/uploads/it_technical_activity.pdf',
    resolution: 'Named stations only; no observation footprint',
    summary: 'The dated official inventory lists Industrial Area, Hajipur and stations in Patna. No current monitor readings are connected here.',
    missingCoverage: 'Current station availability, coordinates, quality flags and licensed observation connector are unverified.' },
];
export function regionalReports(latitude: number, longitude: number): Evidence[] {
  return inBounds(latitude, longitude, BIHAR_SEARCH) ? reports.map(r => ({ ...r, bounds: [...BIHAR_SEARCH] })) : [];
}
export function areaGaps(latitude: number, longitude: number): string[] {
  return [
    ...(!inBounds(latitude, longitude, BIHAR_SEARCH) ? ['Outside the curated Bihar report search envelope; no regional reports indexed here.'] : []),
    'No verified local wildlife route, habitat or sightings layer. No records is not evidence of absence.',
    'Historical observed flood footprints and modeled flood susceptibility are not connected for this selection.',
    'Air monitor observations are not connected. Air model estimates below are not CPCB observations or Indian AQI.',
    'Water and soil pollution require separate sampling datasets, licensed connectors and interpretation methods; air data cannot establish either.',
  ];
}
