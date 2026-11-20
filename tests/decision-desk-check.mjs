import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const base = process.env.DEMO_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const checks = [];
const ok = (s) => { checks.push(s); console.log("PASS", s); };
const fail = (s) => { checks.push(s); console.log("FAIL", s); };

await page.goto(base);
await page.getByRole("button", { name: /Ask the map/ }).click();
const desk = page.getByRole("dialog", { name: /Ask the map/ });
await expect(desk).toBeVisible();

// 1. Honest default state
const status = await desk.locator(".desk-status").innerText();
if (/not connected/i.test(status)) ok(`Default state labels local AI as not connected ("${status.trim()}")`);
else fail(`Unexpected status: ${status}`);

// 2. Ask a question; expect grounded answer with citation chip
await desk.getByRole("button", { name: "What's the peak in the local record?" }).click();
await desk.locator(".desk-msg-assistant").last().waitFor();
const msgs = await desk.locator(".desk-msg-assistant").allInnerTexts();
const last = msgs[msgs.length - 1] ?? "";
if (/m³\/s/.test(last) && /deterministic evidence/i.test(last)) ok("Peak question answered with a figure and deterministic-evidence label");
else fail(`Peak answer not grounded/labeled: "${last.slice(0, 160)}"`);

const citations = await desk.locator(".desk-citations li").allInnerTexts();
if (citations.some((c) => c.includes("flow-history"))) ok(`Answer cites its source (${citations.join(", ")})`);
else fail(`No flow-history citation in: ${citations.join(" | ")}`);

// 3. Advisory draft downloads a markdown file; nothing is sent anywhere
const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
await desk.getByText("Download draft documents", { exact: true }).click();
await desk.getByRole("button", { name: /Pre-monsoon advisory draft/ }).click();
const download = await downloadPromise;
if (download.suggestedFilename() === "pre-monsoon-advisory-draft.md") ok("Advisory draft downloads as pre-monsoon-advisory-draft.md (human issues it, not the tool)");
else fail(`Unexpected download ${download.suggestedFilename()}`);
const draftPath = await download.path();
const draft = fs.existsSync(draftPath) ? fs.readFileSync(draftPath, "utf-8") : "";
if (/not an official|authorised officer/i.test(draft)) ok("Draft markdown carries the not-issued / authorised-officer disclaimer");
else fail("Draft markdown missing disclaimers");

// 4. Decision brief downloads too
const briefDownload = page.waitForEvent("download", { timeout: 15000 });
await desk.getByRole("button", { name: /Decision brief draft/ }).click();
const brief = await briefDownload;
if (brief.suggestedFilename() === "decision-brief-draft.md") ok("Decision brief draft downloads as decision-brief-draft.md");
else fail(`Unexpected download ${brief.suggestedFilename()}`);

// 5. Escape closes the panel
await page.keyboard.press("Escape");
await expect(desk).toHaveCount(0);

// 6. 360px layout: no horizontal overflow with the panel open
await page.setViewportSize({ width: 360, height: 800 });
await page.getByRole("button", { name: /Ask the map/ }).click();
await page.waitForTimeout(400);
const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
if (scrollWidth === 360) ok("360px layout has no horizontal overflow with the desk open");
else fail(`360px layout overflows to ${scrollWidth}px`);
await page.screenshot({ path: "artifacts/decision-desk-360.png", fullPage: true });

if (errors.length) fail(`console/page errors: ${errors.join(" | ")}`);
else ok("No console or page errors");

const report = { date: new Date().toISOString(), checks, errors, browser: await browser.version(), physicalPhone: false };
fs.writeFileSync("artifacts/decision-desk-report.json", JSON.stringify(report, null, 2));
await context.close();
await browser.close();
console.log(`\n${checks.length} checks complete; ${errors.length} console/page errors.`);
process.exit(errors.length || checks.some((c) => c.startsWith("FAIL")) ? 1 : 0);
