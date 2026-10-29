// Stage 4.4: real date/zone boundaries, late answers, and optional result visits.
// Each flow uses a fresh browser context; no authored session data is injected.
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
const progress = ({ entries, rewardEvents, creditedDays, regularity, inventory, exploration }) =>
  ({ entries, rewardEvents, creditedDays, regularity, inventory, exploration });
const identity = ({ id, createdAt, firstPhotoAt, dayKey }) => ({ id, createdAt: createdAt ?? firstPhotoAt, dayKey });

const run = async (name, time, check) => {
  if (process.argv[3] && !name.includes(process.argv[3])) return;
  // Own the CDP override so it can change on the same live page, including a draft.
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const button = name => page.getByRole('button', { name, exact: true });
  const heading = name => page.getByRole('heading', { name, exact: true });
  const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  const failNextWrite = async () => page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) { Storage.prototype.setItem = original; throw new Error('test viewed-result write failure'); }
      return original.call(this, name, value);
    };
  }, key);
  const loaded = () => button('Инструменты пробы').waitFor();
  const inspector = async () => {
    if (await button('Инструменты пробы').isVisible()) await button('Инструменты пробы').click();
  };
  const outcome = async value => { await inspector(); await page.getByLabel('Ответ анализа', { exact: true }).selectOption(value); };
  const complete = async () => { await inspector(); await button('Завершить анализ').click(); };
  const reload = async () => { await page.reload(); await loaded(); };
  const notice = id => page.locator('.capture-notice').filter({ has: page.locator(`[data-capture-id="${id}"]`) });
  const components = async expected => assert.deepEqual(await page.locator('[data-camp-component]').evaluateAll(
    elements => Object.fromEntries(elements.map(el => [el.dataset.campComponent, el.dataset.dailyContribution === 'present']))
  ), expected);
  const localDate = () => page.evaluate(() => {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  });
  const zone = async timezoneId => {
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId });
    await page.clock.fastForward(1000);
    assert.equal(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone), timezoneId);
  };
  const setTime = async instant => {
    await page.clock.setSystemTime(new Date(instant));
    await page.clock.fastForward(1000);
  };
  const gallery = async sample => {
    await button('Галерея').click(); await button(`Выбрать фото: ${sample}`).click();
    await button('Добавить фото · 1').click();
  };
  const draft = async sample => { await button('Добавить еду').click(); await gallery(sample); };
  const submit = async () => {
    await button('Сохранить и разобрать').click(); await button('Рюкзак').waitFor();
    return (await read()).jobs.at(-1);
  };
  const history = async dayKey => {
    await button('Путь').click(); await button('Открыть день').click();
    await page.getByLabel('День истории').selectOption(dayKey);
    assert.equal(await page.locator('.journey-day').getAttribute('data-history-day'), dayKey);
  };
  const leaveHistory = async () => { await button('К пути').click(); await button('В лагерь').click(); };
  const mealRow = id => page.locator(`[data-meal-id="${id}"]`);
  const historicalContributions = async expected => assert.deepEqual(await page.locator('.journey-day .nutrition-supply-existing')
    .evaluateAll(elements => elements.map(el => el.style.width)), Object.values(expected).map(present => present ? '100%' : '0%'));
  const controlsFit = async (names, size, hostSelector) => {
    for (const name of names) {
      const control = button(name); await control.scrollIntoViewIfNeeded();
      const host = await page.locator(hostSelector).boundingBox();
      const bounds = await control.boundingBox();
      assert.ok(bounds.height >= 44 && bounds.y >= host.y - 1 && bounds.y + bounds.height <= host.y + host.height + 1,
        `${size}: ${name} remains reachable inside the phone: ${JSON.stringify({ host, bounds })}`);
      await control.focus(); assert.equal(await control.evaluate(el => document.activeElement === el), true);
    }
  };
  page.on('pageerror', error => errors.push(error.message));
  try {
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'Europe/London' });
    await page.clock.install({ time: new Date(time) }); await page.clock.pauseAt(new Date(time));
    await page.goto(url); await loaded();
    await check({ page, button, heading, read, failNextWrite, inspector, outcome, complete, reload, notice, components,
      localDate, zone, setTime, gallery, draft, submit, history, leaveHistory, mealRow, historicalContributions, controlsFit });
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL: ${name}: ${error.stack}`);
    await page.screenshot({ path: `/tmp/chewy-boundary-failure-${failures.length}.png`, fullPage: true });
  } finally { await context.close(); }
};

try {
  await run('midnight draft, late and current replies, independent optional result visits', '2026-10-29T23:59:50Z', async ({
    page, button, heading, read, failNextWrite, inspector, complete, reload, notice, components, localDate, setTime, draft, submit,
    history, leaveHistory, mealRow, historicalContributions, controlsFit,
  }) => {
    await draft('Ужин'); const firstPhoto = await read();
    assert.equal(firstPhoto.entries[0].dayKey, '2026-10-29');
    await setTime('2026-10-30T00:00:01Z'); assert.equal(await localDate(), '2026-10-30');
    await button('Сфотографировать еду').click();
    assert.deepEqual(progress(await read()), progress(firstPhoto));
    const old = await submit(); assert.deepEqual(identity(old), identity(firstPhoto.entries[0]));
    assert.equal(old.photos.length, 2); await components(empty);
    await page.clock.fastForward(1000); await draft('Завтрак'); const current = await submit();
    assert.equal(current.dayKey, '2026-10-30');
    const submitted = await read(); assert.equal(submitted.rewardEvents.length, 2);
    assert.deepEqual(submitted.creditedDays, ['2026-10-29', '2026-10-30']);
    await complete(); await components(breakfast);
    assert.equal(await page.locator('.capture-analysis').count(), 0, 'several replies do not force a result scene');
    assert.equal((await read()).jobs.every(job => job.status === 'ready'), true);
    assert.deepEqual(progress(await read()), progress(submitted));
    await reload(); await components(breakfast); await notice(current.id).waitFor();

    // Current-day diary contains only today's meal; the late meal remains independently reachable.
    await button('Открыть дневник еды за сегодня').click();
    assert.equal(await page.getByRole('list', { name: 'Еда сегодня' }).getByRole('listitem').count(), 1);
    assert.equal(await mealRow(old.id).count(), 0); await mealRow(current.id).getByRole('button').click();
    await heading('Овсянка с ягодами').waitFor();
    const beforeViewedWrite = await read(); await failNextWrite(); await button('В лагерь').click();
    await heading('Овсянка с ягодами').waitFor();
    assert.match(await page.getByRole('alert').first().innerText(), /Не удалось сохранить/);
    assert.deepEqual((await read()).jobs, beforeViewedWrite.jobs);
    assert.deepEqual(progress(await read()), progress(submitted));
    await button('В лагерь').click();
    await notice(old.id).waitFor(); assert.match(await notice(old.id).innerText(), /29 окт/);
    assert.equal(await page.locator('.capture-analysis').count(), 0, 'another unseen result stays optional');
    for (const size of ['compact', 'standard', 'large']) {
      await inspector(); await page.getByLabel('Размер телефона').selectOption(size);
      await controlsFit(['Добавить еду', 'Рюкзак', 'Путь'], size, '.sandbox-phone');
      await page.locator('.sandbox-phone').screenshot({ path: `/tmp/chewy-late-notice-${size}.png` });
    }
    await notice(old.id).click(); await heading('Курица с картофелем').waitFor();
    await button('В лагерь').click(); await components(breakfast);
    assert.equal(await page.locator('.capture-notice').count(), 0);
    assert.deepEqual(progress(await read()), progress(submitted));

    await history(old.dayKey); assert.equal(await mealRow(old.id).count(), 1); assert.equal(await mealRow(current.id).count(), 0);
    await historicalContributions(dinner);
    for (const size of ['compact', 'standard', 'large']) {
      await inspector(); await page.getByLabel('Размер телефона').selectOption(size);
      await controlsFit(['К пути'], size, '.study-phone');
      const entry = mealRow(old.id).getByRole('button'); await entry.scrollIntoViewIfNeeded();
      const rowBounds = await entry.boundingBox(); const scrollBounds = await page.locator('.journey-day-scroll').boundingBox();
      assert.ok(rowBounds.height >= 44 && rowBounds.y >= scrollBounds.y - 1
        && rowBounds.y + rowBounds.height <= scrollBounds.y + scrollBounds.height + 1,
      `${size}: the historical meal remains reachable by scrolling`);
      await entry.focus(); assert.equal(await entry.evaluate(el => document.activeElement === el), true);
      await page.locator('.study-phone').screenshot({ path: `/tmp/chewy-late-history-${size}.png` });
    }
    for (let visit = 0; visit < 2; visit += 1) {
      await mealRow(old.id).getByRole('button').click(); await heading('Курица с картофелем').waitFor();
      await button('К дню').click(); assert.equal(await page.locator('.journey-day').getAttribute('data-history-day'), old.dayKey);
    }
    await page.getByLabel('День истории').selectOption(current.dayKey);
    await historicalContributions(breakfast); await leaveHistory(); await components(breakfast);
    assert.deepEqual(progress(await read()), progress(submitted));
  });

  await run('timezone change during draft, delayed non-food, correction on original day', '2026-10-29T23:30:00Z', async ({
    page, button, heading, read, outcome, complete, reload, notice, components, localDate, zone, setTime, gallery,
    draft, submit, history, leaveHistory, mealRow, historicalContributions,
  }) => {
    await outcome('notFood'); await draft('Ужин'); const firstPhoto = await read();
    await zone('Pacific/Kiritimati'); assert.equal(await localDate(), '2026-10-30');
    await button('Сфотографировать еду').click(); assert.deepEqual(progress(await read()), progress(firstPhoto));
    const original = await submit(); assert.deepEqual(identity(original), identity(firstPhoto.entries[0]));
    assert.equal(original.dayKey, '2026-10-29'); await reload();
    assert.deepEqual((await read()).jobs[0], original); await components(empty);
    // Two local dates have passed since the photo; arriving now cannot create today's contribution.
    await setTime('2026-10-30T11:00:00Z'); assert.equal(await localDate(), '2026-10-31');
    assert.equal((await read()).jobs[0].status, 'notFood'); await components(empty);
    assert.deepEqual(progress(await read()), progress(firstPhoto));
    assert.match(await notice(original.id).innerText(), /29 окт/);
    await notice(original.id).click(); await heading('Не удалось узнать еду').waitFor();
    await button('В лагерь').click();
    await history(original.dayKey); await mealRow(original.id).getByRole('button').click();
    await heading('Не удалось узнать еду').waitFor(); await outcome('success');
    await button('Уточнить запись').click(); await page.getByLabel('Название блюда').fill('Овсянка с ягодами');
    await page.getByLabel('Что уточнить?').fill('Соус отдельно');
    await page.locator('.capture-edit-photos').click(); await button('Фото 1').click();
    await page.getByRole('button', { name: /Переснять/ }).click(); await gallery('Завтрак');
    await button('Готово, к уточнению').click(); await button('Повторить анализ').click();
    const revision = (await read()).jobs[0]; assert.deepEqual(identity(revision), identity(original));
    assert.equal(revision.attempt, original.attempt + 1); assert.equal(revision.photos.length, 2);
    assert.equal(revision.photos[0].imageKey, 'breakfast');
    await zone('America/Los_Angeles'); assert.equal(await localDate(), '2026-10-30');
    await complete(); await heading('Овсянка с ягодами').waitFor();
    await button('К дню').click(); assert.equal(await page.locator('.journey-day').getAttribute('data-history-day'), original.dayKey);
    await historicalContributions(breakfast); await leaveHistory(); await components(empty);
    assert.deepEqual(progress(await read()), progress(firstPhoto));
    await reload(); await components(empty); assert.deepEqual(identity((await read()).jobs[0]), identity(original));
    assert.equal((await read()).jobs.length, 1); assert.equal((await read()).jobs[0].status, 'ready');
  });

  await run('late failure, next-day retry, and failed clarification keep the original date', '2026-10-29T23:59:50Z', async ({
    page, button, heading, read, outcome, complete, reload, notice, components, setTime, draft, submit,
    history, leaveHistory, mealRow, historicalContributions,
  }) => {
    await outcome('offline'); await draft('Ужин'); const original = await submit(); const submitted = await read();
    await setTime('2026-10-30T12:00:00Z'); assert.equal((await read()).jobs[0].status, 'failed');
    await components(empty); await reload(); await notice(original.id).click(); await heading('Нет связи').waitFor();
    await outcome('success'); await button('Повторить').click();
    const retry = (await read()).jobs[0]; assert.deepEqual(identity(retry), identity(original));
    assert.deepEqual(retry.photos, original.photos); assert.equal(retry.attempt, original.attempt + 1);
    await setTime('2026-10-31T12:00:00Z'); await heading('Курица с картофелем').waitFor();
    const ready = (await read()).jobs[0]; await button('В лагерь').click(); await components(empty);
    await history(original.dayKey); await historicalContributions(dinner);
    await mealRow(original.id).getByRole('button').click(); await heading('Курица с картофелем').waitFor();
    await outcome('timeout'); await button('Уточнить результат').click();
    await page.getByLabel('Что уточнить?').fill('Соус отдельно'); await button('Повторить анализ').click();
    await button('К дню').click(); await historicalContributions(dinner);
    await setTime('2026-11-01T12:00:00Z');
    assert.equal((await read()).jobs[0].status, 'failed');
    assert.deepEqual((await read()).jobs[0].result, ready.result);
    await historicalContributions(dinner); await mealRow(original.id).getByRole('button').click();
    await heading('Ответ пока не пришёл').waitFor(); await button('Прежний результат').click();
    await heading('Курица с картофелем').waitFor(); await button('К дню').click();
    assert.equal(await page.locator('.journey-day').getAttribute('data-history-day'), original.dayKey);
    await leaveHistory(); await components(empty);
    assert.deepEqual(progress(await read()), progress(submitted));
    assert.deepEqual(identity((await read()).jobs[0]), identity(original));
    assert.equal((await read()).jobs.length, 1);
  });

  await run('midnight updates the visible day when saving the due answer fails', '2026-10-29T23:59:50Z', async ({
    page, button, read, failNextWrite, components, localDate, setTime, draft, submit, history, leaveHistory, historicalContributions,
  }) => {
    await draft('Ужин'); const original = await submit(); const submitted = await read();
    await history(original.dayKey);
    assert.match(await page.getByLabel('День истории').locator('option:checked').innerText(), /текущий день/);
    await failNextWrite(); await setTime('2026-10-30T00:00:15Z');
    assert.equal(await localDate(), '2026-10-30');
    assert.match(await page.getByRole('alert').first().innerText(), /Не удалось сохранить/);
    assert.equal((await read()).jobs[0].status, 'processing', 'failed answer save does not publish a completed task');
    assert.doesNotMatch(await page.getByLabel('День истории').locator('option:checked').innerText(), /текущий день/,
      'a storage failure must not leave yesterday marked as the current local day');
    await page.clock.fastForward(1000);
    assert.equal((await read()).jobs[0].status, 'ready');
    await historicalContributions(dinner); await leaveHistory(); await components(empty);
    assert.deepEqual(progress(await read()), progress(submitted));
  });
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  assert.deepEqual(failures, []);
  console.log('PASS: stage 4.4 browser boundary acceptance; saved first-photo dates, late day-specific contributions, real live timezone changes, optional multiple results, repeat visits, corrections and retries; no browser errors.');
} finally { await browser.close(); }
