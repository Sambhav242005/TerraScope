import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerUrl);
import { NRSC_FLOOD_SNAPSHOTS, NRSC_BOUNDS, nrscImageCoordinates } from "./nrsc";
import { RenewableLayer } from "./renewableModels";
import type { PlacementCheck } from "./placementCheck";
import { type Asset } from "./model";
import { type Intervention, type PlacementTool } from "./intervention";

type FeatureCollectionShim = {
  type: "FeatureCollection";
  features: Array<Record<string, unknown>>;
};
export type StorageMapData = {
  candidates: FeatureCollectionShim;
  water: FeatureCollectionShim;
};

function polygonCenterOf(feature: Record<string, unknown>): [number, number] | null {
  const geometry = feature.geometry as
    | { coordinates?: unknown }
    | undefined;
  const rings = geometry?.coordinates as Array<Array<[number, number]>> | undefined;
  if (!rings?.length || !rings[0].length) return null;
  const xs = rings[0].map((p) => p[0]);
  const ys = rings[0].map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

export default function MapView({
  focusArea,
  assets,
  selected,
  onSelect,
  onArea,
  showAssets,
  terrain,
  preset="floodplain",
  scene3d=false,
  storage=null,
  selectedStorage=null,
  onSelectStorage,
  showCandidates=true,
  showWaterLayer=true,
  interventions,
  selectedIntervention=null,
  onSelectIntervention,
  activePlacementTool="select",
  onPlaceAt,
  showInterventions=true,
  placementChecks,
}: {
  assets: Asset[];
  focusArea?:{lat:number;lon:number;label:string}|null;
  selected: string | null;
  onSelect: (id: string) => void;
  onArea: (p: { lat: number; lon: number }) => void;
  showAssets: boolean;
  terrain: boolean;
  preset?: "floodplain"|"headwaters"|"settlement";
  scene3d?: boolean;
  storage?: StorageMapData | null;
  selectedStorage?: string | null;
  onSelectStorage?: (id: string) => void;
  showCandidates?: boolean;
  showWaterLayer?: boolean;
  interventions?: Intervention[];
  selectedIntervention?: string | null;
  onSelectIntervention?: (id: string) => void;
  activePlacementTool?: PlacementTool;
  onPlaceAt?: (coords: { lat: number; lon: number }) => void;
  showInterventions?: boolean;
  placementChecks?: Record<string, PlacementCheck | null>;
}) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    markers = useRef<maplibregl.Marker[]>([]),
    interventionMarkers = useRef<maplibregl.Marker[]>([]),
    [error, setError] = useState(""),
    [satellite, setSatellite] = useState(false),
    [nrscSnapshot, setNrscSnapshot] = useState("");
  const renewableLayer = useRef<RenewableLayer | null>(null);
  const callbacks = useRef({ onArea, onSelect });
  callbacks.current = { onArea, onSelect };
  const latest = useRef({
    onArea,
    onSelect,
    onSelectStorage,
    storage,
    onSelectIntervention,
    activePlacementTool,
    onPlaceAt, interventions, showInterventions, placementChecks,
  });
  latest.current = {
    onArea,
    onSelect,
    onSelectStorage,
    storage,
    onSelectIntervention,
    activePlacementTool,
    onPlaceAt, interventions, showInterventions, placementChecks,
  };
  useEffect(() => {
    if (!host.current) return;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: host.current,
        center: [85.16, 25.71],
        zoom: 12.3,
        pitch: 45,
        bearing: -18,
        maxPitch: 65,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: [
                import.meta.env.VITE_OSM_TILES ||
                  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution:
                'Â© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
              maxzoom: 19,
            },
            satellite: {
              type: "raster",
              tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
              tileSize: 256,
              maxzoom: 19,
              attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community ? <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9">Sources & terms</a>',
            },
            elevation: {
              type: "raster-dem",
              tiles: [
                "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
              ],
              encoding: "terrarium",
              tileSize: 256,
              maxzoom: 15,
              attribution:
                '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Terrain: Mapzen / source credits</a>',
            },
          },
          layers: [
            {
              id: "base",
              type: "raster",
              source: "osm",
              paint: { "raster-saturation": -0.35, "raster-contrast": 0.04 },
            },
            { id: "satellite", type: "raster", source: "satellite", layout: { visibility: "none" } },
          ],
        },
        attributionControl: { compact: false },
      });
    } catch {
      setError("3D map unavailable. Use the resource list and data tables.");
      return;
    }
    map.current = m;
    m.addControl(new maplibregl.NavigationControl(), "bottom-right");
    m.addControl(
      new maplibregl.ScaleControl({ unit: "metric" }),
      "bottom-left",
    );
    const sceneLayers=['scene-water','scene-woods','scene-rivers','scene-roads','scene-buildings','scene-trees'];
    const applyScene=()=>{const show=!focusArea && terrain && scene3d && preset!=='headwaters';if(m.getLayer('base'))m.setLayoutProperty('base','visibility',show?'none':'visible');for(const id of sceneLayers)if(m.getLayer(id))m.setLayoutProperty(id,'visibility',show?'visible':'none');};
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
      const renewables = new RenewableLayer();
      m.addLayer(renewables);
      renewableLayer.current = renewables;
      renewables.setItems((latest.current.interventions ?? []).filter(i=>latest.current.placementChecks?.[i.id] && latest.current.placementChecks[i.id]?.status !== "conflict" && latest.current.placementChecks[i.id]?.status !== "unknown"), latest.current.showInterventions !== false);
    });

    m.on("click", (e) => {
      const target = e.originalEvent.target as HTMLElement;
      if (target.closest(".resource-pin") || target.closest(".intervention-pin")) {
        return;
      }
      if (latest.current.activePlacementTool && latest.current.activePlacementTool !== "select") {
        latest.current.onPlaceAt?.({ lat: e.lngLat.lat, lon: e.lngLat.lng });
        return;
      }
      const picked = renewableLayer.current?.pick(e.point);
      if (picked) { latest.current.onSelectIntervention?.(picked); return; }
      if (m.getLayer("storage-fill")) {
        const hit = m.queryRenderedFeatures(e.point, { layers: ["storage-fill"] })[0];
        const id = hit?.properties?.id;
        if (id) {
          latest.current.onSelectStorage?.(String(id));
          return;
        }
      }
      callbacks.current.onArea({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });
    m.on("error", (e) => {
      console.warn("Map layer:", e.error?.message);
      setError(
        "Some map tiles could not load. Resource lists and saved data remain available.",
      );
    });
    const observer = new ResizeObserver(() => m.resize());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      markers.current.forEach((p) => p.remove());
      interventionMarkers.current.forEach((p) => p.remove());
      renewableLayer.current = null;
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((p) => p.remove());
    markers.current = showAssets
      ? assets.map((a) => {
          const el = document.createElement("button");
          el.className = `resource-pin ${a.id === selected ? "selected" : ""} ${a.kind === "hospital" || a.kind === "clinic" ? "medical" : ""}`;
          el.textContent =
            a.kind === "hospital" || a.kind === "clinic"
              ? "+"
              : a.kind === "police"
                ? "â—‡"
                : "â–¥";
          el.setAttribute("aria-label", `Inspect ${a.name}`);
          el.title = a.name;
          el.onclick = (e) => {
            e.stopPropagation();
            callbacks.current.onSelect(a.id);
          };
          return new maplibregl.Marker({ element: el })
            .setLngLat([a.lon, a.lat])
            .addTo(m);
        })
      : [];
  }, [assets, selected, showAssets]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    interventionMarkers.current.forEach((p) => p.remove());
    if (showInterventions === false || !interventions?.length) {
      interventionMarkers.current = [];
      return;
    }
    const glyphs: Record<string, string> = {
      storage_basin: "âˆ‡",
      solar_array: "â˜¼",
      wind_turbine: "â…„",
      vegetation_buffer: "â™£",
    };
    interventionMarkers.current = interventions.map((item) => {
      const el = document.createElement("button");
      el.className = `intervention-pin ${item.kind} ${item.id === selectedIntervention ? "selected" : ""}`;
      el.textContent = glyphs[item.kind] ?? "â€¢";
      el.setAttribute("aria-label", `Inspect ${item.name}`);
      el.dataset.placementStatus = placementChecks?.[item.id]?.status ?? "unknown";
      el.title = `${item.name} - ${placementChecks?.[item.id]?.headline ?? "Suitability unknown"}`;
      el.onclick = (e) => {
        e.stopPropagation();
        latest.current.onSelectIntervention?.(item.id);
      };
      return new maplibregl.Marker({ element: el })
        .setLngLat([item.lon, item.lat])
        .addTo(m);
    });
  }, [interventions, selectedIntervention, showInterventions, placementChecks]);
  useEffect(() => {
    const m = map.current;
    const item = interventions?.find((i) => i.id === selectedIntervention);
    if (item && m) {
      m.easeTo({
        center: [item.lon, item.lat],
        zoom: Math.max(m.getZoom(), 16.5),
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500,
      });
    }
  }, [selectedIntervention]);
  useEffect(() => {
    const m = map.current;
    const a = assets.find((a) => a.id === selected);
    if (a && m)
      m.easeTo({
        center: [a.lon, a.lat],
        zoom: Math.max(m.getZoom(), 13),
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 500,
      });
  }, [selected]);
  useEffect(() => {
    const m = map.current;
    if (m) {
      if (m.isStyleLoaded()) {
        m.setTerrain(terrain ? { source: "elevation", exaggeration: 1 } : null);
        if(m.getLayer('terrain-shading'))m.setLayoutProperty('terrain-shading','visibility',terrain?'visible':'none');
      }
      m.easeTo({
        pitch: terrain ? 45 : 0,
        bearing: terrain ? -18 : 0,
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 400,
      });
    }
  }, [terrain]);
  useEffect(()=>{const m=map.current;if(!m)return;const high=preset==='headwaters';m.easeTo({center:high?[84.25,28.3]:preset==='settlement'?[85.16715,25.6938]:[85.16,25.71],zoom:high?10.2:preset==='settlement'?17.6:12.3,pitch:terrain?60:0,bearing:terrain?-18:0,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:700});},[preset]);
  useEffect(()=>{const m=map.current;if(!m)return;const update=()=>{const show=!focusArea&&terrain&&scene3d&&preset!=='headwaters'&&!satellite;if(m.getLayer('satellite'))m.setLayoutProperty('satellite','visibility',satellite?'visible':'none');if(m.getLayer('base'))m.setLayoutProperty('base','visibility',satellite||show?'none':'visible');for(const id of ['scene-water','scene-woods','scene-rivers','scene-roads','scene-buildings','scene-trees'])if(m.getLayer(id))m.setLayoutProperty(id,'visibility',show?'visible':'none');};if(m.isStyleLoaded())update();else m.once('load',update);return()=>{m.off('load',update)}},[terrain,scene3d,preset,satellite,focusArea]);
  useEffect(()=>{
    const m = map.current;
    if (!m) return;
    const apply = () => {
      if (!latest.current.storage) return;
      const { candidates, water } = latest.current.storage;
      if (!m.getSource("storage-candidates")) {
        m.addSource("storage-candidates", {
          type: "geojson",
          data: candidates,
          attribution:
            "Terrain depressions: Mapzen Terrain Tiles â€” github.com/tilezen/joerd/blob/master/docs/attribution.md",
        });
        m.addLayer({
          id: "storage-fill",
          type: "fill",
          source: "storage-candidates",
          paint: {
            "fill-color": "#1d8a96",
            "fill-opacity": ["case", ["==", ["get", "id"], selectedStorage ?? ""], 0.55, 0.28],
          },
        });
        m.addLayer({
          id: "storage-outline",
          type: "line",
          source: "storage-candidates",
          paint: {
            "line-color": "#116e79",
            "line-width": ["case", ["==", ["get", "id"], selectedStorage ?? ""], 2.5, 1.2],
          },
        });
      } else {
        (m.getSource("storage-candidates") as maplibregl.GeoJSONSource).setData(candidates);
      }
      if (!m.getSource("storage-water")) {
        m.addSource("storage-water", {
          type: "geojson",
          data: water,
          attribution: "Â© OpenStreetMap contributors (ODbL)",
        });
        m.addLayer({
          id: "storage-water",
          type: "line",
          source: "storage-water",
          paint: { "line-color": "#3f8fa6", "line-width": 1.1, "line-dasharray": [2, 1.5], "line-opacity": 0.85 },
        });
      } else {
        (m.getSource("storage-water") as maplibregl.GeoJSONSource).setData(water);
      }
    };
    if (m.isStyleLoaded()) apply();
    else m.once("load", apply);
    return () => { m.off("load", apply) };
  }, [storage, selectedStorage]);
  useEffect(()=>{
    const m=map.current;if(!m)return;
    const update=()=>{if(m.getLayer('storage-fill'))m.setLayoutProperty('storage-fill','visibility',showCandidates?'visible':'none');if(m.getLayer('storage-outline'))m.setLayoutProperty('storage-outline','visibility',showCandidates?'visible':'none');if(m.getLayer('storage-water'))m.setLayoutProperty('storage-water','visibility',showWaterLayer?'visible':'none');};
    if(m.isStyleLoaded())update();else m.once('load',update);return()=>{m.off('load',update)};
  },[showCandidates,showWaterLayer]);
  useEffect(()=>{
    const m=map.current;if(!m)return;
    const data=latest.current.storage;
    if(!selectedStorage||!data)return;
    const feature=data.candidates.features.find(f=>f.id===selectedStorage||(f.properties as {id?:unknown}|undefined)?.id===selectedStorage);
    const center=feature?polygonCenterOf(feature):null;
    if(!center)return;
    m.easeTo({center,zoom:Math.max(m.getZoom(),14),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:600});
  },[selectedStorage]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      const snapshot = NRSC_FLOOD_SNAPSHOTS.find(s => s.id === nrscSnapshot);
      if (!snapshot) {
        if (m.getLayer("nrsc-flood")) m.setLayoutProperty("nrsc-flood", "visibility", "none");
        return;
      }
      const source = m.getSource("nrsc-flood") as maplibregl.ImageSource | undefined;
      if (source) source.updateImage({ url: snapshot.image, coordinates: nrscImageCoordinates() });
      else {
        m.addSource("nrsc-flood", { type: "image", url: snapshot.image, coordinates: nrscImageCoordinates() });
        m.addLayer({ id: "nrsc-flood", type: "raster", source: "nrsc-flood", paint: { "raster-opacity": 0.65, "raster-fade-duration": 0 } });
      }
      m.setLayoutProperty("nrsc-flood", "visibility", "visible");
    };
    if (m.isStyleLoaded() || m.getSource("nrsc-flood")) apply(); else m.once("load", apply);
    return () => { m.off("load", apply); };
  }, [nrscSnapshot]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      const data = { type: "FeatureCollection" as const, features: Object.entries(placementChecks ?? {}).flatMap(([id, check]) => check ? [{ type: "Feature", properties: { id, status: check.status }, geometry: check.footprint }] : []) };
      const source = m.getSource("placement-footprints") as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(data);
      else {
        m.addSource("placement-footprints", { type: "geojson", data });
        m.addLayer({ id: "placement-footprints", type: "line", source: "placement-footprints", paint: { "line-color": ["case", ["==", ["get", "status"], "conflict"], "#a43b2d", "#986013"], "line-width": 2, "line-dasharray": [2, 1] } });
      }
      m.setLayoutProperty("placement-footprints", "visibility", showInterventions === false ? "none" : "visible");
    };
    if (m.isStyleLoaded() || m.getSource("placement-footprints")) apply(); else m.once("load", apply);
    return () => { m.off("load", apply); };
  }, [placementChecks, showInterventions]);
  useEffect(() => { renewableLayer.current?.setItems((interventions ?? []).filter(i=>placementChecks?.[i.id] && placementChecks[i.id]?.status !== "conflict" && placementChecks[i.id]?.status !== "unknown"), showInterventions !== false); }, [interventions, showInterventions, placementChecks]);
  useEffect(() => { if(focusArea)map.current?.easeTo({center:[focusArea.lon,focusArea.lat],zoom:15,pitch:terrain?45:0,duration:0}); }, [focusArea]);
  return (
    <div className="map-view">
      <div ref={host} className="map-host" />
      {(interventions ?? []).some(i => i.kind === 'solar_array' || i.kind === 'wind_turbine') && showInterventions !== false && <div className="renewable-model-note">Conflicting/unchecked 3D models are hidden; proposal pins remain. Solar = grouped tables; wind = one turbine. Illustrative dimensions, not engineering designs. Terrain anchoring uses loaded DEM; otherwise zero elevation.</div>}
      <div className="basemap-control" role="group" aria-label="Basemap">
        <button type="button" aria-pressed={!satellite} onClick={() => setSatellite(false)}>Street</button>
        <button type="button" aria-pressed={satellite} onClick={() => setSatellite(true)}>Satellite</button>
        {satellite && <small>Esri imagery mosaic ? dates vary; not event imagery</small>}
        {nrscSnapshot && <small><a href="https://www.nrsc.gov.in" target="_blank" rel="noreferrer">Source: NRSC, ISRO/DOS</a> | historical inundation; not depth</small>}
        <details className="indian-evidence">
          <summary>{nrscSnapshot ? `NRSC flood: ${nrscSnapshot.slice(0, 10)} (fixed date)` : "Indian evidence"}</summary>
          <label>NRSC historical flood map
            <select aria-label="NRSC historical flood map" value={nrscSnapshot} onChange={e => setNrscSnapshot(e.target.value)}>
              <option value="">Hidden</option>
              {NRSC_FLOOD_SNAPSHOTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <small>Fixed observation date; independent of replay. Cyan: provider-mapped inundation. Unmarked/outside coverage: unknown. No depth or blockage evidence.</small>
          {nrscSnapshot && <button type="button" onClick={() => map.current?.fitBounds([[NRSC_BOUNDS[0],NRSC_BOUNDS[1]],[NRSC_BOUNDS[2],NRSC_BOUNDS[3]]], { padding: 55, duration: 0 })}>View snapshot area</button>}
          <a href="/data/nrsc/manifest.json" target="_blank" rel="noreferrer">Source, bounds, dates &amp; fingerprints</a>
          <a href="https://www.nrsc.gov.in/nrscnew/termsConditions.php" target="_blank" rel="noreferrer">Source: NRSC, ISRO/DOS ? terms</a>
        </details>
      </div>
      {error && (
        <div className="map-warning" role="status">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss map message">
            Ã—
          </button>
        </div>
      )}<button
        className="reset-map"
        onClick={() =>
          map.current?.easeTo({
            center: focusArea ? [focusArea.lon,focusArea.lat] : preset === "headwaters" ? [84.25,28.3] : preset === "settlement" ? [85.16715,25.6938] : [85.16, 25.71],
            zoom: focusArea ? 15 : preset === "headwaters" ? 10.2 : preset === "settlement" ? 17.6 : 12.3,
            pitch: terrain ? 45 : 0,
            bearing: terrain ? -18 : 0,
            duration: 0,
          })
        }
      >
        Reset view
      </button>
    </div>
  );
}
