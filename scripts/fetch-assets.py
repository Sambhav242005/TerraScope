import json,urllib.request,urllib.parse,hashlib
from pathlib import Path
q='[out:json][timeout:12];nwr[amenity~"hospital|clinic|school|police|fire_station"](25.68,85.08,25.74,85.19);out center tags;'
u='https://overpass.private.coffee/api/interpreter?'+urllib.parse.urlencode({'data':q})
try:
 raw=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'TerraScope-Research-Prototype/0.1'}),timeout=25).read();d=json.loads(raw);Path('public/data/assets.json').write_bytes(raw)
 m=json.loads(Path('public/data/manifest.json').read_text());m=[x for x in m if x['id']!='assets']+[{'id':'assets','url':u,'sha256':hashlib.sha256(raw).hexdigest(),'retrieved':'2026-11-04','status':'downloaded','bounds':[85.08,25.68,85.19,25.74]}];Path('public/data/manifest.json').write_text(json.dumps(m,indent=2));print('OSM records:',len(d['elements']))
except Exception as e:print(e)
