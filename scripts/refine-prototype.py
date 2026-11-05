from pathlib import Path
p=Path('src/App.tsx');s=p.read_text().replace("area:{lat:25.715,lon:85.15},radius:3","area:{lat:25.71,lon:85.16},radius:4")
s=s.replace('`${path(values)} L400 74 L0 74 Z`', "values.some(v=>v!==null)?`${path(values)} L400 74 L0 74 Z`:''")
s=s.replace("[draft,setDraft]=useState('')", "[draft,setDraft]=useState(()=>{try{return localStorage.getItem('terrascope-draft')??'';}catch{return '';}})")
s=s.replace("const update=(p:Partial<Saved>)", "useEffect(()=>{try{localStorage.setItem('terrascope-draft',draft);}catch{}},[draft]);\n const update=(p:Partial<Saved>)")
s=s.replace('Search scope only. Does not estimate flood extent.</small></div>', '''Search scope only. Does not estimate flood extent.</small><details className="coordinates"><summary>Set review centre by coordinates</summary><form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);const lat=Number(data.get('lat')),lon=Number(data.get('lon'));if(Number.isFinite(lat)&&Math.abs(lat)<=85&&Number.isFinite(lon)&&Math.abs(lon)<=180){update({area:{lat,lon}});setSelected(null);setNotice('Review centre updated.');}}} key={`${saved.area.lat},${saved.area.lon}`}><label>Latitude<input name="lat" type="number" min="-85" max="85" step="any" defaultValue={saved.area.lat.toFixed(5)} required/></label><label>Longitude<input name="lon" type="number" min="-180" max="180" step="any" defaultValue={saved.area.lon.toFixed(5)} required/></label><button type="submit" className="secondary">Set centre</button></form></details></div>''')
s=s.replace("Current mapping may differ from 2024.","Current mapping may differ from 2024. Bounded extract: 25.68–25.73°N, 85.14–85.19°E. Outside this area, inventory is unavailable. Way positions are mean vertices, not verified entrances.")
s=s.replace('GloFAS discharge\'', 'GloFAS discharge\'')
p.write_text(s)
p=Path('index.html');s=p.read_text().replace('Investigate the last Glasswing, uncover five clues, and change the past in an ecological detective game.','Explore historical rainfall, inspect mapped resources and prepare human-reviewed flood preparedness checklists.').replace('Echoes of Extinction — The Last Glasswing','TerraScope · Flood preparedness');s=s.replace('<title>','<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'%3E%3Cpath d=\'M3 27L12 5l5 13 5-9 7 18Z\' fill=\'none\' stroke=\'%23326c50\' stroke-width=\'3\'/%3E%3C/svg%3E"><title>');p.write_text(s)
# Limit public OSM extract to needed tags; no contact or ownership details.
import json,hashlib
p=Path('public/data/assets.json');d=json.loads(p.read_text())
for e in d['elements']:e['tags']={k:v for k,v in e['tags'].items() if k in ['name','name:en','amenity']}
p.write_text(json.dumps(d,ensure_ascii=False,indent=2));m=json.loads(Path('public/data/manifest.json').read_text())
for e in m:
 if e['id']=='assets':e['sha256']=hashlib.sha256(p.read_bytes()).hexdigest();e['processing']+=' Only name and amenity tags retained.'
Path('public/data/manifest.json').write_text(json.dumps(m,indent=2))

