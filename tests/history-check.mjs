import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
  recordVideo: {
    dir: "artifacts/history-video",
    size: { width: 1280, height: 900 },
  },
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const checks = [];
const ok = (s) => {
  checks.push(s);
  console.log("PASS", s);
};
await page.goto("http://127.0.0.1:4173/");
if (await page.getByRole("button", { name: "River history" }).isVisible()) {
  await page.getByRole("button", { name: "River history" }).click();
}
await expect(page.locator(".atlas-row")).toHaveCount(11);
await expect(page.locator(".history-range")).toContainText("3,653 days");
ok("Ten years and 120 monthly cells loaded");
await page.screenshot({
  path: "artifacts/history-desktop.png",
  fullPage: true,
});
await page.getByLabel("History date", { exact: true }).fill("2024-09-28");
const before = await page.locator(".flow-readout strong").innerText();
const beforeHeight = await page
  .locator(".flow-meter>div")
  .evaluate((e) => e.style.height);
await page.getByLabel("History date", { exact: true }).fill("2024-10-01");
const after = await page.locator(".flow-readout strong").innerText();
const afterHeight = await page
  .locator(".flow-meter>div")
  .evaluate((e) => e.style.height);
expect(Number(after.replaceAll(",", ""))).toBeGreaterThan(
  Number(before.replaceAll(",", "")),
);
expect(parseFloat(afterHeight)).toBeGreaterThan(parseFloat(beforeHeight));
ok("Daily readings and visual column rise together on historical surge");
await page.getByLabel("History year", { exact: true }).selectOption("2016");
await expect(page.getByLabel("History day", { exact: true })).toHaveAttribute(
  "max",
  "365",
);
await page.getByLabel("History year", { exact: true }).selectOption("2015");
await expect(page.getByLabel("History day", { exact: true })).toHaveAttribute(
  "max",
  "364",
);
ok("Year selection handles leap years");
await page.getByRole("button", { name: /Sep 2024:.*peak/ }).click();
expect(
  await page.getByLabel("History date", { exact: true }).inputValue(),
).toMatch(/^2024-09/);
ok("Monthly comparison selects the actual peak date");
await page.getByLabel("History date", { exact: true }).fill("2024-09-28");
await page.getByRole("button", { name: "Play history", exact: true }).click();
await page.waitForTimeout(1100);
await page.getByRole("button", { name: "Pause history", exact: true }).click();
const paused = await page
  .getByLabel("History date", { exact: true })
  .inputValue();
expect(paused).not.toBe("2024-09-28");
await page.waitForTimeout(700);
expect(
  await page.getByLabel("History date", { exact: true }).inputValue(),
).toBe(paused);
ok("Replay and pause freeze synchronized visual state");
const dl = page.waitForEvent("download");
await page
  .getByRole("button", { name: "Download all 3,653 days", exact: true })
  .click();
expect((await dl).suggestedFilename()).toBe("terrascope-2015-2024.csv");
ok("Full daily data export");
await page.getByRole("button", { name: "Explore", exact: true }).click();
await expect(page.locator(".map-legend")).toHaveCount(0);
await expect(
  page.getByRole("switch", { name: "Review area", exact: true }),
).toHaveCount(0);
await expect(page.locator(".resource-row")).toHaveCount(9);
ok("Resource map has no search-circle presentation");
await page.getByRole("button", { name: "River history", exact: true }).click();
await page
  .getByRole("button", { name: "Data and sources", exact: true })
  .click();
await expect(page.getByRole("dialog")).toContainText("daily");
await page.getByRole("button", { name: "Close dialog", exact: true }).click();
await page.setViewportSize({ width: 360, height: 800 });
await page.getByLabel("History year", { exact: true }).selectOption("2020");
expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
  360,
);
await page.screenshot({ path: "artifacts/history-mobile.png", fullPage: true });
ok("360px layout and year control work without page overflow");
expect(errors).toEqual([]);
ok("No unhandled browser errors");
fs.writeFileSync(
  "artifacts/history-report.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      browser: await browser.version(),
      checks,
      errors,
      physicalPhone: false,
    },
    null,
    2,
  ),
);
await ctx.close();
await browser.close();
