import { test } from 'node:test';
import assert from 'node:assert/strict';
import { regionalReports, validLocation } from '../src/flood/areaReview/catalog.ts';
import { parseAir, queryArea, createAreaLoader, geometryForAir } from '../src/flood/areaReview/query.ts';
const now = new Date('2026-11-17T01:30:00Z');
const fixture = () => ({ latitude: 25.6, longitude: 85.2, utc_offset_seconds: 0,
  hourly_units: { pm2_5: 'μg/m³', us_aqi: 'USAQI' },
  hourly: { time: ['2026-11-17T00:00','2026-11-17T01:00','2026-11-17T02:00'], pm2_5: [1, null, 3], us_aqi: [1, 2, 3] } });
const parse = value => parseAir(value, 25.7, 85.18, now);
test('regional references are scoped and never establish a local corridor', () => {
  assert.equal(regionalReports(25.7,85.18).length,4);
  assert.equal(regionalReports(51,0).length,0);
  assert.equal(regionalReports(NaN,85).length,0);
  assert.equal(validLocation(91,0),false);
  assert.match(regionalReports(25.7,85.18)[1].summary,/not a Sonpur/);
});
test('null is preserved and future hour is not selected', () => {
  const air=parse(fixture()); assert.equal(air.pm25,null); assert.equal(air.usAqi,2);
  assert.equal(air.validTime,'2026-11-17T01:00:00.000Z');
  assert.equal(air.kind,'modeled-pollution'); assert.equal(air.issuedAt,null);
});
test('stale data cannot emit geometry', () => {
  const air=parseAir(fixture(),25.7,85.18,new Date('2026-11-20T00:00:00Z'));
  assert.equal(air.status,'stale'); assert.equal(geometryForAir(air).features.length,0);
});
test('empty data and outside returned geography fail closed', () => {
  for (const change of [x=>x.hourly.time=[],x=>x.latitude=50,x=>x.longitude=0,x=>x.utc_offset_seconds=3600,x=>x.hourly_units.pm2_5='mg/m³',x=>x.hourly.us_aqi=[1]]) {
    const data=fixture(); change(data); assert.throws(()=>parse(data));
  }
});
test('malformed, negative and nonfinite values and dates fail validation', () => {
  for (const value of [-1,NaN,Infinity,'2',undefined]) { const data=fixture(); data.hourly.pm2_5[1]=value; assert.throws(()=>parse(data)); }
  for (const value of ['bad','2026-02-30T01:00','2026-11-17T00:00']) { const data=fixture(); data.hourly.time[1]=value; assert.throws(()=>parse(data)); }
});
test('all missing has no geometry; zero is a genuine value', () => {
  const data=fixture(); data.hourly.us_aqi[1]=null;
  assert.equal(parse(data).status,'missing'); assert.equal(geometryForAir(parse(data)).features.length,0);
  data.hourly.pm2_5[1]=0; assert.equal(parse(data).pm25,0);
  assert.equal(geometryForAir(parse(data)).features[0].geometry.type,'Point');
});
test('HTTP failure retains regional evidence and explicit gap', async () => {
  const r=await queryArea(25.7,85.18,new AbortController().signal,async()=>new Response('',{status:429}),now);
  assert.equal(r.reports.length,4); assert.equal(r.air,null); assert.match(r.airError,/unavailable/);
});
test('real transport shape parses and response size is bounded', async () => {
  const r=await queryArea(25.7,85.18,new AbortController().signal,async()=>new Response(JSON.stringify(fixture())),now);
  assert.equal(r.air.usAqi,2);
  const tooLarge=await queryArea(25.7,85.18,new AbortController().signal,async()=>new Response(' '.repeat(100001)),now);
  assert.equal(tooLarge.air,null);
});
test('pre-abort performs no request; late aborted response never returns results', async () => {
  const c=new AbortController(); c.abort();
  await assert.rejects(queryArea(25,85,c.signal,async()=>{throw Error('must not fetch');}),{name:'AbortError'});
  const late=new AbortController();
  await assert.rejects(queryArea(25.7,85.18,late.signal,async()=>{late.abort(); return new Response(JSON.stringify(fixture()));},now),{name:'AbortError'});
});
test('superseded responses and cancelled work never publish', async () => {
  const pending=[]; const published=[];
  const loader=createAreaLoader((lat,lon,signal)=>new Promise(resolve=>pending.push({resolve,signal,lat})));
  const a=loader.load(1,1,r=>published.push(r)); const b=loader.load(2,2,r=>published.push(r));
  assert.equal(pending[0].signal.aborted,true);
  pending[1].resolve({latitude:2}); await b; pending[0].resolve({latitude:1}); await a;
  assert.deepEqual(published,[{latitude:2}]);
  const c=loader.load(3,3,r=>published.push(r)); loader.cancel(); pending[2].resolve({latitude:3}); await c;
  assert.equal(published.length,1);
});
test('timeout aborts transport and preserves report-only results', async (t) => {
  t.mock.timers.enable({apis:['setTimeout']});
  let captured;
  const job=queryArea(25.7,85.18,new AbortController().signal,async (_url,{signal})=> {
    captured=signal;
    return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))));
  },now);
  t.mock.timers.tick(12001);
  const result=await job;
  assert.equal(captured.aborted,true); assert.equal(result.reports.length,4); assert.equal(result.air,null);
});
