/** Terrain-only screening; never a flood forecast or construction recommendation.
 * Priority-Flood method: Barnes, Lehman & Mulla (2014), doi:10.1016/j.cageo.2013.04.024.
 * Original implementation; 8-neighbour connectivity and open raster boundaries.
 */
export type StorageTerrain = {
  width: number;
  height: number;
  elevationsM: readonly (number | null)[];
  cellWidthM: number;
  cellHeightM: number;
  sourceId: string;
  verticalDatum: string;
};

export type NaturalStorageCandidate = {
  id: string;
  cellIndices: number[];
  spillElevationM: number;
  minimumElevationM: number;
  maximumDepthToSpillM: number;
  footprintAreaM2: number;
  geometricCapacityM3: number;
  // Actual water already present and operational constraints are unknown.
  availableStorageM3: null;
  suitability: 'unassessed';
  stageVolume: Array<{ elevationM: number; volumeM3: number }>;
};

export type StorageScreening = {
  method: 'priority-flood-d8-v1';
  status: 'complete' | 'insufficient-data';
  sourceId: string;
  verticalDatum: string;
  missingCellCount: number;
  filledElevationsM: number[] | null;
  candidates: NaturalStorageCandidate[];
  limitations: string[];
};

type Entry = { index: number; level: number };
class MinHeap {
  private items: Entry[] = [];
  get size() { return this.items.length; }
  private before(a: Entry, b: Entry) {
    return a.level < b.level || (a.level === b.level && a.index < b.index);
  }
  push(entry: Entry) {
    this.items.push(entry);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(entry, this.items[parent])) break;
      this.items[i] = this.items[parent];
      i = parent;
    }
    this.items[i] = entry;
  }
  pop(): Entry {
    const result = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length) {
      let i = 0;
      while (2 * i + 1 < this.items.length) {
        let child = 2 * i + 1;
        if (child + 1 < this.items.length && this.before(this.items[child + 1], this.items[child])) child++;
        if (!this.before(this.items[child], last)) break;
        this.items[i] = this.items[child];
        i = child;
      }
      this.items[i] = last;
    }
    return result;
  }
}

/** Cell indices are row-major; ingestion must supply actual metric cell dimensions,
 * not degrees. Extent/georeferencing is retained by the calling dataset adapter.
 * Reject incomplete rasters rather than treating gaps as barriers or drains.
 */
export function findNaturalStorage(terrain: StorageTerrain): StorageScreening {
  const { width, height, elevationsM, cellWidthM, cellHeightM } = terrain;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 3 || height < 3
    || width * height > 1_000_000 || elevationsM.length !== width * height) {
    throw new Error('Expected a 3x3 or larger bounded raster, at most 1,000,000 cells.');
  }
  if (![cellWidthM, cellHeightM].every(v => Number.isFinite(v) && v > 0)
    || !Number.isFinite(cellWidthM * cellHeightM * elevationsM.length)) {
    throw new Error('Finite positive metric cell dimensions are required.');
  }
  if (!terrain.sourceId?.trim() || !terrain.verticalDatum?.trim()) {
    throw new Error('Source ID and vertical datum are required.');
  }
  let missingCellCount = 0;
  for (const value of elevationsM) {
    if (value === null) missingCellCount++;
    else if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid elevation; encode missing data as null.');
  }
  const result: StorageScreening = {
    method: 'priority-flood-d8-v1', status: 'complete', sourceId: terrain.sourceId,
    verticalDatum: terrain.verticalDatum, missingCellCount, filledElevationsM: null, candidates: [],
    limitations: [
      'Terrain depressions only: not all wetlands, ponds or connected floodplain storage are detected.',
      'Geometric capacity assumes an impermeable empty basin; available storage is unknown.',
      'Raster edges are open outlets; crop extent, resolution, DEM errors and unrepresented culverts affect results.',
      'No catchment inflow, rainfall routing, existing-water subtraction, soil, habitat or land-rights assessment.',
      'Connected compound depressions are reported at their final spill level, not as a hierarchy of sub-basins.',
    ],
  };
  if (missingCellCount) {
    result.status = 'insufficient-data';
    result.limitations.unshift('Missing elevation prevents capacity screening; absence of candidates is not absence of storage.');
    return result;
  }
  const ground = elevationsM as readonly number[];
  const filled = [...ground];
  const visited = new Uint8Array(ground.length);
  const heap = new MinHeap();
  function neighbours(index: number, visit: (other: number) => void) {
    const row = Math.floor(index / width), col = index % width;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const y = row + dy, x = col + dx;
      if ((dx || dy) && x >= 0 && x < width && y >= 0 && y < height) visit(y * width + x);
    }
  }
  for (let i = 0; i < ground.length; i++) {
    const row = Math.floor(i / width), col = i % width;
    if (row === 0 || row === height - 1 || col === 0 || col === width - 1) {
      visited[i] = 1;
      heap.push({ index: i, level: ground[i] });
    }
  }
  while (heap.size) {
    const current = heap.pop();
    neighbours(current.index, next => {
      if (visited[next]) return;
      visited[next] = 1;
      filled[next] = Math.max(ground[next], current.level);
      heap.push({ index: next, level: filled[next] });
    });
  }
  result.filledElevationsM = filled;
  const grouped = new Uint8Array(ground.length);
  const area = cellWidthM * cellHeightM;
  for (let i = 0; i < ground.length; i++) {
    if (grouped[i] || filled[i] <= ground[i]) continue;
    const cells = [i], spill = filled[i];
    grouped[i] = 1;
    for (let cursor = 0; cursor < cells.length; cursor++) {
      neighbours(cells[cursor], next => {
        if (!grouped[next] && filled[next] === spill && filled[next] > ground[next]) {
          grouped[next] = 1;
          cells.push(next);
        }
      });
    }
    cells.sort((a, b) => a - b);
    const sortedHeights = cells.map(cell => ground[cell]).sort((a, b) => a - b);
    // Exact piecewise-linear stage-volume breakpoints, computed in O(n log n).
    const stageVolume: NaturalStorageCandidate['stageVolume'] = [];
    let submerged = 0, sum = 0;
    for (const elevationM of [...new Set(sortedHeights), spill]) {
      while (submerged < sortedHeights.length && sortedHeights[submerged] < elevationM) {
        sum += sortedHeights[submerged++];
      }
      const volumeM3 = (submerged * elevationM - sum) * area;
      if (!Number.isFinite(volumeM3)) throw new Error('Capacity calculation overflow.');
      stageVolume.push({ elevationM, volumeM3: Math.max(0, volumeM3) });
    }
    result.candidates.push({
      id: `depression-${i}`, cellIndices: cells, spillElevationM: spill,
      minimumElevationM: sortedHeights[0], maximumDepthToSpillM: spill - sortedHeights[0],
      footprintAreaM2: cells.length * area, geometricCapacityM3: stageVolume.at(-1)!.volumeM3,
      availableStorageM3: null, suitability: 'unassessed', stageVolume,
    });
  }
  return result;
}
