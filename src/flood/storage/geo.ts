/** Web-Mercator tile math and local metric frame for terrain screening.
 * Sources: Mapzen joerd terrarium format (EPSG:3857 PNG tiles, 256px):
 * https://github.com/tilezen/joerd/blob/master/docs/formats.md
 * Local metric conversions use standard ellipsoidal arcs (WGS84).
 * Valid only for bounded areas (<= ~30 km span at these latitudes);
 * no equal-area projection claim is made.
 */

export const TILE_SIZE_PX = 256;
/** findNaturalStorage() raster limit */
export const MAX_GRID_CELLS = 1_000_000;

export type DegreesBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type Center = { lat: number; lon: number };

function assertFiniteCoord(lat: number, lon: number) {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 85 ||
    Math.abs(lon) > 180
  )
    throw new Error("Center coordinates out of supported range.");
}

export function metersPerDegreeLat(latDeg: number): number {
  assertFiniteCoord(latDeg, 0);
  const phi = (latDeg * Math.PI) / 180;
  return (
    111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi)
  );
}

export function metersPerDegreeLon(latDeg: number): number {
  assertFiniteCoord(latDeg, 0);
  const phi = (latDeg * Math.PI) / 180;
  return (
    111412.84 * Math.cos(phi) -
    93.5 * Math.cos(3 * phi) +
    0.118 * Math.cos(5 * phi)
  );
}

export function kmToDegreesLat(km: number, latDeg: number): number {
  if (!Number.isFinite(km) || km <= 0) throw new Error("Invalid span.");
  return (km * 1000) / metersPerDegreeLat(latDeg);
}

export function kmToDegreesLon(km: number, latDeg: number): number {
  if (!Number.isFinite(km) || km <= 0) throw new Error("Invalid span.");
  return (km * 1000) / metersPerDegreeLon(latDeg);
}

/** Box around center, expanded to include a surrounding terrain context ring.
 * The ring matters because raster boundaries are open outlets in the
 * Priority-Flood screening: depression candidates right at a cropped edge
 * would drain and be lost.
 */
export function analysisBoxDeg(
  center: Center,
  halfSpanKm: number,
  contextRingRatio: number,
): DegreesBox {
  assertFiniteCoord(center.lat, center.lon);
  if (
    !Number.isFinite(halfSpanKm) ||
    halfSpanKm <= 0 ||
    halfSpanKm > 20 ||
    !Number.isFinite(contextRingRatio) ||
    contextRingRatio < 0 ||
    contextRingRatio > 2
  )
    throw new Error("Invalid analysis extent parameters.");
  const halfLat = kmToDegreesLat(halfSpanKm, center.lat);
  const halfLon = kmToDegreesLon(halfSpanKm, center.lat);
  const grew = 1 + contextRingRatio;
  return {
    south: Math.max(-85, center.lat - halfLat * grew),
    north: Math.min(85, center.lat + halfLat * grew),
    west: center.lon - halfLon * grew,
    east: center.lon + halfLon * grew,
  };
}

const TILE_DEG = (zoom: number) => 360 / 2 ** zoom;

/** Global pixel coordinates (fractional) of a lon/lat at a tile zoom. */
export function globalPixelX(zoom: number, lon: number): number {
  return ((lon + 180) / 360) * TILE_SIZE_PX * 2 ** zoom;
}

export function lonAtGlobalPixelX(zoom: number, gx: number): number {
  const total = TILE_SIZE_PX * 2 ** zoom;
  const lon = (gx / total) * 360 - 180;
  if (lon < -180 || lon > 180)
    throw new Error("Global pixel x outside the world extent.");
  return lon;
}

export function globalPixelYFromLat(zoom: number, latDeg: number): number {
  assertFiniteCoord(latDeg, 0);
  const phi = (latDeg * Math.PI) / 180;
  const s = Math.sin(phi);
  const total = TILE_SIZE_PX * 2 ** zoom;
  const y =
    total * (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI));
  if (y < 0 || y > total) throw new Error("Latitude out of Mercator range.");
  return y;
}

export function latAtGlobalPixelY(zoom: number, gy: number): number {
  const total = TILE_SIZE_PX * 2 ** zoom;
  const y = gy / total;
  if (y < 0 || y > 1)
    throw new Error("Global pixel y outside the world extent.");
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}

/** East-west ground distance per pixel; locally equals the north-south
 * pixel spacing (first-order, at the given latitude), so screening cells
 * are treated as uniform squares of this size at the area's mean latitude.
 */
export function metersPerPixelAt(latDeg: number, zoom: number): number {
  assertFiniteCoord(latDeg, 0);
  if (!Number.isSafeInteger(zoom) || zoom < 0 || zoom > 22)
    throw new Error("Invalid tile zoom.");
  return (156543.03392 * Math.cos((latDeg * Math.PI) / 180)) / 2 ** zoom;
}

