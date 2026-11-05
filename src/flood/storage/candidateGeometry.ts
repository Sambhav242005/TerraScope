/** Candidate geometry: turn depression cell indices into geographic
 * polygons matching the terrain pixel lattice exactly.
 *
 * Rings are chained in north-up lattice coordinates (x = column boundary
 * east, y = -row north) with the basin interior kept on the left of travel,
 * so exterior rings come out counter-clockwise (positive signed area) and
 * holes clockwise. Coordinates convert to [lon, lat] exact to the DEM
 * lattice, rounded to 1e-7 degrees (~1 cm) for compact storage.
 */
import type { GridPlan } from "./geo.ts";

export type LatticePoint = { x: number; y: number };

type Edge = { from: LatticePoint; to: LatticePoint; used?: boolean };

const same = (a: LatticePoint, b: LatticePoint) => a.x === b.x && a.y === b.y;
const nodeKey = (p: LatticePoint) => `${p.x},${p.y}`;

function cellBoundaryEdges(
  cell: number,
  width: number,
  inSet: (i: number) => boolean,
): Edge[] {
  const col = cell % width;
  const row = Math.floor(cell / width);
  const x = col;
  const yTop = -row; // north edge (north-up coords)
  const yBot = -(row + 1); // south edge
  const edges: Edge[] = [];
  // North neighbour absent (or beyond grid): interior south -> travel west.
  if (!inSet(cell - width)) edges.push({ from: { x: x + 1, y: yTop }, to: { x, y: yTop } });
  // South neighbour absent: interior north -> travel east.
  if (!inSet(cell + width)) edges.push({ from: { x, y: yBot }, to: { x: x + 1, y: yBot } });
  // West neighbour absent or grid edge: interior east -> travel south.
  if (!inSet(cell - 1) || col === 0)
    edges.push({ from: { x, y: yTop }, to: { x, y: yBot } });
  // East neighbour absent or grid edge: interior west -> travel north.
  if (!inSet(cell + 1) || col === width - 1)
    edges.push({ from: { x: x + 1, y: yBot }, to: { x: x + 1, y: yTop } });
  return edges;
}

/** Chain directed boundary edges into closed loops. Edge directions are
 * unique per boundary side, so chaining is deterministic.
 */
export function chainBoundaryEdges(edges: Edge[]): LatticePoint[][] {
  const starts = new Map<string, Edge[]>();
  for (const e of edges) {
    const list = starts.get(nodeKey(e.from)) ?? [];
    list.push(e);
    starts.set(nodeKey(e.from), list);
  }
  const loops: LatticePoint[][] = [];
  for (const first of edges) {
    if (first.used) continue;
    first.used = true;
    const loop: LatticePoint[] = [first.from];
    let edge = first;
    for (;;) {
      loop.push(edge.to);
      if (same(edge.to, first.from)) break;
      const candidates = starts.get(nodeKey(edge.to)) ?? [];
      const next = candidates.find((c) => !c.used);
      if (!next) throw new Error("Unchained boundary after edge walk.");
      next.used = true;
      edge = next;
    }
    loops.push(loop);
  }
  return loops;
}

export function latticeSignedArea(loop: LatticePoint[]): number {
  let a = 0;
  for (let i = 0; i < loop.length - 1; i++)
    a += loop[i].x * loop[i + 1].y - loop[i + 1].x * loop[i].y;
  return a / 2;
}

const round7 = (n: number) => Math.round(n * 1e7) / 1e7;

function latticeToGeo(v: LatticePoint, plan: GridPlan): [number, number] {
  const gx = plan.gx0 + v.x;
  const gy = plan.gy0 - v.y;
  if (gx < plan.gx0 || gx > plan.gx0 + plan.width)
    throw new Error("Vertex outside analysis lattice (x).");
  if (gy < plan.gy0 || gy > plan.gy0 + plan.height)
    throw new Error("Vertex outside analysis lattice (y).");
  const total = 256 * 2 ** plan.zoom;
  const lon = (gx / total) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * (gy / total)))) * 180) / Math.PI;
  return [round7(lon), round7(lat)];
}

export type GeoPolygon = {
  /** [lon,lat] ring, counter-clockwise, closed (first === last). */
  outer: Array<[number, number]>;
  /** Clockwise hole rings, closed. */
  holes: Array<Array<[number, number]>>;
};

export function cellsToPolygon(
  cells: readonly number[],
  plan: GridPlan,
): GeoPolygon {
  if (!cells.length) throw new Error("No cells for polygon.");
  const set = new Set(cells);
  const inSet = (i: number) => set.has(i);
  const edges: Edge[] = [];
  for (const cell of cells) {
    const row = Math.floor(cell / plan.width);
    if (row === 0 || row === plan.height - 1)
      throw new Error(
        "Candidate cell touches the vertical grid edge; closed depressions cannot exist there.",
      );
    for (const e of cellBoundaryEdges(cell, plan.width, inSet)) edges.push(e);
  }
  const loops = chainBoundaryEdges(edges);
  const outerLoops = loops.filter((l) => latticeSignedArea(l) > 0);
  const holeLoops = loops.filter((l) => latticeSignedArea(l) < 0);
  if (outerLoops.length !== 1)
    throw new Error("Polygons must have exactly one exterior ring per candidate.");
  return {
    outer: closeRing(outerLoops[0].map((v) => latticeToGeo(v, plan))),
    holes: holeLoops.map((l) => closeRing(l.map((v) => latticeToGeo(v, plan)))),
  };
}

function closeRing(ring: Array<[number, number]>): Array<[number, number]> {
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

export function polygonCentroid(poly: GeoPolygon): [number, number] {
  const xs = poly.outer.slice(0, -1).map((p) => p[0]);
  const ys = poly.outer.slice(0, -1).map((p) => p[1]);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
}

export function polygonBBox(poly: GeoPolygon): {
  south: number;
  west: number;
  north: number;
  east: number;
} {
  const xs = poly.outer.slice(0, -1).map((p) => p[0]);
  const ys = poly.outer.slice(0, -1).map((p) => p[1]);
  return {
    west: Math.min(...xs),
    east: Math.max(...xs),
    south: Math.min(...ys),
    north: Math.max(...ys),
  };
}

/** Point-in-polygon with holes: outside the exterior ring, or inside any
 * hole, means not inside.
 */
export function pointInPolygon(
  point: [number, number],
  poly: GeoPolygon,
): boolean {
  if (!ringContains(poly.outer, point)) return false;
  for (const hole of poly.holes) if (ringContains(hole, point)) return false;
  return true;
}

function ringContains(
  ring: Array<[number, number]>,
  point: [number, number],
): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[(i + 1) % n];
    if (yi === yj) continue;
    if (yi > point[1] !== yj > point[1]) {
      const xCross = ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
      if (point[0] < xCross) inside = !inside;
    }
  }
  return inside;
}
