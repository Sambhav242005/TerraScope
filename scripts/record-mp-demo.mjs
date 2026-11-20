import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const origin = 'https://terrascope-floods.embarko.app';
const out = 'artifacts/mp-video';
const rehearse = process.argv.includes('--rehearse');
const viewport = { width: 1600, height: 720 };
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport, reducedMotion: 'reduce', ...(rehearse ? {} : { recordVideo: { dir: out, size: viewport } }) });
const page = await context.newPage();
const errors = [], events = [];
const downloads = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (/archive-api|flood-api/.test(r.url())) downloads.push({ url: r.url(), status: r.status() }); });
let start, completed = false;
async function click(locator) {
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw Error('Pointer target disappeared');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await locator.click();
}
async function reveal(locator) {
  await locator.evaluate(el => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowY === 'auto' && p.scrollHeight > p.clientHeight) {
        p.scrollTo({ top: p.scrollTop + el.getBoundingClientRect().top - p.getBoundingClientRect().top - 8, behavior: 'smooth' });
      }
    }
  });
  await page.waitForTimeout(450);
}
async function park() { await page.mouse.move(1030, 450, { steps: 12 }); }
async function at(seconds, label, action) {
  if (!rehearse) await page.waitForTimeout(Math.max(0, start + seconds * 1000 - performance.now()));
  await action();
  const elapsed = (performance.now() - start) / 1000;
  if (!rehearse && elapsed > seconds + 3.5) throw Error(label + ' missed mark, actual ' + elapsed);
  events.push({ seconds, elapsed, label });
  if (rehearse) await page.screenshot({ path: out + '/' + String(seconds).padStart(2, '0') + '.png' });
  console.log(label);
}
try {
  await page.goto(origin);
  await expect(page.getByRole('link', { name: 'TerraScope', exact: true })).toBeVisible();
  // Preparation uses the real selection workflow and provider downloads.
  await click(page.locator('.search-disclosure > summary'));
  await click(page.getByText('Or select area by coordinates', { exact: true }));
  await page.getByLabel('Area latitude').fill('26.155');
  await page.getByLabel('Area longitude').fill('78.78');
  await click(page.getByRole('button', { name: 'Select area', exact: true }));
  await expect(page.locator('.regional-history-status')).toContainText('Flow 30/30', { timeout: 30000 });
  await click(page.getByRole('button', { name: 'Candidates & resources', exact: true }));
  await expect(page.locator('.storage-row').nth(1)).toBeVisible({ timeout: 90000 });
  await click(page.getByRole('button', { name: 'Close context panel', exact: true }));
  await page.addStyleTag({ content: `
    .landscape-shell .workspace { height: 390px !important; min-height: 0 !important; }
    .side-panel { width: 475px !important; }
    .storage-row strong, .storage-row small { font-size: 13px; }
    .storage-facts > div { font-size: 13px; padding-block: 5px; }
    .candidate-detail > small { font-size: 12px; }
    .candidate-profile p { font-size: 12px; }
    .regional-history { font-size: 13px; }
  ` });
  await expect(page.locator('.timeline-top')).toBeInViewport({ ratio: 1 });
  // Larger inspector typography is a recording-only presentation adjustment.
  await page.evaluate(() => {
    // Repair punctuation only in the current public build's status separators.
    const formatStatus = () => {
      for (const node of document.querySelector('.regional-history-status')?.childNodes ?? []) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.includes(' ? ')) node.textContent = node.textContent.replaceAll(' ? ', ' · ');
      }
    };
    new MutationObserver(formatStatus).observe(document.body, { subtree: true, childList: true, characterData: true });
    formatStatus();
    const cursor = document.createElement('div');
    cursor.innerHTML = '<svg width="28" height="31"><path d="M4 2L23 15L13 17L10 26Z" fill="white" stroke="#123c32" stroke-width="2"/></svg>';
    cursor.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;left:1000px;top:450px';
    const marker = document.createElement('div'); marker.id = 'demo-start';
    marker.style.cssText = 'position:fixed;left:1522px;top:64px;width:24px;height:24px;background:#ce0dcc;z-index:2147483647;display:none';
    document.body.append(cursor, marker);
    window.addEventListener('mousemove', e => { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; });
  });
  if (rehearse) await writeFile(out + '/discovery.json', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('button,input,summary')].filter(e => e.getClientRects().length).map(e => ({ tag:e.tagName, text:e.textContent.trim(), label:e.getAttribute('aria-label') }))), null, 2));
  await page.waitForTimeout(1200);
  if (!rehearse) {
    await page.locator('#demo-start').evaluate(el => { el.style.display = 'block'; setTimeout(() => el.remove(), 450); });
    await expect(page.locator('#demo-start')).toHaveCount(0);
  }
  start = performance.now();
  await at(0, 'Seondha-area map overview', park);
  await at(12, 'Search for Seondha', async () => {
    await click(page.locator('.search-disclosure > summary'));
    const input = page.getByLabel('Search places', { exact: true });
    await click(input);
    await input.pressSequentially('Seondha Madhya Pradesh', { delay: rehearse ? 1 : 35 });
    await click(page.getByRole('button', { name: 'Search', exact: true }));
    await expect(page.locator('.place-search li button').first()).toContainText('Seondha');
  });
  await at(16, 'Select the real place; automatic history downloads', async () => {
    await click(page.locator('.place-search li button').first());
    await expect(page.locator('.header-place')).toContainText('Seondha');
  });
  await at(20, 'Downloaded rainfall and nearby modeled flow', async () => {
    await expect(page.locator('.regional-history-status')).toContainText('Flow 30/30', { timeout: 2500 });
    await click(page.getByRole('button', { name: 'Source & coverage', exact: true }));
    await park();
  });
  await at(23, 'Source grid, UTC coverage and replay', async () => {
    await reveal(page.locator('.regional-history article').first());
    await expect(page.locator('.regional-history article').first()).toContainText('2024-09-01 to 2024-09-30');
    await page.getByRole('slider', { name: 'Replay day' }).fill('9');
  });
  await at(26, 'Date moves through September', async () => {
    await page.getByRole('slider', { name: 'Replay day' }).focus();
    for (let i=0; i<3; i++) { await page.keyboard.press('ArrowRight'); if (!rehearse) await page.waitForTimeout(350); }
  });
  await at(29, 'Flow source and river identity limitation', async () => {
    await reveal(page.locator('.regional-history article').nth(1));
    await expect(page.locator('.regional-history article').nth(1)).toContainText('River match unverified');
    await park();
  });
  await at(33, 'Terrain candidates near Seondha', async () => {
    await click(page.getByRole('button', { name: 'Candidates & resources', exact: true }));
    await expect(page.locator('.storage-row').nth(1)).toBeVisible({ timeout: 2500 });
    await reveal(page.locator('.storage-row').first());
    await park();
  });
  await at(38, 'Inspect a candidate', async () => {
    await click(page.locator('.storage-row').nth(1));
    await reveal(page.locator('.candidate-detail'));
    await park();
  });
  await at(40, 'Footprint and terrain-based geometric volume', async () => {
    await reveal(page.locator('.storage-facts'));
    await park();
  });
  await at(47, 'Usable storage and suitability need measurements', async () => {
    await reveal(page.getByText('Water available now', { exact: true }));
    await park();
  });
  await at(52, 'Terrain cross-section and survey limitations', async () => {
    await reveal(page.locator('.candidate-profile'));
    await expect(page.locator('.candidate-profile svg')).toBeInViewport();
    await park();
  });
  await at(62, 'Public app and Embarko credit', async () => {
    await click(page.getByRole('button', { name: 'Close context panel', exact: true }));
    await park();
  });
  await at(69, 'Closing live map', park);
  await at(79, 'Capture complete', async () => {
    expect(errors).toEqual([]);
    const evidence = await page.evaluate(() => ({ history:JSON.parse(localStorage.getItem('terrascope.regional-history.v1')),screen:JSON.parse(localStorage.getItem('terrascope-storage-v1')),area:JSON.parse(localStorage.getItem('terrascope-v1')).mapTarget }));
    await writeFile(out + (rehearse ? '/rehearsal.json' : '/recording.json'), JSON.stringify({ origin,viewport,events,errors,downloads,evidence }, null, 2));
  });
  completed = true;
} finally {
  const video = page.video();
  await context.close();
  if (completed && video) await video.saveAs(out + '/public-app.webm');
  if (video) await video.delete();
  await browser.close();
}