function tileIndexRange(minDeg: number, maxDeg: number, zoom: number, axis: "x" | "y"): [number, number] {
  const n = 2 ** zoom;
  if (axis === "x") {
    const first = Math.floor(globalPixelX(zoom, minDeg) / TILE_SIZE_PX);
    const lastExcl = Math.ceil(globalPixelX(zoom, maxDeg) / TILE_SIZE_PX);
    if (first < 0 || lastExcl > n) throw new Error("Box exceeds the world extent.");
    return [first, Math.max(0, lastExcl - first)];
  }
  const first = Math.floor(globalPixelYFromLat(zoom, maxDeg) / TILE_SIZE_PX);
  const lastExcl = Math.ceil(globalPixelYFromLat(zoom, minDeg) / TILE_SIZE_PX);
  if (first < 0 || lastExcl > n) throw new Error("Box exceeds the world extent.");
  return [first, Math.max(0, lastExcl - first)];
}

export function tilesCoveringBox(
  box: DegreesBox,
  zoom: number,
): Array<{ x: number; y: number }> {
  const [x0, xCount] = tileIndexRange(box.west, box.east, zoom, "x");
  const [y0, yCount] = tileIndexRange(box.south, box.north, zoom, "y");
  const list: Array<{ x: number; y: number }> = [];
  for (let y = y0; y < y0 + yCount; y++)
    for (let x = x0; x < x0 + xCount; x++) list.push({ x, y });
  return list;
}

/** Highest tile zoom whose tile budget still covers the box. */
export function chooseZoomForBox(box: DegreesBox, maxTiles: number): number {
  if (!Number.isSafeInteger(maxTiles) || maxTiles < 1 || maxTiles > 256)
    throw new Error("Tile budget out of range.");
  if (Math.abs(box.east - box.west) >= 360 || Math.abs(box.north - box.south) >= 85)
    throw new Error("Analysis box too large.");
  for (let z = 15; z >= 6; z--) {
    if (tilesCoveringBox(box, z).length <= maxTiles) return z;
  }
  throw new Error("No supported tile zoom covers this extent within budget.");
}

/** Planning structure tying a pixel-lattice analysis grid to its tiles. */
export type GridPlan = {
  zoom: number;
  /** Global pixel lattice of the grid: x in [gx0, gx0+width), y likewise. */
  gx0: number;
  gy0: number;
  width: number;
  height: number;
  tiles: Array<{ x: number; y: number }>;
  /** Degrees of the requested analysis box (inner), for reference. */
  innerBox: DegreesBox;
  /** Exact degree edges of the pixel lattice analyzed (includes context ring). */
  gridBox: DegreesBox;
  meanLat: number;
  /** Uniform metric cell size (uniform-cell approximation at the mean latitude). */
  meterPerPxLat: number; // north-south metric size
  meterPerPxLon: number; // east-west metric size
};

function pixelCornerBox(
  plan: Pick<GridPlan, "gx0" | "gy0" | "width" | "height" | "zoom">,
): DegreesBox {
  return {
    west: lonAtGlobalPixelX(plan.zoom, plan.gx0),
    east: lonAtGlobalPixelX(plan.zoom, plan.gx0 + plan.width),
    north: latAtGlobalPixelY(plan.zoom, plan.gy0),
    south: latAtGlobalPixelY(plan.zoom, plan.gy0 + plan.height),
  };
}

/** Snap the box to whole global pixels at the chosen zoom and cap cells. */
export function planGridForBox(
  box: DegreesBox,
  maxTiles: number,
  maxCells: number = MAX_GRID_CELLS,
): GridPlan {
  let zoom = chooseZoomForBox(box, maxTiles);
  let gx0: number, gx1: number, gy0: number, gy1: number, w: number, h: number;
  for (;;) {
    gx0 = Math.floor(globalPixelX(zoom, box.west));
    gx1 = Math.ceil(globalPixelX(zoom, box.east));
    gy0 = Math.floor(globalPixelYFromLat(zoom, box.north));
    gy1 = Math.ceil(globalPixelYFromLat(zoom, box.south));
    w = gx1 - gx0;
    h = gy1 - gy0;
    if (!Number.isSafeInteger(w) || w < 3 || h < 3)
      throw new Error("Analysis grid collapses below the solvable size.");
    if (tilesCoveringBox(box, zoom).length > maxTiles) {
      if (zoom === 6)
        throw new Error("No supported tile zoom covers this extent within budget.");
      zoom -= 1;
      continue;
    }
    if (w * h <= maxCells) break;
    if (zoom === 6)
      throw new Error("Analysis extent exceeds the cell cap at every supported zoom.");
    zoom -= 1;
  }
  const meanLat = (box.north + box.south) / 2;
  const plan: GridPlan = {
    zoom,
    gx0,
    gy0,
    width: w,
    height: h,
    tiles: tilesCoveringBox(box, zoom),
    innerBox: box,
    gridBox: pixelCornerBox({ zoom, gx0, gy0, width: w, height: h }),
    meanLat,
    meterPerPxLat: metersPerPixelAt(meanLat, zoom),
    meterPerPxLon: metersPerPixelAt(meanLat, zoom),
  };
  return plan;
}
