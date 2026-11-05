import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const b=await chromium.launch({channel:'msedge',headless:true});
const c=await b.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
await p.goto('http://127.0.0.1:4173');await expect(p.locator('.world-canvas')).toBeVisible();
await p.locator('.indian-evidence summary').click();
const select=p.getByLabel('NRSC historical flood map',{exact:true});
const canvas=await p.locator('.maplibregl-canvas').elementHandle();
const response=p.waitForResponse(r=>r.url().endsWith('bihar-2024-10-01-10.png')&&r.ok());
await select.selectOption('2024-10-01-10');await response;
await expect(p.locator('.indian-evidence')).toContainText('Unmarked/outside coverage: unknown');
await p.getByRole('button',{name:'View snapshot area',exact:true}).click();
await p.locator('.indian-evidence summary').click();await p.waitForTimeout(1500);
await expect(p.locator('.indian-evidence summary')).toContainText('2024-10-01 (fixed date)');
expect(await p.locator('.maplibregl-canvas').evaluate((el,old)=>el===old,canvas)).toBe(true);
await p.screenshot({path:'artifacts/nrsc-overlay-desktop.png'});
await p.locator('.indian-evidence summary').click();
const response2=p.waitForResponse(r=>r.url().endsWith('bihar-2024-10-02-06.png')&&r.ok());await select.selectOption('2024-10-02-06');await response2;
await select.selectOption('');await expect(p.locator('.indian-evidence summary')).toHaveText('Indian evidence');
await p.setViewportSize({width:360,height:800});await select.selectOption('2024-10-01-10');await expect(select).toBeVisible();expect(await p.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);
await p.screenshot({path:'artifacts/nrsc-overlay-mobile.png'});
await select.focus();await expect(select).toBeFocused();expect(errors).toEqual([]);
fs.writeFileSync('artifacts/nrsc-overlay-report.json',JSON.stringify({checks:['Two sourced images load','Fixed date and unknown-coverage labels','Same canvas across selection','Hide overlay','360px controls and keyboard focus'],errors,physicalPhone:false},null,2));console.log('NRSC OVERLAY CHECKS PASSED');
}finally{await c.close();await b.close();}
