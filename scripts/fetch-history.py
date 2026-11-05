import urllib.request,json,hashlib,concurrent.futures
from pathlib import Path
from datetime import datetime,timezone
queries={
'flow-history':'https://flood-api.open-meteo.com/v1/flood?latitude=25.75&longitude=85.12&start_date=2015-01-01&end_date=2024-12-31&daily=river_discharge',
'rain-history':'https://archive-api.open-meteo.com/v1/archive?latitude=26.5&longitude=84.25&start_date=2015-01-01&end_date=2024-12-31&daily=precipitation_sum&models=era5&timezone=Asia%2FKolkata'}
def fetch(pair):
 name,url=pair
 try:
  raw=urllib.request.urlopen(url,timeout=55).read();d=json.loads(raw)
  assert len(d['daily']['time'])==3653
  Path('public/data/'+name+'.json').write_bytes(raw)
  return {'id':name,'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'retrieved':datetime.now(timezone.utc).isoformat(),'status':'downloaded','coverageStart':'2015-01-01','coverageEnd':'2024-12-31','provider':'Open-Meteo / Copernicus','license':'CC BY 4.0 data; free API non-commercial terms','model':'ERA5' if name.startswith('rain') else 'GloFAS v4 seamless default; exact upstream run not supplied','resolution':'0.25 degree / daily' if name.startswith('rain') else '0.05 degree / daily','units':'mm/day' if name.startswith('rain') else 'm3/s','timezone':'Asia/Kolkata' if name.startswith('rain') else 'UTC','crs':'EPSG:4326','returnedCoordinates':[d['longitude'],d['latitude']],'uncertainty':'Sample-cell estimates. No gauge validation, river assignment verification, flood depth or extent. Historical values are not advance forecasts.'}
 except Exception as e:print(name,str(e));return None
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:results=list(ex.map(fetch,queries.items()))
m=json.loads(Path('public/data/manifest.json').read_text())
for r in results:
 if r:m=[x for x in m if x['id']!=r['id']]+[r];print(r['id'],'3653 days downloaded')
Path('public/data/manifest.json').write_text(json.dumps(m,indent=2))
