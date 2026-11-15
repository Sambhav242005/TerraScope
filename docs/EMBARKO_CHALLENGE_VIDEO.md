# TerraScope — challenge video script & capture list (15 Nov 2026)

For: the Embarko Student Challenge (worked example: the scoring page at embarko.ai/challenge). Format: **vertical 9:16, 40 s–3 min; target 75–90 s.** You record and edit; I draft. No claims beyond what this file allows.

## Ground rules for every line (do not bend)

- Say "prototype", "modeled reanalysis", "open data", "10-year window". Never: "forecast", "predict", "validated", "official", "warning system", "safe".
- Every number shown must match the app: peak/discharge figures on screen are the app's own values; the Oct 2024 replay is "modeled", not "measured".
- No NRSC imagery anywhere in the cut. No secrets on screen — the deploy command must have the token column/line blurred or use a re-enactment.
- End card must show **terrascope-floods.embarko.app** and **#DeployWithEmbarko**.

## Shot-by-shot (≈80 s)

**0–3 s — Hook.** Close-up, your face or the map at full peak, motion in frame:
VO: *"In October 2024, the Gandak river in Bihar hit its highest modeled peak in ten years of records. I built an app that shows you that day — and it never lies to you."*
On-screen text: **terraScope** · **Gandak corridor · Oct 2024**

**3–8 s — Who + why.**
VO: *"I'm [name], a student. Nobody should have to guess whether their village will flood — and I can't fix that with a chatbot answer. So I built the honest version."*

**8–35 s — Tour (screen capture, 2× speed where boring).**
1. Landing / Explore: *"It's all open data: ERA5 reanalysis and GloFAS discharge, one persistent map."*
2. Step the replay slider to 1 Oct 2024: *"The replay slider walks you through 2015 to 2024 — this is the 2024 monsoon peak. Line-up: rains surge, discharge follows."* (slowly show the graph small, then map)
3. Tap a storage candidate: *"The map screens terrain for natural water-storage depressions — DEM geometry only, labelled as not a tolerance on available storage."*
4. Ask the map: ask "highest discharge month?" — *"Any question gets cited answers from the actual datasets — every chip cites source, date and license. No citations? It refuses."*
5. Decision brief: *"And the brief downloads as markdown so a human officer signs off — the app never sends anything."*
6. Quick source panel: *"Every dataset: SHA-256 pinned, licence-checked, missing data never counts as zero."*

**35–55 s — How Embarko got it live.** Cut to a re-enacted terminal (real deploy, secret blurred):
VO: *"I told my AI agent to deploy this with Embarko. It called the deploy API — the app built, and went live at terrascope-floods.embarko.app. Claimed to my account, permanent — not a one-day preview."*
Show: the terminal line ending `"status":"live"` (blur the token), then the live URL in a browser.

**55–70 s — The wow.**
VO: *"Here's the part nobody does: this app is designed to be incomplete out loud. Missing evidence never reads as safe. It tells you exactly what is known, from which dataset, dated when — and what it doesn't know. That's the product."*
On-screen text: **known out loud, cited, incomplete — on purpose**

**70–80 s — Close.** End card: app URL + **#DeployWithEmbarko**.
VO: *"TerraScope — open data, honest limits, live on Embarko. Link below. #DeployWithEmbarko."*

## Caption drafts (post unchanged or you adjust voice)

**Instagram / YouTube Shorts:**
> For the Embarko Student Challenge: I built TerraScope — a flood-preparedness prototype for Bihar's Gandak corridor. Real ERA5/GloFAS data (2015–2024), an Oct-2024 replay, terrain-screened water-storage candidates, and an Ask-the-map that cites every answer or refuses to answer. Prototype, not a forecast — every limit is on screen. Live at terrascope-floods.embarko.app · #DeployWithEmbarko

**X (280 chars — trim to fit):**
> Entered the @Embarko Student Challenge with TerraScope — open flood data for Bihar's Gandak corridor, replayed live on the map, everything cited, missing data never zero. Prototype, not a forecast. terrascope-floods.embarko.app #DeployWithEmbarko

## Your capture checklist

1. Vertical recording: OBS at 1080×1920, or record landscape and crop to 9:16 — don't stretch.
2. Record the tour at the real app URL (not a localhost) so it's unambiguously live.
3. Blur/cut any terminal token; re-enact the deploy line rather than showing real credentials.
4. Mic close to mouth; kill fan/AC noise; speak slower than feels natural.
5. Captions on every platform (post plays muted by default).
6. Before posting: watch it once as a stranger — the idea must land in one watch.

## Honesty pre-check before posting (you confirm yes to all)

- [ ] No "forecast/predict/validated/official/alert/warning" anywhere in the cut or caption
- [ ] The app link works on mobile right now (you opened it on your phone)
- [ ] Logo/music/images are yours or CC0/CC-BY (rules §4)
- [ ] NRSC never appears
- [ ] The words "prototype" or "open data with limits" appear in the video or caption
- [ ] No reach-faking tactics (no paid promotion, no bots)
