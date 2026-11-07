import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir,writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { waitForSession } from './lib/session-ui.mjs';
import { dailyCampStages } from '../src/core/camp-daily-states.js';
import { captureDay } from '../src/core/capture-session.js';
const origin=process.argv[2]??'http://127.0.0.1:6010';
const output='/tmp/chewy-camp-integrated';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1100,height:1100},reducedMotion:'reduce',timezoneId:'Europe/London'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const button=name=>page.getByRole('button',{name,exact:true});
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('chewy.demo-session.v1')));
const stages=()=>page.locator('[data-camp-component]').evaluateAll(els=>Object.fromEntries(els.map(el=>[el.dataset.campComponent,Number(el.dataset.dailyStage)])));
const pixelHash = async id => {
  await page.locator('.sandbox-phone').scrollIntoViewIfNeeded();
  const box=await page.locator(`[data-rive-asset=${id}] canvas`).boundingBox(), scene=await page.locator('.sandbox-phone').boundingBox();
  const x=Math.max(box.x,scene.x,0),y=Math.max(box.y,scene.y,0);
  const clip={x,y,width:Math.min(box.x+box.width,scene.x+scene.width)-x,height:Math.min(box.y+box.height,scene.y+scene.height)-y};
  return createHash('sha256').update(await page.screenshot({clip,path:`${output}/pixels-${id}.png`})).digest('hex');
};
const allPixels=async()=>{const result={};for(const id of ['tent','campfire','plants','lamp'])result[id]=await pixelHash(id);return result;};
const url=`${origin}/iframe.html?id=core-sandbox--all-screens&viewMode=story`;
const report={meals:[],errors};
try{
 await page.goto(url);await waitForSession(page);await page.locator('[data-rive-asset=lamp] canvas').waitFor();await page.waitForTimeout(800);
 await page.locator('.sandbox-phone').screenshot({path:`${output}/morning.png`});
 await button('Инструменты пробы').click();assert.equal(await page.getByLabel('Ответ анализа',{exact:true}).inputValue(),'random');
 let previous=await stages(), pixels=await allPixels();assert.ok(Object.values(previous).every(x=>x===0));
 for(let i=1;i<=3;i++){
  await button('Добавить еду').click();await button('Сфотографировать еду').click();await button('Сохранить и разобрать').click();await button('Рюкзак').waitFor();
  assert.deepEqual(await stages(),previous,'pending analysis leaves the prior camp intact');
  await button('Завершить анализ').click();await page.waitForFunction(count=>JSON.parse(localStorage.getItem('chewy.demo-session.v1')).jobs.filter(j=>j.status==='ready').length===count,i);await page.waitForTimeout(400);
  const saved=await read(),current=await stages(),nextPixels=await allPixels();assert.equal(saved.jobs.length,i);assert.equal(saved.jobs.at(-1).mockOutcome,'random');
  assert.deepEqual(current,dailyCampStages(captureDay(saved.jobs).meals));
  for(const[metric,id]of Object.entries({protein:'tent',carbs:'campfire',fats:'lamp',plants:'plants'}))if(current[metric]!==previous[metric])assert.notEqual(nextPixels[id],pixels[id],`${id} pixels update`);
  previous=current;pixels=nextPixels;report.meals.push(current);
  await page.locator('.sandbox-phone').screenshot({path:`${output}/meal-${i}.png`});
 }
 assert.ok(Object.values(previous).includes(2));const saved=await read();await page.reload();await waitForSession(page);await page.waitForTimeout(800);
 assert.deepEqual((await read()).jobs,saved.jobs);assert.deepEqual(await stages(),previous);assert.deepEqual(await allPixels(),pixels,'reload restores actual poses');
 await button('Открыть дневник еды за сегодня').click();assert.equal(await page.getByRole('list',{name:'Еда сегодня'}).getByRole('listitem').count(),3);
 await page.getByRole('list',{name:'Еда сегодня'}).getByRole('button').first().click();await page.getByText('Тестовый состав',{exact:true}).waitFor();await button('В лагерь').click();await page.waitForTimeout(500);assert.deepEqual((await read()).jobs.map(j=>j.result),saved.jobs.map(j=>j.result));
 await button('Инструменты пробы').click();await button('Следующий день').click();await page.waitForTimeout(700);assert.ok(Object.values(await stages()).every(x=>x===0));assert.deepEqual((await read()).jobs,saved.jobs.map(j=>({...j,seen:j.seen||j.id===saved.jobs[0].id})));assert.deepEqual((await read()).inventory,saved.inventory);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(100);const before=await pixelHash('campfire');await page.waitForTimeout(300);assert.notEqual(await pixelHash('campfire'),before);
 assert.deepEqual(errors,[]);await writeFile(`${output}/qa.json`,JSON.stringify(report,null,2));console.log('PASS: real capture/analysis flow, three saved random meals, actual Rive pixels, reload, journal, new day, inventory and motion.');
}finally{await page.screenshot({path:`${output}/last.png`,fullPage:true}).catch(()=>{});await browser.close();}
