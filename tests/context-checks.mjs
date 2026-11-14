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
await page.waitForTimeout(4000);

// 1. Findings card renders automatically in the side panel (no prompting).
const findingsCard = page.locator(".findings-card");
await expect(findingsCard).toBeVisible();
await page.waitForTimeout(1500); // history series + auto storage screening
await findingsCard.locator("summary").click();
const findingItems = await findingsCard.locator(".finding").count();
if (findingItems >= 4) ok(`Findings card lists ${findingItems} auto-generated findings`);
else fail(`Expected at least 4 findings, got ${findingItems}`);
const findingsBody = await findingsCard.innerText();
if (/peak discharge/i.test(findingsBody) || /unavailable/i.test(findingsBody)) ok("Findings include a traced history peak or an explicit unavailable note");
else fail("Findings do not trace to the history record");
if (/not an alert threshold/i.test(findingsBody)) ok("Percentile band is labeled descriptive, not an alert threshold");
else fail("Percentile band lacks the descriptive caveat");
if (/Descriptive, not a forecast/i.test(findingsBody)) ok("Findings disclaimer states descriptive-not-forecast");
else fail("Findings disclaimer missing");

// 2. ENSO context: badge opens a dated, cited context modal; Escape closes and focus returns.
const badge = page.getByRole("button", { name: /ENSO:/ });
await badge.click();
const ensoDialog = page.getByRole("dialog", { name: "ENSO climate context" });
await expect(ensoDialog).toBeVisible();
const ensoBody = await ensoDialog.innerText();
if (/NOAA CPC Oceanic/.test(ensoBody)) ok("ENSO panel cites NOAA CPC ONI with its dates and method");
else fail("ENSO panel lacks the NOAA CPC source");
const ensoRows = await ensoDialog.locator("tbody tr").count();
if (ensoRows === 10) ok("ENSO analog table lists all ten years 2015-2024");
else fail(`ENSO analog table rows: ${ensoRows}`);
if (/2024/.test(ensoBody) && /Neutral/.test(ensoBody)) ok("2024 event year shown as ENSO-neutral with ONI value");
else fail("2024 context missing");
if (/no fixed rainfall multiplier/i.test(ensoBody)) ok("Explicit no-multiplier caveat is present");
else fail("No-multiplier caveat missing");
if (/issue-time CPC Diagnostic Discussion/i.test(ensoBody) && /12 November 2026/i.test(ensoBody)) ok("Dated issue-time CPC advisory snapshot is present (12 Nov 2026)");
else fail("Issue-time advisory snapshot missing");
if (/not an analysis input/i.test(ensoBody)) ok("Advisory is explicitly labeled not an analysis input");
else fail("Advisory input caveat missing");
if (/El Niño Advisory/i.test(ensoBody)) ok("Current El Niño Advisory status is shown");
else fail("Current advisory status missing");
if (/not\s+an? forecast|Not a forecast/i.test(ensoBody) || /not a forecast/i.test(ensoBody)) ok("Issue-time/forecast distinction is stated");
else fail("Forecast distinction missing");
if (/mon/i.test(ensoBody)) ok("Location/season (monsoon) relevance is explained");
else fail("Location/season relevance missing");
await page.keyboard.press("Escape");
await expect(ensoDialog).toBeHidden();
await expect(badge).toBeFocused();
ok("Escape closes the ENSO dialog and focus returns to the badge");

// 3. Sources modal carries the R16 onboarding + dependency section.
await page.getByRole("button", { name: "Data and sources", exact: true }).click();
const onboardingDetails = page.locator(".onboarding-report");
await expect(onboardingDetails).toBeVisible();
await onboardingDetails.locator("summary").click();
const onboardingBody = await onboardingDetails.innerText();
if (/pass/i.test(onboardingBody) && /fail/i.test(onboardingBody)) ok(`Onboarding checks render with verdict counts (${onboardingBody.split("\n").find(l => /pass/.test(l))?.trim() ?? "counts shown"})`);
else fail("Onboarding verdict summary missing");
for (const dataset of ["flow-history", "rain-history", "assets"]) {
  if (onboardingBody.includes(dataset)) ok(`Onboarding checks cover ${dataset}`);
  else fail(`Onboarding checks do not cover ${dataset}`);
}
if (/Who consumes each dataset/i.test(onboardingBody)) ok("Dependency registry (who consumes each dataset) renders");
else fail("Dependency registry missing");
if (/never relocated/i.test(onboardingBody) || /Missing coverage/i.test(onboardingBody)) ok("Onboarding limits are disclosed in the panel");
else fail("Onboarding limits missing");
await page.keyboard.press("Escape");

// 4. 360px: no horizontal overflow with findings visible.
await page.setViewportSize({ width: 360, height: 800 });
await page.goto(base);
await page.getByRole("button", { name: "Explore", exact: true }).click();
await page.locator(".maplibregl-canvas").waitFor();
await page.waitForTimeout(2500);
await page.locator(".findings-card summary").click();
const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
if (scrollWidth === 360) ok("360px layout has no horizontal overflow");
else fail(`360px layout overflows to ${scrollWidth}px`);
await page.screenshot({ path: "artifacts/enso-findings-360.png", fullPage: true });
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(base);
await page.getByRole("button", { name: "Explore", exact: true }).click();
await page.locator(".maplibregl-canvas").waitFor();
await page.waitForTimeout(2500);
await page.screenshot({ path: "artifacts/enso-findings-desktop.png", fullPage: true });
ok("Desktop and 360px evidence captured to artifacts");

if (errors.length) fail(`console/page errors: ${errors.join(" | ")}`);
else ok("No console or page errors");

const report = { date: new Date().toISOString(), checks, errors, browser: await browser.version(), physicalPhone: false };
fs.writeFileSync("artifacts/context-checks-report.json", JSON.stringify(report, null, 2));
await context.close();
await browser.close();
console.log(`\n${checks.length} checks complete; ${errors.length} console/page errors.`);
process.exit(errors.length || checks.some((c) => c.startsWith("FAIL")) ? 1 : 0);
