// Capture the actual Rive viewer for owner review.
import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const directory='/tmp/chewy-camp-states-video';await mkdir(directory,{recursive:true});
const context=await browser.newContext({viewport:{width:1120,height:1510},recordVideo:{dir:directory,size:{width:1120,height:1510}},reducedMotion:'no-preference'});
const page=await context.newPage();
try{
  await page.goto(`${process.argv[2]??'http://127.0.0.1:6010'}/camp-states/states.html`);
  await page.waitForFunction(()=>window.chewyCampStates&&Object.values(window.chewyCampStates.state()).every(entry=>entry.ready));
  await page.waitForTimeout(1500);
  for(let stage=1;stage<3;stage++){
    await page.locator('.all-stages button').nth(stage).click();
    await page.waitForTimeout(2300);
  }
  await page.getByRole('button',{name:'Новый день · в начало'}).click();
  await page.waitForTimeout(2300);
}finally{
  await context.close();
  await copyFile(await page.video().path(),`${directory}/review.webm`);
  await browser.close();
}
