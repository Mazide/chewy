import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createDemoSession } from '../src/core/demo-session.js';

// Isolated browser storage never modifies the owner's prototype.
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion:'reduce', timezoneId:'Europe/London', viewport:{width:1200,height:1100} });
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
const origin = process.argv[2] ?? 'http://localhost:6006';
const main = `${origin}/iframe.html?id=core-sandbox--all-screens&viewMode=story`;
const key = 'chewy.demo-session.v1';
const button = name => page.getByRole('button', {name,exact:true});
const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const loaded = async () => { await button('Инструменты пробы').waitFor(); await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.version === 2, key); };
const inspect = async () => { if (await button('Инструменты пробы').isVisible()) await button('Инструменты пробы').click(); };
const send = async (kind, amount) => {
  await page.getByLabel('Вид активности').selectOption(kind);
  await page.getByLabel(kind === 'steps' ? 'Сумма шагов за день' : 'Минуты активности за день').fill(String(amount));
  await button('Передать активность').click();
};
const openRoute = async () => { await button('Путь').click(); await button('Исследовать рядом').click(); };
const choose = name => page.getByRole('button', {name:new RegExp(`^${name} `)}).click();
const appearance = () => page.locator('.sandbox-world-object .hero-appearance');
const visualCheck = async label => {
  const phone = page.locator('.study-device-host > .study-phone');
  for (const size of ['compact','standard','large']) {
    await page.getByLabel('Размер телефона').selectOption(size);
    assert.ok(await phone.evaluate(el => el.scrollWidth <= el.clientWidth+1), `${label}: horizontal overflow`);
    assert.ok(await phone.evaluate(el => el.scrollHeight <= el.clientHeight+1), `${label}: frame overflow`);
    await phone.screenshot({path:`/tmp/chewy-${label}-${size}.png`});
  }
};
const previous = createDemoSession(); delete previous.exploration; previous.version = 1;
previous.inventory = {coins:80,owned:['flowers'],applied:{garden:'flowers'}};
const legacy = JSON.stringify(previous);
try {
  await page.clock.install({time:new Date('2026-10-29T12:00:00Z')});
  await page.goto(`${origin}/iframe.html`);
  await page.evaluate(({key,legacy}) => localStorage.setItem(key,legacy), {key,legacy});
  await page.goto(main); await loaded();
  assert.equal(await page.evaluate(key => localStorage.getItem(`${key}.before-exploration-v1`),key),legacy);
  assert.deepEqual((await read()).inventory,previous.inventory);
  await openRoute(); await choose('Тихий берег'); await inspect(); await send('steps',500);
  await send('cycling',5); await send('cycling',2); await send('cycling',5);
  assert.equal((await read()).exploration.progress.brook,500);
  await page.reload(); await loaded(); await openRoute();
  assert.equal((await read()).exploration.selectedRouteId,'brook');
  await button('К карте').click(); await button('В лагерь').click();
  await button('Добавить еду').click(); await button('Сфотографировать еду').click();
  await button('Сохранить и разобрать').click(); await button('Рюкзак').waitFor();
  const withFood = await read(); assert.equal(withFood.creditedDays.length,1);
  await openRoute(); assert.equal(await page.locator('.exploration-origin').count(),1);
  assert.equal((await read()).exploration.originStops.brook,0);
  await inspect(); await button('Следующий день').click();
  await page.getByLabel('Состояние источника').selectOption('no-data');
  assert.ok(await button('Передать активность').isDisabled());
  await page.getByLabel('Состояние источника').selectOption('sample'); await send('cycling',15);
  assert.deepEqual((await read()).exploration.found,['hat-bucket']);
  assert.deepEqual((await read()).creditedDays,withFood.creditedDays);
  assert.equal((await read()).inventory.coins,withFood.inventory.coins);
  await visualCheck('integrated-exploration'); await button('Рассмотреть находку').click();
  await page.getByRole('heading',{name:'Панама у берега',exact:true}).waitFor();
  await button('Примерить').click();
  await page.locator('.found-wardrobe-actions').getByRole('button',{name:'Отменить примерку',exact:true}).click();
  assert.equal((await read()).inventory.applied.headwear,undefined);
  await button('Примерить').click(); await button('Надеть').click();
  assert.equal((await read()).inventory.applied.headwear,'hat-bucket');
  await visualCheck('wardrobe'); await button('В рюкзак').click(); await button('В лагерь').click();
  assert.equal(await appearance().getAttribute('data-headwear'),'hat-bucket');
  assert.equal(await page.locator('[data-camp-component="plants"] [data-garden-appearance]').getAttribute('data-garden-appearance'),'flowers');
  await page.locator('.sandbox-phone').screenshot({path:'/tmp/chewy-hat-camp.png'});
  await page.reload(); await loaded(); assert.equal(await appearance().getAttribute('data-headwear'),'hat-bucket');
  await openRoute(); await choose('Сосновая тропа'); await inspect();
  assert.equal((await read()).exploration.originStops.pines,1);
  await send('swimming',15); assert.equal((await read()).exploration.progress.pines,0);
  await button('Следующий день').click(); await send('swimming',20);
  assert.deepEqual((await read()).exploration.found,['hat-bucket','hat-trail']);
  await button('К карте').click(); await button('В лагерь').click();
  for (const size of ['compact','standard','large']) {
    await page.getByLabel('Размер телефона').selectOption(size);
    const notice = await page.locator('.exploration-camp-notice').boundingBox();
    for (const control of ['Путь','Рюкзак']) {
      const target = await button(control).boundingBox();
      assert.ok(notice.x + notice.width <= target.x || notice.y + notice.height <= target.y || target.y + target.height <= notice.y, 'finding notice must not cover navigation');
    }
    const capture = await page.locator('.capture-notice').boundingBox();
    if (capture) assert.ok(capture.y + capture.height <= notice.y, 'finding and food notices must not overlap');
    await page.locator('.sandbox-phone').screenshot({path:`/tmp/chewy-finding-notice-${size}.png`});
  }
  // The ordinary backpack entry also acknowledges findings.
  await button('Рюкзак').click(); await button('Находки').click();
  assert.deepEqual((await read()).exploration.seenFindings,['hat-bucket','hat-trail']);
  await button('В рюкзак').click(); await button('В лагерь').click();
  assert.equal(await page.locator('.exploration-camp-notice').count(),0);
  await openRoute(); await button('Рассмотреть находку').click();
  await page.getByRole('heading',{name:'Походная шляпа',exact:true}).waitFor();
  assert.equal(await page.locator('.found-wardrobe-collection button').count(),2);
  await button('Примерить').click(); await button('Надеть').click(); await button('Снять головной убор').click();
  assert.equal((await read()).inventory.applied.headwear,null);
  assert.ok((await read()).inventory.owned.includes('hat-trail'));
  assert.ok((await read()).inventory.owned.includes('flowers'));
  await page.evaluate(key => {
    const original=Storage.prototype.setItem;
    window.restoreExplorationStorage=()=>{Storage.prototype.setItem=original;};
    Storage.prototype.setItem=function(k,value){if(k===key)throw new Error('simulated write failure');return original.call(this,k,value);};
  },key);
  await button('Примерить').click(); await button('Надеть').click();
  assert.equal((await read()).inventory.applied.headwear,null);
  assert.equal(await page.locator('.found-wardrobe-actions [role="alert"]').count(),1);
  await page.evaluate(()=>window.restoreExplorationStorage()); await button('Надеть').click();
  assert.equal((await read()).inventory.applied.headwear,'hat-trail');
  await button('В рюкзак').click(); await button('В лагерь').click();
  const saved=await read(), isolated=await context.newPage();
  isolated.on('pageerror',error=>errors.push(error.message));
  await isolated.goto(`${origin}/iframe.html?id=workshop--exploration&viewMode=story`);
  await isolated.getByRole('button',{name:'Исследовать окрестности',exact:true}).click();
  await isolated.getByRole('button',{name:/^Тихий берег /}).click();
  await isolated.getByLabel('Вид активности').selectOption('other');
  await isolated.getByLabel('Минуты активности за день').fill('20');
  await isolated.getByRole('button',{name:'Передать активность',exact:true}).click();
  await isolated.getByRole('button',{name:'Рассмотреть находку',exact:true}).click();
  await isolated.getByRole('button',{name:'Примерить',exact:true}).click();
  await isolated.getByRole('button',{name:'Надеть',exact:true}).click();
  assert.deepEqual((await read()).exploration,saved.exploration);
  assert.deepEqual((await read()).inventory,saved.inventory); await isolated.close();
  await inspect(); await button('Сбросить демосессию').click(); await button('Сбросить и начать заново').click();
  assert.deepEqual((await read()).exploration,createDemoSession().exploration);
  assert.deepEqual((await read()).inventory,createDemoSession().inventory);
  await page.reload(); await loaded(); assert.deepEqual((await read()).exploration.found,[]);
  assert.deepEqual(errors,[]);
  console.log('PASS: migration, integrated activity/hats, new day/stop, duplicates, all activity types, preview/equip/remove, write failure, reload, three sizes, workshop isolation and reset');
} finally {await context.close();await browser.close();}
