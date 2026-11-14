import {chromium,expect} from '@playwright/test';import fs from 'node:fs';
const base=process.env.DEMO_URL||'http://127.0.0.1:4173';
const b=await chromium.launch({channel:'msedge',headless:true});const ctx=await b.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));const checks=[];const ok=s=>{checks.push(s);console.log('PASS',s)};
await p.goto(base);
await p.getByRole('button',{name:'Explore',exact:true}).click();
await expect(p.locator('.map-view')).toBeVisible();
ok('Explore opens the map-first workspace');

const details=p.locator('details.placement-disclosure');if(!(await details.evaluate(el=>el.hasAttribute('open'))))await details.locator('summary').click();
await p.getByRole('button',{name:'Place by coordinates',exact:true}).click();
await p.getByLabel('Coordinate proposal type').selectOption('solar_array');
const lat=p.getByLabel('Placement latitude'),lon=p.getByLabel('Placement longitude');

async function submit(a,c){await lat.fill(String(a));await lon.fill(String(c));await p.getByRole('button',{name:'Place and check proposal'}).click();}

// 1. A clear spot is saved.
await submit(25.686,85.163);
await expect(p.locator('.proposal-controls summary')).toContainText('Proposals (1)',{timeout:20000});
await expect(p.locator('.placement-blocked')).toHaveCount(0);
ok('clear spot is checked and saved once');

// 2. A mapped road conflict is shown, highlighted on the map, and not saved.
await submit(25.7,85.16);
await expect(p.locator('.placement-blocked')).toContainText('This spot was not added',{timeout:20000});
await expect(p.locator('.placement-blocked')).toContainText(/road|water|river/i);
await expect(p.locator('.placement-attempt-banner.blocked')).toBeVisible();
await expect(p.locator('.proposal-controls summary')).toContainText('Proposals (1)');
await p.waitForTimeout(1200);
await p.screenshot({path:'artifacts/placement-blocked-desktop.png',fullPage:true});
await p.locator('.placement-blocked').screenshot({path:'artifacts/placement-blocked-alert.png'});
await p.locator('.placement-attempt-banner').screenshot({path:'artifacts/placement-blocked-banner.png'});
ok('mapped conflict is visibly blocked without creating a duplicate proposal');

// 3. A different clear spot checks afresh, clears the old problem and saves.
await submit(25.692,85.151);
await expect(p.locator('.proposal-controls summary')).toContainText('Proposals (2)',{timeout:20000});
await expect(p.locator('.placement-blocked')).toHaveCount(0);
await expect(p.locator('.placement-attempt-banner')).toHaveCount(0);
ok('new spot clears the previous conflict and is checked again');

await p.screenshot({path:'artifacts/placement-iterative-desktop.png',fullPage:true});
await p.setViewportSize({width:360,height:800});
expect(await p.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);
await p.screenshot({path:'artifacts/placement-iterative-mobile.png',fullPage:true});
ok('360px layout keeps iterative placement controls usable');
expect(errors).toEqual([]);
fs.writeFileSync('artifacts/placement-iterative-report.json',JSON.stringify({date:new Date().toISOString(),checks,errors,browser:await b.version(),physicalPhone:false},null,2));
await ctx.close();await b.close();
