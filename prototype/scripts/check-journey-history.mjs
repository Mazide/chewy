// Run against local Storybook; each context is isolated from the owner's data.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createDemoSessionStore } from '../src/core/demo-session.js';
import { JOURNEY_STOPS } from '../src/core/journey-world.js';

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
const economy = session => ({ inventory: session.inventory, events: session.rewardEvents, days: session.creditedDays, regularity: session.regularity });
const inspector = async () => { if (await button('Инструменты пробы').isVisible()) await button('Инструменты пробы').click(); };
const advance = async label => { await inspector(); await button(label).click(); };
const complete = () => advance('Завершить анализ');
const reload = async () => { await page.reload(); await button('Инструменты пробы').waitFor(); };
const add = async label => {
  await button('Добавить еду').click(); await button('Галерея').click();
  await button(`Выбрать фото: ${label}`).click(); await button('Добавить фото · 1').click();
  await button('Сохранить и разобрать').click(); await button('Рюкзак').waitFor();
};
const selectStop = async index => {
  const stop = page.locator(`[data-stop-index="${index}"]`);
  await stop.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await stop.click();
};
const campAppearance = async id => assert.equal(await page.locator('[data-camp-component="plants"] [data-garden-appearance]').getAttribute('data-garden-appearance'), id);
try {
  await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
  await page.goto(url); await button('Инструменты пробы').waitFor();
  await button('Путь').click(); assert.equal(await button('Открыть день').count(), 0);
  await button('В лагерь').click();
  await add('Ужин'); await complete(); await add('Завтрак'); await complete();
  const first = await read(); const firstDay = first.creditedDays[0];
  assert.equal(first.creditedDays.length, 1); assert.equal(first.jobs.length, 2);
  await button('Рюкзак').click(); await button('Магазин').click(); await button('Купить · 5 монет').click(); await button('Купить за 5 монет').click();
  await button('Примерить').click(); await button('Применить').click(); await button('В лагерь').click();
  const bought = economy(await read());
  await advance('Следующий день');
  await button('Открыть дневник еды за сегодня').click();
  assert.equal(await page.getByRole('list', { name: 'Еда сегодня' }).count(), 0);
  await button('Свернуть дневник').click();
  await button('Путь').click();
  assert.equal(await page.locator('.forest-stop-today').getAttribute('data-stop-index'), '1');
  await button('Открыть день').click();
  assert.equal(await page.locator('.journey-day').getAttribute('data-history-day'), firstDay);
  assert.equal(await page.getByRole('list', { name: 'Еда за выбранный день' }).getByRole('listitem').count(), 2);
  assert.deepEqual(economy(await read()), bought);
  await page.getByRole('button', { name: /Курица с картофелем/ }).click();
  await page.getByRole('heading', { name: 'Курица с картофелем', exact: true }).waitFor();
  await button('К дню').click();
  assert.equal(await page.locator('.journey-day').getAttribute('data-history-day'), firstDay);
  await button('К пути').click();
  assert.ok(await button('Открыть день').evaluate(el => el === document.activeElement));
  assert.equal(await page.getByLabel('День на стоянке').inputValue(), firstDay);
  // Looking ahead changes only the selected stop.
  await selectStop(3); assert.equal(await button('Открыть день').count(), 0);
  assert.equal(await page.locator('.forest-stop-today').getAttribute('data-stop-index'), '1');
  await button('В лагерь').click(); await campAppearance('flowers');
  assert.deepEqual(economy(await read()), bought);
  await add('Обед');
  const second = await read(); const secondDay = second.creditedDays[1];
  await button('Путь').click(); await button('Открыть день').click();
  assert.equal(await page.getByRole('list', { name: 'Записи в обработке за выбранный день' }).getByRole('listitem').count(), 1);
  await page.getByRole('list', { name: 'Записи в обработке за выбранный день' }).getByRole('button').click();
  await page.getByRole('region', { name: 'Анализ отправленной еды' }).waitFor();
  await button('К дню').click(); await button('К пути').click(); await button('В лагерь').click();
  await reload(); await complete();
  await advance('Следующий день'); await add('Завтрак'); await complete();
  const third = await read(); assert.equal(third.creditedDays.length, 3);
  assert.match(await page.locator('.sandbox-background img').getAttribute('src'), /camp-lake/);
  await campAppearance('flowers');
  await button('Путь').click(); await selectStop(1); await button('Открыть день').click();
  for (const size of ['compact', 'standard', 'large']) {
    await inspector(); await page.getByLabel('Размер телефона').selectOption(size);
    assert.equal(await page.locator('.journey-day').getAttribute('data-history-day'), firstDay);
    const phone = await page.locator('.study-screen-path').boundingBox();
    const back = await button('К пути').boundingBox();
    assert.ok(back.y >= phone.y && back.y + back.height < phone.y + phone.height);
    assert.ok(await page.locator('.journey-day').evaluate(el => el.scrollWidth <= el.clientWidth));
    await page.locator('.study-screen-path').screenshot({ path: `/tmp/chewy-history-${size}.png` });
  }
  await page.getByLabel('День истории').focus();
  await page.getByLabel('День истории').selectOption(secondDay);
  assert.ok(await page.getByLabel('День истории').evaluate(el => el === document.activeElement));
  assert.equal(await page.getByRole('list', { name: 'Еда за выбранный день' }).getByRole('listitem').count(), 1);
  await button('К пути').click();
  assert.equal(await page.locator('[aria-pressed="true"][data-stop-index]').getAttribute('data-stop-index'), '2');
  await page.getByLabel('Размер телефона').selectOption('compact');
  await page.locator('.study-screen-path').screenshot({ path: '/tmp/chewy-history-map-compact.png' });
  await button('Показать мою стоянку').click();
  assert.equal(await page.locator('[aria-pressed="true"][data-stop-index]').getAttribute('data-stop-index'), '3');
  await button('В лагерь').click(); await advance('Пропустить неделю');
  assert.deepEqual(economy(await read()), economy(third));
  assert.equal(await page.locator('[data-hero-state]').getAttribute('data-hero-state'), 'returning');
  await campAppearance('flowers'); await reload(); await campAppearance('flowers');
  assert.match(await page.locator('.sandbox-background img').getAttribute('src'), /camp-lake/);
  await button('Путь').click(); await button('Открыть день').click();
  assert.equal(await page.getByLabel('День истории').locator('option').count(), 3);
  assert.deepEqual(economy(await read()), economy(third));
  // Isolated path examples provide history but leave the main session intact.
  await page.goto(`${origin}/iframe.html?id=core-sandbox--path&viewMode=story`);
  await button('Открыть день').click();
  assert.equal(await page.getByLabel('День истории').locator('option').count(), 3);
  assert.deepEqual(economy(await read()), economy(third));
  await button('К пути').click();
  await page.getByLabel('История в примере').selectOption('first');
  await button('Добавить еду').click(); await button('Сфотографировать еду').click();
  await button('Сохранить и разобрать').click(); await button('Путь').click();
  assert.equal(await page.locator('.forest-stop-today').getAttribute('data-stop-index'), '1');
  await button('Открыть день').click();
  assert.equal(await page.getByLabel('День истории').locator('option').count(), 1);
  assert.deepEqual(economy(await read()), economy(third));

  // Beyond the finite map, several earned dates share the last stop and all remain reachable.
  let time = Date.UTC(2026, 8, 1, 12);
  const store = createDemoSessionStore({ now: () => time });
  for (let day = 0; day < 30; day++) { store.startEntry(`edge-${day}`); time += 86400000; }
  const edgeSession = store.getSnapshot().session;
  const edgeContext = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'Europe/London' });
  const edge = await edgeContext.newPage(); edge.on('pageerror', error => errors.push(error.message));
  await edge.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key, value: JSON.stringify(edgeSession) });
  await edge.goto(url); await edge.getByRole('button', { name: 'Путь', exact: true }).click();
  assert.equal(await edge.locator('.forest-stop-today').getAttribute('data-stop-index'), String(JOURNEY_STOPS.length - 1));
  assert.equal(await edge.getByLabel('День на стоянке').locator('option').count(), 5);
  await edge.getByRole('button', { name: 'Открыть день', exact: true }).click();
  assert.equal(await edge.getByLabel('День истории').locator('option').count(), 30);
  assert.match(await edge.locator('.journey-day-empty').innerText(), /Готовых записей еды за этот день пока нет/);
  await edge.getByLabel('День истории').selectOption(edgeSession.creditedDays[0]);
  assert.equal(await edge.locator('.journey-day').getAttribute('data-history-day'), edgeSession.creditedDays[0]);
  assert.deepEqual(errors, []);
  console.log('PASS: day history and meal returns, same-day grouping, pending/reload, current camp independent, biome/inventory persistence, absence, no invented days/rewards, final-stop grouping, isolated examples, three sizes.');
} finally { await browser.close(); }
