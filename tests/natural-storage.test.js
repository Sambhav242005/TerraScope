import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findNaturalStorage } from '../src/flood/naturalStorage.ts';

const terrain = (rows, extra = {}) => ({
  width: rows[0].length, height: rows.length, elevationsM: rows.flat(),
  cellWidthM: 10, cellHeightM: 20, sourceId: 'synthetic-fixture-v1',
  verticalDatum: 'synthetic local datum', ...extra,
});

test('closed bowl has exact spill height, footprint, capacity and stage-volume curve', () => {
  const input = terrain([[5,5,5],[5,1,5],[5,5,5]]);
  const before = structuredClone(input);
  const result = findNaturalStorage(input), basin = result.candidates[0];
  assert.equal(result.status, 'complete');
  assert.equal(basin.spillElevationM, 5);
  assert.equal(basin.geometricCapacityM3, 800);
  assert.equal(basin.footprintAreaM2, 200);
  assert.equal(basin.maximumDepthToSpillM, 4);
  assert.deepEqual(basin.stageVolume, [{elevationM:1,volumeM3:0},{elevationM:5,volumeM3:800}]);
  assert.equal(basin.availableStorageM3, null);
  assert.equal(basin.suitability, 'unassessed');
  assert.deepEqual(input, before);
  assert.deepEqual(findNaturalStorage(input), result);
});

test('lowest escape controls storage, including a diagonal escape', () => {
  assert.equal(findNaturalStorage(terrain([[2,5,5],[5,1,5],[5,5,5]])).candidates[0].geometricCapacityM3,200);
  assert.equal(findNaturalStorage(terrain([[1,5,5],[5,1,5],[5,5,5]])).candidates.length,0);
});

test('flat and draining slopes have no closed depression; separate bowls stay separate', () => {
  assert.equal(findNaturalStorage(terrain([[3,3,3],[3,3,3],[3,3,3]])).candidates.length,0);
  assert.equal(findNaturalStorage(terrain([[3,2,1],[3,2,1],[3,2,1]])).candidates.length,0);
  const result = findNaturalStorage(terrain([[5,5,5,5,5],[5,1,5,2,5],[5,5,5,5,5]]));
  assert.deepEqual(result.candidates.map(c=>c.geometricCapacityM3),[800,600]);
});

test('compound bowl volume matches explicit sum and does not double-count cells', () => {
  const input = terrain([[5,5,5,5,5],[5,1,3,2,5],[5,5,5,5,5]]);
  const result = findNaturalStorage(input);
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0].geometricCapacityM3,1800);
  assert.deepEqual(result.candidates[0].stageVolume,[
    {elevationM:1,volumeM3:0},{elevationM:2,volumeM3:200},
    {elevationM:3,volumeM3:600},{elevationM:5,volumeM3:1800},
  ]);
});

test('missing elevations block results rather than creating barriers or fake safe areas', () => {
  const result = findNaturalStorage(terrain([[5,null,5],[5,1,5],[5,5,5]]));
  assert.equal(result.status,'insufficient-data');
  assert.equal(result.missingCellCount,1);
  assert.equal(result.filledElevationsM,null);
  assert.deepEqual(result.candidates,[]);
});

test('invalid dimensions, numbers and absent provenance are rejected', () => {
  const rows = [[5,5,5],[5,1,5],[5,5,5]];
  for (const extra of [{width:2}, {cellWidthM:0}, {cellHeightM:Infinity}, {sourceId:''}, {verticalDatum:''}])
    assert.throws(()=>findNaturalStorage(terrain(rows,extra)));
  for (const invalid of [NaN,Infinity,undefined,'2']) {
    const input=terrain(rows); input.elevationsM[4]=invalid;
    assert.throws(()=>findNaturalStorage(input));
  }
});

// Independent exhaustive connectivity oracle: for each cell, find the first
// elevation threshold at which it connects to the edge. No heap/fill algorithm.
test('random small grids agree with independent threshold-connectivity oracle', () => {
  let seed=18;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%9-4;};
  for(let run=0;run<50;run++) {
    const rows=Array.from({length:5},()=>Array.from({length:5},random));
    const input=terrain(rows), z=input.elevationsM;
    const levels=[...new Set(z)].sort((a,b)=>a-b);
    const expected=z.map((height,index)=>levels.find(level=>{
      if(level<height)return false;
      const seen=new Set([index]),queue=[index];
      for(let k=0;k<queue.length;k++) {
        const p=queue[k],r=Math.floor(p/5),c=p%5;
        if(r===0||r===4||c===0||c===4)return true;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          const n=(r+dy)*5+c+dx;
          if(!seen.has(n)&&z[n]<=level){seen.add(n);queue.push(n);}
        }
      }
      return false;
    }));
    assert.deepEqual(findNaturalStorage(input).filledElevationsM,expected);
  }
});
