// Fresh browser context; no writes to the owner's Storybook session.
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
const inventory = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).inventory, key);
const choose = name => button(`Выбрать: ${name}`).click();
const campAppearance = async id => assert.equal(await page.locator('[data-camp-component="plants"] [data-garden-appearance]').getAttribute('data-garden-appearance'), id);
const inspector = async () => { if (await button('Инструменты пробы').isVisible()) await button('Инструменты пробы').click(); };
const reload = async () => { await page.reload(); await button('Инструменты пробы').waitFor(); };
const earn = async () => {
  await button('Добавить еду').click(); await button('Сфотографировать еду').click();
  await button('Сохранить и разобрать').click(); await button('Рюкзак').waitFor();
};
const purchase = async id => {
  await button(`Купить · ${DEMO_GARDEN_COSTS[id]} монет`).click();
  await button(`Купить за ${DEMO_GARDEN_COSTS[id]} монет`).click();
};
try {
  await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
  await page.goto(url); await button('Инструменты пробы').waitFor();
  await campAppearance('garden-base');
  assert.deepEqual(await inventory(), { coins: 0, owned: [], applied: {} });
  await button('Рюкзак').click(); await button('Магазин').click();
  assert.equal(await page.locator('.backpack-camp-preview').count(), 0);
  assert.equal(await button('Примерить').count(), 0);
  assert.ok(await button(`Купить · ${DEMO_GARDEN_COSTS.flowers} монет`).isDisabled());
  await choose('Цветник');
  assert.ok(await button(`Купить · ${DEMO_GARDEN_COSTS['garden-bloom']} монет`).isDisabled());
  await button('В лагерь').click(); await earn();
  const earned = (await inventory()).coins;
  await button('Рюкзак').click(); await button('Магазин').click();
  await button(`Купить · ${DEMO_GARDEN_COSTS.flowers} монет`).click();
  await button('Отмена').click(); assert.equal((await inventory()).coins, earned);
  await button(`Купить · ${DEMO_GARDEN_COSTS.flowers} монет`).click();
  // A storage refusal must not claim a purchase or close its retryable dialog.
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) { Storage.prototype.setItem = original; throw new Error('test write failure'); }
      return original.call(this, name, value);
    };
  }, key);
  await button(`Купить за ${DEMO_GARDEN_COSTS.flowers} монет`).click();
  assert.match(await page.getByRole('dialog').innerText(), /не удалось сохранить/);
  assert.equal((await inventory()).coins, earned);
  await button(`Купить за ${DEMO_GARDEN_COSTS.flowers} монет`).click();
  const bought = await inventory();
  assert.equal(bought.coins, earned - DEMO_GARDEN_COSTS.flowers);
  assert.deepEqual(bought.owned, ['flowers']); assert.deepEqual(bought.applied, {});
  assert.equal(await button('Моё').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.backpack-camp-preview').count(), 0);
  await button('Примерить').click();
  assert.equal(await page.locator('.backpack-camp-preview [data-garden-appearance]').getAttribute('data-garden-appearance'), 'flowers');
  assert.deepEqual(await inventory(), bought);
  await page.keyboard.press('Escape');
  assert.ok(await button('Примерить').evaluate(el => el === document.activeElement));
  assert.deepEqual(await inventory(), bought);
  await button('В лагерь').click(); await campAppearance('garden-base');
  await reload(); assert.deepEqual(await inventory(), bought); await campAppearance('garden-base');
  await button('Рюкзак').click(); await choose('Цветы'); await button('Примерить').click();
  await button('Применить').click();
  assert.ok(await button('Выбрать: Цветы').evaluate(el => el === document.activeElement));
  const applied = await inventory(); assert.equal(applied.applied.garden, 'flowers');
  assert.equal(applied.coins, bought.coins);
  await button('В лагерь').click(); await campAppearance('flowers');
  assert.equal(await page.locator('[data-camp-component="plants"]').getAttribute('data-daily-contribution'), 'none');
  await reload(); await campAppearance('flowers');
  await inspector(); await button('Завершить анализ').click();
  await campAppearance('flowers');
  assert.equal(await page.locator('[data-camp-component="plants"]').getAttribute('data-daily-contribution'), 'present');
  await button('Следующий день').click(); await campAppearance('flowers');
  assert.equal(await page.locator('[data-camp-component="plants"]').getAttribute('data-daily-contribution'), 'none');
  await earn(); await button('Рюкзак').click(); await button('Магазин').click(); await choose('Пышный сад');
  await purchase('garden-lush');
  assert.equal((await inventory()).applied.garden, 'flowers');
  await button('Примерить').click(); await button('Отменить примерку').last().click();
  assert.equal((await inventory()).applied.garden, 'flowers');
  await button('Примерить').click();
  for (const size of ['compact', 'standard', 'large']) {
    await inspector(); await page.getByLabel('Размер телефона').selectOption(size);
    const phone = await page.locator('.study-screen-backpack').boundingBox();
    const wallet = await page.locator('.backpack-heading .reward-wallet').boundingBox();
    const title = await page.locator('.backpack-heading h1').boundingBox();
    assert.ok(wallet.x + wallet.width <= phone.x + phone.width);
    assert.ok(title.x + title.width <= wallet.x);
    for (const action of [button('Применить'), button('Отменить примерку').last()]) {
      const rect = await action.boundingBox();
      assert.ok(rect.y >= phone.y && rect.y + rect.height <= phone.y + phone.height);
    }
    await page.locator('.study-screen-backpack').screenshot({ path: `/tmp/chewy-backpack-preview-${size}.png` });
  }
  await button('Применить').click();
  const switched = await inventory(); assert.equal(switched.applied.garden, 'garden-lush');
  assert.deepEqual(switched.owned, ['flowers', 'garden-lush']);
  await button('Магазин').click(); await choose('Цветы');
  assert.equal(await page.getByRole('button', { name: /^Купить/ }).count(), 0);
  await button('Моё').click(); await choose('Базовый сад'); await button('Примерить').click(); await button('Применить').click();
  assert.equal((await inventory()).applied.garden, null);
  assert.equal((await inventory()).coins, switched.coins);
  await choose('Пышный сад'); await button('Примерить').click(); await button('Применить').click();
  await page.getByLabel('Размер телефона').selectOption('compact');
  await page.locator('.study-screen-backpack').screenshot({ path: '/tmp/chewy-backpack-owned-compact.png' });
  await button('Магазин').click(); await choose('Цветник');
  await page.locator('.study-screen-backpack').screenshot({ path: '/tmp/chewy-backpack-shop-compact.png' });
  await button('В лагерь').click(); await reload(); await campAppearance('garden-lush');
  assert.deepEqual(await inventory(), switched);
  const savedBeforeStory = await inventory();
  await page.goto(`${origin}/iframe.html?id=core-sandbox--backpack&viewMode=story`);
  await button('Моё').waitFor(); await choose('Базовый сад'); await button('Примерить').click(); await button('Применить').click();
  assert.deepEqual(await inventory(), savedBeforeStory);
  await button('Магазин').click(); await choose('Пышный сад'); await purchase('garden-lush');
  assert.deepEqual(await inventory(), savedBeforeStory);
  assert.deepEqual(errors, []);
  console.log('PASS: earned balance, unavailable purchase, saved purchase without apply, storage retry, owned-only preview, cancel/focus, apply/switch/base/reload, daily contribution independent, isolated fixture, three sizes.');
} finally { await browser.close(); }
