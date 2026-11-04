import test from 'node:test';
import assert from 'node:assert/strict';
import { captureDay, capturePhotos, completeDueCaptures, createCapture, localDayKey, readCaptureSession,
  retryCapture, reviseCapture, validateCaptureJobs, writeCaptureSession } from './capture-session.js';
import { dailyCampContributions, dayAssessment, nutritionSupplies, snapshotUncertainAssessment } from './food-assessment.js';
import { createDemoSessionStore, sessionJourneyStep } from './demo-session.js';

const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
const photos = [
  { id: 'plate', imageKey: 'meal', source: 'camera' },
  { id: 'detail', imageKey: 'meal', source: 'gallery' },
];
const capture = (outcome = 'success', now = Date.now()) => createCapture({ source: 'camera', theme: 'science',
  portion: 1, notes: '', delay: 20000, photos, outcome }, now);
const finish = job => completeDueCaptures([job], Infinity)[0];
const knownContribution = { protein: true, carbs: true, fats: false, plants: true };

for (const daysAgo of [0, 1]) {
  test(`${daysAgo ? 'late' : 'initial'} non-food result persists without creating a meal or contribution`, () => {
    const db = storage();
    const now = Date.now();
    const original = { ...capture('notFood', now - daysAgo * 86400000 - 30000), dayKey: localDayKey(now - daysAgo * 86400000) };
    writeCaptureSession(db, [original]);
    const [notFood] = readCaptureSession(db);
    assert.equal(notFood.status, 'notFood');
    assert.equal(notFood.failure, undefined);
    assert.equal(notFood.result, null);
    assert.equal(notFood.attempt, 1);
    assert.equal(notFood.seen, false);
    for (const field of ['id', 'createdAt', 'dayKey', 'notes', 'photos']) assert.deepEqual(notFood[field], original[field]);
    assert.equal(captureDay([notFood], original.dayKey).meals.length, 0);
    assert.equal(captureDay([notFood], localDayKey(now)).meals.length, 0);
    assert.deepEqual(dailyCampContributions(captureDay([notFood], original.dayKey).meals), { protein: false, carbs: false, fats: false, plants: false });
    writeCaptureSession(db, [notFood]);
    const [restored] = readCaptureSession(db);
    assert.deepEqual(restored, notFood);
    assert.strictEqual(completeDueCaptures([restored], Infinity)[0], restored);
    assert.throws(() => retryCapture(restored, { delay: 1000 }), /Only failed captures/);
  });
}

test('non-food clarification keeps the confirmed result while retaining edited photos for correction', () => {
  const now = Date.now();
  const dayKey = localDayKey(now - 86400000);
  const original = finish({ ...capture('success', now - 86400000), dayKey });
  const originalResult = structuredClone(original.result);
  const changes = { dishName: 'Курица с картофелем', portion: 2, notes: '',
    photos: [{ id: 'new-plate', imageKey: 'chicken', source: 'gallery' }] };
  const pending = reviseCapture(original, changes, 1000, now - 2000, 'notFood');
  const db = storage();
  writeCaptureSession(db, [pending]);
  const [notFood] = readCaptureSession(db);
  assert.equal(notFood.status, 'notFood');
  assert.deepEqual(notFood.result, originalResult);
  assert.deepEqual(capturePhotos(notFood), changes.photos);
  assert.deepEqual(capturePhotos(notFood, true), photos);
  assert.deepEqual(dailyCampContributions(captureDay([notFood], dayKey).meals), knownContribution);
  assert.equal(captureDay([notFood], dayKey).meals.length, 1);
  assert.equal(captureDay([notFood], localDayKey(now)).meals.length, 0);
  for (const field of ['dishName', 'portion', 'notes', 'photos']) assert.deepEqual(notFood[field], changes[field]);
  writeCaptureSession(db, [notFood]);
  const recovered = finish(reviseCapture(readCaptureSession(db)[0], changes, 1000, now));
  assert.equal(recovered.status, 'ready');
  assert.equal(recovered.failure, undefined);
  assert.equal(recovered.attempt, 3);
  for (const field of ['id', 'createdAt', 'dayKey']) assert.equal(recovered[field], original[field]);
  assert.equal(recovered.result.name, changes.dishName);
  assert.deepEqual(recovered.result.photos, changes.photos);
  assert.equal(captureDay([recovered], dayKey).meals.length, 1);
  assert.deepEqual(dailyCampContributions(captureDay([recovered], dayKey).meals), { protein: true, carbs: false, fats: false, plants: false });
  assert.deepEqual(original.result, originalResult);
});

