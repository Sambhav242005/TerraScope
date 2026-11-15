# Embarko Student Challenge — TerraScope entry plan (15 November 2026)

Sources (read 15 Nov 2026): https://embarko.ai/challenge and https://embarko.ai/challenge/rules (last updated 11 Nov 2026). This plan is honest about what TerraScope is: a public prototype for flood preparedness in the Gandak corridor — modeled ERA5/GloFAS evidence, OSM context, deterministic or labeled-cloud AI. Not an operational forecast; not a validated warning system; NRSC imagery withheld publicly.

## The two scores we're optimizing

| Score | Judges look at | TerraScope today | Gap |
|---|---|---|---|
| Work | How the app looks | React/TS app, 6 views, consistent tokens, focus-visible, reduced-motion support, 360px browser-verified | No first-impression "wow" pass since 14 Nov; never physically opened on a phone |
| Work | Original idea | Extremely original vs. to-do-app entries: real flood replay (Oct 2024 Gandak), DEM storage screening, honest AI, ENSO context | Story not yet told anywhere public |
| Work | Works on phone | 360px headless checks pass; zero physical phone verification | **Must happen before claiming it** |
| Video | 40 s–3 min, ≥1 platform, #DeployWithEmbarko | None | Full production needed |

## Hard constraints (from rules + project honesty rules)

- One entry per person; resubmitting replaces the old entry. Submit only when app + post are both final.
- The app must stay live and posts public until winners are announced (~20 Nov 2026).
- No paid reach, no bots, no purchased followers. Normal sharing only.
- No false claims in the video: no "operational flood forecasting", no "validated" hydraulics, no gauge authority. Say "prototype using 10 years of open data (ERA5/GloFAS), clearly labeled, with missing data never treated as zero".
- Do not show NRSC imagery (withheld publicly) or any credential/token on screen — blur or omit.
- Never claim the phone works until it has actually been opened on one.
- Registration eligibility (rules §2): enrolled student, ≥13; under age of majority needs guardian permission; proof of enrolment/age may be requested. If not eligible, do not enter.
- **Date ambiguity, resolved by planning to the nearer one:** page shows "Registration deadline: 30 Nov 2026" while the leaderboard opens 20 Nov 2026 and rules say the closing date will be announced on the page. Plan all work against **19 Nov 2026 as ship-by**; if the deadline is truly 30 Nov, it only relaxes the schedule.

## Phase 0 — Register (user, ~10 min, today)

