export type EvidenceKind = 'documented-corridor' | 'habitat' | 'sighting' | 'forest-survey-report' | 'historical-observed-flood-footprint' | 'modeled-flood-susceptibility' | 'air-monitor-observation' | 'modeled-pollution' | 'historical-flood-atlas';
export type Bounds = [west: number, south: number, east: number, north: number];
export interface Evidence {
  id: string; kind: EvidenceKind; title: string; summary: string;
  sourceUrl: string; provider: string; version: string; retrievedAt: string;
  validTime: string; issuedAt: string | null;
  bounds: Bounds | null; boundsMeaning: string;
  resolution: string; units: string; license: string;
  missingCoverage: string; uncertainty: string;
  status: 'report-only' | 'available' | 'stale' | 'missing';
}
export interface AreaEvidenceCollection {
  type: 'FeatureCollection';
  features: Array<{ type: 'Feature'; geometry: { type: 'Point'; coordinates: [number, number] }; properties: {
    evidenceId: string; kind: EvidenceKind; label: string; sourceUrl: string;
    validTime: string; resolution: string; units: string; license: string;
  } }>;
}
export const emptyGeometry = (): AreaEvidenceCollection => ({ type: 'FeatureCollection', features: [] });
export interface AirEvidence extends Evidence {
  kind: 'modeled-pollution'; pm25: number | null; usAqi: number | null;
  sample: [number, number]; queryUrl: string;
}
export interface AreaReview {
  latitude: number; longitude: number; reports: Evidence[];
  gaps: string[]; air: AirEvidence | null; airError: string | null;
}
