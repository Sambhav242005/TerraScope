import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const url = 'https://terrascope-floods.embarko.app';
const viewport = { width: 1600, height: 720 };
const out = 'artifacts/challenge-demo';
const rehearse = process.argv.includes('--rehearse');
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport,
  reducedMotion: 'reduce',
  ...(rehearse ? {} : { recordVideo: { dir: out, size: viewport } }),
});
const page = await context.newPage();
const events = [];
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let started;
let complete = false;

async function at(seconds, label, action) {
  if (!rehearse) await page.waitForTimeout(Math.max(0, started + seconds * 1000 - performance.now()));
  await action();
  const elapsed = (performance.now() - started) / 1000;
  if (!rehearse && elapsed - seconds > 2) throw new Error(`${label} missed its mark by ${elapsed - seconds}s`);
  events.push({ seconds, elapsed, label });
  console.log(label);
}

async function move(target) {
  await expect(target).toBeVisible();
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error('Missing pointer target');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: rehearse ? 1 : 10 });
}

async function click(target) {
  await move(target);
  await target.click();
}

async function scrollPanel(target) {
  await expect(target).toBeVisible();
  await target.evaluate(el => {
    for (let container = el.parentElement; container && container !== document.body; container = container.parentElement) {
      if (getComputedStyle(container).overflowY !== 'auto' || container.scrollHeight <= container.clientHeight) continue;
      const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 8;
      container.scrollTo({ top, behavior: 'instant' });
    }
  });
  await page.waitForTimeout(360);
}

async function frame(name) {
  if (rehearse) await page.screenshot({ path: path.join(out, name + '.png') });
}

async function checkHeader(header) {
  await expect(header).toBeInViewport({ ratio: 1 });
  const layout = await header.evaluate(el => {
    const edge = el.getBoundingClientRect().right;
    const children = [...el.querySelectorAll('a,button,nav,.casebar,.casebar div,.casebar span,.casebar strong')];
    return {
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      overflow: children.filter(child => child.getClientRects().length && child.getBoundingClientRect().right > edge)
        .map(child => child.textContent?.trim() || child.getAttribute('aria-label')),
    };
  });
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.overflow).toEqual([]);
  return layout;
}

