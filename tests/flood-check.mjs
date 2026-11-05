import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const base = process.env.DEMO_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
  recordVideo: {
    dir: "artifacts/flood-video",
    size: { width: 1280, height: 900 },
  },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const checks = [];
const ok = (s) => {
  checks.push(s);
  console.log("PASS", s);
};
await page.goto(base);
await page.getByRole("button",{name:"Explore",exact:true}).click();
await expect(page.locator(".resource-row")).toHaveCount(9);
await page.waitForTimeout(3500);
await expect(page.locator(".map-warning")).toHaveCount(0);
ok("OSM resources, real datasets and worker-backed map load");
await page.screenshot({
  path: "artifacts/terrascope-desktop.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Inspect data", exact: true }).click();
await expect(page.getByRole("dialog").locator("tbody tr")).toHaveCount(9);
await page.keyboard.press("Escape");
await expect(
  page.getByRole("button", { name: "Inspect data", exact: true }),
).toBeFocused();
ok("Data table and dialog focus return");
await page.getByRole("button", { name: "Play replay", exact: true }).click();
await page.waitForTimeout(1400);
await page.getByRole("button", { name: "Pause replay", exact: true }).click();
const day = await page.getByLabel("Replay day", { exact: true }).inputValue();
await page.waitForTimeout(1400);
expect(await page.getByLabel("Replay day", { exact: true }).inputValue()).toBe(
  day,
);
ok("Replay progresses and pause freezes selected date");
await page.getByRole("button", { name: "Compare", exact: true }).click();
await page.getByLabel("Rainfall multiplier", { exact: true }).fill("1.5");
await page.getByRole("button", { name: "Run comparison", exact: true }).click();
await expect(page.locator(".comparison-result")).toBeVisible();
const peaks = await page.locator(".result-grid strong").allTextContents();
expect(Number(peaks[1])).toBe(Number(peaks[0]));
await page.getByLabel("Storage response time", { exact: true }).fill("12");
await page.getByRole("button", { name: "Run comparison", exact: true }).click();
const changedPeaks = await page.locator(".result-grid strong").allTextContents();
expect(Number(changedPeaks[1])).not.toBe(Number(changedPeaks[0]));
await page.screenshot({
  path: "artifacts/terrascope-compare.png",
  fullPage: true,
});
ok("Scenario changes compute a different peak");
await page.getByRole("button", { name: "Field checks", exact: true }).click();
await page.locator(".resource-row").first().click();
await page
  .getByLabel("Assigned reviewer", { exact: true })
  .fill("Demo reviewer");
await page
  .getByLabel("Observation", { exact: true })
  .fill(
    "Test record only. Facility condition remains unknown; no visit conducted.",
  );
await page.getByRole("button", { name: "Save evidence", exact: true }).click();
await page
  .getByRole("button", { name: "Mark locally reviewed", exact: true })
  .click();
await expect(page.locator(".resource-row").first()).toContainText("Reviewed");
await page.reload();
await page.getByRole("button",{name:"Explore",exact:true}).click();
await expect(page.locator(".resource-row").first()).toContainText("Reviewed");
ok("Local evidence and review status persist through reload");
await page.getByRole("button", { name: "Response plan", exact: true }).click();
await page.getByRole("button", { name: "Generate draft", exact: true }).click();
await expect(
  page.getByLabel("Preparedness draft", { exact: true }),
).toContainText("");
expect(
  await page.getByLabel("Preparedness draft", { exact: true }).inputValue(),
).toContain("Test record only");
await page
  .getByLabel("Preparedness draft", { exact: true })
  .fill("Edited draft — test only");
await page.reload();
await page.getByRole("button",{name:"Explore",exact:true}).click();
await page.getByRole("button", { name: "Response plan", exact: true }).click();
expect(
  await page.getByLabel("Preparedness draft", { exact: true }).inputValue(),
).toBe("Edited draft — test only");
const download = page.waitForEvent("download");
await page.getByRole("button", { name: "Export draft", exact: true }).click();
expect((await download).suggestedFilename()).toBe(
  "terrascope-preparedness-draft.txt",
);
ok("Draft uses recorded evidence, persists edits and exports");
await page.getByRole("button", { name: "Explore", exact: true }).click();
await page
  .getByText("Set review centre by coordinates", { exact: true })
  .click();
await page.getByLabel("Latitude", { exact: true }).fill("25.710");
await page.getByLabel("Longitude", { exact: true }).fill("85.160");
await page.getByRole("button", { name: "Set centre", exact: true }).click();
ok("Coordinate form supports non-map area selection");
await page
  .getByRole("button", { name: "Add resource", exact: true })
  .first()
  .click();
await page
  .getByLabel("Resource name", { exact: true })
  .fill("Test storage point");
await page
  .getByRole("button", { name: "Add at review centre", exact: true })
  .click();
await expect(page.locator(".resource-list")).toContainText(
  "Test storage point",
);
ok("Custom resource can be added without claiming verified status");
await page.evaluate(() => {
  localStorage.clear();
});
await page.reload();
await page.getByRole("button",{name:"Explore",exact:true}).click();
await expect(page.locator(".resource-row")).toHaveCount(9);
await page.setViewportSize({ width: 360, height: 800 });
await page.waitForTimeout(700);
expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
  360,
);
await page.screenshot({
  path: "artifacts/terrascope-mobile.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Compare", exact: true }).click();
await page.getByRole("button", { name: "Run comparison", exact: true }).click();
await expect(page.locator(".comparison-result")).toBeVisible();
ok("360px layout has no horizontal overflow and comparison remains usable");
await page.evaluate(() => localStorage.setItem("terrascope-v1", "{broken"));
await page.reload();
await page.getByRole("button",{name:"Explore",exact:true}).click();
await expect(page.locator(".resource-row")).toHaveCount(9);
ok("Corrupted saved state recovers to defaults");
const fallback = await browser.newPage();
await fallback.addInitScript(() => {
  const old = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    if (String(type).includes("webgl")) return null;
    return old.call(this, type, ...args);
  };
});
await fallback.goto(base);
await fallback.getByRole("button",{name:"Explore",exact:true}).click();
await expect(
  fallback.getByText(
    "3D map unavailable. Use the resource list and data tables.",
  ),
).toBeVisible();
await fallback
  .getByRole("button", { name: "Inspect data", exact: true })
  .click();
await expect(fallback.getByRole("dialog").locator("tbody tr")).toHaveCount(9);
await fallback.close();
ok("Unavailable WebGL retains resource and data access");
const failed = await browser.newPage();
await failed.route("**/data/rainfall.json", (r) =>
  r.fulfill({ status: 503, body: "unavailable" }),
);
await failed.goto(base);
await failed.getByRole("button",{name:"Explore",exact:true}).click();
await expect(failed.locator(".data-error")).toContainText("rainfall");
await failed.getByRole("button", { name: "Compare", exact: true }).click();
await expect(
  failed.getByRole("button", { name: "Run comparison", exact: true }),
).toBeDisabled();
await failed.close();
ok(
  "Missing rainfall disables calculation instead of silently substituting zero",
);
expect(errors).toEqual([]);
ok("No browser console errors or unhandled exceptions in main journey");
fs.writeFileSync(
  "artifacts/flood-browser-report.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      browser: await browser.version(),
      viewport: [1440, 1000],
      mobileEmulation: [360, 800],
      physicalPhone: false,
      checks,
      errors,
    },
    null,
    2,
  ),
);
await context.close();
await browser.close();