test('an uncertain saved answer retains known food facts and contributions without assuming oil', () => {
  const ready = finish(capture('uncertain'));
  const meals = captureDay([ready]).meals;
  assert.equal(ready.status, 'ready');
  assert.equal(ready.seen, false);
  assert.equal(meals.length, 1);
  assert.equal(ready.result.assessment.tone, 'unknown');
  assert.deepEqual(ready.result.assessment.groups, { veg: 'present', protein: 'present', wholegrain: 'unknown' });
  assert.deepEqual(dailyCampContributions(meals), knownContribution);
  assert.equal(nutritionSupplies(meals).hasUnknown, true);
  assert.deepEqual(nutritionSupplies(meals).values.fats, { fill: 0, sources: [] });
  const day = dayAssessment(meals);
  assert.equal(day.tone, 'unknown');
  assert.deepEqual(day.groups, { veg: 'present', protein: 'present', wholegrain: 'unknown' });
  assert.deepEqual(day.qualities, ['Разные овощи', 'Бобовые']);
  const db = storage();
  ready.result.assessment.reason = 'Сохранённый частичный ответ.';
  writeCaptureSession(db, [ready]);
  const [restored] = readCaptureSession(db);
  assert.deepEqual(restored, ready);
  assert.deepEqual(nutritionSupplies(captureDay([restored]).meals), nutritionSupplies(meals));
});

test('uncertainty does not fabricate known ingredients from an incompatible title or note', () => {
  for (const changes of [{ dishName: 'Другое блюдо' }, { notes: 'Внутри мясо вместо нута' }]) {
    const ready = finish({ ...capture('uncertain'), ...changes });
    const meals = captureDay([ready]).meals;
    assert.equal(ready.result.assessment.tone, 'unknown');
    assert.deepEqual(ready.result.assessment.groups, {});
    assert.equal(ready.result.assessment.supplies, undefined);
    assert.deepEqual(dailyCampContributions(meals), { protein: false, carbs: false, fats: false, plants: false });
    assert.deepEqual(dayAssessment(meals).groups, { veg: 'unknown', protein: 'unknown', wholegrain: 'unknown' });
  }
});

test('successful oil clarification replaces the same uncertain meal and its original-day contribution', () => {
  const now = Date.now();
  const dayKey = localDayKey(now - 86400000);
  const uncertain = finish({ ...capture('uncertain', now - 86400000), dayKey });
  const before = nutritionSupplies(captureDay([uncertain], dayKey).meals);
  const pending = reviseCapture(uncertain, { dishName: uncertain.result.name, notes: 'С оливковым маслом', portion: 1, photos }, 1000, now);
  assert.deepEqual(nutritionSupplies(captureDay([pending], dayKey).meals), before);
  const ready = finish(pending);
  assert.equal(ready.id, uncertain.id);
  assert.equal(ready.dayKey, uncertain.dayKey);
  assert.equal(ready.createdAt, uncertain.createdAt);
  assert.equal(ready.result.assessment.tone, 'good');
  const meals = captureDay([ready], dayKey).meals;
  assert.equal(meals.length, 1);
  assert.equal(captureDay([ready], localDayKey(now)).meals.length, 0);
  const after = nutritionSupplies(meals);
  assert.equal(after.hasUnknown, false);
  assert.deepEqual(after.values.fats.sources, ['оливковое масло']);
  assert.ok(after.values.fats.fill > 0);
  for (const key of ['protein', 'carbs', 'plants']) assert.deepEqual(after.values[key], before.values[key]);
});

test('partial authored snapshots are independent and keep explicitly clarified oil', () => {
  const meal = { imageKey: 'meal', name: 'Овощи с гарниром', notes: 'С оливковым маслом' };
  const assessment = snapshotUncertainAssessment(meal);
  assert.equal(assessment.tone, 'unknown');
  assert.deepEqual(assessment.supplies.fats, [30, 'оливковое масло']);
  assessment.supplies.protein[1] = 'edited';
  assert.equal(snapshotUncertainAssessment(meal).supplies.protein[1], 'нут');
});

