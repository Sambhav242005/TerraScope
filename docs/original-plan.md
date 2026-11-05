> HISTORICAL USER BRIEF: The original game plan below is preserved unchanged after this notice. It is superseded by the environmental scenario and flood-preparedness direction in ../PROJECT.md and ../TODO.md. Historical dates and implementation claims must not be treated as current requirements.

# Project Plan: Evolution Detective

Recommended for Embarko

Version 1.0

# ECHOES OF EXTINCTION

Every extinction leaves evidence. Can you uncover the truth—and change the past?

[Movie Hidden World Movies That Quietly Rewired Our Reality](https://images.openai.com/static-rsc-4/w9ZcEFE-AlOp8IxJaz6mqz-jg4TNGnRlLsseyGPLBQg-NqOXY4qAUq-8x_iwXJVgaK45-vV_EFwKuJclutlfMxTaHO_fFUB4lR5HDN7Fpoz62-rPSq_ZQeItCwlhy6Yg6Uthw3SzWiYqaPPv5m12dmrlHSPbv0xZDEGf3psp0lE?purpose=inline)

[La Formazione dei Fossili e il Processo di Fossilizzazione | Algor Cards](https://images.openai.com/static-rsc-4/JDK07haQbj_9vlf6kCyzScAC5_QPtHhd7MQ4-bIC8nu_gqR8AD1Qq1ObdKhyRgg6jZFQzseB3FGOuyEn29HQqDB-WgvvqhOWroukCv26ifSfAFDjG724wyQZDdJpaAou1_zVvzdTwHbc6goOfW1QB_872yjcdPyrNYpw7hV9Xs8?purpose=inline)

[How The Mahabharata Predicted Climate Change & Today’s Natural Disasters - AdikkaChannels](https://images.openai.com/static-rsc-4/FPH9IlTzKTo3piXYVqLftgyTpKSpqOgSbHj2ByXxm3D0H_9LMWmAUlPeGA8L-_R5LG13JyuPccOu0yKFhZXoJj5yaES459SDHaPaG0HEIVt73e_Z5JttbPIj6kr4HDTt4PsYlv00Wgim2vzAz-_OiaiEpr_iPyDrKtDjVmjWN3o?purpose=inline)

12

Visual inspiration for the game's world, fossil investigation and environmental changes.

We're going to build an interactive ecological detective game where players investigate why a fictional species went extinct, use scientific evidence to identify the cause, and travel back in time to see whether they can prevent it.

Unlike ordinary ecosystem simulators, the main experience is solving a mystery through causal experimentation.

## 1. Project scope and target

Development target

# 5–7 days

Solo build with AI coding tools

Ideal playtime

# 3–5 min

One complete investigation

Initial cases

# 1 polished

Expand only after it works

Runtime cost

# No API

Client-side simulation

This matches Embarko's actual evaluation priorities: originality, website appearance, mobile compatibility and video storytelling.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://embarko.ai\&sz=32)

Student Challenge · Embarko



## 2. The core gameplay

Player journey

Discover an extinct species

See a mysterious abandoned ecosystem

Investigate evidence

Examine fossils, climate logs and food-web clues

Form a hypothesis

Choose the likely cause of extinction

Rewind and intervene

Change one factor and simulate an alternative history

Compare timelines and deliver your verdict

Find out whether your evidence and intervention were correct

The critical feature is that the player must actually investigate. We shouldn't reveal the extinction cause immediately or let the player press one button to rescue everything.

## 3. The first playable mystery

## Case 001 — The Last Glasswing

[Five Stars Illustrious 9.0 - AIxFun eStudio's Ko-fi Shop](https://images.openai.com/static-rsc-4/IIucyJQBQ4Nf3_z7qf5vFjYT8ZpXzQiH5xvCPFgj2eIp4Ef-Cj82gtxV2FUyIiOn1xOUBinUQc8-NipPAXPNMLEnqrRwunLKt0EqKDBfGrD4hFWT6M4H8wE37ZjGgX6sh04opBpyMtC0xy17BDW4psDbnV_mu_ImqwKNwch_aWY?purpose=inline)

Species: Glasswing

Habitat: Moonveil Valley

Status: Extinct

Mystery: The Glasswing population disappeared after generations of living in a thriving forest. Fossils reveal signs of starvation, but predator activity was also observed nearby.

### The actual cause

A prolonged drought reduced water availability. Native plants declined, cutting off the Glasswing's primary food supply. Starvation drove the population to extinction.

Predators are deliberately presented as a plausible but misleading explanation.

Evidence the player can discover

| Rainfall records    | Show decreasing rainfall before population collapse                 |
| ------------------- | ------------------------------------------------------------------- |
| Ancient pollen      | Indicates a decline in edible vegetation                            |
| Glasswing fossils   | Show nutritional stress preceding extinction                        |
| Predator tracks     | Suggest predators were present, but not that they caused extinction |
| Population timeline | Reveals the sequence of plant loss and population decline           |

The player can then test three interventions: restore freshwater, remove predators, or provide emergency food.

The simulation should show that restoring freshwater permits vegetation and Glasswings to recover, predator removal does little to resolve the food crisis, and feeding can delay extinction without fixing the underlying ecosystem.

That creates a genuine scientific mystery with a satisfying reveal, rather than a scripted animation disguised as a simulation.

## 4. Website design and visual experience

The visual direction should feel like a blend of an ancient natural-history museum, a fantasy exploration game, and an interactive scientific laboratory.

ARCHIVE 001

The Last Glasswing

Investigate a vanished species

Begin investigation

Landing / case selection

MOONVEIL VALLEY

Evidence found: 2/5

Year 18

Interactive world explorer

Conceptual UI mockups. The finished application will include animated terrain, species and timeline interactions.

The primary sections will be a cinematic landing page, world explorer, evidence journal, hypothesis lab, timeline simulator and final verdict screen.

Mobile first: On desktop, the world sits in the center with side panels. On mobile, the world fills the top half of the screen while evidence, charts and controls appear as touch-friendly bottom sheets.

## 5. Technical architecture

A full backend is unnecessary. Embarko officially supports Vite/React static applications, so we can run the entire game in the browser.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://embarko.ai\&sz=32)

Embarko



| Layer       | Technology            | Responsibility                           |
| ----------- | --------------------- | ---------------------------------------- |
| UI          | React + TypeScript    | All screens and interactions             |
| Styling     | Tailwind CSS + Motion | Responsive design, transitions           |
| World       | HTML Canvas 2D        | Terrain, weather, vegetation, creatures  |
| Simulation  | TypeScript engine     | Ecological changes and interventions     |
| Charts      | Recharts or SVG       | Populations and climate history          |
| State       | Zustand               | Game progress and investigation          |
| Persistence | localStorage          | Continue case and save outcomes          |
| Hosting     | Embarko               | Deploy the static application            |
| Tests       | Vitest + Playwright   | Simulation correctness and mobile checks |

### Simulation design

Instead of simulating millions of individual organisms, use a lightweight population model with five main variables:

Rainfall and temperature

Available freshwater

Vegetation / food supply

Glasswing births and deaths

Population and extinction risk

Predators add separate mortality pressure, allowing players to test whether predation or food shortage was the main driver.

Each simulated year updates these variables using deterministic, bounded equations.

The important engineering rule is that the past and alternative future must use the same initial conditions and random seed. Only the selected intervention should change. This allows a meaningful comparison of what happened and what might have happened.

For the first case, author the drought event and its evidence deliberately. Don't procedurally generate the mystery until the simulation has been tested for logical consistency.

### Suggested project structure

```
echoes-of-extinction/
├── src/
│   ├── components/
│   │   ├── WorldCanvas.tsx
│   │   ├── EvidenceJournal.tsx
│   │   ├── Timeline.tsx
│   │   ├── HypothesisLab.tsx
│   │   └── VerdictCard.tsx
│   ├── engine/
│   │   ├── ecosystem.ts
│   │   ├── climate.ts
│   │   ├── population.ts
│   │   ├── interventions.ts
│   │   └── seededRandom.ts
│   ├── cases/
│   │   └── glasswing.ts
│   ├── store/
│   │   └── gameStore.ts
│   ├── screens/
│   ├── assets/
│   └── App.tsx
├── tests/
├── README.md
├── SPEC.md
├── TASKS.md
└── package.json
```

## 6. Development milestones

Build tracker

0 of 19 tasks completed

0%

Build the visual foundation

Day 1

Create the React/Vite app and responsive design system

Build landing screen and a beautiful static Moonveil Valley

Add animated atmosphere, environmental details and an introductory scene

Done when: The landing screen looks convincing on desktop and mobile.

Create the simulation

Day 2

Implement deterministic climate, vegetation and population equations

Create the drought scenario and three counterfactual interventions

Build a simulation playback controller and population charts

Done when: Baseline becomes extinct; freshwater rescue succeeds; removing predators alone does not.

Implement detective gameplay

Day 3

Build five discoverable evidence items and an evidence journal

Add three hypotheses with a required evidence selection

Connect observations and evidence to simulation history

Done when: A player can investigate and make a reasoned hypothesis without knowing the answer beforehand.

Rewind and compare

Day 4

Build historical timeline and rewind transition

Let users apply interventions and run the alternative timeline

Build side-by-side comparison and final verdict

Done when: A complete playable mystery works from landing to ending.

Polish and test

Day 5

Improve creature animation, weather and environmental transitions

Optimize for touch screens, low-power phones and reduced motion

Add progress saving, replay and shareable result card

Done when: Someone unfamiliar with the project can complete it in under five minutes.

Deploy and create the submission

Days 6–7

Run automated tests and complete manual mobile checks

Deploy using Embarko's official prompt and keep the site live

Record, edit and publish the demonstration video

Submit website and public video links

Done when: Public website and video are accessible and the competition entry is submitted.

&#x20;Copy task checklist

## 7. Testing and acceptance criteria

Before deployment, the project must pass a few important tests.

| Test                   | Expected outcome                              |
| ---------------------- | --------------------------------------------- |
| Same case + same seed  | Identical simulation history                  |
| No intervention        | Glasswing becomes extinct                     |
| Freshwater restoration | Population survives and recovers              |
| Predator removal only  | Food crisis remains unresolved                |
| Rewind and rerun       | No state corruption                           |
| 360px-wide display     | UI remains usable without horizontal overflow |
| Refresh page           | Progress can be restored                      |
| Complete mystery       | Playable without sign-up or API key           |

The first three outcome tests are especially important. If an alternative timeline has no real relationship with the simulation, the game's central mechanic becomes misleading.

## 8. What to postpone

For version 1.0, skip real-time LLM conversations, generated DNA sequences, neural-network creature brains, multiplayer, 3D terrain, user accounts, multiple large biomes and dozens of species.

Those features would increase development time without necessarily making the competition experience more compelling.

After submission, the best expansion would be a procedural Case Generator that selects a cause, runs a validated ecosystem history, derives clues from its simulation, and creates a solvable investigation. That could become a genuinely interesting long-term AI/game research project.

## 9. Submission and promotional strategy

I would aim to publish the first playable version by 8 November 2026 and use additional days for bug fixes and social posts.

There is a discrepancy in the official dates: Embarko's website lists 30 November for registration, while the Unstop listing lists 21 November. The leaderboard dates also differ. Register early through both platforms using the same details rather than depending on the later date.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://embarko.ai\&sz=32)

Student Challenge · Embarko+1



For the video, focus on this story:

> A species vanished. Everyone blamed the predators. But when I reconstructed its world and changed one environmental factor, I discovered a different explanation—and an alternative future.

Then demonstrate the actual game, show the Embarko deployment process and end with the public URL and `#DeployWithEmbarko`.

The final submission needs the live website and public video links. Embarko also advises keeping a temporary deployment so it doesn't disappear after 24 hours.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://embarko.ai\&sz=32)

Student Challenge · Embarko+1



## Final build decision

Build one beautiful mystery instead of a huge ecosystem sandbox. Make the simulation scientifically coherent within its simplified rules, give the player five meaningful clues, and make the timeline comparison the unforgettable visual moment.

The most important milestone is Day 4: a player can discover a species, gather evidence, make a hypothesis, change the past, and see a different outcome. Everything after that is polish, accessibility and submission preparation.