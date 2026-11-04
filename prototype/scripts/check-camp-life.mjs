import { birdFlightAt } from '../src/core/bird-flight.js';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const origin = process.argv[2] ?? 'http://localhost:6006';
const errors = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(`${origin}/iframe.html?id=workshop--camp-animations&viewMode=story`);
  await page.waitForFunction(() => document.querySelectorAll('canvas[data-frame]').length === 7);
  await page.waitForFunction(() => [...document.querySelectorAll('canvas')].every(el => Number(el.dataset.frame) > 0));
  const painted = await page.locator('canvas').evaluateAll(nodes => nodes.every(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0)));
  assert.ok(painted, 'All seven sprites draw visible pixels');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => [...document.querySelectorAll('canvas')].every(el => el.dataset.frame === '0'));
  await page.screenshot({ path: '/tmp/chewy-camp-life-gallery.png', fullPage: true });
  await page.goto(`${origin}/iframe.html?id=core-sandbox--all-screens&viewMode=story`);
  await page.getByRole('button', { name: 'Инструменты пробы', exact: true }).click();
  await page.getByRole('button', { name: 'Оформление сессии во всех слотах', exact: true }).click();
  await page.getByRole('button', { name: 'Скрыть инструменты пробы', exact: true }).click();
  await page.locator('.camp-life-cloud').waitFor();
  await page.evaluate(() => {
    const key = 'chewy.demo-session.v1';
    const session = JSON.parse(localStorage.getItem(key));
    session.inventory.owned = ['flowers', 'lantern'];
    session.inventory.applied = { garden: 'flowers', decor: 'lantern' };
    localStorage.setItem(key, JSON.stringify(session));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Инструменты пробы', exact: true }).click();
  await page.getByRole('button', { name: 'Оформление сессии во всех слотах', exact: true }).click();
  for (const stage of ['initial', 'developed']) {
    await page.getByLabel('Стадия лагеря').selectOption(stage);
    for (const size of ['compact', 'standard', 'large']) {
      await page.getByLabel('Размер телефона').selectOption(size);
      const lamp = await page.locator('[data-growth-motion=light] canvas').boundingBox();
      const pole = await page.locator('[data-growth-motion=light]').boundingBox();
      assert.ok(lamp.height < pole.height * .62, 'Lamp must fit below the crossbar, not fill the pole');
      assert.ok(lamp.x >= pole.x && lamp.x + lamp.width <= pole.x + pole.width + 1);
      const flowers = await page.locator('[data-garden-appearance=flowers] canvas').boundingBox();
      const garden = await page.locator('[data-garden-appearance=flowers]').boundingBox();
      assert.ok(flowers.y >= garden.y && flowers.y + flowers.height <= garden.y + garden.height + 1, 'Whole flower canvas fits the garden');
    }
  }
  await page.getByLabel('Стадия лагеря').selectOption('initial');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByLabel('Время суток').selectOption('day');
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  // Restart after clock installation so the flight RAF and wing RAF share it.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const samples = [];
  for (let step = 0; step < 90; step++) {
    await page.clock.runFor(100);
    const sample = await page.locator('.camp-life-bird').evaluate(el => ({
      time: Number(el.dataset.flightTime), left: parseFloat(el.style.left) / 100,
      frame: Number(el.querySelector('canvas').dataset.frame),
    }));
    const expected = birdFlightAt(sample.time);
    assert.ok(Math.abs(sample.left - expected.x) < .00001);
    assert.equal(sample.frame, expected.frame, 'Wing frame and thrust use the same time');
    samples.push(sample);
  }
  assert.ok(samples.some(s => s.left + .07 < 0), 'Bird starts fully offscreen');
  assert.ok(samples.some(s => s.left > 1.12), 'Flight continues offscreen without observer deadlock');
  assert.ok(samples.some(s => s.left > .3 && s.left < .7));
  await page.clock.resume();
  for (const kind of ['tent', 'fire']) {
    const sprite = page.locator(`[data-camp-sprite=${kind}]`);
    await sprite.scrollIntoViewIfNeeded();
    const initial = await sprite.getAttribute('data-frame');
    await page.waitForFunction(({ kind, initial }) => document.querySelector(`[data-camp-sprite=${kind}]`).dataset.frame !== initial, { kind, initial });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-growth-motion] canvas')].every(el => el.dataset.frame === '0'));
  await page.getByRole('button', { name: 'Скрыть инструменты пробы', exact: true }).click();
  await page.screenshot({ path: '/tmp/chewy-camp-life-main.png', fullPage: true });
  assert.equal(await page.locator('.camp-life').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
  await page.getByRole('button', { name: 'Добавить еду', exact: true }).click();
  await page.getByRole('button', { name: 'Сфотографировать еду', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: seven animated sprites, alpha rendering, reduced motion, camp overlay, navigation, no browser errors');
  await context.close();
} finally { await browser.close(); }
