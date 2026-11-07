// Real runtime and rendered-frame checks in an isolated browser context.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin=process.argv[2]??'http://127.0.0.1:6010';
const output='/tmp/chewy-camp-states';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1120,height:1100},reducedMotion:'reduce'});
const sentinels={'chewy.demo-session.v1':'untouched session','chewy.sandbox.placement.v1.growth.v1.separate':'untouched layout'};
await context.addInitScript(values=>{for(const [key,value]of Object.entries(values))localStorage.setItem(key,value);},sentinels);
const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
const ids=['tent','campfire','plants','lamp'];
const hash=async id=>createHash('sha256').update(await page.locator(`[data-asset=${id}] canvas`).screenshot()).digest('hex');
const ready=async target=>{try{await target.waitForFunction(()=>window.chewyCampStates&&Object.values(window.chewyCampStates.state()).every(item=>item.ready));}catch(error){console.error(await target.evaluate(()=>({state:window.chewyCampStates?.state(),text:document.body.innerText})));console.error(errors);throw error;}};
const set=async(id,stage)=>{await page.evaluate(({id,stage})=>window.chewyCampStates.set(id,stage),{id,stage});await page.waitForTimeout(120);};
const report={states:{},widths:[320,390,430],errors};
try{
  await page.goto(`${origin}/camp-states/states.html`);await ready(page);await page.waitForTimeout(250);
  const initialHashes={};for(const id of ids)initialHashes[id]=await hash(id);
  await page.screenshot({path:`${output}/first.png`,fullPage:true});
  for(const id of ids){
    const hashes=[];
    for(let stage=0;stage<3;stage++){
      await set(id,stage);
      assert.equal(await page.evaluate(id=>window.chewyCampStates.state()[id].stage,id),stage);
      hashes.push(await hash(id));
      await page.locator(`[data-asset=${id}] .canvas-wrap`).screenshot({path:`${output}/${id}-${stage}.png`});
    }
    assert.equal(new Set(hashes).size,3,`${id}: three distinct real Rive states`);
    assert.equal(hashes[0],initialHashes[id],`${id}: initial frame is actually the first state`);
    const frozen=await hash(id);await page.waitForTimeout(180);
    assert.equal(await hash(id),frozen,`${id}: reduced motion freezes actual pixels`);
    await set(id,0);
    assert.equal(await hash(id),hashes[0],`${id}: return to first stage leaves no stale detail`);
    report.states[id]={distinct:3,stableOnPause:true,cleanReturn:true};
  }
  await set('tent',1);await set('lamp',2);
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(window.chewyCampStates.state()).map(([k,v])=>[k,v.stage]))),{tent:1,campfire:0,plants:0,lamp:2});
  await page.evaluate(()=>window.chewyCampStates.setAll(2));await page.waitForTimeout(200);
  await page.screenshot({path:`${output}/full.png`,fullPage:true});
  await page.evaluate(()=>window.chewyCampStates.resume());await page.waitForTimeout(220);
  for(const id of ids){const before=await hash(id);await page.waitForTimeout(210);assert.notEqual(await hash(id),before,`${id}: actual vector motion`);}
  await page.getByRole('button',{name:'Пауза',exact:true}).click();
  await page.getByRole('button',{name:'Новый день · в начало',exact:true}).click();await page.waitForTimeout(200);
  assert.ok(await page.evaluate(()=>Object.values(window.chewyCampStates.state()).every(v=>v.stage===0)));
  for(const width of report.widths){
    await page.setViewportSize({width,height:844});await page.waitForTimeout(120);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.ok(await page.locator('button').evaluateAll(buttons=>buttons.filter(b=>b.getClientRects().length).every(b=>b.getBoundingClientRect().height>=44)));
    await page.screenshot({path:`${output}/mobile-${width}.png`,fullPage:true});
  }
  assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(sentinels)),sentinels);
  const failure=await context.newPage();failure.on('pageerror',error=>errors.push(error.message));
  const route='**/exports/plants.riv';await failure.route(route,r=>r.fulfill({status:404,body:'test'}));
  await failure.goto(`${origin}/camp-states/states.html`);await failure.locator('[data-asset=plants] [role=alert]').waitFor();
  await failure.unroute(route);await failure.locator('[data-asset=plants]').getByRole('button',{name:'Загрузить снова'}).click();await ready(failure);await failure.close();
  await page.goto(`${origin}/iframe.html?id=workshop--camp-states&viewMode=story`);
  await page.frameLocator('iframe[title="Лагерь: три состояния предметов в Rive"]').locator('[data-asset=tent] canvas').waitFor();
  assert.deepEqual(errors,[]);await writeFile(`${output}/qa.json`,JSON.stringify(report,null,2)+'\n');
  console.log('PASS: four Rive assets, three distinct states each, independent controls, actual motion, reduced motion, pause, clean new day, three mobile widths, recovery, isolated storage, Storybook.');
}finally{await browser.close();}
