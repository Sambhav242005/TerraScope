import {chromium,expect} from '@playwright/test';import fs from 'node:fs';
const base=process.env.DEMO_URL||'http://127.0.0.1:4173';
const b=await chromium.launch({channel:'msedge',headless:true});const c=await b.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const p=await c.newPage();const errors=[];const checks=[];p.on('pageerror',e=>errors.push(e.message));
async function place(page,kind,lat,lon){
 const form=page.locator('.coordinate-placement');
 if(!await form.isVisible())await page.getByRole('button',{name:'Place by coordinates',exact:true}).click();
 await page.getByLabel('Coordinate proposal type',{exact:true}).selectOption(kind);await page.getByLabel('Placement latitude',{exact:true}).fill(String(lat));await page.getByLabel('Placement longitude',{exact:true}).fill(String(lon));await page.getByRole('button',{name:'Place and check proposal',exact:true}).click();
}
async function openProposal(page,index){
 const summary=page.locator('.proposal-controls summary');const details=page.locator('.proposal-controls details');
 if(!(await details.evaluate(el=>el.hasAttribute('open'))))await summary.click();
 await details.locator('button').nth(index).click();
}
try{
await p.goto(base);
// 1. A mapped channel conflict is named, shown and never saved.
await place(p,'wind_turbine',25.682,85.142);
const blocked=p.locator('.placement-blocked');
await expect(blocked).toContainText('This spot was not added',{timeout:20000});
await expect(blocked).toContainText('Ganges');
await expect(blocked).toContainText('not authorize a site');
await expect(p.locator('.placement-attempt-banner.blocked')).toContainText('river');
await expect(p.locator('.proposal-controls summary')).toContainText('Proposals (0)');
await expect(p.locator('.intervention-pin.wind_turbine')).toHaveCount(0);
checks.push('Land turbine in mapped Ganges is named and visibly rejected without a saved proposal');
await p.screenshot({path:'artifacts/placement-channel-conflict.png'});

// 2. A clear proposal persists and is rechecked from current evidence after reload.
await place(p,'wind_turbine',25.686,85.163);
await expect(p.locator('.proposal-controls summary')).toContainText('Proposals (1)',{timeout:20000});
const pin=p.locator('.intervention-pin.wind_turbine');
await expect(pin).toHaveAttribute('data-placement-status','investigate');
await p.reload();
await expect(pin).toHaveAttribute('data-placement-status','investigate');
await openProposal(p,0);
const review=p.getByRole('region',{name:'Placement evidence check',exact:true});
await expect(review).toContainText('suitability still unassessed');
await expect(review).toContainText('Placement only; intervention effect model unavailable');
checks.push('Restored proposals are rechecked from current evidence, not a saved verdict');

// 3. Riparian vegetation overlapping a channel stays an investigation and is admitted.
await place(p,'vegetation_buffer',25.682,85.142);
await expect(p.locator('.proposal-controls summary')).toContainText('Proposals (2)',{timeout:20000});
await openProposal(p,1);
await expect(review).toContainText('Mapped overlap; further investigation required');
await expect(review).toContainText('riparian buffer');
checks.push('Vegetation overlap is an investigation, not unconditional rejection or benefit');

// 4. Dated NRSC map-color evidence is reported with limitations after an area refetch.
await p.route('**/api/0.6/map.json*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"elements":[]}'}));
await place(p,'solar_array',25.8,85.1);
await expect(p.locator('.proposal-controls summary')).toContainText('Proposals (3)',{timeout:30000});
await p.unroute('**/api/0.6/map.json*');
await expect(review).toContainText('map-color inundation');
await expect(review).toContainText('2024-10-01');
await expect(review).toContainText('not validated flood risk');
await expect(review).toContainText('No mapped overlap is not proof of no hazard');
await expect(p.locator('.area-data-note')).toContainText('remain the original Sonpur case');
await expect(p.locator('.area-data-note')).toContainText('do not describe this selected area');
checks.push('Solar footprint intersects dated NRSC map colors with limitations; Sonpur inputs are not relocated');

// 5. Matched rainfall, explicit export assumptions and no graph change from pins.
await p.getByRole('button',{name:'Compare',exact:true}).click();await p.getByLabel('Rainfall multiplier',{exact:true}).fill('1.5');await p.getByRole('button',{name:'Run comparison',exact:true}).click();const peaks=await p.locator('.result-grid strong').allTextContents();expect(peaks[0]).toBe(peaks[1]);await expect(p.locator('.compare-panel')).toContainText('Placed interventions are not model inputs');
await p.getByLabel('Storage response time',{exact:true}).fill('12');await p.getByRole('button',{name:'Run comparison',exact:true}).click();const changed=await p.locator('.result-grid strong').allTextContents();expect(changed[0]).not.toBe(changed[1]);await place(p,'storage_basin',25.687,85.147);await expect(p.locator('.proposal-controls summary')).toContainText('Proposals (4)',{timeout:20000});expect(await p.locator('.result-grid strong').allTextContents()).toEqual(changed);
const downloading=p.waitForEvent('download');await p.getByRole('button',{name:'Export model results',exact:true}).click();const d=await downloading;const exported=JSON.parse(fs.readFileSync(await d.path(),'utf8'));expect(exported.referenceSettings.rainScale).toBe(exported.scenario.rainScale);expect(exported.placedInterventionsApplied).toBe(false);checks.push('Matched rainfall, explicit export assumptions and no graph change from pins');
await p.screenshot({path:'artifacts/placement-matched-comparison.png'});

// 6. 360px coordinate placement, blocked feedback and keyboard focus.
await p.getByRole('button',{name:'3D explorer',exact:true}).click();await p.setViewportSize({width:360,height:800});
await p.route('**/api/0.6/map.json*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"elements":[]}'}));
await place(p,'wind_turbine',25.682,85.142);await expect(blocked).toContainText('Ganges',{timeout:30000});await p.unroute('**/api/0.6/map.json*');
expect(await p.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);await p.getByLabel('Placement latitude',{exact:true}).focus();await expect(p.getByLabel('Placement latitude',{exact:true})).toBeFocused();await blocked.scrollIntoViewIfNeeded();await p.screenshot({path:'artifacts/placement-mobile-check.png'});checks.push('360px coordinate placement and blocked evidence feedback usable with keyboard');

// 7. Failed area evidence blocks, and an explicit retry rechecks the same spot once.
const failed=await b.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});const q=await failed.newPage();await q.route('**/data/placement-evidence.json',r=>r.fulfill({status:503,body:'unavailable'}));await q.goto(base);await place(q,'wind_turbine',25.686,85.163);
const qAlert=q.locator('.placement-blocked');await expect(qAlert).toContainText('Area check failed',{timeout:20000});await expect(qAlert.getByRole('button',{name:'Retry area checks',exact:true})).toBeVisible();await expect(q.locator('.proposal-controls summary')).toContainText('Proposals (0)');
await q.unroute('**/data/placement-evidence.json');await qAlert.getByRole('button',{name:'Retry area checks',exact:true}).click();await expect(q.locator('.proposal-controls summary')).toContainText('Proposals (1)',{timeout:20000});await expect(q.locator('.intervention-pin.wind_turbine')).toHaveCount(1);await expect(q.locator('.placement-blocked')).toHaveCount(0);await failed.close();checks.push('Failed area evidence blocks placement; retry rechecks the same spot once without duplication');

expect(errors).toEqual([]);fs.writeFileSync('artifacts/placement-validation-report.json',JSON.stringify({date:new Date().toISOString(),checks,errors,physicalPhone:false},null,2));console.log(checks.join('\n'));
}finally{await c.close();await b.close();}
