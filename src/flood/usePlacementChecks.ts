import { useEffect, useMemo, useState } from 'react';
import { checkPlacement, type PlacementCheck, type PlacementEvidence } from './placementCheck';
import {checkScenePlacement} from './placementAdmission';
import {fetchAreaEvidence, placementAreaKey} from './areaEvidence';
import type { Intervention } from './intervention';

// The bundled Sonpur evidence is static for the session. Local area extracts are
// cached by exact check area so retrying the same spot does not repeat the
// network request or duplicate evidence.
const baseCache: { data: PlacementEvidence | null } = { data: null };
const areaCache = new Map<string, PlacementEvidence>();
function clone<T>(value: T): T { return structuredClone(value); }
function cacheArea(key: string, data: PlacementEvidence) {
  if (areaCache.size >= 20) areaCache.delete(areaCache.keys().next().value!);
  areaCache.set(key, clone(data));
}
async function loadBase(signal: AbortSignal): Promise<PlacementEvidence> {
  if (baseCache.data) return clone(baseCache.data);
  const response = await fetch('/data/placement-evidence.json', { signal });
  if (!response.ok) throw Error('Evidence unavailable');
  const data: PlacementEvidence = await response.json();
  checkPlacement({ id: 'schema-check', name: 'Schema check', kind: 'wind_turbine', lat: 25.71, lon: 85.16, areaM2: 1, createdAt: '', status: 'proposed' }, data);
  baseCache.data = clone(data);
  return data;
}

export function usePlacementChecks(items: Intervention[], area?: {lat:number;lon:number}) {
  const [evidence, setEvidence] = useState<PlacementEvidence | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadedAreaKey, setLoadedAreaKey] = useState('');
  const [attempt, setAttempt] = useState(0);
  const areaKey = area ? placementAreaKey(area) : '';
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let live = true;
    setEvidence(null); setState('loading'); setLoadedAreaKey('');
    (async () => {
      try {
        const data = await loadBase(controller.signal);
        if (area && !(area.lon > 85.145 && area.lon < 85.185 && area.lat > 25.685 && area.lat < 25.725)) {
          const cached = areaCache.get(areaKey);
          const local = cached ? clone(cached) : await fetchAreaEvidence(area, controller.signal);
          if (!cached) cacheArea(areaKey, local);
          data.sources.push(...local.sources); data.features.push(...local.features);
          checkPlacement({id:"area-schema",name:"Area schema",kind:"wind_turbine",lat:area.lat,lon:area.lon,areaM2:1,createdAt:"",status:"proposed"},data);
        }
        if (live) { setEvidence(data); setState('ready'); setLoadedAreaKey(areaKey); }
      } catch { if (live) { setEvidence(null); setState('failed'); setLoadedAreaKey(''); } }
      finally { clearTimeout(timeout); }
    })();
    return () => { live = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt, area?.lat, area?.lon]);
  const checks = useMemo(() => {
    const result: Record<string, PlacementCheck | null> = {};
    for (const item of items) {
      try { result[item.id] = checkScenePlacement(item, evidence, items); }
      catch { result[item.id] = null; }
    }
    return result;
  }, [items, evidence]);
  return { checks, evidence, state, loadedAreaKey, retry: () => setAttempt(a => a + 1) };
}
