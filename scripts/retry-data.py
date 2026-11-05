import urllib.request,json,urllib.parse,hashlib
from pathlib import Path
jobs={'discharge':'https://flood-api.open-meteo.com/v1/flood?latitude=25.75&longitude=85.12&start_date=2024-09-25&end_date=2024-10-03&daily=river_discharge','assets':'https://overpass.kumi.systems/api/interpreter?'+urllib.parse.urlencode({'data':'[out:json][timeout:40];nwr[amenity~"hospital|clinic|school|police"](25.65,85.02,25.84,85.23);out center tags;'})}
manifest=json.loads(Path('public/data/manifest.json').read_text())
for name,url in jobs.items():
 try:
  raw=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'TerraScope-Research-Prototype/0.1'}),timeout=55).read();obj=json.loads(raw);Path('public/data/'+name+'.json').write_bytes(raw)
  manifest=[m for m in manifest if m['id']!=name]+[{'id':name,'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'retrieved':'2026-11-04','status':'downloaded'}];print(name,str(obj)[:700])
 except Exception as e:print(name,e)
Path('public/data/manifest.json').write_text(json.dumps(manifest,indent=2))
