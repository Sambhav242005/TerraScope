from pathlib import Path
p=Path('src/flood/MapView.tsx');s=p.read_text(encoding='utf-8');s=s.replace('      if (terrain) m.setTerrain({ source: "elevation", exaggeration: 1 });','''      if (terrain) m.setTerrain({ source: "elevation", exaggeration: 1 });
      m.addLayer({id:'terrain-shading',type:'hillshade',source:'elevation',layout:{visibility:terrain?'visible':'none'},paint:{'hillshade-shadow-color':'#354a3b','hillshade-highlight-color':'#fff8dc','hillshade-accent-color':'#53705b','hillshade-exaggeration':0.6}});''')
s=s.replace('      if (m.isStyleLoaded())\n        m.setTerrain(terrain ? { source: "elevation", exaggeration: 1 } : null);','''      if (m.isStyleLoaded()) {
        m.setTerrain(terrain ? { source: "elevation", exaggeration: 1 } : null);
        if(m.getLayer('terrain-shading'))m.setLayoutProperty('terrain-shading','visibility',terrain?'visible':'none');
      }''')
p.write_text(s,encoding='utf-8')
p=Path('src/flood/RiverHistory.tsx');s=p.read_text(encoding='utf-8').replace('viewBox="0 0 1010 370"','viewBox="0 0 1010 370"\n                preserveAspectRatio={renderWorld?"none":"xMidYMid meet"}')
s=s.replace('The cursor, flow column and daily readings update together. Column\n              height encodes discharge—not river depth.', '{renderWorld?"Scrub or play to update the map’s dated readings. The landscape is context; no flood-depth layer is connected.":"The cursor, flow column and daily readings update together. Column height encodes discharge—not river depth."}')
p.write_text(s,encoding='utf-8')
