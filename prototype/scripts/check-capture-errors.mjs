// Stage 4 first slice: failures belong to saved tasks, and retry preserves identity.
// A fresh browser context never touches the owner's Storybook session.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'Europe/London' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const origin = process.argv[2] ?? 'http://localhost:6006';
const url = `${origin}/iframe.html?id=core-sandbox--all-screens&viewMode=story`;
const key = 'chewy.demo-session.v1';
const button = name => page.getByRole('button', { name, exact: true });
const heading = name => page.getByRole('heading', { name, exact: true });
const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const progress = session => ({
  entries: session.entries, rewards: session.rewardEvents, days: session.creditedDays,
  regularity: session.regularity, inventory: session.inventory,
});
const identity = job => ({ id: job.id, createdAt: job.createdAt, dayKey: job.dayKey, photos: job.photos });
const loaded = () => button('Инструменты пробы').waitFor();
const reload = async () => { await page.reload(); await loaded(); };
const inspector = async () => {
  if (await button('Инструменты пробы').isVisible()) await button('Инструменты пробы').click();
};
const outcome = async value => { await inspector(); await page.getByLabel('Ответ анализа', { exact: true }).selectOption(value); };
const complete = async () => { await inspector(); await button('Завершить анализ').click(); };
const components = async expected => assert.deepEqual(
  await page.locator('[data-camp-component]').evaluateAll(elements => Object.fromEntries(
    elements.map(el => [el.dataset.campComponent, el.dataset.dailyContribution === 'present'])
  )), expected
);
const empty = { protein: false, carbs: false, fats: false, plants: false };
const protein = { ...empty, protein: true };
const notice = id => page.locator('.capture-notice').filter({ has: page.locator(`[data-capture-id="${id}"]`) });
const chooseDinner = async () => {
  await button('Добавить еду').click(); await button('Галерея').click();
  await button('Выбрать фото: Ужин').click(); await button('Добавить фото · 1').click();
  await button('Сфотографировать еду').click();
};
const submit = async () => { await button('Сохранить и разобрать').click(); await button('Рюкзак').waitFor(); };
const failureTitles = { offline: 'Нет связи', error: 'Не получилось разобрать', timeout: 'Ответ пока не пришёл' };
const failNextWrite = async () => page.evaluate(key => {
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (name, value) {
    if (name === key) { Storage.prototype.setItem = original; throw new Error('test retry write failure'); }
    return original.call(this, name, value);
  };
}, key);

