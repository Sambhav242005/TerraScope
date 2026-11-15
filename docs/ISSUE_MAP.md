# Issue connection map — 15 November 2026 (addendum, same day)

After publication of the 8-agent analysis, four bounded fix slices landed with the orchestrator verifying every one:

- **#3 R03** — illustrative DEM-error capacity range delivered and browser-verified (label verbatim in candidate detail; 16 tests; availableStorageM3 remains null). R03 still open — constraints/outlets/bathymetry unchanged.
- **#6 R06** — slice (a) landed: drag-to-move re-admission + append-only edit audit (11 tests; maplibre pin draggable; keyboard nudge verified end-to-end 0→1 audit); pointer-gesture acceptance remains unverified; R06 still open.
- **#2 R02** — benchmark runner + fixture tests landed (44 tests; pre-registered gates); never measured a real model; R02 still open (no local model installed).
- **#7 R07** — ERA5 solar/wind baseline delivered and registered (dataset + statistics library + manifest/registry/sources card; 21 tests); no simulation; R07 still open.

Proving discipline changed: verification now runs 277/277 unit tests, TypeScript build clean, and all browser suites green (flood 13/13, decision-desk 8/8, basins 5/5, feature-map 14/14, result-timeline 13/13).

---

# Issue connection map — 15 November 2026

**Method.** Eight isolated, read-only analyst agents (one package each) + an orchestrator assembly. Agents created no commits, touched no tracked files (only `artifacts/agents/*.md`, gitignored), ran no browsers, and were forbidden to invent measurements. The orchestrator then did every browser/unit check itself and assembled this graph.

**Verification snapshot (orchestrator, current build, 2026-11-15):** `npm test` → **185 pass / 0 fail** (decision-desk tests are **16**, correcting docs that said 14/15); `tsc --noEmit && vite build` → **clean** (app chunk 225 kB after vendor split). Browser suites run today: flood-check **13/13** (incl. replay) — decision-desk **8/8** — basins **4/4** — feature-map **14/14** — result-timeline **13/13** — context **23/23**. **Physical-phone performance was never measured.**

**Register (GitHub, today):** open = #1–#7, #9, #11–#14, #18 (13) · closed = #8, #10, #15, #16, #17 (5).

---

## 1. Components (who can move together)

### Hazard chain — the external-data blocker (bridge: **#4**)
`#4 (R04) → #5 (R05) → #13 (R13 visuals)` sharing its scientific spine with `#3` (storage candidates) and `#11` (surveys). All four break at the same missing links:

1. a rated gauge + stage–discharge relation for the Gandak reach (CWC / Bihar WRD hold it; neither contacted);
2. a bathymetry survey of the channel + embankments/culvert inversions;
3. an independent calibration set and held-out events (incl. non-events), with results reviewed by someone with flood credentials.

Until those arrive **no code change can close #4, #5, #11, or the water-rise half of #13**. NRSC imagery is withheld from the public build (production rights not cleared), so R04's "observed" layer is absent there too — the window metadata stays in the manifest, the PNGs do not ship.

### AI lane — decision-support spine (bridge: **#2**)
`#17 (R17, CLOSED, deterministic harness)` is the pattern and admission gate for `#2 (R02) → #12 (R12)`. Everything today (answer engine, probe, key handling, crank-call discipline) is **scaffold, not capability**: no local model is installed or benchmarked; the Groq preset is a labelled cloud convenience. The acceptance bar is already written down (F-local-ai.md §3 pre-registered: 50 reps × four schema shapes, ≥90 % registry-valid tool calls, latency recorded, separate-verifier gate). `#12` cannot close before `#2`.

### World UX — the one-world contract (bridge: **#1**)
`#1 (R01)` is the structural root of the tabs complaint. Evidence (A-persistent-world.md): six tabs (`App.tsx:108-114`), two mutually exclusive map trees re-created per switch (`WorldMap` vs `<main> MapView`), unsynced duplicate state (`satellite`, `nrscSnapshot`), three split replay surfaces, no redo, no reduced-motion budget, focus-trap gaps. Everyone else (`#2 #12` docks, `#6` edits, `#13` dimensional layers, `#15` findings, `#17` harness) must land **inside** its frame. `#15`/`#17` (closed) function as regression oracles, not dependencies.

