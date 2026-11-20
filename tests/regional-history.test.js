import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadHistory, historyUrl, parseRegionalSeries, readHistoryCache, requestDays, saveHistoryCache, HISTORY_CACHE_KEY } from '../src/flood/regionalHistory.ts';
const request = { lat: 25.8, lon: 78.25, start: '2024-09-01', end: '2024-09-03' };
const hash = 'a'.repeat(64);
const fixture = kind => ({ latitude:25.775, longitude:78.275, utc_offset_seconds:0,
  hourly_units:{precipitation:'mm'}, hourly:{time:requestDays(request).flatMap(d=>Array.from({length:24},(_,h)=>d+'T'+String(h).padStart(2,'0')+':00')),precipitation:Array(72).fill(1)},
  daily_units:{river_discharge:'m³/s'},daily:{time:requestDays(request),river_discharge:[0,null,400]} });
const parse = (raw, kind='flow')=>parseRegionalSeries(raw,request,kind,new Date().toISOString(),hash);
test('requests bind dates, coordinates and UTC with explicit rainfall model',()=>{
  assert.equal(new URL(historyUrl(request,'rain')).searchParams.get('models'),'era5');
  assert.equal(new URL(historyUrl(request,'flow')).searchParams.get('timezone'),'GMT');
  assert.equal(new URL(historyUrl(request,'flow')).searchParams.get('longitude'),'78.25');
  for(const change of [{lat:NaN},{lon:181},{start:'2024-02-30'},{start:'2024-10-01'},{start:'2020-01-01'},{end:'2090-01-01'}]) assert.throws(()=>requestDays({...request,...change}));
});
test('daily precipitation refuses incomplete hours and preserves zero flow and missing days',()=>{
  const raw=fixture();raw.hourly.precipitation[24]=null;
  assert.deepEqual(parse(raw,'rain').values,[24,null,24]);
  assert.deepEqual(parse(raw).values,[0,null,400]);
  assert.equal(parse(raw).riverMatch,'unverified');
});
test('malformed units, time axes, distant cells and negative data fail closed',()=>{
  for(const edit of [r=>r.daily.time.reverse(),r=>r.daily.time.pop(),r=>r.daily.river_discharge[0]=-1,r=>r.daily.river_discharge[0]='0',r=>r.latitude=28,r=>r.longitude=85,r=>r.daily_units.river_discharge='mm',r=>r.utc_offset_seconds=19800]) {
    const raw=fixture();edit(raw);assert.throws(()=>parse(raw));
  }
  const raw=fixture();raw.hourly.time.pop();assert.throws(()=>parse(raw,'rain'));
});
test('HTTP errors and byte budget do not become empty successful histories',async()=>{
  const signal=new AbortController().signal;
  await assert.rejects(downloadHistory(request,'flow',signal,async()=>new Response('',{status:429})),/429/);
  await assert.rejects(downloadHistory(request,'flow',signal,async()=>new Response(' '.repeat(1500001))),/budget/);
});
test('validated response records query, hash, timestamp and returned cell',async()=>{
  const series=await downloadHistory(request,'flow',new AbortController().signal,async()=>new Response(JSON.stringify(fixture())));
  assert.match(series.sha256,/^[a-f0-9]{64}$/);
  assert.equal(series.longitude,78.275);
  assert.equal(series.url,historyUrl(request,'flow'));
});
test('abort before and after a transport result cannot publish history',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(downloadHistory(request,'flow',controller.signal,()=>{throw Error('must not request')}),{name:'AbortError'});
  const late=new AbortController();
  await assert.rejects(downloadHistory(request,'flow',late.signal,async()=>{late.abort();return new Response(JSON.stringify(fixture()))}),{name:'AbortError'});
});
test('cache is region/date-specific, expires and rejects corruption',()=>{
  const store=new Map();const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  const series=parse(fixture());assert.equal(saveHistoryCache(storage,series),true);
  assert.deepEqual(readHistoryCache(storage,request,'flow'),series);
  assert.equal(readHistoryCache(storage,{...request,lon:85},'flow'),null);
  assert.equal(readHistoryCache(storage,request,'flow',new Date(Date.now()+8*86400000)),null);
  const corrupt=JSON.parse(storage.getItem(HISTORY_CACHE_KEY));corrupt[0].values=[-1,0,0];storage.setItem(HISTORY_CACHE_KEY,JSON.stringify(corrupt));
  assert.equal(readHistoryCache(storage,request,'flow'),null);
  assert.equal(saveHistoryCache({getItem(){throw Error()},setItem(){}},series),false);
});
