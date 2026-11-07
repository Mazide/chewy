import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1500,height:1260},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${process.argv[2]??'http://127.0.0.1:6010'}/camp-states/compare.html`);
  await page.waitForFunction(()=>window.sheetReady||window.sheetErrors?.length);
  if((await page.evaluate(()=>window.sheetErrors)).length)throw Error(await page.evaluate(()=>window.sheetErrors.join(', ')));
  await page.waitForTimeout(250);
  for(let row=0;row<4;row++){
    const hashes=[];for(let col=0;col<3;col++){const pixels=await page.locator('tbody tr').nth(row).locator('canvas').nth(col).screenshot();hashes.push(createHash('sha256').update(pixels).digest('hex'));}
    assert.equal(new Set(hashes).size,3,`row ${row}: all three poses must differ`);
  }
  await page.screenshot({path:'../docs/exports/chewy-camp-three-states-2026-11-06.png',fullPage:true});
  if(errors.length)throw Error(errors.join(', '));
  console.log('Captured all 12 actual Rive states.');
}finally {await browser.close();}
