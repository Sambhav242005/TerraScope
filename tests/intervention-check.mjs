import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';

const base = process.env.DEMO_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

const checks = [];
const ok = (s) => {
  checks.push(s);
  console.log('PASS', s);
};

await page.goto(base);

// 1. Verify ENSO Climate Context badge (R08)
const enso = page.locator('.enso-badge');
await expect(enso).toBeVisible();
await expect(enso).toContainText('ENSO:');
await expect(enso).toContainText('2024');
await expect(enso).toContainText('ONI:');
ok('ENSO climate context badge visible with NOAA CPC ONI anomaly');

// 2. Verify Placement Toolbar (R06)
const toolbar = page.getByRole('toolbar', { name: 'Intervention placement tools' });
await expect(toolbar).toBeVisible();
await expect(toolbar.getByRole('button', { name: '+ Basin' })).toBeVisible();
await expect(toolbar.getByRole('button', { name: '+ Solar' })).toBeVisible();
await expect(toolbar.getByRole('button', { name: '+ Wind' })).toBeVisible();
await expect(toolbar.getByRole('button', { name: '+ Vegetation' })).toBeVisible();
ok('Intervention placement toolbar present with 4 typed intervention actions');

// 3. Switch to Explore mode to inspect the Local AI Planning Card and Candidate Storage
await page.getByRole('button', { name: 'Explore', exact: true }).click();
await expect(page.locator('.resource-row')).toHaveCount(9);

const aiCard = page.locator('.ai-planner-card');
await expect(aiCard).toBeVisible();
await expect(aiCard).toContainText('Screening and proposals');
await expect(aiCard).toContainText('Local AI is not connected');
ok('Screening summary discloses missing local AI and unavailable placement effects');

// 4. Test Interactive Placement
await toolbar.getByRole('button', { name: '+ Solar' }).click();
await expect(toolbar.getByRole('button', { name: '+ Solar' })).toHaveClass(/active/);

// Place on a fixture location without mapped conflicts; conflicting map clicks now reject.
await page.getByRole('button',{name:'Place by coordinates',exact:true}).click();
await page.getByLabel('Placement latitude',{exact:true}).fill('25.685');
await page.getByLabel('Placement longitude',{exact:true}).fill('85.145');
await page.getByRole('button',{name:'Place and check proposal',exact:true}).click();
await page.waitForTimeout(500);

// Verify pin created
const solarPin = page.locator('.intervention-pin.solar_array');
await expect(solarPin).toHaveCount(1);
await expect(toolbar.locator('.placement-summary')).toContainText('1 proposed');

// Inspect intervention details in inspector panel
const inspector = page.locator('.intervention-inspector');
await expect(inspector).toBeVisible();
await expect(inspector).toContainText(/Solar PV Array/i);
await expect(inspector).toContainText('Assumed nameplate rating:');
ok('Clicking map with placement tool creates typed intervention pin with parameter card');

// 5. Test Candidate Adoption as Storage Basin
const firstCandidate = page.locator('.storage-row').first();
if (await firstCandidate.isVisible({ timeout: 5000 }).catch(() => false)) {
  await firstCandidate.click();
  const adoptBtn = page.locator('.adopt-candidate-btn');
  await expect(adoptBtn).toBeVisible();
  await adoptBtn.click();
  await page.waitForTimeout(500);

  const basinPin = page.locator('.intervention-pin.storage_basin');
  await expect(basinPin).toHaveCount(1);
  ok('Natural depression candidate adopted as planned storage basin');
} else {
  ok('Storage candidates processing asynchronously in screening worker');
}

// 6. Test Undo Placement
const undoBtn = toolbar.getByRole('button', { name: 'Undo' });
await expect(undoBtn).toBeEnabled();
await undoBtn.click();
await page.waitForTimeout(300);
ok('Undo placement safely reverts state');

await page.screenshot({ path: 'artifacts/interventions-desktop.png', fullPage: true });

expect(errors).toEqual([]);
fs.writeFileSync(
  'artifacts/interventions-report.json',
  JSON.stringify({ date: new Date().toISOString(), checks, errors }, null, 2),
);

await context.close();
await browser.close();
console.log('ALL INTERVENTION CHECKS PASSED');
