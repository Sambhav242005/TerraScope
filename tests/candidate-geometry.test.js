import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chainBoundaryEdges,
  latticeSignedArea,
  cellsToPolygon,
  polygonCentroid,
  polygonBBox,
  pointInPolygon,
} from '../src/flood/storage/candidateGeometry.ts';
import { analysisBoxDeg, planGridForBox } from '../src/flood/storage/geo.ts';
import { cellCenterLonLat } from '../src/flood/storage/terrainGrid.ts';

// Mirrors the documented boundary orientation: x = column boundary (east),
// y = -row (north-up); basin interior stays on the left of travel.
function boundaryEdges(cells, width) {
  const set = new Set(cells);
  const inSet = (i) => set.has(i);
  const edges = [];
  for (const cell of cells) {
    const col = cell % width;
    const row = Math.floor(cell / width);
    const yTop = -row;
    const yBot = -(row + 1);
    if (!inSet(cell - width))
      edges.push({ from: { x: col + 1, y: yTop }, to: { x: col, y: yTop } });
    if (!inSet(cell + width))
      edges.push({ from: { x: col, y: yBot }, to: { x: col + 1, y: yBot } });
    if (!inSet(cell - 1) || col === 0)
      edges.push({ from: { x: col, y: yTop }, to: { x: col, y: yBot } });
    if (!inSet(cell + 1) || col === width - 1)
      edges.push({ from: { x: col + 1, y: yBot }, to: { x: col + 1, y: yTop } });
  }
  return edges;
}

const loopArea = (cells, width) =>
  chainBoundaryEdges(boundaryEdges(cells, width)).map(latticeSignedArea);

test('chained lattice loops have CCW exterior and CW holes with the expected areas', () => {
  // Single cell (row 1, col 1 in a 3-wide grid): square area 1.
  const one = loopArea([4], 3);
  assert.equal(one.length, 1);
  assert.equal(one[0], 1);

  // 2x2 block in a 4-wide grid: area 4, one loop.
  const block = loopArea([5, 6, 9, 10], 4);
  assert.equal(block.length, 1);
  assert.equal(block[0], 4);

  // L-shape of three cells: area 3, still a single simple loop.
  const ell = loopArea([6, 7, 11], 5);
  assert.equal(ell.length, 1);
  assert.equal(ell[0], 3);

  // 5x5 block with the centre cell missing: exterior +25, hole -1.
  const ringCells = [];
  for (let i = 0; i < 25; i++) if (i !== 12) ringCells.push(i);
  const ring = loopArea(ringCells, 5).sort((a, b) => b - a);
  assert.equal(ring.length, 2);
  assert.equal(ring[0], 25);
  assert.equal(ring[1], -1);
});

test('chainBoundaryEdges closes every loop and visits each edge exactly once', () => {
  const edges = boundaryEdges([6, 7, 11], 5);
  const loops = chainBoundaryEdges(edges);
  assert.equal(loops.length, 1);
  const loop = loops[0];
  assert.deepEqual(loop[0], loop.at(-1));
  assert.equal(new Set(edges).size, edges.length);
  assert.ok(edges.every((e) => e.used === true));
});

test('cellsToPolygon builds a closed [lon,lat] exterior ring inside the inner box', () => {
  const box = analysisBoxDeg({ lat: 25.71, lon: 85.16 }, 0.03, 0);
  const plan = planGridForBox(box, 16);
  assert.ok(plan.width > 8 && plan.height > 8);

  const cells = [
    5 * plan.width + 5,
    5 * plan.width + 6,
    6 * plan.width + 5,
    6 * plan.width + 6,
  ];
  const polygon = cellsToPolygon(cells, plan);
  const { outer, holes } = polygon;
  assert.ok(outer.length > 4);
  assert.deepEqual(outer[0], outer.at(-1));
  assert.equal(holes.length, 0);
  for (const [lon, lat] of outer) {
    assert.ok(lon >= plan.innerBox.west && lon <= plan.innerBox.east, `lon ${lon}`);
    assert.ok(lat >= plan.innerBox.south && lat <= plan.innerBox.north, `lat ${lat}`);
  }

  // Centre of the 2x2 block is inside; a point well outside is not.
  const center = cellCenterLonLat(plan, 5.5, 5.5);
  assert.equal(pointInPolygon(center, polygon), true);
  assert.equal(pointInPolygon([plan.innerBox.west - 0.01, plan.innerBox.south - 0.01], polygon), false);

  // Centroid is the midpoint of the polygon bbox for this square block.
  const centroid = polygonCentroid(polygon);
  const bbox = polygonBBox(polygon);
  assert.ok(Math.abs(centroid[0] - (bbox.west + bbox.east) / 2) < 1e-12);
  assert.ok(Math.abs(centroid[1] - (bbox.south + bbox.north) / 2) < 1e-12);
});

test('polygons preserve interior holes and pointInPolygon honours them', () => {
  const box = analysisBoxDeg({ lat: 25.71, lon: 85.16 }, 0.03, 0);
  const plan = planGridForBox(box, 16);
  const cells = [];
  for (let row = 4; row <= 8; row++)
    for (let col = 4; col <= 8; col++)
      if (!(row === 6 && col === 6)) cells.push(row * plan.width + col);

  const polygon = cellsToPolygon(cells, plan);
  assert.equal(polygon.outer.length > 4, true);
  assert.equal(polygon.holes.length, 1);
  const hole = polygon.holes[0];
  assert.deepEqual(hole[0], hole.at(-1));

  const holeCenter = cellCenterLonLat(plan, 6, 6);
  assert.equal(pointInPolygon(holeCenter, polygon), false);
  const ringCell = cellCenterLonLat(plan, 4, 4);
  assert.equal(pointInPolygon(ringCell, polygon), true);

  // Orientation is documented: exterior CCW, hole CW in [lon,lat] space.
  const signedGeoArea = (ring) => {
    let a = 0;
    for (let i = 0; i < ring.length - 1; i++)
      a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    return a / 2;
  };
  assert.ok(signedGeoArea(polygon.outer) > 0);
  assert.ok(signedGeoArea(polygon.holes[0]) < 0);
});

test('pointInPolygon treats a simple ring plus hole as a set difference', () => {
  const outer = [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]];
  const hole = [[1, 1], [1, 2], [2, 2], [2, 1], [1, 1]];
  const polygon = { outer, holes: [hole] };
  assert.equal(pointInPolygon([2, 2], { outer, holes: [] }), true);
  assert.equal(pointInPolygon([1.5, 1.5], polygon), false);
  assert.equal(pointInPolygon([0.5, 0.5], polygon), true);
  assert.equal(pointInPolygon([5, 2], polygon), false);
  assert.equal(pointInPolygon([-0.5, 2], polygon), false);
});

test('cellsToPolygon refuses candidates that touch the top or bottom grid edge', () => {
  const box = analysisBoxDeg({ lat: 25.71, lon: 85.16 }, 0.03, 0);
  const plan = planGridForBox(box, 16);
  assert.throws(() => cellsToPolygon([2], plan), /grid edge/i);
  assert.throws(() => cellsToPolygon([(plan.height - 1) * plan.width + 2], plan), /grid edge/i);
  assert.throws(() => cellsToPolygon([], plan), /No cells/i);
});
