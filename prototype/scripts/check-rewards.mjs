// Run against a local Storybook: node scripts/check-rewards.mjs [http://localhost:6006]
// Each run has a fresh browser context and never touches the owner's session.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { DEMO_REWARDS } from '../src/core/demo-config.js';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'Europe/London' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const origin = process.argv[2] ?? 'http://localhost:6006';
const url = `${origin}/iframe.html?id=core-sandbox--all-screens&viewMode=story`;
const key = 'chewy.demo-session.v1';
const read = () => page.evaluate(key => { const { lastSeenAt, ...progress } = JSON.parse(localStorage.getItem(key)); return progress; }, key);
const button = name => page.getByRole('button', { name, exact: true });
const loaded = () => button('Инструменты пробы').waitFor();
const inspector = async () => {
  if (await button('Инструменты пробы').isVisible()) await button('Инструменты пробы').click();
};
const advance = async name => { await inspector(); await button(name).click(); };
const shoot = async () => { await button('Добавить еду').click(); await button('Сфотографировать еду').click(); };
const reload = async () => { await page.reload(); await loaded(); };
try {
  await page.goto(url);
  await loaded();
  assert.equal((await read()).inventory.coins, 0);
  await page.getByRole('button', { name: /Множитель/ }).click();
  assert.ok((await page.getByRole('dialog').innerText()).includes('разные дни'));
  await button('Понятно').click();
  await shoot();
  const first = await read();
  assert.equal(first.rewardEvents.length, 1);
  assert.equal(first.jobs.length, 0);
  assert.equal(first.creditedDays.length, 1);
  assert.equal(first.regularity.multiplier, DEMO_REWARDS.baseMultiplier + DEMO_REWARDS.multiplierStep);
  assert.equal(first.inventory.coins, first.rewardEvents[0].coins);
  assert.ok((await page.locator('.reward-receipt').innerText()).includes('→'));
  await button('Сфотографировать еду').click();
  await button('Фото 1').click();
  await button('↻ Переснять').click();
  await button('Снять новый кадр').click();
  assert.deepEqual(await read(), first);
  // Remove all draft photos and add again: it is still the same rewarded entry.
  await button('Фото 1').click();
  await button('Убрать фото').click();
  await button('Убрать фото').click();
  await button('Сфотографировать еду').click();
  assert.deepEqual(await read(), first);
  for (const device of ['compact', 'standard', 'large']) {
    await inspector();
    await page.locator('#study-inspector').getByLabel('Размер телефона').selectOption(device);
    const phone = await page.locator('.capture-phone').boundingBox();
    const reward = await page.locator('.capture-reward').boundingBox();
    const shutter = await button('Сфотографировать еду').boundingBox();
    assert.ok(reward.x >= phone.x && reward.x + reward.width <= phone.x + phone.width + 1);
    assert.ok(reward.y + reward.height < shutter.y);
  }
  // Reward survives closing before submission, without inventing a finished meal.
  await reload();
  assert.deepEqual(await read(), first);
  assert.equal(await page.locator('.reward-receipt').count(), 0);
  await button('Добавить еду').click();
  await button('Галерея').click();
  await page.getByRole('button', { name: /^Выбрать фото:/ }).first().click();
  await page.getByRole('button', { name: /^Добавить фото/ }).click();
  const second = await read();
  assert.equal(second.rewardEvents.length, 2);
  assert.equal(second.inventory.coins, first.inventory.coins * 2);
  assert.equal(second.regularity.multiplier, first.regularity.multiplier);
  assert.equal(second.creditedDays.length, 1);
  await button('Сохранить и разобрать').click();
  await button('Добавить еду').waitFor();
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).jobs[0].status === 'ready', key, { timeout: 25000 });
  await page.locator('.capture-notice').click();
  await button('Уточнить результат').click();
  await page.getByLabel('Название блюда', { exact: true }).fill('Уточнённый обед');
  await button('Повторить анализ').click();
  const revising = await read();
  assert.equal(revising.rewardEvents.length, 2);
  assert.equal(revising.inventory.coins, second.inventory.coins);
  await button('Вернуться в лагерь').click();
  await reload();
  assert.equal((await read()).inventory.coins, second.inventory.coins);
  await advance('Следующий день');
  await shoot();
  let saved = await read();
  assert.equal(saved.creditedDays.length, 2);
  assert.equal(saved.rewardEvents.at(-1).multiplierBefore, first.regularity.multiplier);
  assert.equal(saved.rewardEvents.at(-1).multiplier, saved.regularity.multiplier);
  assert.ok(saved.regularity.multiplier > first.regularity.multiplier);
  await reload();
  await button('Путь').click();
  const stop = await page.locator('.forest-stop-today').getAttribute('aria-label');
  assert.ok(stop.includes('твой лагерь'));
  await button('В лагерь').click();
  // Build regularity through distinct days, without waiting for analysis.
  for (let day = 0; day < 5; day++) { await advance('Следующий день'); await shoot(); await reload(); }
  saved = await read();
  const earned = saved.inventory.coins;
  const beforeDecay = saved.regularity.multiplier;
  await advance('Пропустить неделю');
  assert.equal((await read()).inventory.coins, earned);
  const wallet = await page.getByRole('button', { name: /Множитель/ }).getAttribute('aria-label');
  assert.ok(!wallet.includes(`×${String(beforeDecay).replace('.', ',')} за`));
  await reload();
  assert.deepEqual(await read(), saved);
  assert.equal(await page.getByRole('button', { name: /Множитель/ }).getAttribute('aria-label'), wallet);
  await shoot();
  const returned = await read();
  assert.ok(returned.inventory.coins > earned);
  assert.equal(returned.creditedDays.length, saved.creditedDays.length + 1);
  assert.ok(returned.rewardEvents.at(-1).multiplierBefore < beforeDecay);
  assert.ok(returned.rewardEvents.at(-1).multiplier >= DEMO_REWARDS.baseMultiplier);
  await reload();
  // More credited days than illustrated stops must not crash or discard progress.
  for (let day = 0; day < 21; day++) { await advance('Следующий день'); await shoot(); await reload(); }
  assert.ok((await read()).creditedDays.length > 27);
  await button('Путь').click();
  await page.locator('.forest-stop-today').waitFor();
  assert.equal(await page.locator('.forest-stop-today').count(), 1);
  assert.deepEqual(errors, []);
  console.log('PASS: first-photo rewards, retake/removal, pre-submit reload, gallery, same-day records, reanalysis, daily growth, gradual decay, preserved progress, finite map, three sizes.');
} finally { await browser.close(); }
