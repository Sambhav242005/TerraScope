import xml.etree.ElementTree as E
from collections import Counter
from pathlib import Path
p=Path('artifacts/osm-source.xml');r=E.fromstring(p.read_bytes());build=[]
for w in r.findall('way'):
 t={x.attrib['k']:x.attrib['v'] for x in w.findall('tag')}
 if 'building' in t:build.append(t)
print('Buildings',len(build),'heights',sum('height'in t for t in build),'levels',sum('building:levels'in t for t in build));print(Counter(t.get('building') for t in build));print('Other natural:',Counter(t.attrib.get('v') for w in r.findall('way') for t in w.findall('tag') if t.attrib.get('k') in ['natural','landuse','waterway']))
