import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const base = process.env.DEMO_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const checks = [];
const ok = (s) => { checks.push(s); console.log("PASS", s); };
const fail = (s) => { checks.push(s); console.log("FAIL", s); };

await page.goto(base);
await page.locator(".maplibregl-canvas").first().waitFor();
await page.waitForTimeout(8000);

// 1. Place a solar proposal by coordinates in open terrain.
await page.getByRole("button", { name: "Place by coordinates", exact: true }).click();
await page.getByRole("combobox", { name: "Coordinate proposal type" }).selectOption("solar_array");
await page.getByRole("spinbutton", { name: "Placement latitude" }).fill("25.72");
await page.getByRole("spinbutton", { name: "Placement longitude" }).fill("85.17");
await page.getByRole("button", { name: "Place and check proposal", exact: true }).click();
// 2. The pin exists and is draggable (drag hint in title).
await page.waitForTimeout(5000); // allow the area admission check to complete
page.getByRole("button", { name: "Explore", exact: true }).click({ timeout: 5000 }).catch(() => {});
const pin = page.locator(".intervention-pin").first();
await pin.waitFor({ timeout: 60000 });
const pinTitle = await pin.getAttribute("title");
if (/drag to move/.test(pinTitle ?? "")) ok("Pin carries the drag-to-move hint (draggable marker wired)");
else fail(`Pin title lacks the drag hint: "${pinTitle}"`);
await pin.click();
const inspector = page.locator(".intervention-inspector");
await inspector.waitFor({ timeout: 10000 });
ok("Inspector opens for the placed proposal");
const countMoves = async () => {
  const text = (await page.locator(".intervention-inspector").innerText()).match(/(\d+) recorded move/);
  return text ? Number(text[1]) : 0;
};
const auditBefore = await countMoves();

// 3. Drag the pin; the move is re-checked against admission before it persists.
const box = await pin.boundingBox();
const dragFail = async () => fail("Drag did not register a confirmed move (headless drag unproven) — reported as not verified, not passed");
if (!box) {
  fail("Could not measure pin geometry for drag");
} else {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) await page.mouse.move(cx + i * 6, cy + i * 4, { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(4000); // admission check + re-render
  const auditAfterDrag = await countMoves();
  if (auditAfterDrag > auditBefore) ok(`Drag move validated and recorded in the audit (${auditBefore} → ${auditAfterDrag})`);
  else await dragFail();
}

// 4. Keyboard nudge path works without a pointer.
const beforeNudge = await countMoves();
await page.getByRole("button", { name: "Nudge proposal about 200 metres north", exact: true }).click();
await page.waitForTimeout(1500);
const afterNudge = await countMoves();
if (afterNudge > beforeNudge) ok(`Keyboard nudge recorded a move (${beforeNudge} → ${afterNudge})`);
else fail(`Nudge did not increment the move audit (${beforeNudge} → ${afterNudge})`);

// 5. No duplicate pins were created; exactly one proposal exists.
const pins = await page.locator(".intervention-pin").count();
if (pins === 1) ok("Drag/nudge never created duplicate proposals (1 pin)");
else fail(`Expected 1 pin, got ${pins}`);

await page.screenshot({ path: "artifacts/placement-move-1440.png", fullPage: true });
if (errors.length) fail(`console/page errors: ${errors.join(" | ")}`);
else ok("No console or page errors");

const report = { date: new Date().toISOString(), checks, errors, browser: await browser.version(), physicalPhone: false };
fs.writeFileSync("artifacts/placement-move-report.json", JSON.stringify(report, null, 2));
await context.close();
await browser.close();
console.log(`\n${checks.length} checks complete; ${errors.length} console/page errors.`);
process.exit(errors.length || checks.some((c) => c.startsWith("FAIL")) ? 1 : 0);