try {
  await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
  await page.goto(url); await loaded(); await components(empty);

  for (const failure of ['offline', 'error', 'timeout']) {
    await outcome(failure); await chooseDinner(); await submit();
    const saved = await read();
    const pending = saved.jobs.at(-1);
    assert.equal(pending.status, 'processing'); assert.equal(pending.mockOutcome, failure);
    assert.equal(pending.photos.length, 2); assert.equal(pending.attempt, 1);
    assert.equal(pending.result, null);

    // The selected outcome survives leaving and reloading the actual saved task.
    await reload(); assert.deepEqual((await read()).jobs.at(-1), pending);
    await complete();
    const failedSession = await read();
    const failed = failedSession.jobs.at(-1);
    assert.equal(failed.status, 'failed'); assert.equal(failed.failure, failure);
    assert.equal(failed.result, null); assert.deepEqual(identity(failed), identity(pending));
    assert.deepEqual(progress(failedSession), progress(saved));
    await components(failure === 'offline' ? empty : protein);
    await notice(failed.id).click(); await heading(failureTitles[failure]).waitFor();
    assert.equal(await page.locator('.capture-photo-thumb').count(), 2);
    await button('В лагерь').click(); await reload();
    assert.deepEqual((await read()).jobs.at(-1), failed);
    await notice(failed.id).click(); await heading(failureTitles[failure]).waitFor();
    await outcome('success');

    if (failure === 'offline') {
      // Refused persistence keeps the failed task retryable without claiming a new attempt.
      await failNextWrite(); await button('Повторить').click();
      assert.match(await page.getByRole('alert').first().innerText(), /Не удалось сохранить/);
      assert.deepEqual((await read()).jobs.at(-1), failed);
      await heading(failureTitles[failure]).waitFor();
    }
    await button('Повторить').click();
    const retry = (await read()).jobs.at(-1);
    assert.equal(retry.status, 'processing'); assert.equal(retry.mockOutcome, 'success');
    assert.equal(retry.attempt, 2); assert.deepEqual(identity(retry), identity(pending));
    assert.deepEqual(progress(await read()), progress(saved));
    // Natural ticking also settles retry; viewing the failure/result is not required.
    await button('В лагерь').click(); await reload();
    await page.clock.fastForward(21000);
    await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)).jobs.find(job => job.id === id).status === 'ready', { key, id: retry.id });
    const completed = await read();
    assert.equal(completed.jobs.length, saved.jobs.length);
    assert.deepEqual(identity(completed.jobs.at(-1)), identity(pending));
    assert.deepEqual(completed.jobs.at(-1).result.photos, pending.photos);
    assert.deepEqual(progress(completed), progress(saved));
    await notice(retry.id).click(); await heading('Курица с картофелем').waitFor();
    await button('В лагерь').click(); await components(protein);
  }

  // A failed revision stores new text/photos while the journal keeps the old answer.
  const beforeRevision = await read();
  const original = beforeRevision.jobs.at(-1);
  await button('Открыть дневник еды за сегодня').click();
  await page.getByRole('list', { name: 'Еда сегодня' }).getByRole('button', { name: /Курица с картофелем/ }).last().click();
  await outcome('error'); await button('Уточнить результат').click();
  await page.getByLabel('Название блюда').fill('Овсянка с ягодами');
  await page.getByLabel('Что уточнить?').fill('Соус отдельно');
  await button('Большая').click();
  await page.locator('.capture-edit-photos').click(); await button('Фото 1').click();
  await page.getByRole('button', { name: /Переснять/ }).click(); await button('Галерея').click();
  await button('Выбрать фото: Завтрак').click(); await button('Добавить фото · 1').click();
  await button('Готово, к уточнению').click(); await button('Повторить анализ').click();
  const revision = (await read()).jobs.at(-1);
  assert.equal(revision.id, original.id); assert.equal(revision.status, 'processing');
  assert.equal(revision.dishName, 'Овсянка с ягодами'); assert.equal(revision.notes, 'Соус отдельно');
  assert.equal(revision.portion, 2); assert.equal(revision.photos[0].imageKey, 'breakfast');
  assert.notDeepEqual(revision.photos, original.photos); assert.deepEqual(revision.result, original.result);
  assert.equal(revision.createdAt, original.createdAt); assert.equal(revision.dayKey, original.dayKey);
  assert.deepEqual(progress(await read()), progress(beforeRevision));
  await complete(); await heading(failureTitles.error).waitFor();
  const failedRevision = (await read()).jobs.at(-1);
  assert.equal(failedRevision.status, 'failed'); assert.deepEqual(failedRevision.result, original.result);
  assert.deepEqual(failedRevision.photos, revision.photos);
  await button('Прежний результат').click(); await heading('Курица с картофелем').waitFor();
  await button('К разбору').click(); await heading(failureTitles.error).waitFor();
  for (const device of ['compact', 'standard', 'large']) {
    await inspector(); await page.getByLabel('Размер телефона').selectOption(device);
    const phoneBounds = await page.locator('.capture-phone').boundingBox();
    for (const name of ['Повторить', 'Прежний результат', 'В лагерь']) {
      const control = button(name);
      const bounds = await control.boundingBox();
      assert.ok(bounds.height >= 44 && bounds.y >= phoneBounds.y
        && bounds.y + bounds.height <= phoneBounds.y + phoneBounds.height, `${device}: ${name} stays inside the phone`);
      await control.focus();
      assert.equal(await control.evaluate(element => document.activeElement === element), true);
    }
    const details = page.locator('.processing-details summary');
    await details.focus();
    const contentBounds = await page.locator('.capture-processing').boundingBox();
    const detailsBounds = await details.boundingBox();
    assert.ok(detailsBounds.y >= contentBounds.y && detailsBounds.y + detailsBounds.height <= contentBounds.y + contentBounds.height + 1,
      `${device}: saved details can be reached in the scrolling area`);
    await page.locator('.capture-processing').evaluate(element => { element.scrollTop = 0; });
    await page.locator('.capture-phone').screenshot({ path: `/tmp/chewy-stage4-${device}.png` });
  }
  await button('В лагерь').click(); await components(protein); await reload();
  assert.deepEqual((await read()).jobs.at(-1), failedRevision); await components(protein);
  await notice(original.id).click(); await heading(failureTitles.error).waitFor();
  await button('Прежний результат').click(); await heading('Курица с картофелем').waitFor();
  await button('К разбору').click(); await outcome('success'); await button('Повторить').click();
  const retryRevision = (await read()).jobs.at(-1);
  assert.equal(retryRevision.attempt, revision.attempt + 1);
  assert.deepEqual(retryRevision.result, original.result); assert.deepEqual(retryRevision.photos, revision.photos);
  await complete(); await heading('Овсянка с ягодами').waitFor();
  const revised = await read();
  assert.equal(revised.jobs.length, beforeRevision.jobs.length);
  assert.equal(revised.jobs.at(-1).result.name, revision.dishName);
  assert.equal(revised.jobs.at(-1).result.notes, revision.notes);
  assert.equal(revised.jobs.at(-1).result.portion, revision.portion);
  assert.deepEqual(revised.jobs.at(-1).result.photos, revision.photos);
  assert.deepEqual(progress(revised), progress(beforeRevision));
  await button('В лагерь').click(); await components({ ...protein, carbs: true, plants: true });

  // Camp shows the newest task; older failures remain reachable through their day.
  const failedIds = [];
  for (const failure of ['offline', 'timeout']) {
    await outcome(failure); await chooseDinner(); await submit(); await complete();
    failedIds.push((await read()).jobs.at(-1).id);
  }
  const beforeHistory = await read();
  await reload(); await button('Путь').click(); await button('Открыть день').click();
  const pendingList = page.getByRole('list', { name: 'Записи без готового разбора за выбранный день' });
  assert.equal(await pendingList.getByRole('listitem').count(), 2);
  for (let index = 0; index < failedIds.length; index += 1) {
    await pendingList.getByRole('button').nth(index).click();
    await heading(failureTitles[index === 0 ? 'offline' : 'timeout']).waitFor();
    await button('К дню').click();
    assert.equal(await page.locator('.journey-day').getAttribute('data-history-day'), beforeHistory.jobs.at(-1).dayKey);
  }
  assert.deepEqual(progress(await read()), progress(beforeHistory));
  assert.deepEqual((await read()).jobs, beforeHistory.jobs);

  // The standalone failure story uses an isolated real task and cannot alter the main save.
  await page.goto(`${origin}/iframe.html?id=core-sandbox--offline&viewMode=story`);
  await heading(failureTitles.offline).waitFor(); await button('Повторить').click();
  await page.clock.fastForward(21000); await heading('Овощи с гарниром').waitFor();
  assert.deepEqual((await read()).jobs, beforeHistory.jobs);
  assert.deepEqual(progress(await read()), progress(beforeHistory));
  assert.deepEqual(errors, []);
  console.log('PASS: offline/error/timeout task persistence and retry; failed retry write; unchanged identity/photos/rewards/day; failed revision retains old answer and contribution, text/photos survive reload and retry; previous result navigation; historical failures; isolated failure story; three screenshots; no JavaScript errors.');
} finally { await browser.close(); }
