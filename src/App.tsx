import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Map,
  Layers,
  GitCompareArrows,
  ClipboardCheck,
  FileText,
  Mountain,
  CloudRain,
  Waves,
  Building2,
  MapPin,
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  Download,
  Droplets,
  X,
  Info,
  Check,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  RotateCcw,
  ExternalLink,
  Menu,
  Sun,
  Wind,
  Trees,
  Sparkles,
  MessagesSquare,
  GitBranch,
  HelpCircle,
  History,
} from "lucide-react";
import { AreaReviewPanel } from "./flood/areaReview/AreaReviewPanel";
import { emptyGeometry, type AreaEvidenceCollection } from "./flood/areaReview/contracts";
import MapView from "./flood/MapView";
import RiverHistory, { type HistoryFrame } from "./flood/RiverHistory";
import ResultTimeline from "./flood/ResultTimeline";
import EnsoContext from "./flood/EnsoContext";
import Findings from "./flood/Findings";
import DecisionDesk from "./flood/DecisionDesk";
import { loadBasins, subBasinAt, toFeatureCollection, type BasinBundle } from "./flood/hydrobasins";
import { computeCapacityRange, CAPACITY_RANGE_LABEL } from "./flood/storage/capacityRange";
import { loadHistorySeries, type HistoryRow } from "./flood/historySeries";
import {
  DEFAULT_BUDGET,
  cancel as harnessCancel,
  complete as harnessComplete,
  enqueue as harnessEnqueue,
  fail as harnessFail,
  heartbeat as harnessHeartbeat,
  loadJobs,
  recoverStale,
  saveJobs,
  start as harnessStart,
} from "./flood/harness";
import {
  buildOnboardingReport,
  ONBOARDING_LIMITS,
  type OnboardingReport,
} from "./flood/dataOnboarding";
import { CandidateProfileChart } from "./flood/storage/CandidateProfileChart";
import {
  parseAssets,
  distanceKm,
  runoff,
  draftPlan,
  type Asset,
  type Check as FieldCheck,
  type Rain,
  type Flow,
  type Scenario,
} from "./flood/model";
import {
  DEFAULT_SCREENING_CONFIG,
  candidateMapFeatures,
  configHash,
  fetchOsmWaterJson,
  fetchTerrariumTileRGBA,
  loadStoredWater,
  loadStorageRun,
  runStorageScreening,
  saveStorageRun,
  waterMapFeatures,
  type ScreeningRun,
  type StoredCandidate,
  type StoredWater,
} from "./flood/storage/storageSearch";
import {
  type Intervention,
  type PlacementEdit,
  type PlacementTool,
  buildMoveDraft,
  buildPlacementEdit,
  nudgeCoords,
  createIntervention,
  validateIntervention,
  validatePlacementEdit,
  summarizeInterventions,
} from "./flood/intervention";
import PlaceSearch, {type MapTarget} from "./flood/PlaceSearch";
import {assessPlacement, type PlacementAttempt} from "./flood/placementAdmission";
import {summarizeAttempt} from "./flood/placementFeedback";
import {placementAreaKey} from "./flood/areaEvidence";
import type {PlacementEvidence} from "./flood/placementCheck";
import PlacementReview from "./flood/PlacementReview";
import { usePlacementChecks } from "./flood/usePlacementChecks";
import "./style.css";
import "./landscape.css";
type WorkspacePanel =
  | null
  | "Environment"
  | "River history"
  | "Explore"
  | "Compare"
  | "Field checks"
  | "Response plan";

/** Per-dataset copy for the Data & sources cards. Unknown ids fail closed to a generic card rather than a wrong label. */
const SOURCE_CARDS: Record<
  string,
  { title: string; blurb: string; license: string }
> = {
  rainfall: {
    title: "ERA5 rainfall",
    blurb:
      "Hourly reanalysis at a sample grid cell near 26.5°N, 84.25°E; not catchment-average or gauge rainfall. Approximately 0.25° resolution.",
    license: "Open-Meteo / Copernicus · CC BY 4.0 data",
  },
  "rain-history": {
    title: "ERA5 rainfall",
    blurb:
      "Daily reanalysis totals over ten years at a sample grid cell near 26.5°N, 84.25°E; not catchment-average or gauge rainfall.",
    license: "Open-Meteo / Copernicus · CC BY 4.0 data",
  },
  discharge: {
    title: "GloFAS discharge",
    blurb:
      "Historical modeled discharge at returned grid cell 25.775°N, 85.125°E. River-cell assignment is not independently verified; not a gauge observation or an issue-time forecast.",
    license: "Open-Meteo / Copernicus · CC BY 4.0 data",
  },
  "flow-history": {
    title: "GloFAS discharge",
    blurb:
      "Daily modeled discharge over ten years at returned grid cell 25.775°N, 85.125°E. River-cell assignment is not independently verified; not a gauge observation or an issue-time forecast.",
    license: "Open-Meteo / Copernicus · CC BY 4.0 data",
  },
  assets: {
    title: "OpenStreetMap resources",
    blurb:
      "Mapped facility records, not a complete or field-verified inventory. Current mapping may differ from 2024. Bounded extract: 25.68–25.73°N, 85.14–85.19°E. Outside this area, inventory is unavailable. Way positions are mean vertices, not verified entrances.",
    license: "ODbL · OpenStreetMap contributors",
  },
  "scene-geometry": {
    title: "OpenStreetMap scene geometry",
    blurb:
      "Buildings, roads, woods and water inside the bounded extract, shaded with illustrative heights (6 m per building). Footprints are mean-geometry; heights are decorative; not for engineering, not structures or hazards.",
    license: "ODbL · OpenStreetMap contributors",
  },
  "hydrobasins-as12-sonpur": {
    title: "HydroBASINS v1c sub-basins",
    blurb:
      "Asia level-12 sub-basin outlines clipped to the context window, 15 arc-second topography-derived. Not surveyed; upstream areas are measured at sub-basin outlets, not at any candidate; no flow routing modeled. 71 sub-basins, DEM-derived, never engineering catchments.",
    license: "HydroSHEDS license · Lehner & Grill (2013)",
  },
  "renewable-resource-gandak": {
    title: "Open-Meteo ERA5 solar/wind baseline",
    blurb:
      "Daily GHI and 10 m / 100 m wind at the Gandak-corridor sample cell, 2015–2024 reanalysis (0.25°), not a site measurement. No yield, capacity factor, dust or soiling. Screening aid only; provenance pinned in the artifact and the manifest.",
    license: "Open-Meteo / Copernicus · CC BY 4.0 data; non-commercial terms",
  },
};

