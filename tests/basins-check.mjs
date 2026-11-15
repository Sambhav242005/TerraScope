import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const base = process.env.DEMO_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
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
const fail = (s) => {
  checks.push(s);
  console.log("FAIL", s);
};

await page.goto(base);
await page.getByRole("button", { name: "Explore", exact: true }).click();
await page.locator(".maplibregl-canvas").waitFor();
// Water fetch is network-bound; wait for the automatic screening to finish (up to 90 s).
await page.locator(".storage-row").first().waitFor({ timeout: 90000 });

// 1. The Sub-basins toggle lives in Map layers and flips aria-checked.
await page.getByRole("button", { name: "Map layers", exact: true }).click();
const basinToggle = page.getByRole("switch", { name: "Sub-basins (HydroBASINS)" });
await expect(basinToggle).toBeVisible();
const before = await basinToggle.getAttribute("aria-checked");
await basinToggle.click();
const after = await basinToggle.getAttribute("aria-checked");
if (before === "false" && after === "true") ok("Sub-basins layer toggle switches on (aria-checked false→true)");
else fail(`Sub-basins toggle ${before}→${after}`);
await page.keyboard.press("Escape");

// 2. A candidate's detail carries the sub-basin context line.
const row = page.locator(".storage-row").first();
await row.waitFor({ timeout: 30000 });
await row.click();
const catchment = page.locator(".candidate-catchment").first();
const catchmentText = await catchment.innerText().catch(() => "");
if (/Sub-basin \d+/.test(catchmentText) && /upstream area/.test(catchmentText)) ok(`Candidate detail shows sub-basin context (${catchmentText.split("·")[0].trim()})`);
else if (/outside the HydroBASINS/.test(catchmentText)) ok("Candidate detail reports the candidate as outside the HydroBASINS context window");
else fail(`Candidate detail lacks the sub-basin line: "${catchmentText.slice(0, 120)}"`);
await page.screenshot({ path: "artifacts/basins-desktop.png", fullPage: true });

// 3. 360px layout: no horizontal overflow with the toggle visible.
await page.setViewportSize({ width: 360, height: 800 });
await page.goto(base);
await page.getByRole("button", { name: "Explore", exact: true }).click();
await page.locator(".maplibregl-canvas").waitFor();
await page.waitForTimeout(2500);
const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
if (scrollWidth === 360) ok("360px layout has no horizontal overflow");
else fail(`360px layout overflows to ${scrollWidth}px`);
await page.screenshot({ path: "artifacts/basins-360.png", fullPage: true });

if (errors.length) fail(`console/page errors: ${errors.join(" | ")}`);
else ok("No console or page errors");

const report = { date: new Date().toISOString(), checks, errors, browser: await browser.version(), physicalPhone: false };
fs.writeFileSync("artifacts/basins-report.json", JSON.stringify(report, null, 2));
await context.close();
await browser.close();
console.log(`\n${checks.length} checks complete; ${errors.length} console/page errors.`);
process.exit(errors.length || checks.some((c) => c.startsWith("FAIL")) ? 1 : 0);
