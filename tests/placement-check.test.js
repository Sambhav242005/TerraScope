import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkPlacement} from '../src/flood/placementCheck.ts';

const polygon = (w,s,e,n) => ({type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]});
const intervention = (extra={}) => ({id:'proposal-1',name:'Proposal',kind:'solar_array',lat:0.5,lon:0.5,createdAt:'2026-11-05',areaM2:10000,status:'proposed',footprint:polygon(0,0,1,1),...extra});
const source = (extra={}) => ({id:'osm-v1',label:'Bounded OSM mapping',url:'https://www.openstreetmap.org',retrievedAt:'2026-11-05T00:00:00Z',coverage:[-1,-1,20,20],limitations:['Incomplete mapped extract.'],sha256:'a'.repeat(64),...extra});
const feature = (geometry,extra={}) => ({id:'way/1',kind:'river',sourceId:'osm-v1',geometry,...extra});
const evidence = (features=[],sources=[source()]) => ({sources,features});

test('full footprint catches a river whose area crosses the proposal while the pin misses it',()=>{
 const result=checkPlacement(intervention(),evidence([feature(polygon(0.9,-1,1.1,2))]));
 assert.equal(result.status,'conflict');assert.deepEqual(result.findings[0].featureIds,['way/1']);
 assert.deepEqual(result.findings[0].sourceIds,['osm-v1']);assert.match(result.headline,/reconsider/i);
});

test('polygon containment in either direction is detected without relying on boundary crossings',()=>{
 for(const shape of [polygon(-0.5,-0.5,1.5,1.5),polygon(0.2,0.2,0.3,0.3)]){
  assert.equal(checkPlacement(intervention(),evidence([feature(shape)])).status,'conflict');
 }
});

test('bbox-only overlap never becomes a mapped conflict',()=>{
 const triangle={type:'Polygon',coordinates:[[[0.9,2],[2,0.9],[2,2],[0.9,2]]]};
 const result=checkPlacement(intervention(),evidence([feature(triangle)]));
 assert.equal(result.status,'investigate');assert.equal(result.findings.length,0);
 assert.match(result.headline,/unassessed/);assert.ok(result.unknowns.some(s=>s.includes('not proof')));
});

test('a proposal entirely in a polygon hole has no overlap, but touching the hole boundary counts',()=>{
 const donut=polygon(0,0,10,10);donut.coordinates.push(polygon(3,3,7,7).coordinates[0]);
 assert.equal(checkPlacement(intervention({footprint:polygon(4,4,6,6)}),evidence([feature(donut)])).findings.length,0);
 assert.equal(checkPlacement(intervention({footprint:polygon(3,4,4,5)}),evidence([feature(donut)])).status,'conflict');
});

test('shared outer boundaries and road centerline crossings count as overlap without a made-up setback',()=>{
 assert.equal(checkPlacement(intervention(),evidence([feature(polygon(1,0,2,1))])).status,'conflict');
 const result=checkPlacement(intervention(),evidence([feature({type:'LineString',coordinates:[[-1,0.5],[2,0.5]]},{kind:'road'})]));
 assert.equal(result.status,'conflict');assert.equal(result.findings[0].kind,'road');
 const clear=checkPlacement(intervention(),evidence([feature({type:'LineString',coordinates:[[1.1,-1],[1.1,2]]},{kind:'road'})]));
 assert.equal(clear.findings.length,0);
});

test('line wholly in a proposal hole is excluded; a line on the hole boundary warns',()=>{
 const footprint=polygon(0,0,10,10);footprint.coordinates.push(polygon(3,3,7,7).coordinates[0]);
 const line=(coords)=>feature({type:'LineString',coordinates:coords},{kind:'road'});
 assert.equal(checkPlacement(intervention({footprint}),evidence([line([[4,4],[6,6]])])).findings.length,0);
 assert.equal(checkPlacement(intervention({footprint}),evidence([line([[3,4],[3,6]])])).status,'conflict');
});

test('manual area becomes a documented area-equivalent square; provided polygon is preserved',()=>{
 const item=intervention({footprint:undefined,lat:25.7,lon:85.16,areaM2:10000});
 const result=checkPlacement(item,null);const ring=result.footprint.coordinates[0];
 assert.ok(Math.abs((ring[1][0]-ring[0][0])*111320*Math.cos(25.7*Math.PI/180)-100)<1e-7);
 assert.ok(Math.abs((ring[2][1]-ring[1][1])*111132-100)<1e-7);
 assert.match(result.footprintMethod,/orientation\/shape assumed/);assert.match(result.footprintMethod,/No regulatory setback/);
 const exact=polygon(0,0,1,2);assert.deepEqual(checkPlacement(intervention({footprint:exact}),null).footprint,exact);
});

