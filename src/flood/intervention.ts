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

// --- Append-only placement edit audit (R06 slice: move with re-admission) ---

export type PlacementEditGeometry = {
  lat: number;
  lon: number;
  areaM2: number;
  footprint?: Intervention["footprint"];
};
/** One confirmed proposal edit. Entries are appended, never rewritten or removed. */
export type PlacementEdit = {
  id: string;
  interventionId: string;
  op: "move";
  at: string;
  before: PlacementEditGeometry;
  after: PlacementEditGeometry;
};

function validGeometryPoint(lat: unknown, lon: unknown): boolean {
  return (
    Number.isFinite(lat) &&
    Math.abs(lat as number) <= 85 &&
    Number.isFinite(lon) &&
    Math.abs(lon as number) <= 180
  );
}

function validFootprint(f: unknown): f is NonNullable<Intervention["footprint"]> {
  if (!f || typeof f !== "object") return false;
  const cand = f as Record<string, unknown>;
  if (cand.type !== "Polygon" || !Array.isArray(cand.coordinates)) return false;
  return cand.coordinates.every(
    (ring) =>
      Array.isArray(ring) &&
      ring.length >= 4 &&
      ring.every(
        (p) => Array.isArray(p) && p.length === 2 && validGeometryPoint(p[1], p[0]),
      ),
  );
}

/** Translate every ring (outer and holes) of a polygon footprint by a lat/lon delta. */
export function translateFootprint(
  footprint: NonNullable<Intervention["footprint"]>,
  dLat: number,
  dLon: number,
): NonNullable<Intervention["footprint"]> {
  return {
    type: "Polygon",
    coordinates: footprint.coordinates.map((ring) =>
      ring.map(([x, y]) => [x + dLon, y + dLat] as [number, number]),
    ),
  };
}

/**
 * Build the moved draft of a proposal for the same id. A supplied footprint is
 * translated by the same delta as the pin so the pin and the checked footprint
 * never drift apart; the assumed square footprint is re-derived downstream from
 * lat/lon/areaM2. Throws on out-of-range coordinates.
 */
export function buildMoveDraft(
  item: Intervention,
  coords: { lat: number; lon: number },
): Intervention {
  if (!validGeometryPoint(coords.lat, coords.lon)) {
    throw new Error("Invalid move coordinates.");
  }
  const dLat = coords.lat - item.lat;
  const dLon = coords.lon - item.lon;
  return {
    ...item,
    lat: coords.lat,
    lon: coords.lon,
    footprint: item.footprint
      ? translateFootprint(item.footprint, dLat, dLon)
      : undefined,
  };
}

/** Move the pin by local metres (east, north). Returns null instead of clamping past the ±85°/±180° limits. */
export function nudgeCoords(
  coords: { lat: number; lon: number },
  eastM: number,
  northM: number,
): { lat: number; lon: number } | null {
  const lat = coords.lat + northM / 111132;
  const cos = Math.cos((coords.lat * Math.PI) / 180);
  const lon = coords.lon + (Math.abs(cos) < 1e-6 ? 0 : eastM / (111320 * cos));
  if (!validGeometryPoint(lat, lon)) return null;
  return { lat, lon };
}

function editGeometry(i: Intervention): PlacementEditGeometry {
  return {
    lat: i.lat,
    lon: i.lon,
    areaM2: i.areaM2,
    ...(i.footprint ? { footprint: i.footprint } : {}),
  };
}

/** Create the audit entry pairing the as-placed geometry with the confirmed geometry. */
export function buildPlacementEdit(
  before: Intervention,
  after: Intervention,
  at: string,
): PlacementEdit {
  return {
    id: `edit-move-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    interventionId: before.id,
    op: "move",
    at,
    before: editGeometry(before),
    after: editGeometry(after),
  };
}

/** Validate one persisted audit entry; used by the load path to tolerate legacy/foreign data. */
export function validatePlacementEdit(e: unknown): e is PlacementEdit {
  if (!e || typeof e !== "object") return false;
  const cand = e as Record<string, unknown>;
  const geometryOk = (g: unknown): g is PlacementEditGeometry => {
    if (!g || typeof g !== "object") return false;
    const r = g as Record<string, unknown>;
    if (!validGeometryPoint(r.lat, r.lon)) return false;
    if (!Number.isFinite(r.areaM2) || (r.areaM2 as number) <= 0) return false;
    if (r.footprint !== undefined && !validFootprint(r.footprint)) return false;
    return true;
  };
  return (
    typeof cand.id === "string" &&
    cand.id.length > 0 &&
    typeof cand.interventionId === "string" &&
    cand.interventionId.length > 0 &&
    cand.op === "move" &&
    typeof cand.at === "string" &&
    !Number.isNaN(Date.parse(cand.at)) &&
    geometryOk(cand.before) &&
    geometryOk(cand.after)
  );
}

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
