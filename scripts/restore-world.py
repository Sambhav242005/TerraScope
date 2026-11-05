from pathlib import Path
p=Path('src/flood/RiverHistory.tsx');s=p.read_text(encoding='utf-8').replace('import { useEffect, useMemo, useState } from "react";','import { useEffect, useMemo, useState, type ReactNode } from "react";\nexport type HistoryFrame={date:string;flow:number|null;rain:number|null;delta:number|null;maximum:number};')
s=s.replace('  onSources,\n}: {','  onSources,\n  renderWorld,\n}: {').replace('  onSources: () => void;','  onSources: () => void;\n  renderWorld?: (frame:HistoryFrame)=>ReactNode;')
s=s.replace('<main className="river-history">','<main className={renderWorld?"river-history world-mode":"river-history"}>\n      {renderWorld?.({date:selected,flow:current?.flow??null,rain:current?.rain??null,delta,maximum:max})}')
p.write_text(s,encoding='utf-8')
p=Path('src/flood/MapView.tsx');s=p.read_text(encoding='utf-8').replace('  terrain,\n}: {','  terrain,\n  preset="floodplain",\n}: {').replace('  terrain: boolean;','  terrain: boolean;\n  preset?: "floodplain"|"headwaters";')
# Preserve existing terrain-toggle behavior; bookmarks affect camera only.
idx=s.index('  return (\n    <div className="map-view">')
s=s[:idx]+'''  useEffect(()=>{const m=map.current;if(!m)return;const high=preset==='headwaters';m.easeTo({center:high?[84.25,28.3]:[85.16,25.71],zoom:high?10.2:12.3,pitch:terrain?55:0,bearing:terrain?-18:0,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:700});},[preset]);
'''+s[idx:]
s=s.replace('center: [85.16, 25.71],\n            zoom: 12.3,','center: preset === "headwaters" ? [84.25,28.3] : [85.16, 25.71],\n            zoom: preset === "headwaters" ? 10.2 : 12.3,')
p.write_text(s,encoding='utf-8')
p=Path('src/App.tsx');s=p.read_text(encoding='utf-8').replace('import RiverHistory from "./flood/RiverHistory";','import RiverHistory from "./flood/RiverHistory";\nimport WorldMap from "./flood/WorldMap";')
s=s.replace('type Tab =\n','type Tab =\n  | "3D explorer"\n').replace('[tab, setTab] = useState<Tab>("River history")','[tab, setTab] = useState<Tab>("3D explorer")')
s=s.replace('{ name: "River history", icon: Waves },','{ name: "3D explorer", icon: Mountain },\n              { name: "River history", icon: Waves },')
s=s.replace('setTab("Explore");\n          }}','setTab("3D explorer");\n          }}')
s=s.replace('tab === "River history"\n              ?','(tab === "River history" || tab === "3D explorer")\n              ?')
s=s.replace('{tab === "River history" && (','{tab === "3D explorer" && <RiverHistory onMap={()=>setTab("Explore")} onSources={()=>setSources(true)} renderWorld={frame=><WorldMap frame={frame} assets={assets} onSelect={id=>{choose(id);setTab("Explore")}} onHistory={()=>setTab("River history")} onSources={()=>setSources(true)}/>}/> }\n      {tab === "River history" && (')
s=s.replace('style={tab === "River history" ? { display: "none" } : undefined}','style={tab === "River history" || tab === "3D explorer" ? { display: "none" } : undefined}')
s=s.replace('          <MapView\n','          {tab !== "3D explorer" && tab !== "River history" && <MapView\n').replace('            terrain={terrain}\n          />','            terrain={terrain}\n          />}')
p.write_text(s,encoding='utf-8')
