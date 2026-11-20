import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runTool } from '../src/flood/ai/tools.ts';
import { checkAnswerSupport } from '../src/flood/ai/answerSupport.ts';
import { validatePlanningAction, askPlanningAction } from '../src/flood/ai/planning.ts';
import { LOCAL_MODEL_PRESET, requireLoopback } from '../src/flood/ai/localPreset.ts';
import { askLocalModel } from '../src/flood/ai/llmAdapter.ts';
const ctx = {history: null, manifest: [], ensoYear: 2024, storageRun: null, proposalCount: 0, replayDate: '2024-10-01'};
const state = {revision: 'r1', runId: 'run1', candidateIds: ['c1'], proposalIds: ['p1'], evidenceIds: ['flow-history']};
test('tool args reject malformed, unexpected, coercible and out-of-range input', () => {
  for (const [name,args] of [['peak_discharge',null],['peak_discharge',[]],['peak_discharge',{extra:true}],['enso_context',{year:'2024'}],['storage_candidates',{limit:1.5}],['storage_candidates',{limit:11}],['storage_detail',{}],['storage_detail',{id:2}]]) assert.equal(JSON.parse(runTool(name,args,ctx)).ok,false);
});
test('stale candidate and failed run never produce candidate evidence', () => {
  assert.equal(JSON.parse(runTool('storage_detail',{id:'old'},ctx)).ok,false);
  assert.equal(JSON.parse(runTool('storage_candidates',{}, {...ctx,storageRun:{status:'failed'}})).ok,false);
});
test('actions require exact live revision, run and IDs and reject extra arguments', () => {
  const good={kind:'adopt-candidate',revision:'r1',runId:'run1',candidateId:'c1'};
  assert.deepEqual(validatePlanningAction(good,state),good);
  for (const patch of [{revision:'r0'},{runId:'old'},{candidateId:'invented'},{coordinates:[1,2]},{kind:'send-warning'}]) assert.throws(()=>validatePlanningAction({...good,...patch},state));
  assert.throws(()=>validatePlanningAction({kind:'remove-proposal',revision:'r1',proposalId:'missing'},state));
  assert.throws(()=>validatePlanningAction({kind:'show-evidence',revision:'r1',evidenceId:'fake'},state));
});
test('local preset refuses cloud, credentials and alternate models', () => {
  requireLoopback(LOCAL_MODEL_PRESET);
  for (const patch of [{baseUrl:'https://example.com'},{baseUrl:'http://user:password@localhost:11435'},{model:'other'}]) assert.throws(()=>requireLoopback({...LOCAL_MODEL_PRESET,...patch}));
});
test('grounding rejects invented citation, unsupported numbers and uncited prose', () => {
  const outputs=[JSON.stringify({ok:true,value:{peakM3s:12646,date:'2017-08-14'},citations:[{id:'flow-history',detail:'GloFAS modeled discharge'}]})];
  checkAnswerSupport('Modeled peak 12,646 m³/s on 2017-08-14 [flow-history].',outputs);
  for (const text of ['Peak 999 [flow-history].','Peak 12646 [fake].','Peak 12646.']) assert.throws(()=>checkAnswerSupport(text,outputs));
  assert.throws(()=>checkAnswerSupport('Everything safe [flow-history].',[]));
});
test('adapter fails closed on ungrounded text and disconnected endpoint without fallback network', async () => {
  const original=globalThis.fetch;
  let calls=0;
  try {
    globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:'Invented answer'}}]}));};
    await assert.rejects(askLocalModel(LOCAL_MODEL_PRESET,'peak?',ctx),/evidence/);
    assert.equal(calls,1);
    globalThis.fetch=async()=>{throw new Error('disconnected');};
    await assert.rejects(askLocalModel(LOCAL_MODEL_PRESET,'peak?',ctx),/disconnected/);
    await assert.rejects(askPlanningAction(LOCAL_MODEL_PRESET,'undo',state),/disconnected/);
  } finally {globalThis.fetch=original;}
});
test('planning response is validated, never executed', async () => {
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({kind:'undo',revision:'r0'})}}]}));
    await assert.rejects(askPlanningAction(LOCAL_MODEL_PRESET,'undo',state),/Stale/);
  } finally {globalThis.fetch=original;}
});

test('pre-cancelled inference and planning make no network calls', async () => {
  const original=globalThis.fetch;
  const ctrl=new AbortController();ctrl.abort();
  try {
    globalThis.fetch=async()=>{throw new Error('MUST NOT FETCH');};
    await assert.rejects(askLocalModel(LOCAL_MODEL_PRESET,'peak',ctx,ctrl.signal),{name:'AbortError'});
    await assert.rejects(askPlanningAction(LOCAL_MODEL_PRESET,'undo',state,ctrl.signal),{name:'AbortError'});
  } finally {globalThis.fetch=original;}
});

test('area evidence is revision-bound, source-linked and never emits report geometry', () => {
  const review={latitude:25,longitude:85,gaps:['survey unavailable'],air:null,airError:null,reports:[{id:'report1',provider:'fixture',sourceUrl:'https://example.org/report',version:'v1',validTime:'2024',status:'report-only',uncertainty:'not a route',bounds:[1,2,3,4]}]};
  const attached={...ctx,workspaceRevision:'r1',areaReview:{revision:'r1',review}};
  const out=JSON.parse(runTool('data_sources',{},attached));
  assert.equal(out.value.areaEvidence.records[0].bounds,undefined);
  assert.equal(out.citations.at(-1).id,'report1');
  const stale=JSON.parse(runTool('data_sources',{}, {...attached,workspaceRevision:'r2'}));
  assert.deepEqual(stale.value.areaEvidence.records,[]);
  assert.equal(stale.value.areaEvidence.state,'stale-or-unbound');
});
