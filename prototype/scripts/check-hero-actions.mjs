// Exercise the real Rive runtime in an isolated context, without opening the camp session.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://127.0.0.1:6006';
const browser = await chromium.launch({ headless: true });
const errors = [];
const storage = {
  'chewy.demo-session.v1': 'untouched animation-study sentinel',
  'chewy.sandbox.placement.v1.growth.v1.separate': 'untouched owner-layout sentinel',
};
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'no-preference' });
await context.addInitScript(values => {
  for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
}, storage);
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
const ready = async target => {
  await target.waitForFunction(() => Boolean(window.chewyHero));
  await target.evaluate(async () => { await window.chewyHero.ready; });
};
const state = () => page.evaluate(() => window.chewyHero.state());
const set = values => page.evaluate(values => window.chewyHero.set(values), values);
const imageHash = async target => createHash('sha256').update(await target.locator('canvas').first().screenshot()).digest('hex');
const expectState = async expected => {
  const actual = await state();
  for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, key);
};
try {
  await page.goto(`${origin}/hero-actions/index.html`);
  await ready(page);
  await expectState({ action: 'idle', outfit: 'camp', prop: 'none' });
  await set({ action: 'walk', x: 45 });
  await page.evaluate(() => window.chewyHero.resume());
  await page.waitForTimeout(320);
  const walkFrame = await imageHash(page);
  await page.waitForTimeout(180);
  assert.notEqual(await imageHash(page), walkFrame, 'walk changes actual rendered frames');
  await set({ outfit: 'trail', prop: 'stick' });
  await page.waitForTimeout(300);
  await expectState({ action: 'walk', outfit: 'trail', prop: 'stick', x: 45 });
  await page.evaluate(() => window.chewyHero.pause());
  await page.waitForTimeout(100);
  const frozenFrame = await imageHash(page);
  await page.waitForTimeout(200);
  assert.equal(await imageHash(page), frozenFrame, 'pause freezes the actual rendered rig');
  await set({ outfit: 'camp' });
  await page.waitForTimeout(120);
  assert.notEqual(await imageHash(page), frozenFrame, 'a new outfit is visible while paused');
  await expectState({ action: 'walk', outfit: 'camp', prop: 'stick', x: 45 });
  await page.evaluate(() => window.chewyHero.resume());
  for (const action of ['sit', 'reach', 'idle', 'walk', 'sit']) {
    await set({ action });
    await page.waitForTimeout(280);
    await expectState({ action, outfit: 'camp', prop: 'stick', x: 45 });
  }
  await set({ facing: -1, x: 60 });
  await page.waitForTimeout(150);
  await expectState({ action: 'sit', outfit: 'camp', prop: 'stick', facing: -1, x: 60 });
  await page.evaluate(() => window.chewyHero.pause());
  await page.screenshot({ path: '/tmp/chewy-hero-actions-desktop.png', fullPage: true });
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no horizontal overflow at ${width}`);
    assert.ok(await page.locator('canvas').first().isVisible());
    await expectState({ action: 'sit', outfit: 'camp', prop: 'stick', x: 60 });
    await page.screenshot({ path: `/tmp/chewy-hero-actions-${width}.png`, fullPage: true });
  }
  assert.deepEqual(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(storage)), storage);
  await page.goto(`${origin}/iframe.html?id=workshop--hero-actions&viewMode=story`);
  const study = page.frameLocator('iframe[title="Чуви: проба движения, одежды и реквизита"]');
  await study.locator('canvas').first().waitFor();
  assert.deepEqual(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(storage)), storage);

  const reduced = await browser.newContext({ viewport: { width: 900, height: 900 }, reducedMotion: 'reduce' });
  const still = await reduced.newPage();
  still.on('pageerror', error => errors.push(error.message));
  await still.goto(`${origin}/hero-actions/index.html`);
  await ready(still);
  await still.waitForTimeout(100);
  const before = await imageHash(still);
  await still.waitForTimeout(200);
  assert.equal(await imageHash(still), before, 'reduced motion starts with a stable pose');
  await still.evaluate(() => { window.chewyHero.set({ action: 'walk' }); window.chewyHero.resume(); });
  await still.waitForTimeout(320);
  const playing = await imageHash(still);
  await still.waitForTimeout(180);
  assert.notEqual(await imageHash(still), playing, 'explicit playback works with reduced motion');
  await reduced.close();

  const unavailable = await context.newPage();
  unavailable.on('pageerror', error => errors.push(error.message));
  const assetRoute = '**/exports/hero-actions.riv';
  await unavailable.route(assetRoute, route => route.fulfill({ status: 404, body: 'missing test asset' }));
  await unavailable.goto(`${origin}/hero-actions/index.html`);
  await unavailable.getByRole('alert').waitFor();
  assert.equal(await unavailable.getByRole('button', { name: 'Стоит', exact: true }).isDisabled(), true);
  await unavailable.unroute(assetRoute);
  await unavailable.getByRole('button', { name: 'Загрузить снова', exact: true }).click();
  await ready(unavailable);
  assert.equal(await unavailable.getByRole('alert').isHidden(), true, 'failed asset load can recover');
  await unavailable.close();
  assert.deepEqual(errors, []);
  console.log('PASS: real Rive motion, live outfit/prop changes, interruption and return, independent placement/facing, paused outfit update, reduced motion, three widths, failed-load recovery, Storybook entry, no session/layout writes.');
} finally {
  await browser.close();
}
