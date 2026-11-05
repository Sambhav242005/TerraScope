import { chromium } from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')console.log(m.type(),m.text())});page.on('pageerror',e=>console.log('PAGE ERROR',e.message));await page.goto('http://127.0.0.1:5173');await page.waitForTimeout(8000);await page.screenshot({path:'artifacts/terrascope-desktop.png',fullPage:true});console.log((await page.locator('body').innerText()).slice(0,4000));await browser.close();

