import {checkPlacement,intersects,type PlacementEvidence,type PlacementCheck} from './placementCheck.ts';
import type {Intervention} from './intervention';

export type PlacementAttemptState = 'checking' | 'blocked' | 'failed';
export type PlacementAttempt = {
  item: Intervention;
  check: PlacementCheck;
  block: string | null;
  state: PlacementAttemptState;
  target: {lat: number; lon: number};
  success: string;
};
export type PlacementAdmission = {
  block: string | null;
  needsAreaEvidence: boolean;
  check: PlacementCheck;
};

export function checkScenePlacement(item:Intervention,evidence:PlacementEvidence|null,others:Intervention[]):PlacementCheck{
 const result=checkPlacement(item,evidence);
 for(const other of others){if(other.id===item.id)continue;const shape=checkPlacement(other,null).footprint;if(intersects(result.footprint,shape)){result.status='conflict';result.headline='Proposal overlaps another proposal';result.findings.push({kind:'proposal',message:`Screening footprint intersects ${other.name}. Choose a different location.`,labels:[other.name],featureIds:[other.id],sourceIds:[]});}}
 return result;
}

function footprintCovered(check:PlacementCheck,evidence:PlacementEvidence){
 const ring=check.footprint.coordinates.flat();
 return evidence.sources.some(s=>s.id.startsWith('osm')&&ring.every(([x,y])=>x>=s.coverage[0]&&x<=s.coverage[2]&&y>=s.coverage[1]&&y<=s.coverage[3]));
}

/** Assess one spot check. `needsAreaEvidence` means the click should move the
 *  selected area and fetch that area's OSM evidence before the check is final;
 *  it never means the location is approved. A mapped conflict does not need a
 *  refetch and should send the user to a different spot instead. */
export function assessPlacement(item:Intervention,evidence:PlacementEvidence|null,others:Intervention[]):PlacementAdmission{
 if(!evidence)return {block:'Placement blocked: map evidence is still loading or unavailable. Retry the area checks.',needsAreaEvidence:true,check:checkScenePlacement(item,null,others)};
 const check=checkScenePlacement(item,evidence,others);
 // Vegetation buffers are expected near channels; overlap is an investigation,
 // not a hard conflict (checkPlacement already reports it that way). Adopted
 // candidates retain water overlap as investigation; roads/buildings/proposals
 // still block them.
 const conflicts=check.findings.filter(f=>f.kind==='proposal'||(item.kind!=='vegetation_buffer'&&(f.kind==='building'||f.kind==='road'||((f.kind==='river'||f.kind==='water')&&!item.sourceCandidateId))));
 if(conflicts.length)return {block:'Placement blocked: '+conflicts.map(f=>f.message).join(' '),needsAreaEvidence:false,check};
 return footprintCovered(check,evidence)
   ? {block:null,needsAreaEvidence:false,check}
   : {block:'Placement blocked: the footprint is outside loaded building/road/water coverage. Select this area and wait for its OSM checks.',needsAreaEvidence:true,check};
}

export function placementBlock(item:Intervention,evidence:PlacementEvidence|null,others:Intervention[]):string|null{
 return assessPlacement(item,evidence,others).block;
}
