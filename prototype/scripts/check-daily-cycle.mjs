// Run against Storybook. The fresh browser context never touches the owner's data.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'Europe/London' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const key = 'chewy.demo-session.v1';
const button = name => page.getByRole('button', { name, exact: true });
const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const inspector = async () => {
  if (await button('Инструменты пробы').isVisible()) await button('Инструменты пробы').click();
};
const phase = async value => { await inspector(); await page.getByLabel('Время суток').selectOption(value); };
const hero = async state => assert.equal(await page.locator('[data-hero-state]').getAttribute('data-hero-state'), state);
const components = async expected => {
  const actual = await page.locator('[data-camp-component]').evaluateAll(elements => Object.fromEntries(elements.map(el => [el.dataset.campComponent, el.dataset.dailyContribution === 'present'])));
  assert.deepEqual(actual, expected);
};
const empty = { protein: false, carbs: false, fats: false, plants: false };
const chooseFood = async label => {
  await button('Добавить еду').click();
  await button('Галерея').click();
  await button(`Выбрать фото: ${label}`).click();
  await button('Добавить фото · 1').click();
};
const submit = async () => { await button('Сохранить и разобрать').click(); await button('Добавить еду').waitFor(); };
const complete = async () => { await inspector(); await button('Завершить анализ').click(); };
const reload = async () => { await page.reload(); await button('Инструменты пробы').waitFor(); };
try {
  await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
  await page.goto(`${process.argv[2] ?? 'http://localhost:6006'}/iframe.html?id=core-sandbox--all-screens&viewMode=story`);
  await button('Инструменты пробы').waitFor();
  await components(empty); await hero('idle');
  await page.locator('.sandbox-phone').screenshot({ path: '/tmp/chewy-daily-empty.png' });
  await chooseFood('Ужин'); await hero('happy');
  const rewarded = await read();
  assert.equal(rewarded.rewardEvents.length, 1);
  assert.equal(rewarded.jobs.length, 0);
  await submit(); await components(empty); await hero('happy');
  // Restore the pending task; natural ticking completes it without opening results.
  await reload(); await hero('idle');
  assert.equal((await read()).jobs[0].status, 'processing');
  await page.clock.fastForward(21000);
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).jobs[0].status === 'ready', key);
  await components({ ...empty, protein: true });
  assert.equal((await read()).inventory.coins, rewarded.inventory.coins);
  assert.deepEqual((await read()).jobs[0].result.assessment.supplies, { protein: [34, 'курица'] });
  await chooseFood('Завтрак'); await submit(); await complete();
  await components({ ...empty, protein: true, carbs: true, plants: true });
  await button('Открыть дневник еды за сегодня').click();
  const meals = page.getByRole('list', { name: 'Еда сегодня' });
  assert.equal(await meals.getByRole('listitem').count(), 2);
  assert.match(await meals.innerText(), /Курица с картофелем/);
  assert.match(await meals.innerText(), /Овсянка с ягодами/);
  const meters = await page.locator('.nutrition-supply-existing').evaluateAll(elements => elements.map(el => el.style.width));
  assert.deepEqual(meters, ['100%', '100%', '0%', '100%']);
  await meals.getByRole('button', { name: /Курица с картофелем/ }).click();
  await page.getByRole('heading', { name: 'Курица с картофелем', exact: true }).waitFor();
  await page.getByRole('button', { name: /^Белок: есть подтверждённый вклад/ }).click();
  assert.match(await page.locator('.nutrition-detail').innerText(), /Источник в этой еде: курица/);
  await button('Вернуться в лагерь').click();
  await chooseFood('Обед');
  await button('Детали').click();
  await page.getByLabel('Что осталось за кадром?').fill('С оливковым маслом');
  await button('Закрыть детали').click();
  await submit(); await complete();
  const all = { protein: true, carbs: true, fats: true, plants: true };
  await components(all);
  const completed = await read();
  assert.equal(completed.jobs.length, 3);
  assert.equal(completed.creditedDays.length, 1);
  assert.equal(completed.rewardEvents.length, 3);
  await reload(); await components(all); await hero('idle');
  assert.deepEqual((await read()).jobs, completed.jobs);
  for (const device of ['compact', 'standard', 'large']) {
    await inspector(); await page.getByLabel('Размер телефона').selectOption(device);
    const phone = await page.locator('.sandbox-phone').boundingBox();
    const bubble = await page.locator('[data-hero-state]').boundingBox();
    assert.ok(bubble.x >= phone.x && bubble.x + bubble.width <= phone.x + phone.width + 1);
    assert.ok(bubble.y >= phone.y && bubble.y + bubble.height < phone.y + phone.height);
  }
  await page.getByLabel('Размер телефона').selectOption('standard');
  await page.locator('.sandbox-phone').screenshot({ path: '/tmp/chewy-daily-color.png' });
  await phase('night'); await hero('sleeping');
  await chooseFood('Завтрак'); await hero('sleeping');
  assert.equal((await read()).rewardEvents.length, 4);
  await submit(); await complete(); await components(all); await hero('sleeping');
  await phase('day'); await hero('happy');
  await page.clock.fastForward(61000); await hero('idle');
  const beforeDay = await read();
  await button('Следующий день').click();
  await components(empty); await hero('returning');
  const afterDay = await read();
  assert.deepEqual(afterDay.inventory, beforeDay.inventory);
  assert.deepEqual(afterDay.jobs, beforeDay.jobs);
  assert.deepEqual(afterDay.rewardEvents, beforeDay.rewardEvents);
  await button('Открыть дневник еды за сегодня').click();
  assert.equal(await page.getByRole('list', { name: 'Еда сегодня' }).count(), 0);
  await button('Свернуть дневник').click();
  await reload(); await components(empty);
  // Page hide records the old clock. A later real entry sees the elapsed absence.
  await page.goto('about:blank');
  await page.clock.fastForward(7 * 60 * 60 * 1000);
  await page.goto(`${process.argv[2] ?? 'http://localhost:6006'}/iframe.html?id=core-sandbox--all-screens&viewMode=story`);
  await button('Инструменты пробы').waitFor();
  await phase('day'); await hero('returning');
  await chooseFood('Обед'); await hero('happy');
  assert.deepEqual(errors, []);
  console.log('PASS: persisted analysis, distinct daily meals, binary camp, repeat contribution, reload, next day, hero joy/expiry/sleep/return, rewards independent, three sizes.');
} finally { await browser.close(); }
