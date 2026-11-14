import type { Intervention } from "./intervention.ts";

export type Position = [number, number];
export type Polygon = { type: "Polygon"; coordinates: Position[][] };
export type Line = { type: "LineString"; coordinates: Position[] };
export type EvidenceFeature = {
  id: string;
  kind: "river" | "water" | "road" | "building" | "historical-flood";
  geometry: Polygon | Line;
  sourceId: string;
  label?: string;
};
export type EvidenceSource = {
  id: string;
  label: string;
  url: string;
  retrievedAt: string;
  coverage: [number, number, number, number];
  limitations: string[];
  date?: string;
  sha256: string;
};
export type PlacementEvidence = { sources: EvidenceSource[]; features: EvidenceFeature[] };
export type PlacementCheck = {
  status: "conflict" | "investigate" | "unknown";
  headline: string;
  findings: Array<{ kind: string; message: string; labels?: string[]; featureIds: string[]; sourceIds: string[] }>;
  unknowns: string[];
  footprint: Polygon;
  footprintMethod: string;
  method: string;
};

type Box = [number, number, number, number];
const EPS = 1e-10;
const METHOD = "footprint-overlay-v1";
const kinds = new Set(["river", "water", "road", "building", "historical-flood"]);
const interventionKinds = new Set(["storage_basin", "solar_array", "wind_turbine", "vegetation_buffer"]);
function validPosition(p: unknown): p is Position {
  return Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 85;
}
function validateGeometry(g: Polygon | Line) {
  if (!g || !["Polygon", "LineString"].includes(g.type) || !Array.isArray(g.coordinates)) throw new Error("Invalid placement evidence geometry.");
  const rings = g.type === "Polygon" ? g.coordinates : [g.coordinates];
  if (!rings.length) throw new Error("Empty placement evidence geometry.");
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < (g.type === "Polygon" ? 4 : 2) || !ring.every(validPosition)) throw new Error("Invalid placement evidence coordinates.");
    if (g.type === "Polygon") {
      const last = ring[ring.length - 1];
      if (ring[0][0] !== last[0] || ring[0][1] !== last[1]) throw new Error("Placement polygon rings must be closed.");
      // Subtract the first vertex to avoid cancellation for small geographic rings.
      const [x0, y0] = ring[0];
      let area2 = 0;
      for (let i = 1; i < ring.length; i++) area2 += (ring[i - 1][0] - x0) * (ring[i][1] - y0) - (ring[i][0] - x0) * (ring[i - 1][1] - y0);
      if (area2 === 0) throw new Error("Placement polygon has zero area.");
    }
  }
}
function bounds(g: Polygon | Line): Box {
  const points = g.type === "Polygon" ? g.coordinates.flat() : g.coordinates;
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const [x, y] of points) { west = Math.min(west, x); east = Math.max(east, x); south = Math.min(south, y); north = Math.max(north, y); }
  return [west, south, east, north];
}
function boxIntersects(a: Box, b: Box) {
  return a[0] <= b[2] + EPS && a[2] >= b[0] - EPS && a[1] <= b[3] + EPS && a[3] >= b[1] - EPS;
}
function boxContains(a: Box, b: Box) {
  return a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
}
function onSegment(p: Position, a: Position, b: Position) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]) <= EPS;
  const cross = (p[0] - a[0]) * dy - (p[1] - a[1]) * dx;
  return Math.abs(cross) <= EPS * length && p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS;
}
function cross(a: Position, b: Position, c: Position) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function segmentIntersects(a: Position, b: Position, c: Position, d: Position) {
  if (onSegment(a, c, d) || onSegment(b, c, d) || onSegment(c, a, b) || onSegment(d, a, b)) return true;
  return ((cross(a, b, c) > 0) !== (cross(a, b, d) > 0)) && ((cross(c, d, a) > 0) !== (cross(c, d, b) > 0));
}
/** -1 outside, 0 on boundary, 1 inside. Geographic planar test, no buffer. */
function inRing(p: Position, ring: Position[]) {
  let inside = false;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i];
    if (onSegment(p, a, b)) return 0;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside ? 1 : -1;
}
function inPolygon(p: Position, poly: Polygon) {
  const outer = inRing(p, poly.coordinates[0]);
  if (outer !== 1) return outer >= 0;
  for (const hole of poly.coordinates.slice(1)) {
    const result = inRing(p, hole);
    if (result === 0) return true;
    if (result === 1) return false;
  }
  return true;
}
export function intersects(footprint: Polygon, other: Polygon | Line) {
  if (!boxIntersects(bounds(footprint), bounds(other))) return false;
  const otherRings = other.type === "Polygon" ? other.coordinates : [other.coordinates];
  for (const a of footprint.coordinates) for (const b of otherRings) {
    for (let i = 1; i < a.length; i++) for (let j = 1; j < b.length; j++) {
      if (segmentIntersects(a[i - 1], a[i], b[j - 1], b[j])) return true;
    }
  }
  if (otherRings[0].some(p => inPolygon(p, footprint))) return true;
  return other.type === "Polygon" && footprint.coordinates[0].some(p => inPolygon(p, other));
}
function assumedFootprint(item: Intervention): Polygon {
  const half = Math.max(Math.sqrt(item.areaM2) / 2, item.kind === "wind_turbine" ? 33 : 0);
  const dx = half / (111320 * Math.cos(item.lat * Math.PI / 180));
  const dy = half / 111132;
  return { type: "Polygon", coordinates: [[[item.lon - dx, item.lat - dy], [item.lon + dx, item.lat - dy], [item.lon + dx, item.lat + dy], [item.lon - dx, item.lat + dy], [item.lon - dx, item.lat - dy]]] };
}

