import {readFile, writeFile} from 'node:fs/promises';
import {joinHistory} from '../src/flood/historyJoin.ts';
import {askLocalModel} from '../src/flood/ai/llmAdapter.ts';
import {askPlanningAction} from '../src/flood/ai/planning.ts';
import {LOCAL_MODEL_PRESET} from '../src/flood/ai/localPreset.ts';
const read=async name=>JSON.parse(await readFile(`public/data/${name}.json`,'utf8'));
const ctx={history:joinHistory(await read('flow-history'),await read('rain-history')),manifest:await read('manifest'),ensoYear:2024,storageRun:null,proposalCount:0,replayDate:'2024-10-01'};
const exchanges=[];
const realFetch=globalThis.fetch;
globalThis.fetch=async (url, options)=>{const response=await realFetch(url,options);const data=await response.clone().json(); exchanges.push({messages:JSON.parse(options.body).messages.filter(m=>m.role==='tool'),message:data.choices?.[0]?.message?.content,toolCalls:data.choices?.[0]?.message?.tool_calls});return response;};
const report={date:new Date().toISOString(),config:LOCAL_MODEL_PRESET,answers:[],actions:[]};
for(const question of ['What was the peak modeled discharge in the loaded record?','Show storage candidates near this settlement.','What wildlife routes and current air pollution measurements are loaded?']) {
  const start=Date.now();
  try {report.answers.push({question,answer:await askLocalModel(LOCAL_MODEL_PRESET,question,ctx)});}
  catch(error){report.answers.push({question,error:error.message,latencyMs:Date.now()-start});}
}
// Synthetic IDs exercise intent schema only; these are not real map edits.
const snapshot={revision:'fixture-r1',runId:'fixture-run',candidateIds:['fixture-c1'],proposalIds:['fixture-p1'],evidenceIds:['flow-history']};
for(const question of ['Focus candidate fixture-c1.','Adopt candidate fixture-c1.','Remove proposal fixture-p1.','Undo the last change.','Show evidence flow-history.']) {
  const start=Date.now();
  try {report.actions.push({question,action:await askPlanningAction(LOCAL_MODEL_PRESET,question,snapshot),latencyMs:Date.now()-start});}
  catch(error){report.actions.push({question,error:error.message,latencyMs:Date.now()-start});}
}
report.exchanges=exchanges;
await writeFile('artifacts/lfm3-integration-smoke.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
