// Real Web Locks and shared storage, inside a fresh context separate from the owner.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { DEMO_GARDEN_COSTS } from '../src/core/demo-config.js';

const browser = await chromium.launch({ headless: true });
const origin = process.argv[2] ?? 'http://localhost:6006';
const url = `${origin}/iframe.html?id=core-sandbox--all-screens&viewMode=story`;
const key = 'chewy.demo-session.v1';
const errors = [];
const button = (page, name) => page.getByRole('button', { name, exact: true });
const read = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const progress = ({ lastSeenAt, ...session }) => session;
const writable = page => page.waitForFunction(() => !document.querySelector('[role="alert"]'));
const inspector = async page => {
  if (await button(page, 'Инструменты пробы').isVisible()) await button(page, 'Инструменты пробы').click();
};
const open = async context => {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
  await page.goto(url); await button(page, 'Инструменты пробы').waitFor();
  return page;
};
const shoot = async page => {
  await button(page, 'Добавить еду').click(); await button(page, 'Сфотографировать еду').click();
};
const submit = async page => {
  await button(page, 'Сохранить и разобрать').click(); await button(page, 'Рюкзак').waitFor();
  await inspector(page); await button(page, 'Завершить анализ').click();
};
const ownFlowers = async page => {
  await button(page, 'Рюкзак').click(); await button(page, 'Магазин').click();
  await button(page, `Купить · ${DEMO_GARDEN_COSTS.flowers} монет`).click();
  await button(page, `Купить за ${DEMO_GARDEN_COSTS.flowers} монет`).click();
  await button(page, 'Примерить').click(); await button(page, 'Применить').click();
  await button(page, 'В лагерь').click();
};

try {
  for (const order of ['waiting-first', 'owner-first']) {
    const context = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'Europe/London' });
    const a = await open(context); await writable(a);
    const b = await open(context);
    await b.getByRole('alert').filter({ hasText: 'другой вкладке' }).waitFor();
    await shoot(a); await submit(a); await ownFlowers(a);
    const earned = progress(await read(a));
    assert.equal(earned.entries.length, 1);
    assert.deepEqual(earned.inventory.owned, ['flowers']);
    assert.equal(earned.inventory.applied.garden, 'flowers');

    // A waiting tab cannot reward, reset, advance the clock or write presence.
    await shoot(b);
    assert.deepEqual(progress(await read(a)), earned);
    assert.equal(await button(b, 'Сохранить и разобрать').count(), 0);
    await inspector(b); await button(b, 'Следующий день').click();
    assert.equal(await b.evaluate(key => localStorage.getItem(`${key}.clock`), key), null);
    await button(b, 'Сбросить демосессию').click(); await button(b, 'Сбросить и начать заново').click();
    assert.deepEqual(progress(await read(a)), earned);
    await button(b, 'Отмена').click();
    await b.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    assert.deepEqual(progress(await read(a)), earned);

    // Both closing orders from the original failure must preserve all data.
    if (order === 'waiting-first') { await b.close(); await a.close(); }
    else { await a.close(); await b.close(); }
    const c = await open(context); await writable(c);
    assert.deepEqual(progress(await read(c)), earned);
    assert.equal(await c.locator('[data-camp-component="plants"] [data-garden-appearance]').getAttribute('data-garden-appearance'), 'flowers');

    // The waiting store refreshes both progress and the test clock at takeover.
    const d = await open(context);
    await d.getByRole('alert').filter({ hasText: 'другой вкладке' }).waitFor();
    await inspector(c); await button(c, 'Следующий день').click();
    await shoot(c); await submit(c);
    const newer = progress(await read(c));
    assert.equal(newer.creditedDays.length, 2);
    await c.goto('about:blank'); await writable(d);
    assert.deepEqual(progress(await read(d)), newer);
    await shoot(d);
    const next = progress(await read(d));
    assert.equal(next.entries.length, 3); assert.equal(next.rewardEvents.length, 3);
    assert.equal(next.creditedDays.length, 2);
    assert.equal(next.entries.at(-1).dayKey, newer.entries.at(-1).dayKey);
    assert.deepEqual(next.inventory.owned, ['flowers']);
    assert.equal(next.inventory.applied.garden, 'flowers');
    await submit(d);

    // A reset by the writer cannot be resurrected by another stale open page.
    await c.goto(url); await c.getByRole('alert').filter({ hasText: 'другой вкладке' }).waitFor();
    await inspector(d); await button(d, 'Сбросить демосессию').click();
    await button(d, 'Сбросить и начать заново').click(); await d.goto('about:blank');
    await writable(c);
    const reset = await read(c);
    assert.deepEqual(reset.entries, []); assert.deepEqual(reset.jobs, []);
    assert.deepEqual(reset.rewardEvents, []); assert.deepEqual(reset.creditedDays, []);
    assert.deepEqual(reset.inventory, { coins: 0, owned: [], applied: {} });
    await c.reload(); await button(c, 'Инструменты пробы').waitFor(); await writable(c);
    assert.deepEqual(progress(await read(c)), progress(reset));
    await context.close();
  }

  // Simultaneous startup and photo clicks still have exactly one writer.
  const concurrent = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'Europe/London' });
  const pages = await Promise.all([open(concurrent), open(concurrent)]);
  await Promise.all(pages.map(page => page.waitForFunction(() => {
    const alert = document.querySelector('[role="alert"]');
    return !alert || alert.textContent.includes('другой вкладке');
  })));
  await Promise.all(pages.map(shoot));
  const saved = await read(pages[0]);
  assert.equal(saved.entries.length, 1); assert.equal(saved.rewardEvents.length, 1);
  assert.equal(saved.inventory.coins, saved.rewardEvents[0].coins);
  assert.equal(saved.creditedDays.length, 1);
  assert.equal((await Promise.all(pages.map(page => button(page, 'Сохранить и разобрать').count()))).reduce((sum, count) => sum + count, 0), 1);
  await Promise.all(pages.map(page => page.goto('about:blank')));
  const reopened = await open(concurrent); await writable(reopened);
  assert.deepEqual(progress(await read(reopened)), progress(saved));
  await concurrent.close();
  assert.deepEqual(errors, []);
  console.log('PASS: two-tab close orders, blocked stale mutations, exclusive concurrent startup/photo, refreshed takeover/clock, purchase preservation, reset without resurrection, reload; no JavaScript errors.');
} finally { await browser.close(); }
