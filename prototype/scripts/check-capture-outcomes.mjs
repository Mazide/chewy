// Stage 4.2: non-food and uncertain answers belong to the original saved task.
// A fresh browser context keeps the owner's Storybook session untouched.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'Europe/London' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const origin = process.argv[2] ?? 'http://localhost:6006';
const key = 'chewy.demo-session.v1';
const button = name => page.getByRole('button', { name, exact: true });
const heading = name => page.getByRole('heading', { name, exact: true });
const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const progress = session => ({
  entries: session.entries, rewards: session.rewardEvents, days: session.creditedDays,
  regularity: session.regularity, inventory: session.inventory,
});
const savedContent = ({ lastSeenAt, ...session }) => session;
const identity = job => ({ id: job.id, createdAt: job.createdAt, dayKey: job.dayKey });
const loaded = () => button('Инструменты пробы').waitFor();
const reload = async () => { await page.reload(); await loaded(); };
const inspector = async () => {
  if (await button('Инструменты пробы').isVisible()) await button('Инструменты пробы').click();
};
const outcome = async value => { await inspector(); await page.getByLabel('Ответ анализа', { exact: true }).selectOption(value); };
const complete = async () => { await inspector(); await button('Завершить анализ').click(); };
const notice = id => page.locator('.capture-notice').filter({ has: page.locator(`[data-capture-id="${id}"]`) });
const components = async expected => assert.deepEqual(
  await page.locator('[data-camp-component]').evaluateAll(elements => Object.fromEntries(
    elements.map(el => [el.dataset.campComponent, el.dataset.dailyContribution === 'present'])
  )), expected
);
const empty = { protein: false, carbs: false, fats: false, plants: false };
const breakfastContribution = { ...empty, carbs: true, plants: true };
const knownContribution = { ...empty, protein: true, carbs: true, plants: true };
const chooseDinner = async () => {
  await button('Добавить еду').click(); await button('Галерея').click();
  await button('Выбрать фото: Ужин').click(); await button('Добавить фото · 1').click();
  await button('Сфотографировать еду').click();
};
const submit = async () => { await button('Сохранить и разобрать').click(); await button('Рюкзак').waitFor(); };
const submitRevision = () => page.getByRole('button', { name: /^(Повторить анализ|Разобрать ещё раз)$/ }).click();
const replaceCover = async sample => {
  await page.locator('.capture-edit-photos').click(); await button('Фото 1').click();
  await page.getByRole('button', { name: /Переснять/ }).click(); await button('Галерея').click();
  await button(`Выбрать фото: ${sample}`).click(); await button('Добавить фото · 1').click();
  await button('Готово, к уточнению').click();
};
const failNextWrite = async () => page.evaluate(key => {
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (name, value) {
    if (name === key) { Storage.prototype.setItem = original; throw new Error('test outcome write failure'); }
    return original.call(this, name, value);
  };
}, key);
const assertControls = async (names, device) => {
  const phone = await page.locator('.capture-phone').boundingBox();
  for (const name of names) {
    const control = button(name);
    const bounds = await control.boundingBox();
    assert.ok(bounds.height >= 44 && bounds.y >= phone.y && bounds.y + bounds.height <= phone.y + phone.height + 1,
      `${device}: ${name} is reachable inside the phone`);
    await control.focus();
    assert.equal(await control.evaluate(element => document.activeElement === element), true);
  }
};

