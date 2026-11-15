// HydroBASINS sub-basin lookup (clipped Asia level 12 for the Sonpur context).
// Source data: HydroSHEDS v1c Asia — 15 arc-second derived sub-basins.
// Geometries clipped to the context window; areas are full-basin source values.
// This is a DEM-derived delineation, not a survey.

export type BasinGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export type BasinRecord = {
  hybas_id: number;
  next_down: number;
  next_sink: number;
  main_bas: number;
  dist_main_km: number;
  sub_area_km2: number;
  up_area_km2: number;
  pfaf: string;
  order: number;
  geometry: BasinGeometry;
};
export type BasinFeature = {
  type: "Feature";
  id: number;
  geometry: BasinGeometry;
  properties: Record<string, unknown>;
};
export type BasinFeatureCollection = {
  type: "FeatureCollection";
  features: BasinFeature[];
};
export type BasinBundle = {
  source: { name: string; url: string; sha256: string; license: string; retrieved: string };
  bounds: [number, number, number, number];
  basins: BasinRecord[];
};

export function toFeatureCollection(bundle: BasinBundle): BasinFeatureCollection {
  const features = bundle.basins.map((basin) => ({
    type: "Feature" as const,
    id: basin.hybas_id,
    geometry: basin.geometry,
    properties: {
      hybas_id: basin.hybas_id,
      next_down: basin.next_down,
      main_bas: basin.main_bas,
      dist_main_km: basin.dist_main_km,
      sub_area_km2: basin.sub_area_km2,
      up_area_km2: basin.up_area_km2,
      pfaf: basin.pfaf,
      order: basin.order,
    },
  }));
  return { type: "FeatureCollection", features };
}

/** Ray-casting point-in-polygon over ring arrays (exterior + holes). */
function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat)) {
      const x = ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (lon < x) inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(lon: number, lat: number, polygon: number[][][]): boolean {
  const [outer, ...holes] = polygon;
  if (!pointInRing(lon, lat, outer)) return false;
  return !holes.some((hole) => pointInRing(lon, lat, hole));
}

export function subBasinAt(bundle: BasinBundle | null, lon: number, lat: number): BasinRecord | null {
  if (!bundle || !Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lon < bundle.bounds[0] || lat < bundle.bounds[1] || lon > bundle.bounds[2] || lat > bundle.bounds[3]) return null;
  for (const basin of bundle.basins) {
    const geom = basin.geometry;
    if (geom.type === "Polygon") {
      if (pointInPolygon(lon, lat, (geom.coordinates as number[][][]))) return basin;
    } else if (geom.type === "MultiPolygon") {
      for (const polygon of geom.coordinates as number[][][][]) {
        if (pointInPolygon(lon, lat, polygon)) return basin;
      }
    }
  }
  return null;
}

let cache: Promise<BasinBundle> | null = null;

export function loadBasins(): Promise<BasinBundle> {
  if (!cache) {
    const pending = (async () => {
      const r = await fetch("/data/hydrobasins-as12-sonpur.json");
      if (!r.ok) throw new Error("Sub-basin dataset could not be loaded.");
      const json = (await r.json()) as BasinBundle;
      if (!Array.isArray(json?.basins) || json.basins.length === 0) {
        throw new Error("Sub-basin dataset is empty or malformed.");
      }
      return json;
    })();
    cache = pending;
    pending.catch(() => {
      if (cache === pending) cache = null;
    });
  }
  return cache;
}
