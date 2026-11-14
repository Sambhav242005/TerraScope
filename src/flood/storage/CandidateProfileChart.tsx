import type { CandidateTerrainProfile } from "./candidateProfile";

const W = 300;
const H = 104;
const PAD = { left: 32, right: 10, top: 10, bottom: 20 };

/** A compact, honest visual of one DEM transect. It shows terrain shape and
 * the two elevations that define the candidate; it is not a survey section. */
export function CandidateProfileChart({
  profile,
}: {
  profile: CandidateTerrainProfile;
}) {
  const xs = profile.points.map((p) => p.distanceM);
  const ys = profile.points.map((p) => p.elevationM);
  const xMax = Math.max(1, ...xs);
  const yMin = Math.min(profile.floorElevationM, profile.spillElevationM, ...ys) - 1;
  const yMax = Math.max(profile.floorElevationM, profile.spillElevationM, ...ys) + 1;
  const x = (distanceM: number) =>
    PAD.left + (distanceM / xMax) * (W - PAD.left - PAD.right);
  const y = (elevationM: number) =>
    PAD.top + ((yMax - elevationM) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
  const line = profile.points
    .map((p, i) => `${i ? "L" : "M"}${x(p.distanceM).toFixed(1)} ${y(p.elevationM).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(xMax).toFixed(1)} ${y(yMin).toFixed(1)} L${x(0).toFixed(1)} ${y(yMin).toFixed(1)} Z`;
  const floorX = x(profile.floorDistanceM);
  const spillY = y(profile.spillElevationM);
  const axisLabel = profile.axis === "east-west" ? "east-west" : "north-south";
  const floorAnchor = floorX > W - 70 ? "end" : "start";
  const floorLabelX = floorAnchor === "end" ? floorX - 5 : floorX + 5;

  return (
    <svg
      className="candidate-profile-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`DEM ${axisLabel} transect. Floor ${profile.floorElevationM.toFixed(1)} metres, spill rim ${profile.spillElevationM.toFixed(1)} metres.`}
    >
      <line
        x1={PAD.left}
        x2={W - PAD.right}
        y1={spillY}
        y2={spillY}
        className="profile-spill-line"
      />
      <path d={area} className="profile-area" />
      <path d={line} className="profile-line" />
      <circle cx={floorX} cy={y(profile.floorElevationM)} r="3.2" className="profile-floor" />
      <text x={PAD.left + 2} y={spillY - 4} className="profile-spill-label">
        spill {profile.spillElevationM.toFixed(1)} m
      </text>
      <text
        x={floorLabelX}
        y={y(profile.floorElevationM) - 6}
        textAnchor={floorAnchor}
        className="profile-floor-label"
      >
        floor {profile.floorElevationM.toFixed(1)} m
      </text>
      <text x={0} y={PAD.top + 3} className="profile-axis-label">
        {yMax.toFixed(0)}
      </text>
      <text x={0} y={H - PAD.bottom + 3} className="profile-axis-label">
        {yMin.toFixed(0)}
      </text>
      <text x={PAD.left} y={H - 4} className="profile-axis-label">
        0
      </text>
      <text x={W - PAD.right} y={H - 4} textAnchor="end" className="profile-axis-label">
        {(xMax / 1000).toFixed(2)} km
      </text>
    </svg>
  );
}