try {
  await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
  await page.goto(`${origin}/iframe.html?id=core-sandbox--all-screens&viewMode=story`);
  await loaded(); await components(empty);

  // A first non-food result has no meal contribution, but preserves the photo reward.
  await outcome('notFood'); await chooseDinner(); await submit();
  const firstSave = await read();
  const first = firstSave.jobs.at(-1);
  assert.equal(first.mockOutcome, 'notFood'); assert.equal(first.photos.length, 2);
  assert.equal(firstSave.entries.length, 1); assert.equal(firstSave.rewardEvents.length, 1);
  await reload(); assert.deepEqual((await read()).jobs.at(-1), first);
  await complete();
  const notFood = (await read()).jobs.at(-1);
  assert.equal(notFood.status, 'notFood'); assert.equal(notFood.result, null);
  assert.equal(notFood.failure, undefined); assert.deepEqual(notFood.photos, first.photos);
  assert.deepEqual(identity(notFood), identity(first)); assert.deepEqual(progress(await read()), progress(firstSave));
  await components(empty); await reload(); await components(empty);
  assert.deepEqual((await read()).jobs.at(-1), notFood);

  // A saved non-food task remains reachable from its day without inventing a meal.
  await button('Путь').click(); await button('Открыть день').click();
  assert.equal(await page.getByRole('list', { name: 'Еда за выбранный день' }).count(), 0);
  const incomplete = page.getByRole('list', { name: 'Записи без готового разбора за выбранный день' });
  assert.equal(await incomplete.getByRole('listitem').count(), 1);
  await incomplete.getByRole('button').click(); await heading('Не удалось узнать еду').waitFor();
  assert.equal(await page.locator('.capture-photo-thumb').count(), 2);
  await button('К дню').click();
  assert.equal(await page.locator('.journey-day').getAttribute('data-history-day'), first.dayKey);
  await button('К пути').click(); await button('В лагерь').click();
  await notice(first.id).click(); await heading('Не удалось узнать еду').waitFor();

  // Correcting an initial non-food answer uses the same entry and can replace its photos.
  await button('Уточнить запись').click(); await heading('Уточним запись').waitFor();
  await page.getByLabel('Название блюда').fill('Овсянка с ягодами');
  await page.getByLabel('Что уточнить?').fill('Соус отдельно'); await button('Большая').click();
  await replaceCover('Завтрак');
  assert.deepEqual(progress(await read()), progress(firstSave));
  assert.deepEqual((await read()).jobs.at(-1), notFood);
  await outcome('success'); await failNextWrite(); await submitRevision();
  await heading('Уточним запись').waitFor();
  assert.match(await page.getByRole('alert').first().innerText(), /Не удалось сохранить/);
  assert.equal(await page.getByLabel('Название блюда').inputValue(), 'Овсянка с ягодами');
  assert.deepEqual((await read()).jobs.at(-1), notFood);
  await submitRevision();
  const recovery = (await read()).jobs.at(-1);
  assert.equal(recovery.status, 'processing'); assert.equal(recovery.attempt, first.attempt + 1);
  assert.deepEqual(identity(recovery), identity(first)); assert.equal(recovery.photos[0].imageKey, 'breakfast');
  assert.equal(recovery.photos.length, 2); assert.equal(recovery.result, null);
  assert.equal(recovery.notes, 'Соус отдельно'); assert.equal(recovery.portion, 2);
  assert.deepEqual(progress(await read()), progress(firstSave));
  await complete(); await heading('Овсянка с ягодами').waitFor();
  const recovered = (await read()).jobs.at(-1);
  const oldPhotoSrc = await page.locator('.capture-result-photo img').getAttribute('src');
  assert.equal(recovered.status, 'ready'); assert.deepEqual(recovered.result.photos, recovery.photos);
  await button('В лагерь').click(); await components(breakfastContribution);

  // A non-food revision retains the old result and its own photos, including after reload.
  const beforeRevision = await read();
  const confirmed = beforeRevision.jobs.at(-1);
  await button('Открыть дневник еды за сегодня').click();
  await page.getByRole('list', { name: 'Еда сегодня' }).getByRole('button', { name: /Овсянка с ягодами/ }).click();
  await outcome('notFood'); await button('Уточнить результат').click();
  await page.getByLabel('Название блюда').fill('Курица с картофелем');
  await button('Небольшая').click(); await replaceCover('Ужин'); await submitRevision();
  const revision = (await read()).jobs.at(-1);
  assert.equal(revision.status, 'processing'); assert.deepEqual(revision.result, confirmed.result);
  assert.equal(revision.photos[0].imageKey, 'chicken'); assert.equal(revision.portion, 0);
  assert.deepEqual(progress(await read()), progress(beforeRevision));
  await complete(); await heading('Не удалось узнать еду').waitFor();
  const rejectedRevision = (await read()).jobs.at(-1);
  assert.equal(rejectedRevision.status, 'notFood'); assert.deepEqual(rejectedRevision.result, confirmed.result);
  assert.deepEqual(rejectedRevision.photos, revision.photos);
  await button('Прежний результат').click(); await heading('Овсянка с ягодами').waitFor();
  assert.equal(await page.locator('.capture-result-photo img').getAttribute('src'), oldPhotoSrc);
  await button('К разбору').click(); await heading('Не удалось узнать еду').waitFor();
  for (const device of ['compact', 'standard', 'large']) {
    await inspector(); await page.getByLabel('Размер телефона').selectOption(device);
    await assertControls(['Уточнить запись', 'Прежний результат', 'В лагерь'], device);
    await page.locator('.capture-phone').screenshot({ path: `/tmp/chewy-outcomes-${device}.png` });
  }
  await button('В лагерь').click(); await components(breakfastContribution); await reload();
  assert.deepEqual((await read()).jobs.at(-1), rejectedRevision); await components(breakfastContribution);

  // A rejected revision remains a regular historical meal; opening it returns to its outcome.
  await button('Путь').click(); await button('Открыть день').click();
  await page.getByRole('list', { name: 'Еда за выбранный день' }).getByRole('button', { name: /Овсянка с ягодами/ }).click();
  await heading('Не удалось узнать еду').waitFor(); await button('К дню').click();
  await button('К пути').click(); await button('В лагерь').click(); await notice(first.id).click();
  await button('Уточнить запись').click();
  assert.equal(await page.getByLabel('Название блюда').inputValue(), revision.dishName);
  assert.equal(await page.getByLabel('Что уточнить?').inputValue(), revision.notes);
  assert.equal(await button('Небольшая').getAttribute('aria-pressed'), 'true');
  assert.notEqual(await page.locator('.capture-edit-photos img').getAttribute('src'), oldPhotoSrc);
  await page.getByLabel('Название блюда').fill('Несохранённая правка'); await button('Отменить правки').click();
  await heading('Не удалось узнать еду').waitFor(); assert.deepEqual((await read()).jobs.at(-1), rejectedRevision);
  await outcome('success'); await button('Уточнить запись').click();
  assert.equal(await page.getByLabel('Название блюда').inputValue(), revision.dishName);
  await submitRevision(); await complete(); await heading('Курица с картофелем').waitFor();
  const corrected = (await read()).jobs.at(-1);
  assert.deepEqual(identity(corrected), identity(first)); assert.deepEqual(corrected.result.photos, revision.photos);
  assert.equal(corrected.result.portion, 0); assert.equal((await read()).jobs.length, 1);
  assert.deepEqual(progress(await read()), progress(beforeRevision));
  await button('В лагерь').click(); await components({ ...empty, protein: true });

  // Uncertainty is a saved result with known contribution and explicit missing details.
  await outcome('uncertain'); await button('Добавить еду').click();
  await button('Сфотографировать еду').click(); await submit();
  const uncertainSave = await read(); const uncertainJob = uncertainSave.jobs.at(-1);
  await reload(); await complete();
  const uncertain = (await read()).jobs.at(-1);
  assert.equal(uncertain.status, 'ready'); assert.equal(uncertain.result.assessment.tone, 'unknown');
  assert.deepEqual(Object.keys(uncertain.result.assessment.supplies).sort(), ['carbs', 'plants', 'protein']);
  assert.deepEqual(identity(uncertain), identity(uncertainJob));
  assert.deepEqual(progress(await read()), progress(uncertainSave)); await components(knownContribution);
  await reload(); assert.deepEqual((await read()).jobs.at(-1), uncertain);
  await notice(uncertain.id).click(); await heading('Овощи с гарниром').waitFor();
  assert.equal(await page.locator('.nutrition-meal.nutrition-tone-unknown').isVisible(), true);
  assert.equal(await page.locator('.nutrition-uncertainty-note').isVisible(), true);
  const uncertaintyCopy = await page.locator('.nutrition-uncertainty-note').innerText();
  assert.match(uncertaintyCopy, /Известные продукты учтены/);
  assert.match(uncertaintyCopy, /нельзя уверенно определить/);
  assert.match(uncertaintyCopy, /Вид масла пока не установлен/);
  for (const device of ['compact', 'standard', 'large']) {
    await inspector(); await page.getByLabel('Размер телефона').selectOption(device);
    await assertControls(['Уточнить результат', 'В лагерь'], device);
    await page.locator('.capture-phone').screenshot({ path: `/tmp/chewy-uncertain-${device}.png` });
  }
  await outcome('success'); await button('Уточнить результат').click();
  await page.getByLabel('Что уточнить?').fill('С оливковым маслом'); await submitRevision();
  assert.deepEqual((await read()).jobs.at(-1).result, uncertain.result);
  await complete(); await heading('Овощи с гарниром').waitFor();
  const clarified = (await read()).jobs.at(-1);
  assert.equal(clarified.result.assessment.tone, 'good');
  assert.equal(clarified.result.assessment.supplies.fats[1], 'оливковое масло');
  assert.deepEqual(identity(clarified), identity(uncertainJob));
  assert.equal((await read()).jobs.length, 2); assert.deepEqual(progress(await read()), progress(uncertainSave));
  await button('В лагерь').click(); await components({ ...knownContribution, fats: true });

  // Both direct stories operate on real isolated jobs, without changing the main save.
  const finalSession = await read();
  await page.goto(`${origin}/iframe.html?id=core-sandbox--not-food&viewMode=story`);
  await heading('Не удалось узнать еду').waitFor(); await button('Уточнить запись').click();
  await page.getByLabel('Что уточнить?').fill('Соус отдельно'); await submitRevision();
  await page.clock.fastForward(21000); await heading('Овощи с гарниром').waitFor();
  // Leaving the persistent story records its last visit; isolated work cannot change its content.
  assert.deepEqual(savedContent(await read()), savedContent(finalSession));
  await page.goto(`${origin}/iframe.html?id=core-sandbox--uncertain&viewMode=story`);
  await heading('Овощи с гарниром').waitFor();
  assert.equal(await page.locator('.nutrition-meal.nutrition-tone-unknown').isVisible(), true);
  await button('Уточнить результат').click(); await page.getByLabel('Что уточнить?').fill('С оливковым маслом');
  await submitRevision(); await page.clock.fastForward(21000); await heading('Овощи с гарниром').waitFor();
  assert.equal(await page.locator('.nutrition-meal.nutrition-tone-good').isVisible(), true);
  assert.deepEqual(savedContent(await read()), savedContent(finalSession)); assert.deepEqual(errors, []);
  console.log('PASS: primary non-food and rejected revision persist; same-task photo/detail recovery; refused write keeps editor; previous result/photos/contribution preserved; history navigation; uncertainty keeps known contribution and names unknown oil; clarification adds known fats; rewards/identity unchanged; both stories isolated; six screenshots and accessible actions; no JavaScript errors.');
} finally { await browser.close(); }
