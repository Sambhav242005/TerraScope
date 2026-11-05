from pathlib import Path
p=Path('src/App.tsx');s=p.read_text(encoding='utf-8').replace('import MapView from "./flood/MapView";','import MapView from "./flood/MapView";\nimport RiverHistory from "./flood/RiverHistory";')
s=s.replace('type Tab = "Explore"','type Tab = "River history" | "Explore"').replace('[tab, setTab] = useState<Tab>("Explore")','[tab, setTab] = useState<Tab>("River history")').replace('[showArea, setShowArea] = useState(true)','[showArea] = useState(false)').replace('[layers, setLayers] = useState(true)','[layers, setLayers] = useState(false)')
s=s.replace('{ name: "Explore", icon: Map },','{ name: "River history", icon: Waves },\n              { name: "Explore", icon: Map },')
s=s.replace('<span className="case-date">25 Sep — 03 Oct 2024</span>','<span className="case-date">{tab === "River history" ? "2015 — 2024 · daily history" : "25 Sep — 03 Oct 2024 · event detail"}</span>')
s=s.replace('<main className="workspace">','{tab === "River history" && <RiverHistory onMap={()=>setTab("Explore")} onSources={()=>setSources(true)}/> }\n      <main className="workspace" style={tab === "River history" ? {display:"none"}:undefined}>')
start=s.index('                {\n                  name: "Review area"');end=s.index('                {\n                  name: "Mapped resources"',start);s=s[:start]+s[end:]
start=s.index('          <div className="map-legend">');end=s.index('          <div className="map-dock">',start);s=s[:start]+s[end:]
s=s.replace('Click the map to move the review area','Click to move the resource-search centre').replace('A clearer view of','Resources along').replace('what needs attention.','the river.').replace('Review radius','Resource search radius')
s=s.replace('<section className="timeline-panel" aria-label="Historical timeline">','<section className="timeline-panel" aria-label="Historical timeline" style={tab === "River history" ? {display:"none"}:undefined}>')
s=s.replace('The blue area is a user-defined search radius, not modeled or observed flooding.','The resource radius filters facilities only. No inundation extent is available. The River history view spans 2015–2024; the resource workspace retains the September–October 2024 detail window.')
s=s.replace('m.id === "rainfall"','m.id === "rainfall" || m.id === "rain-history"').replace('m.id === "discharge"','m.id === "discharge" || m.id === "flow-history"')
p.write_text(s,encoding='utf-8')
p=Path('src/flood/MapView.tsx');s=p.read_text(encoding='utf-8');start=s.index('      m.addSource("review"');end=s.index('\n    });',start);s=s[:start]+s[end:];p.write_text(s,encoding='utf-8')
