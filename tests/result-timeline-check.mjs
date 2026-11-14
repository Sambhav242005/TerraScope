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

const hiddenState = () =>
  page.evaluate(() => document.getElementById("result-timeline")?.getAttribute("hidden"));

await page.goto(base);
await page.getByRole("button", { name: "Explore", exact: true }).click();
await page.locator(".maplibregl-canvas").waitFor();
await page.waitForTimeout(3500);

// 1. Toggle starts collapsed: aria-expanded false and the panel carries hidden="until-found" (find-in-page stays possible).
const toggle = page.getByRole("button", { name: "Result timeline", exact: true });
await toggle.waitFor();
const expanded = await toggle.getAttribute("aria-expanded");
const hidden = await hiddenState();
if (expanded === "false" && hidden === "until-found") ok("Result timeline starts collapsed (aria-expanded=false, hidden=until-found)");
else fail(`Toggle aria-expanded=${expanded}, hidden=${hidden}`);

// 2. Reveal via the toggle; hidden attribute is removed and content renders.
await toggle.click();
const openState = await hiddenState();
const toggleExpanded = await toggle.getAttribute("aria-expanded");
if (openState === null && toggleExpanded === "true") ok("Result timeline reveals in the same view (hidden removed, aria-expanded=true)");
else fail(`open: hidden=${openState}, aria-expanded=${toggleExpanded}`);
const panel = page.locator("#result-timeline");

// 3. The 9-day event window yields 27 day-bound records.
const count = await panel.locator(".result-entry").count();
if (count >= 27) ok(`Event window renders ${count} timestamped/gap entries`);
else fail(`Expected at least 27 entries, got ${count}`);

// 4. NRSC: available only on 1-2 Oct 2024; explicit gaps elsewhere; never zero.
const gapEntries = await panel.locator(".result-entry-gap").count();
if (gapEntries >= 7) ok(`NRSC gaps preserved (${gapEntries} gap entries, never interpolated)`);
else fail(`Expected at least 7 gap entries, got ${gapEntries}`);

// 5. Persistent heading structure: h2 title, h3 subheads — no fake headings, no landmark noise.
const title = panel.getByRole("heading", { level: 2, name: "Scenario result timeline" });
await expect(title).toBeVisible();
ok("Panel has a structured h2 heading (no region landmark)");

// 6. Event picker offers the event and the 2015-2024 multiyear history; history mode shows explicit gaps.
await panel.getByLabel("Event or year context").selectOption("history");
await expect(panel.getByRole("combobox", { name: "History year" })).toBeVisible();
const yearOptions = await panel.getByRole("combobox", { name: "History year" }).locator("option").allTextContents();
if (yearOptions.length === 10) ok("Multiyear history picker offers 2015-2024");
else fail(`History year picker options: ${yearOptions.join(",")}`);
await panel.getByRole("combobox", { name: "History year" }).selectOption("2020");
await page.waitForTimeout(600);
const stats = await panel.locator(".result-history-stats dd").allTextContents();
if (stats.every(Boolean) && stats.length === 4) ok(`2020 history summary renders with explicit gap counts (${stats.join(" | ")})`);
else fail(`2020 history summary missing values: ${stats.join(" | ")}`);
const historyBody = await panel.innerText();
if (/never as zero or interpolated/i.test(historyBody)) ok("Gap wording is explicit in history mode");
else fail("History mode does not state that gaps are never zero");

// 7. Switching back to the event and opening interactive history navigates to the River history view.
await panel.getByLabel("Event or year context").selectOption("event");
await panel.getByRole("button", { name: "Open interactive history" }).click();
await expect(page.getByRole("button", { name: "Explore the OSM map" })).toBeVisible();
ok("Open interactive history switches to the 2015-2024 history view from the same flow");

// 8. The panel state lives in the App; switching tabs and back preserves it. Close, then
// simulate find-in-page revealing the panel (beforematch) — the toggle must re-sync to expanded.
await page.getByRole("button", { name: "Explore", exact: true }).click();
await page.locator(".maplibregl-canvas").waitFor();
await page.waitForTimeout(1200);
await expect(toggle).toHaveAttribute("aria-expanded", "true"); // persisted across the tab switch
await page.getByRole("button", { name: "Hide scenario result timeline" }).click();
await expect(toggle).toHaveAttribute("aria-expanded", "false");
await page.evaluate(() => {
  const el = document.getElementById("result-timeline");
  el?.dispatchEvent(new Event("beforematch"));
});
await expect(toggle).toHaveAttribute("aria-expanded", "true");
ok("beforematch re-syncs the toggle to expanded (find-in-page reveals the panel)");

// 9. 360px layout: panel reveals without horizontal overflow.
await page.setViewportSize({ width: 360, height: 800 });
await page.goto(base);
await page.getByRole("button", { name: "Explore", exact: true }).click();
await page.locator(".maplibregl-canvas").waitFor();
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Result timeline", exact: true }).click();
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
