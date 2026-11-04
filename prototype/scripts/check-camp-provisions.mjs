// Fresh context: visual previews must never change the owner's stored session.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'Europe/London', viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const origin = process.argv[2] ?? 'http://localhost:6006';
const url = `${origin}/iframe.html?id=core-sandbox--all-screens&viewMode=story`;
const key = 'chewy.demo-session.v1';
const button = name => page.getByRole('button', { name, exact: true });
const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const bag = () => page.locator('.sandbox-phone [data-scene-object="provisions"]');
const stage = async expected => assert.equal(await bag().locator('[data-provisions-stage]').getAttribute('data-provisions-stage'), expected);
const inspector = async () => { if (await button('Инструменты пробы').isVisible()) await button('Инструменты пробы').click(); };
const contributions = async expected => {
  const actual = await page.locator('.sandbox-phone [data-camp-component]').evaluateAll(els => Object.fromEntries(els.map(el => [el.dataset.campComponent, el.dataset.dailyContribution === 'present'])));
  assert.deepEqual(actual, expected);
};
const empty = { protein: false, carbs: false, fats: false, plants: false };
const chooseFood = async name => {
  await button('Добавить еду').click();
  await button('Галерея').click();
  await button(`Выбрать фото: ${name}`).click();
  await button('Добавить фото · 1').click();
};
const submit = async () => {
  await button('Сохранить и разобрать').click();
  await button('Добавить еду').waitFor();
  await inspector();
  await button('Завершить анализ').click();
};
try {
  await page.clock.install({ time: new Date('2026-11-02T12:00:00Z') });
  await page.goto(url); await button('Инструменты пробы').waitFor();
  await stage('resting'); await contributions(empty);
  assert.equal(await page.locator('.sandbox-phone [data-scene-object="log"]').count(), 1);
  assert.equal(await page.locator('.sandbox-phone [data-scene-object="log"]').getAttribute('data-camp-component'), null);
  assert.equal(await bag().getAttribute('data-camp-component'), 'carbs');
  assert.equal(await page.locator('[data-scene-object="fuel"]').getAttribute('data-camp-component'), 'fats');
  assert.equal(await page.locator('.sandbox-phone [data-scene-object="light"]').count(), 0);
  const noFood = await read();
  await inspector();
  const preview = page.getByLabel('Припасы · визуальная проба');
  for (const value of ['resting', 'first', 'stocked', 'full', 'extra']) {
    await preview.selectOption(value); await stage(value);
    await contributions(empty);
    assert.deepEqual(await read(), noFood, 'preview never changes the session');
    assert.equal(await bag().locator('.camp-provisions').evaluate(el => getComputedStyle(el).filter), 'none');
  }
  await preview.selectOption('auto'); await stage('resting');
  for (const device of ['compact', 'standard', 'large']) {
    await page.getByLabel('Размер телефона').selectOption(device);
    for (const campStage of ['initial', 'developed']) {
      await page.getByLabel('Стадия лагеря').selectOption(campStage);
      const phone = await page.locator('.sandbox-phone').boundingBox();
      const frame = await bag().boundingBox();
      assert.ok(frame.x >= phone.x && frame.x + frame.width <= phone.x + phone.width);
      assert.ok(frame.y >= phone.y && frame.y + frame.height <= phone.y + phone.height);
      // Scene layers deliberately ignore pointer events; inspect painted overlap
      // in the six screenshots rather than attempting a hit test on the art.
      assert.ok(await bag().isVisible());
      await page.locator('.sandbox-phone').screenshot({ path: `/tmp/chewy-provisions-${device}-${campStage}.png` });
    }
  }
  await page.getByLabel('Размер телефона').selectOption('standard');
  await page.getByLabel('Стадия лагеря').selectOption('initial');
  await chooseFood('Завтрак'); await submit();
  await stage('first'); await contributions({ ...empty, carbs: true, plants: true });
  assert.equal(await page.locator('[data-scene-object="fuel"] > .variant-motion').evaluate(el => getComputedStyle(el).filter), 'grayscale(1)');
  const breakfast = await read();
  await chooseFood('Обед');
  await button('Детали').click();
  await page.getByLabel('Что осталось за кадром?').fill('С оливковым маслом');
  await button('Закрыть детали').click();
  await submit();
  await stage('first'); await contributions({ protein: true, carbs: true, fats: true, plants: true });
  assert.equal(await page.locator('[data-scene-object="fuel"] > .variant-motion').evaluate(el => getComputedStyle(el).filter), 'none');
  const completed = await read();
  assert.equal(completed.jobs.length, breakfast.jobs.length + 1);
  await page.locator('.sandbox-phone').screenshot({ path: '/tmp/chewy-provisions-fed.png' });
  await button('Рюкзак').click(); await button('Моё').waitFor();
  await button('В лагерь').click(); await stage('first');
  assert.deepEqual((await read()).inventory, completed.inventory);
  await page.reload(); await button('Инструменты пробы').waitFor(); await stage('first');
  assert.deepEqual((await read()).jobs, completed.jobs);
  await inspector(); await button('Следующий день').click();
  await stage('resting'); await contributions(empty);
  const nextDay = await read();
  assert.deepEqual(nextDay.inventory, completed.inventory);
  assert.deepEqual(nextDay.jobs, completed.jobs);
  assert.deepEqual(nextDay.rewardEvents, completed.rewardEvents);
  await preview.selectOption('extra'); await stage('extra');
  await page.reload(); await button('Инструменты пробы').waitFor(); await stage('resting');
  assert.deepEqual((await read()).inventory, completed.inventory);
  await page.goto(`${origin}/iframe.html?id=core-sandbox--camp-collage&viewMode=story`);
  const movableBag = page.getByRole('button', { name: 'Переместить: Припасы. Можно двигать стрелками.', exact: true });
  await movableBag.waitFor();
  const placementKey = 'chewy.sandbox.placement.v1.growth.v1.separate';
  const placements = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).devices.standard, placementKey);
  const beforeMove = await placements();
  await movableBag.press('ArrowRight');
  const afterMove = await placements();
  assert.equal(afterMove.provisions[0], beforeMove.provisions[0] + 2);
  assert.deepEqual(afterMove.backpack, beforeMove.backpack);
  const movableLog = page.getByRole('button', { name: 'Переместить: Бревно. Можно двигать стрелками.', exact: true });
  await movableLog.press('ArrowLeft');
  const afterLogMove = await placements();
  assert.equal(afterLogMove.log[0], beforeMove.log[0] - 2);
  assert.deepEqual(afterLogMove.provisions, afterMove.provisions);
  await page.reload(); await movableBag.waitFor();
  assert.deepEqual((await placements()).provisions, afterMove.provisions);
  assert.deepEqual((await placements()).log, afterLogMove.log);
  await page.getByLabel('Наполнение припасов', { exact: false }).selectOption('extra');
  await stage('extra');
  await button('Сбросить этот экран').click();
  assert.deepEqual(await placements(), beforeMove, 'reset restores the current camp composition');
  assert.deepEqual((await read()).inventory, completed.inventory);
  assert.deepEqual(errors, []);
  console.log('PASS: separate carb/fat zones, five manual previews without session writes, three phones/two camp stages, food/reload/day reset, inventory and rewards preserved, editable placement persists separately from navigation.');
} finally { await browser.close(); }
