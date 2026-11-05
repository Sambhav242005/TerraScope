import test from 'node:test';
import assert from 'node:assert/strict';
import {height,isWater,walkable,riverX,surface,onBridge,walkingHeight,trees,rocks,random} from '../src/world/habitat.ts';
test('river runs downhill and bridge provides a dry connected crossing',()=>{for(let z=-16;z<16;z++){assert(surface(z)>surface(z+1));assert(isWater(riverX(z),z));assert(height(riverX(z),z)<surface(z));}assert(onBridge(riverX(0),0));assert(walkable(riverX(0),0));assert(walkingHeight(riverX(0),0)>surface(0));});
test('walking bounds and solid obstacles exclude unsafe positions',()=>{assert(!walkable(19,0));assert(!walkable(0,19));assert(!walkable(riverX(12),12));for(const t of [...trees,...rocks])assert(!walkable(t.x,t.z));assert(!walkable(11,9));});
test('seeded terrain decoration random streams are reproducible',()=>{const a=random(42),b=random(42);for(let i=0;i<100;i++)assert.equal(a(),b());});
