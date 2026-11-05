import xml.etree.ElementTree as E,json,hashlib,math,random
from pathlib import Path
root=E.parse('artifacts/osm-source.xml').getroot();nodes={n.attrib['id']:[float(n.attrib['lon']),float(n.attrib['lat'])] for n in root.findall('node')};features=[];wood=[]
for way in root.findall('way'):
 tags={t.attrib['k']:t.attrib['v'] for t in way.findall('tag')};refs=[x.attrib['ref'] for x in way.findall('nd')]
 if any(ref not in nodes for ref in refs):continue
 points=[nodes[r] for r in refs]
 if len(points)<2:continue
 kind='building' if 'building'in tags else 'water' if tags.get('natural')=='water' else 'wood' if tags.get('natural')=='wood' or tags.get('landuse')=='forest' else 'road' if 'highway'in tags else 'river' if tags.get('waterway')=='river' else None
 if not kind:continue
 closed=points[0]==points[-1] and len(points)>3
 if kind in ['building','water','wood'] and not closed:continue
 geom={'type':'Polygon','coordinates':[points]} if closed and kind not in ['road','river'] else {'type':'LineString','coordinates':points}
 props={'kind':kind,'osmId':way.attrib['id']}
 if kind=='building':props.update(height=6,heightSource='Illustrative 6 m; no measured height or floor count in this extract')
 features.append({'type':'Feature','properties':props,'geometry':geom})
 if kind=='wood':wood.append(points)
def inside(p,poly):
 x,y=p;c=False;j=len(poly)-1
 for i in range(len(poly)):
  a,b=poly[i],poly[j]
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:c=not c
  j=i
 return c
# Decorative trees only in mapped wood polygons; positions/heights are not surveyed.
rng=random.Random(42);trees=0
for _ in range(5000):
 p=[rng.uniform(85.14,85.19),rng.uniform(25.68,25.73)]
 if not any(inside(p,poly) for poly in wood):continue
 h=rng.uniform(6,10)
 for tier,(radius,base,top) in enumerate([(1,0,3),(3.5,3,h-2),(2,h-2,h)]):
  ring=[[p[0]+math.cos(i/6*2*math.pi)*radius/100200,p[1]+math.sin(i/6*2*math.pi)*radius/111320] for i in range(7)];ring[-1]=ring[0]
  features.append({'type':'Feature','properties':{'kind':'tree','tier':tier,'base':base,'height':top},'geometry':{'type':'Polygon','coordinates':[ring]}})
 trees+=1
 if trees>=180:break
payload=json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')).encode();Path('public/data/scene-geometry.json').write_bytes(payload)
m=json.loads(Path('public/data/manifest.json').read_text());m=[x for x in m if x['id']!='scene-geometry'];m.append({'id':'scene-geometry','url':'https://api.openstreetmap.org/api/0.6/map?bbox=85.14,25.68,85.19,25.73','sha256':hashlib.sha256(payload).hexdigest(),'retrieved':'2026-11-04','status':'downloaded; derived visual geometry','license':'ODbL, OpenStreetMap contributors','units':'WGS84 degrees; illustrative object heights in metres','resolution':'Mapped footprints, not surveyed 3D assets','timezone':'not applicable','model':'OSM ways with explicit visual-height assumptions','uncertainty':'27 building footprints, all extruded to illustrative 6 m. Decorative trees placed within mapped woods; not observed tree locations. No river depths or flood extent.','processing':'Closed building/water/wood ways and road/river lines retained; no personal tags. Seeded decorative trees. scripts/build-scene.py'});Path('public/data/manifest.json').write_text(json.dumps(m,indent=2));print('features',len(features),'trees',trees)
