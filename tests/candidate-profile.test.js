import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidateTerrainProfile, isCandidateTerrainProfile } from '../src/flood/storage/candidateProfile.ts';

/** 11x11 synthetic bowl: 100 m rim, 88 m floor at the centre. */
function bowl() {
  const width = 11;
  const height = 11;
  const elevations = new Float64Array(width * height);
  const cells = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const dx = col - 5;
      const dy = row - 5;
      const t = (dx * dx + dy * dy) / (2.5 * 2.5);
      const elevation = 100 - (t < 1 ? 12 * (1 - t) : 0);
      elevations[row * width + col] = elevation;
      if (elevation < 100) cells.push(row * width + col);
    }
  }
  return { width, height, elevations, cells };
}

const toLonLat = (col, row) => [85 + col * 0.001, 25 + row * 0.001];

test('missing transect terrain is unavailable rather than bridged', () => {
  const { width, height, elevations, cells } = bowl();
  elevations[5 * width + 1] = NaN;
  assert.equal(candidateTerrainProfile({width, height, elevationsM: elevations,
    cellIndices: cells, cellWidthM: 100, cellHeightM: 100, spillElevationM: 100, toLonLat}), null);
});

test('invalid sampling limits fall back and corrupt saved profiles are rejected', () => {
  const { width, height, elevations, cells } = bowl();
  const profile = candidateTerrainProfile({width, height, elevationsM: elevations,
    cellIndices: cells, cellWidthM: 100, cellHeightM: 100, spillElevationM: 100, toLonLat, maxPoints: NaN});
  assert.ok(isCandidateTerrainProfile(profile));
  assert.equal(isCandidateTerrainProfile({...profile, points: []}), false);
  assert.equal(isCandidateTerrainProfile({...profile, floorElevationM: Infinity}), false);
  assert.equal(isCandidateTerrainProfile({...profile, points: [...profile.points].reverse()}), false);
  assert.equal(isCandidateTerrainProfile(null), false);
});

test('candidateTerrainProfile crosses the lowest cell and exposes the spill rim', () => {
  const { width, height, elevations, cells } = bowl();
  const profile = candidateTerrainProfile({
    width,
    height,
    elevationsM: elevations,
    cellIndices: cells,
    cellWidthM: 100,
    cellHeightM: 100,
    spillElevationM: 100,
    toLonLat,
  });
  assert.ok(profile);
  assert.equal(profile.axis, 'east-west');
  assert.equal(profile.points[0].elevationM, 100);
  assert.equal(profile.points.at(-1).elevationM, 100);
  assert.equal(profile.floorElevationM, 88);
  assert.equal(profile.floorDistanceM, 400);
  assert.equal(profile.spillElevationM, 100);
  assert.deepEqual(profile.start, [85.001, 25.005]);
  assert.deepEqual(profile.end, [85.009, 25.005]);
  assert.ok(profile.points.length <= 36);
  assert.ok(profile.points.some((p) => p.distanceM === profile.floorDistanceM));
});

test('candidateTerrainProfile uses the longer axis for a north-south basin', () => {
  const width = 9;
  const height = 15;
  const elevations = new Float64Array(width * height).fill(100);
  const cells = [];
  for (let row = 4; row <= 10; row++) {
    for (let col = 4; col <= 5; col++) {
      const index = row * width + col;
      elevations[index] = 92;
      cells.push(index);
    }
  }
  const profile = candidateTerrainProfile({
    width,
    height,
    elevationsM: elevations,
    cellIndices: cells,
    cellWidthM: 30,
    cellHeightM: 30,
    spillElevationM: 100,
    toLonLat,
  });
  assert.ok(profile);
  assert.equal(profile.axis, 'north-south');
  assert.equal(profile.floorElevationM, 92);
  assert.equal(profile.points[0].elevationM, 100);
  assert.equal(profile.points.at(-1).elevationM, 100);
  assert.ok(profile.points.length <= 36);
});

test('candidateTerrainProfile is deterministic and decimates around the floor', () => {
  const { width, height, elevations, cells } = bowl();
  const args = {
    width,
    height,
    elevationsM: elevations,
    cellIndices: cells,
    cellWidthM: 100,
    cellHeightM: 100,
    spillElevationM: 100,
    toLonLat,
    maxPoints: 6,
  };
  const first = candidateTerrainProfile(args);
  const second = candidateTerrainProfile(args);
  assert.deepEqual(first, second);
  assert.ok(first);
  assert.ok(first.points.length <= 7);
  assert.ok(first.points.some((p) => p.distanceM === first.floorDistanceM));
  assert.equal(first.points[0].distanceM, 0);
});

test('candidateTerrainProfile refuses empty, invalid or missing-elevation candidates', () => {
  const { width, height, elevations } = bowl();
  assert.equal(
    candidateTerrainProfile({
      width,
      height,
      elevationsM: elevations,
      cellIndices: [],
      cellWidthM: 100,
      cellHeightM: 100,
      spillElevationM: 100,
      toLonLat,
    }),
    null,
  );
  assert.equal(
    candidateTerrainProfile({
      width,
      height,
      elevationsM: elevations,
      cellIndices: [9999],
      cellWidthM: 100,
      cellHeightM: 100,
      spillElevationM: 100,
      toLonLat,
    }),
    null,
  );
  assert.equal(
    candidateTerrainProfile({
      width,
      height,
      elevationsM: elevations,
      cellIndices: [0, 1],
      cellWidthM: 0,
      cellHeightM: 100,
      spillElevationM: 100,
      toLonLat,
    }),
    null,
  );
});
