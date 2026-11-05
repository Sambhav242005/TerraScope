from pathlib import Path
p=Path('src/flood/MapView.tsx');s=p.read_text(encoding='utf-8').replace('  preset="floodplain",','  preset="floodplain",\n  scene3d=false,').replace('  preset?: "floodplain"|"headwaters";','  preset?: "floodplain"|"headwaters"|"settlement";\n  scene3d?: boolean;')
# formatted source may still have exact unformatted signature from earlier patch.
start=s.index('    m.on("load", () => {');end=s.index('\n    m.on("click",',start)
s=s[:start]+'''    const sceneLayers=['scene-water','scene-woods','scene-rivers','scene-roads','scene-buildings','scene-trees'];
    const applyScene=()=>{const show=terrain && scene3d && preset!=='headwaters';if(m.getLayer('base'))m.setLayoutProperty('base','visibility',show?'none':'visible');for(const id of sceneLayers)if(m.getLayer(id))m.setLayoutProperty(id,'visibility',show?'visible':'none');};
    m.on("load", () => {
      if (terrain) m.setTerrain({ source: "elevation", exaggeration: 1 });
      m.addLayer({id:'scene-ground',type:'background',paint:{'background-color':'#d4dfb9'}},'base');
      m.addLayer({id:'terrain-shading',type:'hillshade',source:'elevation',layout:{visibility:terrain?'visible':'none'},paint:{'hillshade-shadow-color':'#354a3b','hillshade-highlight-color':'#fff8dc','hillshade-accent-color':'#53705b','hillshade-exaggeration':0.6}});
      if(scene3d){
        m.addSource('scene',{type:'geojson',data:'/data/scene-geometry.json'});
        m.addLayer({id:'scene-woods',type:'fill',source:'scene',filter:['==',['get','kind'],'wood'],paint:{'fill-color':'#9fb77a'}});
        m.addLayer({id:'scene-water',type:'fill',source:'scene',filter:['==',['get','kind'],'water'],paint:{'fill-color':'#65bdc9'}});
        m.addLayer({id:'scene-rivers',type:'line',source:'scene',filter:['==',['get','kind'],'river'],paint:{'line-color':'#65bdc9','line-width':3}});
        m.addLayer({id:'scene-roads',type:'line',source:'scene',filter:['==',['get','kind'],'road'],paint:{'line-color':'#fff8e0','line-width':['interpolate',['linear'],['zoom'],12,1,18,6]}});
        m.addLayer({id:'scene-buildings',type:'fill-extrusion',source:'scene',filter:['==',['get','kind'],'building'],paint:{'fill-extrusion-color':'#d9b783','fill-extrusion-height':['get','height'],'fill-extrusion-base':0,'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true}});
        m.addLayer({id:'scene-trees',type:'fill-extrusion',source:'scene',filter:['==',['get','kind'],'tree'],paint:{'fill-extrusion-color':['case',['==',['get','tier'],0],'#8d7252','#5c8d62'],'fill-extrusion-height':['get','height'],'fill-extrusion-base':['get','base'],'fill-extrusion-opacity':1}});
      }
      applyScene();
    });
''' +s[end:]
# Add style synchronization independent of replay changes; use idle to handle load race.
idx=s.index('  return (\n    <div className="map-view">');s=s[:idx]+'''  useEffect(()=>{const m=map.current;if(!m)return;const update=()=>{const show=terrain&&scene3d&&preset!=='headwaters';if(m.getLayer('base'))m.setLayoutProperty('base','visibility',show?'none':'visible');for(const id of ['scene-water','scene-woods','scene-rivers','scene-roads','scene-buildings','scene-trees'])if(m.getLayer(id))m.setLayoutProperty(id,'visibility',show?'visible':'none');};if(m.isStyleLoaded())update();else m.once('load',update);return()=>{m.off('load',update)}},[terrain,scene3d,preset]);
'''+s[idx:]
s=s.replace("center:high?[84.25,28.3]:[85.16,25.71],zoom:high?10.2:12.3,pitch:terrain?55:0", "center:high?[84.25,28.3]:preset==='settlement'?[85.16715,25.6938]:[85.16,25.71],zoom:high?10.2:preset==='settlement'?17.6:12.3,pitch:terrain?60:0")
s=s.replace('preset === "headwaters" ? [84.25,28.3] : [85.16, 25.71]', 'preset === "headwaters" ? [84.25,28.3] : preset === "settlement" ? [85.16715,25.6938] : [85.16, 25.71]').replace('preset === "headwaters" ? 10.2 : 12.3','preset === "headwaters" ? 10.2 : preset === "settlement" ? 17.6 : 12.3')
p.write_text(s,encoding='utf-8')
p=Path('src/flood/WorldMap.tsx');s=p.read_text(encoding='utf-8').replace("useState<'floodplain'|'headwaters'>('floodplain')","useState<'floodplain'|'headwaters'|'settlement'>('settlement')").replace('preset={place}/>','preset={place} scene3d/>').replace("place==='floodplain'?'Gandak meets the Ganges.':'Into the Himalayas.'", "place==='settlement'?'Sonpur in three dimensions.':place==='floodplain'?'Gandak meets the Ganges.':'Into the Himalayas.'").replace("place==='floodplain'?'Sonpur floodplain · Bihar, India':'Himalayan terrain · Nepal · contextual view'", "place==='settlement'?'Mapped footprints · dimensional buildings · orbit to explore':place==='floodplain'?'Sonpur floodplain · Bihar, India':'Himalayan terrain · Nepal · contextual view'").replace('<option value="floodplain">','<option value="settlement">Sonpur buildings · 3D</option><option value="floodplain">').replace('Geographic context. Flood extent and depth are not available.','27 mapped buildings · illustrative 6 m heights. Trees are decorative. Water footprints are static; no flood depth.')
p.write_text(s,encoding='utf-8')
