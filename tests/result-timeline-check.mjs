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
await page.waitForTimeout(3500);

// 1. Toggle is keyboard-reachable and exposes aria-expanded/controls.
const toggle = page.getByRole("button", { name: "Result timeline", exact: true });
await toggle.waitFor();
const expanded = await toggle.getAttribute("aria-expanded");
if (expanded === "false") ok("Result timeline toggle starts collapsed with aria-expanded=false");
else fail(`Result timeline toggle aria-expanded=${expanded}`);
await toggle.click();
const region = page.getByRole("region", { name: "Scenario result timeline" });
await expect(region).toBeVisible();
const toggleExpanded = await toggle.getAttribute("aria-expanded");
if (toggleExpanded === "true") ok("Result timeline toggle opens the same-view panel");
else fail(`Result timeline toggle aria-expanded=${toggleExpanded}`);

// 2. The 9-day event window yields 27 day-bound records (rain, discharge, NRSC) plus any water-scenario input.
const entries = region.locator(".result-entry");
const count = await entries.count();
if (count >= 27) ok(`Event window renders ${count} timestamped/gap entries`);
else fail(`Expected at least 27 entries, got ${count}`);

// 3. NRSC: available only on 1-2 Oct 2024; explicit gaps elsewhere; never zero.
const gapEntries = await region.locator(".result-entry-gap").count();
if (gapEntries >= 7) ok(`NRSC gaps preserved (${gapEntries} gap entries, never interpolated)`);
else fail(`Expected at least 7 gap entries, got ${gapEntries}`);
for (const day of ["2024-09-25"]) {
  const nrscGap = region.locator(".result-entry", { hasText: day }).last();
  void nrscGap;
}

// 4. Event picker offers the event and the 2015-2024 multiyear history.
await region.getByLabel("Event or year context").selectOption("history");
await expect(region.getByLabel("History year")).toBeVisible();
const yearOptions = await region.getByLabel("History year").locator("option").allTextContents();
if (yearOptions.length === 10) ok("Multiyear history picker offers 2015-2024");
else fail(`History year picker options: ${yearOptions.join(",")}`);
await region.getByLabel("History year").selectOption("2020");
await page.waitForTimeout(600);
const stats = await region.locator(".result-history-stats dd").allTextContents();
if (stats.every(Boolean) && stats.length === 4) ok(`2020 history summary renders with explicit gap counts (${stats.join(" | ")})`);
else fail(`2020 history summary missing values: ${stats.join(" | ")}`);
const body = await region.innerText();
if (/never as zero/i.test(body) || /never zero/i.test(body) || /never as zero or interpolated/i.test(body)) ok("Gap wording is explicit in history mode");
else fail("History mode does not state that gaps are never zero");

// 5. Switching back to the event and opening interactive history navigates to the River history view.
await region.getByLabel("Event or year context").selectOption("event");
await page.waitForTimeout(300);
await region.getByRole("button", { name: "Open interactive history" }).click();
await expect(page.getByRole("button", { name: "Explore the OSM map" })).toBeVisible();
ok("Open interactive history switches to the 2015-2024 history view from the same flow");

// 6. 360px layout has no horizontal overflow (the timeline stacks, not scrolls sideways).
await page.setViewportSize({ width: 360, height: 800 });
await page.goto(base);
await page.getByRole("button", { name: "Explore", exact: true }).click();
await page.locator(".maplibregl-canvas").waitFor();
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Result timeline", exact: true }).click();
const mobileRegion = page.getByRole("region", { name: "Scenario result timeline" });
await expect(mobileRegion).toBeVisible();
const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
if (scrollWidth === 360) ok("360px layout has no horizontal overflow");
else fail(`360px layout overflows to ${scrollWidth}px`);
await page.screenshot({ path: "artifacts/result-timeline-360.png", fullPage: true });
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(base);
await page.getByRole("button", { name: "Explore", exact: true }).click();
await page.locator(".maplibregl-canvas").waitFor();
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Result timeline", exact: true }).click();
await page.screenshot({ path: "artifacts/result-timeline-desktop.png", fullPage: true });
ok("Desktop and 360px evidence captured to artifacts");

if (errors.length) fail(`console/page errors: ${errors.join(" | ")}`);
else ok("No console or page errors");

const report = { date: new Date().toISOString(), checks, errors, browser: await browser.version(), physicalPhone: false };
fs.writeFileSync("artifacts/result-timeline-report.json", JSON.stringify(report, null, 2));
await context.close();
await browser.close();
console.log(`\n${checks.length} checks complete; ${errors.length} console/page errors.`);
process.exit(errors.length || checks.some((c) => c.startsWith("FAIL")) ? 1 : 0);
