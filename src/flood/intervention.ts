export type InterventionKind =
  | "storage_basin"
  | "solar_array"
  | "wind_turbine"
  | "vegetation_buffer";

export type Intervention = {
  id: string;
  name: string;
  kind: InterventionKind;
  lat: number;
  lon: number;
  createdAt: string;
  // Parameters
  areaM2: number;
  capacityM3?: number; // for storage_basin
  depthM?: number;     // for storage_basin
  powerKw?: number;    // for solar / wind
  roughnessManning?: number; // for vegetation
  canopyDensity?: number;    // 0-1 for vegetation
  notes?: string;
  status: "proposed" | "simulated";
  sourceCandidateId?: string; // if adopted from a screened depression
  footprint?: { type: "Polygon"; coordinates: Array<Array<[number, number]>> };
};

export type PlacementTool = "select" | InterventionKind | null;

export const INTERVENTION_DEFAULTS: Record<
  InterventionKind,
  {
    namePrefix: string;
    areaM2: number;
    capacityM3?: number;
    depthM?: number;
    powerKw?: number;
    roughnessManning?: number;
    canopyDensity?: number;
    color: string;
  }
> = {
  storage_basin: {
    namePrefix: "Planned Storage Basin",
    areaM2: 12000,
    capacityM3: 24000,
    depthM: 2.0,
    color: "#21849a",
  },
  solar_array: {
    namePrefix: "Proposed Solar PV Array",
    areaM2: 25000,
    powerKw: 2500, // ~10 m2 / kW typical ground-mount
    color: "#d49a37",
  },
  wind_turbine: {
    namePrefix: "Proposed Wind Turbine",
    areaM2: 2000,
    powerKw: 2000, // 2 MW turbine footprint
    color: "#5c798e",
  },
  vegetation_buffer: {
    namePrefix: "Riparian Vegetation Buffer",
    areaM2: 18000,
    roughnessManning: 0.08, // floodplain woody vegetation Manning's n
    canopyDensity: 0.7,
    color: "#4e8353",
  },
};

export function createIntervention(
  kind: InterventionKind,
  coords: { lat: number; lon: number },
  overrides?: Partial<Intervention>,
): Intervention {
  const defaults = INTERVENTION_DEFAULTS[kind];
  const id = `int-${kind.slice(0, 4)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return {
    id,
    name: overrides?.name ?? `${defaults.namePrefix} #${id.slice(-4)}`,
    kind,
    lat: coords.lat,
    lon: coords.lon,
    createdAt: new Date().toISOString(),
    areaM2: overrides?.areaM2 ?? defaults.areaM2,
    capacityM3: overrides?.capacityM3 ?? defaults.capacityM3,
    depthM: overrides?.depthM ?? defaults.depthM,
    powerKw: overrides?.powerKw ?? defaults.powerKw,
    roughnessManning: overrides?.roughnessManning ?? defaults.roughnessManning,
    canopyDensity: overrides?.canopyDensity ?? defaults.canopyDensity,
    notes: overrides?.notes ?? "Proposed local intervention. Requires environmental and cadastral verification.",
    status: overrides?.status ?? "proposed",
    sourceCandidateId: overrides?.sourceCandidateId,
    footprint: overrides?.footprint,
  };
}

export function validateIntervention(i: unknown): i is Intervention {
  if (!i || typeof i !== "object") return false;
  const cand = i as Record<string, unknown>;
  const validKinds: InterventionKind[] = [
    "storage_basin",
    "solar_array",
    "wind_turbine",
    "vegetation_buffer",
  ];
  return (
    typeof cand.id === "string" &&
    typeof cand.name === "string" &&
    typeof cand.kind === "string" &&
    validKinds.includes(cand.kind as InterventionKind) &&
    Number.isFinite(cand.lat) &&
    Math.abs(cand.lat as number) <= 85 &&
    Number.isFinite(cand.lon) &&
    Math.abs(cand.lon as number) <= 180 &&
    Number.isFinite(cand.areaM2) &&
    (cand.areaM2 as number) > 0
  );
}

export function summarizeInterventions(interventions: Intervention[]) {
  const counts = {
    storage_basin: 0,
    solar_array: 0,
    wind_turbine: 0,
    vegetation_buffer: 0,
  };
  let totalStorageCapacityM3 = 0;
  let totalRenewablePowerKw = 0;
  let totalVegetationAreaM2 = 0;

  for (const item of interventions) {
    counts[item.kind]++;
    if (item.kind === "storage_basin" && item.capacityM3) {
      totalStorageCapacityM3 += item.capacityM3;
    }
    if ((item.kind === "solar_array" || item.kind === "wind_turbine") && item.powerKw) {
      totalRenewablePowerKw += item.powerKw;
    }
    if (item.kind === "vegetation_buffer") {
      totalVegetationAreaM2 += item.areaM2;
    }
  }

  return {
    total: interventions.length,
    counts,
    totalStorageCapacityM3,
    totalRenewablePowerKw,
    totalVegetationAreaM2,
  };
}
