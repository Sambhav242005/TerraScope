import { useEffect, useMemo, useState } from 'react';
import { checkPlacement, type PlacementCheck, type PlacementEvidence } from './placementCheck';
import {checkScenePlacement} from './placementAdmission';
import {fetchAreaEvidence} from './areaEvidence';
import type { Intervention } from './intervention';

export function usePlacementChecks(items: Intervention[], area?: {lat:number;lon:number}) {
  const [evidence, setEvidence] = useState<PlacementEvidence | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let live = true;
    setEvidence(null); setState('loading');
    (async () => {
      try {
        const response = await fetch('/data/placement-evidence.json', { signal: controller.signal });
        if (!response.ok) throw Error('Evidence unavailable');
        const data: PlacementEvidence = await response.json();
        // Use the same strict checks for newly loaded data as for restored proposals.
        checkPlacement({ id: 'schema-check', name: 'Schema check', kind: 'wind_turbine', lat: 25.71, lon: 85.16, areaM2: 1, createdAt: '', status: 'proposed' }, data);
        if (area && !(area.lon > 85.145 && area.lon < 85.185 && area.lat > 25.685 && area.lat < 25.725)) {
          const local = await fetchAreaEvidence(area, controller.signal);
          data.sources.push(...local.sources); data.features.push(...local.features);
          checkPlacement({id:"area-schema",name:"Area schema",kind:"wind_turbine",lat:area.lat,lon:area.lon,areaM2:1,createdAt:"",status:"proposed"},data);
        }
        if (live) { setEvidence(data); setState('ready'); }
      } catch { if (live) { setEvidence(null); setState('failed'); } }
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
  return { checks, evidence, state, retry: () => setAttempt(a => a + 1) };
}
