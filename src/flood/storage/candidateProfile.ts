/** A single height-map transect through a candidate depression.
 *
 * This is inspection geometry derived from the same terrain grid used by the
 * Priority-Flood screen. It is not a survey, a channel cross-section or a
 * hydraulic model. The line is chosen through the lowest candidate cell along
 * the longer side of the candidate bounding box, with a small context margin
 * so the spill rim is visible.
 */
export type TerrainProfilePoint = {
  distanceM: number;
  elevationM: number;
};

export type CandidateTerrainProfile = {
  axis: "east-west" | "north-south";
  points: TerrainProfilePoint[];
  /** Distance from the transect start to the lowest candidate cell. */
  floorDistanceM: number;
  floorElevationM: number;
  spillElevationM: number;
  /** Transect endpoints as [lon, lat] for map inspection. */
  start: [number, number];
  end: [number, number];
};

export type CandidateProfileInput = {
  width: number;
  height: number;
  elevationsM: ArrayLike<number>;
  cellIndices: readonly number[];
  cellWidthM: number;
  cellHeightM: number;
  spillElevationM: number;
  toLonLat: (col: number, row: number) => [number, number];
  maxPoints?: number;
};

const DEFAULT_MAX_POINTS = 36;

/** Optional persisted inspection data must not invalidate a saved candidate. */
export function isCandidateTerrainProfile(value: unknown): value is CandidateTerrainProfile {
  if (!value || typeof value !== "object") return false;
  const p = value as CandidateTerrainProfile;
  const coordinate = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);
  if ((p.axis !== "east-west" && p.axis !== "north-south") ||
    !Array.isArray(p.points) || p.points.length < 2 || p.points.length > 121 ||
    ![p.floorDistanceM, p.floorElevationM, p.spillElevationM].every(Number.isFinite) ||
    !coordinate(p.start) || !coordinate(p.end)) return false;
  return p.points.every((point, i) => point && Number.isFinite(point.distanceM) &&
    point.distanceM >= 0 && Number.isFinite(point.elevationM) &&
    (i === 0 || point.distanceM > p.points[i - 1].distanceM)) &&
    p.points.some(point => point.distanceM === p.floorDistanceM && point.elevationM === p.floorElevationM);
}

/** Build a decimated DEM transect, or null when the candidate has no usable
 * cells or the transect crosses missing terrain. Never bridge data gaps. */
export function candidateTerrainProfile(
  input: CandidateProfileInput,
): CandidateTerrainProfile | null {
  const {
    width,
    height,
    elevationsM,
    cellIndices,
    cellWidthM,
    cellHeightM,
    spillElevationM,
    toLonLat,
  } = input;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    elevationsM.length !== width * height ||
    !Number.isFinite(cellWidthM) ||
    cellWidthM <= 0 ||
    !Number.isFinite(cellHeightM) ||
    cellHeightM <= 0 ||
    !Number.isFinite(spillElevationM)
  )
    return null;

  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;
  let lowestIndex = -1;
  let lowestElevation = Infinity;
  for (const cell of cellIndices) {
    if (!Number.isSafeInteger(cell) || cell < 0 || cell >= elevationsM.length) continue;
    const elevation = elevationsM[cell];
    if (!Number.isFinite(elevation)) continue;
    const row = Math.floor(cell / width);
    const col = cell % width;
    if (row < minRow) minRow = row;
    if (row > maxRow) maxRow = row;
    if (col < minCol) minCol = col;
    if (col > maxCol) maxCol = col;
    if (elevation < lowestElevation || (elevation === lowestElevation && cell < lowestIndex)) {
      lowestElevation = elevation;
      lowestIndex = cell;
    }
  }
  if (lowestIndex < 0) return null;

  const lowestRow = Math.floor(lowestIndex / width);
  const lowestCol = lowestIndex % width;
  const eastWest =
    (maxCol - minCol + 1) * cellWidthM >= (maxRow - minRow + 1) * cellHeightM;
  const margin = 2;
  const axis = eastWest ? "east-west" : "north-south";

  const samples: TerrainProfilePoint[] = [];
  let floorSample = 0;
  let startCell: [number, number];
  let endCell: [number, number];
  if (eastWest) {
    const row = lowestRow;
    const startCol = Math.max(0, minCol - margin);
    const endCol = Math.min(width - 1, maxCol + margin);
    for (let col = startCol; col <= endCol; col++) {
      const elevation = elevationsM[row * width + col];
      if (!Number.isFinite(elevation)) return null;
      if (col === lowestCol) floorSample = samples.length;
      samples.push({ distanceM: (col - startCol) * cellWidthM, elevationM: elevation });
    }
    startCell = [startCol, row];
    endCell = [endCol, row];
  } else {
    const col = lowestCol;
    const startRow = Math.max(0, minRow - margin);
    const endRow = Math.min(height - 1, maxRow + margin);
    for (let row = startRow; row <= endRow; row++) {
      const elevation = elevationsM[row * width + col];
      if (!Number.isFinite(elevation)) return null;
      if (row === lowestRow) floorSample = samples.length;
      samples.push({ distanceM: (row - startRow) * cellHeightM, elevationM: elevation });
    }
    startCell = [col, startRow];
    endCell = [col, endRow];
  }
  if (samples.length < 2) return null;

  const requested = input.maxPoints ?? DEFAULT_MAX_POINTS;
  const maxPoints = Number.isFinite(requested)
    ? Math.max(4, Math.min(120, Math.floor(requested)))
    : DEFAULT_MAX_POINTS;
  let points = samples;
  if (samples.length > maxPoints) {
    const keep = new Set<number>();
    const step = (samples.length - 1) / (maxPoints - 1);
    for (let i = 0; i < maxPoints; i++) keep.add(Math.round(i * step));
    keep.add(floorSample);
    points = [...keep]
      .sort((a, b) => a - b)
      .map((index) => samples[index]);
  }
  const floorPoint =
    points.find((p) => p.distanceM === samples[floorSample].distanceM) ??
    samples[floorSample];

  return {
    axis,
    points,
    floorDistanceM: floorPoint.distanceM,
    floorElevationM: floorPoint.elevationM,
    spillElevationM,
    start: toLonLat(startCell[0], startCell[1]),
    end: toLonLat(endCell[0], endCell[1]),
  };
}
