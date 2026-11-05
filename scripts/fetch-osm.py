import urllib.request,xml.etree.ElementTree as E,json,hashlib
from pathlib import Path
url='https://api.openstreetmap.org/api/0.6/map?bbox=85.14,25.68,85.19,25.73'
try:
 raw=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'TerraScope-Prototype'}),timeout=30).read();root=E.fromstring(raw);nodes={n.attrib['id']:n.attrib for n in root.findall('node')};items=[]
 for n in root:
  tags={t.attrib['k']:t.attrib['v'] for t in n.findall('tag')}
  if tags.get('amenity') not in ['school','hospital','clinic','police','fire_station']:continue
  item={'type':n.tag,'id':int(n.attrib['id']),'tags':tags}
  if n.tag=='node':item.update(lat=float(n.attrib['lat']),lon=float(n.attrib['lon']))
  elif n.tag=='way':
   pts=[nodes[x.attrib['ref']] for x in n.findall('nd') if x.attrib['ref'] in nodes]
   if not pts:continue
   item['center']={k:sum(float(p[k]) for p in pts)/len(pts) for k in ['lat','lon']}
  else:continue
  items.append(item)
 data=json.dumps({'elements':items,'note':'Way representative positions are mean vertex coordinates, not surveyed entrances.'},indent=2).encode();Path('public/data/assets.json').write_bytes(data);Path('artifacts/osm-source.xml').write_bytes(raw)
 m=json.loads(Path('public/data/manifest.json').read_text());m=[x for x in m if x['id']!='assets']+[{'id':'assets','url':url,'sha256':hashlib.sha256(data).hexdigest(),'rawSha256':hashlib.sha256(raw).hexdigest(),'retrieved':'2026-11-04','status':'downloaded','bounds':[85.14,25.68,85.19,25.73],'processing':'Amenities filtered. Ways use mean vertex coordinates.'}];Path('public/data/manifest.json').write_text(json.dumps(m,indent=2));print(len(items))
except Exception as e:print(type(e).__name__,e)