test('a positive mapped conflict remains visible outside source coverage; no-hit outside coverage stays unassessed',()=>{
 const small=source({coverage:[5,5,6,6]});
 const result=checkPlacement(intervention(),evidence([feature(polygon(-1,-1,2,2))],[small]));
 assert.equal(result.status,'conflict');assert.ok(result.unknowns.some(s=>s.includes('outside')));
 const noHit=checkPlacement(intervention(),evidence([],[small]));assert.notEqual(noHit.status,'conflict');
 assert.ok(noHit.unknowns.some(s=>s.includes('outside')));assert.match(noHit.headline,/unassessed/);
});

test('missing or empty evidence never gives suitability clearance',()=>{
 for(const supplied of [null,evidence([],[])]){
  const result=checkPlacement(intervention(),supplied);assert.equal(result.status,'unknown');
  assert.ok(result.unknowns.some(s=>s.includes('Land rights')));assert.ok(result.unknowns.some(s=>s.includes('effect model unavailable')));
 }
});

test('vegetation overlap asks about riparian connectivity rather than treating all water overlap as forbidden',()=>{
 const data=evidence([feature(polygon(-1,-1,2,2))]);
 assert.equal(checkPlacement(intervention({kind:'wind_turbine'}),data).status,'conflict');
 const vegetation=checkPlacement(intervention({kind:'vegetation_buffer'}),data);
 assert.equal(vegetation.status,'investigate');assert.match(vegetation.findings[0].message,/riparian buffer/);
 assert.ok(vegetation.unknowns.some(s=>s.includes('Riparian connectivity')));
});

test('historical map-color overlap preserves dates and is never described as current risk or depth',()=>{
 const data=evidence([feature(polygon(-1,-1,2,2),{kind:'historical-flood',sourceId:'nrsc-1'})],[source({id:'nrsc-1',label:'NRSC rendered map',date:'2024-10-01'})]);
 const result=checkPlacement(intervention(),data);assert.equal(result.status,'investigate');
 assert.match(result.findings[0].message,/2024-10-01/);assert.match(result.findings[0].message,/not validated flood risk/);
 assert.deepEqual(result.findings[0].sourceIds,['nrsc-1']);
});

test('conflicts are grouped per kind with sorted feature/source identifiers and do not mutate inputs',()=>{
 const data=evidence([feature(polygon(0,0,1,1),{id:'b'}),feature(polygon(0,0,1,1),{id:'a'})]);
 const item=intervention();const before=structuredClone({data,item});
 const a=checkPlacement(item,data),b=checkPlacement(item,data);
 assert.deepEqual(a,b);assert.equal(a.findings.length,1);assert.deepEqual(a.findings[0].featureIds,['a','b']);
 assert.deepEqual({data,item},before);
});

test('specific engineering/data gaps are named for every intervention kind',()=>{
 const expected={storage_basin:/outlet and overflow/,solar_array:/solar resource/,wind_turbine:/power curve and wakes/,vegetation_buffer:/soil\/infiltration/};
 for(const [kind,pattern] of Object.entries(expected))assert.ok(checkPlacement(intervention({kind}),evidence()).unknowns.some(s=>pattern.test(s)));
});

test('invalid proposals, malformed polygons, orphan evidence, and invalid source metadata fail visibly',()=>{
 for(const extra of [{lat:NaN},{areaM2:0},{lon:181},{kind:'bad'}])assert.throws(()=>checkPlacement(intervention(extra),null));
 const shapes=[{type:'Polygon',coordinates:[]},{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1]]]},{type:'LineString',coordinates:[[NaN,0],[1,1]]}];
 for(const geometry of shapes)assert.throws(()=>checkPlacement(intervention(),evidence([feature(geometry)])));
 assert.throws(()=>checkPlacement(intervention(),evidence([feature(polygon(0,0,1,1),{sourceId:'missing'})])));
 assert.throws(()=>checkPlacement(intervention(),evidence([],[source({sha256:''})])));
 assert.throws(()=>checkPlacement(intervention(),evidence([],[source({coverage:[0,0,0,1]})])));
 assert.throws(()=>checkPlacement(intervention(),evidence([feature(polygon(0,0,1,1)),feature(polygon(0,0,1,1))])));
});
