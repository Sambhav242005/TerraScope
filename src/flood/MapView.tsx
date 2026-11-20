import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerUrl);
import { NRSC_SNAPSHOTS_ENABLED, NRSC_FLOOD_SNAPSHOTS, NRSC_BOUNDS, nrscImageCoordinates } from "./nrsc";
import { RenewableLayer } from "./renewableModels";
import type { PlacementCheck, PlacementEvidence } from "./placementCheck";
import type { PlacementAttempt } from "./placementAdmission";
import { summarizeAttempt } from "./placementFeedback";
import { type Asset } from "./model";
import { type Intervention, type PlacementTool } from "./intervention";
import type { AreaEvidenceCollection } from "./areaReview/contracts";
import type { BasinFeatureCollection } from "./hydrobasins";

type FeatureCollectionShim = {
  type: "FeatureCollection";
  features: Array<Record<string, unknown>>;
};

/** The scenario requests DEM tiles only for the Gandak/Sonpur box. `bounds`
 * limits tile requests, not a hard visual clip; `minzoom` 9 keeps the layer
 * from following a far zoom-out. It is still terrain-only, not a flood map. */
const WATER_SCENARIO_BOUNDS: [number, number, number, number] = [
  84.75, 25.35, 85.55, 26.0,
];
const WATER_SCENARIO_TILES = [
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
];
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
  areaEvidence,
  onEvidenceSelect,
  focusArea,
  focusPoint,
  waterLevel = null,
  replayDate,
  discharge = null,
  dischargeMax = 1,
  dateLabel = "",
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
  showBasins=false,
  basins=null,
  interventions,
  selectedIntervention=null,
  onSelectIntervention,
  activePlacementTool="select",
  onPlaceAt,
  onMoveIntervention,
  showInterventions=true,
  placementChecks,
  placementAttempt=null,
  placementEvidence=null,
  onDismissPlacementAttempt,
}: {
  areaEvidence?: AreaEvidenceCollection;
  onEvidenceSelect?: () => void;
  assets: Asset[];
  focusArea?:{lat:number;lon:number;label:string}|null;
  focusPoint?:{lat:number;lon:number}|null;
  /** Terrain-only scenario: paint every DEM cell below this elevation (m). */
  waterLevel?:number|null;
  /** Replay day (YYYY-MM-DD); matching observed snapshots auto-load. */
  replayDate?:string;
  /** GloFAS modeled discharge at the sample river cell for the replay day. */
  discharge?:number|null;
  /** Largest discharge in the replayed window; scales the marker bar only. */
  dischargeMax?:number;
  dateLabel?:string;
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
  showBasins?: boolean;
  basins?: BasinFeatureCollection | null;
  interventions?: Intervention[];
  selectedIntervention?: string | null;
  onSelectIntervention?: (id: string) => void;
  activePlacementTool?: PlacementTool;
  onPlaceAt?: (coords: { lat: number; lon: number }) => void;
  /** Drag a saved proposal pin to a new spot; the drop is re-admitted before anything persists. */
  onMoveIntervention?: (id: string, coords: { lat: number; lon: number }) => void;
  showInterventions?: boolean;
  placementChecks?: Record<string, PlacementCheck | null>;
  placementAttempt?: PlacementAttempt | null;
  placementEvidence?: PlacementEvidence | null;
  onDismissPlacementAttempt?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    markers = useRef<maplibregl.Marker[]>([]),
    interventionMarkers = useRef<maplibregl.Marker[]>([]),
    [error, setError] = useState(""),
    [satellite, setSatellite] = useState(false),
    [nrscSnapshot, setNrscSnapshot] = useState(""),
    autoNrsc = useRef("");
  const evidenceCallback = useRef(onEvidenceSelect);
  evidenceCallback.current = onEvidenceSelect;
  const renewableLayer = useRef<RenewableLayer | null>(null);
  const riverGauge = useRef<{ marker: maplibregl.Marker; el: HTMLDivElement } | null>(null);
  const callbacks = useRef({ onArea, onSelect });
  callbacks.current = { onArea, onSelect };
  const latest = useRef({
    onArea,
    onSelect,
    onSelectStorage,
    storage,
    onSelectIntervention,
    activePlacementTool,
    onPlaceAt, onMoveIntervention, interventions, showInterventions, placementChecks,
  });
  latest.current = {
    onArea,
    onSelect,
    onSelectStorage,
    storage,
    onSelectIntervention,
    activePlacementTool,
    onPlaceAt, onMoveIntervention, interventions, showInterventions, placementChecks,
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
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
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
      if (m.getLayer("area-evidence-point") && m.queryRenderedFeatures(e.point, {layers: ["area-evidence-point"]}).length) { evidenceCallback.current?.(); return; }
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
    const update = () => {
      const data = areaEvidence ?? { type: "FeatureCollection" as const, features: [] };
      const source = m.getSource("area-evidence") as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(data);
      else { m.addSource("area-evidence", {type: "geojson", data}); m.addLayer({id: "area-evidence-point", type: "circle", source: "area-evidence", paint: {"circle-radius": 9, "circle-color": "#8769a6", "circle-stroke-width": 3, "circle-stroke-color": "#fffdf7"}}); }
    };
    if (m.getSource("area-evidence") || m.isStyleLoaded()) update();
    else m.once("idle", update);
    return () => { m.off("idle", update); };
  }, [areaEvidence]);

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
                ? "P"
                : a.kind === "school"
                  ? "S"
                  : "•";
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
      storage_basin: "∇",
      solar_array: "☀",
      wind_turbine: "✦",
      vegetation_buffer: "♣",
    };
    interventionMarkers.current = interventions.map((item) => {
      const el = document.createElement("button");
      el.className = `intervention-pin ${item.kind} ${item.id === selectedIntervention ? "selected" : ""}`;
      el.textContent = glyphs[item.kind] ?? "•";
      el.setAttribute("aria-label", `Inspect ${item.name}`);
      el.dataset.placementStatus = placementChecks?.[item.id]?.status ?? "unknown";
      el.title = `${item.name} - ${placementChecks?.[item.id]?.headline ?? "Suitability unknown"}${latest.current.onMoveIntervention ? " (drag to move; the move is re-checked before it persists)" : ""}`;
      el.onclick = (e) => {
        e.stopPropagation();
        latest.current.onSelectIntervention?.(item.id);
      };
      // Custom elements keep keyboard behaviour application-owned; dragging is the
      // pointer gesture and the inspector nudge buttons are the keyboard/touch path.
      el.style.touchAction = "none";
      const draggable = Boolean(latest.current.onMoveIntervention);
      const marker = new maplibregl.Marker({ element: el, draggable })
        .setLngLat([item.lon, item.lat])
        .addTo(m);
      if (draggable) {
        marker.on("dragend", () => {
          const dropped = marker.getLngLat();
          // Snap back to the as-saved position first. If the move is admitted,
          // the interventions prop changes and this marker is rebuilt at the drop.
          marker.setLngLat([item.lon, item.lat]);
          latest.current.onMoveIntervention?.(item.id, { lat: dropped.lat, lon: dropped.lng });
        });
      }
      return marker;
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
  useEffect(()=>{const m=map.current;if(!m)return;const high=preset==='headwaters';m.easeTo({center:high?[84.25,28.3]:preset==='settlement'?[85.16715,25.6938]:[85.16,25.71],zoom:high?10.2:preset==='settlement'?17.6:12.3,pitch:terrain?40:0,bearing:terrain?-18:0,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:700});},[preset]);
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
            "Terrain depressions: Mapzen Terrain Tiles — github.com/tilezen/joerd/blob/master/docs/attribution.md",
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
          attribution: "© OpenStreetMap contributors (ODbL)",
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
    if (basins && !m.getSource("sub-basins")) {
      const apply = () => {
        if (m.getSource("sub-basins")) return;
        m.addSource("sub-basins", {
          type: "geojson",
          data: basins as unknown as never,
          attribution: "HydroBASINS v1c (Lehner & Grill 2013), HydroSHEDS license",
        });
        m.addLayer({
          id: "sub-basin-outline",
          type: "line",
          source: "sub-basins",
          layout: { visibility: showBasins ? "visible" : "none" },
          paint: { "line-color": "#6d5a9e", "line-width": 1.1, "line-dasharray": [3, 2], "line-opacity": 0.85 },
        });
      };
      if (m.isStyleLoaded()) apply();
      else m.once("load", apply);
      return () => { m.off("load", apply) };
    }
    if (basins && m.getSource("sub-basins")) (m.getSource("sub-basins") as maplibregl.GeoJSONSource).setData(basins as unknown as never);
  }, [basins]);
  useEffect(()=>{
    const m=map.current;if(!m)return;
    const apply=()=>{if(m.getLayer('sub-basin-outline'))m.setLayoutProperty('sub-basin-outline','visibility',showBasins?'visible':'none');};
    if(m.isStyleLoaded())apply();else m.once('load',apply);return()=>{m.off('load',apply)};
  },[showBasins]);
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
      const snapshot = NRSC_SNAPSHOTS_ENABLED ? NRSC_FLOOD_SNAPSHOTS.find(s => s.id === nrscSnapshot) : undefined;
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
  // Replay only shows an observed provider map on its own fixed date. It never
  // interpolates between snapshots or treats the image as depth.
  useEffect(() => {
    if (!replayDate || !NRSC_SNAPSHOTS_ENABLED) return;
    const match = NRSC_FLOOD_SNAPSHOTS.find(s => s.id.startsWith(replayDate));
    if (match) {
      autoNrsc.current = match.id;
      setNrscSnapshot(match.id);
    } else if (autoNrsc.current) {
      setNrscSnapshot(prev => (prev === autoNrsc.current ? "" : prev));
      autoNrsc.current = "";
    }
  }, [replayDate]);
  // A labeled sample-cell reading, not a hazard radius: the bar only encodes
  // modeled discharge relative to the replayed nine-day window.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const el = document.createElement("div");
    el.className = "river-gauge";
    el.innerHTML =
      '<span class="river-gauge-bar"><i></i></span><span class="river-gauge-copy"><small>GloFAS model · sample cell</small><strong></strong></span>';
    const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([85.125, 25.775])
      .addTo(m);
    riverGauge.current = { marker, el };
    return () => {
      riverGauge.current = null;
      marker.remove();
    };
  }, []);
  useEffect(() => {
    const gauge = riverGauge.current;
    if (!gauge) return;
    if (discharge == null) {
      gauge.el.style.display = "none";
      return;
    }
    gauge.el.style.display = "flex";
    const strong = gauge.el.querySelector("strong");
    if (strong) {
      strong.textContent = `${Math.round(discharge).toLocaleString("en-IN")} m³/s`;
    }
    const bar = gauge.el.querySelector("i") as HTMLElement | null;
    if (bar) {
      const fraction = Math.max(0.08, Math.min(1, discharge / Math.max(1, dischargeMax)));
      bar.style.height = `${Math.round(fraction * 30)}px`;
    }
    gauge.el.title = `GloFAS modeled discharge on ${dateLabel} at 85.125, 25.775. Sample-cell estimate, not a gauge. Bar is relative to the selected history window, not flood depth or extent.`;
  }, [discharge, dischargeMax, dateLabel]);
  // Terrain-only water scenario: a flat user-set surface painted over DEM
  // cells below it. No hydraulic routing, timing, embankments or depth model.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const sourceId = "water-scenario-dem";
    const layerId = "water-scenario";
    const apply = () => {
      if (!m.getSource(sourceId)) {
        m.addSource(sourceId, {
          type: "raster-dem",
          tiles: WATER_SCENARIO_TILES,
          encoding: "terrarium",
          tileSize: 256,
          maxzoom: 15,
          bounds: WATER_SCENARIO_BOUNDS,
        });
      }
      if (waterLevel == null) {
        if (m.getLayer(layerId)) m.setLayoutProperty(layerId, "visibility", "none");
        return;
      }
      const color: maplibregl.ExpressionSpecification = [
        "interpolate",
        ["linear"],
        ["elevation"],
        0, "#083f57",
        waterLevel - 8, "#0c5674",
        waterLevel - 4, "#176d8b",
        waterLevel - 1.5, "#2b8aa6",
        waterLevel, "#63bdd2",
        waterLevel + 0.4, "rgba(99,189,210,0)",
      ];
      if (m.getLayer(layerId)) {
        m.setPaintProperty(layerId, "color-relief-color", color);
        m.setLayoutProperty(layerId, "visibility", "visible");
      } else {
        m.addLayer({
          id: layerId,
          type: "color-relief",
          source: sourceId,
          minzoom: 9,
          paint: {
            "color-relief-color": color,
            "color-relief-opacity": 0.78,
          },
        });
      }
    };
    if (m.isStyleLoaded() || m.getSource(sourceId)) apply();
    else m.once("load", apply);
    return () => { m.off("load", apply); };
  }, [waterLevel]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      const data = { type: "FeatureCollection" as const, features: Object.entries(placementChecks ?? {}).flatMap(([id, check]) => check ? [{ type: "Feature", properties: { id, status: check.status }, geometry: check.footprint }] : []) };
      const source = m.getSource("placement-footprints") as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(data);
      else m.addSource("placement-footprints", { type: "geojson", data });
      if (!m.getLayer("placement-footprints-fill")) {
        m.addLayer({ id: "placement-footprints-fill", type: "fill", source: "placement-footprints", paint: { "fill-color": ["case", ["==", ["get", "status"], "conflict"], "#a43b2d", ["==", ["get", "status"], "unknown"], "#7b8a7f", "#986013"], "fill-opacity": 0.1 } });
      }
      if (!m.getLayer("placement-footprints")) {
        m.addLayer({ id: "placement-footprints", type: "line", source: "placement-footprints", paint: { "line-color": ["case", ["==", ["get", "status"], "conflict"], "#a43b2d", ["==", ["get", "status"], "unknown"], "#7b8a7f", "#986013"], "line-width": 2, "line-dasharray": [2, 1] } });
      }
      m.setLayoutProperty("placement-footprints-fill", "visibility", showInterventions === false ? "none" : "visible");
      m.setLayoutProperty("placement-footprints", "visibility", showInterventions === false ? "none" : "visible");
    };
    if (m.isStyleLoaded() || m.getSource("placement-footprints")) apply(); else m.once("load", apply);
    return () => { m.off("load", apply); };
  }, [placementChecks, showInterventions]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const attemptCheck = placementAttempt?.check ?? null;
    const selectedCheck = selectedIntervention ? placementChecks?.[selectedIntervention] ?? null : null;
    const checks = [attemptCheck, selectedCheck].filter((c): c is PlacementCheck => c !== null);
    const conflictIds = new Set(checks.flatMap((c) => c.findings.flatMap((f) => f.featureIds)));
    const conflictData = {
      type: "FeatureCollection" as const,
      features: (placementEvidence?.features ?? [])
        .filter((f) => conflictIds.has(f.id))
        .map((f) => ({ type: "Feature" as const, properties: { kind: f.kind, label: f.label ?? "" }, geometry: f.geometry })),
    };
    const attemptData = {
      type: "FeatureCollection" as const,
      features: placementAttempt ? [{ type: "Feature" as const, properties: { state: placementAttempt.state }, geometry: placementAttempt.check.footprint }] : [],
    };
    const apply = () => {
      const source = m.getSource("placement-conflicts") as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(conflictData);
      else m.addSource("placement-conflicts", { type: "geojson", data: conflictData });
      if (!m.getLayer("placement-conflicts-halo")) {
        m.addLayer({ id: "placement-conflicts-halo", type: "line", source: "placement-conflicts", paint: { "line-color": "#a43b2d", "line-width": 6, "line-opacity": 0.2, "line-blur": 1 } });
      }
      if (!m.getLayer("placement-conflicts-line")) {
        m.addLayer({ id: "placement-conflicts-line", type: "line", source: "placement-conflicts", paint: { "line-color": "#a43b2d", "line-width": 3, "line-dasharray": [2, 1] } });
      }
      const attemptSource = m.getSource("placement-attempt") as maplibregl.GeoJSONSource | undefined;
      if (attemptSource) attemptSource.setData(attemptData);
      else m.addSource("placement-attempt", { type: "geojson", data: attemptData });
      if (!m.getLayer("placement-attempt-fill")) {
        m.addLayer({ id: "placement-attempt-fill", type: "fill", source: "placement-attempt", paint: { "fill-color": ["case", ["==", ["get", "state"], "blocked"], "#a43b2d", ["==", ["get", "state"], "failed"], "#a43b2d", "#986013"], "fill-opacity": 0.16 } });
      }
      if (!m.getLayer("placement-attempt-line")) {
        m.addLayer({ id: "placement-attempt-line", type: "line", source: "placement-attempt", paint: { "line-color": ["case", ["==", ["get", "state"], "blocked"], "#a43b2d", ["==", ["get", "state"], "failed"], "#a43b2d", "#986013"], "line-width": 3.5, "line-dasharray": [1.5, 1] } });
      }
    };
    let tries = 0;
    const run = () => {
      try { apply(); }
      catch { if (++tries < 3) m.once("idle", run); }
    };
    // isStyleLoaded() can stay false while raster tiles stream; wait for the
    // next idle/load instead of silently dropping the attempt layers.
    if (m.getSource("placement-attempt") || m.isStyleLoaded()) run();
    else { m.once("load", run); m.once("idle", run); }
    return () => { m.off("load", run); m.off("idle", run); };
  }, [placementAttempt, placementChecks, placementEvidence, selectedIntervention]);
  useEffect(() => { renewableLayer.current?.setItems((interventions ?? []).filter(i=>placementChecks?.[i.id] && placementChecks[i.id]?.status !== "conflict" && placementChecks[i.id]?.status !== "unknown"), showInterventions !== false); }, [interventions, showInterventions, placementChecks]);
  useEffect(() => { if(focusArea)map.current?.easeTo({center:[focusArea.lon,focusArea.lat],zoom:15,pitch:terrain?45:0,duration:0}); }, [focusArea]);
  // Camera-only recenter for a checked spot: keep the current area evidence and
  // zoom level, but make the attempted footprint visible.
  useEffect(() => { const m=map.current; if(focusPoint&&m)m.easeTo({center:[focusPoint.lon,focusPoint.lat],zoom:Math.max(m.getZoom(),15),duration:0}); }, [focusPoint]);
  const attemptKinds = summarizeAttempt(placementAttempt?.check).kinds;
  return (
    <div className="map-view">
      <div ref={host} className="map-host" />
      {placementAttempt && (
        <div className={`placement-attempt-banner ${placementAttempt.state}`} role="status">
          <strong>
            {placementAttempt.state === "checking"
              ? `Checking ${placementAttempt.target.lat.toFixed(4)}, ${placementAttempt.target.lon.toFixed(4)}…`
              : placementAttempt.state === "failed"
                ? `Check failed · ${placementAttempt.target.lat.toFixed(4)}, ${placementAttempt.target.lon.toFixed(4)}`
                : `Not placed · ${placementAttempt.target.lat.toFixed(4)}, ${placementAttempt.target.lon.toFixed(4)}`}
          </strong>
          <span>
            {placementAttempt.state === "checking"
              ? "Loading area evidence…"
              : placementAttempt.state === "failed"
                ? "Area evidence unavailable."
                : `${attemptKinds.length ? attemptKinds.join(", ") : "mapped conflict"} · nothing saved`}
          </span>
          {onDismissPlacementAttempt && <button onClick={onDismissPlacementAttempt} aria-label="Dismiss spot check">×</button>}
        </div>
      )}
      {(interventions ?? []).some(i => i.kind === 'solar_array' || i.kind === 'wind_turbine') && showInterventions !== false && !placementAttempt && <div className="renewable-model-note">Conflicting/unchecked 3D models are hidden; proposal pins remain. Solar = grouped tables; wind = one turbine. Illustrative dimensions, not engineering designs. Terrain anchoring uses loaded DEM; otherwise zero elevation.</div>}
      {waterLevel != null && (
        <div className="water-legend" role="note" aria-label="Water scenario legend">
          <strong>Water-level scenario · {waterLevel.toFixed(1)} m</strong>
          <span className="water-legend-band" aria-hidden="true" />
          <span>Every DEM cell below this surface</span>
          <small>
            Terrain-only. Depth bands are illustrative; no river hydraulics,
            timing, embankments or surveyed bathymetry.
          </small>
        </div>
      )}
      <div className="basemap-control" role="group" aria-label="Basemap">
        <button type="button" aria-pressed={!satellite} onClick={() => setSatellite(false)}>Street</button>
        <button type="button" aria-pressed={satellite} onClick={() => setSatellite(true)}>Satellite</button>
        {satellite && <small>Esri imagery mosaic ? dates vary; not event imagery</small>}
        {nrscSnapshot && NRSC_SNAPSHOTS_ENABLED && <small><a href="https://www.nrsc.gov.in" target="_blank" rel="noreferrer">Source: NRSC, ISRO/DOS</a> | historical inundation; not depth</small>}
        <details className="indian-evidence">
          <summary>{NRSC_SNAPSHOTS_ENABLED ? (nrscSnapshot ? `NRSC flood: ${nrscSnapshot.slice(0, 10)} (fixed date)` : "Indian evidence") : "Indian evidence (withheld)"}</summary>
          {NRSC_SNAPSHOTS_ENABLED ? (
            <>
              <label>NRSC historical flood map
                <select aria-label="NRSC historical flood map" value={nrscSnapshot} onChange={e => setNrscSnapshot(e.target.value)}>
                  <option value="">Hidden</option>
                  {NRSC_FLOOD_SNAPSHOTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
              <small>Fixed observation date; it loads only on that replay day. Cyan: provider-mapped inundation. Unmarked/outside coverage: unknown. No depth or blockage evidence.</small>
              {nrscSnapshot && <button type="button" onClick={() => map.current?.fitBounds([[NRSC_BOUNDS[0],NRSC_BOUNDS[1]],[NRSC_BOUNDS[2],NRSC_BOUNDS[3]]], { padding: 55, duration: 0 })}>View snapshot area</button>}
              <a href="/data/nrsc/manifest.json" target="_blank" rel="noreferrer">Source, bounds, dates &amp; fingerprints</a>
              <a href="https://www.nrsc.gov.in/nrscnew/termsConditions.php" target="_blank" rel="noreferrer">Source: NRSC, ISRO/DOS ? terms</a>
            </>
          ) : (
            <>
              <small>Observed NRSC/ISRO flood maps are withheld from this public build: production/hosting rights are not cleared (non-commercial development snapshots only, per the provider). Observed extents remain unavailable — not dry, not safe, simply not redistributable here.</small>
              <a href="https://www.nrsc.gov.in/nrscnew/termsConditions.php" target="_blank" rel="noreferrer">Source: NRSC, ISRO/DOS ? terms</a>
            </>
          )}
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
