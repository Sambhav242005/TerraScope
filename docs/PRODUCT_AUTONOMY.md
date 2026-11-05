# Final-product contract: proactive environmental planning

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


Status: required design, not a running autonomous service. Updated 4 November 2026. Complements R01–R14; adds R15–R18. No background jobs or monitoring have been activated by this document.

## Why someone would use it

A local planner should be able to answer: what changed in my area, what might be affected, which interventions are worth investigating, and why? A researcher should be able to reproduce an analysis, challenge its assumptions and compare alternatives. The product's value is reducing the work between scattered evidence and an inspectable scenario, rather than adding a chat window to a map.

Working personas to validate, not claims of customer research: municipal/watershed planner, environmental researcher and infrastructure/site planner. Shared jobs: pre-monsoon preparation, heavy-rain scenario investigation, storage/land-use/renewable siting and comparison after new evidence. Operational warnings are not the initial promise.

## Default journey without repeated prompting

1. User selects a region and objective, such as reduce potential flood exposure, investigate water storage or compare renewable siting. Offer an explicit objective template if they do not want to write a prompt. Show recommended resource limits and allow adjustment; do not require scientific parameter entry just to start.
2. System discovers appropriate registered sources by extent/time; retrieves permissible data; checks completeness, dates, units, datum and resolution; builds a versioned regional evidence bundle. It searches alternatives when a source fails. Unsupported geography yields a clear coverage result, not fake precision.
3. System assembles the baseline and identifies available analyses. It automatically searches candidate locations, generates proposed placements, evaluates supported scenarios under the configured budget and checks results. Manual placement is an optional override, not a prerequisite.
4. The same world shows a short explanation of findings, candidate polygons, result layers, tradeoffs and missing constraints. The AI can explain “why here?” and “why not there?” using recorded evidence. Users can change constraints, disable suggestions, edit a proposal or select a different objective.
5. When watched source versions or scenario inputs change, the dependency graph marks affected results stale and queues only necessary recalculations. Preserve prior results and show what changed and why. Research updates may propose new methods; they must not silently change validated production model behavior.
6. Resume after restart at the last durable checkpoint. A persistent local service is required for work while the browser is closed; no work is claimed while the host is asleep/offline. Show last successful refresh, next eligible refresh and pending failures in the same view.

Proactive findings are grouped by meaningful changes, not endless agent chatter. Routine updates remain in activity history. Do not duplicate recommendations every refresh. A stale or missing source should create a data-quality finding, not a hazard-free status.

## Who supplies what

| Item | Normal owner and behavior | Genuine manual boundary |
| --- | --- | --- |
| Rainfall, terrain, river, land-cover, OSM and climate context | Registered connectors discover/query permitted coverage, cache versions and refresh automatically | Restricted access, unavailable surveys or provider credentials |
| Candidate storage/renewable/vegetation sites | Spatial tools generate candidates; agent explains and compares them | User may add preferences/exclusions or edit placements |
| Scenario inputs | Tools derive documented inputs and proposed defaults from available evidence | Unmeasured channel/outlet/structure conditions cannot be invented |
| Local AI setup | Installer checks hardware, recommends compatible configurations and reports readiness | Model download/storage and runtime installation; benchmarking before promises |
| New area using supported sources | Reuse adapters and schema; no feature coding or hand-entered JSON | Local data gaps or jurisdiction-specific restrictions |
| New dataset using a supported format/protocol | Config-driven registration, validation and provenance | A genuinely new protocol may need a connector |
| New physical process or intervention effect | Versioned model adapter with required inputs, output contract and evaluation | Developer/scientific engineering; the LLM cannot turn arbitrary research into a validated feature |
| External communication, construction, public warning or release | Prepare an evidence-linked proposal | Remains outside autonomous internal analysis |

Do not promise zero development effort. Aim for no per-location coding and no recurring copy/paste of publicly accessible supported inputs. Distinguish a missing dataset, connector defect, unavailable model capability and product UX gap in diagnostics; each needs a different remedy.

## Automatic placement and meaningful ranking

Generate multiple alternatives and a no-intervention baseline. Keep hard exclusions separate from unknown constraints and scored preferences. Show tradeoffs rather than a mysterious single “best” score. Include supported exposure change, storage, land disturbance, energy/yield, environmental effects, cost ranges only when sourced, and downstream worsening. Missing metrics stay unknown. A candidate map is not site approval.

For automatic solar/wind placement, evaluate only supported objectives and constraints. Cloud trapping or regional rainfall control cannot be assumed as a siting benefit. For ENSO, present sourced regional/seasonal context and supported scenarios; do not use an invented global multiplier.

## Long-run product needs to build proactively

- Reliable onboarding: coverage preview, local runtime readiness, meaningful first analysis, understandable empty/failure states.
- Source health: licenses, quotas, stale datasets, changes to schemas, deprecation, alternate providers and reproducible snapshots.
- Durability: persistent workspace, run history, checkpoints, backup/export, storage quotas and recovery from interrupted downloads/solver runs.
- User control: pause/cancel research or calculations, visible budgets, inspect inputs, reversible edits and reset to baseline.
- Reproducibility: pin model/data versions, distinguish historical runs from latest recommendations, export a portable evidence/scenario bundle.
- Security: local-service access control, scoped filesystem/network tools, no public exposure of the inference endpoint, no untrusted document instructions.
- Accessibility/performance: same-view keyboard/touch/non-3D access, measured real-phone performance, partial loading and bounded scene/result streaming.
- Trust: explain coverage limits and disagreements; independent evaluation and no fabricated confidence percentages.

## Success measures and acceptance

Record first-use task completion, time to first useful evidence-backed result, required manual actions, automatic retrieval coverage, failed/stale job rate, candidate validity, numerical/citation support and cost/latency per analysis. Product usability and scientific accuracy require separate measures. Set quantitative targets after a measured baseline; do not invent successful numbers.

Minimum autonomy demonstration: start from a supported region/objective with no dataset uploads or hand-placed candidates; obtain a cited baseline, automatically proposed placements and tool-calculated comparison. Change a source/input and prove dependent results refresh while unaffected runs are reused. Restart mid-run and recover without duplicate work. Repeat with unavailable data, no model service and no network; show honest partial results. No agent may grade itself by changing the acceptance rules.

## Research basis and open choices

[USGS STAC documentation](https://www.usgs.gov/landsat-missions/spatiotemporal-asset-catalog-stac) demonstrates spatial/time catalog discovery rather than manual file selection. [OGC API Processes](https://www.ogc.org/standards/ogcapi-processes/) provides a standard pattern for exposing computational jobs. These are architecture references, not a claim all required sources implement them or that either integration exists here. Context7 is unavailable in this session; official primary sources were used. Runtime/model/queue/database choices remain unselected pending capability and resource tests.
