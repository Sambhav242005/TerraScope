/** Terrain ingestion for storage screening: Mapzen Terrarium DEM tiles.
 * Encoding (official): https://github.com/tilezen/joerd/blob/master/docs/formats.md
 *   elevation_m = (R * 256 + G + B / 256) - 32768   [Web Mercator PNG, 256x256]
 * The analysis grid is the source pixel lattice itself: no resampling.
 * Open-data source; not a survey, not bare-earth, vertical datum alignment
 * is unverified (mixed sources per Mapzen attribution).
 */
import {
  globalPixelX,
  globalPixelYFromLat,
  latAtGlobalPixelY,
  lonAtGlobalPixelX,
  type DegreesBox,
  type GridPlan,
} from "./geo.ts";

export const TERRARIUM_TILE_URL_TEMPLATE =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export const TERRAIN_PROVENANCE = {
  sourceId: "mapzen-terrarium-dem",
  label: "Mapzen Terrain Tiles (terrarium DEM, open data)",
  urlTemplate: TERRARIUM_TILE_URL_TEMPLATE,
  attribution:
    "Terrain: Mapzen Terrain Tiles — see https://github.com/tilezen/joerd/blob/master/docs/attribution.md",
  verticalDatum:
    "Terrarium composite (mixed sources; approximately orthometric). Vertical datum alignment to local benchmarks is unverified.",
  caveats: [
    "DEM pixels represent a surface model: buildings, vegetation, embankments and road fills appear as terrain.",
    "Rivers and lakes may carry artificial or approximate elevations; no bathymetry is contained.",
  ],
};

export function terrariumTileUrl(
  zoom: number,
  x: number,
  y: number,
  template: string = TERRARIUM_TILE_URL_TEMPLATE,
): string {
  if (!template.includes("{z}") || !template.includes("{x}") || !template.includes("{y}"))
    throw new Error("Tile URL template missing placeholders.");
  return template
    .replace("{z}", String(zoom))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

/** Decode one terrarium pixel from its RGBA bytes. */
export function decodeTerrariumPixel(
  rgba: Uint8ClampedArray | Uint8Array,
  pixelOffset: number,
): number {
  const o = pixelOffset * 4;
  return (
    rgba[o] * 256 + rgba[o + 1] + rgba[o + 2] / 256 - 32768
  );
}

export const TERRARIUM_TILE_IMAGE_SIZE = 256;

/** Convert decoded tile RGBA to elevations (shared by browser glue and tests). */
export function tileToElevationsM(
  rgba: Uint8ClampedArray | Uint8Array,
  tileSize: number = TERRARIUM_TILE_IMAGE_SIZE,
): Float64Array {
  if (rgba.length !== tileSize * tileSize * 4)
    throw new Error("UnexpectedTerrariumTileSize: tile RGBA does not match the expected 256x256 layout.");
  const out = new Float64Array(tileSize * tileSize);
  for (let p = 0; p < out.length; p++) out[p] = decodeTerrariumPixel(rgba, p);
  return out;
}

export type DecodedTile = {
  x: number;
  y: number;
  elevations: Float64Array;
};

/** Assemble the screening raster from decoded tiles. Every analysis pixel
 * must exist (renaming gaps as land or water would fabricate depressions),
 * so any missing tile fails the whole run.
 */
export function assembleScreeningGrid(
  plan: GridPlan,
  tiles: ReadonlyMap<string, DecodedTile>,
): Float64Array {
  const byKey = (x: number, y: number) => tiles.get(`${x}/${y}`);
  for (const t of plan.tiles) {
    if (!byKey(t.x, t.y)) throw new Error(`MissingTerrainTile: ${t.x}/${t.y}`);
  }
  const elev = new Float64Array(plan.width * plan.height);
  for (let row = 0; row < plan.height; row++) {
    for (let col = 0; col < plan.width; col++) {
      const gx = plan.gx0 + col;
      const gy = plan.gy0 + row;
      const tx = Math.floor(gx / TERRARIUM_TILE_IMAGE_SIZE);
      const ty = Math.floor(gy / TERRARIUM_TILE_IMAGE_SIZE);
      const tile = byKey(tx, ty);
      if (!tile) throw new Error(`MissingTerrainTile: ${tx}/${ty}`);
      const px = gx - tx * TERRARIUM_TILE_IMAGE_SIZE;
      const py = gy - ty * TERRARIUM_TILE_IMAGE_SIZE;
      elev[row * plan.width + col] = tile.elevations[py * TERRARIUM_TILE_IMAGE_SIZE + px];
    }
  }
  return elev;
}

/** Pure sampling helpers used for tests and water-overlap rasterization. */
export function cellCenterLonLat(
  plan: GridPlan,
  col: number,
  row: number,
): [number, number] {
  return [
    lonAtGlobalPixelX(plan.zoom, plan.gx0 + col + 0.5),
    latAtGlobalPixelY(plan.zoom, plan.gy0 + row + 0.5),
  ];
}

export function cellCornerLonLat(
  plan: GridPlan,
  col: number,
  row: number,
): [number, number] {
  return [
    lonAtGlobalPixelX(plan.zoom, plan.gx0 + col),
    latAtGlobalPixelY(plan.zoom, plan.gy0 + row),
  ];
}

export function boxContainsBox(outer: DegreesBox, inner: DegreesBox): boolean {
  return (
    inner.west >= outer.west &&
    inner.east <= outer.east &&
    inner.south >= outer.south &&
    inner.north <= outer.north
  );
}

export { globalPixelX, globalPixelYFromLat };