### Research lane (bridge: **#7**)
`#7 (R07) → #9 (R09)` — currently zero simulation code (`renewableModels.ts` = procedural Three.js, "No energy model."), every effect entry unassessed. E's finding can shrink the lane honestly: recommended first step = R07 **solar/wind baseline resource readout + comparative screening table** (~8–20 h), using Open-Meteo/NASA POWER archives — explicitly **not** an R09 build, and labelled non-commercial until terms are read.

### Placement lane (closest to shipping) (bridge: **#6**)
Ranked slice menu with verification gates (D-placement.md §3): **(a) drag-to-move with re-admission + audit (~6–10 h, rank 1)** ≫ **(b) parameter editor with geometry refit (4–7 h)** > **(c) delete with recovery audit (3–5 h)** > **(d) freehand basin polygon (8–12 h)** ≫ (e) multi-object compare — **explicitly blocked on #4/#5, do not schedule**. Note: maplibre-gl `Marker({draggable:true})` semantics are unverified in-repo — verify with a spike before estimating honestly.

### Meta lane
`#14 (R14)` — never closes; every issue closing needs an R14 entry with evidence. `#18 (R18)` — ongoing; its phone-device performance prong is shared with `#13`/`#1` and has **never** been done.

---

## 2. Bridge issues (close these to unlock clusters)

| Bridge | Unlocks | Unlocked by whom |
|---|---|---|
| **#1** | #2/#12 frame, #6 UX, #13 placement, #15 formalization | code-only (~0.5–2 d slice / ~1–3 wk full) |
| **#2** | #12; any local AI claim | **you**: install + run the benchmark card |
| **#4** | #5, #13, #3's benefit claims, #6's effect hooks | **external data**: CWC/Bihar WRD letter + survey + held-out test |
| **#7** | #9, and future R07 effect claims | code + **your licence/scope sign-off** |
| **#6** | useful chain for #3/#7 content; R12's links | code-only (~6–10 h for slice (a)) |

---

## 3. Per-issue verdict — honest status and what can move

| Issue | State today | Gate to close | Movable without external parties? | Effort |
|---|---|---|---|---|
| #1 R01 persistent world | Tabs undelivered; two map trees | Slice a–g landed; world-check suites green; camera preserved; 360 px holds | **Yes** | 0.5–2 d smallest; 1–3 wk full |
| #2 R02 local LLM | Env: probe/adapter (sound), no model | Benchmark card §3 passes; separate verifier gate; recorded latency | **Only if you install a model** (Groq ≠ local) | install + ~6–10 h bench |
| #3 R03 storage candidates | DEM screening delivered, honest nulls; sub-basin context added | Constraints + outlet analysis + bathymetry delivered (needs §device data) | Partially (open-data slice) | ~16–32 h open-data slice; engineering = external |
| #4 R04 affected areas | Replay + marker only; no hydraulics | Calibrated solver; held-out events; warnings tested vs baselines | **No — external data** | weeks after letters land |
| #5 R05 water rise & when | Flat-surface slider only | Datum + stage–discharge + timing field; rise-above-baseline | **No — external data** | same chain as #4 |
| #6 R06 placement/edit | Pins + rejection + audit-lite; nothing editable | Editing slice (a) + (b) landed; effect-model hooks stay unavailable | **Yes** | 6–10 h slice (a) |
| #7 R07 renewable effects | Brief + matrix; zero sims | At least one supported adapter with unit-tested transforms + linked sources | **Yes, with sign-off on scope/licence** | ~8–20 h R07 slice |
| #9 R09 forest/land-cover | Nothing (scope line only) | Onboarded Hansen/WorldCover with checks; zero operational claims | Yes, with sign-off | ~16–30 h preview |
| #11 R11 surveys/land records | OSM mean-vertex ways only | Parcels bound to rights via survey package + legal review | **No — external data** (and cadastral is personal data) | external/formal |
| #12 R12 AI counter-plans | Fixed template brief; not AI; shown as drafts | Local inference (i.e. #2 closes) + verifier score ≤0.10 unsupported citations | Blocked on #2 | depends on #2 |
| #13 R13 dimensional visual feedback | Illustrative heights (6 m), window-fraction marker; never phone-tested | Solver output (#5) **and** stable-world pass (#1) **and** one physical-phone session | **No — needs solver + a phone** | post-#5/#1; ~9–18 h minimal labeled slice anytime |
| #14 R14 continuity | Register maintained; 20+ stale facts fixed this pass | n/a — obligation; closes never | Yes — ongoing | ongoing |
| #18 R18 final-product-led | Obligation met this pass (research + healing) | ≥2 regions onboarded; effects of phone test known; register current | Partially; phone + region 2 needed | ongoing |

