import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://127.0.0.1:6010';
const url = `${origin}/iframe.html?id=workshop--camp-meals&viewMode=story`;
const output = '/tmp/chewy-camp-meals';
const ids = ['tent','campfire','plants','lamp'];
const key = 'chewy.camp-meal-demo.v1';
const sentinels = { 'chewy.demo-session.v1':'untouched progress', 'chewy.sandbox.placement.v1.growth.v1.separate':'untouched owner layout' };
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ viewport:{ width:1100, height:1050 }, reducedMotion:'reduce' });
await context.addInitScript(values => { for(const [key,value] of Object.entries(values)) localStorage.setItem(key,value); }, sentinels);
const page = await context.newPage();
const errors=[]; page.on('pageerror', error => errors.push(error.message));
const ready = async () => { await page.locator('.meal-camp-add:not(:disabled)').waitFor(); await page.waitForTimeout(220); };
const stages = () => page.locator('[data-component]').evaluateAll(elements => Object.fromEntries(elements.map(element => [element.dataset.component, Number(element.dataset.stage)])));
const hash = async id => {
  await page.locator('.meal-camp-scene').scrollIntoViewIfNeeded();
  const box=await page.locator(`[data-rive-asset=${id}] canvas`).boundingBox(), scene=await page.locator('.meal-camp-scene').boundingBox();
  const x=Math.max(box.x,scene.x,0),y=Math.max(box.y,scene.y,0);
  const clip={x,y,width:Math.min(box.x+box.width,scene.x+scene.width)-x,height:Math.min(box.y+box.height,scene.y+scene.height)-y};
  return createHash('sha256').update(await page.screenshot({clip,path:`${output}/pixels-${id}.png`})).digest('hex');
};
const hashes = async () => { const result={}; for(const id of ids) result[id]=await hash(id); return result; };
const report={ meals:[], widths:[320,390,430], errors };
try {
  await page.goto(url); await ready();
  const initial=await hashes(); let previous=await stages(), previousHashes=initial;
  assert.ok(Object.values(previous).every(value=>value===0));
  await page.locator('.meal-camp-scene').screenshot({path:`${output}/morning.png`});
  for(let meal=1;meal<=3;meal++){
    await page.getByRole('button',{name:'Добавить еду',exact:true}).click(); await page.waitForTimeout(250);
    assert.equal(await page.locator('.meal-camp-scene').getAttribute('data-meal-count'),String(meal));
    const current=await stages(), currentHashes=await hashes();
    for(const [metric,id]of Object.entries({protein:'tent',carbs:'campfire',plants:'plants',fats:'lamp'})){
      assert.ok(current[metric]>=previous[metric]);
      if(current[metric]!==previous[metric]) assert.notEqual(currentHashes[id],previousHashes[id],`${id}: the food changed actual Rive pixels`);
    }
    report.meals.push(current); previous=current; previousHashes=currentHashes;
    await page.locator('.meal-camp-scene').screenshot({path:`${output}/meal-${meal}.png`});
  }
  assert.ok(Object.values(previous).includes(2));
  const saved=await page.evaluate(key=>sessionStorage.getItem(key),key);
  await page.reload(); await ready();
  assert.deepEqual(JSON.parse(await page.evaluate(key=>sessionStorage.getItem(key),key)),JSON.parse(saved));
  assert.deepEqual(await hashes(),previousHashes,'reload restores the same real static poses');
  await page.emulateMedia({reducedMotion:'no-preference'}); await page.waitForTimeout(200);
  const moving=await hash('campfire'); await page.waitForTimeout(270); assert.notEqual(await hash('campfire'),moving);
  await page.getByRole('button',{name:'Пауза',exact:true}).click(); await page.waitForTimeout(200);
  const paused=await hashes(); await page.waitForTimeout(200); assert.deepEqual(await hashes(),paused);
  for(const [device,width] of [['compact',320],['standard',390],['large',430]]){
    await page.setViewportSize({width,height:932}); await page.getByLabel('Размер примерки').selectOption(device); await page.waitForTimeout(230);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.ok(await page.locator('button,select').evaluateAll(elements=>elements.filter(element=>element.getClientRects().length).every(element=>element.getBoundingClientRect().height>=44)));
    await page.screenshot({path:`${output}/${device}.png`,fullPage:true});
  }
  const failRoute='**/exports/lamp.riv';await page.route(failRoute,route=>route.fulfill({status:404,body:'test'}));
  await page.reload();await page.getByRole('button',{name:'Загрузить предметы снова'}).waitFor();
  assert.equal(await page.locator('.meal-camp-add').isDisabled(),true);
  await page.unroute(failRoute);await page.getByRole('button',{name:'Загрузить предметы снова'}).click();await ready();
  assert.deepEqual(JSON.parse(await page.evaluate(key=>sessionStorage.getItem(key),key)),JSON.parse(saved));
  await page.getByRole('button',{name:'Новый день',exact:true}).click();await page.waitForTimeout(750);
  assert.ok(Object.values(await stages()).every(value=>value===0));
  assert.equal(await page.locator('.meal-camp-scene').getAttribute('data-meal-count'),'0');
  assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),Object.keys(sentinels)),sentinels);
  assert.ok(!/\d+\s*(ккал|грамм|%)/iu.test(await page.locator('body').innerText()));
  await page.goto(`${origin}/camp-meals.html`);
  await page.frameLocator('iframe').getByRole('button',{name:'Добавить еду',exact:true}).waitFor();
  assert.deepEqual(errors,[]);await writeFile(`${output}/qa.json`,JSON.stringify(report,null,2)+'\n');
  console.log('PASS: three meals drive real camp states; reload, animation, pause, new day, three widths, failure/retry, isolated storage and public entry.');
}finally{await browser.close();}
