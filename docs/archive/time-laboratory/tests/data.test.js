import test from 'node:test';
import assert from 'node:assert/strict';
import {history,combinations} from '../src/data.js';
test('eight immutable reproducible histories have coherent shared prefix and bounded values',()=>{
 assert.equal(new Set(combinations).size,8);
 const baseline=history('000');
 for(const id of combinations){const h=history(id);assert.deepEqual(h,history(id));assert.equal(h.snapshots.length,31);assert(Object.isFrozen(h.snapshots));assert.deepEqual(h.snapshots.slice(0,9),baseline.snapshots.slice(0,9));for(const s of h.snapshots){assert(s.population>=0&&s.population<=240);assert(s.freshwater>=0&&s.freshwater<=1);assert(s.vegetation>=0&&s.vegetation<=1);}const extinction=h.snapshots.findIndex(s=>s.population===0);if(extinction>=0)assert(h.snapshots.slice(extinction).every(s=>s.population===0));}
});
test('illustrative freshwater branch finishes above baseline; visual controls cannot change immutable results',()=>{assert(history('100').final.population>history('000').final.population);assert.throws(()=>{history('100').snapshots[15].population=999;},TypeError);assert.throws(()=>history('123'));});
