import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const variants = JSON.parse(fs.readFileSync(new URL('../src/core/variant-motion.json', import.meta.url)));
const labels = { shelter: 'Жильё', garden: 'Растения', pet: 'Питомец', lamp: 'Свет', hearth: 'Очаг', background: 'Фон' };
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1350, height: 1100 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(`${process.argv[2] ?? 'http://localhost:6006'}/iframe.html?id=core-sandbox--all-screens&viewMode=story`);
  await page.getByRole('button', { name: 'Инструменты пробы', exact: true }).click();
  assert.equal(await page.locator('[data-variant-motion]').count(), 4);
  assert.equal(variants.length, 21);
  for (const size of ['compact', 'standard', 'large']) {
    await page.getByLabel('Размер телефона').selectOption(size);
    for (const item of variants) {
      await page.getByLabel(`Анимация · ${labels[item.group]}`).selectOption(item.slug);
      const image = page.locator(`[data-variant-motion="${item.slug}"]`);
      await image.waitFor();
      await page.waitForFunction(slug => { const el = document.querySelector(`[data-variant-motion="${slug}"]`); return el?.complete && el.naturalWidth > 0 && el.src.endsWith('/motion.webp'); }, item.slug);
      const box = await image.boundingBox();
      const parent = await image.locator('..').boundingBox();
      assert.ok(box.width > 0 && box.height > 0);
      assert.ok(box.x >= parent.x - 1 && box.y >= parent.y - 1 && box.x + box.width <= parent.x + parent.width + 1 && box.y + box.height <= parent.y + parent.height + 1, item.slug);
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-variant-motion]')].every(el => el.src.endsWith('/poster.png')));
  await page.screenshot({ path: '/tmp/chewy-variant-motion.png', fullPage: true });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-variant-motion]')].every(el => el.src.endsWith('/motion.webp')));
  await page.getByRole('button', { name: 'Оформление сессии во всех слотах', exact: true }).click();
  assert.equal(await page.locator('[data-variant-motion]').count(), 0);
  await page.getByRole('button', { name: 'Пример анимированного лагеря', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: '/tmp/chewy-variant-default.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: 21 variants × 3 sizes; reduced motion, playback, restore; no browser errors.');
} finally { await browser.close(); }
