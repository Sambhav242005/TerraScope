import { chromium } from '@playwright/test';

const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://127.0.0.1:4173');
await p.getByRole('button', { name: 'Explore', exact: true }).click();
await p.locator('.maplibregl-canvas').waitFor();
await p.waitForTimeout(4000);

// Click Shanti School row to focus on it
const schoolRow = p.locator('.resource-row', { hasText: 'Shanti School' });
if (await schoolRow.isVisible()) {
  await schoolRow.click();
  await p.waitForTimeout(1500);
}

// Screenshot the map area showing the school pin
const pin = p.locator('.resource-pin', { hasText: 'S' });
await pin.waitFor({ state: 'visible', timeout: 5000 });
await p.screenshot({ path: 'artifacts/fixed-school-marker.png' });

// Also take a close-up screenshot of the pin element itself
await pin.screenshot({ path: 'artifacts/fixed-school-marker-pin.png' });
console.log('Pin textContent is:', await pin.textContent());

await b.close();
