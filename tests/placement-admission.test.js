import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assessPlacement,placementBlock,checkScenePlacement} from '../src/flood/placementAdmission.ts';import {createIntervention} from '../src/flood/intervention.ts';import {parseAreaEvidence,areaBounds,placementAreaKey} from '../src/flood/areaEvidence.ts';
const evidence=JSON.parse(fs.readFileSync(new URL('../public/data/placement-evidence.json',import.meta.url)));
test('admission blocks mapped houses, roads, channels and unknown coverage rather than drawing collisions',()=>{
 for(const kind of ['building','road','river']){const f=evidence.features.find(f=>f.kind===kind);const coords=f.geometry.type==='Polygon'?f.geometry.coordinates[0][0]:f.geometry.coordinates[0];assert.match(placementBlock(createIntervention('solar_array',{lon:coords[0],lat:coords[1]}),evidence,[]),/blocked/i);}
 assert.match(placementBlock(createIntervention('solar_array',{lat:20,lon:80}),evidence,[]),/outside loaded/);
 assert.match(placementBlock(createIntervention('solar_array',{lat:25.7,lon:85.16}),null,[]),/unavailable/);
});
test('proposal-to-proposal collision blocks the whole solar group; deleting it permits the same location',()=>{const a=createIntervention('solar_array',{lat:25.685,lon:85.145});const b=createIntervention('solar_array',{lat:25.685,lon:85.145});assert.equal(placementBlock(a,evidence,[]),null);assert.match(placementBlock(b,evidence,[a]),/intersects/);assert.equal(checkScenePlacement(b,evidence,[a]).status,'conflict');assert.equal(placementBlock(b,evidence,[]),null);});
test('riparian vegetation overlapping a mapped river is admitted as an investigation, while a land footprint there is blocked',()=>{const vegetation=assessPlacement(createIntervention('vegetation_buffer',{lat:25.682,lon:85.142}),evidence,[]);assert.equal(vegetation.block,null);assert.equal(vegetation.check.status,'investigate');assert.ok(vegetation.check.findings.some(f=>f.kind==='river'));const solar=assessPlacement(createIntervention('solar_array',{lat:25.682,lon:85.142}),evidence,[]);assert.match(solar.block,/river/i);});
test('admission distinguishes a real mapped conflict from a coverage gap that should trigger an area refetch',()=>{
 const clear=assessPlacement(createIntervention('solar_array',{lat:25.686,lon:85.163}),evidence,[]);
 assert.equal(clear.block,null);assert.equal(clear.needsAreaEvidence,false);assert.equal(clear.check.status,'investigate');
 const conflict=assessPlacement(createIntervention('solar_array',{lat:25.7,lon:85.16}),evidence,[]);
 assert.match(conflict.block,/blocked/i);assert.equal(conflict.needsAreaEvidence,false);assert.equal(conflict.check.status,'conflict');
 const outside=assessPlacement(createIntervention('solar_array',{lat:20,lon:80}),evidence,[]);
 assert.match(outside.block,/outside loaded/i);assert.equal(outside.needsAreaEvidence,true);
 const unavailable=assessPlacement(createIntervention('solar_array',{lat:25.71,lon:85.16}),null,[]);
 assert.match(unavailable.block,/unavailable/i);assert.equal(unavailable.needsAreaEvidence,true);
});
test('check-area keys are stable at metre scale so retries reuse the same evidence',()=>{assert.equal(placementAreaKey({lat:25.710001,lon:85.160001}),placementAreaKey({lat:25.710002,lon:85.160002}));assert.notEqual(placementAreaKey({lat:25.71,lon:85.16}),placementAreaKey({lat:25.72,lon:85.16}));});
test('new area parser extracts buildings and road/rail, omits incomplete ways and records coverage',()=>{const elements=[{type:'node',id:1,lon:77,lat:12},{type:'node',id:2,lon:77.001,lat:12},{type:'node',id:3,lon:77.001,lat:12.001},{type:'way',id:1,nodes:[1,2,3,1],tags:{building:'yes'}},{type:'way',id:2,nodes:[1,2],tags:{railway:'rail'}},{type:'way',id:3,nodes:[1,99],tags:{highway:'primary'}}];const e=parseAreaEvidence({elements},[76.9,11.9,77.1,12.1],'https://api.openstreetmap.org','now','hash');assert.equal(e.features.length,2);assert.deepEqual(e.features.map(f=>f.kind),['building','road']);assert.ok(areaBounds({lat:12,lon:77})[0]<77);assert.throws(()=>parseAreaEvidence({},[0,0,1,1],'url','now','hash'));});
