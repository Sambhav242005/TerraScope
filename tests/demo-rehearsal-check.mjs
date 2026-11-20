import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const demoFile = (name) => new URL("../demo/" + name, import.meta.url);
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {
        window.fakeRecognition = this;
        queueMicrotask(() => this.onstart());
      }
      stop() {
        queueMicrotask(() => this.onend());
      }
    };
  });
  await page.goto(demoFile("rehearse.html").href);
  await expect(page.locator("#video-status")).toContainText("1:18");
  await page.locator("#video").evaluate((video) => { video.currentTime = 39; });
  await expect(page.locator("#cue-status")).toContainText("Cue 4 of 8");
  await page.locator("#video").evaluate((video) => { video.currentTime = 0; });
  await expect(page.locator("#cue-status")).toContainText("Cue 1 of 8");
  await page.locator("#transcription summary").click();
  await page.locator("#mic-start").click();
  await expect(page.locator("#mic-status")).toContainText("Listening");
  await page.locator("#play").click();
  await expect(page.locator("#cue-status")).toContainText(/Paused|Finish/i, { timeout: 16000 });

  const finalChunks = [
    "Tera scope", // An unknown phrase must survive verbatim.
    "Terra Scope, Embarco, Gunduck, Sone poor, era five, Glow Fass, D E M.",
    "Sept 28 to second of October.",
    "Check one depression and thirty two sites on the twenty-eighth.",
    "The reading was eight thousand",
    "four hundred ninety point eight zero cubic meters per second.",
    "Another sample was -8490.080 m3/s. Unknown Narayani and we may first check.",
  ];
  await page.evaluate((chunks) => {
    const results = chunks.map((transcript) => Object.assign([{ transcript }], { isFinal: true }));
    results.push(Object.assign([{ transcript: "one more interim thought" }], { isFinal: false }));
    window.fakeRecognition.onresult({ resultIndex: 0, results });
  }, finalChunks);
  const formatted = "Tera scope TerraScope, Embarko, Gandak, Sonepur, ERA5, GLOFAS, DEM. " +
    "28 September to 2 October. Check 1 depression and 32 sites on the 28th. The reading was 8,490.80 m³/s. " +
    "Another sample was -8,490.080 m³/s. Unknown Narayani and we may first check.";
  await expect(page.locator("#final")).toHaveText(formatted);
  await expect(page.locator("#interim")).toHaveText("one more interim thought");
  await expect(page.locator("#cue-status")).toContainText(/Cue 1 of 8/);
  await page.locator("#video").evaluate(async (video) => {
    const restored = new Promise((resolve) => {
      video.addEventListener("seeked", function onSeeked() {
        if (video.currentTime !== 12) return;
        video.removeEventListener("seeked", onSeeked);
        resolve();
      });
    });
    video.currentTime = 39;
    await restored;
  });
  assert.equal(await page.locator("#video").evaluate((video) => video.currentTime), 12);

  const pendingDownload = page.waitForEvent("download");
  await page.locator("#download-transcript").click();
  const download = await pendingDownload;
  assert.equal(await readFile(await download.path(), "utf8"), formatted + "\n");
  await page.locator("#mic-stop").click();
  await expect(page.locator("#final")).toHaveText(formatted);
  await page.locator("#next").click();
  await expect(page.locator("#cue-status")).toContainText("Cue 2 of 8");
  assert.deepEqual(errors, []);

  const native = await browser.newPage({ viewport: { width: 720, height: 405 } });
  const sidecar = await readFile(demoFile("terrascope-submission.vtt"), "utf8");
  await native.route("https://demo.test/**", (route) => {
    const routeName = new URL(route.request().url()).pathname;
    if (routeName === "/captions.vtt") return route.fulfill({ contentType: "text/vtt", body: sidecar });
    if (routeName === "/clean.mp4") {
      return route.fulfill({ path: fileURLToPath(demoFile("terrascope-clean.mp4")), contentType: "video/mp4" });
    }
    return route.fulfill({ contentType: "text/html", body: `
      <style>
        body { margin: 0 }
        video { display: block; width: 720px; height: 405px; object-fit: fill }
        ::cue { background: rgb(255 0 255); color: black }
      </style>
      <video controls muted preload="auto" src="/clean.mp4">
        <track default kind="captions" label="English" srclang="en" src="/captions.vtt">
      </video>`,
    });
  });
  await native.goto("https://demo.test/player");
  await native.waitForFunction(() => document.querySelector("video").readyState >= 2 &&
    document.querySelector("track").track.cues?.length > 0);
  await native.evaluate(async () => {
    const video = document.querySelector("video");
    video.textTracks[0].mode = "showing";
    video.playbackRate = 4;
    await video.play();
  });
  await native.waitForFunction(() => document.querySelector("track").track.activeCues?.[0]?.startTime === 0.439);
  await native.locator("video").evaluate((video) => video.pause());
  const cues = await native.locator("track").evaluate(({ track }) => Array.from(track.cues, (cue) => ({
    start: cue.startTime, end: cue.endTime, line: cue.line,
    text: cue.text, active: track.activeCues[0]?.startTime === cue.startTime,
  })));
  assert.equal(cues.length, 20);
  let lastEnd = 0;
  for (const cue of cues) {
    assert.ok(cue.start >= lastEnd && cue.start < cue.end && cue.end <= 78);
    lastEnd = cue.end;
    assert.equal(cue.line, 73);
    const lines = cue.text.split("\n");
    assert.ok(lines.length <= 2 && lines.every((line) => [...line].length <= 40));
  }
  assert.equal(cues.find((cue) => cue.active)?.text, "TerraScope helps planners\nchoose where to investigate.");
  const screenshot = await native.screenshot({ path: process.env.DEMO_CAPTION_SCREENSHOT });
  const rows = await native.evaluate(async (png) => {
    const img = new Image();
    img.src = "data:image/png;base64," + png;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const context = canvas.getContext("2d");
    context.drawImage(img, 0, 0);
    const { data } = context.getImageData(0, 0, img.width, img.height);
    return Array.from({ length: img.height }, (_, row) => row).filter((row) => {
      for (let col = 0; col < img.width; col++) {
        const pixel = (row * img.width + col) * 4;
        if (data[pixel] > 90 && data[pixel + 1] < 40 && data[pixel + 2] > 90) return true;
      }
      return false;
    });
  }, screenshot.toString("base64"));
  assert.ok(rows.length > 0 && rows.at(-1) <= 405 * 0.85,
    "Native cue box ends within 85% of the frame (caption rows " + rows[0] + "–" + rows.at(-1) + ")");
  console.log("Rehearsal recognition, transcript download, cue hold and native WebVTT checks passed.");
} finally {
  await browser.close();
}
