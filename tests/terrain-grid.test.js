import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TERRARIUM_TILE_URL_TEMPLATE,
  TERRARIUM_TILE_IMAGE_SIZE,
  TERRAIN_PROVENANCE,
  terrariumTileUrl,
  decodeTerrariumPixel,
  tileToElevationsM,
  assembleScreeningGrid,
  cellCenterLonLat,
  cellCornerLonLat,
  boxContainsBox,
} from '../src/flood/storage/terrainGrid.ts';
import { globalPixelYFromLat } from '../src/flood/storage/geo.ts';

const SIDE = 256;

function writeElevation(rgba, pixelIndex, elevationM, alpha = 255) {
  const n = elevationM + 32768;
  const r = Math.floor(n / 256);
  const g = Math.floor(n % 256);
  const b = Math.floor((n - Math.floor(n)) * 256);
  const o = pixelIndex * 4;
  rgba[o] = r;
  rgba[o + 1] = g;
  rgba[o + 2] = b;
  rgba[o + 3] = alpha;
}

function filledTile(elevationM, alpha = 255) {
  const rgba = new Uint8ClampedArray(SIDE * SIDE * 4);
  for (let p = 0; p < SIDE * SIDE; p++) writeElevation(rgba, p, elevationM, alpha);
  return rgba;
}

test('terrarium encoding matches the official worked example and signed range', () => {
  // Official docs: rgb(137,219,68) -> 2523.265625 m
  const docPixel = new Uint8ClampedArray([137, 219, 68, 255]);
  assert.equal(decodeTerrariumPixel(docPixel, 0), 2523.265625);

  // 0 m is exactly the encoding midpoint (128,0,0); negative values survive.
  const zero = new Uint8ClampedArray(4);
  writeElevation(zero, 0, 0);
  assert.equal(decodeTerrariumPixel(zero, 0), 0);
  assert.deepEqual([...zero], [128, 0, 0, 255]);

  const negative = new Uint8ClampedArray(4);
  writeElevation(negative, 0, -100);
  assert.equal(decodeTerrariumPixel(negative, 0), -100);
  assert.deepEqual([...negative], [127, 156, 0, 255]);

  // Sub-metre precision is preserved through the blue channel.
  const fine = new Uint8ClampedArray(4);
  writeElevation(fine, 0, 123.5);
  assert.equal(decodeTerrariumPixel(fine, 0), 123.5);
});

test('tileToElevationsM decodes every pixel and rejects wrong RGBA sizes', () => {
  const rgba = filledTile(42.25);
  const elevations = tileToElevationsM(rgba);
  assert.equal(elevations.length, SIDE * SIDE);
  for (const value of [elevations[0], elevations[1234], elevations.at(-1)]) assert.equal(value, 42.25);

  // Small custom tile size exercises the same row-major layout.
  const small = new Uint8ClampedArray(2 * 2 * 4);
  [0, 1, -50, 2500].forEach((v, i) => writeElevation(small, i, v));
  assert.deepEqual([...tileToElevationsM(small, 2)], [0, 1, -50, 2500]);

  assert.throws(() => tileToElevationsM(new Uint8ClampedArray(100)), /UnexpectedTerrariumTileSize/);
  assert.throws(() => tileToElevationsM(filledTile(1).slice(0, -4)), /UnexpectedTerrariumTileSize/);
});

test('alpha is ignored by the terrarium decoder', () => {
  const a = new Uint8ClampedArray(8);
  const b = new Uint8ClampedArray(8);
  writeElevation(a, 0, 12.75, 0);
  writeElevation(a, 1, -3.5, 128);
  writeElevation(b, 0, 12.75, 255);
  writeElevation(b, 1, -3.5, 255);
  assert.equal(decodeTerrariumPixel(a, 0), decodeTerrariumPixel(b, 0));
  assert.equal(decodeTerrariumPixel(a, 1), decodeTerrariumPixel(b, 1));
  // Same values in a valid 2x2 tile differ only in alpha.
  const a4 = new Uint8ClampedArray(16);
  const b4 = new Uint8ClampedArray(16);
  [12.75, -3.5, 0, 100].forEach((v, i) => writeElevation(a4, i, v, i * 40));
  [12.75, -3.5, 0, 100].forEach((v, i) => writeElevation(b4, i, v, 255 - i * 40));
  assert.deepEqual([...tileToElevationsM(a4, 2)], [...tileToElevationsM(b4, 2)]);
});

test('terrariumTileUrl substitutes zoom/x/y and validates the template', () => {
  assert.equal(
    terrariumTileUrl(13, 42, 7),
    'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/42/7.png',
  );
  assert.equal(terrariumTileUrl(1, 2, 3, 'https://tiles.example/{z}/{x}/{y}.png'), 'https://tiles.example/1/2/3.png');
  assert.throws(() => terrariumTileUrl(1, 2, 3, 'https://tiles.example/all.png'));
  assert.equal(TERRARIUM_TILE_URL_TEMPLATE, TERRAIN_PROVENANCE.urlTemplate);
  assert.equal(TERRARIUM_TILE_IMAGE_SIZE, 256);
});

