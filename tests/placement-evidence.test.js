import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {checkPlacement} from '../src/flood/placementCheck.ts';
import {createIntervention} from '../src/flood/intervention.ts';
const evidence=JSON.parse(fs.readFileSync(new URL('../public/data/placement-evidence.json',import.meta.url)));
test('real archived channel geometries identify Ganges and Gandak independently of decorative map layers',()=>{
 for(const [lon,lat,name] of [[85.14,25.68,'Ganges'],[85.1893961,25.695,'Gandak']]){
  const checked=checkPlacement(createIntervention('wind_turbine',{lon,lat}),evidence);
  assert.equal(checked.status,'conflict');assert.ok(checked.findings.some(f=>f.kind==='river'&&f.message.includes(name)));
 }
 assert.ok(evidence.features.every(f=>!['tree','wood','depression'].includes(f.kind)));
});
test('real NRSC color evidence remains dated and no-coverage never becomes suitability clearance',()=>{
 const result=checkPlacement(createIntervention('solar_array',{lon:85.1,lat:25.8}),evidence);
 assert.ok(result.findings.some(f=>f.kind==='historical-flood'&&f.message.includes('2024-10-01')));
 const outside=checkPlacement(createIntervention('solar_array',{lon:80,lat:20}),evidence);
 assert.equal(outside.status,'unknown');assert.match(outside.headline,/Outside available coverage/);
});
test('placement source fingerprints match archived OSM and both NRSC input images',()=>{
 const source=evidence.sources.find(s=>s.id==='osm-context-20261104');
 const hash=path=>crypto.createHash('sha256').update(fs.readFileSync(new URL(path,import.meta.url))).digest('hex');
 assert.equal(source.sha256,hash('../artifacts/osm-source.xml'));
 const manifest=JSON.parse(fs.readFileSync(new URL('../public/data/nrsc/manifest.json',import.meta.url)));
 for(const record of manifest.snapshots){assert.equal(evidence.sources.find(s=>s.id==='nrsc-'+record.id).sha256,hash('../public'+record.image));}
});