type Saved = {
  version: 1;
  area: { lat: number; lon: number };
  radius: number;
  checks: FieldCheck[];
  scenario: Scenario;
  custom: Asset[];
  interventions?: Intervention[];
  placementEdits?: PlacementEdit[];
  mapTarget?: MapTarget;
};
const initial: Saved = {
  version: 1,
  area: { lat: 25.71, lon: 85.16 },
  radius: 4,
  checks: [],
  scenario: { rainScale: 1, loss: 0.35, lag: 8 },
  custom: [],
  interventions: [],
  placementEdits: [],
};
function load(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem("terrascope-v1") ?? "null");
    if (
      v?.version !== 1 ||
      !Number.isFinite(v.area?.lat) ||
      Math.abs(v.area.lat) > 85 ||
      !Number.isFinite(v.area?.lon) ||
      Math.abs(v.area.lon) > 180 ||
      !Number.isFinite(v.radius) ||
      v.radius < 0.5 ||
      v.radius > 10 ||
      !Array.isArray(v.checks) ||
      !Array.isArray(v.custom)
    )
      return initial;
    runoff([0], v.scenario);
    return {
      ...v,
      mapTarget: typeof v.mapTarget?.label === "string" && v.mapTarget.lat === v.area.lat && v.mapTarget.lon === v.area.lon ? v.mapTarget : undefined,
      checks: v.checks.filter(
        (c: FieldCheck) =>
          typeof c.id === "string" &&
          typeof c.assetId === "string" &&
          typeof c.note === "string" &&
          typeof c.assignee === "string" &&
          ["To verify", "Evidence recorded", "Reviewed"].includes(c.status),
      ),
      custom: v.custom.filter(
        (a: Asset) =>
          typeof a.id === "string" &&
          typeof a.name === "string" &&
          Number.isFinite(a.lat) &&
          Number.isFinite(a.lon) &&
          Math.abs(a.lat) <= 85 &&
          Math.abs(a.lon) <= 180,
      ),
      interventions: Array.isArray(v.interventions)
        ? v.interventions.filter(validateIntervention)
        : [],
      placementEdits: Array.isArray(v.placementEdits)
        ? v.placementEdits.filter(validatePlacementEdit)
        : [],
    };
  } catch {
    return initial;
  }
}
function Spark({
  values,
  color = "#21849a",
  bars = false,
  comparison,
}: {
  values: (number | null)[];
  color?: string;
  bars?: boolean;
  comparison?: number[];
}) {
  const max = Math.max(
    1,
    ...values.filter((n): n is number => n !== null),
    ...(comparison ?? []),
  );
  const path = (v: (number | null)[]) =>
    v
      .map((n, i) =>
        n === null
          ? ""
          : `${i === 0 || v[i - 1] === null ? "M" : "L"}${(i / Math.max(1, v.length - 1)) * 400},${73 - (n / max) * 62}`,
      )
      .join(" ");
  return (
    <svg
      className="spark"
      viewBox="0 0 400 80"
      role="img"
      aria-label={
        bars
          ? "Rainfall time series"
          : "Time series; values also available in data table"
      }
    >
      <path d="M0 74H400" stroke="#dbe2dc" />
      {bars ? (
        values.map((n, i) => (
          <rect
            key={i}
            x={(i / values.length) * 400}
            y={73 - ((n ?? 0) / max) * 62}
            width={Math.max(1, 400 / values.length - 2)}
            height={((n ?? 0) / max) * 62}
            rx="1"
            fill={color}
          />
        ))
      ) : (
        <>
          <path
            d={
              values.some((v) => v !== null)
                ? `${path(values)} L400 74 L0 74 Z`
                : ""
            }
            fill={color}
            opacity=".08"
          />
          <path d={path(values)} stroke={color} strokeWidth="2.5" fill="none" />
          {comparison && (
            <path
              d={path(comparison)}
              stroke="#a98045"
              strokeWidth="2"
              strokeDasharray="5 3"
              fill="none"
            />
          )}
        </>
      )}
    </svg>
  );
}
const date = (s: string) =>
  new Date(s + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
const fmt = (n: number | null | undefined) =>
  n == null
    ? "Unavailable"
    : n.toLocaleString("en-GB", { maximumFractionDigits: 1 });
const waterNote = (w: StoredCandidate["waterEvidence"]) =>
  w.status === "overlaps"
    ? `Overlaps mapped water (${w.features.length})`
    : w.status === "none-mapped"
      ? "No mapped water inside"
      : "Water evidence unavailable";
export default function App() {
  const [saved, setSaved] = useState(load),
    [panel, setPanel] = useState<WorkspacePanel>(null),
    [rain, setRain] = useState<Rain | null>(null),
    [flow, setFlow] = useState<Flow | null>(null),
    [osm, setOsm] = useState<Asset[]>([]),
    [manifest, setManifest] = useState<
      Array<{
        id: string;
        url: string;
        sha256?: string;
        retrieved: string;
        status: string;
        units?: string;
        resolution?: string;
        timezone?: string;
        model?: string;
        uncertainty?: string;
      }>
    >([]),
    [dataErrors, setDataErrors] = useState<string[]>([]),
    [day, setDay] = useState(4),
    [waterOn, setWaterOn] = useState(false),
    [waterLevel, setWaterLevel] = useState(50),
    [playing, setPlaying] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [sources, setSources] = useState(false),
    [showTable, setShowTable] = useState(false),
    [showResults, setShowResults] = useState(false),
    [showEnso, setShowEnso] = useState(false),
    [historyRows, setHistoryRows] = useState<HistoryRow[] | null>(null),
    [showGuide, setShowGuide] = useState(false),
    [showAssets, setShowAssets] = useState(true),
    [terrain, setTerrain] = useState(true),
    [layers, setLayers] = useState(false),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState(() => {
      try {
        return localStorage.getItem("terrascope-draft") ?? "";
      } catch {
        return "";
      }
    }),
    [ran, setRan] = useState(false),
    [notice, setNotice] = useState(""),
    [adding, setAdding] = useState(false),
    [newName, setNewName] = useState(""),
    [note, setNote] = useState(""),
    [assignee, setAssignee] = useState(""),
    [activePlacementTool, setActivePlacementTool] = useState<PlacementTool>("select"),
    [selectedIntervention, setSelectedIntervention] = useState<string | null>(null),
    [showInterventions, setShowInterventions] = useState(true),
    [coordinatePlacement, setCoordinatePlacement] = useState(false),
    [placementLat, setPlacementLat] = useState("25.71"),
    [placementLon, setPlacementLon] = useState("85.16");
  const [areaGeometry, setAreaGeometry] = useState<AreaEvidenceCollection>(emptyGeometry);
  const [historyFrame, setHistoryFrame] = useState<HistoryFrame | null>(null);
  const [historyMode, setHistoryMode] = useState(false);
  const panelTrigger = useRef<HTMLButtonElement | null>(null);
  const closePanel = () => { setPanel(null); panelTrigger.current?.focus(); };
  const openPanel = (next: WorkspacePanel, trigger?: HTMLButtonElement) => {
    if (trigger) panelTrigger.current = trigger;
    setPanel(current => current === next ? null : next);
    if (next === "River history") { setHistoryMode(true); setPlaying(false); }
  };
  const proposalItems = useMemo(() => saved.interventions ?? [], [saved.interventions]);
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(()=>saved.mapTarget??null);
  const [placementError, setPlacementError] = useState("");
  const [placementAttempt, setPlacementAttempt] = useState<PlacementAttempt | null>(null);
  const [cameraPoint, setCameraPoint] = useState<{lat:number;lon:number} | null>(null);
  const pendingPlacement = useRef<{item: Intervention; areaKey: string; autoAreaMoved: boolean; target: {lat:number;lon:number}; success: string} | null>(null);
  const placementReview = usePlacementChecks(proposalItems, saved.area);
  function chooseArea(target:MapTarget) { storageAbort.current?.abort();lastStorageRun.current=null;setStorageRun(null);setStorageWater(null);setStorageBusy(false);setPlacementLat(String(target.lat));setPlacementLon(String(target.lon));setMapTarget(target);update({area:{lat:target.lat,lon:target.lon},mapTarget:target});setActivePlacementTool('select');setSelectedIntervention(null);setSelectedStorage(null);setPlacementError('');setPlacementAttempt(null);setCameraPoint(null);pendingPlacement.current=null; }
  const dialogRef = useRef<HTMLDivElement>(null);
  const [storageRun, setStorageRun] = useState<ScreeningRun | null>(null),
    [storageWater, setStorageWater] = useState<StoredWater | null>(null),
    [storageBusy, setStorageBusy] = useState(false),
    [storagePhase, setStoragePhase] = useState(""),
    [showCandidates, setShowCandidates] = useState(true),
    [showWaterLayer, setShowWaterLayer] = useState(true),
    [showDecisionDesk, setShowDecisionDesk] = useState(true),
    [showBasins, setShowBasins] = useState(false),
    [basins, setBasins] = useState<BasinBundle | null>(null),
    [selectedStorage, setSelectedStorage] = useState<string | null>(null);
  const closeDecisionDesk = useCallback(() => setShowDecisionDesk(false), []);
  const storageAbort = useRef<AbortController | null>(null),
    lastStorageRun = useRef<{ hash: string; lat: number; lon: number } | null>(
      null,
    ),
    storageTiles = useRef<Map<string, Uint8ClampedArray>>(
      new globalThis.Map(),
    );
  // Durable harness (R17): deterministic storage screening runs under a
  // persisted job record with budgets, heartbeat and a separate output verifier.
  const harnessState = useRef(
    typeof window !== "undefined"
      ? loadJobs(window.localStorage, "terrascope.harness.v1")
      : { jobs: [], events: [] },
  );
  const harnessJobId = useRef<string | null>(null);
  const [harnessLine, setHarnessLine] = useState("");
  const persistHarness = () => {
    if (typeof window === "undefined") return;
    saveJobs(window.localStorage, "terrascope.harness.v1", harnessState.current);
  };
  useEffect(() => {
    // Restart recovery: stale running jobs from a previous session are requeued or failed.
    harnessState.current = recoverStale(harnessState.current, new Date(), 120_000);
    persistHarness();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("terrascope-draft", draft);
    } catch {}
  }, [draft]);
  const update = (p: Partial<Saved>) => setSaved((s) => ({ ...s, ...p }));
  useEffect(() => {
    document.title = "TerraScope · Flood preparedness";
    let live = true;
    const get = async (name: string, fn: (d: any) => void) => {
      try {
        const r = await fetch(`/data/${name}.json`);
        if (!r.ok) throw Error();
        const d = await r.json();
        if (live) fn(d);
      } catch {
        if (live) setDataErrors((e) => [...new Set([...e, name])]);
      }
    };
    get("rainfall", (d) => {
      if (
        !Array.isArray(d.hourly?.precipitation) ||
        d.hourly.precipitation.length !== 216 ||
        d.hourly.precipitation.some(
          (x: unknown) =>
            x !== null &&
            (typeof x !== "number" || !Number.isFinite(x) || x < 0),
        )
      )
        throw Error();
      setRain(d);
    });
    get("discharge", (d) => {
      if (
        !Array.isArray(d.daily?.river_discharge) ||
        d.daily.river_discharge.length !== 9 ||
        d.daily.river_discharge.some(
          (x: unknown) =>
            x !== null &&
            (typeof x !== "number" || !Number.isFinite(x) || x < 0),
        )
      )
        throw Error();
      setFlow(d);
    });
    get("assets", (d) =>
      setOsm(
        parseAssets(d).filter((a) =>
          ["school", "hospital", "clinic", "police", "fire_station"].includes(
            a.kind,
          ),
        ),
      ),
    );
    get("manifest", setManifest);
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("terrascope-v1", JSON.stringify(saved));
    } catch {
      setNotice(
        "Storage unavailable. Export your workspace to keep this session.",
      );
    }
  }, [saved]);
  // Restore one previous screening session; water features stay where
  // persistence kept them (`storedWater`) so saved workspaces stay bounded.
  useEffect(() => {
    const run = loadStorageRun();
    if (!run) return;
    setStorageRun(run);
    lastStorageRun.current = {
      hash: run.configHash,
      lat: run.config.center.lat,
      lon: run.config.center.lon,
    };
    const water = loadStoredWater();
    if (water?.features.length) setStorageWater(water);
  }, []);
  function startStorageRun(next: { lat: number; lon: number }) {
    storageAbort.current?.abort();
    const controller = new AbortController();
    storageAbort.current = controller;
    setSelectedStorage(null);
    setStorageBusy(true);
    setStoragePhase("Terrain tiles…");
    if (storageTiles.current.size > 120) storageTiles.current.clear();
    // Enqueue the screen under the harness. Idempotent for an identical input:
    // an already-open job (queued or running) is reused, never duplicated.
    harnessJobId.current = null;
    try {
      const input = {
        lat: next.lat,
        lon: next.lon,
        configHash: configHash({ center: next, ...DEFAULT_SCREENING_CONFIG }),
      };
      const res = harnessEnqueue(harnessState.current, "storage-screening", input, DEFAULT_BUDGET, new Date());
      harnessState.current = res.state;
      const job = res.job;
      if (job.status === "queued") {
        harnessState.current = harnessStart(harnessState.current, job.id, new Date());
      }
      harnessJobId.current = job.id;
      persistHarness();
    } catch (err) {
      // A harness rejection never blocks the run itself.
      console.error("Harness could not track this run", err);
    }
    runStorageScreening(
      { center: next, ...DEFAULT_SCREENING_CONFIG },
      {
        signal: controller.signal,
        fetchTile: fetchTerrariumTileRGBA,
        fetchWaterJson: fetchOsmWaterJson,
        tilesCache: storageTiles.current,
        onProgress: (p) => {
          setStoragePhase(
            p.phase === "terrain"
              ? `Terrain tiles ${p.tilesDone}/${p.tilesTotal}…`
              : p.phase === "analysing"
                ? "Screening depressions…"
                : "Fetching mapped water…",
          );
          if (harnessJobId.current) {
            harnessState.current = harnessHeartbeat(
              harnessState.current,
              harnessJobId.current,
              { tilesFetched: p.tilesDone, tilesTotal: p.tilesTotal },
              new Date(),
            );
            persistHarness();
          }
        },
      },
    )
      .then((run) => {
        if (controller.signal.aborted) return;
        if (harnessJobId.current) {
          const result = harnessComplete(
            harnessState.current,
            harnessJobId.current,
            {
              status: run.status,
              runId: run.id,
              configHash: run.configHash,
              method: run.provenance.method,
              tilesFetched: run.tilesFetched,
              tilesTotal: run.tilesTotal,
              candidateCountTotal: run.candidateCountTotal,
            },
            new Date(),
          );
          harnessState.current = result.state;
          persistHarness();
          setHarnessLine(
            result.ok
              ? `Harness ${harnessJobId.current.slice(0, 18)} · verified`
              : `Harness verification failed: ${result.errors.join("; ")}`,
          );
        }
        setStorageRun(run);
        setStorageWater(run.water);
        setStorageBusy(false);
        setStoragePhase("");
        lastStorageRun.current = {
          hash: run.configHash,
          lat: run.config.center.lat,
          lon: run.config.center.lon,
        };
        if (!saveStorageRun(run))
          setNotice(
            "Storage analysis could not be saved on this device. Results will be lost when the panel closes.",
          );
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (harnessJobId.current) {
          const message = String((err as Error).message ?? err);
          harnessState.current = harnessFail(
            harnessState.current,
            harnessJobId.current,
            message,
            new Date(),
          );
          persistHarness();
          setHarnessLine(`Harness job failed: ${message}`);
        }
        setStorageBusy(false);
        setStoragePhase("");
        setNotice(
          `Storage screening could not complete: ${String((err as Error).message ?? err)}`,
        );
      });
  }
  function cancelStorage() {
    storageAbort.current?.abort();
    if (harnessJobId.current) {
      harnessState.current = harnessCancel(harnessState.current, harnessJobId.current, new Date());
      persistHarness();
      setHarnessLine("Harness job cancelled");
    }
    setStorageBusy(false);
    setStoragePhase("");
    setNotice("Storage screening cancelled. No results were produced.");
  }
  // Screening starts automatically once the review centre settles (R15/R18);
  // small moves (<~500 m or below config rounding) deliberately keep the
  // previous run instead of re-fetching tiles for an identical analysis.
  useEffect(() => {
    const { lat, lon } = saved.area;
    if (
      !Number.isFinite(lat) ||
      Math.abs(lat) > 85 ||
      !Number.isFinite(lon) ||
      Math.abs(lon) > 180
    )
      return;
    const last = lastStorageRun.current;
    if (
      last &&
      (distanceKm({ lat: last.lat, lon: last.lon }, { lat, lon }) * 1000 < 500 ||
        configHash({ center: { lat, lon }, ...DEFAULT_SCREENING_CONFIG }) ===
          last.hash)
    )
      return;
    const timer = setTimeout(() => startStorageRun({ lat, lon }), 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.area.lat, saved.area.lon]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setDay((d) => {
          if (d >= 8) {
            setPlaying(false);
            return 8;
          }
          return d + 1;
        }),
      1200,
    );
    return () => clearInterval(timer);
  }, [playing]);
  useEffect(() => {
    let live = true;
    loadHistorySeries().then(
      (rows) => live && setHistoryRows(rows),
      () => live && setHistoryRows(null),
    );
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    loadBasins().then(
      (bundle) => live && setBasins(bundle),
      () => live && setBasins(null),
    );
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!sources && !showTable && !showGuide && !showEnso) return;
    const old = document.activeElement as HTMLElement;
    const dialog = dialogRef.current;
    const items = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button,a,input,[tabindex="0"]',
        ) ?? [],
      );
    items()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSources(false);
        setShowTable(false);
        setShowGuide(false);
        setShowEnso(false);
      }
      if (e.key === "Tab") {
        const a = items();
        if (e.shiftKey && document.activeElement === a[0]) {
          e.preventDefault();
          a.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === a.at(-1)) {
          e.preventDefault();
          a[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      old?.focus();
    };
  }, [sources, showTable, showGuide, showEnso]);
  const onboarding: OnboardingReport | null = useMemo(
    () => (manifest.length ? buildOnboardingReport(manifest, new Date()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manifest],
  );
  const onboardingLimits = ONBOARDING_LIMITS;
  const assets = useMemo(() => [...osm, ...saved.custom], [osm, saved.custom]);
  const nearby = useMemo(
    () => assets.filter((a) => distanceKm(a, saved.area) <= saved.radius),
    [assets, saved.area, saved.radius],
  );
  const visibleAssets = nearby.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()),
  );
  const active = assets.find((a) => a.id === selected);
  const days =
    flow?.daily.time ??
    Array.from({ length: 9 }, (_, i) =>
      new Date(Date.UTC(2024, 8, 25 + i)).toISOString().slice(0, 10),
    );
  const dailyRain = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const slice = rain?.hourly.precipitation.slice(i * 24, (i + 1) * 24);
        return !slice || slice.some((n) => n === null)
          ? null
          : slice.reduce<number>((a, b) => a + (b ?? 0), 0);
      }),
    [rain],
  );
  const flowMax = useMemo(
    () =>
      Math.max(
        1,
        ...(flow?.daily.river_discharge ?? []).filter(
          (n): n is number => n != null,
        ),
      ),
    [flow],
  );
  const calc = useMemo(() => {
    if (!rain) return null;
    try {
      return {
        base: runoff(rain.hourly.precipitation, {
          rainScale: saved.scenario.rainScale,
          loss: 0.35,
          lag: 8,
        }),
        proposed: runoff(rain.hourly.precipitation, saved.scenario),
      };
    } catch {
      return null;
    }
  }, [rain, saved.scenario]);
  const storageMapData = useMemo(
    () =>
      storageRun
        ? {
            candidates: candidateMapFeatures(
              storageRun.status === "succeeded" ? storageRun.candidates : [],
            ),
            water: waterMapFeatures(storageWater?.features ?? null),
          }
        : null,
    [storageRun, storageWater],
  );
  const storageCandidates = useMemo(
    () =>
      storageRun
        ? [...storageRun.candidates].sort(
            (a, b) => b.geometricCapacityM3 - a.geometricCapacityM3,
          )
        : [],
    [storageRun],
  );
  const inspected =
    storageRun?.candidates.find((c) => c.id === selectedStorage) ?? null;
  const basinFC = useMemo(() => (basins ? toFeatureCollection(basins) : null), [basins]);
  const basinForInspected = useMemo(() => (inspected ? subBasinAt(basins, inspected.centroid[0], inspected.centroid[1]) : null), [basins, inspected]);
  const capacityRangeForInspected = useMemo(
    () =>
      inspected
        ? computeCapacityRange({
            spillElevationM: inspected.spillElevationM,
            minimumElevationM: inspected.minimumElevationM,
            geometricCapacityM3: inspected.geometricCapacityM3,
            footprintAreaM2: inspected.footprintAreaM2,
            maximumDepthToSpillM: inspected.maximumDepthToSpillM,
          })
        : null,
    [inspected],
  );
  const interventionSummary = useMemo(
    () => summarizeInterventions(saved.interventions ?? []),
    [saved.interventions],
  );
  const inspectedIntervention = useMemo(
    () =>
      (saved.interventions ?? []).find((i) => i.id === selectedIntervention) ??
      null,
    [saved.interventions, selectedIntervention],
  );



  function dismissPlacementAttempt() {
    pendingPlacement.current = null;
    setPlacementAttempt(null);
    setPlacementError("");
    setCameraPoint(null);
  }

  function retryPlacementAttempt() {
    const attempt = placementAttempt;
    if (!attempt) { placementReview.retry(); return; }
    pendingPlacement.current = {
      item: attempt.item,
      areaKey: placementAreaKey(attempt.target),
      autoAreaMoved: true,
      target: attempt.target,
      success: attempt.success,
    };
    setPlacementError("");
    setPlacementAttempt({ ...attempt, state: "checking", block: null, check: assessPlacement(attempt.item, null, proposalItems).check });
    focusPlacement(attempt.target);
    placementReview.retry();
  }

  function focusPlacement(coords: { lat: number; lon: number }) {
    // Camera-only: a blocked spot must be visible without relocating the
    // reviewed area or re-fetching its evidence.
    setCameraPoint({ lat: coords.lat, lon: coords.lon });
  }

  function moveAreaForCheck(coords: { lat: number; lon: number }) {
    const target: MapTarget = {
      ...coords,
      label: `Placement check at ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`,
    };
    setPlacementLat(String(coords.lat));
    setPlacementLon(String(coords.lon));
    setMapTarget(target);
    update({ area: { lat: coords.lat, lon: coords.lon }, mapTarget: target });
  }

  function commitPlacement(item: Intervention, success: string) {
    pendingPlacement.current = null;
    setPlacementError("");
    setPlacementAttempt(null);
    setCameraPoint(null);
    // Append against the latest saved state, not the render that started the check.
    setSaved((s) => ({ ...s, interventions: [...(s.interventions ?? []), item] }));
    setSelectedIntervention(item.id);
    setSelected(null);
    setSelectedStorage(null);
    setNotice(success);
  }

  function submitPlacement(item: Intervention, coords: { lat: number; lon: number }, success: string) {
    pendingPlacement.current = null;
    setPlacementAttempt(null);
    setPlacementError("");
    setNotice("");
    setSelectedIntervention(null);
    const currentKey = placementAreaKey(saved.area);
    const freshEvidence = placementReview.state === "ready" && placementReview.loadedAreaKey === currentKey;
    if (freshEvidence) {
      const admission = assessPlacement(item, placementReview.evidence, proposalItems);
      if (!admission.block) { commitPlacement(item, success); return; }
      if (!admission.needsAreaEvidence) {
        // A real mapped/proposal conflict: keep the spot visible on the map,
        // but do not save it. The next click clears this attempt and checks afresh.
        setPlacementAttempt({ item, check: admission.check, block: admission.block, state: "blocked", target: coords, success });
        setPlacementError(admission.block);
        focusPlacement(coords);
        return;
      }
      // The click is outside the loaded coverage: fetch this spot's evidence
      // automatically, then run the check once more. No repeated "select area" loop.
      pendingPlacement.current = { item, areaKey: placementAreaKey(coords), autoAreaMoved: true, target: coords, success };
      setPlacementAttempt({ item, check: admission.check, block: admission.block, state: "checking", target: coords, success });
      focusPlacement(coords);
      moveAreaForCheck(coords);
      // If the click is already the loaded area (large footprint outside its
      // box), moving does not trigger a reload; force the one permitted recheck.
      if (placementAreaKey(coords) === currentKey) placementReview.retry();
      return;
    }
    // Evidence is still loading (or the area just moved). Queue the new click
    // against its own area rather than the previous one, so a new spot is
    // genuinely re-checked and the old pending problem cannot repeat.
    pendingPlacement.current = { item, areaKey: placementAreaKey(coords), autoAreaMoved: true, target: coords, success };
    setPlacementAttempt({ item, check: assessPlacement(item, null, proposalItems).check, block: null, state: "checking", target: coords, success });
    focusPlacement(coords);
    moveAreaForCheck(coords);
    if (placementReview.state === "failed") placementReview.retry();
  }

  useEffect(() => {
    const pending = pendingPlacement.current;
    if (!pending) return;
    if (placementReview.state === "loading") return;
    if (placementReview.state === "failed") {
      pendingPlacement.current = null;
      const block = "Placement blocked: area map checks failed. Retry the area checks or choose another spot.";
      setPlacementAttempt({ item: pending.item, check: assessPlacement(pending.item, null, proposalItems).check, block, state: "failed", target: pending.target, success: pending.success });
      setPlacementError(block);
      focusPlacement(pending.target);
      return;
    }
    if (placementReview.loadedAreaKey !== pending.areaKey) return;
    const admission = assessPlacement(pending.item, placementReview.evidence, proposalItems);
    if (!admission.block) {
      commitPlacement(pending.item, pending.success);
      return;
    }
    if (admission.needsAreaEvidence && !pending.autoAreaMoved) {
      // The first evidence bundle did not cover the footprint. Move once to the
      // clicked spot, then re-check; a second failure is reported, not retried forever.
      pending.autoAreaMoved = true;
      pending.areaKey = placementAreaKey(pending.target);
      setPlacementAttempt({ item: pending.item, check: admission.check, block: admission.block, state: "checking", target: pending.target, success: pending.success });
      focusPlacement(pending.target);
      if (pending.areaKey === placementReview.loadedAreaKey) placementReview.retry();
      moveAreaForCheck(pending.target);
      return;
    }
    pendingPlacement.current = null;
    setPlacementAttempt({ item: pending.item, check: admission.check, block: admission.block, state: "blocked", target: pending.target, success: pending.success });
    setPlacementError(admission.block);
    focusPlacement(pending.target);
  }, [placementReview.state, placementReview.loadedAreaKey, placementReview.evidence, proposalItems]);

  function handlePlaceAt(coords: { lat: number; lon: number }) {
    if (!activePlacementTool || activePlacementTool === "select") return;
    const item = createIntervention(activePlacementTool, coords);
    submitPlacement(
      item,
      coords,
      `Placed ${item.name} at ${coords.lat.toFixed(4)}°N, ${coords.lon.toFixed(4)}°E.`,
    );
  }

  function handleAdoptCandidate(candidate: StoredCandidate) {
    const item = createIntervention(
      "storage_basin",
      { lat: candidate.centroid[1], lon: candidate.centroid[0] },
      {
        name: `Planned Basin (Depression #${candidate.id})`,
        capacityM3: candidate.geometricCapacityM3,
        areaM2: candidate.footprintAreaM2,
        depthM: candidate.maximumDepthToSpillM,
        sourceCandidateId: candidate.id,
        footprint: { type: "Polygon", coordinates: [candidate.polygon.outer, ...candidate.polygon.holes] },
        notes: `Adopted from Priority-Flood candidate #${candidate.id}. Spill elevation: ${candidate.spillElevationM.toFixed(1)} m. Footprint: ${candidate.footprintAreaM2.toLocaleString()} m². Available storage requires bathymetric verification.`,
      },
    );
    submitPlacement(
      item,
      { lat: candidate.centroid[1], lon: candidate.centroid[0] },
      `Adopted candidate #${candidate.id} as a planned storage basin (${item.capacityM3?.toLocaleString()} m³ geometric capacity).`,
    );
  }

  function handleDeleteIntervention(id: string) {
    const updated = (saved.interventions ?? []).filter((i) => i.id !== id);
    update({ interventions: updated });
    if (selectedIntervention === id) setSelectedIntervention(null);
    setNotice("Intervention removed.");
  }

  function handleUndoIntervention() {
    const current = saved.interventions ?? [];
    if (!current.length) return;
    const updated = current.slice(0, -1);
    update({ interventions: updated });
    setSelectedIntervention(null);
    setNotice("Undid last intervention placement.");
  }

  // Move a saved proposal to a new spot. The moved draft is re-admitted against
  // the loaded evidence exactly like a fresh placement; only a passing check
  // re-persists anything. The camera and the reviewed area are never forced to
  // change for an ordinary edit. A blocked or failed drop never saves and the
  // map marker snaps back to the as-saved position (MapView owns that snap).
  function handleMoveIntervention(id: string, coords: { lat: number; lon: number }) {
    const current = saved.interventions ?? [];
    const item = current.find((i) => i.id === id);
    if (!item) return;
    let draft: Intervention;
    try {
      draft = buildMoveDraft(item, coords);
    } catch {
      setPlacementError(
        "Move not applied: the dropped point is outside the supported coordinate limits (±85° latitude, ±180° longitude). Nothing was changed.",
      );
      return;
    }
    if (draft.lat === item.lat && draft.lon === item.lon) {
      setNotice(`${item.name} is already at this position. Nothing was changed.`);
      return;
    }
    const currentKey = placementAreaKey(saved.area);
    const freshEvidence =
      placementReview.state === "ready" && placementReview.loadedAreaKey === currentKey;
    if (!freshEvidence) {
      const block =
        placementReview.state === "failed"
          ? "Move not applied: area map checks failed. Retry the area checks, then move the proposal again. Nothing was changed."
          : "Move not applied: area map checks are not ready for the reviewed area. Wait for them to load, then move the proposal again. Nothing was changed.";
      setPlacementError(block);
      setPlacementAttempt({
        item: draft,
        check: assessPlacement(draft, null, proposalItems).check,
        block,
        state: "blocked",
        target: coords,
        success: "",
      });
      return;
    }
    // proposalItems includes the moved item itself; checkScenePlacement skips
    // self-overlap, so admission sees every other proposal but not this one.
    const admission = assessPlacement(draft, placementReview.evidence, proposalItems);
    if (!admission.block) {
      const edit = buildPlacementEdit(item, draft, new Date().toISOString());
      // Append against the latest saved state, not the render that started the check.
      setSaved((s) => ({
        ...s,
        interventions: (s.interventions ?? []).map((i) => (i.id === id ? draft : i)),
        placementEdits: [...(s.placementEdits ?? []), edit],
      }));
      setSelectedIntervention(id);
      setPlacementAttempt(null);
      setPlacementError("");
      setNotice(
        `Moved ${draft.name} to ${coords.lat.toFixed(4)}°N, ${coords.lon.toFixed(4)}°E. Admission re-checked against loaded map evidence and recorded in the edit audit; effects not calculated.`,
      );
      return;
    }
    const block = admission.needsAreaEvidence
      ? "Move not applied: the dropped point is outside the loaded building/road/water coverage. Select this area (place search) and wait for its checks, then move the proposal again. Nothing was changed."
      : admission.block;
    setPlacementError(block);
    setPlacementAttempt({
      item: draft,
      check: admission.check,
      block,
      state: "blocked",
      target: coords,
      success: "",
    });
  }

  function handleNudgeIntervention(id: string, eastM: number, northM: number) {
    const item = (saved.interventions ?? []).find((i) => i.id === id);
    if (!item) return;
    const next = nudgeCoords({ lat: item.lat, lon: item.lon }, eastM, northM);
    if (!next) {
      setNotice("Nudge not applied: the proposal is at the supported coordinate limit.");
      return;
    }
    handleMoveIntervention(id, next);
  }

  function choose(id: string) {
    setSelected(id);
    setSelectedIntervention(null);
    const c = saved.checks.find((c) => c.assetId === id);
    setNote(c?.note ?? "");
    setAssignee(c?.assignee ?? "");
  }
  function record(status: FieldCheck["status"]) {
    if (!active) return;
    if (status !== "To verify" && !note.trim()) {
      setNotice("Add an observation before recording or reviewing evidence.");
      return;
    }
    const c = {
      id: `check-${active.id}`,
      assetId: active.id,
      status,
      note: note.slice(0, 3000),
      assignee: assignee.slice(0, 100),
      updated: new Date().toISOString(),
    };
    update({
      checks: [...saved.checks.filter((x) => x.assetId !== active.id), c],
    });
    setNotice(
      status === "Reviewed"
        ? "Marked reviewed in this local workspace. This does not certify safety."
        : "Field check saved on this device.",
    );
  }
  function download(content: string, name: string, type = "application/json") {
    const u = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = u;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  function addAsset() {
    if (!newName.trim()) return;
    const a: Asset = {
      id: `local-${Date.now()}`,
      name: newName.trim(),
      kind: "resource",
      ...saved.area,
      source: "User-entered point; unverified",
    };
    update({ custom: [...saved.custom, a] });
    setNewName("");
    setAdding(false);
    choose(a.id);
    setNotice(
      "Added at the review-area centre. Location requires verification.",
    );
  }
  const renderResource = (a: Asset) => {
    const status =
      saved.checks.find((c) => c.assetId === a.id)?.status ?? "To verify";
    return (
      <button
        className={`resource-row ${selected === a.id ? "active" : ""}`}
        key={a.id}
        onClick={() => choose(a.id)}
      >
        <span
          className={`resource-icon ${a.kind === "hospital" || a.kind === "clinic" ? "red" : ""}`}
        >
          <Building2 size={19} />
        </span>
        <span>
          <strong>{a.name}</strong>
          <small>
            {a.kind.replace("_", " ")} · {distanceKm(a, saved.area).toFixed(1)}{" "}
            km
          </small>
          <em className={status === "Reviewed" ? "reviewed" : ""}>{status}</em>
        </span>
        <ChevronRight size={15} />
      </button>
    );
  };
  return (
    <div className={`app-shell landscape-shell ${showDecisionDesk ? "conversation-open" : ""}`}>
      <header className="topbar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setPanel(null);
          }}
        >
          <span className="brand-symbol">
            <Mountain size={29} />
          </span>
          TerraScope

        </a>
        <div className="header-place"><MapPin size={16} /><span>{mapTarget?.label ?? "Sonpur area"}</span></div>
        <h1 className="landscape-title">Plan with the landscape</h1>
        <button
          className="guide-top-btn"
          aria-label="What am I looking at? Guide"
          title="Explain this workspace"
          onClick={() => setShowGuide(true)}
        >
          <HelpCircle size={16} />
          <span>Quick guide</span>
        </button>
        <button
          className="source-top"
          aria-label="Data and sources"
          onClick={() => setSources(true)}
        >
          <Info size={17} />
          <span>Data & sources</span>
        </button>
        <button
          className="source-top ask-map-btn"
          aria-label="Ask the map — decision workspace"
          aria-expanded={showDecisionDesk}
          onClick={() => setShowDecisionDesk((v) => !v)}
        >
          <MessagesSquare size={16} />
          <span>Ask the map</span>
        </button>
        <button className="save-plan" onClick={() => download(JSON.stringify({ exportedAt: new Date().toISOString(), ...saved, manifest }, null, 2), "terrascope-workspace.json")}><Download size={16} />Save plan</button>
      </header>
      <div className="workspace-commandbar">
      <details className="workspace-disclosure placement-disclosure" open><summary>Placement tools</summary>
      <div
        className="placement-bar"
        role="toolbar"
        aria-label="Intervention placement tools"
      >
        <span className="placement-label">Interventions:</span>
        <button
          className={`placement-btn ${activePlacementTool === "select" ? "active" : ""}`}
          onClick={() => setActivePlacementTool("select")}
          aria-pressed={activePlacementTool === "select"}
          title="Select and inspect elements on the map"
        >
          Select
        </button>
        <button
          className={`placement-btn basin ${activePlacementTool === "storage_basin" ? "active" : ""}`}
          onClick={() =>
            setActivePlacementTool(
              activePlacementTool === "storage_basin"
                ? "select"
                : "storage_basin",
            )
          }
          aria-pressed={activePlacementTool === "storage_basin"}
          title="Place water storage basin on terrain"
        >
          <Droplets size={14} />
          + Basin
        </button>
        <button
          className={`placement-btn solar ${activePlacementTool === "solar_array" ? "active" : ""}`}
          onClick={() =>
            setActivePlacementTool(
              activePlacementTool === "solar_array" ? "select" : "solar_array",
            )
          }
          aria-pressed={activePlacementTool === "solar_array"}
          title="Place ground-mounted solar array"
        >
          <Sun size={14} />
          + Solar
        </button>
        <button
          className={`placement-btn wind ${activePlacementTool === "wind_turbine" ? "active" : ""}`}
          onClick={() =>
            setActivePlacementTool(
              activePlacementTool === "wind_turbine" ? "select" : "wind_turbine",
            )
          }
          aria-pressed={activePlacementTool === "wind_turbine"}
          title="Place wind turbine location"
        >
          <Wind size={14} />
          + Wind
        </button>
        <button
          className={`placement-btn vegetation ${activePlacementTool === "vegetation_buffer" ? "active" : ""}`}
          onClick={() =>
            setActivePlacementTool(
              activePlacementTool === "vegetation_buffer"
                ? "select"
                : "vegetation_buffer",
            )
          }
          aria-pressed={activePlacementTool === "vegetation_buffer"}
          title="Place riparian vegetation buffer"
        >
          <Trees size={14} />
          + Vegetation
        </button>
        <button
          className="placement-btn undo"
          onClick={handleUndoIntervention}
          disabled={!saved.interventions?.length}
          title="Undo last placement"
        >
          <RotateCcw size={13} />
          Undo
        </button>
        {saved.interventions && saved.interventions.length > 0 && (
          <span className="placement-summary">
            {saved.interventions.length} proposed / placement only; effects not calculated
          </span>
        )}
        {placementAttempt && (
          <span className={`placement-check-chip ${placementAttempt.state}`} role="status">
            {placementAttempt.state === "checking"
              ? "Checking…"
              : placementAttempt.state === "failed"
                ? "Check failed"
                : "Blocked"}
          </span>
        )}
      </div>
      </details>
      <details className="workspace-disclosure search-disclosure"><summary>Search places / change area</summary><PlaceSearch onChoose={chooseArea}/></details>
      <div className="proposal-controls">
        <button onClick={() => setCoordinatePlacement(v => !v)} aria-expanded={coordinatePlacement}>Place by coordinates</button>
        <details className="proposals-details"><summary>Proposals ({proposalItems.length}) / checks</summary>
          <div className="proposal-dropdown">
            {proposalItems.length === 0 ? <p>No proposals yet. Choose a placement tool or enter coordinates.</p> : proposalItems.map(item => <button key={item.id} onClick={() => { setSelectedIntervention(item.id); setSelected(null); setSelectedStorage(null); }}>
              {item.name} / {placementReview.state === 'loading' ? 'checking' : placementReview.checks[item.id]?.status ?? 'unknown'}
            </button>)}
          </div>
        </details>
      </div>
      </div>

      {placementError && (() => {
        const attempt = placementAttempt;
        const { kindLabels, names } = summarizeAttempt(attempt?.check);
        const failed = attempt?.state === "failed";
        return <div className="placement-blocked" role="alert">
          <div className="placement-blocked-head">
            <strong>{failed ? "Area check failed." : attempt?.success === "" ? "Proposal was not moved." : "This spot was not added."}</strong>
            {kindLabels.length > 0 && <span className="placement-blocked-tags">
              {kindLabels.map(k => <span key={k} className="placement-tag">{k}</span>)}
            </span>}
            {attempt && <span className="placement-blocked-coord">{attempt.target.lat.toFixed(4)}, {attempt.target.lon.toFixed(4)}</span>}
          </div>
          {names.length > 0 && <p className="placement-blocked-names">{names.join(" · ")}</p>}
          <p className="placement-blocked-note">{failed ? "Area evidence unavailable. Retry or choose another spot." : attempt?.success === "" ? "The proposal stayed where it was saved. Map check does not authorize a site." : "Nothing was saved. Map check does not authorize a site."}</p>
          <div className="placement-blocked-actions">
            <details className="placement-blocked-details"><summary>Details</summary><p>{placementError}</p></details>
            {failed && <button onClick={retryPlacementAttempt}>Retry area checks</button>}
            <button onClick={dismissPlacementAttempt}>Dismiss</button>
          </div>
        </div>;
      })()}
      {coordinatePlacement && <form className="coordinate-placement" onSubmit={e => {
        e.preventDefault();
        const coords = { lat: Number(placementLat), lon: Number(placementLon) };
        if (!Number.isFinite(coords.lat) || Math.abs(coords.lat) > 85 || !Number.isFinite(coords.lon) || Math.abs(coords.lon) > 180) return;
        handlePlaceAt(coords);
      }}>
        <label>Proposal type<select aria-label="Coordinate proposal type" value={activePlacementTool ?? 'select'} onChange={e => setActivePlacementTool(e.target.value as PlacementTool)}>
          <option value="select">Choose a type</option><option value="wind_turbine">Land-based wind turbine</option><option value="solar_array">Ground-mounted solar</option><option value="storage_basin">Storage basin</option><option value="vegetation_buffer">Vegetation</option>
        </select></label>
        <label>Latitude<input aria-label="Placement latitude" type="number" min="-85" max="85" step="any" required value={placementLat} onChange={e => setPlacementLat(e.target.value)}/></label>
        <label>Longitude<input aria-label="Placement longitude" type="number" min="-180" max="180" step="any" required value={placementLon} onChange={e => setPlacementLon(e.target.value)}/></label>
        <button type="submit" disabled={!activePlacementTool || activePlacementTool === 'select'}>Place and check proposal</button>
      </form>}
      <nav className="landscape-actions" aria-label="Map context">
        {([
          ["Explore", "Candidates & resources", Map],
          ["Environment", "Environment", Trees],
          ["River history", "History", History],
          ["Compare", "Compare", GitCompareArrows],
          ["Field checks", "Field checks", ClipboardCheck],
          ["Response plan", "Draft plan", FileText],
        ] as const).map(([name, label, Icon]) => <button key={name} aria-expanded={panel === name} aria-controls="landscape-context" onClick={e => openPanel(name, e.currentTarget)}><Icon size={16} />{label}</button>)}
        <button onClick={() => setShowEnso(true)}><Waves size={16} />Climate context</button>
      </nav>
      <main className="workspace">
        <section className="map-stage" aria-label="Geographic workspace">
            <MapView
              areaEvidence={areaGeometry}
              onEvidenceSelect={() => setPanel("Environment")}
              focusArea={mapTarget}
              focusPoint={cameraPoint}
              waterLevel={waterOn ? waterLevel : null}
              replayDate={historyMode && historyFrame ? historyFrame.date : days[day]}
              discharge={historyMode ? historyFrame?.flow ?? null : flow?.daily.river_discharge[day] ?? null}
              dischargeMax={historyMode ? historyFrame?.maximum ?? flowMax : flowMax}
              dateLabel={historyMode && historyFrame ? historyFrame.date : `${date(days[day])} 2024`}
              assets={assets}
              selected={selected}
              onSelect={(id) => { choose(id); setPanel("Explore"); }}
              onArea={(p) => {
                chooseArea({...p,label:"Map-selected area"});
                setSelected(null);
                setSelectedStorage(null);
              }}
              showAssets={showAssets}
              terrain={terrain}
              storage={storageMapData}
              selectedStorage={selectedStorage}
              onSelectStorage={(id) => { setSelectedStorage(id); setPanel("Explore"); }}
              showCandidates={showCandidates}
              showWaterLayer={showWaterLayer}
              showBasins={showBasins}
              basins={basinFC}
              interventions={saved.interventions}
              selectedIntervention={selectedIntervention}
              onSelectIntervention={(id) => { setSelectedIntervention(id); setPanel("Explore"); }}
              activePlacementTool={activePlacementTool}
              onPlaceAt={handlePlaceAt}
              onMoveIntervention={handleMoveIntervention}
              showInterventions={showInterventions}
              placementChecks={placementReview.checks}
              placementAttempt={placementAttempt}
              placementEvidence={placementReview.evidence}
              onDismissPlacementAttempt={dismissPlacementAttempt}
            />
          {areaGeometry.features.length > 0 && <button className="air-map-key" onClick={() => setPanel("Environment")}>Purple point: current air model / ~45 km, not a monitor</button>}
      {mapTarget && <details className="area-data-note"><summary>{mapTarget.label} / Sonpur history stays at its source location</summary> {placementReview.state === 'ready' ? 'Area map checks loaded (incomplete OSM mapping).' : placementReview.state === 'loading' ? 'Loading area building/road/water checks…' : 'Area checks failed; new placement is blocked.'} <button onClick={placementReview.retry}>Retry area checks</button><br/>Rainfall and discharge series remain the original Sonpur case and do not describe this selected area. NRSC dated map-color snapshots are used only where their published bounds cover the footprint. Terrain screening runs for the selected centre; suitability remains unverified.</details>}
          <div className="landscape-view-controls" aria-label="Map perspective"><button aria-pressed={!terrain} onClick={() => setTerrain(false)}>2D</button><button aria-pressed={terrain} onClick={() => setTerrain(true)}>3D</button><span>Real map / proposals are not measured effects</span></div>
          <button
            className="layer-toggle"
            onClick={() => setLayers(!layers)}
            aria-expanded={layers}
          >
            <Layers size={17} />
            Map layers
          </button>
          {layers && (
            <div className="layer-panel">
              <div className="panel-label">
                YOUR MAP
                <button
                  aria-label="Close map layers"
                  onClick={() => setLayers(false)}
                >
                  <X size={15} />
                </button>
              </div>
              {[
                {
                  name: "Tilted terrain view",
                  icon: Mountain,
                  on: terrain,
                  act: () => setTerrain(!terrain),
                },
                {
                  name: "Mapped resources",
                  icon: Building2,
                  on: showAssets,
                  act: () => setShowAssets(!showAssets),
                },
                {
                  name: "Sub-basins (HydroBASINS)",
                  icon: GitBranch,
                  on: showBasins,
                  act: () => setShowBasins(!showBasins),
                },
                {
                  name: "Candidate storage",
                  icon: Droplets,
                  on: showCandidates,
                  act: () => setShowCandidates(!showCandidates),
                },
                {
                  name: "Mapped water",
                  icon: Waves,
                  on: showWaterLayer,
                  act: () => setShowWaterLayer(!showWaterLayer),
                },
                {
                  name: "Placed interventions",
                  icon: Sparkles,
                  on: showInterventions,
                  act: () => setShowInterventions(!showInterventions),
                },
              ].map(({ name, icon: Icon, on, act }) => (
                <button
                  className="layer-item"
                  key={name}
                  onClick={act}
                  role="switch"
                  aria-checked={on}
                >
                  <Icon size={18} />
                  <span>{name}</span>
                  <i className={on ? "switch on" : "switch"} />
                </button>
              ))}
              <button
                className="layer-item unavailable"
                onClick={() => setSources(true)}
              >
                <Layers size={18} />
                <span>Survey parcels</span>
                <small>Needed</small>
              </button>
              <button className="layer-source" onClick={() => setSources(true)}>
                <Info size={15} />
                Sources & uncertainty
                <ArrowUpRight size={14} />
              </button>
            </div>
          )}
          <details className="map-summary"><summary>Event measurements</summary>
            <div className="summary-date">
              <strong>Day {day + 1}</strong>
              <span>
                {date(days[day])} 2024
              </span>
            </div>
            <div title="ERA5 sample grid cell · daily total">
              <CloudRain size={14} />
              <span>
                Sonpur event rain
                <strong>
                  {fmt(dailyRain[day])}
                  <small> mm/d</small>
                </strong>
              </span>
            </div>
            <div title="GloFAS modeled discharge at the sample river cell">
              <Waves size={14} />
              <span>
                Sonpur event flow
                <strong>
                  {fmt(flow?.daily.river_discharge[day])}
                  <small> m³/s</small>
                </strong>
              </span>
            </div>
          </details>
          <div className="map-dock">
            <MapPin size={16} />
            <span>Click to move the resource-search centre</span>
            <button onClick={() => setAdding(!adding)}>
              <Plus size={15} />
              Add resource
            </button>
          </div>
        </section>
        <aside className="side-panel" id="landscape-context" hidden={panel === null} aria-label="Map context panel" onKeyDown={e => { if (e.key === "Escape") closePanel(); }}>
          <button className="context-close" onClick={closePanel} aria-label="Close context panel"><X size={18} /></button>
          <div hidden={panel !== "River history"}>
            <RiverHistory onMap={closePanel} onSources={() => setSources(true)} onFrame={setHistoryFrame} active={panel === "River history"} />
          </div>
          <div hidden={panel !== "Environment"}><AreaReviewPanel latitude={saved.area.lat} longitude={saved.area.lon} onGeometryChange={setAreaGeometry} /></div>
          <div hidden={panel === "River history" || panel === "Environment"}>
          <div className="panel-top">
            <span className="eyebrow">
              {panel === "Explore"
                ? "PLACE → EVIDENCE → ACTION"
                : panel === "Compare"
                  ? "EXPLORE THE ASSUMPTIONS"
                  : panel === "Field checks"
                    ? "GROUND THE DATA"
                    : "PREPARE WITH CONTEXT"}
            </span>
            <h2>
              {panel === "Explore"
                ? "Candidates & resources"
                : panel === "Compare"
                  ? "Compare scenarios"
                  : panel === "Field checks"
                    ? "Field verification"
                    : "Preparedness draft"}
            </h2>
            <p>
              {panel === "Explore"
                ? "Explore terrain candidates and mapped resources. Site suitability remains unverified."
                : panel === "Compare"
                  ? "A transparent runoff experiment. Change assumptions and inspect their effect."
                  : panel === "Field checks"
                    ? "Record local observations and keep uncertainty visible."
                    : "Turn the available evidence into a reviewable preparation checklist."}
            </p>
          </div>
          {panel === "Compare" && <section className="visual-comparison" aria-label="Proposal visibility comparison"><h3>See the proposal</h3><p>Switch geometry in place, with the same camera and date. No calculated flood benefit.</p><div><button aria-pressed={!showInterventions} onClick={() => setShowInterventions(false)}>Existing place</button><button aria-pressed={showInterventions} onClick={() => setShowInterventions(true)}>With proposals ({proposalItems.length})</button></div></section>}
          {panel === "Explore" && <button className="secondary" onClick={() => setAdding(!adding)}><Plus size={15} />Add resource</button>}
          {panel === "Explore" && <Findings historyRows={historyRows} manifest={manifest} storageRun={storageRun} proposalCount={(saved.interventions ?? []).length} replayDate={days[day]} ensoYear={2024} onOpenEnso={() => { setSources(false); setShowTable(false); setShowGuide(false); setShowEnso(true); }} />}
          <section className="storage-panel" aria-label="Natural water-storage screening" hidden={panel !== "Explore"}>
            <div className="storage-head">
              <Droplets size={16} />
              <h3>Natural water-storage candidates</h3>
              <span className="storage-actions">
                <button
                  className="text-action"
                  disabled={storageBusy}
                  onClick={() => startStorageRun(saved.area)}
                >
                  <RotateCcw size={12} />
                  Re-run
                </button>
                {storageBusy && (
                  <button className="text-action" onClick={cancelStorage}>
                    Cancel
                  </button>
                )}
              </span>
            </div>
            <small className="storage-intro">
              Terrain depressions from open elevation tiles with mapped-water
              context. Analysis starts automatically after the review centre
              settles. Not recommendations, not surveyed reservoirs.
            </small>
            {storageBusy && (
              <div className="storage-status" role="status">
                {storagePhase}
              </div>
            )}
            {!storageRun && !storageBusy && (
              <div className="storage-status">
                Waiting for the first screening run. A missing result is a data
                gap, never evidence that storage is absent.
              </div>
            )}
            {storageRun?.status === "failed" && (
              <div className="storage-error" role="status">
                {storageRun.error}
              </div>
            )}
            {storageRun?.status === "cancelled" && (
              <div className="storage-status">{storageRun.error}</div>
            )}
            {storageRun?.status === "insufficient-data" && (
              <div className="storage-status">
                This window's terrain could not complete screening.{" "}
                {storageRun.limitations.join(" ")}
              </div>
            )}
            {storageRun?.status === "succeeded" &&
              (inspected ? (
                <div className="candidate-detail">
                  <div className="section-title">
                    <Droplets size={17} />
                    <h3>{inspected.label}</h3>
                    <button
                      onClick={() => setSelectedStorage(null)}
                      aria-label="Close candidate details"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <small>
                    {inspected.centroid[1].toFixed(5)},{" "}
                    {inspected.centroid[0].toFixed(5)} · rounded terrain-grid
                    cells, not a surveyed outline
                  </small>
                  {basinForInspected && (
                    <small className="candidate-catchment">
                      Sub-basin {basinForInspected.hybas_id} · upstream area at sub-basin outlet{" "}
                      {basinForInspected.up_area_km2.toLocaleString("en-GB", { maximumFractionDigits: 0 })} km² ·{" "}
                      this sub-basin {basinForInspected.sub_area_km2.toLocaleString("en-GB", { maximumFractionDigits: 0 })} km² ·{" "}
                      HydroBASINS v1c (DEM-derived, not surveyed)
                    </small>
                  )}
                  {basins && !basinForInspected && inspected && (
                    <small className="candidate-catchment">
                      Sub-basin lookup: outside the HydroBASINS context window (84.75–85.55E, 25.35–26.0N)
                    </small>
                  )}
                  {capacityRangeForInspected?.ok && (
                    <small className="candidate-catchment">
                      {CAPACITY_RANGE_LABEL}: P10 {Math.round(capacityRangeForInspected.variants.uncorrelated.p10M3).toLocaleString("en-GB")} – P50 {Math.round(capacityRangeForInspected.variants.uncorrelated.p50M3).toLocaleString("en-GB")} – P90 {Math.round(capacityRangeForInspected.variants.uncorrelated.p90M3).toLocaleString("en-GB")} m³ (uncorrelated DEM error, σ 2.5 m assumed, illustrative only)
                    </small>
                  )}
                  {capacityRangeForInspected && !capacityRangeForInspected.ok && (
                    <small className="candidate-catchment">DEM-error range refused: {capacityRangeForInspected.reason}</small>
                  )}
                  <dl className="storage-facts">
                    <div>
                      <dt>Geometric capacity to spill</dt>
                      <dd>{fmt(inspected.geometricCapacityM3)} m³</dd>
                    </div>
                    <div>
                      <dt>Footprint</dt>
                      <dd>{fmt(inspected.footprintAreaM2 / 10000)} ha</dd>
                    </div>
                    <div>
                      <dt>Max depth to spill</dt>
                      <dd>{inspected.maximumDepthToSpillM.toFixed(1)} m</dd>
                    </div>
                    <div>
                      <dt>Spill rim / floor elevation</dt>
                      <dd>
                        {inspected.spillElevationM.toFixed(1)} /{" "}
                        {inspected.minimumElevationM.toFixed(1)} m
                      </dd>
                    </div>
                    <div>
                      <dt>Mapped water here</dt>
                      <dd>{waterNote(inspected.waterEvidence)}</dd>
                    </div>
                    {inspected.waterEvidence.features.length > 0 && (
                      <div>
                        <dt>Water feature records</dt>
                        <dd>
                          {inspected.waterEvidence.features
                            .map((f) => f.label ?? f.id)
                            .join(", ")}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>Water available now</dt>
                      <dd>Unknown — no bathymetry or level survey</dd>
                    </div>
                    <div>
                      <dt>Suitability</dt>
                      <dd>Unassessed — no engineering or field review</dd>
                    </div>
                  </dl>
                  {inspected.profile ? (
                    <figure className="candidate-profile">
                      <figcaption>Terrain transect · {inspected.profile.axis}</figcaption>
                      <CandidateProfileChart profile={inspected.profile} />
                      <small>
                        One DEM line through the lowest candidate cell, with a two-cell context margin.
                        Heights use the source DEM reference; datum alignment and survey accuracy are unverified.
                        The spill elevation is calculated from the full depression and may lie outside this line.
                        This is terrain screening, not bathymetry or available water storage.
                      </small>
                      <details>
                        <summary>Transect samples</summary>
                        <table>
                          <caption>Displayed DEM samples</caption>
                          <thead><tr><th scope="col">Distance (m)</th><th scope="col">Elevation (m)</th></tr></thead>
                          <tbody>{inspected.profile.points.map((point) => (
                            <tr key={point.distanceM}><td>{point.distanceM.toFixed(1)}</td><td>{point.elevationM.toFixed(1)}</td></tr>
                          ))}</tbody>
                        </table>
                      </details>
                    </figure>
                  ) : (
                    <small>Terrain transect unavailable. Re-run screening to derive it from complete terrain samples.</small>
                  )}
                  <small className="storage-unknowns">
                    Not covered by this screen: catchment inflows and timing,
                    seasonal water level, infiltration and groundwater,
                    embankment works, current water volume, land ownership or
                    protection status.
                  </small>
                  <button
                    className="adopt-candidate-btn"
                    onClick={() => handleAdoptCandidate(inspected)}
                  >
                    <Plus size={15} />
                    Adopt candidate as planned storage basin
                  </button>
                </div>
              ) : (
                <>
                  <div className="list-heading storage-heading">
                    <span>
                      {storageRun.candidates.length <
                      storageRun.candidateCountTotal
                        ? `${storageRun.candidateCountTotal} depressions found · showing top ${storageRun.candidates.length}`
                        : storageRun.candidateCountTotal === 0
                          ? "No depressions found in this window"
                          : `${storageRun.candidateCountTotal} depressions · largest first`}{" "}
                      {storageRun.provenance.metersPerPixel.toFixed(0)} m cells
                    </span>
                  </div>
                  <div className="storage-list">
                    {storageCandidates.map((c) => (
                      <button
                        key={c.id}
                        className={`storage-row ${selectedStorage === c.id ? "active" : ""}`}
                        onClick={() => setSelectedStorage(c.id)}
                      >
                        <span>
                          <strong>{c.label}</strong>
                          <small>
                            {fmt(c.geometricCapacityM3)} m³ · depth{" "}
                            {c.maximumDepthToSpillM.toFixed(1)} m ·{" "}
                            {fmt(c.footprintAreaM2 / 10000)} ha
                          </small>
                        </span>
                        <em>{waterNote(c.waterEvidence)}</em>
                      </button>
                    ))}
                    {storageRun.candidateCountTotal === 0 && (
                      <small className="storage-note">
                        Analyzed terrain drains outward everywhere at{" "}
                        {storageRun.provenance.metersPerPixel.toFixed(0)} m
                        resolution. Smaller depressions may be below this
                        grid's size; finer-source terrain would be needed to
                        rule them out.
                      </small>
                    )}
                  </div>
                </>
              ))}
            {storageRun && (
              <details className="storage-limitations">
                <summary>
                  Limitations ({storageRun.limitations.length})
                </summary>
                <ul>
                  {storageRun.limitations.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </details>
            )}
            {storageRun?.status === "succeeded" && (
              <details className="storage-run">
                <summary>Run provenance</summary>
                {harnessLine && (
                  <small className="harness-line">{harnessLine}</small>
                )}
                <small>
                  Method {storageRun.provenance.method} · schema{" "}
                  {storageRun.schema} · config {storageRun.configHash} · run{" "}
                  {storageRun.id}
                  <br />
                  Tiles at zoom {storageRun.provenance.tileMatrixZoom} ·{" "}
                  {storageRun.provenance.metersPerPixel.toFixed(2)} m/pixel ·{" "}
                  {storageRun.tilesFetched}/{storageRun.tilesTotal} fetched ·
                  vertical datum {storageRun.provenance.verticalDatum}
                  <br />
                  Terrain {storageRun.provenance.terrainSource} · started{" "}
                  {new Date(storageRun.startedAt).toLocaleString("en-GB")}
                  {storageRun.provenance.waterRetrievedAt
                    ? ` · water fetched ${new Date(storageRun.provenance.waterRetrievedAt).toLocaleTimeString("en-GB")}`
                    : ""}
                </small>
                {storageRun.provenance.waterQueryUrl && (
                  <a
                    href={storageRun.provenance.waterQueryUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    OSM water query used <ExternalLink size={12} />
                  </a>
                )}
              </details>
            )}
          </section>
          {inspectedIntervention && (
            <div
              className="intervention-inspector"
              role="region"
              aria-label="Intervention parameters"
            >
              <div className="inspector-head">
                <span className={`kind-pill ${inspectedIntervention.kind}`}>
                  {inspectedIntervention.kind.replace("_", " ")}
                </span>
                <button
                  onClick={() => setSelectedIntervention(null)}
                  aria-label="Close intervention inspector"
                >
                  <X size={15} />
                </button>
              </div>
              <h3>{inspectedIntervention.name}</h3>
              <div className="metric-row">
                <span>Footprint:</span>
                <strong>{inspectedIntervention.areaM2.toLocaleString()} m²</strong>
              </div>
              {inspectedIntervention.capacityM3 != null && (
                <div className="metric-row">
                  <span>{inspectedIntervention.sourceCandidateId ? "DEM geometric volume:" : "Assumed design volume:"}</span>
                  <strong>
                    {inspectedIntervention.capacityM3.toLocaleString()} m³
                  </strong>
                </div>
              )}
              {inspectedIntervention.depthM != null && (
                <div className="metric-row">
                  <span>{inspectedIntervention.sourceCandidateId ? "DEM depth to spill:" : "Assumed design depth:"}</span>
                  <strong>{inspectedIntervention.depthM.toFixed(1)} m</strong>
                </div>
              )}
              {inspectedIntervention.powerKw != null && (
                <div className="metric-row">
                  <span>Assumed nameplate rating:</span>
                  <strong>
                    {inspectedIntervention.powerKw.toLocaleString()} kW
                  </strong>
                </div>
              )}
              {inspectedIntervention.roughnessManning != null && (
                <div className="metric-row">
                  <span>Manning's Roughness (n):</span>
                  <strong>{inspectedIntervention.roughnessManning}</strong>
                </div>
              )}
              <p className="intervention-note">{inspectedIntervention.notes}</p>
              <div role="group" aria-label="Nudge proposal position">
                <p className="intervention-note">Nudge proposal ~200 m (each nudge is re-checked like a move; effects not calculated; not a surveyed position):</p>
                <button className="placement-btn" onClick={() => handleNudgeIntervention(inspectedIntervention.id, 0, 200)} aria-label="Nudge proposal about 200 metres north" title="Nudge about 200 m north">N</button>
                <button className="placement-btn" onClick={() => handleNudgeIntervention(inspectedIntervention.id, 200, 0)} aria-label="Nudge proposal about 200 metres east" title="Nudge about 200 m east">E</button>
                <button className="placement-btn" onClick={() => handleNudgeIntervention(inspectedIntervention.id, 0, -200)} aria-label="Nudge proposal about 200 metres south" title="Nudge about 200 m south">S</button>
                <button className="placement-btn" onClick={() => handleNudgeIntervention(inspectedIntervention.id, -200, 0)} aria-label="Nudge proposal about 200 metres west" title="Nudge about 200 m west">W</button>
              </div>
              {(saved.placementEdits ?? []).filter((e) => e.interventionId === inspectedIntervention.id).length > 0 && (
                <p className="intervention-note">
                  {(saved.placementEdits ?? []).filter((e) => e.interventionId === inspectedIntervention.id).length} recorded move(s) in the workspace edit audit. The audit pairs the as-placed and as-moved geometry for each confirmed move; it is not a surveyed boundary and proposals are not calculation inputs.
                </p>
              )}
              <PlacementReview item={inspectedIntervention} check={placementReview.checks[inspectedIntervention.id] ?? null} evidence={placementReview.evidence} state={placementReview.state} retry={placementReview.retry}/>
              <button
                className="delete-btn"
                onClick={() => handleDeleteIntervention(inspectedIntervention.id)}
              >
                Delete intervention
              </button>
            </div>
          )}
          {panel === "Explore" && (
            <section className="ai-planner-card" aria-label="Screening and proposals">
              <h3>Screening and proposals</h3>
              <p>{storageBusy ? `Screening in progress: ${storagePhase}. Results are not ready.` : storageRun?.status === 'succeeded' ? `${storageRun.candidateCountTotal} DEM depressions screened; suitability unassessed.` : 'Terrain results unavailable. Missing evidence is not zero storage.'}</p>
              <p>{proposalItems.length} proposal(s). Assumed/geometric volumes are not available storm storage. Placed objects do not change the illustrative runoff calculation.</p>
              <p>Local AI is not connected. Placement checks use deterministic map intersections, not AI or engineering certification.</p>
            </section>
          )}
          {adding && (
            <div className="inline-form">
              <label>
                Resource name
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Proposed shelter"
                  maxLength={120}
                />
              </label>
              <small>
                At {saved.area.lat.toFixed(4)}, {saved.area.lon.toFixed(4)} ·
                user-entered, unverified
              </small>
              <button
                className="primary"
                disabled={!newName.trim()}
                onClick={addAsset}
              >
                Add at review centre
              </button>
            </div>
          )}
          {(panel === "Explore" || panel === "Field checks") && (
            <>
              <div className="radius-control">
                <label htmlFor="radius">
                  Resource search radius
                  <strong>{saved.radius.toFixed(1)} km</strong>
                </label>
                <input
                  id="radius"
                  type="range"
                  min=".5"
                  max="10"
                  step=".5"
                  value={saved.radius}
                  onChange={(e) => update({ radius: Number(e.target.value) })}
                />
                <small>
                  Search scope only. Does not estimate flood extent.
                </small>
                <details className="coordinates">
                  <summary>Set review centre by coordinates</summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      const lat = Number(data.get("lat")),
                        lon = Number(data.get("lon"));
                      if (
                        Number.isFinite(lat) &&
                        Math.abs(lat) <= 85 &&
                        Number.isFinite(lon) &&
                        Math.abs(lon) <= 180
                      ) {
                        chooseArea({lat,lon,label:"Coordinate-selected area"});
                        setSelected(null);
                        setNotice("Review centre updated.");
                      }
                    }}
                    key={`${saved.area.lat},${saved.area.lon}`}
                  >
                    <label>
                      Latitude
                      <input
                        name="lat"
                        type="number"
                        min="-85"
                        max="85"
                        step="any"
                        defaultValue={saved.area.lat.toFixed(5)}
                        required
                      />
                    </label>
                    <label>
                      Longitude
                      <input
                        name="lon"
                        type="number"
                        min="-180"
                        max="180"
                        step="any"
                        defaultValue={saved.area.lon.toFixed(5)}
                        required
                      />
                    </label>
                    <button type="submit" className="secondary">
                      Set centre
                    </button>
                  </form>
                </details>
              </div>
              <div className="list-heading">
                <span>{nearby.length} mapped resources</span>
                <button
                  onClick={() => setAdding(!adding)}
                  aria-label="Add resource"
                >
                  <Plus size={17} />
                </button>
              </div>
              <label className="search">
                <Search size={15} />
                <input
                  aria-label="Search resources"
                  placeholder="Find a resource…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="resource-list">
                {visibleAssets.map(renderResource)}
                {!visibleAssets.length && (
                  <div className="empty">
                    <MapPin size={26} />
                    <strong>No matching resources</strong>
                    <p>
                      Move the review area, expand its radius or add a known
                      location. Empty coverage does not mean no people or
                      facilities are present.
                    </p>
                  </div>
                )}
              </div>
              {active && (
                <section className="evidence-card">
                  <div className="section-title">
                    <ClipboardCheck size={18} />
                    <h3>{active.name}</h3>
                    <button
                      onClick={() => setSelected(null)}
                      aria-label="Close resource"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <small>
                    {active.lat.toFixed(5)}, {active.lon.toFixed(5)} · location
                    unverified
                  </small>
                  {active.source.startsWith("https://") ? (
                    <a href={active.source} target="_blank" rel="noreferrer">
                      Open source record <ExternalLink size={12} />
                    </a>
                  ) : (
                    <small>{active.source}</small>
                  )}
                  <label>
                    Assigned reviewer
                    <input
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                      placeholder="Name or team (optional)"
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Observation
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What was checked? Include observation time, method and remaining uncertainty."
                      maxLength={3000}
                    />
                  </label>
                  <div className="button-pair">
                    <button
                      className="secondary"
                      onClick={() => record("To verify")}
                    >
                      Queue check
                    </button>
                    <button
                      className="primary"
                      onClick={() => record("Evidence recorded")}
                    >
                      Save evidence
                    </button>
                  </div>
                  <button
                    className="text-action"
                    disabled={!note.trim()}
                    onClick={() => record("Reviewed")}
                  >
                    <Check size={14} />
                    Mark locally reviewed
                  </button>
                  <small>Local records only. No team has been contacted.</small>
                </section>
              )}
              <div className="next-card">
                <ShieldCheck size={22} />
                <div>
                  <strong>Preparation starts with evidence.</strong>
                  <p>Confirm access, facility status and available capacity.</p>
                  <button
                    className="text-action"
                    onClick={() => {
                      setPanel("Response plan");
                      setDraft(draftPlan(nearby, saved.checks, saved.radius));
                    }}
                  >
                    Create a draft checklist
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
          {panel === "Compare" && (
            <div className="compare-panel">
              <p className="placement-model-note">Parameter experiment only. Placed interventions are not model inputs. An intervention-effect comparison is unavailable until catchment, outlet and other required model adapters are connected. Rainfall is identical in both runs.</p>
              <div className="notice-card">
                <Info size={17} />
                <span>
                  Illustrative model · not calibrated to the Gandak. Outputs are
                  runoff depth per hour, not river discharge or flood depth.
                </span>
              </div>
              {[
                {
                  key: "rainScale",
                  label: "Rainfall multiplier",
                  min: 0.25,
                  max: 2,
                  step: 0.05,
                  unit: "×",
                },
                {
                  key: "loss",
                  label: "Assumed rainfall loss fraction",
                  min: 0,
                  max: 0.9,
                  step: 0.05,
                  unit: "",
                },
                {
                  key: "lag",
                  label: "Storage response time",
                  min: 1,
                  max: 24,
                  step: 1,
                  unit: " h",
                },
              ].map((c) => (
                <label className="scenario-control" key={c.key}>
                  {c.label}
                  <strong>
                    {saved.scenario[c.key as keyof Scenario]}
                    {c.unit}
                  </strong>
                  <input
                    aria-label={c.label}
                    type="range"
                    min={c.min}
                    max={c.max}
                    step={c.step}
                    value={saved.scenario[c.key as keyof Scenario]}
                    onChange={(e) => {
                      update({
                        scenario: {
                          ...saved.scenario,
                          [c.key]: Number(e.target.value),
                        },
                      });
                      setRan(false);
                    }}
                  />
                </label>
              ))}
              <button
                className="primary full"
                disabled={!calc}
                onClick={() => setRan(true)}
              >
                <GitCompareArrows size={17} />
                Run comparison
              </button>
              {ran && calc && (
                <div className="comparison-result">
                  <span className="eyebrow">ILLUSTRATIVE RUNOFF · mm/h</span>
                  <Spark
                    values={calc.base.map((x) => x.out)}
                    comparison={calc.proposed.map((x) => x.out)}
                  />
                  <div className="key">
                    <span>● Reference assumptions</span>
                    <span>┄ Your assumptions</span>
                  </div>
                  <div className="result-grid">
                    <div>
                      <small>Reference peak (mm/h)</small>
                      <strong>
                        {Math.max(...calc.base.map((x) => x.out)).toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <small>Changed-assumption peak (mm/h)</small>
                      <strong>
                        {Math.max(...calc.proposed.map((x) => x.out)).toFixed(
                          2,
                        )}
                      </strong>
                    </div>
                  </div>
                  <p>
                    Identical rainfall in both runs: {saved.scenario.rainScale} times the archived hourly series. Reference loss 0.35 and response 8 h; changed loss {saved.scenario.loss} and response {saved.scenario.lag} h. Both start with zero storage. These are parameter sensitivities, not measured site effects.
                  </p>
                  <button
                    className="text-action"
                    onClick={() =>
                      download(
                        JSON.stringify(
                          {
                            kind: "illustrative-linear-reservoir",
                            modelVersion: "linear-reservoir-v1",
                            units: {
                              input: "mm/h",
                              out: "mm/h",
                              storage: "mm",
                            },
                            initialStorage: 0,
                            time: rain?.hourly.time,
                            assumptions:
                              "No catchment area, channel routing, surveyed geometry or calibration; zero initial storage.",
                            scenario: saved.scenario,
                            referenceSettings: { rainScale: saved.scenario.rainScale, loss: 0.35, lag: 8 },
                            placedInterventionsApplied: false,
                            comparisonKind: "matched-rainfall-parameter-sensitivity",
                            baseline: calc.base,
                            proposed: calc.proposed,
                            manifest,
                          },
                          null,
                          2,
                        ),
                        "terrascope-comparison.json",
                      )
                    }
                  >
                    <Download size={14} />
                    Export model results
                  </button>
                </div>
              )}
              <details>
                <summary>How this calculation works</summary>
                <p>
                  Hourly rainfall minus an assumed loss enters a linear storage
                  reservoir. Each hour releases a fraction 1 − exp(−1 / response
                  time). Storage starts at zero. Remaining water stays in
                  storage. This conserves the modeled water input; it does not
                  include channel geometry, soil measurements or upstream
                  operations.
                </p>
              </details>
              <button
                className="text-action"
                onClick={() => {
                  update({ scenario: initial.scenario });
                  setRan(false);
                }}
              >
                <RotateCcw size={14} />
                Reset assumptions
              </button>
            </div>
          )}
          {panel === "Response plan" && (
            <div className="plan-panel">
              <span className="review-badge">Human review required</span>
              <p className="small-copy">
                Generate a local worksheet from the resources in your review
                area and the evidence you recorded.
              </p>
              <button
                className="primary full"
                onClick={() =>
                  setDraft(draftPlan(nearby, saved.checks, saved.radius))
                }
              >
                <FileText size={16} />
                {draft ? "Refresh draft" : "Generate draft"}
              </button>
              <div className="draft-method">
                <ShieldCheck size={14} />
                Local source-linked template · no LLM connected
              </div>
              {draft ? (
                <>
                  <textarea
                    className="draft-editor"
                    aria-label="Preparedness draft"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button
                    className="secondary full"
                    onClick={() =>
                      download(
                        draft,
                        "terrascope-preparedness-draft.txt",
                        "text/plain",
                      )
                    }
                  >
                    <Download size={15} />
                    Export draft
                  </button>
                </>
              ) : (
                <div className="empty">
                  <FileText size={32} />
                  <strong>A practical starting point.</strong>
                  <p>
                    Your draft will list resource checks, preparation options
                    and information still needed. It will not issue a warning or
                    declare a route safe.
                  </p>
                </div>
              )}
              <a
                className="guidance-link"
                href="https://nidm.gov.in/pdf/guidelines/floods.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Read NDMA flood-management guidance
                <ArrowUpRight size={14} />
              </a>
            </div>
          )}
          <footer className="panel-footer">
            <span className="live-dot" />
            Saved on this device
            <button onClick={() => setSources(true)}>
              Sources
              <ArrowUpRight size={12} />
            </button>
          </footer>
          </div>
        </aside>
      </main>
      {historyMode && <div className="history-map-caption"><span>Sonpur historical reconstruction / {historyFrame?.date ?? "Loading"} / not flood extent</span><button onClick={() => {setHistoryMode(false); setPanel(null);}}>Return to event replay</button></div>}
      <section
        className="timeline-panel"
        aria-label="Historical timeline"
        hidden={historyMode}
      >
        <div className="timeline-top">
          <button
            className="play-button"
            aria-label={playing ? "Pause replay" : "Play replay"}
            onClick={() => {
              if (day === 8) setDay(0);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <div className="timeline-title">
            <strong>Replay the conditions</strong>
            <span>{date(days[day])} 2024</span>
          </div>
          <input
            aria-label="Replay day"
            type="range"
            min="0"
            max="8"
            step="1"
            value={day}
            onChange={(e) => {
              setPlaying(false);
              setDay(Number(e.target.value));
            }}
          />
          <span className="day-count">Day {day + 1} / 9</span>
          <button
            className="secondary table-button"
            aria-expanded={showResults}
            onClick={() => setShowResults((v) => !v)}
          >
            Result timeline
            <History size={14} aria-hidden="true" />
          </button>
          <button
            className="secondary table-button"
            onClick={() => setShowTable(true)}
          >
            Inspect data
            <ArrowUpRight size={14} />
          </button>
        </div>
        <details className="timeline-details"><summary>Measurements & terrain-only water scenario</summary><div className="timeline-charts">
          <div>
            <div className="chart-heading">
              <span>
                <CloudRain size={15} />
                Rainfall input
              </span>
              <small>ERA5 sample cell · daily total, IST · mm</small>
            </div>
            <Spark values={dailyRain} bars color="#6a9cc6" />
          </div>
          <div>
            <div className="chart-heading">
              <span>
                <Waves size={15} />
                River discharge
              </span>
              <small>GloFAS model · daily, UTC · m³/s</small>
            </div>
            <Spark values={flow?.daily.river_discharge ?? []} />
          </div>
          <div className="timeline-context water-panel">
            <div className="water-panel-head">
              <span className="eyebrow">WATER-LEVEL SCENARIO</span>
              <label className="water-switch">
                <input
                  type="checkbox"
                  aria-label="Show water-level scenario"
                  checked={waterOn}
                  onChange={(e) => setWaterOn(e.target.checked)}
                />
                <span>Show</span>
              </label>
            </div>
            <div className="water-slider">
              <input
                aria-label="Water surface elevation"
                type="range"
                min="44"
                max="64"
                step="0.5"
                value={waterLevel}
                onChange={(e) => {
                  setWaterOn(true);
                  setWaterLevel(Number(e.target.value));
                }}
              />
              <output>{waterLevel.toFixed(1)} m</output>
            </div>
            <p>
              Terrain below this surface. No hydraulics, timing or
              embankments.
            </p>
            <button onClick={() => setSources(true)}>
              What this does not show
              <ChevronRight size={13} />
            </button>
          </div>
        </div></details>
      </section>
      {(
        <ResultTimeline
          days={days}
          dailyRain={dailyRain}
          discharge={flow?.daily.river_discharge ?? []}
          waterOn={waterOn}
          waterLevel={waterLevel}
          storageRun={storageRun}
          interventions={saved.interventions ?? []}
          onOpenHistory={() => openPanel("River history")}
          onClose={() => setShowResults(false)}
          open={showResults}
          onOpen={() => setShowResults(true)}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {dataErrors.length > 0 && (
        <div className="data-error" role="status">
          Unavailable datasets: {dataErrors.join(", ")}. Missing data is not
          treated as zero.
        </div>
      )}
      {(sources || showTable || showGuide) && (
        <div className="modal-backdrop">
          <div
            className="modal"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={
              showGuide
                ? "User guide and concept overview"
                : sources
                  ? "Data and limitations"
                  : "Historical data table"
            }
          >
            <button
              className="modal-close"
              onClick={() => {
                setSources(false);
                setShowTable(false);
                setShowGuide(false);
              }}
              aria-label="Close dialog"
            >
              <X size={21} />
            </button>
            {showGuide ? (
              <div className="guide-content">
                <span className="eyebrow">WHAT AM I LOOKING AT? · USER GUIDE</span>
                <h2>Understanding TerraScope Flood Workspace</h2>
                <p className="guide-lead">
                  TerraScope helps local planners, field coordinators, and communities prepare for floods along the Gandak and Ganga river corridors in Bihar, India. It combines 10-year river data with natural elevation screening and resilience project planning.
                </p>
                <div className="guide-grid">
                  <div className="guide-card">
                    <div className="guide-card-icon water"><Droplets size={22} /></div>
                    <h3>Natural Storage Basins (Teal on Map)</h3>
                    <p>
                      The shaded teal outlines show <strong>natural depressions (ground bowls)</strong> detected from open elevation tiles. During monsoons these areas hold runoff — how much is usable is <strong>unverified</strong>; nothing here is an engineering storage design.
                    </p>
                  </div>
                  <div className="guide-card">
                    <div className="guide-card-icon wave"><Waves size={22} /></div>
                    <h3>Simulating Water Levels</h3>
                    <p>
                      Use the <strong>Water-Level Scenario slider</strong> (bottom right) to paint every DEM cell below a flat surface (44–64 m elevation, illustrative only). It is a geometry mask, not a flood depth, extent or forecast.
                    </p>
                  </div>
                  <div className="guide-card">
                    <div className="guide-card-icon rain"><Play size={22} /></div>
                    <h3>Replaying the 2024 Flood</h3>
                    <p>
                      Click <strong>Replay</strong> on the bottom timeline to step through the late-September 2024 flood event, tracking river discharge (GloFAS) and local rainfall (ERA5) day by day.
                    </p>
                  </div>
                  <div className="guide-card">
                    <div className="guide-card-icon plan"><SlidersHorizontal size={22} /></div>
                    <h3>Planning Interventions</h3>
                    <p>
                      Propose water storage basins, solar arrays, wind turbines, or riparian vegetation buffers. TerraScope checks every placement against real mapped buildings, roads, and riverways to avoid collisions.
                    </p>
                  </div>
                </div>
                <div className="guide-glossary">
                  <h4>Your journeys — what works, and how honestly</h4>
                  <ul>
                    <li><strong>“What did late September 2024 look like?”</strong> Replay the bottom timeline (Explore or River history). Day-by-day GloFAS modeled discharge and ERA5 rainfall; a marker shows the sample cell. NRSC observed maps are withheld from this public build (production rights not cleared) — extent is unknown, never dry.</li>
                    <li><strong>“Where could water be stored naturally?”</strong> Explore → “Natural water-storage candidates” → the screen finds terrain depressions; click a row to inspect bowl size, spill rim and its DEM-derived sub-basin. It is geometry, not a validated reservoir design.</li>
                    <li><strong>“What would flood here?”</strong> There is no flood-extent layer anywhere in this app. The water-level slider paints DEM cells below a flat surface (illustrative), and the replay shows modeled flow. No depth, boundary or timing claim is made or possible yet.</li>
                    <li><strong>“Where do I plan things?”</strong> Field checks: place solar, turbines, storage or vegetation proposals — overlaps with mapped buildings, roads and water are flagged automatically. Unknowns stay unknown; nothing is certified.</li>
                    <li><strong>“Who decides?”</strong> Ask the map: cited answers from the local record, or your own local/cloud model (key stays in your browser; Groq is labeled cloud). Drafts (advisory, decision brief) download as markdown for a human authorised officer. The app never sends, posts or authorises anything.</li>
                    <li><strong>“How sure are we?”</strong> Data &amp; sources: every dataset with retrieval date, hash and verdicts. Of the 18 tracked requirements, 13 remain open — this is decision support, never an official warning.</li>
                  </ul>
                </div>
                <div className="guide-glossary">
                  <h4>Key Metrics Explained Simply:</h4>
                  <ul>
                    <li><strong>Spill Rim Elevation:</strong> The highest boundary point of a bowl. If water rises above this level, it overflows into surrounding land.</li>
                    <li><strong>Floor Elevation:</strong> The lowest ground point inside the bowl.</li>
                    <li><strong>Max Depth to Spill:</strong> The difference between spill rim and floor (depth before spilling).</li>
                    <li><strong>Geometric Capacity:</strong> Maximum water volume (m³) the depression can hold before spilling.</li>
                  </ul>
                </div>
                <button
                  className="guide-dismiss-btn"
                  onClick={() => setShowGuide(false)}
                >
                  <Check size={16} /> Got it, continue exploring
                </button>
              </div>
            ) : (
              <>
                <span className="eyebrow">TRACEABLE INPUTS. HONEST LIMITS.</span>
                <h2>
                  {sources
                    ? "The evidence behind the view"
                    : "Inspect the historical record"}
                </h2>
                {sources ? (
              <>
                <p>
                  This workspace replays historical data and supports local
                  review. The blue area is a user-defined search radius, not
                  modeled or observed flooding.
                </p>
                <div className="source-cards">
                  {manifest.map((m) => (
                    <article key={m.id}>
                      <h3>{SOURCE_CARDS[m.id]?.title ?? "Unknown dataset"}</h3>
                      <span className="review-badge">{m.status}</span>
                      <p>{SOURCE_CARDS[m.id]?.blurb ?? "Not yet documented here — see the fingerprint and registry tables below before relying on it."}</p>
                      <small>
                        {m.model}
                        <br />
                        {m.units} · {m.resolution}
                        <br />
                        Time reference: {m.timezone}
                      </small>
                      <small>
                        Retrieved {m.retrieved} · {SOURCE_CARDS[m.id]?.license ?? "licence not recorded — do not redistribute"}
                      </small>
                      <a href={m.url} target="_blank" rel="noreferrer">
                        Original query
                        <ExternalLink size={13} />
                      </a>
                      {m.sha256 && (
                        <details>
                          <summary>Dataset fingerprint</summary>
                          <code>{m.sha256}</code>
                        </details>
                      )}
                    </article>
                  ))}
                </div>
                <details className="onboarding-report">
                  <summary>Data onboarding and dependency tracking (R16)</summary>
                  <p className="small-copy">
                    Every dataset the workspace uses is registered with its schema contract, coverage,
                    freshness policy and consumers. Checks below run against the loaded manifest; a stale
                    current-mapping layer blocks nothing silently — it reports warn/fail here.
                  </p>
                  {onboarding ? (
                    <>
                      <p className="onboarding-summary" role="note">
                        {onboarding.summary.pass} pass · {onboarding.summary.warn} warn · {onboarding.summary.fail} fail · {onboarding.summary.notApplicable} n/a (generated {new Date(onboarding.generatedAt).toLocaleString("en-GB")})
                      </p>
                      <div className="table-scroll">
                        <table>
                          <caption>Per-dataset onboarding checks</caption>
                          <thead>
                            <tr><th scope="col">Dataset</th><th scope="col">Check</th><th scope="col">Verdict</th><th scope="col">Detail</th></tr>
                          </thead>
                          <tbody>
                            {onboarding.checks.map((c, i) => (
                              <tr key={`${c.dataset}-${c.check}-${i}`} className={`onboarding-${c.verdict}`}>
                                <th scope="row">{c.dataset}</th>
                                <td>{c.check}</td>
                                <td>{c.verdict}</td>
                                <td className="onboarding-detail">{c.detail}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <caption>Who consumes each dataset</caption>
                          <thead>
                            <tr><th scope="col">Dataset</th><th scope="col">Used by</th><th scope="col">Load-bearing</th></tr>
                          </thead>
                          <tbody>
                            {onboarding.dependencies.map((d) => (
                              <tr key={d.dataset}>
                                <th scope="row">{d.dataset}</th>
                                <td className="onboarding-detail">{d.usedBy.join(" · ")}</td>
                                <td>{d.loadBearing ? "yes" : "no"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <ul className="onboarding-limits">
                        {onboardingLimits.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="small-copy">Onboarding report unavailable (manifest not loaded).</p>
                  )}
                </details>
                <h3>What is still needed</h3>
                <p>
                  Surveyed channels, embankment levels, independent event flood
                  extents, local river observations and archived forecast
                  issuance are not connected. Cadastral parcels and LLM/VLM
                  services are not configured. A 3D map is not survey-grade
                  evidence.
                </p>
                <p>
                  Terrain uses Mapzen Terrain Tiles for context, with no
                  vertical exaggeration. Basemap: OpenStreetMap. Data
                  processing: local scripts with saved query manifests.
                </p>
                <div className="source-links">
                  <a
                    href="https://open-meteo.com/en/docs/historical-weather-api"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Rainfall documentation ↗
                  </a>
                  <a
                    href="https://open-meteo.com/en/docs/flood-api"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Discharge documentation ↗
                  </a>
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                  >
                    OSM attribution ↗
                  </a>
                  <a
                    href="https://registry.opendata.aws/terrain-tiles/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Terrain provenance ↗
                  </a>
                </div>
              </>
            ) : (
              <>
                <p>
                  Rainfall daily totals use IST. Discharge daily values use the
                  original UTC model dates; they are not recalculated for the
                  local day.
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Rainfall (mm, IST)</th>
                        <th>Discharge (m³/s, UTC)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((d, i) => (
                        <tr key={d}>
                          <th>{d}</th>
                          <td>{fmt(dailyRain[i])}</td>
                          <td>{fmt(flow?.daily.river_discharge[i])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="primary"
                  onClick={() =>
                    download(
                      "date,rainfall_mm_IST,modeled_discharge_m3s_UTC\n" +
                        days
                          .map(
                            (d, i) =>
                              `${d},${dailyRain[i] ?? ""},${flow?.daily.river_discharge[i] ?? ""}`,
                          )
                          .join("\n"),
                      "terrascope-historical-data.csv",
                      "text/csv",
                    )
                  }
                >
                  <Download size={15} />
                  Download CSV
                </button>
              </>
            )}
            </>
            )}
          </div>
        </div>
      )}
      {showEnso && (
        <div className="modal-backdrop">
          <div
            className="modal"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="ENSO climate context"
          >
            <button
              className="modal-close"
              onClick={() => setShowEnso(false)}
              aria-label="Close dialog"
            >
              <X size={21} />
            </button>
            <EnsoContext onClose={() => setShowEnso(false)} />
          </div>
        </div>
      )}
      <div className="conversation-slot" hidden={!showDecisionDesk}>
        <DecisionDesk
          context={{
            history: historyRows,
            manifest,
            ensoYear: 2024,
            storageRun,
            proposalCount: (saved.interventions ?? []).length,
            replayDate: historyMode && historyFrame ? historyFrame.date : days[day],
          }}
          onClose={closeDecisionDesk}
        />
      </div>
    </div>
  );
}
