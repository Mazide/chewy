import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1150,height:1100},reducedMotion:'reduce'});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const origin=process.argv[2]??'http://localhost:6006';
const open=async(id='core-sandbox--welcome')=>page.goto(`${origin}/iframe.html?id=${id}&viewMode=story`);
const b=name=>page.getByRole('button',{name,exact:true});
const saved=()=>page.evaluate(()=>localStorage.getItem('chewy.demo-session.v1'));
const fit=async()=>{const p=page.locator('.study-phone');assert.ok(await p.evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1));const f=await p.boundingBox();for(const control of await page.locator('.onboarding-nav button').all()){const r=await control.boundingBox();assert.ok(r.x>=f.x && r.x+r.width<=f.x+f.width,'navigation stays in phone');}const a=await page.locator('.onboarding-actions .study-primary').boundingBox();assert.ok(a.y+a.height<=f.y+f.height-10,'primary action clears the home indicator');};
try {
 await open('core-sandbox--all-screens');await b('Добавить еду').waitFor();await open();await b('Попробовать на примере').waitFor();const baseline=await saved();
 for(const size of ['compact','standard','large']) {
  await open();await b('Инструменты пробы').click();await page.getByLabel('Размер телефона').selectOption(size);await fit();
  await page.locator('.study-phone').screenshot({path:`/tmp/chewy-draft-hello-${size}.png`});
  await b('Попробовать на примере').click();await fit();await b('Разобрать фото-пример').click();await fit();
  await page.locator('.study-phone').screenshot({path:`/tmp/chewy-draft-result-${size}.png`});
  await b('Назад').click();await b('Разобрать фото-пример').click();await b('К своему Чуви').click();
  // Changing the footer action to submit must not submit the newly mounted form.
  await page.getByRole('heading',{name:'Будем знакомы',exact:true}).waitFor();await fit();
  await page.locator('.study-phone').screenshot({path:`/tmp/chewy-draft-mirror-${size}.png`});
  await b('Изменить имя друга').click();await page.getByLabel('Имя друга').fill('Листик');
  await b('Назад').click();await b('К своему Чуви').click();
  assert.equal(await page.getByLabel('Имя друга').inputValue(),'Листик');
  await page.getByLabel('Имя друга').press('Enter');
  await page.getByRole('region',{name:'Первое фото еды'}).waitFor();
  await page.locator('.sandbox-phone').screenshot({path:`/tmp/chewy-draft-camp-${size}.png`});
  assert.equal(await page.locator('.reward-wallet strong').innerText(),'0 монет');assert.equal(await saved(),baseline);
  await b('Позже').click();await b('Открыть дневник еды за сегодня').click();
  assert.equal(await page.getByRole('list',{name:'Еда сегодня'}).getByRole('listitem').count(),0);
 }
 for(const step of [0,1,2,3]) {await open();if(step>0)await b('Попробовать на примере').click();if(step>1)await b('Разобрать фото-пример').click();if(step>2)await b('К своему Чуви').click();await b('Сразу в лагерь').click();await page.getByRole('region',{name:'Первое фото еды'}).waitFor();assert.equal(await saved(),baseline);}
 await page.getByRole('region',{name:'Первое фото еды'}).getByRole('button',{name:'Добавить еду',exact:true}).click();
 await b('Сфотографировать еду').click();await b('Сохранить и разобрать').click();await b('Рюкзак').waitFor();assert.notEqual(await page.locator('.reward-wallet strong').innerText(),'0 монет');assert.equal(await saved(),baseline);
 await open('deferred-intro--original-welcome');await b('Покажи, как это работает').waitFor();assert.deepEqual(errors,[]);
 console.log('PASS draft: four chapters, three sizes, mirror/name/Enter, back/skip/later, empty camp, first food, isolation, preserved original');
} finally {await browser.close();}
