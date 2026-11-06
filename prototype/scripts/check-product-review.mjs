import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createDemoSession } from '../src/core/demo-session.js';
import { DEMO_GARDEN_COSTS } from '../src/core/demo-config.js';
const origin = process.argv[2] ?? 'http://localhost:6007';
const recording = process.argv.includes('--record');
const artifacts = process.env.CHEWY_REVIEW_ARTIFACTS ?? '/tmp/chewy-product-review';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1080, height: 1200 }, timezoneId: 'Europe/London', reducedMotion: recording ? 'no-preference' : 'reduce', ...(recording ? { recordVideo: { dir: artifacts, size: { width: 1080, height: 1200 } } } : {}) });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const key = 'chewy.product-review.v1', primaryKey = 'chewy.demo-session.v1', placementKey = 'chewy.sandbox.placement.v1.growth.v1.separate';
const primary = JSON.stringify({ ...createDemoSession(), inventory: { coins: 91, owned: ['flowers'], applied: { garden: 'flowers' } } });
const placement = JSON.stringify({ version: 1, devices: { standard: { hero: [42, 7, .8] } } });
await context.addInitScript(({ primaryKey, primary, placementKey, placement }) => {
  if (!localStorage.getItem('chewy.review-test.initialized')) {
    localStorage.setItem(primaryKey, primary); localStorage.setItem(placementKey, placement);
    localStorage.setItem('chewy.review-test.initialized', 'true');
  }
}, { primaryKey, primary, placementKey, placement });
const button = name => page.getByRole('button', { name, exact: true });
const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const beat = () => recording ? page.waitForTimeout(1800) : Promise.resolve();
const loaded = async () => {
  await page.getByRole('heading', { name: 'Один день вместе' }).waitFor();
  await page.waitForFunction(key => localStorage.getItem(key) && !document.querySelector('[role="alert"]'), key);
};
const protectedStorage = async () => {
  assert.equal(await page.evaluate(key => localStorage.getItem(key), primaryKey), primary);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), placementKey), placement);
};
const capture = async () => {
  await button('Добавить еду').click(); await button('Галерея').click();
  await button('Выбрать фото: Завтрак').click(); await button('Добавить фото · 1').click(); await beat();
  await button('Сохранить и разобрать').click(); await button('Получить демоответ').click(); await beat();
};
const viewResult = async () => {
  await button('Открыть дневник еды за сегодня').click(); await beat();
  await page.locator('.capture-notice').click();
  await page.getByRole('heading', { name: 'Овсянка с ягодами', exact: true }).waitFor(); await beat();
  await button('В лагерь').click(); await beat();
};
const contributions = async expected => assert.deepEqual(await page.locator('.review-app [data-camp-component]').evaluateAll(els => Object.fromEntries(els.map(el => [el.dataset.campComponent, el.dataset.dailyContribution === 'present']))), expected);
const empty = { protein: false, carbs: false, fats: false, plants: false }, breakfast = { ...empty, carbs: true, plants: true };
try {
  await page.goto(`${origin}/iframe.html?id=product-review--walkthrough&viewMode=story`); await loaded();
  await protectedStorage(); await contributions(empty); await beat();
  await page.screenshot({ path: `${artifacts}/01-start.png` });
  await capture(); await contributions(breakfast); await viewResult();
  const first = await read(); assert.equal(first.jobs.length, 1); assert.equal(first.rewardEvents.length, 1); assert.equal(first.creditedDays.length, 1);
  await page.screenshot({ path: `${artifacts}/02-first-meal.png` });
  await page.reload(); await loaded(); assert.deepEqual((await read()).jobs, first.jobs);
  await capture(); await contributions(breakfast); await viewResult();
  const repeated = await read(); assert.equal(repeated.jobs.length, 2); assert.equal(repeated.rewardEvents.length, 2); assert.equal(repeated.creditedDays.length, 1);
  assert.ok(repeated.inventory.coins > first.inventory.coins);
  assert.equal(await page.locator('.review-app .sandbox-phone [data-provisions-stage]').getAttribute('data-provisions-stage'), 'first');
  await button('Рюкзак').click(); await button('Магазин').click(); await beat();
  await button(`Купить · ${DEMO_GARDEN_COSTS.flowers} монет`).click(); await button(`Купить за ${DEMO_GARDEN_COSTS.flowers} монет`).click();
  await button('Примерить').click(); await button('Применить').click(); await button('В лагерь').click(); await beat();
  const beforeDay = await read(); assert.equal(beforeDay.inventory.applied.garden, 'flowers');
  await button('Следующий день').click(); await contributions(empty); await beat();
  assert.equal(await page.locator('.product-review').getAttribute('data-review-stage'), 'morning');
  const afterDay = await read(); assert.deepEqual(afterDay.inventory, beforeDay.inventory); assert.deepEqual(afterDay.jobs, beforeDay.jobs); assert.deepEqual(afterDay.rewardEvents, beforeDay.rewardEvents);
  assert.equal(await page.locator('.review-app [data-garden-appearance]').getAttribute('data-garden-appearance'), 'flowers');
  await page.screenshot({ path: `${artifacts}/03-next-day.png` });
  await button('Открыть дневник еды за сегодня').click(); assert.equal(await page.getByRole('list', { name: 'Еда сегодня' }).count(), 0); await beat(); await button('Свернуть дневник').click();
  await button('Путь').click(); await page.locator('[data-stop-index="1"]').click(); await button('Открыть день').click();
  assert.equal(await page.getByRole('list', { name: 'Еда за выбранный день' }).getByRole('listitem').count(), 2); await beat();
  await button('К пути').click(); await button('В лагерь').click();
  const beforeDrafts = await read();
  await button('Черновики реакций').click(); await beat();
  await page.getByRole('radio', { name: 'Лагерь и Чуви', exact: true }).check(); await button('Повторить отклик').click(); await beat();
  await page.getByLabel('Повторный вклад', { exact: true }).check(); await button('Повторить отклик').click(); await beat();
  await page.screenshot({ path: `${artifacts}/04-reaction-draft.png` });
  await page.getByLabel('Новый день', { exact: true }).check(); await beat();
  assert.deepEqual(await read(), beforeDrafts); await protectedStorage();
  if (!recording) {
    for (const [width, device] of [[320, 'compact'], [390, 'standard'], [430, 'large']]) {
      await page.setViewportSize({ width, height: 932 }); await page.getByLabel('Размер для ревью').selectOption(device);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `draft overflow ${width}`);
      await page.screenshot({ path: `${artifacts}/draft-${width}.png`, fullPage: true });
      await button('Основной проход').click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `flow overflow ${width}`);
      await page.screenshot({ path: `${artifacts}/flow-${width}.png`, fullPage: true }); await button('Черновики реакций').click();
    }
    await page.setViewportSize({ width: 1080, height: 1200 }); await page.getByLabel('Повторный вклад', { exact: true }).check();
    assert.equal(await page.locator('.review-draft [data-scene-object="hero"]').evaluate(el => getComputedStyle(el).animationName), 'none');
    await button('Мои ответы').click();
    const answers = page.locator('.review-answers');
    assert.equal(await answers.locator('input:checked').count(), 0, 'recommendations must not preselect answers');
    const beforeAnswers = await read();
    await answers.getByLabel('Лагерь и Чуви', { exact: true }).check();
    await answers.getByLabel('Нужен отдельный отклик', { exact: true }).check();
    await answers.getByLabel('Похоже на потерю — доработать', { exact: true }).check();
    const answerKey = 'chewy.product-review.answers.v1';
    let feedback = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), answerKey);
    assert.deepEqual(feedback, { hero: 'friend', repeat: 'response', morning: 'loss' });
    assert.deepEqual(await read(), beforeAnswers); await protectedStorage();
    await page.reload(); await loaded(); await button('Мои ответы').click();
    assert.equal(await answers.locator('input:checked').count(), 3);
    const summary = await answers.getByLabel('Ответы для чата').inputValue();
    assert.ok(summary.includes('Похоже на потерю — доработать'));
    assert.equal(summary.split('\n').length, 5, 'copied answers use real line breaks');
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 932 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `answers overflow ${width}`);
      await page.screenshot({ path: `${artifacts}/answers-${width}.png`, fullPage: true });
    }
    // A failed write must stay visible and must not claim the answer was saved.
    await page.evaluate(key => {
      const original = Storage.prototype.setItem;
      window.restoreReviewWrites = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('Blocked for review check', 'QuotaExceededError'); return original.call(this, name, value); };
    }, answerKey);
    await answers.getByLabel('Только лагерь', { exact: true }).check();
    assert.ok(await answers.getByRole('alert').isVisible());
    assert.ok((await answers.getByLabel('Ответы для чата').inputValue()).includes('Только лагерь'));
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), answerKey), feedback);
    await page.evaluate(() => window.restoreReviewWrites());
    await answers.getByLabel('Достаточно записи в дневнике', { exact: true }).check();
    feedback = { hero: 'camp', repeat: 'quiet', morning: 'loss' };
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), answerKey), feedback, 'next write recovers unsaved answers');
    await page.reload(); await loaded();
    await page.locator('#review-controls summary').waitFor();
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 932 });
      const targets = await page.locator('.review-app :is(.sandbox-nav-control, .sandbox-add-food, .food-journal-summary)').evaluateAll(elements => elements.map(element => { const rect = element.getBoundingClientRect(); return { width: rect.width, height: rect.height, label: element.getAttribute('aria-label') || element.textContent }; }));
      assert.ok(targets.every(target => target.width >= 44 && target.height >= 44), `camp touch targets ${width}: ${JSON.stringify(targets)}`);
    }
    assert.equal(await page.locator('#review-controls details').getAttribute('open'), null, 'mobile instructions start collapsed');
    await page.locator('#review-controls .review-jump').click();
    assert.ok(await page.locator('#review-phone').evaluate(el => Math.abs(el.getBoundingClientRect().top) < 80), 'mobile jump reaches the prototype');
    await page.locator('#review-phone .review-jump').click();
    await page.locator('#review-controls summary').click();
    await contributions(empty);
    assert.equal(await page.locator('.product-review').getAttribute('data-review-stage'), 'morning');
    await button('Начать проход заново').click(); await button('Продолжить проход').click(); assert.deepEqual((await read()).jobs, beforeDay.jobs);
    await button('Начать проход заново').click(); await button('Очистить пробу').click();
    assert.deepEqual((await read()).jobs, []); assert.deepEqual((await read()).inventory, { coins: 0, owned: [], applied: {} }); await protectedStorage();
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), answerKey), feedback, 'flow reset preserves feedback');
    await page.screenshot({ path: `${artifacts}/mobile-start.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: isolated first/repeat meal, persisted reload, purchase/apply, next day/history, draft isolation, owner session/layout preserved' + (recording ? ', recorded walkthrough.' : ', three widths/reduced motion/reset, explicit persisted feedback and storage failure, mobile navigation.'));
} finally {
  if (recording) { const video = page.video(); await context.close(); console.log(`Video: ${await video.path()}`); }
  await browser.close();
}
