// Focused regressions from the stage 3 review. Fresh contexts preserve the owner's data.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const origin = process.argv[2] ?? 'http://localhost:6006';
const url = `${origin}/iframe.html?id=core-sandbox--all-screens&viewMode=story`;
const key = 'chewy.demo-session.v1';
const failures = [];
const errors = [];
const run = async (name, check) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'Europe/London' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const button = name => page.getByRole('button', { name, exact: true });
  try {
    await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
    await page.goto(url); await button('Инструменты пробы').waitFor();
    await check(page, button);
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL: ${name}: ${error.message}`);
  } finally { await context.close(); }
};

try {
  await run('notice uses the session clock and preserves the saved calendar date', async (page, button) => {
    await button('Добавить еду').click(); await button('Сфотографировать еду').click();
    await button('Сохранить и разобрать').click();
    const stamp = page.locator('.capture-notice time');
    assert.match(await stamp.innerText(), /^12:00$/);
    await button('Инструменты пробы').click(); await button('Следующий день').click();
    assert.match(await stamp.innerText(), /^29 окт\. · 12:00$/);
    // A late/travelling record keeps its original dayKey even when its timestamp
    // falls on another calendar date in this browser. Reading does not migrate it.
    await page.addInitScript(key => {
      const session = JSON.parse(localStorage.getItem(key));
      session.jobs[0].createdAt = Date.parse('2026-10-28T23:00:00Z');
      session.entries.find(entry => entry.id === session.jobs[0].id).firstPhotoAt = session.jobs[0].createdAt;
      localStorage.setItem(key, JSON.stringify(session));
    }, key);
    await page.reload(); await button('Инструменты пробы').waitFor();
    assert.match(await stamp.innerText(), /^29 окт\. · 23:00$/);
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).jobs[0].dayKey, key), '2026-10-29');
    assert.match(await page.locator('.capture-notice').getAttribute('aria-label'), /29 окт\. · 23:00/);
  });

  await run('resizing the map keeps the selected stop visible without moving the camp', async (page, button) => {
    await button('Инструменты пробы').click(); await button('Путь').click();
    const stop = page.locator('[data-stop-index="10"]');
    const scroll = page.locator('.forest-path-scroll');
    await stop.evaluate(el => el.scrollIntoView({ block: 'center' }));
    const beforeClick = await scroll.evaluate(el => el.scrollTop);
    await stop.click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await stop.getAttribute('aria-pressed'), 'true');
    assert.ok(await stop.evaluate(el => el === document.activeElement));
    assert.ok(Math.abs(await scroll.evaluate(el => el.scrollTop) - beforeClick) < 2, 'selecting a visible stop must not recenter it');
    for (const size of ['compact', 'large', 'standard']) {
      await page.getByLabel('Размер телефона').focus();
      await page.getByLabel('Размер телефона').selectOption(size);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.waitForFunction(() => {
        const stop = document.querySelector('[data-stop-index="10"]');
        const scroller = document.querySelector('.forest-path-scroll');
        const point = stop.getBoundingClientRect(), view = scroller.getBoundingClientRect();
        const center = point.y + point.height / 2;
        return center > view.y && center < view.y + view.height;
      }, undefined, { timeout: 3000 });
      assert.equal(await stop.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.forest-stop-today').getAttribute('data-stop-index'), '0');
      assert.ok(await page.getByLabel('Размер телефона').evaluate(el => el === document.activeElement), 'resizing must not steal focus');
    }
    await page.locator('.study-screen-path').screenshot({ path: '/tmp/chewy-review-path-resize.png' });
    await button('Показать мою стоянку').click();
    assert.equal(await page.locator('[aria-pressed="true"][data-stop-index]').getAttribute('data-stop-index'), '0');
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).creditedDays.length, key), 0);
  });

  assert.deepEqual(errors, [], 'no browser JavaScript errors');
  assert.deepEqual(failures, [], 'review UI regressions');
} finally { await browser.close(); }
