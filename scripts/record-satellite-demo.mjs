import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const rehearsal=process.argv.includes('--rehearse');
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:720},...(rehearsal?{}:{recordVideo:{dir:'artifacts/satellite-demo',size:{width:1280,height:720}}})});
const page=await context.newPage();
const errors=[]; let imageryLoaded=false;
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().includes('World_Imagery/MapServer/tile/')&&r.ok())imageryLoaded=true;});
async function click(name){const el=page.getByRole('button',{name,exact:true});await expect(el).toBeVisible();await el.scrollIntoViewIfNeeded();const box=await el.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:16});await page.waitForTimeout(350);await el.click();await page.waitForTimeout(rehearsal?300:1800);}
async function subtitle(text){await page.locator('#demo-subtitle').evaluate((el,t)=>el.textContent=t,text);await page.waitForTimeout(rehearsal?100:1500);}
try{
await page.goto('http://127.0.0.1:4173');
await expect(page.locator('.world-canvas')).toBeVisible();
await page.waitForTimeout(3000);
await page.evaluate(()=>{const cursor=document.createElement('div');cursor.id='demo-cursor';cursor.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24"><path d="M5 3L19 12L12 13L9 20Z" fill="white" stroke="black" stroke-width="1.5"/></svg>';cursor.style.cssText='position:fixed;z-index:999999;pointer-events:none;left:50px;top:50px';document.body.append(cursor);document.addEventListener('mousemove',e=>{cursor.style.left=e.clientX+'px';cursor.style.top=e.clientY+'px'});const sub=document.createElement('div');sub.id='demo-subtitle';sub.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:999998;background:#14251feF;color:white;padding:12px;text-align:center;font:16px Segoe UI;pointer-events:none';document.body.append(sub);});
await subtitle('Step 1 - Explore Sonpur terrain and mapped context');
await click('Hide mapped resources');
await subtitle('Step 2 - Switch to satellite imagery');
const canvas=await page.locator('.maplibregl-canvas').elementHandle();
await click('Satellite');await expect(page.getByRole('button',{name:'Satellite',exact:true})).toHaveAttribute('aria-pressed','true');
await expect.poll(()=>imageryLoaded,{timeout:20000}).toBe(true);
expect(await page.locator('.maplibregl-canvas').evaluate((el,old)=>el===old,canvas)).toBe(true);
await page.waitForTimeout(3000);await page.screenshot({path:'artifacts/satellite-desktop.png'});
await subtitle('Imagery dates vary; this is not a flood observation');
await click('2D map');
await subtitle('Step 3 - Inspect the same place from above');
await click('3D terrain');
await subtitle('Step 4 - Replay historical river discharge');
await click('Play history');await page.waitForTimeout(2200);await click('Pause history');
await subtitle('Discharge history is not water depth or inundation');
await click('Street');await expect(page.getByRole('button',{name:'Street',exact:true})).toHaveAttribute('aria-pressed','true');
await subtitle('Step 5 - Return to mapped terrain context');
if(rehearsal){await page.setViewportSize({width:360,height:800});await expect(page.getByRole('button',{name:'Satellite',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);await click('Satellite');await page.screenshot({path:'artifacts/satellite-mobile.png'});}
expect(errors).toEqual([]);
fs.writeFileSync('artifacts/satellite-'+(rehearsal?'rehearsal':'recording')+'.json',JSON.stringify({imageryLoaded,errors,viewport:rehearsal?'desktop + 360px emulation':'1280x720',physicalPhone:false},null,2));
console.log(rehearsal?'REHEARSAL PASSED':'RECORDING PASSED');
}finally{const video=page.video();await context.close();if(video)await video.saveAs('artifacts/terrascope-satellite-demo.webm');await browser.close();}
