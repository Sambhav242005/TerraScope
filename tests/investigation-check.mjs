import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({channel:'msedge', headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage(); const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const origin=process.env.DEMO_URL || 'http://127.0.0.1:4173/';
try {
  await page.goto(origin);
  await expect(page.getByRole('button',{name:'Begin investigation'})).toBeVisible();
  await page.screenshot({path:'docs/original-plan-landing.png',fullPage:true});
  await page.getByRole('button',{name:'Begin investigation'}).click();
  await expect(page.getByRole('button',{name:'Form a hypothesis'})).toBeDisabled();
  for(let index=0;index<5;index++){
    await page.locator('.journal-list>button').nth(index).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button',{name:'Return to the valley',exact:false}).click();
  }
  await page.reload();
  await expect(page.getByRole('button',{name:'Form a hypothesis'})).toBeEnabled();
  await page.screenshot({path:'docs/original-plan-explore.png',fullPage:true});
  await page.getByRole('button',{name:'Form a hypothesis'}).click();
  await expect(page.getByRole('button',{name:'Submit & rewind'})).toBeDisabled();
  await page.getByRole('radio',{name:/A habitat under stress/}).check();
  await page.getByRole('checkbox',{name:/Rainfall records/}).check();
  await page.getByRole('checkbox',{name:/Ancient pollen/}).check();
  await page.getByRole('button',{name:'Submit & rewind'}).click();
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.getByRole('button',{name:'Run the experiment'}).click();
  await page.getByRole('button',{name:/Pause playback/}).click();
  const pausedYear = await page.getByRole('progressbar').getAttribute('value');
  await page.waitForTimeout(400);
  await expect(page.getByRole('progressbar')).toHaveAttribute('value',pausedYear);
  await page.getByRole('button',{name:/Resume playback/}).click();
  await page.getByRole('button',{name:'Finish playback'}).click();
  await expect(page.getByRole('heading',{name:'The valley has a future.'})).toBeVisible();
  await page.screenshot({path:'docs/original-plan-comparison.png',fullPage:true});
  await page.reload();
  await expect(page.getByRole('heading',{name:'The valley has a future.'})).toBeVisible();
  for(const [choice,year] of [['Remove Glasswing predators',24],['Provide emergency food',25]]){
    await page.getByRole('button',{name:'Test another choice'}).click();
    await page.getByRole('radio',{name:new RegExp(choice)}).check();
    await page.getByRole('button',{name:'Run the experiment'}).click();
    await page.getByRole('button',{name:'Finish playback'}).click();
    await expect(page.getByRole('heading',{name:'The silence remains.'})).toBeVisible();
    await expect(page.getByText(new RegExp(`could not prevent extinction in year ${year}`))).toBeVisible();
  }
  await page.getByRole('button',{name:'Reopen the case'}).click();
  await expect(page.getByRole('button',{name:'Form a hypothesis'})).toBeDisabled();
  await page.setViewportSize({width:360,height:800});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.screenshot({path:'docs/original-plan-mobile.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.journal-list>button').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // A malformed local save must not strand the player or bypass investigation.
  await page.evaluate(()=>localStorage.setItem('echoes-last-glasswing-v2','{"version":2,"stage":"verdict","clues":null}'));
  await page.reload();
  await expect(page.getByRole('button',{name:'Begin investigation'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  // Valid legacy progress migrates to v2 without trusting a stored result.
  await page.evaluate(()=>{localStorage.removeItem('echoes-last-glasswing-v2');localStorage.setItem('echoes-last-glasswing-v1',JSON.stringify({version:1,stage:'hypothesis',clues:['rainfall','pollen'],hypothesis:'water',support:['rainfall','pollen'],year:14,intervention:'water',playYear:14,result:{population:9999,extinctionYear:null}}));});
  await page.reload();
  await expect(page.getByRole('radio',{name:/A habitat under stress/})).toBeChecked();
  await expect(page.getByRole('checkbox',{name:/Rainfall records/})).toBeChecked();
  await expect(page.getByRole('button',{name:'Submit & rewind'})).toBeEnabled();
  const migrated=await page.evaluate(()=>JSON.parse(localStorage.getItem('echoes-last-glasswing-v2')));
  expect(migrated.version).toBe(2);expect(migrated.clues).toEqual(['rainfall','pollen']);expect(migrated.result).toBeNull();
  // Duplicate support must not bypass the two-evidence requirement.
  await page.evaluate(()=>localStorage.setItem('echoes-last-glasswing-v2',JSON.stringify({version:2,stage:'rewind',clues:['rainfall'],hypothesis:'water',support:['rainfall','rainfall'],year:14,intervention:'water',playYear:14,result:null})));
  await page.reload();await expect(page.getByRole('button',{name:'Begin investigation'})).toBeVisible();
  expect(errors).toEqual([]);
  console.log('PASS: complete investigation, three interventions, reload, restart, 360px layout, reduced-motion, corrupt save, v1 migration, duplicate evidence rejection; zero JS errors.');
} finally {await browser.close();}