test('non-food, correction, uncertainty and clarification across days never repeat first-photo rewards', () => {
  let now = Date.now();
  const db = storage();
  let store = createDemoSessionStore({ storage: db, now: () => now });
  const entry = store.startEntry();
  assert.equal(store.replaceJobs([{ ...capture('notFood', now), id: entry.id }]), true);
  const earnedState = session => ({ entries: session.entries, rewardEvents: session.rewardEvents, creditedDays: session.creditedDays,
    regularity: session.regularity, inventory: session.inventory, journey: sessionJourneyStep(session) });
  const earned = structuredClone(earnedState(store.getSnapshot().session));
  for (const outcome of ['uncertain', 'success']) {
    now += 86400000;
    store = createDemoSessionStore({ storage: db, now: () => now });
    store.tick();
    const previous = store.getSnapshot().session.jobs[0];
    assert.equal(previous.status, outcome === 'uncertain' ? 'notFood' : 'ready');
    const changes = { dishName: 'Овощи с гарниром', notes: outcome === 'success' ? 'С оливковым маслом' : '', portion: 1, photos };
    assert.equal(store.replaceJobs([reviseCapture(previous, changes, 1000, now, outcome)]), true);
    assert.deepEqual(earnedState(store.getSnapshot().session), earned);
  }
  assert.equal(store.completeAnalysis(), true);
  store = createDemoSessionStore({ storage: db, now: () => now });
  const final = store.getSnapshot().session;
  assert.deepEqual(earnedState(final), earned);
  assert.equal(final.jobs.length, 1);
  assert.equal(final.jobs[0].id, entry.id);
  assert.equal(final.jobs[0].dayKey, entry.dayKey);
  assert.equal(final.jobs[0].createdAt, entry.firstPhotoAt);
  assert.equal(final.jobs[0].status, 'ready');
  assert.equal(final.jobs[0].attempt, 3);
  assert.equal(captureDay(final.jobs, entry.dayKey).meals.length, 1);
  assert.equal(captureDay(final.jobs, localDayKey(now)).meals.length, 0);
  assert.equal(store.startEntry(entry.id).id, entry.id);
  assert.deepEqual(earnedState(store.getSnapshot().session), earned);
});

test('technical retries can finish with non-food or uncertainty without leaving a stale failure', () => {
  const failed = finish(capture('offline'));
  for (const outcome of ['notFood', 'uncertain']) {
    const pending = retryCapture(failed, { outcome, delay: 1000 });
    assert.equal(pending.failure, undefined);
    const completed = finish(pending);
    assert.equal(completed.status, outcome === 'notFood' ? 'notFood' : 'ready');
    assert.equal(completed.failure, undefined);
    assert.doesNotThrow(() => validateCaptureJobs([completed]));
  }
});

test('non-food and uncertain are valid analysis outcomes but never technical failure reasons', () => {
  const job = capture();
  for (const outcome of ['notFood', 'uncertain']) {
    assert.doesNotThrow(() => validateCaptureJobs([capture(outcome)]));
    assert.doesNotThrow(() => validateCaptureJobs([finish(capture(outcome))]));
    assert.throws(() => validateCaptureJobs([{ ...job, status: 'failed', failure: outcome, mockOutcome: outcome }]), /Invalid capture session/);
  }
  assert.throws(() => validateCaptureJobs([{ ...job, status: 'notFood' }]), /Invalid capture session/);
  assert.throws(() => validateCaptureJobs([{ ...job, status: 'notFood', mockOutcome: 'uncertain' }]), /Invalid capture session/);
  assert.throws(() => validateCaptureJobs([{ ...job, status: 'notFood', mockOutcome: 'notFood', failure: 'offline' }]), /Invalid capture session/);
  const legacy = { ...job };
  delete legacy.mockOutcome;
  delete legacy.attempt;
  assert.doesNotThrow(() => validateCaptureJobs([legacy]));
  assert.equal(finish(legacy).status, 'ready');
  const legacyResult = finish(legacy);
  delete legacyResult.result.assessment;
  assert.doesNotThrow(() => validateCaptureJobs([legacyResult]));
  assert.deepEqual(dailyCampContributions(captureDay([legacyResult]).meals), knownContribution);
});
