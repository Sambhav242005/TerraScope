import json,hashlib,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
# Refresh only explicitly recorded bounded queries, never a tile download.
# A refresh changes the source data and hashes: review diffs before publishing.
root=Path(__file__).resolve().parents[1]/'public'/'data'
manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
for source in manifest:
 try:
  raw=urllib.request.urlopen(urllib.request.Request(source['url'],headers={'User-Agent':'TerraScope-Research-Prototype/0.1'}),timeout=40).read()
  if source['id']=='assets':
   tree=ET.fromstring(raw);nodes={n.attrib['id']:n.attrib for n in tree.findall('node')};elements=[]
   for n in tree:
    tags={t.attrib['k']:t.attrib['v'] for t in n.findall('tag') if t.attrib['k'] in ['amenity','name','name:en']}
    if tags.get('amenity') not in ['school','hospital','clinic','police','fire_station']:continue
    entry={'type':n.tag,'id':int(n.attrib['id']),'tags':tags}
    if n.tag=='node':entry.update(lat=float(n.attrib['lat']),lon=float(n.attrib['lon']))
    elif n.tag=='way':
     pts=[nodes[x.attrib['ref']] for x in n.findall('nd') if x.attrib['ref'] in nodes]
     if not pts:continue
     entry['center']={k:sum(float(p[k]) for p in pts)/len(pts) for k in ['lat','lon']}
    else:continue
    elements.append(entry)
   payload=json.dumps({'elements':elements,'note':'Way positions are mean vertices, not surveyed entrances.'},ensure_ascii=False,indent=2).encode('utf-8');source['rawSha256']=hashlib.sha256(raw).hexdigest()
  else:json.loads(raw);payload=raw
  (root/(source['id']+'.json')).write_bytes(payload)
  from datetime import datetime,timezone
  source['retrieved']=datetime.now(timezone.utc).isoformat();source['sha256']=hashlib.sha256(payload).hexdigest();source['status']='downloaded';print(source['id'],'downloaded')
 except Exception as error:print(source['id'],'refresh failed; existing snapshot retained:',error)
(root/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
