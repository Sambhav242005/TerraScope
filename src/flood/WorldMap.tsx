import {useState} from 'react';
import {Mountain,Map as MapIcon,ArrowUpRight,ArrowDownRight,Layers,Building2,Info,ChartNoAxesCombined} from 'lucide-react';
import MapView from './MapView';
import type {StorageMapData} from './MapView';
import type {Asset} from './model';
import type {HistoryFrame} from './RiverHistory';
import type {PlacementCheck, PlacementEvidence} from './placementCheck';
import type {PlacementAttempt} from './placementAdmission';
import type {Intervention, PlacementTool} from './intervention';
import './world.css';
export default function WorldMap({
  frame,
  focusArea,
  focusPoint,
  onSelectArea,
  assets,
  onSelect,
  onHistory,
  onSources,
  storage=null,
  selectedStorage=null,
  onSelectStorage,
  showCandidates=true,
  showWaterLayer=true,
  interventions,
  selectedIntervention=null,
  onSelectIntervention,
  activePlacementTool="select",
  onPlaceAt,
  showInterventions=true,
  placementChecks,
  placementAttempt=null,
  placementEvidence=null,
  onDismissPlacementAttempt,
}:{
  frame:HistoryFrame;
  onSelectArea?:(p:{lat:number;lon:number})=>void;
  focusArea?:{lat:number;lon:number;label:string}|null;
  focusPoint?:{lat:number;lon:number}|null;
  assets:Asset[];
  onSelect:(id:string)=>void;
  onHistory:()=>void;
  onSources:()=>void;
  storage?:StorageMapData|null;
  selectedStorage?:string|null;
  onSelectStorage?:(id:string)=>void;
  showCandidates?:boolean;
  showWaterLayer?:boolean;
  interventions?:Intervention[];
  selectedIntervention?:string|null;
  onSelectIntervention?:(id:string)=>void;
  activePlacementTool?:PlacementTool;
  onPlaceAt?:(coords:{lat:number;lon:number})=>void;
  showInterventions?:boolean;
  placementChecks?:Record<string,PlacementCheck|null>;
  placementAttempt?:PlacementAttempt|null;
  placementEvidence?:PlacementEvidence|null;
  onDismissPlacementAttempt?:()=>void;
}){
 const [terrain,setTerrain]=useState(true),[place,setPlace]=useState<'floodplain'|'headwaters'|'settlement'>('settlement'),[showAssets,setShowAssets]=useState(true);
 const fmt=(v:number|null)=>v===null?'Unavailable':v.toLocaleString('en-GB',{maximumFractionDigits:1});
 return <section className="world-canvas" aria-label="3D geographic explorer"><MapView focusArea={focusArea} focusPoint={focusPoint} assets={assets} selected={null} onSelect={onSelect} onArea={onSelectArea??(()=>{})} terrain={terrain} showAssets={showAssets} preset={place} scene3d storage={storage} selectedStorage={selectedStorage} onSelectStorage={onSelectStorage} showCandidates={showCandidates} showWaterLayer={showWaterLayer} interventions={interventions} selectedIntervention={selectedIntervention} onSelectIntervention={onSelectIntervention} activePlacementTool={activePlacementTool} onPlaceAt={onPlaceAt} showInterventions={showInterventions} placementChecks={placementChecks} placementAttempt={placementAttempt} placementEvidence={placementEvidence} onDismissPlacementAttempt={onDismissPlacementAttempt}/><div className="world-heading"><span className="eyebrow">EXPLORE THE LANDSCAPE</span><h1>{focusArea?focusArea.label:place==='settlement'?'Sonpur in three dimensions.':place==='floodplain'?'Gandak meets the Ganges.':'Into the Himalayas.'}</h1><p>{focusArea?'Selected map area; historical readings remain Sonpur':place==='settlement'?'Mapped footprints · dimensional buildings · orbit to explore':place==='floodplain'?'Sonpur floodplain · Bihar, India':'Himalayan terrain · Nepal · contextual view'}</p></div><div className="world-camera"><div className="world-segment" role="group" aria-label="Map dimension"><button aria-pressed={terrain} onClick={()=>setTerrain(true)}><Mountain size={16}/>3D terrain</button><button aria-pressed={!terrain} onClick={()=>setTerrain(false)}><MapIcon size={15}/>2D map</button></div><label>Terrain bookmark<select aria-label="Terrain bookmark" disabled={!!focusArea} title={focusArea?"Use place search to change the selected area":undefined} value={place} onChange={e=>setPlace(e.target.value as typeof place)}>{focusArea?<option value={place}>{focusArea.label}</option>:<><option value="settlement">Sonpur buildings · 3D</option><option value="floodplain">Sonpur floodplain</option><option value="headwaters">Himalayan terrain</option></>}</select></label><button className="world-assets" aria-pressed={showAssets} onClick={()=>setShowAssets(!showAssets)}><Building2 size={15}/>{showAssets?'Hide':'Show'} mapped resources</button></div><aside className="world-observation"><span className="eyebrow">SELECTED HISTORICAL DAY</span><h2>{new Date(frame.date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}</h2><span className="world-metric-label">Sonpur-area modeled discharge</span><strong>{fmt(frame.flow)} <small>m³/s</small></strong><div className="world-flow-change">{frame.delta!==null&&frame.delta>0?<ArrowUpRight size={18}/>:<ArrowDownRight size={18}/>}<span>{frame.delta===null?'Change unavailable':`${frame.delta>0?'+':''}${fmt(frame.delta)} m³/s since previous day`}</span></div><div className="world-flow-bar"><i style={{width:`${frame.flow===null?0:frame.flow/frame.maximum*100}%`}}/></div><small>Flow relative to the ten-year maximum. Not water depth.</small><div className="world-rain"><span>ERA5 sample-cell rain</span><b>{fmt(frame.rain)} mm/day</b></div>{place==='headwaters'&&<p className="world-context-note">Camera moved only. Readings still refer to the original Sonpur-area discharge and rainfall sample cells.</p>}<button onClick={onSources}><Info size={13}/>Data and locations</button></aside><div className="world-bottom"><span><Layers size={14}/>Real elevation · 1× height scale · {terrain?'Drag to pan; right-drag to orbit':'Top-down map'}</span><button onClick={onHistory}><ChartNoAxesCombined size={15}/>Full history & comparisons</button></div><div className="world-evidence-note">27 mapped buildings · illustrative 6 m heights. Trees are decorative. Water footprints are static; no flood depth.</div></section>
}