try {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (!response?.ok() || new URL(page.url()).origin !== url) throw new Error('Public app did not load');
  const header = page.locator('.topbar');
  const landscape = page.locator('.world-canvas').first();
  const slider = page.locator('input[type=range]').filter({ visible: true }).first();
  const dateInput = page.locator('input[type=date]').filter({ visible: true }).first();
  const candidate = page.locator('.storage-row').first();
  const detail = page.locator('.candidate-detail');
  const profile = page.locator('.candidate-profile');
  await expect(header.getByRole('link', { name: 'TerraScope', exact: true })).toBeVisible();
  await expect(landscape).toBeVisible();

  // Presentation styles are scoped to this browser context. All app data and actions come from the public URL.
  await page.addStyleTag({ content: `
    html, body { overflow: clip !important; }
    .world-mode .world-canvas { height: 392px !important; min-height: 0 !important; }
    .app-shell .topbar nav button { padding-inline: 8px; }
    .app-shell .topbar .casebar {
      display: grid;
      grid-template-columns: max-content max-content;
      align-content: center;
      min-width: 0;
      gap: 2px 8px;
      font-size: 10px;
    }
    .app-shell .topbar .casebar > div:last-child { grid-column: 1 / -1; }
    .app-shell .topbar .casebar > div:last-child button { min-height: 18px; height: 18px; }
    .app-shell .topbar .casebar .enso-badge { padding: 2px 5px; }
    .app-shell .topbar .casebar .case-location { margin-left: 1px; }
    .app-shell .topbar .casebar .mode-pill { padding: 1px 4px; }
    .world-observation { top: 18px; right: 44px; width: 300px; padding: 12px 16px; }
    .world-observation h2 { margin-bottom: 9px; }
    .world-observation .world-metric-label, .world-observation .world-rain { font-size: 12px; }
    .world-bottom { bottom: 22px; }
    .workspace:has(> .side-panel) { grid-template-columns: minmax(0, 1fr) 480px !important; }
    .side-panel, .layer-panel, .candidate-detail, .storage-list {
      max-height: 45vh !important;
      max-height: 45dvh !important;
      min-height: 0 !important;
      overflow-y: auto !important;
      overflow-wrap: anywhere;
      line-height: 1.4 !important;
      scroll-behavior: smooth;
    }
    .side-panel { border-bottom-left-radius: 12px; align-self: start; }
    .storage-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
      white-space: normal;
    }
    .storage-row > em { justify-self: start; white-space: normal; max-width: 100%; }
    .storage-facts > div { min-width: 0; padding-block: 5px; font-size: 12px; }
    .storage-facts dt, .storage-facts dd { font-size: inherit; }
    .storage-row strong, .storage-row small { font-size: 13px; }
    .storage-facts dd, .candidate-detail small { line-height: 1.4; white-space: normal; }
    .storage-panel, .candidate-detail { scroll-margin-top: 10px; }
    .candidate-detail .candidate-profile, .storage-facts { scroll-margin-top: 8px; }
  ` });
  await expect(slider).toBeInViewport();
  await expect(dateInput).toHaveValue('2024-09-28');
  const headerLayouts = { initial: await checkHeader(header) };

  if (rehearse) {
    await writeFile(path.join(out, 'discovery.json'), JSON.stringify(await page.evaluate(() =>
      [...document.querySelectorAll('button,input,select,summary')].filter(el => el.getClientRects().length)
        .map(el => ({ tag: el.tagName, type: el.type, text: el.textContent.trim(), value: el.value }))),
    null, 2));
  }
  await page.evaluate(() => {
    const cursor = document.createElement('div');
    cursor.innerHTML = '<svg width="30" height="32" viewBox="0 0 30 32"><path d="M5 3L23 16L14 17L11 26Z" fill="white" stroke="#133730" stroke-width="2"/></svg>';
    cursor.style.cssText = 'position:fixed;display:none;pointer-events:none;z-index:2147483646;filter:drop-shadow(0 2px 2px #13373088)';
    const marker = document.createElement('div');
    marker.id = 'demo-start';
    marker.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;left:1522px;top:64px;width:24px;height:24px;background:#ce0dcc;display:none';
    document.body.append(cursor, marker);
    window.addEventListener('mousemove', event => {
      cursor.style.display = 'block';
      cursor.style.left = event.clientX - 5 + 'px';
      cursor.style.top = event.clientY - 3 + 'px';
    });
  });

  // Let the app finish the initial terrain paint before the video clock begins.
  await page.waitForTimeout(rehearse ? 500 : 3500);
  if (!rehearse) await page.locator('#demo-start').evaluate(el => {
    el.style.display = 'block';
    setTimeout(() => el.remove(), 450);
  });
  if (!rehearse) await expect(page.locator('#demo-start')).toHaveCount(0);
  started = performance.now();

  await at(0.8, 'Opening terrain frame', () => frame('01-terrain'));
  await at(3.5, 'Orient over the map', () => page.mouse.move(790, 380, { steps: 10 }));
  await at(10.4, 'September 28 replay position', async () => {
    await move(slider);
    await slider.focus();
  });
  for (const [index, date] of ['2024-09-29', '2024-09-30', '2024-10-01', '2024-10-02'].entries()) {
    await at(11.8 + index * 1.4, date, async () => {
      await slider.press('ArrowRight');
      await expect(dateInput).toHaveValue(date);
    });
  }
  await at(18.3, 'Replay values visible with app header', async () => {
    headerLayouts.replay = await checkHeader(header);
    await frame('02-replay');
  });
  await at(23, 'Open Explore', () => click(page.getByRole('button', { name: 'Explore', exact: true })));
  await expect(candidate).toBeVisible({ timeout: rehearse ? 30000 : 6500 });
  await at(25, 'Reveal candidate list', async () => {
    await scrollPanel(page.locator('.storage-panel'));
    await expect(candidate).toBeInViewport();
    const stack = await candidate.evaluate(row => {
      const metadata = row.querySelector('span').getBoundingClientRect();
      const tag = row.querySelector('em').getBoundingClientRect();
      return { metadataBottom: metadata.bottom, tagTop: tag.top };
    });
    expect(stack.tagTop).toBeGreaterThanOrEqual(stack.metadataBottom);
    headerLayouts.list = await checkHeader(header);
    await frame('03-candidates');
  });
  await at(33, 'Open terrain depression', async () => {
    await click(candidate);
    await expect(detail).toBeVisible();
    await scrollPanel(detail);
    // Park the pointer in the margin below the inspector while its measurements are read.
    const inspector = await page.locator('.side-panel').boundingBox();
    if (!inspector) throw new Error('Candidate sidebar disappeared after opening the card');
    await page.mouse.move(inspector.x + inspector.width / 2, inspector.y + inspector.height + 28, { steps: 12 });
    await frame('04-detail');
  });
  await at(38.2, 'Reveal capacity and survey limitations', async () => {
    await scrollPanel(detail.locator('.storage-facts'));
    await expect(detail.getByText('Suitability', { exact: true })).toBeInViewport();
    headerLayouts.detail = await checkHeader(header);
    await frame('05-capacity');
  });
  await at(45.1, 'Reveal terrain transect', async () => {
    await scrollPanel(profile);
    await expect(profile.locator('svg')).toBeInViewport();
    await frame('06-profile');
  });
  await at(52, 'Retain chart and map', async () => {
    await expect(profile.locator('svg')).toBeInViewport();
    headerLayouts.profile = await checkHeader(header);
  });
  await at(55.4, 'Return to public explorer', () => click(page.getByRole('button', { name: '3D explorer', exact: true })));
  await at(69, 'Hold public explorer for end card', async () => {
    headerLayouts.end = await checkHeader(header);
    await frame('07-ending');
  });
  await at(79, 'Capture complete', async () => {
    expect(errors).toEqual([]);
    const bounds = await page.evaluate(() => [...document.querySelectorAll('.side-panel,.layer-panel,.candidate-detail')]
      .map(el => ({ selector: el.className, maxHeight: getComputedStyle(el).maxHeight, lineHeight: getComputedStyle(el).lineHeight })));
    await writeFile(path.join(out, rehearse ? 'rehearsal.json' : 'recording.json'),
      JSON.stringify({ url, viewport, events, bounds, headerLayouts, errors }, null, 2));
  });
  complete = true;
} finally {
  const video = page.video();
  await context.close();
  if (complete && video) await video.saveAs(path.join(out, 'public-app.webm'));
  if (video) await video.delete();
  await browser.close();
}
