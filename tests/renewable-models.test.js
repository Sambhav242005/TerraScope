import test from 'node:test';import assert from 'node:assert/strict';import {buildRenewableModel,disposeModel} from '../src/flood/renewableModels.ts';import {createIntervention} from '../src/flood/intervention.ts';
test('one solar proposal owns 48 panel tables while one wind proposal owns exactly one three-blade turbine',()=>{
 for(const kind of ['solar_array','wind_turbine']){
 const i=createIntervention(kind,{lat:25.71,lon:85.16});const before=structuredClone(i);const model=buildRenewableModel(i);assert.equal(model.name,i.id);assert.deepEqual(i,before);
 if(kind==='solar_array'){assert.equal(model.userData.tableCount,48);assert.equal(model.children.filter(c=>c.isInstancedMesh).length,3);}else{assert.equal(model.userData.turbineCount,1);assert.equal(model.getObjectByName('rotor').children.length,4);}
 disposeModel(model);
 }
});