---

## 4. "Connected issues" — the graph in one picture (textual)

```
#1 (world UX) ─┬─► #12 (frame for AI drafts)    ─┐
               ├─► #6 (camera-neutral edit)       │
               └─► #13 (dimensional rail) ◄───────┼── #5 ─┬─ #4 ──┐
                                                    │              ├─ #3 (shared bathymetry)
#17 (harness, done) ─► #2 (local model) ───────────┘              └─ #11 (same letters)
#15 (findings, done) ──► narrates everything via #12
#10 (timeline, done) ──► time axis for all of the above
#16 (onboarding, done) ──► every new source enters through this gate
#14/#18 ──► process guardrails on every row above
```

Key pairs to keep together when scheduling (from the eight reports): **#4↔#5 are one work item**, always both or neither (C-hazard-terrain §5) · **#13 depends on #5** and its phone test (G §5) · **#12 hard-depends on #2** (F §5) · **#1 precedes any honest R12 demo** (A §5) · **#6 slices (a)-(c) are independent of the hazard chain** and would also make #3's adoption flow stronger (D §5, B §5) · **#7 before #9 before any R06 effect claims** (E §5).

---

## 5. Verification record per issue (where a surface exists, it's green)

Browser: flood-check **13/13** (replay/Findings/export/360 px) · decision-desk **8/8** · basins **4/4** (HydroBASINS layer, sub-basin line, 360 px) · feature-map **14/14** (journey map, honest tags) · result-timeline **13/13** · context **23/23** (ENSO, findings, onboarding verdicts, 360 px).
Unit: **185/185** incl. harness (21), ENSO (9), findings (9), timeline (13), hydrobasins (7), data-onboarding (12), decision-desk (16).

| Issue | Visual/normal verification today |
|---|---|
| #1, #6, #7, #9, #13 (Gaussian-gap) | no shipped artifact to screenshot — absent as expected; gate is stated, not faked |
| #3 | basins-check 4/4 (toggle, candidate line, 360 px) + HydroBASINS unit suite 7/7; storage screening exercised end-to-end in browser |
| #4, #5, #11 | replay/marker verified; water-scenario runs as scenario-only (never a forecast); NRSC absent publicly — correct |
| #2, #12 | decision-desk-check 8/8; live Groq round-trip verified 2026-11-15 (0.3 s; intermittent over-capacity; not local inference) |
| #14, #18 | 20+ stale doc facts fixed this pass; all reports honored; register reconciled |

---

## 6. Standing refusals (must remain in effect after this map)

No flood extent/depth/timing/rise claim (needs calibrated solver) · no phone-performance claim (never measured) · no "local inference" claim for Groq · no crowdfunding of "validated" HydroBASINS/GloFAS as gauges · no official warning/advisory/autorise-anything by this app · no ENSO-as-multiplier · no OSM-as-title evidence · missing data is never zero or safe · no NRSC redistribution · no claim that the DEM controls-rain-effect chain has any predictive skill.

## 7. Recommended order from here (your calls)

1. **You send CWC + Bihar WRD + NRSC clearance letters** (I draft them) → unblocks #4/#5/#11/#3(engineering).
2. **You install a local model** (e.g., Ollama + Qwen2.5-7B-class) → I run the benchmark card → if it passes, #2 → #12.
3. **Next coding session**: slice **(a) drag-to-move with re-admission** on #6, or **#1-a/b R01 hoist**; both are code-only and visible.
4. **#7 R07 baseline resource readout** when you approve the Open-Meteo/POWER scope and non-commercial label.
5. Keep #4/#5 **at zero** until gauges: today's optional slice is C-hazard-terrain's datum-aware scenario labels (~4–8 d) — honest labelling, not a model.

All agent reports: `artifacts/agents/A-persistent-world.md`, `B-storage-candidates.md`, `C-hazard-terrain.md`, `D-placement.md`, `E-renewables-environment.md`, `F-local-ai.md`, `G-dimensional-visuals.md`, `H-continuity.md` (gitignored, local).
