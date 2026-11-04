// Stage 3 acceptance: one successful journey through the phone, with no seeded state.
// A fresh context keeps the owner's session untouched; only reads inspect storage.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { DEMO_GARDEN_COSTS } from '../src/core/demo-config.js';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'Europe/London' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const origin = process.argv[2] ?? 'http://localhost:6006';
const url = `${origin}/iframe.html?id=core-sandbox--all-screens&viewMode=story`;
const key = 'chewy.demo-session.v1';
const button = name => page.getByRole('button', { name, exact: true });
const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const progress = session => ({
  entries: session.entries, rewards: session.rewardEvents, days: session.creditedDays,
  regularity: session.regularity, inventory: session.inventory,
});
const loaded = () => button('Инструменты пробы').waitFor();
const reload = async () => { await page.reload(); await loaded(); };
const inspector = async () => {
  if (await button('Инструменты пробы').isVisible()) await button('Инструменты пробы').click();
};
const components = async expected => assert.deepEqual(
  await page.locator('[data-camp-component]').evaluateAll(elements => Object.fromEntries(
    elements.map(el => [el.dataset.campComponent, el.dataset.dailyContribution === 'present'])
  )), expected
);
const empty = { protein: false, carbs: false, fats: false, plants: false };
const full = { protein: true, carbs: true, fats: true, plants: true };
const appearance = async id => assert.equal(
  await page.locator('[data-camp-component="plants"] [data-garden-appearance]').getAttribute('data-garden-appearance'), id
);
const gallery = async label => {
  await button('Добавить еду').click(); await button('Галерея').click();
  await button(`Выбрать фото: ${label}`).click(); await button('Добавить фото · 1').click();
};
const submit = async () => { await button('Сохранить и разобрать').click(); await button('Рюкзак').waitFor(); };
const finishAnalysis = async () => {
  await page.clock.fastForward(21000);
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).jobs.every(job => job.status === 'ready'), key);
};
try {
  await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
  await page.goto(url); await loaded();
  const clean = await read();
  assert.deepEqual(clean.entries, []); assert.deepEqual(clean.jobs, []);
  assert.deepEqual(clean.rewardEvents, []); assert.deepEqual(clean.creditedDays, []);
  assert.deepEqual(clean.inventory, { coins: 0, owned: [], applied: {} });
  await components(empty); await appearance('garden-base');

  // Reward and the day are saved before analysis; another frame is the same entry.
  await button('Добавить еду').click(); await button('Сфотографировать еду').click();
  const firstPhoto = await read();
  assert.equal(firstPhoto.entries.length, 1); assert.equal(firstPhoto.jobs.length, 0);
  assert.equal(firstPhoto.rewardEvents.length, 1); assert.equal(firstPhoto.creditedDays.length, 1);
  assert.ok(firstPhoto.inventory.coins > 0);
  assert.match(await page.locator('.reward-receipt').innerText(), /→/);
  await button('Сфотографировать еду').click();
  assert.deepEqual(progress(await read()), progress(firstPhoto));
  await button('Детали').click();
  await page.getByLabel('Что осталось за кадром?').fill('С оливковым маслом');
  await button('Закрыть детали').click(); await submit();
  const pending = await read();
  assert.equal(pending.jobs.length, 1); assert.equal(pending.jobs[0].photos.length, 2);
  assert.equal(pending.jobs[0].id, firstPhoto.entries[0].id);
  assert.equal(pending.jobs[0].status, 'processing');
  assert.deepEqual(progress(pending), progress(firstPhoto));
  await components(empty);

  // Leaving and reloading restores the actual task; its timer produces the answer.
  await page.goto('about:blank'); await page.goto(url); await loaded(); await reload();
  assert.deepEqual((await read()).jobs, pending.jobs);
  await finishAnalysis(); await components(full);
  assert.deepEqual(progress(await read()), progress(firstPhoto));
  await page.locator('.capture-notice').click();
  await page.getByRole('heading', { name: 'Овощи с гарниром', exact: true }).waitFor();
  await button('В лагерь').click();
  await button('Открыть дневник еды за сегодня').click();
  const today = page.getByRole('list', { name: 'Еда сегодня' });
  assert.equal(await today.getByRole('listitem').count(), 1);
  await today.getByRole('button', { name: /Овощи с гарниром/ }).click();
  await button('В лагерь').click();
  assert.deepEqual(progress(await read()), progress(firstPhoto));

  // The next meal earns coins but does not add another day or step.
  await gallery('Завтрак');
  const secondPhoto = await read();
  assert.equal(secondPhoto.rewardEvents.length, 2); assert.equal(secondPhoto.creditedDays.length, 1);
  assert.equal(secondPhoto.regularity.multiplier, firstPhoto.regularity.multiplier);
  assert.ok(secondPhoto.inventory.coins > firstPhoto.inventory.coins);
  await submit(); await finishAnalysis(); await components(full);
  await button('Открыть дневник еды за сегодня').click();
  assert.equal(await today.getByRole('listitem').count(), 2);
  await button('Свернуть дневник').click();

  // Purchase, cancel preview, then apply: three distinct effects in the same session.
  await button('Рюкзак').click(); await button('Магазин').click();
  assert.equal(await button('Примерить').count(), 0);
  await button(`Купить · ${DEMO_GARDEN_COSTS.flowers} монет`).click();
  await button(`Купить за ${DEMO_GARDEN_COSTS.flowers} монет`).click();
  const bought = await read();
  assert.equal(bought.inventory.coins, secondPhoto.inventory.coins - DEMO_GARDEN_COSTS.flowers);
  assert.deepEqual(bought.inventory.owned, ['flowers']); assert.deepEqual(bought.inventory.applied, {});
  await button('Примерить').click(); await button('Отменить примерку').last().click();
  assert.deepEqual(progress(await read()), progress(bought));
  await button('В лагерь').click(); await appearance('garden-base');
  await button('Рюкзак').click(); await button('Выбрать: Цветы').click();
  await button('Примерить').click(); await button('Применить').click();
  await button('В лагерь').click(); await appearance('flowers');
  const applied = await read();
  assert.equal(applied.inventory.coins, bought.inventory.coins);
  assert.equal(applied.inventory.applied.garden, 'flowers');
  await reload(); await appearance('flowers'); await components(full);
  assert.deepEqual(progress(await read()), progress(applied));
  assert.deepEqual((await read()).jobs, applied.jobs);

  // The next day starts empty. Its first photo advances once using the higher multiplier.
  await inspector(); await button('Следующий день').click();
  await components(empty); await appearance('flowers');
  assert.deepEqual(progress(await read()), progress(applied));
  await button('Открыть дневник еды за сегодня').click();
  assert.equal(await today.count(), 0); await button('Свернуть дневник').click();
  await gallery('Завтрак');
  const nextDay = await read();
  assert.equal(nextDay.rewardEvents.length, 3); assert.equal(nextDay.creditedDays.length, 2);
  assert.ok(nextDay.regularity.multiplier > applied.regularity.multiplier);
  assert.equal(nextDay.rewardEvents.at(-1).multiplier, nextDay.regularity.multiplier);
  await submit(); await finishAnalysis();
  await components({ ...empty, carbs: true, plants: true }); await appearance('flowers');
  await button('Открыть дневник еды за сегодня').click();
  assert.equal(await today.getByRole('listitem').count(), 1); await button('Свернуть дневник').click();

  // Visit yesterday without changing today's camp, money or position on the road.
  await button('Путь').click();
  assert.equal(await page.locator('.forest-stop-today').getAttribute('data-stop-index'), '2');
  const previousStop = page.locator('[data-stop-index="1"]');
  await previousStop.evaluate(el => el.scrollIntoView({ block: 'center' })); await previousStop.click();
  await button('Открыть день').click();
  assert.equal(await page.locator('.journey-day').getAttribute('data-history-day'), firstPhoto.creditedDays[0]);
  assert.equal(await page.getByRole('list', { name: 'Еда за выбранный день' }).getByRole('listitem').count(), 2);
  assert.deepEqual(await page.locator('.nutrition-supply-existing').evaluateAll(elements => elements.map(el => el.style.width)), ['100%', '100%', '100%', '100%']);
  await page.getByRole('button', { name: /Овощи с гарниром/ }).click(); await button('К дню').click();
  assert.equal(await page.locator('.journey-day').getAttribute('data-history-day'), firstPhoto.creditedDays[0]);
  await button('К пути').click();
  assert.equal(await page.locator('[aria-pressed="true"][data-stop-index]').getAttribute('data-stop-index'), '1');
  assert.equal(await page.locator('.forest-stop-today').getAttribute('data-stop-index'), '2');
  await button('В лагерь').click(); await reload();
  await components({ ...empty, carbs: true, plants: true }); await appearance('flowers');
  assert.deepEqual(progress(await read()), progress(nextDay));
  assert.equal((await read()).jobs.length, 3);

  // Full reset is reproducible after this populated flow; workbench time is preserved.
  const clockBeforeReset = await page.evaluate(key => localStorage.getItem(`${key}.clock`), key);
  assert.ok(clockBeforeReset);
  await inspector(); await button('Сбросить демосессию').click(); await button('Отмена').click();
  assert.deepEqual(progress(await read()), progress(nextDay));
  await button('Сбросить демосессию').click(); await button('Сбросить и начать заново').click();
  await reload();
  const reset = await read();
  assert.deepEqual(progress(reset), progress(clean)); assert.deepEqual(reset.jobs, []);
  assert.equal(await page.evaluate(key => localStorage.getItem(`${key}.clock`), key), clockBeforeReset);
  await components(empty); await appearance('garden-base');
  await button('Путь').click();
  assert.equal(await page.locator('.forest-stop-today').getAttribute('data-stop-index'), '0');
  assert.equal(await button('Открыть день').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: stage 3 clean-session full flow, immediate reward/two photos, task restore/timed completion, result/Today, second meal, purchase/preview/cancel/apply/reload, next-day multiplier/contribution, past-day return without rewinding, reset/cancel/reload with preserved workbench clock; no JavaScript errors.');
} finally { await browser.close(); }
