from pathlib import Path
p=Path('src/App.tsx');s=p.read_text(encoding='utf-8').replace("kind:'illustrative-linear-reservoir',scenario:","kind:'illustrative-linear-reservoir',modelVersion:'linear-reservoir-v1',units:{input:'mm/h',out:'mm/h',storage:'mm'},initialStorage:0,time:rain?.hourly.time,assumptions:'No catchment area, channel routing, surveyed geometry or calibration; zero initial storage.',scenario:")
s=s.replace('Remaining water stays in storage.','Storage starts at zero. Remaining water stays in storage.')
p.write_text(s,encoding='utf-8')
