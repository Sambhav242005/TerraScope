import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const origin = process.env.DEMO_URL ?? "http://127.0.0.1:5173";
const directory = process.argv[2] ?? "artifacts/ui-audit";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const coverage = [];
const panels = ["Candidates & resources", "Environment", "History", "Compare", "Field checks", "Draft plan"];
await mkdir(directory, { recursive: true });

try {
  for (const width of [1440, 360]) {
    const page = await browser.newPage({ viewport: { width, height: width === 360 ? 800 : 960 }, hasTouch: width === 360, reducedMotion: "reduce" });
    page.setDefaultTimeout(3000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("http://127.0.0.1:11435/**", route => route.abort());
    await page.route("https://photon.komoot.io/**", route => {
      const query = new URL(route.request().url()).searchParams.get("q");
      if (query === "Unavailable") return route.fulfill({ status: 503 });
      const features = query === "Sonpur" ? [{
        geometry: { coordinates: [85.17, 25.72] },
        properties: { name: "Sonpur test result" },
      }] : [];
      return route.fulfill({ json: { features } });
    });
    const button = name => page.getByRole("button", { name, exact: typeof name === "string" });
    const click = name => button(name).first().click();
    const summary = selector => page.locator(selector).click();
    const shot = async (id, action = async () => {}) => {
      try {
        await action();
        const file = `${width}-${id}.png`;
        await page.screenshot({ path: `${directory}/${file}`, timeout: 5000 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        coverage.push({ width, id, file, overflow });
      } catch (error) {
        coverage.push({ width, id, error: error.message.split("\n")[0] });
      }
    };
    const reset = async () => {
      await page.goto(origin);
      await page.locator(".maplibregl-canvas").waitFor();
      if (await page.locator(".desk-close").isVisible()) await page.locator(".desk-close").click();
      await page.evaluate(() => scrollTo(0, 0));
    };
    await reset();
    await page.waitForTimeout(1500);
    await shot("map");
    await shot("keyboard", async () => {
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
    });
    await shot("layers", () => click("Map layers"));
    await shot("top-down", async () => { await click("Close map layers"); await click("2D"); });
    await shot("terrain", async () => { await click("3D"); await page.waitForTimeout(250); });
    await shot("measurements", () => summary(".map-summary > summary"));
    await shot("nrsc", () => summary(".basemap-control summary"));
    await shot("satellite", () => click("Satellite"));
    await reset();
    await shot("search", () => summary(".search-disclosure > summary"));
    await shot("search-error", async () => {
      await page.locator("#place-query").fill("Unavailable");
      await click("Search");
      await page.getByText("Place search unavailable.", { exact: false }).waitFor();
    });
    await page.waitForTimeout(1100);
    await shot("search-empty", async () => {
      await page.locator("#place-query").fill("Empty");
      await click("Search");
      await page.getByText(/No places found/).waitFor();
    });
    await shot("area-coordinates", () => summary(".place-search details summary"));
    await shot("proposals", async () => {
      await summary(".search-disclosure > summary");
      await summary(".proposals-details > summary");
    });
    await shot("placement", async () => {
      await summary(".proposals-details > summary");
      await click("Place by coordinates");
      await page.getByLabel("Coordinate proposal type").selectOption("storage_basin");
    });
    await reset();
    await shot("search-result", async () => {
      await summary(".search-disclosure > summary");
      await page.locator("#place-query").fill("Sonpur");
      await click("Search");
      await button("Sonpur test result").waitFor();
    });
    await shot("selected-area", async () => {
      if (width === 360) await button("Sonpur test result").tap();
      else await click("Sonpur test result");
      await summary(".area-data-note > summary");
    });
    await page.evaluate(() => localStorage.removeItem("terrascope-v1"));
    await reset();
    for (const [index, panel] of panels.entries()) {
      await shot(`panel-${index}`, () => click(panel));
      const side = page.locator("#landscape-context");
      const disclosures = side.locator("summary:visible");
      for (let i = 0, count = await disclosures.count(); i < count; i++) {
        const item = disclosures.nth(i);
        const label = (await item.innerText()).trim();
        await shot(`panel-${index}-disclosure-${i}`, async () => {
          if (!(await item.evaluate(el => el.parentElement.open))) await item.click();
          await item.scrollIntoViewIfNeeded();
          coverage.push({ width, panel, disclosure: label });
        });
      }
      if (panel === "Compare") {
        await shot("comparison-baseline", () => click("Existing place"));
        await shot("comparison-run", async () => { await click("Run comparison"); });
      }
      if (panel === "Candidates & resources") {
        await shot("resource-form", () => click("Add resource"));
        const candidate = page.locator(".storage-row").first();
        if (await candidate.isVisible()) {
          await shot("candidate", () => candidate.click());
          await shot("candidate-transect", () => page.getByText("Transect samples", { exact: true }).click());
        }
      }
      if (panel === "History") await shot("history-date", async () => {
        await page.getByLabel("History date", { exact: true }).fill("2017-08-14");
      });
      if (panel === "Field checks") await shot("field-evidence", async () => {
        await page.locator(".resource-row:visible").first().click();
        const observation = page.getByLabel("Observation", { exact: true });
        await observation.fill("Audit fixture observation");
        await observation.evaluate(el => el.scrollIntoView({ block: "nearest" }));
      });
      if (panel === "Draft plan") await shot("generated-draft", async () => {
        await click("Generate draft");
        await page.getByRole("textbox", { name: "Preparedness draft" }).scrollIntoViewIfNeeded();
      });
      if (await button("Close context panel").isVisible()) await click("Close context panel");
      if (await button("Return to event replay").isVisible()) await click("Return to event replay");
    }
    for (const [id, name] of [["guide", /What am I looking at/], ["sources", "Data and sources"], ["climate", "Climate context"], ["data-table", "Inspect data"]]) {
      await shot(id, () => click(name));
      const summaries = page.locator(".modal summary:visible");
      for (let i = 0, count = await summaries.count(); i < count; i++) {
        const item = summaries.nth(i);
        await shot(`${id}-disclosure-${i}`, async () => {
          const label = (await item.innerText()).trim();
          await item.click();
          coverage.push({ width, dialog: id, disclosure: label });
        });
      }
      await page.keyboard.press("Escape");
    }
    await shot("modal-keyboard", async () => {
      await click("Data and sources");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      if (!(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog[open]"))))) {
        throw new Error("Keyboard focus left the modal.");
      }
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.activeElement?.matches(".source-top[aria-label='Data and sources']"));
    });
    await reset();
    await shot("replay-playing", () => click("Play replay"));
    if (await button("Pause replay").isVisible()) await click("Pause replay");
    await shot("water-controls", () => summary(".timeline-details > summary"));
    await shot("water-scenario", async () => {
      await page.getByRole("checkbox", { name: "Show water-level scenario" }).check();
      await page.locator(".water-legend").scrollIntoViewIfNeeded();
    });
    await shot("results", () => click("Result timeline"));
    await shot("results-history", async () => {
      await page.getByLabel("Event or year context").selectOption("history");
      await page.locator(".result-history-stats").waitFor();
    });
    await reset();
    await shot("conversation", () => click(/Ask the map.*decision workspace/));
    await shot("conversation-evidence", async () => {
      await page.getByRole("textbox", { name: "Ask the map a question" }).fill("What data is available?");
      await click("Send question");
      await page.locator(".desk-msg-assistant").nth(1).waitFor({ timeout: 12_000 });
    });
    await shot("settings", () => summary(".desk-config summary"));
    await shot("settings-error", async () => {
      await click("Check connection");
      await page.locator(".desk-probe-fail").waitFor({ timeout: 12_000 });
    });
    await shot("conversation-drafts", async () => {
      await summary(".desk-config summary");
      await summary(".desk-drafts summary");
      await page.getByLabel("Audience for the drafted advisory").scrollIntoViewIfNeeded();
    });
    coverage.push({ width, pageErrors: errors });
    await page.close();
  }
} finally {
  await browser.close();
  await writeFile(`${directory}/coverage.json`, JSON.stringify(coverage, null, 2));
}
