/** Existing-water evidence from OpenStreetMap, via the bounded API v0.6 map
 * call (https://wiki.openstreetmap.org/wiki/API_v0.6#Map). The server caps
 * queries at 0.25 square degrees; this prototype queries a much smaller
 * area. ODbL attribution required. OSM tags are mapping evidence, not
 * surveys: they do not establish depth, permanence, bathymetry or legality.
 */
import type { DegreesBox } from "./geo.ts";

export type WaterKind =
  | "water"
  | "wetland"
  | "reservoir"
  | "basin"
  | "pond"
  | "riverbank";

export type WaterFeature = {
  id: string; // OSM way reference e.g. "way/123"
  kind: WaterKind;
  label: string | null; // name:en ?? name ?? null
  /** Closed ring(s) as [lon,lat]; a single way yields one ring. Holes and
   * multipolygon relations are NOT parsed -> recorded as skipped below. */
  outer: Array<[number, number]>;
  bbox: { west: number; south: number; north: number; east: number };
};

export type WaterExtract = {
  features: WaterFeature[];
  skippedOpenWays: number;
  /** Water-tagged multipolygon relations: unsupported in this parser. */
  skippedWaterRelations: number;
};

export function osmMapApiUrl(box: DegreesBox): string {
  const areaSqDeg = (box.east - box.west) * (box.north - box.south);
  if (areaSqDeg <= 0 || areaSqDeg > 0.2)
    throw new Error("OSM water query exceeds the bounded-extraction area policy.");
  const r = 1e7;
  const fmt = (n: number) => Math.round(n * r) / r;
  return `https://api.openstreetmap.org/api/0.6/map.json?bbox=${fmt(box.west)},${fmt(box.south)},${fmt(box.east)},${fmt(box.north)}`;
}

const WATER_TAG_RULES: Array<{ kind: WaterKind; match: (t: Record<string, string>) => boolean }> = [
  { kind: "wetland", match: (t) => t.natural === "wetland" },
  { kind: "reservoir", match: (t) => t.landuse === "reservoir" },
  { kind: "basin", match: (t) => t.landuse === "basin" },
  { kind: "pond", match: (t) => t.landuse === "pond" },
  { kind: "water", match: (t) => t.natural === "water" },
  { kind: "riverbank", match: (t) => t.waterway === "riverbank" },
];

export function classifyWaterTags(
  tags: Record<string, string> | undefined,
): WaterKind | null {
  if (!tags) return null;
  for (const rule of WATER_TAG_RULES) if (rule.match(tags)) return rule.kind;
  return null;
}

export function extractWaterFeatures(
  doc: unknown,
): WaterExtract {
  if (typeof doc !== "object" || doc === null || !Array.isArray((doc as any).elements))
    throw new Error("OSM response is not a valid JSON map document.");
  const elements = (doc as { elements: Array<Record<string, unknown>> }).elements;
  const nodePos = new Map<number, [number, number]>();
  for (const el of elements) {
    if (el.type === "node") {
      const id = el.id as number;
      const lat = el.lat as number;
      const lon = el.lon as number;
      if (Number.isFinite(id) && Number.isFinite(lat) && Number.isFinite(lon))
        nodePos.set(id, [lon, lat]);
    }
  }
  const features: WaterFeature[] = [];
  let skippedOpenWays = 0;
  let skippedWaterRelations = 0;
  for (const el of elements) {
    if (el.type === "relation") {
      const tags = (el.tags ?? {}) as Record<string, string>;
      if (classifyWaterTags(tags)) skippedWaterRelations += 1;
      continue;
    }
    if (el.type !== "way") continue;
    const tags = (el.tags ?? {}) as Record<string, string>;
    const kind = classifyWaterTags(tags);
    if (!kind) continue;
    const refs = (el.nodes as unknown as number[]) ?? [];
    const coords: Array<[number, number]> = [];
    let incomplete = false;
    for (const ref of refs) {
      const p = nodePos.get(ref);
      if (p) coords.push(p);
      else incomplete = true;
    }
    if (incomplete) {
      // A way with nodes outside the returned set should not happen for the
      // map call; treat as suspicious rather than silently clipping.
      skippedOpenWays += 1;
      continue;
    }
    if (coords.length < 4)
      throw new Error("OSM water way has fewer than four nodes.");
    const closed =
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1];
    if (!closed) {
      skippedOpenWays += 1; // waterway lines and unclosed banks: no polygon
      continue;
    }
    const xs = coords.map((c) => c[0]);
    const ys = coords.map((c) => c[1]);
    features.push({
      id: `way/${el.id as number}`,
      kind,
      label: (tags["name:en"] ?? tags.name ?? null) || null,
      outer: coords,
      bbox: {
        west: Math.min(...xs),
        east: Math.max(...xs),
        south: Math.min(...ys),
        north: Math.max(...ys),
      },
    });
  }
  return {
    features,
    skippedOpenWays,
    skippedWaterRelations,
  };
}
