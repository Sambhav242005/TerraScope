import xml.etree.ElementTree as E
r=E.parse('artifacts/osm-source.xml').getroot();n={x.attrib['id']:[float(x.attrib['lon']),float(x.attrib['lat'])] for x in r.findall('node')}
for w in r.findall('way'):
 t={x.attrib['k']:x.attrib['v'] for x in w.findall('tag')}
 if 'building' in t:
  pts=[n[x.attrib['ref']] for x in w.findall('nd') if x.attrib['ref']in n];print(w.attrib['id'],[round(sum(p[k] for p in pts)/len(pts),5) for k in range(2)])
