import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const live = process.env.LIVE_HISTORY === '1';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const output = 'artifacts/regional-history';
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], calls = [];
  let failFlow = false, delay = false;
  page.on('pageerror', e => errors.push(e.message));
  // Independent area connectors are outside this regression; keep this check focused on history.
  await page.route('https://air-quality-api.open-meteo.com/**', r => r.fulfill({ status: 503 }));
  if (!live) for (const host of ['archive-api', 'flood-api']) await page.route('https://' + host + '.open-meteo.com/**', async route => {
    const url = new URL(route.request().url());
    const q = Object.fromEntries(url.searchParams);
    calls.push(q);
    if (delay && q.latitude === '26.2') await new Promise(resolve => setTimeout(resolve, 1200));
    if (failFlow && host === 'flood-api') return route.fulfill({ status: 503 });
    const days = [];
    for (let t = Date.parse(q.start_date); t <= Date.parse(q.end_date); t += 86400000) days.push(new Date(t).toISOString().slice(0, 10));
    const data = { latitude: Number(q.latitude), longitude: Number(q.longitude), utc_offset_seconds: 0,
      hourly_units: { precipitation: 'mm' }, hourly: { time: days.flatMap(d => Array.from({ length: 24 }, (_, h) => d + 'T' + String(h).padStart(2, '0') + ':00')), precipitation: Array(days.length * 24).fill(1) },
      daily_units: { river_discharge: 'm³/s' }, daily: { time: days, river_discharge: days.map((_, i) => Number(q.latitude) * 10 + i) } };
    await route.fulfill({ json: data });
  });
  await page.goto(process.env.DEMO_URL ?? 'http://127.0.0.1:5173');
  async function choose(lat, lon) {
    await page.locator('.search-disclosure > summary').click();
    const search = page.getByRole('region', { name: 'Search and select an area' });
    if (!await search.getByLabel('Area latitude').isVisible()) await search.getByText('Or select area by coordinates', { exact: true }).click();
    await search.getByLabel('Area latitude').fill(String(lat));
    await search.getByLabel('Area longitude').fill(String(lon));
    await search.getByRole('button', { name: 'Select area', exact: true }).click();
  }
  await choose(live ? 26.155 : 25.8, live ? 78.78 : 78.25);
  await expect(page.locator('.regional-history-status')).toContainText('30/30 days', { timeout: 30000 });
  await expect(page.locator('.regional-history-status')).toContainText('River match unverified');
  await page.getByRole('button', { name: 'Source & coverage', exact: true }).click();
  await expect(page.locator('.regional-history')).toContainText('Returned cell');
  await expect(page.locator('.regional-history article')).toHaveCount(2);
  await page.getByText('Change history dates', { exact: true }).click();
  await page.getByLabel('Start date', { exact: true }).fill('2024-09-10');
  await page.getByLabel('End date', { exact: true }).fill('2024-09-15');
  await page.getByRole('button', { name: 'Load dates', exact: true }).click();
  await expect(page.locator('.regional-history-status')).toContainText('6/6 days', { timeout: 30000 });
  await expect(page.getByRole('slider', { name: 'Replay day' })).toHaveAttribute('max', '5');
  await page.getByRole('slider', { name: 'Replay day' }).fill('5');
  await expect(page.locator('.timeline-title')).toContainText(/15 Sept? 2024/);
  await page.getByText('Change history dates', { exact: true }).click();
  await page.locator('.regional-history').evaluate(el => el.closest('.side-panel').scrollTop = 0);
  if (live) await writeFile(output + '/responses.json', JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('terrascope.regional-history.v1') ?? '[]')), null, 2));
  await page.screenshot({ path: output + '/desktop.png' });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: output + '/mobile.png' });
  if (!live) {
    // Cache should restore the exact location and dates without a new provider request.
    const before = calls.length;
    await page.reload();
    await expect(page.locator('.regional-history-status')).toContainText('cached', { timeout: 10000 });
    expect(calls.length).toBe(before);
    await page.setViewportSize({ width: 1440, height: 1000 });
    // A failed flow connector leaves successful rainfall and no borrowed Sonpur marker.
    failFlow = true;
    await choose(26.1, 78.3);
    await expect(page.locator('.regional-history-status')).toContainText('Flow Unavailable');
    await expect(page.locator('.regional-history-status')).toContainText('Rainfall 6/6');
    await expect(page.locator('.river-gauge')).toBeHidden();
    await page.getByRole('button', { name: 'Source & coverage', exact: true }).click();
    await expect(page.locator('.regional-history')).toContainText('HTTP 503');
    failFlow = false;
    await page.getByRole('button', { name: 'Refresh history', exact: true }).click();
    await expect(page.locator('.regional-history-status')).toContainText('Flow 6/6');
    await expect(page.locator('.river-gauge')).toBeVisible();
    // Superseded requests cannot overwrite the next region, even when they finish last.
    failFlow = false; delay = true;
    await choose(26.2, 78.4);
    await page.waitForTimeout(600);
    await choose(26.3, 78.5);
    await expect(page.locator('.regional-history-status')).toContainText('Flow 6/6');
    await page.getByRole('button', { name: 'Source & coverage', exact: true }).click();
    await expect(page.locator('.regional-history')).toContainText('Returned cell 26.3000°, 78.5000°');
    await page.waitForTimeout(1600);
    await expect(page.locator('.regional-history')).not.toContainText('Returned cell 26.2000°');
    await expect(page.locator('.river-gauge')).toHaveAttribute('title', /78.5, 26.3/);
  }
  expect(errors).toEqual([]);
  await writeFile(output + (live ? '/live.json' : '/fixture.json'), JSON.stringify({ live, calls, errors, checked: ['automatic fetch', 'dates', 'source cells', 'replay bounds', '360px', ...(live ? [] : ['cache reload', 'partial failure', 'old marker cleared', 'superseded request'])] }, null, 2));
  console.log('PASS selected-area historical replay (' + (live ? 'live providers' : 'fixture failures/cache/races') + ')');
} finally { await browser.close(); }
