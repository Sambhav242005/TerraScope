// Display-only historical provider maps. Never use these PNGs as depth or drainage inputs.
export const NRSC_BOUNDS = [85.05, 25.6, 85.3, 25.85] as const;
export const NRSC_FLOOD_SNAPSHOTS = [
  { id: "2024-10-01-10", label: "1 Oct 2024 ? 10Hr (zone unverified)", image: "/data/nrsc/bihar-2024-10-01-10.png" },
  { id: "2024-10-02-06", label: "2 Oct 2024 ? 06Hr (zone unverified)", image: "/data/nrsc/bihar-2024-10-02-06.png" },
];
// WMS pixels requested in EPSG:3857; corners match the image source's Mercator plane.
export function nrscImageCoordinates(): [[number, number], [number, number], [number, number], [number, number]] {
  const [west, south, east, north] = NRSC_BOUNDS;
  return [[west, north], [east, north], [east, south], [west, south]];
}
