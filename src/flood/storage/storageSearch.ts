/** End-to-end candidate water-storage screening over real terrain.
 *
 * Pipeline: bounded analysis box -> Mapzen terrarium tiles -> metric pixel
 * grid -> findNaturalStorage (Priority-Flood d8, tested separately) ->
 * geographic polygons -> OSM water-evidence classification -> run record.
 *
 * Deterministic in its inputs: the same center/config and the same retrieved
 * tiles produce the same candidates. This is an in-page job with
 * cancellation and an input hash — NOT a durable background service; only
 * the latest record is persisted.
 *
 * Every numerical output comes from calls into tested spatial code. Failure
 * is explicit and never fabricates depressions, capacities or conclusions.
 */
import { findNaturalStorage, type StorageTerrain } from "../naturalStorage.ts";
import { analysisBoxDeg, planGridForBox, type DegreesBox, type GridPlan } from "./geo.ts";
import {
  TERRAIN_PROVENANCE,
  assembleScreeningGrid,
  cellCenterLonLat,
  terrariumTileUrl,
  tileToElevationsM,
  type DecodedTile,
} from "./terrainGrid.ts";
import {
  cellsToPolygon,
  pointInPolygon,
  polygonBBox,
  polygonCentroid,
  type GeoPolygon,
} from "./candidateGeometry.ts";
import { extractWaterFeatures, osmMapApiUrl, type WaterFeature } from "./osmWater.ts";

export type ScreeningConfig = {
  center: { lat: number; lon: number };
  /** Inner analysis box half-width in kilometres. */
  halfSpanKm: number;
  /** Surrounding terrain ring as a fraction of the half-width, so cropped
   * raster edges behave as outlets far away from the analysis area. */
  contextRingRatio: number;
  maxTiles: number;
};

export const DEFAULT_SCREENING_CONFIG: Readonly<
  Pick<ScreeningConfig, "halfSpanKm" | "contextRingRatio" | "maxTiles">
> = {
  halfSpanKm: 3.6,
  contextRingRatio: 0.35,
  maxTiles: 16,
};

export const SCREENING_METHOD = "priority-flood-d8-v1";
export const STORAGE_RECORD_SCHEMA = "terrascope-storage-v1";

export type ScreeningStatus =
  | "succeeded"
  | "failed"
  | "cancelled"
  | "insufficient-data";

export type WaterEvidence = {
  status: "overlaps" | "none-mapped" | "unavailable";
  overlapCells: number | null;
  overlapAreaM2: number | null;
  features: Array<{ id: string; kind: string; label: string | null }>;
};

export type StoredCandidate = {
  id: string;
  label: string;
  polygon: GeoPolygon;
  centroid: [number, number];
  bbox: { south: number; west: number; north: number; east: number };
  spillElevationM: number;
  minimumElevationM: number;
  maximumDepthToSpillM: number;
  footprintAreaM2: number;
  geometricCapacityM3: number;
  availableStorageM3: null;
  suitability: "unassessed";
  waterEvidence: WaterEvidence;
};

export type StoredWater = {
  retrievedAt: string | null;
  features: WaterFeature[];
};

export type ScreeningRun = {
  schema: typeof STORAGE_RECORD_SCHEMA;
  waterEvidenceVersion: 1 | 2;
  id: string;
  configHash: string;
  config: ScreeningConfig;
  status: ScreeningStatus;
  startedAt: string;
  finishedAt: string | null;
  attempt: number;
  tilesFetched: number;
  tilesTotal: number;
  candidates: StoredCandidate[];
  candidateCountTotal: number;
  error: string | null;
  limitations: string[];
  /** Raw OSM water geometries for the standalone map layer; stripped
   * (compactly re-kept) from persistence to bound localStorage size. */
  water: StoredWater | null;
  provenance: {
    method: typeof SCREENING_METHOD;
    terrainSource: string;
    terrainAttribution: string;
    terrainUrlTemplate: string;
    tileMatrixZoom: number;
    metersPerPixel: number;
    verticalDatum: string;
    terrainCaveats: string[];
    waterSource: string;
    waterAttribution: string;
    waterQueryUrl: string | null;
    waterRetrievedAt: string | null;
    waterSkippedOpenWays: number | null;
    waterSkippedMultipolygons: number | null;
    runKind: "historical-terrain-screening";
  };
};