/** Positive map overlaps identify investigation/conflicts, never certify suitability.
 * Only supplied vector/display evidence is examined. No terrain, hydrology or AI runs.
 */
export function checkPlacement(item: Intervention, evidence: PlacementEvidence | null): PlacementCheck {
  if (!item || !interventionKinds.has(item.kind) || !validPosition([item.lon, item.lat]) || !Number.isFinite(item.areaM2) || item.areaM2 <= 0) throw new Error("Invalid intervention coordinates or area.");
  const supplied = (item as Intervention & { footprint?: Polygon }).footprint;
  const footprint = supplied ?? assumedFootprint(item);
  validateGeometry(footprint);
  const footprintMethod = supplied ? "Supplied candidate polygon; not a surveyed construction footprint." : `Area-equivalent square centered on the pin; orientation/shape assumed.${item.kind === "wind_turbine" ? " Expanded to include the illustrative 66 m rotor." : ""} No regulatory setback.`;
  const unknowns = ["Land rights, restrictions and engineering feasibility are unverified.", "Placement only; intervention effect model unavailable."];
  if (item.kind === "storage_basin") unknowns.push("Connected catchment, inflow/drainage paths, current water, bathymetry, soils, outlet and overflow capacity are unknown. Geometric volume is not available storm storage.");
  if (item.kind === "solar_array") unknowns.push("Flood levels, drainage, soil/foundation stability, solar resource, orientation and energy yield are unassessed.");
  if (item.kind === "wind_turbine") unknowns.push("Flood levels, drainage, foundation stability, wind resource, setbacks, power curve and wakes are unassessed.");
  if (item.kind === "vegetation_buffer") unknowns.push("Riparian connectivity, soil/infiltration, planting suitability, erosion and runoff effects are unassessed.");
  const empty: PlacementCheck = { status: "unknown", headline: "Evidence unavailable; suitability unknown", findings: [], unknowns, footprint, footprintMethod, method: METHOD };
  if (evidence === null) { unknowns.push("Mapped water, road, building and historical flood evidence has not loaded."); return empty; }
  if (!evidence || !Array.isArray(evidence.sources) || !Array.isArray(evidence.features)) throw new Error("Invalid placement evidence bundle.");
  const sourceMap = new Map<string, EvidenceSource>();
  const box = bounds(footprint);
  for (const source of evidence.sources) {
    if (!source || [source.id, source.label, source.url, source.retrievedAt, source.sha256].some(s => typeof s !== "string" || !s.trim()) || !Array.isArray(source.coverage) || source.coverage.length !== 4 || !source.coverage.every(Number.isFinite) || source.coverage[0] < -180 || source.coverage[2] > 180 || source.coverage[1] < -85 || source.coverage[3] > 85 || source.coverage[0] >= source.coverage[2] || source.coverage[1] >= source.coverage[3] || !Array.isArray(source.limitations) || source.limitations.some(s => typeof s !== "string") || (source.date !== undefined && typeof source.date !== "string") || sourceMap.has(source.id)) throw new Error("Invalid placement source metadata.");
    sourceMap.set(source.id, source);
    if (!boxContains(source.coverage, box)) unknowns.push(`${source.label}: footprint extends outside the source's bounded coverage; absent features there are unknown.`);
    unknowns.push(...source.limitations.map(l => `${source.label}: ${l}`));
  }
  const hits = new Map<string, { features: Set<string>; sources: Set<string>; labels: Set<string> }>();
  const featureIds = new Set<string>();
  for (const feature of evidence.features) {
    if (!feature || typeof feature.id !== "string" || !feature.id || !kinds.has(feature.kind) || !sourceMap.has(feature.sourceId) || (feature.label !== undefined && typeof feature.label !== "string") || featureIds.has(feature.id)) throw new Error("Invalid placement evidence feature/reference.");
    featureIds.add(feature.id); validateGeometry(feature.geometry);
    if (!intersects(footprint, feature.geometry)) continue;
    const hit = hits.get(feature.kind) ?? { features: new Set<string>(), sources: new Set<string>(), labels: new Set<string>() };
    hit.features.add(feature.id); hit.sources.add(feature.sourceId); if (feature.label) hit.labels.add(feature.label); hits.set(feature.kind, hit);
  }
  const findings: PlacementCheck["findings"] = [...hits].sort(([a], [b]) => a.localeCompare(b)).map(([kind, hit]) => {
    let message: string;
    if (kind === "historical-flood") {
      const dates = [...hit.sources].sort().map(id => sourceMap.get(id)?.date ?? "date unverified");
      message = `Footprint overlaps provider map-color inundation evidence (${dates.join(", ")}). This is dated historical context, not validated flood risk, water depth or a current condition.`;
    } else if (item.kind === "vegetation_buffer") {
      message = `Proposed vegetation footprint overlaps mapped ${kind}. Investigate bank/channel position and infrastructure clearance; overlap alone does not establish a functioning riparian buffer.`;
    } else {
      message = `Proposed land footprint overlaps mapped ${kind}. Reconsider the location or obtain a site-specific engineering review; this map check does not authorize a site.`;
    }
    const labels = [...hit.labels].sort();
    if (labels.length) message += ` Mapped feature names: ${labels.slice(0, 3).join(", ")}${labels.length > 3 ? ", and others" : ""}.`;
    return { kind, message, labels, featureIds: [...hit.features].sort(), sourceIds: [...hit.sources].sort() };
  });
  if (!sourceMap.size) unknowns.push("No mapped evidence sources are available for this placement.");
  unknowns.push("No mapped overlap is not proof of no hazard: map completeness, positional accuracy and current conditions are unverified.");
  const hardConflict = item.kind !== "vegetation_buffer" && [...hits.keys()].some(k => k !== "historical-flood");
  const hasCoverage = [...sourceMap.values()].some(source => boxIntersects(source.coverage, box));
  return { ...empty, status: hardConflict ? "conflict" : hits.size || hasCoverage ? "investigate" : "unknown", headline: hardConflict ? "Mapped conflict; reconsider this placement" : hits.size ? "Mapped overlap; further investigation required" : hasCoverage ? "No mapped conflict found; suitability still unassessed" : sourceMap.size ? "Outside available coverage; suitability unassessed" : empty.headline, findings, unknowns: [...new Set(unknowns)] };
}
