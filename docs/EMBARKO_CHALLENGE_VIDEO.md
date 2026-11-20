# TerraScope challenge video

**[Play or download the standalone narrated film](../demo/terrascope-submission.mp4).** This 78-second edition includes its own English narration and on-screen captions. It plays directly in a video player. [Timed transcript for this edition](../demo/terrascope-submission.vtt).

## Current MP film

The current cut follows Seondha in Madhya Pradesh. OpenStreetMap identifies Seondha as a town and maps the nearby Sindh River. The film searches for the town, shows automatic September 2024 rainfall and nearby modeled-flow downloads, inspects source cells and coverage, advances the daily replay, and opens a terrain candidate and its cross-section. The returned flow cell's river identity remains unverified and is visible in the source panel.

The [current timed script](../demo/script.md), [rehearsal page](../demo/rehearse.html) and [silent footage](../demo/terrascope-clean.mp4) match the new MP cut. The build credit appears over the working map. The last frame shows the public URL and hashtag. Native landscape composition preserves the app navigation and replay controls, with 164 pixels of bottom clearance for the caption band.

`node scripts/record-mp-demo.mjs --rehearse` discovers and checks the live sequence. `node scripts/record-mp-demo.mjs` records it. `python scripts/render-mp-demo.py` composes the raw recording with the generated narration, caption metadata and word alignment in `artifacts/mp-video/` and `artifacts/voice-review/`. The renderer requires those local production inputs. It replaces the narrated MP4, silent MP4, sidecar captions, read-aloud script and rehearsal cues after checking the MP4s.

The earlier Gandak production notes below describe the previous cut.

The 78-second demo follows a planner reviewing the Gandak replay, inspecting a possible storage site near Sonepur and deciding what a field team should measure. The last scene reconstructs the deployment prompt and shows the public URL. Use the [read-aloud script](../demo/script.md) and [timed captions](../demo/terrascope-demo.vtt) for the exact words. The [rehearsal page](../demo/rehearse.html) plays the cut and holds at each cue until the speaker advances.

## Brief for the subtitle and transcription agent

- Use the recorded voice for timing. Break a long cue at a clause or a breath. Allow at most two lines per caption and 40 characters per line, including spaces. Check the burned-in captions and downloadable WebVTT against the same text.
- Use these display forms in captions and recognized narration: **TerraScope**, **Embarko**, **Gandak**, **Sonepur**, **ERA5**, **GLOFAS**, **DEM** and **m³/s**. Preserve original labels within footage and in source citations.
- Display spoken dates and quantities as digits. For example, “September twenty-eighth” becomes “Sept 28”. A flow reading spoken as “eight thousand four hundred ninety point eight cubic metres per second” becomes “8,490.8 m³/s”. A formatting example supplies no measurement for the film. Preserve the speaker’s actual value, sign, precision and units.
- Keep the caption box, including its background and descenders, at least 120 output pixels and 15% of frame height above the bottom edge. Check it against player controls, map attribution and the Embarko mark with controls visible.

## Brief for the recording and composition agent

- Capture the public app at a desktop viewport. Deliver a native 16:9 landscape frame. Scale both axes equally and preserve the full map context, navigation, timeline and attribution. If a later cut needs 9:16, plan separate overview and smoothly framed detail shots.
- Place footage labels in a separate band, starting at least 64 output pixels below the top. Keep the entire navigation bar visible. Reserve another band for subtitles, outside the app view.
- Limit map drawers and review cards to 45% of the viewport height. Allow vertical scrolling and a line height of at least 1.4. Give status labels their own wrapping row. Rehearse the candidate and cross-section shots at the capture viewport and inspect the corresponding app layout at 360 CSS pixels wide.
- Show historical modeled rainfall and flow, then the terrain depression, its geometry and the unknowns that still need a field survey. Use the public app's readings on the selected dates. Label the reconstructed deployment prompt and synthetic preview voice. End with **terrascope-floods.embarko.app** and **#DeployWithEmbarko**.
- Inspect decoded MP4 frames at the replay, candidate card, cross-section and closing URL. Match caption changes to speech. Deliver matching silent footage for a personal voiceover.

## Recreate the cut

Run the following from the repository root on a machine with the project dependencies, desktop Edge, Python, FFmpeg with libass, and ffprobe. The recording opens the public app and waits for real map and candidate data. The renderer reuses the preview voice from the bundled narrated MP4. An isolated narration track with the same timing can be supplied via `--audio`. The edited MP4s go into `demo/`. Intermediate recordings and frame measurements go into `artifacts/challenge-demo/`.

```sh
node scripts/record-challenge-demo.mjs --rehearse
node scripts/record-challenge-demo.mjs
python scripts/render-challenge-demo.py
node tests/demo-rehearsal-check.mjs
```

The original competition outline and social post drafts are available in the [15 November production brief](https://github.com/Sambhav242005/TerraScope/blob/968fe8b9e3686d9af15c849789f96ffdccf7f208/docs/EMBARKO_CHALLENGE_VIDEO.md).
