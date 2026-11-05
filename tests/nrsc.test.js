import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {NRSC_FLOOD_SNAPSHOTS,NRSC_BOUNDS,nrscImageCoordinates} from '../src/flood/nrsc.ts';
test('NRSC displayed historical snapshots match retrieved provenance and PNG fingerprints',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../public/data/nrsc/manifest.json',import.meta.url)));
 assert.deepEqual(manifest.bbox,[...NRSC_BOUNDS]);
 assert.equal(manifest.crs,'EPSG:3857');
 for(const snapshot of NRSC_FLOOD_SNAPSHOTS){
  const record=manifest.snapshots.find(r=>r.id===snapshot.id);
  assert.ok(record);assert.equal(record.image,snapshot.image);
  const data=fs.readFileSync(new URL('../public'+snapshot.image,import.meta.url));
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),record.sha256);
  assert.equal(data.readUInt32BE(16),512);assert.equal(data.readUInt32BE(20),512);
  const query=new URL(record.url).searchParams;
  assert.equal(query.get('SRS'),'EPSG:3857');assert.equal(query.get('LAYERS'),record.layer);
  assert.ok(record.layer.startsWith('flood:br_2024_'));assert.ok(record.retrievedAt);
 }
 assert.deepEqual(nrscImageCoordinates(),[[85.05,25.85],[85.3,25.85],[85.3,25.6],[85.05,25.6]]);
});
