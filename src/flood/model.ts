export type Asset = {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lon: number;
  source: string;
};
export type Check = {
  id: string;
  assetId: string;
  status: "To verify" | "Evidence recorded" | "Reviewed";
  note: string;
  assignee: string;
  updated: string;
};
export type Rain = {
  hourly: { time: string[]; precipitation: (number | null)[] };
  latitude: number;
  longitude: number;
};
export type Flow = {
  daily: { time: string[]; river_discharge: (number | null)[] };
  latitude: number;
  longitude: number;
};
export type Scenario = { rainScale: number; loss: number; lag: number };
export function parseAssets(raw: {
  elements?: Array<{
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }>;
}): Asset[] {
  return (raw.elements ?? [])
    .flatMap((e) => {
      const lat = e.lat ?? e.center?.lat,
        lon = e.lon ?? e.center?.lon;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
      return [
        {
          id: `${e.type}/${e.id}`,
          name:
            e.tags?.["name:en"] ??
            e.tags?.name ??
            `Mapped ${e.tags?.amenity ?? "resource"}`,
          kind: e.tags?.amenity ?? "resource",
          lat: lat!,
          lon: lon!,
          source: `https://www.openstreetmap.org/${e.type}/${e.id}`,
        },
      ];
    })
    .sort((a, b) =>
      a.kind === "hospital"
        ? -1
        : b.kind === "hospital"
          ? 1
          : a.name.localeCompare(b.name),
    );
}
/** Illustrative linear storage model, in catchment-equivalent mm. Not calibrated to this river. */
export function runoff(rain: (number | null)[], s: Scenario) {
  if (
    !Number.isFinite(s.rainScale) ||
    s.rainScale < 0 ||
    s.rainScale > 3 ||
    !Number.isFinite(s.loss) ||
    s.loss < 0 ||
    s.loss > 1 ||
    !Number.isFinite(s.lag) ||
    s.lag < 1 ||
    s.lag > 48
  )
    throw Error("Invalid scenario");
  let storage = 0;
  return rain.map((r) => {
    if (r === null || !Number.isFinite(r) || r < 0)
      throw Error("Rainfall is missing or invalid");
    const input = r * s.rainScale * (1 - s.loss);
    storage += input;
    const out = storage * (1 - Math.exp(-1 / s.lag));
    storage -= out;
    return { out, storage, input };
  });
}
export function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const r = Math.PI / 180,
    dlat = (b.lat - a.lat) * r,
    dlon = (b.lon - a.lon) * r;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function circle(center: { lat: number; lon: number }, km: number) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        Array.from({ length: 65 }, (_, i) => {
          const t = (i / 64) * Math.PI * 2;
          return [
            center.lon +
              (Math.cos(t) * km) /
                (111.32 * Math.cos((center.lat * Math.PI) / 180)),
            center.lat + (Math.sin(t) * km) / 110.574,
          ];
        }),
      ],
    },
  };
}
export function draftPlan(assets: Asset[], checks: Check[], radius: number) {
  return `TERRASCOPE · PREPAREDNESS WORKSHEET\nDraft for human review · Not an emergency warning\n\nScope: user-defined ${radius.toFixed(1)} km review radius. This is proximity screening, not modeled inundation.\n${assets.length} mapped resources inside the review area. OSM coverage and facility status are unverified.\n\nRESOURCE CHECKS\n${assets
    .map((a) => {
      const c = checks.find((c) => c.assetId === a.id);
      return `• ${a.name} (${a.kind}) — ${c?.status ?? "To verify"}. ${c?.note || "Confirm location, access and current condition."}\n  Source: ${a.source}`;
    })
    .join(
      "\n",
    )}\n\nPREPARATION OPTIONS\n• Confirm actual shelter capacity and accessible facilities with the responsible authority. No shelter has been certified by this tool.\n• Review alternate access with local officials; no route is declared safe.\n• Inventory essential supplies and equipment requiring protection. Prioritize after field review.\n• Check current official IMD/CWC and Bihar guidance before action.\n\nUNRESOLVED\nSurveyed river cross-sections, embankment condition, observed flood extent, official local thresholds and independent model validation are unavailable.\n\nGuidance reference: https://nidm.gov.in/pdf/guidelines/floods.pdf\nOfficial Bihar services: https://fmiscwrdbihar.gov.in/fmis/Default.aspx\n\nGenerated locally from listed records and a fixed checklist; no LLM inference. Reviewer approval is required.`;
}