1. Go to https://embarko.ai/challenge#register — 9 questions, free, no Embarko account needed.
2. Use your real name/email/number; confirm student status honestly; save the confirmation.
3. Claim your personal referral link (bonus points: +1 register / +5 live app / +10 submit; comments/reposts of the sponsor's LinkedIn post give +2/+3 once each, after sponsor checks).
4. Note the exact submission form fields (app link + post links) so nothing structural blocks Phase 4.

## Phase 1 — App ready for judges (me + user, today–17 Nov)

1. **Physical phone pass (user, ~45 min)** — the single most important Work item, since most judges open it on a phone:
   - Open https://terrascope-floods.embarko.app on your phone (mobile data, not only Wi-Fi).
   - Walk: landing → Explore map loads and pans → replay slider (pick 1 Oct 2024, step through) → tap a candidate (checks: capacity-range line legible?) → touch a placed pin → Ask the map (ask one question, e.g. "peak discharge month") → download decision brief → 360px keyboard-nudge path if you tap a proposal.
   - Record: load time to first map tiles, jank, overlapping text, and any console/blocked requests. I fix what breaks; you re-verify on the device.
2. **First-impression polish (me, bounded, no science changes)** — target the "first screen that wows" criterion:
   - Tighten the landing composition/typography/spacing on desktop and 360px; unify font weights and numeric alignment.
   - Strengthen the loading state (skeleton/shimmer already present? verify), empty states, and the topbar affordance names.
   - Focus-visible audit and tap-target sizes (≥44px) for the pin/nudge/inspector controls.
   - Keep every honesty label intact — polish, never scent-mask.
3. Keep the bar green: `npm test` 277/277, `npm run build` clean, five browser suites, then **redeploy to Embarko** and re-verify live (HTTP 200, decision-desk 8/8, basins 5/5). Update docs with the phone-pass evidence and any fixes.

## Phase 2 — Video (17–18 Nov; me drafts, you record/edit)

Target **75–90 s, vertical 9:16** (Reels/Shorts), 40 s floor acceptable if tight. Parts per the challenge spec:

1. **Hook (≤3 s):** on-map replay at peak — "In October 2024, the Gandak river in Bihar broke records. I built an app that replays it with real data — and refuses to guess when the data runs out."
2. **Who/why (5–8 s):** "I'm <name>, a student. Nobody should have to guess whether their village will flood."
3. **What it does (25–30 s):** quick tour on screen: replay 2015–2024 peak; storage-candidate screening from terrain; ENSO context; Ask the map (deterministic evidence, cited sources; cloud only if labeled); the advisory downloads as markdown for a human officer.
4. **How Embarko got it live (15–20 s):** screen-capture the actual deploy story — AI agent + Embarko's ship endpoint → `https://terrascope-floods.embarko.app`, claimed permanent to your account. Token never on screen (record with a redacted terminal re-enactment, not the real one).
5. **Wow (5–8 s):** "Every number in it is real open data, every claim carries its uncertainty, and when it doesn't know — it says so."
6. **Outro (3–5 s):** end card: **terrascope-floods.embarko.app** · **#DeployWithEmbarko**.

Honesty review gate on the final cut before posting: no forecast/prediction claims, no "validated", no alarm sirens, no imagery that looks like an official alert, no shown secrets, NRSC absent.

Production pieces: I pre-stage a deterministic vertical tour (Playwright-driven clips via the `ui-demo` skill, or your OBS/Clipchamp capture); you add voice (phone mic is fine) and end-card; edit in Clipchamp or CapCut; captions mandatory (most watches are muted).

## Phase 3 — Post (19 Nov, you; I draft)

- Post the same vertical cut on **Instagram Reels, X, YouTube Shorts**; caption drafted by me (no hype words, link, #DeployWithEmbarko).
- One LinkedIn action on the sponsor's challenge post (+2 comment / +3 repost, claimed in "My points") if you choose — only if it's honest and you actually read it.
- Share your referral link with real friends/classmates (bonus points are for people who genuinely register — no bought signups; that breaches the rules).
- Keep everything public; screenshot the post URLs + the live app URL.

## Phase 4 — Submit (19 Nov, before the leaderboard opens 20 Nov)

https://embarko.ai/challenge#submit — paste app link + every post link, tick the three readiness boxes, submit. Only submitted entries count. Resubmission replaces, so submit last with all links final.

## Phase 5 — Hold until results (20 Nov +)

- App stays live; posts stay public; respond to any sponsor email within 7 days with proof of student status if contacted.
- If listed: celebrate, but the prize ships with proof requirements at the sponsor's discretion (US $600+ → tax form).

## Suggested timeline

| Date | Work |
|---|---|
| Sun 15 Nov (today) | Phase 0 register · Phase 1 starts: I read the landing/360px state; you schedule the phone pass |
| Mon 16 Nov | Phone pass → fixes → polish pass → green build → redeploy + live re-verify |
| Tue 17 Nov | Video script final; tour capture; voice-over record |
| Wed 18 Nov | Edit, honesty pre-check, captions; dry-run against the 6-part checklist |
| Thu 19 Nov | Post on all platforms → submit once → save confirmation |
| Fri 20 Nov | Leaderboard opens; nothing more to do but keep it live/public |

## What this wins and what it can't

Realistic upside: top-half finish on Work (originality is our strongest axis) if polish + phone pass land; Video score hinges on your voice and the 40-s cut. It cannot win on "how the app looks" against glossy single-purpose entries unless Phase 1 lands. If the phone pass fails badly and can't be fixed in a day, say so and we reassess — entering with a broken phone experience is worse than a tighter story.

Owner map: **You** — registration, phone test, voice/edit, posts, submission. **Me** — polish pass, fixes, verification, redeploy, video script/capture assets, caption drafts, docs. **Never automated** — posting, registering, submitting on your behalf (personal account actions; I draft, you press).