export type RunDeps = {
  signal: AbortSignal;
  fetchTile?: (url: string, signal: AbortSignal) => Promise<Uint8ClampedArray>;
  fetchWaterJson?: (url: string, signal: AbortSignal) => Promise<unknown>;
  tilesCache?: Map<string, Uint8ClampedArray>;
  onProgress?: (p: {
    phase: "terrain" | "water" | "analysing";
    tilesDone: number;
    tilesTotal: number;
  }) => void;
};

// ------------------------------------------------------------------ hashing

export function configHash(cfg: ScreeningConfig): string {
  const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
  const canonical = JSON.stringify([
    round6(cfg.center.lat),
    round6(cfg.center.lon),
    cfg.halfSpanKm,
    cfg.contextRingRatio,
    cfg.maxTiles,
  ]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// -------------------------------------------------------------- browser I/O

/** Fetch one terrarium PNG and return its RGBA pixels via ImageBitmap. */
export async function fetchTerrariumTileRGBA(
  url: string,
  signal: AbortSignal,
): Promise<Uint8ClampedArray> {
  const res = await fetch(url, { signal, credentials: "omit", mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const image = await createImageBitmap(await res.blob());
  try {
    const size = image.width;
    if (size !== 256 || image.height !== 256)
      throw new Error("Unexpected terrarium tile size.");
    let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
    let canvas: OffscreenCanvas | HTMLCanvasElement;
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(size, size);
      ctx = (canvas as OffscreenCanvas).getContext("2d") as OffscreenCanvasRenderingContext2D;
    } else {
      canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      ctx = (canvas as HTMLCanvasElement).getContext("2d") as CanvasRenderingContext2D;
    }
    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, size, size).data;
  } finally {
    image.close();
  }
}

/** Bounded JSON fetch for the OSM map API. */
export async function fetchOsmWaterJson(
  url: string,
  signal: AbortSignal,
): Promise<unknown> {
  const res = await fetch(url, { signal, credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------- recordion

function validateConfig(cfg: ScreeningConfig): void {
  if (
    !Number.isFinite(cfg.center.lat) ||
    Math.abs(cfg.center.lat) > 85 ||
    !Number.isFinite(cfg.center.lon) ||
    Math.abs(cfg.center.lon) > 180
  )
    throw new Error("Analysis center out of range.");
  const { halfSpanKm, contextRingRatio, maxTiles } = cfg;
  if (
    !Number.isFinite(halfSpanKm) ||
    halfSpanKm <= 0 ||
    halfSpanKm > 20 ||
    !Number.isFinite(contextRingRatio) ||
    contextRingRatio < 0 ||
    contextRingRatio > 2 ||
    !Number.isSafeInteger(maxTiles) ||
    maxTiles < 1 ||
    maxTiles > 64
  )
    throw new Error("Invalid screening config.");
}

function baseRecord(cfg: ScreeningConfig, hash: string, attempt: number): ScreeningRun {
  return {
    schema: STORAGE_RECORD_SCHEMA,
    waterEvidenceVersion: 2,
    id: `storage-screening-${hash}-${attempt}`,
    configHash: hash,
    config: cfg,
    status: "failed",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    attempt,
    tilesFetched: 0,
    tilesTotal: 0,
    candidates: [],
    candidateCountTotal: 0,
    error: null,
    limitations: [],
    water: null,
    provenance: {
      method: SCREENING_METHOD,
      terrainSource: TERRAIN_PROVENANCE.sourceId,
      terrainAttribution: TERRAIN_PROVENANCE.attribution,
      terrainUrlTemplate: TERRAIN_PROVENANCE.urlTemplate,
      tileMatrixZoom: 0,
      metersPerPixel: 0,
      verticalDatum: TERRAIN_PROVENANCE.verticalDatum,
      terrainCaveats: TERRAIN_PROVENANCE.caveats,
      waterSource: "OpenStreetMap (API v0.6 bounded map extract)",
      waterAttribution: "© OpenStreetMap contributors (ODbL)",
      waterQueryUrl: null,
      waterRetrievedAt: null,
      waterSkippedOpenWays: null,
      waterSkippedMultipolygons: null,
      runKind: "historical-terrain-screening",
    },
  };
}

/** Run one screening job. Environmental failures produce a `failed` /
 * `cancelled` record; programming errors from out-of-range configs throw
 * before any network access.
 */
export async function runStorageScreening(
  cfg: ScreeningConfig,
  deps: RunDeps,
): Promise<ScreeningRun> {
  validateConfig(cfg);
  const record = baseRecord(cfg, configHash(cfg), 1);
  const { signal } = deps;

  // 1. Bounded analysis extent plus the surrounding terrain context ring.
  const box: DegreesBox = analysisBoxDeg(cfg.center, cfg.halfSpanKm, cfg.contextRingRatio);
  const plan: GridPlan = planGridForBox(box, cfg.maxTiles);
  record.provenance.tileMatrixZoom = plan.zoom;
  record.provenance.metersPerPixel = plan.meterPerPxLat;
  record.tilesTotal = plan.tiles.length;

  // 2. Terrain tiles (budgeted, cancellable, cached per session).
  const cache = deps.tilesCache ?? new Map<string, Uint8ClampedArray>();
  const fetchTile = deps.fetchTile ?? ((u, s) => fetchTerrariumTileRGBA(u, s));
  if (deps.onProgress) deps.onProgress({ phase: "terrain", tilesDone: 0, tilesTotal: plan.tiles.length });
  const tileResults = await Promise.allSettled(
    plan.tiles.map(async (t) => {
      const url = terrariumTileUrl(plan.zoom, t.x, t.y);
      const cached = cache.get(url);
      if (cached) return cached;
      const rgba = await fetchTile(url, signal);
      tileToElevationsM(rgba); // validates dimensions before caching
      cache.set(url, rgba);
      return rgba;
    }),
  );
  if (signal.aborted) {
    record.status = "cancelled";
    record.error = "Cancelled before terrain analysis completed.";
    record.finishedAt = new Date().toISOString();
    return record;
  }
  const rejected = tileResults.filter((r) => r.status === "rejected");
  record.tilesFetched = plan.tiles.length - rejected.length;
  if (rejected.length) {
    const firstReason = (rejected[0] as PromiseRejectedResult).reason;
    record.status = "failed";
    record.error =
      `Terrain tiles unavailable (${String(firstReason && firstReason.message ? firstReason.message : firstReason)}). ` +
      "No depressions are reported: a missing raster is not an absence of storage.";
    record.finishedAt = new Date().toISOString();
    return record;
  }
  const decoded = new Map<string, DecodedTile>();
  plan.tiles.forEach((t, i) => {
    const rgba = (tileResults[i] as PromiseFulfilledResult<Uint8ClampedArray>).value;
    decoded.set(`${t.x}/${t.y}`, { x: t.x, y: t.y, elevations: tileToElevationsM(rgba) });
  });
  deps.onProgress?.({ phase: "analysing", tilesDone: plan.tiles.length, tilesTotal: plan.tiles.length });

  // 3. Deterministic depression screening on the real pixel lattice.
  let elevations: Float64Array;
  try {
    elevations = assembleScreeningGrid(plan, decoded);
  } catch (err) {
    record.status = "failed";
    record.error =
      `Terrain grid assembly failed: ${String((err as Error).message)}. ` +
      "This is a processing error, not an absence of storage.";
    record.finishedAt = new Date().toISOString();
    return record;
  }
  const terrain: StorageTerrain = {
    width: plan.width,
    height: plan.height,
    elevationsM: elevations as unknown as Array<number | null>,
    cellWidthM: plan.meterPerPxLon,
    cellHeightM: plan.meterPerPxLat,
    sourceId: `${TERRAIN_PROVENANCE.sourceId}/z${plan.zoom}/${plan.gx0}-${plan.gy0}`,
    verticalDatum: TERRAIN_PROVENANCE.verticalDatum,
  };
  let screening;
  try {
    screening = findNaturalStorage(terrain);
  } catch (err) {
    record.status = "failed";
    record.error = `Terrain analysis failed: ${String((err as Error).message)}.`;
    record.finishedAt = new Date().toISOString();
    return record;
  }
  if (screening.status !== "complete") {
    record.status = "insufficient-data";
    record.limitations = [...screening.limitations];
    record.finishedAt = new Date().toISOString();
    return record;
  }

  // 4. Existing-water evidence from OpenStreetMap (independent, bounded).
  let waterFeatures: WaterFeature[] | null = null;
  let waterLimitation: string | null = null;
  let waterUrl: string | null = null;
  let skippedOpen = 0;
  let skippedMulti = 0;
  try {
    deps.onProgress?.({ phase: "water", tilesDone: plan.tiles.length, tilesTotal: plan.tiles.length });
    waterUrl = osmMapApiUrl(plan.innerBox);
    const fetchWater = deps.fetchWaterJson ?? ((u, s) => fetchOsmWaterJson(u, s));
    const extract = extractWaterFeatures(await fetchWater(waterUrl, signal));
    waterFeatures = extract.features;
    skippedOpen = extract.skippedOpenWays;
    skippedMulti = extract.skippedWaterRelations;
    const waterRetrievedAt = new Date().toISOString();
    record.provenance.waterRetrievedAt = waterRetrievedAt;
    record.water = { retrievedAt: waterRetrievedAt, features: extract.features };
  } catch (err) {
    if (signal.aborted) {
      record.status = "cancelled";
      record.error = "Cancelled during water-evidence retrieval.";
      record.finishedAt = new Date().toISOString();
      return record;
    }
    waterLimitation =
      `Mapped water evidence unavailable (${String((err as Error).message)}); ` +
      "terrain candidates were not classified against existing water. This is a data gap, not evidence of absence.";
  }
  record.provenance.waterQueryUrl = waterUrl;
  record.provenance.waterSkippedOpenWays = skippedOpen || null;
  record.provenance.waterSkippedMultipolygons = skippedMulti || null;

  // 5. Candidate records with water evidence per candidate.
  const cellAreaM2 = plan.meterPerPxLat * plan.meterPerPxLon;
  const evidenceFor = (cellIndices: readonly number[]): WaterEvidence => {
    if (!waterFeatures)
      return { status: "unavailable", overlapCells: null, overlapAreaM2: null, features: [] };
    const hits = new Map<string, WaterFeature>();
    let overlapCells = 0;
    for (const cell of new Set(cellIndices)) {
      const col = cell % plan.width;
      const row = Math.floor(cell / plan.width);
      const [lon, lat] = cellCenterLonLat(plan, col, row);
      let cellOverlaps = false;
      for (const f of waterFeatures) {
        if (
          lon < f.bbox.west ||
          lon > f.bbox.east ||
          lat < f.bbox.south ||
          lat > f.bbox.north
        )
          continue;
        if (pointInPolygon([lon, lat], { outer: f.outer, holes: [] })) {
          hits.set(f.id, f);
          cellOverlaps = true;
        }
      }
      // Count the candidate cell once even when multiple mapped waters overlap it.
      if (cellOverlaps) overlapCells += 1;
    }
    return {
      status: overlapCells ? "overlaps" : "none-mapped",
      overlapCells,
      overlapAreaM2: overlapCells ? Math.round(overlapCells * cellAreaM2) : 0,
      features: [...hits.values()].map((f) => ({ id: f.id, kind: f.kind, label: f.label })),
    };
  };

  type CandidateDraft = StoredCandidate & { order: number };
  const drafts: CandidateDraft[] = [];
  let croppedSkipped = 0;
  screening.candidates.forEach((c, i) => {
    // A depression partly outside the analyzed pixels (cells on the raster
    // edge) or corner-touching on the lattice cannot form one closed
    // polygon. Skip that candidate and disclose it; never fail the whole
    // run because one grid-edge shape is unmeasurable.
    let polygon: GeoPolygon;
    try {
      polygon = cellsToPolygon(c.cellIndices, plan);
    } catch {
      croppedSkipped += 1;
      return;
    }
    drafts.push({
      id: c.id,
      label: `Terrain depression ${i + 1}`,
      polygon,
      centroid: polygonCentroid(polygon),
      bbox: polygonBBox(polygon),
      spillElevationM: c.spillElevationM,
      minimumElevationM: c.minimumElevationM,
      maximumDepthToSpillM: c.maximumDepthToSpillM,
      footprintAreaM2: c.footprintAreaM2,
      geometricCapacityM3: c.geometricCapacityM3,
      availableStorageM3: null as null,
      suitability: "unassessed" as const,
      waterEvidence: evidenceFor(c.cellIndices),
      order: i,
    });
  });
  const ordered = [...drafts].sort(
    (a, b) => b.geometricCapacityM3 - a.geometricCapacityM3,
  );

  const MAX_LISTED = 200;
  const limited = ordered.length > MAX_LISTED;
  const candidates: StoredCandidate[] = ordered.slice(0, MAX_LISTED).map((d) => ({
    id: d.id,
    label: d.label,
    polygon: d.polygon,
    centroid: d.centroid,
    bbox: d.bbox,
    spillElevationM: d.spillElevationM,
    minimumElevationM: d.minimumElevationM,
    maximumDepthToSpillM: d.maximumDepthToSpillM,
    footprintAreaM2: d.footprintAreaM2,
    geometricCapacityM3: d.geometricCapacityM3,
    availableStorageM3: null,
    suitability: "unassessed",
    waterEvidence: d.waterEvidence,
  }));

  record.status = "succeeded";
  record.candidates = candidates;
  record.candidateCountTotal = drafts.length;
  record.tilesFetched = plan.tiles.length;
  record.tilesTotal = plan.tiles.length;
  record.limitations = [
    ...screening.limitations,
    ...TERRAIN_PROVENANCE.caveats,
    "Elevations are composite DEM surface pixels; no bathymetry, channel or embankment survey is included.",
    "Capacity is geometric empty-basin volume to spill; current fulfilment by existing water is unknown.",
    `${planeNote(plan)}`,
    waterLimitation ?? "",
    croppedSkipped
      ? `${croppedSkipped} depression(s) touch the edges of the analyzed pixels or chain into partly cropped shapes and were skipped: only part of them lies inside the analyzed window, so their geometry cannot be closed.`
      : "",
    skippedOpen
      ? `${skippedOpen} OSM water way(s) skipped (unclosed outline or incomplete nodes); overlap evidence near them is incomplete.`
      : "",
    skippedMulti
      ? `${skippedMulti} water multipolygon relation(s) are unsupported by this parser; their overlap evidence is missing.`
      : "",
    limited
      ? `Run produced ${drafts.length} candidates; the ${MAX_LISTED} largest by geometric capacity are listed.`
      : "",
  ].filter((s): s is string => Boolean(s));
  record.finishedAt = new Date().toISOString();
  return record;
}

function planeNote(plan: GridPlan): string {
  return (
    `Cells are treated as uniform ${plan.meterPerPxLat.toFixed(2)} m squares at the area's mean latitude; ` +
    "per-row metric variation inside the box (<0.2% at this span) is not modeled."
  );
}

// ----------------------------------------------------------------- features

export function candidateMapFeatures(
  candidates: StoredCandidate[],
): { type: "FeatureCollection"; features: Array<GeoJSONFeature> } {
  return {
    type: "FeatureCollection",
    features: candidates.map((c) => ({
      type: "Feature",
      id: c.id,
      properties: {
        id: c.id,
        label: c.label,
        kind: "candidate",
        capacityM3: c.geometricCapacityM3,
        waterStatus: c.waterEvidence.status,
      },
      geometry: { type: "Polygon", coordinates: [c.polygon.outer, ...c.polygon.holes] },
    })),
  };
}

export function waterMapFeatures(
  features: WaterFeature[] | null,
): { type: "FeatureCollection"; features: Array<GeoJSONFeature> } {
  return {
    type: "FeatureCollection",
    features:
      features?.map((f) => ({
        type: "Feature",
        id: f.id,
        properties: { id: f.id, kind: f.kind, label: f.label, waterKind: true },
        geometry: { type: "Polygon", coordinates: [f.outer] },
      })) ?? [],
  };
}

type GeoJSONFeature = {
  type: "Feature";
  id: string;
  properties: Record<string, unknown>;
  geometry: { type: "Polygon"; coordinates: Array<Array<[number, number]>> };
};

// -------------------------------------------------------------- persistence

const STORAGE_KEY = "terrascope-storage-v1";
export const MAX_PERSISTED_CANDIDATES = 60;

export function saveStorageRun(record: ScreeningRun): boolean {
  try {
    const trimmed: ScreeningRun = {
      ...record,
      candidates: record.candidates.slice(0, MAX_PERSISTED_CANDIDATES),
      water: null,
    };
    if (trimmed.candidates.length < record.candidates.length)
      trimmed.limitations = [
        ...trimmed.limitations,
        `Saved session keeps the ${MAX_PERSISTED_CANDIDATES} largest candidates by geometric capacity; re-run to inspect all ${record.candidates.length}.`,
      ];
    const storedWater: StoredWater | null = record.water
      ? { retrievedAt: record.water.retrievedAt, features: record.water.features.slice(0, 120) }
      : null;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...trimmed, storedWater }),
    );
    return true;
  } catch {
    return false;
  }
}

export function loadStorageRun(): ScreeningRun | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (
      v?.schema !== STORAGE_RECORD_SCHEMA ||
      typeof v.configHash !== "string" ||
      typeof v.config?.center?.lat !== "number" ||
      !Array.isArray(v.candidates) ||
      !v.provenance?.method
    )
      return null;
    for (const c of v.candidates)
      if (
        !c?.id ||
        !Array.isArray(c.polygon?.outer) ||
        typeof c.geometricCapacityM3 !== "number" ||
        c.availableStorageM3 !== null
      )
        return null;
    if (v.waterEvidenceVersion !== 2) {
      // Preserve the terrain result and mapped-presence evidence, but never
      // reuse old feature-count values as cell counts/areas.
      v.waterEvidenceVersion = 1;
      v.candidates = v.candidates.map((c: StoredCandidate) => ({
        ...c, waterEvidence: { ...c.waterEvidence, overlapCells: null, overlapAreaM2: null },
      }));
      v.limitations = [...(v.limitations ?? []), "Legacy mapped-water overlap counts are unavailable; re-run screening to calculate unique-cell counts (water evidence v2)."];
    }
    return v as ScreeningRun;
  } catch {
    return null;
  }
}

export function loadStoredWater(): StoredWater | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v?.storedWater?.features ? v.storedWater : null;
  } catch {
    return null;
  }
}

export function clearStoredRun(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable; the run stays in memory for this session */
  }
}