test('assembleScreeningGrid stitches a 2x3 tile layout with pixel-exact cropping', () => {
  const width = 20;
  const height = 300;
  const gx0 = 250;
  const gy0 = 250;
  const tiles = new Map();
  for (let ty = 0; ty < 3; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const elevations = new Float64Array(SIDE * SIDE);
      elevations.fill(ty * 10 + tx); // distinctive constant per tile
      tiles.set(`${tx}/${ty}`, { x: tx, y: ty, elevations });
    }
  }
  const plan = {
    zoom: 13,
    gx0,
    gy0,
    width,
    height,
    tiles: [...tiles.values()].map(({ x, y }) => ({ x, y })),
    innerBox: { south: 0, west: 0, north: 1, east: 1 },
    gridBox: { south: 0, west: 0, north: 1, east: 1 },
    meanLat: 25.71,
    meterPerPxLat: 17.2,
    meterPerPxLon: 17.2,
  };
  const grid = assembleScreeningGrid(plan, tiles);
  assert.equal(grid.length, width * height);

  const at = (col, row) => grid[row * width + col];
  // Tile 0/0 occupies global pixels [0,256); gx0=250 is 6 px before its edge.
  assert.equal(at(0, 0), 0);
  assert.equal(at(5, 0), 0); // gx=255 still tile 0
  assert.equal(at(6, 0), 1); // gx=256 now tile 1 (edge crop rounds down)
  assert.equal(at(19, 0), 1);
  // Same seam on rows: gy=255 stays in tile row 0, gy=256 enters tile row 1.
  assert.equal(at(0, 5), 0);
  assert.equal(at(0, 6), 10);
  assert.equal(at(0, 299), 20); // gy=549 -> tile row 2 (interior, not just 255)
  assert.equal(at(19, 299), 21);
  // One interior sample per tile row/column.
  assert.equal(at(10, 100), 11); // gx=260 -> tile x1; gy=350 -> tile y1
  assert.equal(at(10, 299), 21); // gy=549 -> tile y2
});

test('assembleScreeningGrid refuses gaps instead of fabricating terrain', () => {
  const width = 8;
  const height = 8;
  const tiles = new Map();
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      tiles.set(`${tx}/${ty}`, {
        x: tx,
        y: ty,
        elevations: new Float64Array(SIDE * SIDE).fill(5),
      });
    }
  }
  const plan = {
    zoom: 13, gx0: 250, gy0: 250, width, height,
    tiles: [...tiles.values()].map(({ x, y }) => ({ x, y })),
    innerBox: { south: 0, west: 0, north: 1, east: 1 },
    gridBox: { south: 0, west: 0, north: 1, east: 1 },
    meanLat: 25.71, meterPerPxLat: 17.2, meterPerPxLon: 17.2,
  };
  tiles.delete('1/1');
  assert.throws(() => assembleScreeningGrid(plan, tiles), /MissingTerrainTile: 1\/1/);

  // Extra unplanned tiles are harmless; the planned set is authoritative.
  const extra = new Map(tiles);
  extra.set('9/9', { x: 9, y: 9, elevations: new Float64Array(SIDE * SIDE).fill(1) });
  extra.set('1/1', { x: 1, y: 1, elevations: new Float64Array(SIDE * SIDE).fill(5) });
  assert.equal(assembleScreeningGrid(plan, extra).length, width * height);
});

test('cell sampling helpers sit half a pixel from the lattice corner', () => {
  const plan = {
    zoom: 13, gx0: 1000, gy0: 900, width: 10, height: 10,
    tiles: [], innerBox: { south: 0, west: 0, north: 1, east: 1 },
    gridBox: { south: 0, west: 0, north: 1, east: 1 },
    meanLat: 25.71, meterPerPxLat: 17.2, meterPerPxLon: 17.2,
  };
  const [lonC, latC] = cellCenterLonLat(plan, 2, 3);
  const [lonCorner, latCorner] = cellCornerLonLat(plan, 2, 3);
  assert.ok(lonC > lonCorner);
  assert.ok(latC < latCorner); // row index grows southward; latitude falls
  const total = 256 * 2 ** 13;
  const expectedLon = ((1000 + 2 + 0.5) / total) * 360 - 180;
  assert.ok(Math.abs(lonC - expectedLon) < 1e-9);
  const expectedLat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * ((900 + 3 + 0.5) / total)))) * 180) / Math.PI;
  assert.ok(Math.abs(latC - expectedLat) < 1e-9);
  // Corner sampling matches the same formulas exported by geo.ts.
  assert.ok(Math.abs(lonCorner - ((1002 / total) * 360 - 180)) < 1e-9);
  assert.ok(Math.abs(latCorner - (Math.atan(Math.sinh(Math.PI * (1 - 2 * (903 / total)))) * 180) / Math.PI) < 1e-9);

  const outer = { south: 0, west: 0, north: 10, east: 10 };
  assert.equal(boxContainsBox(outer, { south: 1, west: 1, north: 9, east: 9 }), true);
  assert.equal(boxContainsBox(outer, { south: -0.1, west: 1, north: 9, east: 9 }), false);
  assert.equal(boxContainsBox(outer, { south: 1, west: 1, north: 10.1, east: 9 }), false);
});

test('globalPixelYFromLat re-export remains available for tile maths', () => {
  assert.ok(Number.isFinite(globalPixelYFromLat(13, 25.71)));
});
