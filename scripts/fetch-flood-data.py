import json,urllib.request,urllib.parse,concurrent.futures,hashlib
from pathlib import Path
sources={
'rainfall': 'https://archive-api.open-meteo.com/v1/archive?latitude=26.5&longitude=84.25&start_date=2024-09-25&end_date=2024-10-03&hourly=precipitation&models=era5&timezone=Asia%2FKolkata',
'discharge': 'https://flood-api.open-meteo.com/v1/flood?latitude=25.75&longitude=85.12&start_date=2024-09-25&end_date=2024-10-03&daily=river_discharge&models=glofas_v4&cell_selection=nearest',
'assets': 'https://overpass-api.de/api/interpreter?'+urllib.parse.urlencode({'data':'[out:json][timeout:25];nwr[amenity~"hospital|clinic|school|police|fire_station"](25.65,85.02,25.84,85.23);out center tags;'})}
def get(item):
 name,url=item
 try:
  raw=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'TerraScope-Research-Prototype/0.1'}),timeout=55).read();data=json.loads(raw)
  Path('public/data/'+name+'.json').write_bytes(raw)
  return {'id':name,'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'retrieved':'2026-11-04','status':'downloaded','size':len(raw)}
 except Exception as e:return {'id':name,'url':url,'status':'unavailable','error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: results=list(pool.map(get,sources.items()))
Path('public/data/manifest.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
