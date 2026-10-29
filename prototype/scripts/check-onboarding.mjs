import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1150, height: 1100 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const origin = process.argv[2] ?? 'http://localhost:6006';
const url = id => `${origin}/iframe.html?id=core-sandbox--${id}&viewMode=story`;
const button = name => page.getByRole('button', { name, exact: true });
const key = 'chewy.demo-session.v1';
const example = async () => {
  await button('Покажи, как это работает').click();
  await fit();
  await page.locator('.study-phone').screenshot({ path: `/tmp/chewy-example-photo-${await page.getByLabel('Размер телефона').inputValue()}.png` });
  await button('Разобрать фото-пример').click();
  await fit();
  await button('Назад').click();
  await button('Разобрать фото-пример').click();
  await page.locator('.study-phone').screenshot({ path: `/tmp/chewy-example-plate-${await page.getByLabel('Размер телефона').inputValue()}.png` });
  await button('А что в лагере?').click();
  await fit();
  await page.locator('.study-phone').screenshot({ path: `/tmp/chewy-example-camp-${await page.getByLabel('Размер телефона').inputValue()}.png` });
  await button('К своему Чуви').click();
};
const saved = () => page.evaluate(key => localStorage.getItem(key), key);
const tools = async () => { if (await button('Инструменты пробы').isVisible()) await button('Инструменты пробы').click(); };
const fit = async () => {
  const phone = page.locator('.study-phone');
  assert.ok(await phone.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1));
  const frame = await phone.boundingBox();
  const footer = await page.locator('.onboarding-actions').boundingBox();
  assert.ok(footer.y + footer.height <= frame.y + frame.height - 10, 'actions stay above the home indicator');
};
try {
  await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
  await page.goto(url('all-screens')); await button('Добавить еду').waitFor();
  assert.ok(await saved(), 'main session exists for isolation check');
  await page.goto(url('welcome')); await button('Покажи, как это работает').waitFor();
  const mainSession = await saved(); // Main app records its last visit when leaving.
  for (const size of ['compact', 'standard', 'large']) {
    await page.goto(url('welcome')); await button('Покажи, как это работает').waitFor();
    await tools(); await page.getByLabel('Размер телефона').selectOption(size);
    await fit();
    await page.locator('.study-phone').screenshot({ path: `/tmp/chewy-onboarding-welcome-${size}.png` });
    await example();
    assert.ok(await page.locator('.onboarding-copy h1').evaluate(el => el === document.activeElement));
    await page.getByLabel('Имя друга').fill('  Лисёнок  ');
    await fit();
    await page.locator('.study-phone').screenshot({ path: `/tmp/chewy-onboarding-name-${size}.png` });
    await button('Назад').click(); await example();
    assert.equal(await page.getByLabel('Имя друга').inputValue(), '  Лисёнок  ');
    // Reduced available height approximates keyboard space; native keyboard QA is separate.
    await page.locator('.study-phone').evaluate(el => el.style.height = '360px');
    await fit(); await page.getByLabel('Имя друга').press('Enter');
    await button('Добавить еду').waitFor();
    assert.match(await page.locator('.hero-state-label').innerText(), /^Лисёнок /);
    assert.equal(await page.locator('.hero-state-name').innerText(), 'Лисёнок');
    assert.ok(await page.locator('.hero-state-name').isVisible());
    assert.equal(await page.locator('.reward-wallet strong').innerText(), '0 монет');
    assert.equal(await page.getByLabel('Стадия лагеря').inputValue(), 'initial');
    assert.equal(await page.getByLabel('Продвижение по пути').inputValue(), '0');
    assert.ok(await button('Добавить еду').evaluate(el => el === document.activeElement));
    assert.equal(await page.locator('dialog[open]').count(), 0, 'no permission request');
    assert.equal(await saved(), mainSession);
  }
  for (const advance of [0, 1, 2]) {
    await page.goto(url('welcome')); await button('Покажи, как это работает').click();
    if (advance > 0) await button('Разобрать фото-пример').click();
    if (advance > 1) await button('А что в лагере?').click();
    assert.equal(await page.getByText('Пробный пример', { exact: true }).count(), 1);
    await button('Сразу в лагерь').click(); await button('Добавить еду').waitFor();
    assert.equal(await page.locator('.reward-wallet strong').innerText(), '0 монет');
    await button('Открыть дневник еды за сегодня').click();
    assert.equal(await page.getByRole('list', { name: 'Еда сегодня' }).getByRole('listitem').count(), 0);
    assert.equal(await saved(), mainSession);
  }
  await page.goto(url('welcome')); await button('Сразу в лагерь').click();
  await button('Добавить еду').waitFor();
  assert.equal(await page.locator('.reward-wallet strong').innerText(), '0 монет');
  await button('Открыть дневник еды за сегодня').click();
  assert.equal(await page.getByRole('list', { name: 'Еда сегодня' }).getByRole('listitem').count(), 0);
  await page.getByRole('dialog').getByRole('button', { name: 'Добавить еду', exact: true }).click(); await button('Сфотографировать еду').click();
  assert.match(await page.locator('.reward-receipt').innerText(), /\+\d/);
  await button('Сохранить и разобрать').click(); await button('Рюкзак').waitFor();
  const coins = await page.locator('.reward-wallet strong').innerText();
  assert.notEqual(coins, '0 монет');
  await tools(); await page.locator('.review-screen-picker select').selectOption('welcome');
  await example(); await button('В лагерь').click();
  assert.equal(await page.locator('.reward-wallet strong').innerText(), coins, 'reopening intro never resets earned progress');
  assert.equal(await page.getByLabel('Продвижение по пути').inputValue(), '1');
  await button('Начать знакомство заново').click(); await button('Отмена').click();
  assert.equal(await page.locator('.reward-wallet strong').innerText(), coins);
  await button('Начать знакомство заново').click(); await button('Сбросить и начать заново').click();
  await example(); assert.equal(await page.getByLabel('Имя друга').inputValue(), '');
  await page.getByLabel('Имя друга').fill('Не сохранять'); await button('Оставить Чуви').click();
  assert.match(await page.locator('.hero-state-label').innerText(), /^Чуви /);
  assert.equal(await page.locator('.reward-wallet strong').innerText(), '0 монет');
  await page.reload(); await button('Покажи, как это работает').waitFor();
  await example(); await page.getByLabel('Имя друга').fill('   '); await button('В лагерь').click();
  assert.match(await page.locator('.hero-state-label').innerText(), /^Чуви /);
  assert.equal(await saved(), mainSession);
  await page.goto(url('name')); await page.getByLabel('Имя друга').waitFor();
  await button('Оставить Чуви').click(); await button('Добавить еду').waitFor();
  await page.goto(url('reminders')); await button('Пока без напоминаний').click(); await button('Добавить еду').waitFor();
  assert.equal(await saved(), mainSession, 'all legacy intro links stay isolated');
  await page.goto(url('all-screens')); await button('Добавить еду').waitFor();
  assert.equal(await page.locator('.onboarding-intro').count(), 0, 'main entry still opens camp');
  assert.equal(await page.locator('.reward-wallet strong').innerText(), '0 монет');
  assert.deepEqual(errors, []);
  console.log('PASS onboarding: three sizes, back/skip/name/keyboard, empty camp, first photo, reset, reload, isolation and legacy URLs');
} catch (error) {
  await page.screenshot({ path: '/tmp/chewy-onboarding-check-failure.png' });
  console.error((await page.locator('body').innerText()).slice(0, 900));
  throw error;
} finally { await browser.close(); }
