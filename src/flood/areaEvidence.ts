import type {PlacementEvidence, EvidenceFeature} from './placementCheck.ts';
import {osmMapApiUrl} from './storage/osmWater.ts';
export function areaBounds(c:{lat:number;lon:number}):[number,number,number,number]{const dy=2/111.132,dx=2/(111.32*Math.cos(c.lat*Math.PI/180));return [Math.max(-180,c.lon-dx),Math.max(-85,c.lat-dy),Math.min(180,c.lon+dx),Math.min(85,c.lat+dy)];}
/** Stable identity for an evidence fetch area. Five decimals is about 1 m;
 *  finer keys would defeat retry caching without changing the 2 km box. */
export function placementAreaKey(c:{lat:number;lon:number}):string{return `${c.lat.toFixed(5)},${c.lon.toFixed(5)}`;}
export function parseAreaEvidence(doc:unknown,box:[number,number,number,number],url:string,retrievedAt:string,sha256:string):PlacementEvidence{
 if(!doc||!Array.isArray((doc as any).elements))throw Error('Invalid map extract');
 const elements=(doc as any).elements,nodes=new Map<number,[number,number]>();for(const n of elements)if(n.type==='node'&&Number.isFinite(n.lon)&&Number.isFinite(n.lat))nodes.set(n.id,[n.lon,n.lat]);
 const id='osm-area-'+box.map(n=>n.toFixed(5)).join('-'),features:EvidenceFeature[]=[];
 for(const w of elements){if(w.type!=='way'||!Array.isArray(w.nodes))continue;const t=w.tags??{},coords=w.nodes.map((n:number)=>nodes.get(n));if(coords.length<2||coords.some((c:unknown)=>!c))continue;
 const closed=coords.length>=4&&coords[0][0]===coords.at(-1)[0]&&coords[0][1]===coords.at(-1)[1];const kind=t.building?'building':t.highway||t.railway?'road':t.water==='river'||t.waterway==='river'||t.waterway==='riverbank'?'river':t.natural==='water'||t.natural==='wetland'||t.landuse==='reservoir'?'water':null;if(!kind||((kind==='building'||kind==='water')&&!closed))continue;
 features.push({id:id+'/way/'+w.id,sourceId:id,kind,label:kind==='building'?'Mapped building':t['name:en']??t.name??kind,geometry:closed&&kind!=='road'?{type:'Polygon',coordinates:[coords]}:{type:'LineString',coordinates:coords}});}
 return {sources:[{id,label:'Selected-area OSM buildings, roads/rail and water',url,retrievedAt,sha256,coverage:box,limitations:['Incomplete mapping; multipolygon relations and incomplete ways omitted. Absence is not clearance.','Geographic WGS84 coordinates. Road/rail widths, underground infrastructure, land rights and current conditions unknown.']}],features};
}
export async function fetchAreaEvidence(c:{lat:number;lon:number},signal:AbortSignal){const box=areaBounds(c),url=osmMapApiUrl({west:box[0],south:box[1],east:box[2],north:box[3]});const r=await fetch(url,{signal});if(!r.ok)throw Error('OSM unavailable');const text=await r.text();if(text.length>12_000_000)throw Error('Map extract exceeds 12 MB budget');const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return parseAreaEvidence(JSON.parse(text),box,url,new Date().toISOString(),Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join(''));}
