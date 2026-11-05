import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simulate} from '../src/engine/model.ts';
const end = history => history.at(-1).population;
const extinct = history => history.find(s=>s.population===0)?.year;
test('the authored mystery and interventions obey the causal story',()=>{
  const baseline=simulate(), water=simulate('water'), predators=simulate('predators'), food=simulate('food');
  assert.equal(end(baseline),0); assert.ok(end(water)>120);
  assert.equal(end(predators),0); assert.equal(end(food),0);
  assert.ok(extinct(food)>extinct(baseline));
  assert.ok(baseline.find(s=>s.rainfall<.5).year < baseline.find(s=>s.vegetation<.45).year);
});
test('interventions share identical past and climate, independent of run order',()=>{
  const baseline=simulate();
  for(const choice of ['water','predators','food']){
    const run=simulate(choice); assert.deepEqual(run.slice(0,15),baseline.slice(0,15));
    assert.deepEqual(run.map(s=>s.rainfall),baseline.map(s=>s.rainfall));
    simulate('none',4,7); assert.deepEqual(run,simulate(choice));
  }
});
test('extinction cannot be reversed by a late intervention and state remains bounded',()=>{
  assert.equal(end(simulate('water',26)),0);
  for(const choice of ['none','water','predators','food'])for(let start=0;start<30;start++){
    const run=simulate(choice,start);
    for(const s of run){for(const k of ['water','rainfall','vegetation','predators'])assert.ok(s[k]>=0&&s[k]<=1);assert.ok(s.population>=0&&s.population<=300);}
    const dead=run.findIndex(s=>s.population===0); if(dead>=0)assert.ok(run.slice(dead).every(s=>s.population===0));
  }
});

test('all ten population identities are immutable, bounded counts tied to the selected ecology',()=>{
  const ids=['deer','rabbit','fox','squirrel','songbird','owl','fish','frog','turtle','glasswing'];
  for(const choice of ['none','water','predators','food'])for(const start of [0,14,26]){
    for(const snapshot of simulate(choice,start)){
      assert.deepEqual(Object.keys(snapshot.species).sort(),[...ids].sort());
      assert.ok(Object.isFrozen(snapshot.species));
      assert.equal(snapshot.species.glasswing,snapshot.population);
      for(const count of Object.values(snapshot.species)){
        assert.ok(Number.isFinite(count)&&Number.isInteger(count)&&count>=0&&count<=300);
      }
      assert.throws(()=>{snapshot.species.fish=999;},TypeError);
    }
  }
});

test('surrounding fauna respond to resources without inventing Glasswing rescues or removing ambient carnivores',()=>{
  const baseline=simulate(),water=simulate('water'),predators=simulate('predators');
  for(const id of ['fish','frog','turtle','deer','rabbit'])assert.ok(water.at(-1).species[id]>baseline.at(-1).species[id],`${id} should benefit from resource restoration`);
  for(let year=0;year<=30;year++){
    assert.equal(predators[year].species.fox,baseline[year].species.fox);
    assert.equal(predators[year].species.owl,baseline[year].species.owl);
    assert.ok(predators[year].species.fox>0&&predators[year].species.owl>0);
  }
  assert.equal(predators.at(-1).species.glasswing,0);
  assert.equal(simulate('water',26).at(-1).species.glasswing,0);
});
