// Stage 4.3: permission fallback, discard, cancellation, deletion, and stale replies.
// Separate browser contexts keep the owner's Storybook session untouched.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const origin = process.argv[2] ?? 'http://localhost:6006';
const url = `${origin}/iframe.html?id=core-sandbox--all-screens&viewMode=story`;
const key = 'chewy.demo-session.v1';
const errors = [];
const failures = [];
const empty = { protein: false, carbs: false, fats: false, plants: false };
const breakfast = { ...empty, carbs: true, plants: true };
const dinner = { ...empty, protein: true };
const durable = ({ jobs, lastSeenAt, ...session }) => session;
const savedContent = ({ lastSeenAt, ...session }) => session;

const run = async (name, check) => {
  if (process.argv[3] && !name.includes(process.argv[3])) return;
  const context = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'Europe/London' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const button = name => page.getByRole('button', { name, exact: true });
  const heading = name => page.getByRole('heading', { name, exact: true });
  const dialog = name => page.getByRole('dialog', { name, exact: true });
  const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  const loaded = () => button('Инструменты пробы').waitFor();
  const inspector = async () => {
    if (await button('Инструменты пробы').isVisible()) await button('Инструменты пробы').click();
  };
  const reload = async () => { await page.reload(); await loaded(); };
  const complete = async () => { await inspector(); await button('Завершить анализ').click(); };
  const remember = async () => { await inspector(); await button('Запомнить ответ попытки').click(); };
  const deliver = async () => { await inspector(); await button('Доставить сохранённый ответ').click(); };
  const notice = id => page.locator('.capture-notice').filter({ has: page.locator(`[data-capture-id="${id}"]`) });
  const permission = async value => { await inspector(); await page.getByLabel('Доступ к камере', { exact: true }).selectOption(value); };
  const outcome = async value => { await inspector(); await page.getByLabel('Ответ анализа', { exact: true }).selectOption(value); };
  const components = async expected => assert.deepEqual(await page.locator('[data-camp-component]').evaluateAll(
    elements => Object.fromEntries(elements.map(el => [el.dataset.campComponent, el.dataset.dailyContribution === 'present']))
  ), expected);
  const failNextWrite = async () => page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) { Storage.prototype.setItem = original; throw new Error('test lifecycle write failure'); }
      return original.call(this, name, value);
    };
  }, key);
  const gallery = async (sample, denied = false) => {
    await button(denied ? 'Выбрать из галереи' : 'Галерея').click();
    await button(`Выбрать фото: ${sample}`).click(); await button('Добавить фото · 1').click();
  };
  const add = async sample => {
    await button('Добавить еду').click(); await gallery(sample);
    await button('Сохранить и разобрать').click(); await button('Рюкзак').waitFor();
    return (await read()).jobs.at(-1);
  };
  const focused = async control => assert.equal(await control.evaluate(el => document.activeElement === el), true);
  const confirm = async (title, action) => {
    const modal = dialog(title); await modal.waitFor(); await modal.getByRole('button', { name: action, exact: true }).click();
  };
  const failureInDialog = async (title, action, before) => {
    await failNextWrite(); await confirm(title, action); await dialog(title).waitFor();
    assert.match(await dialog(title).getByRole('alert').innerText(), /Не удалось сохранить/);
    assert.deepEqual(savedContent(await read()), savedContent(before));
  };
  const controlsFit = async (names, size, container = '.capture-phone') => {
    const host = await page.locator(container).boundingBox();
    for (const name of names) {
      const control = button(name); await control.scrollIntoViewIfNeeded();
      const bounds = await control.boundingBox();
      assert.ok(bounds.height >= 44 && bounds.y >= host.y - 1 && bounds.y + bounds.height <= host.y + host.height + 1,
        `${size}: ${name} remains reachable`);
      await control.focus(); await focused(control);
    }
  };
  const dialogFits = async (title, size) => {
    const bounds = await dialog(title).boundingBox();
    const phone = await page.locator('.capture-phone').boundingBox();
    const scrollY = await page.evaluate(() => window.scrollY);
    const viewport = page.viewportSize();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height,
      `${size}: entire confirmation is visible in the viewport: ${JSON.stringify({ bounds, phone, scrollY, viewport })}`);
  };
  try {
    await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-29T12:00:01Z'));
    await page.goto(url); await loaded();
    await check({ page, button, heading, dialog, read, inspector, reload, complete, remember, deliver, notice,
      permission, outcome, components, failNextWrite, gallery, add, focused, confirm, failureInDialog, controlsFit, dialogFits });
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL: ${name}: ${error.stack}`);
    await page.screenshot({ path: `/tmp/chewy-lifecycle-failure-${failures.length}.png`, fullPage: true });
  } finally { await context.close(); }
};

try {
  await run('denied camera, gallery cancellation, draft discard, and isolated permission story', async ({ page, button, heading,
    dialog, read, permission, gallery, focused, confirm, reload, controlsFit, failNextWrite, dialogFits }) => {
    await permission('denied'); await button('Добавить еду').click(); await heading('Камера недоступна').waitFor();
    assert.equal(await button('Сфотографировать еду').isDisabled(), true);
    assert.equal((await read()).entries.length, 0);
    await button('Выбрать из галереи').click(); await button('Выбрать фото: Ужин').click();
    await button('Назад к камере').click(); await heading('Камера недоступна').waitFor();
    assert.equal((await read()).entries.length, 0); assert.equal(await button('Фото 1').count(), 0);
    await button('Вернуться в лагерь').click(); await focused(button('Добавить еду'));
    await button('Добавить еду').click(); await button('Выбрать из галереи').click();
    await button('Выбрать фото: Ужин').click(); const beforePhoto = await read();
    await failNextWrite(); await button('Добавить фото · 1').click();
    assert.deepEqual(savedContent(await read()), savedContent(beforePhoto));
    assert.equal(await button('Добавить фото · 1').isVisible(), true);
    await button('Добавить фото · 1').click();
    const rewarded = await read(); assert.equal(rewarded.entries.length, 1); assert.equal(rewarded.rewardEvents.length, 1);
    await button('Детали').click();
    const notes = page.locator('.capture-details-sheet textarea');
    await notes.fill('Соус отдельно'); await button('Большая').click();
    await button('Готово').click();
    await button('Выбрать из галереи').click(); await button('Выбрать фото: Завтрак').click();
    await button('Назад к камере').click();
    assert.equal(await button('Фото 1').count(), 1); assert.equal(await button('Фото 2').count(), 0);
    await button('Детали добавлены').click(); assert.equal(await notes.inputValue(), 'Соус отдельно');
    assert.equal(await button('Большая').getAttribute('aria-pressed'), 'true'); await button('Готово').click();
    await button('Фото 1').click(); const originalPhoto = await page.locator('.capture-camera-world img').getAttribute('src');
    await page.getByRole('button', { name: /Переснять/ }).click();
    await button('Выбрать из галереи').click(); await button('Выбрать фото: Завтрак').click();
    await button('Назад к камере').click(); await button('Отменить пересъёмку').click();
    assert.equal(await page.locator('.capture-camera-world img').getAttribute('src'), originalPhoto);
    await button('Назад к камере').click();
    await button('Выйти из добавления').click(); await dialog('Уйти без разбора?').waitFor();
    await focused(dialog('Уйти без разбора?').getByRole('button', { name: 'Остаться', exact: true }));
    await page.keyboard.press('Shift+Tab');
    await focused(dialog('Уйти без разбора?').getByRole('button', { name: 'Уйти без разбора', exact: true }));
    await page.keyboard.press('Tab');
    await focused(dialog('Уйти без разбора?').getByRole('button', { name: 'Остаться', exact: true }));
    await page.keyboard.press('Escape'); await focused(button('Выйти из добавления'));
    await button('Выйти из добавления').click(); await page.mouse.click(2, 2);
    await focused(button('Выйти из добавления'));
    assert.deepEqual(durable(await read()), durable(rewarded));
    for (const size of ['compact', 'standard', 'large']) {
      await page.getByLabel('Размер телефона').selectOption(size);
      await controlsFit(['Выбрать из галереи', 'Сохранить и разобрать', 'Выйти из добавления'], size);
      await button('Выйти из добавления').click();
      await dialogFits('Уйти без разбора?', size);
      await dialog('Уйти без разбора?').screenshot({ path: `/tmp/chewy-discard-${size}.png` });
      await confirm('Уйти без разбора?', 'Остаться');
    }
    await button('Выйти из добавления').click(); await confirm('Уйти без разбора?', 'Уйти без разбора');
    await focused(button('Добавить еду')); assert.deepEqual(durable(await read()), durable(rewarded));
    assert.equal((await read()).jobs.length, 0); await reload();
    assert.deepEqual(durable(await read()), durable(rewarded));

    // Removing the final photo allows a plain exit; its earned reward still remains.
    await button('Добавить еду').click(); await gallery('Завтрак'); await button('Фото 1').click();
    await button('Убрать фото').click(); const removedPhoto = await read();
    await button('Вернуться в лагерь').click(); assert.equal(await page.getByRole('dialog').count(), 0);
    assert.deepEqual(durable(await read()), durable(removedPhoto)); assert.equal(removedPhoto.rewardEvents.length, 2);
    await permission('allowed'); await page.locator('.review-screen-picker select').selectOption('cameraDenied');
    await heading('Камера недоступна').waitFor();
    assert.equal(await page.getByLabel('Доступ к камере', { exact: true }).inputValue(), 'denied');
    await button('Вернуться в лагерь').click();
    const main = await read();
    await page.goto(`${origin}/iframe.html?id=core-sandbox--camera-denied&viewMode=story`);
    await heading('Камера недоступна').waitFor(); await gallery('Ужин', true);
    await button('Сохранить и разобрать').click(); await button('Рюкзак').waitFor();
    assert.deepEqual(savedContent(await read()), savedContent(main));
  });

  await run('plain processing exit persists; confirmed cancellation rejects queued replies and write failure', async ({ page,
    button, heading, dialog, read, add, notice, reload, remember, deliver, confirm, failureInDialog, focused, components }) => {
    const job = await add('Ужин'); const submitted = await read();
    await notice(job.id).click(); await page.getByText('Разбираем еду', { exact: true }).waitFor();
    await button('В лагерь').click(); assert.deepEqual((await read()).jobs, submitted.jobs);
    await reload(); assert.deepEqual((await read()).jobs, submitted.jobs); await notice(job.id).click();
    await remember(); await button('Отменить разбор').click();
    await focused(dialog('Отменить разбор?').getByRole('button', { name: 'Оставить запись', exact: true }));
    await confirm('Отменить разбор?', 'Оставить запись'); await focused(button('Отменить разбор'));
    assert.deepEqual((await read()).jobs, submitted.jobs);
    await button('Отменить разбор').click(); await failureInDialog('Отменить разбор?', 'Отменить разбор', await read());
    await confirm('Отменить разбор?', 'Отменить разбор'); await focused(button('Добавить еду'));
    assert.equal((await read()).jobs.length, 0); assert.deepEqual(durable(await read()), durable(submitted));
    await deliver(); assert.equal((await read()).jobs.length, 0); await components(empty);
    await page.clock.fastForward(60000); await reload();
    assert.equal((await read()).jobs.length, 0); assert.deepEqual(durable(await read()), durable(submitted));
    await button('Путь').click(); await button('Открыть день').click();
    assert.equal(await page.locator('.journey-day').getAttribute('data-history-day'), job.dayKey);
    assert.match(await page.locator('.journey-day-empty').innerText(), /Готовых записей еды за этот день пока нет/);
  });

  await run('completion while cancellation confirmation is open keeps the finished result', async ({ page, button, heading,
    dialog, read, add, notice, confirm, focused }) => {
    const job = await add('Ужин'); await notice(job.id).click(); await button('Отменить разбор').click();
    await page.clock.fastForward(21000); assert.equal((await read()).jobs[0].status, 'ready');
    const ready = await read(); await confirm('Отменить разбор?', 'Отменить разбор');
    await dialog('Отменить разбор?').waitFor();
    assert.match(await dialog('Отменить разбор?').getByRole('alert').innerText(), /Запись уже изменилась/);
    assert.deepEqual(savedContent(await read()), savedContent(ready));
    await confirm('Отменить разбор?', 'Оставить запись'); await heading('Курица с картофелем').waitFor();
    await focused(button('Вернуться в лагерь'));
  });

  await run('cancel clarification restores prior photos and contribution without accepting the old attempt', async ({ page,
    button, heading, read, add, complete, notice, remember, deliver, confirm, failureInDialog, components, outcome, reload }) => {
    const job = await add('Ужин'); await complete(); await notice(job.id).click();
    await heading('Курица с картофелем').waitFor(); const original = (await read()).jobs[0];
    const oldPhoto = await page.locator('.capture-result-photo img').getAttribute('src');
    const edit = async () => {
      await button('Уточнить результат').click(); await page.getByLabel('Название блюда').fill('Овсянка с ягодами');
      await page.getByLabel('Что уточнить?').fill('Соус отдельно'); await button('Большая').click();
      await page.locator('.capture-edit-photos').click(); await button('Фото 1').click();
      await page.getByRole('button', { name: /Переснять/ }).click(); await button('Галерея').click();
      await button('Выбрать фото: Завтрак').click(); await button('Добавить фото · 1').click();
      await button('Готово, к уточнению').click(); await button('Повторить анализ').click();
      await page.getByText('Уточняем разбор', { exact: true }).waitFor();
    };
    await edit(); const pending = (await read()).jobs[0]; await remember();
    await button('Отменить уточнение').click();
    await failureInDialog('Отменить уточнение?', 'Отменить уточнение', await read());
    await confirm('Отменить уточнение?', 'Отменить уточнение'); await heading('Курица с картофелем').waitFor();
    const restored = (await read()).jobs[0]; assert.deepEqual(restored.result, original.result);
    assert.deepEqual(restored.photos, original.result.photos); assert.equal(restored.status, 'ready');
    assert.equal(await page.locator('.capture-result-photo img').getAttribute('src'), oldPhoto);
    await deliver(); assert.deepEqual((await read()).jobs[0], restored);
    await edit(); assert.ok((await read()).jobs[0].attempt > pending.attempt);
    await deliver(); assert.equal((await read()).jobs[0].status, 'processing');
    await button('Отменить уточнение').click(); await confirm('Отменить уточнение?', 'Отменить уточнение');
    await button('В лагерь').click(); await components(dinner); await reload(); await components(dinner);
    assert.deepEqual((await read()).jobs[0].result, original.result);

    // Cancelling failed or non-food clarification also returns to its confirmed result.
    for (const answer of ['offline', 'notFood']) {
      await button('Открыть дневник еды за сегодня').click();
      await page.getByRole('list', { name: 'Еда сегодня' }).getByRole('button').click();
      await outcome(answer); await edit(); await complete();
      await heading(answer === 'offline' ? 'Нет связи' : 'Не удалось узнать еду').waitFor();
      await button('Отменить уточнение').click(); await confirm('Отменить уточнение?', 'Отменить уточнение');
      await heading('Курица с картофелем').waitFor(); assert.deepEqual((await read()).jobs[0].result, original.result);
      await button('В лагерь').click(); await components(dinner);
    }
    assert.equal((await read()).rewardEvents.length, 1); assert.equal((await read()).jobs.length, 1);
  });

  await run('confirmed deletion from history removes only meal contribution and preserves inventory and earned day', async ({
    page, button, heading, dialog, read, add, complete, components, confirm, failureInDialog, reload, focused, controlsFit,
    inspector, remember, deliver, dialogFits }) => {
    const first = await add('Завтрак'); await complete(); const second = await add('Ужин'); await complete();
    await button('Рюкзак').click(); await button('Магазин').click(); await button('Купить · 5 монет').click();
    await button('Купить за 5 монет').click(); await button('Примерить').click(); await button('Применить').click();
    await button('В лагерь').click(); await components({ ...breakfast, protein: true }); const earned = await read();
    await button('Путь').click(); await button('Открыть день').click();
    await page.getByRole('list', { name: 'Еда за выбранный день' }).getByRole('button', { name: /Курица с картофелем/ }).click();
    await heading('Курица с картофелем').waitFor();
    for (const size of ['compact', 'standard', 'large']) {
      await inspector(); await page.getByLabel('Размер телефона').selectOption(size);
      await controlsFit(['Удалить запись', 'Уточнить результат', 'К дню'], size);
      await button('Удалить запись').click();
      await focused(dialog('Удалить запись?').getByRole('button', { name: 'Оставить запись', exact: true }));
      await dialogFits('Удалить запись?', size);
      await dialog('Удалить запись?').screenshot({ path: `/tmp/chewy-delete-${size}.png` });
      await page.keyboard.press('Escape'); await focused(button('Удалить запись'));
    }
    const beforeDelete = await read(); await button('Удалить запись').click();
    await failureInDialog('Удалить запись?', 'Удалить запись', beforeDelete);
    await confirm('Удалить запись?', 'Удалить запись');
    assert.equal(await page.locator('.journey-day').getAttribute('data-history-day'), first.dayKey);
    await focused(button('К пути'));
    assert.deepEqual((await read()).jobs.map(job => job.id), [first.id]);
    assert.deepEqual(durable(await read()), durable(earned));
    await button('К пути').click(); await button('В лагерь').click(); await components(breakfast);
    await reload(); await components(breakfast); assert.deepEqual(durable(await read()), durable(earned));

    // Delete the remaining confirmed record while its clarification reply is queued.
    await button('Путь').click(); await button('Открыть день').click();
    await page.getByRole('list', { name: 'Еда за выбранный день' }).getByRole('button').click();
    await button('Уточнить результат').click(); await page.getByLabel('Что уточнить?').fill('Соус отдельно');
    await button('Повторить анализ').click(); await remember(); await button('Прежний результат').click();
    await button('Удалить запись').click(); await confirm('Удалить запись?', 'Удалить запись');
    await deliver(); assert.equal((await read()).jobs.length, 0);
    assert.equal(await page.locator('.journey-day').getAttribute('data-history-day'), first.dayKey);
    assert.match(await page.locator('.journey-day-empty').innerText(), /Готовых записей еды за этот день пока нет/);
    assert.equal(await page.getByLabel('День истории').locator('option').count(), 1);
    assert.deepEqual(durable(await read()), durable(earned));
    await button('К пути').click(); await button('В лагерь').click(); await components(empty);
    assert.equal(await page.locator('[data-camp-component="plants"] [data-garden-appearance]').getAttribute('data-garden-appearance'), 'flowers');
    await page.clock.fastForward(60000); await reload(); assert.equal((await read()).jobs.length, 0);
    assert.deepEqual(durable(await read()), durable(earned)); await components(empty);
  });

  assert.deepEqual(errors, [], 'no JavaScript errors');
  assert.deepEqual(failures, [], 'capture lifecycle regressions');
} finally { await browser.close(); }
