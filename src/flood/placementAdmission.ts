import {checkPlacement,intersects,type PlacementEvidence,type PlacementCheck} from './placementCheck.ts';
import type {Intervention} from './intervention';
export function checkScenePlacement(item:Intervention,evidence:PlacementEvidence|null,others:Intervention[]):PlacementCheck{
 const result=checkPlacement(item,evidence);
 for(const other of others){if(other.id===item.id)continue;const shape=checkPlacement(other,null).footprint;if(intersects(result.footprint,shape)){result.status='conflict';result.headline='Proposal overlaps another proposal';result.findings.push({kind:'proposal',message:`Screening footprint intersects ${other.name}. Choose a different location.`,featureIds:[other.id],sourceIds:[]});}}
 return result;
}
export function placementBlock(item:Intervention,evidence:PlacementEvidence|null,others:Intervention[]):string|null{
 if(!evidence)return 'Placement blocked: map evidence is still loading or unavailable. Retry the area checks.';
 const check=checkScenePlacement(item,evidence,others);
 const conflicts=check.findings.filter(f=>f.kind==='proposal'||f.kind==='building'||f.kind==='road'||((f.kind==='river'||f.kind==='water')&&!item.sourceCandidateId));
 if(conflicts.length)return 'Placement blocked: '+conflicts.map(f=>f.message).join(' ');
 const ring=check.footprint.coordinates.flat();const covered=evidence.sources.some(s=>s.id.startsWith('osm')&&ring.every(([x,y])=>x>=s.coverage[0]&&x<=s.coverage[2]&&y>=s.coverage[1]&&y<=s.coverage[3]));
 return covered?null:'Placement blocked: the footprint is outside loaded building/road/water coverage. Select this area and wait for its OSM checks.';
}
