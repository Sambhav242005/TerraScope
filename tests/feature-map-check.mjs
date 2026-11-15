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
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const checks = [];
const ok = (s) => { checks.push(s); console.log("PASS", s); };
const fail = (s) => { checks.push(s); console.log("FAIL", s); };

// 1. Open the Quick guide (where the journey map lives)
await page.goto(base);
await page.getByRole("button", { name: /What am I looking at\? Guide|Quick guide/ }).click();
const guide = page.getByRole("dialog", { name: /Understanding TerraScope/i }).or(page.locator(".guide-modal, .modal").filter({ hasText: "Understanding TerraScope" }));
await page.waitForTimeout(600);
const bodyText = await page.locator("body").innerText();

// 2. Journey block present with all six questions
const journeys = [
  "What did late September 2024 look like?",
  "Where could water be stored naturally?",
  "What would flood here?",
  "Where do I plan things?",
  "Who decides?",
  "How sure are we?",
];
for (const q of journeys) {
  if (bodyText.includes(q)) ok(`Journey present: "${q.slice(0, 44)}…"`);
  else fail(`Journey missing: "${q}"`);
}

// 3. Honest tags present
for (const tag of ["NRSC observed maps are withheld", "no flood-extent layer", "The app never sends, posts or authorises", "13 remain open"]) {
  if (bodyText.includes(tag)) ok(`Honest tag present: "${tag.slice(0, 40)}"`);
  else fail(`Honest tag missing: "${tag}"`);
}

// 4. The two overclaim corrections are in place
if (!bodyText.includes("protecting downstream settlements")) ok("Overclaim corrected: no unproven benefit claim");
else fail("Still contains 'protecting downstream settlements'");
if (!bodyText.includes("would be submerged")) ok("Overclaim corrected: slider described as illustrative mask");
else fail("Still contains 'would be submerged'");

// 5. Screenshots
await page.setViewportSize({ width: 1440, height: 1100 });
await page.screenshot({ path: "artifacts/feature-map-desktop.png", fullPage: true });
await page.setViewportSize({ width: 360, height: 800 });
await page.waitForTimeout(300);
const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
if (scrollWidth === 360) ok("360px layout has no horizontal overflow with the guide open");
else fail(`360px layout overflows to ${scrollWidth}px`);
await page.screenshot({ path: "artifacts/feature-map-360.png", fullPage: true });

if (errors.length) fail(`console/page errors: ${errors.join(" | ")}`);
else ok("No console or page errors");

const report = { date: new Date().toISOString(), checks, errors, browser: await browser.version(), physicalPhone: false };
fs.writeFileSync("artifacts/feature-map-report.json", JSON.stringify(report, null, 2));
await context.close();
await browser.close();
console.log(`\n${checks.length} checks complete; ${errors.length} console/page errors.`);
process.exit(errors.length || checks.some((c) => c.startsWith("FAIL")) ? 1 : 0);
