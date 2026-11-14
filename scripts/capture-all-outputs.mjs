import { chromium } from '@playwright/test';
import fs from 'node:fs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });

// 1. Desktop 1440x900 - 3D explorer with unified minimal header
const contextDesktop = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
const pageDesktop = await contextDesktop.newPage();
await pageDesktop.goto('http://127.0.0.1:4173');
await pageDesktop.waitForTimeout(3000);
await pageDesktop.screenshot({ path: 'artifacts/minimal-ui-1-3d-explorer.png' });

// 2. Open the "What am I looking at?" Quick Guide modal
await pageDesktop.getByRole('button', { name: 'What am I looking at? Guide' }).click();
await pageDesktop.waitForTimeout(600);
await pageDesktop.screenshot({ path: 'artifacts/minimal-ui-2-user-guide.png' });

// 3. Close the guide and switch to Explore view
await pageDesktop.getByRole('button', { name: 'Got it, continue exploring' }).click();
await pageDesktop.waitForTimeout(400);
await pageDesktop.getByRole('button', { name: 'Explore', exact: true }).click();
await pageDesktop.locator('.maplibregl-canvas').waitFor();
await pageDesktop.waitForTimeout(6000);

// Click candidate row to inspect transect profile and details
const candidateRow = pageDesktop.locator('.storage-row').first();
if (await candidateRow.isVisible()) {
  await candidateRow.click();
  await pageDesktop.waitForTimeout(1000);
}
await pageDesktop.screenshot({ path: 'artifacts/minimal-ui-3-explore-candidate.png' });

// 4. Mobile 360x800 layout
const contextMobile = await browser.newContext({
  viewport: { width: 360, height: 800 },
  reducedMotion: 'reduce',
});
const pageMobile = await contextMobile.newPage();
await pageMobile.goto('http://127.0.0.1:4173');
await pageMobile.waitForTimeout(3000);
await pageMobile.screenshot({ path: 'artifacts/minimal-ui-4-mobile-360.png' });

await browser.close();
console.log('Successfully captured all minimal UI screenshots!');
