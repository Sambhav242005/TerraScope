import { chromium, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const origin = process.env.DEMO_URL ?? "http://127.0.0.1:5173";
const live = process.env.LIVE_PLANNING === "1";
const auditShots = process.env.AUDIT_SHOTS;
const endpoint = "http://127.0.0.1:11435/v1/chat/completions";
const center = { lat: 25.71, lon: 85.16 };
const candidate = {
  id: "c1", label: "Fixture depression",
  polygon: { outer: [[85.1599, 25.7099], [85.1601, 25.7099], [85.1601, 25.7101], [85.1599, 25.7101], [85.1599, 25.7099]], holes: [] },
  centroid: [center.lon, center.lat], geometricCapacityM3: 120,
  footprintAreaM2: 400, maximumDepthToSpillM: 1, spillElevationM: 48, minimumElevationM: 47,
  availableStorageM3: null, suitability: "unassessed",
  waterEvidence: { status: "none-mapped", overlapCells: 0, overlapAreaM2: 0, features: [] },
};
const run = {
  schema: "terrascope-storage-v1", waterEvidenceVersion: 2, status: "succeeded",
  id: "fixture-run", configHash: "fixture", config: { center },
  candidates: [candidate], candidateCountTotal: 1, limitations: [], water: null,
  finishedAt: "2026-11-17T06:00:00Z",
  provenance: { method: "priority-flood-d8-v1", metersPerPixel: 5, terrainCaveats: [] },
};
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const evidence = JSON.parse(await readFile("public/data/placement-evidence.json", "utf8"));
  await page.route("**/data/placement-evidence.json", route => route.fulfill({ json: { ...evidence, features: [] } }));
  await page.route("https://air-quality-api.open-meteo.com/**", route => route.fulfill({ status: 503 }));
  await page.addInitScript(savedRun => localStorage.setItem("terrascope-storage-v1", JSON.stringify(savedRun)), run);
  let requests = 0;
  page.on("request", request => { if (request.url() === endpoint) requests++; });
  if (!live) {
    await page.route(endpoint, async route => {
      const { messages, model } = route.request().postDataJSON();
      expect(model).toBe("lfm3:1.7b");
      const request = messages.at(-1).content;
      let action;
      if (request !== "ping") {
        const { question, snapshot } = JSON.parse(request);
        const { revision, runId } = snapshot;
        action = { kind: "unavailable", revision };
        if (question.startsWith("Focus")) action = { kind: "focus-candidate", revision, runId, candidateId: candidate.id };
        if (question === "Focus candidate #c1!") action = { kind: "adopt-candidate", revision, runId, candidateId: candidate.id };
        if (question.startsWith("Adopt")) action = { kind: "adopt-candidate", revision, runId, candidateId: candidate.id };
        if (question.startsWith("Remove")) action = { kind: "remove-proposal", revision, proposalId: snapshot.proposalIds[0] };
        if (question.startsWith("Undo")) action = { kind: "undo", revision };
        if (question.startsWith("Show")) action = { kind: "show-evidence", revision, evidenceId: "fsi-isfr-2023" };
      }
      await route.fulfill({ json: { choices: [{ message: { content: action ? JSON.stringify(action) : "ok" } }] } });
    });
  }
  await page.goto(origin);
  await page.getByRole("button", { name: /Ask the map/ }).click();
  const desk = page.getByRole("dialog", { name: /Ask the map/ });
  await expect(desk).toBeVisible();
  await expect(desk.locator(".desk-status")).toContainText("not connected");
  expect(requests).toBe(0);
  const settings = desk.getByText("Model connection", { exact: true });
  await settings.click();
  await expect(desk.getByLabel("Local model base URL")).toHaveValue("http://127.0.0.1:11435");
  await desk.getByRole("button", { name: "Check connection" }).click();
  await expect(desk.locator(".desk-status")).toContainText("Local model connected", { timeout: 12_000 });
  await settings.click();

  const input = desk.getByRole("textbox", { name: "Ask the map a question" });
  const propose = desk.getByRole("button", { name: "Propose map action" });
  const apply = desk.getByRole("button", { name: "Apply map action" });
  const status = desk.locator(".desk-planning [role=status]");
  const pins = page.locator(".intervention-pin.storage_basin");
  const proposals = () => page.evaluate(() => JSON.parse(localStorage.getItem("terrascope-v1")).interventions);
  async function request(question) {
    await input.fill(question);
    await propose.click();
  }
  async function preview(question, description) {
    await request(question);
    await expect(desk.locator(".desk-planning")).toContainText(description, { timeout: 17_000 });
    await expect(apply).toBeEnabled();
  }

  await preview("Focus candidate c1.", "Focus storage candidate #c1");
  await apply.click();
  await expect(status).toHaveText("Focused storage candidate #c1.");
  await expect(page.getByRole("button", { name: "Close candidate details" })).toBeVisible();

  await preview("Adopt candidate c1.", "Add a planned basin for candidate #c1");
  if (auditShots) await page.screenshot({ path: `${auditShots}/1440-planning-confirmation.png` });
  expect(await proposals()).toEqual([]);
  await apply.click();
  await expect(status).toHaveText("Added planned storage basin for candidate #c1.");
  await expect(pins).toHaveCount(1);
  expect(await proposals()).toMatchObject([{ sourceCandidateId: candidate.id, status: "proposed" }]);

  await preview("Adopt candidate c1.", "Add a planned basin for candidate #c1");
  await apply.click();
  await expect(status).toContainText("Screening footprint intersects");
  await expect(pins).toHaveCount(1);
  if (auditShots) await page.screenshot({ path: `${auditShots}/1440-planning-conflict.png` });

  await preview("Undo the last placement.", "Undo last placement");
  await apply.click();
  await expect(status).toHaveText("Undid the last placement.");
  await expect(pins).toHaveCount(0);
  expect(await proposals()).toEqual([]);

  await preview("Adopt candidate c1.", "Add a planned basin for candidate #c1");
  await apply.click();
  await expect(pins).toHaveCount(1);
  const [{ id }] = await proposals();
  await preview(`Remove proposal ${id}.`, `Remove proposal ${id}`);
  await desk.getByRole("button", { name: "Close the decision workspace" }).click();
  await page.getByRole("slider", { name: "Replay day" }).press("ArrowRight");
  await page.getByRole("button", { name: /Ask the map/ }).click();
  await expect(status).toContainText("The workspace changed");
  await expect(apply).toBeDisabled();
  expect(await proposals()).toHaveLength(1);

  await preview(`Remove proposal ${id}.`, `Remove proposal ${id}`);
  await apply.click();
  await expect(status).toHaveText("Removed the proposal.");
  await expect(pins).toHaveCount(0);

  await preview("Show evidence fsi-isfr-2023.", "Open evidence fsi-isfr-2023");
  await apply.click();
  await expect(status).toHaveText("Opened the selected evidence.");
  await expect(page.locator(".area-review-source[open] summary")).toContainText("Bihar forest survey");

  if (!live) {
    await request("Focus candidate #c1!");
    await expect(status).toHaveText("The proposed action did not match your request.");
    await expect(apply).toHaveCount(0);
  }
  const beforeUnsupported = requests;
  await request("Find a safe wildlife route from this area.");
  await expect(status).toContainText("Unsupported action", { timeout: 17_000 });
  await expect(apply).toHaveCount(0);
  expect(await proposals()).toEqual([]);
  expect(requests).toBe(beforeUnsupported);

  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  expect(errors).toEqual([]);
  console.log(`PASS: checked map action journey with ${live ? "live lfm3:1.7b" : "fixture model responses"} (${requests} requests).`);
} finally {
  await browser.close();
}
