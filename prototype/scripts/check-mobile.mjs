// Uses fresh contexts only. HTTPS validation remains enabled, including on tailnet.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:6008/mobile.html';
const browser = await chromium.launch({ headless: true });
const key = 'chewy.demo-session.v1';
try {
  // A non-localhost HTTP origin must never start the app, even before React loads.
  const blockedContext = await browser.newContext();
  const blocked = await blockedContext.newPage();
  const blockedErrors = [], appRequests = [];
  blocked.on('pageerror', error => blockedErrors.push(error.message));
  blocked.on('request', request => { if (request.url().includes('/iframe.html')) appRequests.push(request.url()); });
  await blocked.route('http://chewy-insecure.test/mobile.html', route => route.fulfill({ path: fileURLToPath(new URL('../public/mobile.html', import.meta.url)), contentType: 'text/html' }));
  await blocked.goto('http://chewy-insecure.test/mobile.html');
  await blocked.getByRole('heading', { name: 'Открой защищённую ссылку' }).waitFor();
  assert.equal(await blocked.locator('#mobile-app').getAttribute('src'), null);
  assert.deepEqual(appRequests, []);
  assert.deepEqual(blockedErrors, []);
  await blockedContext.close();

  // Secure transport alone is insufficient without the APIs that protect saves.
  for (const missing of ['locks', 'randomUUID']) {
    const unsupportedContext = await browser.newContext();
    await unsupportedContext.addInitScript(missing => {
      const target = missing === 'locks' ? navigator : crypto;
      Object.defineProperty(target, missing, { configurable: true, value: undefined });
    }, missing);
    const unsupported = await unsupportedContext.newPage();
    const unsupportedErrors = [], unsupportedAppRequests = [];
    unsupported.on('pageerror', error => unsupportedErrors.push(error.message));
    unsupported.on('request', request => { if (request.url().includes('/iframe.html')) unsupportedAppRequests.push(request.url()); });
    await unsupported.goto(url);
    await unsupported.getByRole('heading', { name: 'Нужен другой браузер' }).waitFor();
    assert.equal(await unsupported.locator('#mobile-app').getAttribute('src'), null);
    assert.deepEqual(unsupportedAppRequests, []);
    assert.deepEqual(unsupportedErrors, []);
    await unsupportedContext.close();
  }

  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 3, reducedMotion: 'reduce', timezoneId: 'Europe/London' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-11-05T12:00:00Z') });
    await page.goto(url);
    const iframe = page.frameLocator('#mobile-app');
    const button = name => iframe.getByRole('button', { name, exact: true });
    await button('Добавить еду').waitFor();
    const frame = page.frames().find(item => item.url().includes('/iframe.html'));
    await frame.waitForFunction(key => localStorage.getItem(key) && !document.querySelector('[role="alert"]'), key);
    assert.deepEqual(await frame.evaluate(() => [isSecureContext, !!navigator.locks, typeof crypto.randomUUID]), [true, true, 'function']);
    assert.equal(await iframe.getByRole('button', { name: 'Инструменты пробы', exact: true }).isVisible(), false);
    for (const screen of ['Рюкзак', 'Путь', 'Зеркало']) { await button(screen).click(); await button('В лагерь').click(); }
    await button('Добавить еду').click();
    await button('Сфотографировать еду').click();
    await button('Детали').click();
    await iframe.getByLabel('Что осталось за кадром?').fill('С оливковым маслом');
    await button('Закрыть детали').click();
    await button('Сохранить и разобрать').click();
    await button('Добавить еду').waitFor();
    await page.clock.fastForward(21000);
    await frame.waitForFunction(key => JSON.parse(localStorage.getItem(key)).jobs[0]?.status === 'ready', key);
    const saved = await frame.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    assert.equal(saved.rewardEvents.length, 1);
    await button('Открыть дневник еды за сегодня').click();
    await iframe.locator('.capture-notice').click();
    await button('Уточнить результат').waitFor();
    await button('В лагерь').click();
    await page.reload();
    await button('Добавить еду').waitFor();
    const reloaded = page.frames().find(item => item.url().includes('/iframe.html'));
    await reloaded.waitForFunction(key => localStorage.getItem(key) && !document.querySelector('[role="alert"]'), key);
    assert.equal(await reloaded.evaluate(key => JSON.parse(localStorage.getItem(key)).jobs.length, key), 1);
    assert.equal(await reloaded.evaluate(key => JSON.parse(localStorage.getItem(key)).rewardEvents.length, key), 1);
    assert.equal(await reloaded.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS mobile ${viewport.width}×${viewport.height}: navigation, photo, save, result, reload`);
  }
  // The mobile shell must keep the same exclusive save access as Storybook.
  const shared = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', timezoneId: 'Europe/London' });
  const sharedErrors = [];
  const mobilePage = async () => {
    const page = await shared.newPage();
    page.on('pageerror', error => sharedErrors.push(error.message));
    await page.clock.install({ time: new Date('2026-11-05T12:00:00Z') });
    await page.goto(url);
    const app = page.frameLocator('#mobile-app');
    await app.getByRole('button', { name: 'Добавить еду', exact: true }).waitFor();
    return { page, app, frame: page.frames().find(frame => frame.url().includes('/iframe.html')) };
  };
  const writer = await mobilePage();
  await writer.frame.waitForFunction(key => localStorage.getItem(key) && !document.querySelector('[role="alert"]'), key);
  const waiting = await mobilePage();
  const warning = waiting.app.getByRole('alert').filter({ hasText: 'другой вкладке' });
  await warning.waitFor();
  const bounds = await warning.boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 390 && bounds.y + bounds.height <= 844, 'The mobile write-lock explanation stays on screen');
  for (const app of [waiting.app, writer.app]) {
    await app.getByRole('button', { name: 'Добавить еду', exact: true }).click();
    await app.getByRole('button', { name: 'Сфотографировать еду', exact: true }).click();
  }
  assert.equal(await waiting.app.getByRole('button', { name: 'Сохранить и разобрать', exact: true }).count(), 0);
  const beforeTransfer = await writer.frame.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  assert.equal(beforeTransfer.entries.length, 1);
  assert.equal(beforeTransfer.rewardEvents.length, 1);
  await writer.page.close();
  await warning.waitFor({ state: 'hidden' });
  await waiting.app.getByRole('button', { name: 'Сфотографировать еду', exact: true }).click();
  const afterTransfer = await waiting.frame.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  assert.equal(afterTransfer.entries.length, 2);
  assert.equal(afterTransfer.rewardEvents.length, 2);
  assert.equal(afterTransfer.inventory.coins, afterTransfer.rewardEvents.reduce((sum, event) => sum + event.coins, 0));
  assert.deepEqual(afterTransfer.entries[0], beforeTransfer.entries[0]);
  assert.deepEqual(sharedErrors, []);
  await shared.close();
  console.log('PASS mobile save access: waiting tab cannot reward or save; closing the writer transfers access without losing progress');
  console.log('PASS unsupported secure APIs: locks/randomUUID explanation shown without starting the app');
  console.log('PASS HTTP entry: explanation shown before app startup, no iframe request or JS exception');
} finally { await browser.close(); }
