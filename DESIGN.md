# Design — Environmental scenario workspace

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](docs/CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


## Automatic planning — latest product contract

The system proactively discovers/refreshes supported data, generates candidate placements and evaluates scenarios after region/objective selection; repeated manual prompting is not the intended workflow. See docs/PRODUCT_AUTONOMY.md for end-user jobs and automatic/manual ownership, and docs/AGENT_HARNESS.md for local agent roles, durable execution and verification. These extend the scope to R01–R18 and supersede manual-first assumptions below. Architecture is documented; autonomous services and model integrations are not implemented. Development must proactively research prerequisites and judge changes against the final user journey.

## Current design contract — supersedes prior tabbed workflows

One persistent 3D world, layer/filter drawer, contextual local-AI/object-properties panel, placement toolbar and shared multiyear/event timeline. No separate Explore/History/Compare/Field checks/Response plan work tabs. Comparison and evidence open within the same view. Preserve camera, area, time and scenario. Mobile uses collapsible sheets; keyboard/coordinate forms support placement. Visibility filters never change scientific inputs.

See docs/REQUIREMENTS.md R01, R06, R10 and R13. This is the target, not a claim the existing tabbed application has been migrated. Conflicting layout/journey descriptions below document previous work.


## Visual direction

A map-first geographic workspace with terrain as the main content, forest-green accents, off-white panels, blue water and amber risk patterns. Real geography and readable evidence take priority over decorative realism. The generated TerraScope image is inspiration only; its terrain, flood extent and hydrograph are not scientific assets.

## Journey

1. Choose a case with region, event date and mode: reconstruction, retrospective forecast test or hypothetical scenario.
2. Explore OSM context and independent environmental layers. Inspect provenance, resolution, coverage and limitations.
3. Select replay time or forecast cutoff; distinguish rainfall input from river-flow output.
4. Run a supported model or load a versioned precomputed result. Handle loading, computation failure and unavailable data explicitly.
5. Compare baseline and proposed scenarios under matched forcing/initial conditions.
6. Inspect potentially exposed assets and create verification tasks.
7. Review field evidence and request a source-linked draft preparedness plan, retaining unresolved items.

## Layout and layers

Desktop: prominent map, collapsible layer panel, contextual inspection/scenario panel and timeline. Implemented mobile: stacked map, active workspace panel and timeline, with collapsible layers, touch controls and non-map coordinate/resource/table access. A dedicated bottom sheet and adaptive 2D default remain possible refinements.3D is optional; all important data remains accessible without WebGL. Keep OSM attribution visible.

Differentiate observed flood extent, modeled inundation, susceptibility screening and missing coverage using labels/patterns as well as color. Show scale, units, time zone and any vertical exaggeration. Parcel boundaries are not flood-depth measurements.

## Charts

Rainfall uses mm or mm/hour as appropriate; river discharge uses m³/s; water level uses metres with a stated datum. Never silently interchange them. Show baseline/proposed lines only after a documented calculation. Empty state: Run a comparison to see results. Display uncertainty and gaps. Adding trees, solar or turbines must not automatically draw a better outcome.

## Verification and AI

Asset cards show source, last verification, location confidence and modeled exposure. Field tasks explain what evidence is needed. AI plans are drafts with links to model output and approved guidance. Unknown shelter capacity, road condition or contact details stay unknown. Do not label unchecked routes safe.

## Accessibility and motion

Keyboard/touch alternatives for every essential map interaction; visible focus, focus return for dialogs, pause for replay/flows, reduced-motion camera behavior and table alternatives. Test360px, zoom, slow networks, WebGL failure and real phones. Record short interaction sequences to inspect motion and state transitions, not just screenshots.

## Later research tools

Renewable placement will distinguish estimated energy yield, local wakes, land-cover effects and regional climate research. Do not show cloud trapping as established science. Prefer clear comparisons over decorative weather animation.

## Implemented prototype (4 November 2026)

Forest-green/off-white map workspace; Explore, Compare, Field checks and Response plan panels; nine-day replay; true OSM tiles and optional Mapzen terrain. The dashed blue circle is explicitly a user-defined review radius, never flood extent. Scenario results appear only after Run comparison. See artifacts/terrascope-desktop.png and artifacts/terrascope-mobile.png for actual application captures.


## Visual history revision — 4 November 2026

The rejected search circle is removed, including its layer toggle and legend. The entry screen is River history: ten-year month tiles, a fixed-scale annual hydrograph, click/scrub date selection, replay/pause, previous-day flow change and a discharge column. The column encodes discharge, not water height. A separate explicit gap panel explains that mapped flood spread is unavailable. The old nine-day resource workspace remains accessible under Explore.
