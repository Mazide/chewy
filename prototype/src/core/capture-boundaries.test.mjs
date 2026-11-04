import test from 'node:test';
import assert from 'node:assert/strict';
import { captureDay, capturePhotos, createCapture, localDayKey, prepareCaptureReply, retryCapture, reviseCapture } from './capture-session.js';
import { createDemoSessionStore, DEMO_STORAGE_KEY, sessionJourneyStep } from './demo-session.js';
import { dailyCampContributions } from './food-assessment.js';
import { formatJourneyDay, sessionJourneyHistory } from './journey-history.js';

const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
// Every callback is synchronous; restore the process zone before the next test.
const inZone = (zone, run) => {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try { return run(); }
  finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
};
const photo = (id, imageKey = 'chicken', source = 'camera') => ({ id, imageKey, source });
const submit = (store, entry, photos, { outcome = 'success', delay = 20000 } = {}) => {
  // Deliberately submit with the current time and without the saved date. The
  // session owns the first-photo identity even if a caller supplies new times.
  const job = { ...createCapture({ source: photos[0].source, theme: 'science', portion: 1,
    notes: 'Соус отдельно', delay, photos, outcome }, store.now()), id: entry.id };
  assert.equal(store.replaceJobs([...store.getSnapshot().session.jobs, job]), true);
  return store.getSnapshot().session.jobs.at(-1);
};
const progress = ({ jobs, ...session }) => structuredClone({ ...session, journey: sessionJourneyStep(session) });
const contribution = (session, dayKey) => dailyCampContributions(captureDay(session.jobs, dayKey).meals);
const empty = { protein: false, carbs: false, fats: false, plants: false };
const chicken = { ...empty, protein: true };
const breakfast = { ...empty, carbs: true, plants: true };
const findJob = (store, id) => store.getSnapshot().session.jobs.find(job => job.id === id);

test('first photo before New Year, extra frames and submission after midnight remain one rewarded day', () => inZone('Europe/London', () => {
  const storage = memoryStorage();
  let now = new Date(2026, 11, 31, 23, 59, 50).getTime();
  let store = createDemoSessionStore({ storage, now: () => now });
  const entry = store.startEntry('midnight-meal');
  assert.equal(entry.dayKey, '2026-12-31');
  assert.equal(store.purchaseAppearance('flowers'), true);
  assert.equal(store.applyAppearance('flowers'), true);
  const earned = progress(store.getSnapshot().session);

  now += 20000;
  store.tick();
  assert.equal(store.getSnapshot().dayKey, '2027-01-01');
  assert.deepEqual(store.startEntry(entry.id), entry);
  const photos = [photo('before-midnight'), photo('after-midnight', 'chicken', 'gallery')];
  const pending = submit(store, entry, photos);
  assert.equal(pending.createdAt, entry.firstPhotoAt);
  assert.equal(pending.dayKey, entry.dayKey);
  assert.equal(pending.readyAt, now + 20000);
  assert.deepEqual(progress(store.getSnapshot().session), earned);

  store = createDemoSessionStore({ storage, now: () => now });
  assert.equal(findJob(store, entry.id).status, 'processing');
  now = pending.readyAt;
  store.tick();
  const saved = store.getSnapshot().session;
  assert.deepEqual(capturePhotos(saved.jobs[0], true), photos);
  assert.equal(captureDay(saved.jobs, entry.dayKey).meals.length, 1);
  assert.deepEqual(contribution(saved, entry.dayKey), chicken);
  assert.deepEqual(contribution(saved, store.getSnapshot().dayKey), empty);
  assert.deepEqual(sessionJourneyHistory(saved).map(row => [row.dayKey, row.jobs.length, row.meals.length]), [['2026-12-31', 1, 1]]);
  assert.deepEqual(progress(saved), earned);
  assert.deepEqual(createDemoSessionStore({ storage, now: () => now }).getSnapshot().session, saved);
}));

test('a first-photo date survives crossing the date line before submission and viewing in several zones', () => inZone('Pacific/Kiritimati', () => {
  const storage = memoryStorage();
  let now = Date.parse('2026-10-29T10:05:00Z');
  let store = createDemoSessionStore({ storage, now: () => now });
  const entry = store.startEntry('date-line-meal');
  assert.equal(entry.dayKey, '2026-10-30');
  const earned = progress(store.getSnapshot().session);

  inZone('America/Los_Angeles', () => {
    now += 120000;
    assert.equal(localDayKey(now), '2026-10-29');
    assert.deepEqual(store.startEntry(entry.id), entry);
    const pending = submit(store, entry, [photo('first'), photo('extra', 'chicken', 'gallery')]);
    assert.equal(pending.dayKey, '2026-10-30');
    assert.equal(pending.createdAt, entry.firstPhotoAt);
    store = createDemoSessionStore({ storage, now: () => now });
    assert.equal(store.getSnapshot().dayKey, '2026-10-29');
    now = pending.readyAt;
    store.tick();
    assert.deepEqual(contribution(store.getSnapshot().session, store.getSnapshot().dayKey), empty);
    assert.deepEqual(contribution(store.getSnapshot().session, entry.dayKey), chicken);
  });

  const saved = storage.getItem(DEMO_STORAGE_KEY);
  for (const zone of ['Asia/Tokyo', 'America/Los_Angeles', 'UTC', 'Pacific/Kiritimati']) inZone(zone, () => {
    store = createDemoSessionStore({ storage, now: () => now });
    store.tick();
    assert.equal(store.getSnapshot().dayKey, localDayKey(now));
    assert.equal(findJob(store, entry.id).dayKey, entry.dayKey);
    assert.deepEqual(sessionJourneyHistory(store.getSnapshot().session).map(row => row.dayKey), ['2026-10-30']);
    assert.equal(formatJourneyDay(entry.dayKey), '30 октября 2026 г.');
    assert.deepEqual(contribution(store.getSnapshot().session, store.getSnapshot().dayKey),
      store.getSnapshot().dayKey === entry.dayKey ? chicken : empty);
    assert.deepEqual(progress(store.getSnapshot().session), earned);
    assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);
  });
}));

test('reordered replies from several days update only their meals and never award or replay history', () => inZone('UTC', () => {
  const storage = memoryStorage();
  let now;
  let store = createDemoSessionStore({ storage, now: () => Date.parse('2026-10-28T12:00:00Z') });
  const pending = [];
  for (const [id, day, imageKey] of [
    ['old-chicken', '28', 'chicken'], ['yesterday-breakfast', '29', 'breakfast'],
    ['today-apple', '30', 'apple'], ['today-chicken', '30', 'chicken'],
  ]) {
    now = Date.parse(`2026-10-${day}T12:00:00Z`);
    store = createDemoSessionStore({ storage, now: () => now });
    pending.push(submit(store, store.startEntry(id), [photo(id, imageKey)], { delay: 3 * 86400000 }));
  }
  const earned = progress(store.getSnapshot().session);
  assert.equal(earned.rewardEvents.length, 4);
  assert.equal(earned.journey, 3);
  const replies = pending.map(prepareCaptureReply);
  now = Date.parse('2026-10-31T12:00:00Z');
  store = createDemoSessionStore({ storage, now: () => now });

  const expected = [
    { '2026-10-28': empty, '2026-10-29': empty, '2026-10-30': chicken },
    { '2026-10-28': empty, '2026-10-29': breakfast, '2026-10-30': chicken },
    { '2026-10-28': chicken, '2026-10-29': breakfast, '2026-10-30': chicken },
    { '2026-10-28': chicken, '2026-10-29': breakfast, '2026-10-30': { ...chicken, carbs: true, plants: true } },
  ];
  for (const [step, index] of [3, 1, 0, 2].entries()) {
    assert.equal(store.deliverCaptureReply(replies[index]), true);
    const session = store.getSnapshot().session;
    for (const [dayKey, supplies] of Object.entries(expected[step])) assert.deepEqual(contribution(session, dayKey), supplies);
    assert.deepEqual(contribution(session, '2026-10-31'), empty);
    assert.deepEqual(progress(session), earned);
    assert.equal(store.deliverCaptureReply(replies[index]), false);
  }
  assert.deepEqual(sessionJourneyHistory(store.getSnapshot().session).map(row => [row.dayKey, row.meals.length]), [
    ['2026-10-30', 2], ['2026-10-29', 1], ['2026-10-28', 1],
  ]);
  for (const job of store.getSnapshot().session.jobs) {
    store.replaceJobs(store.getSnapshot().session.jobs.map(current => current.id === job.id ? { ...current, seen: true } : current));
    assert.deepEqual(progress(store.getSnapshot().session), earned);
  }
  const reloaded = createDemoSessionStore({ storage, now: () => now });
  assert.deepEqual(reloaded.getSnapshot().session, store.getSnapshot().session);
  for (const reply of replies) assert.equal(reloaded.deliverCaptureReply(reply), false);
}));

test('failed clarification and retry across days and zones preserve the original contribution until success', () => inZone('America/Los_Angeles', () => {
  const storage = memoryStorage();
  let now = Date.parse('2026-10-30T06:58:00Z');
  let store = createDemoSessionStore({ storage, now: () => now });
  const entry = store.startEntry('travelling-meal');
  assert.equal(entry.dayKey, '2026-10-29');
  submit(store, entry, [photo('original')]);
  store.completeAnalysis();
  const original = structuredClone(findJob(store, entry.id));
  const earned = progress(store.getSnapshot().session);
  const photos = [photo('replacement', 'breakfast', 'gallery'), photo('detail', 'breakfast')];

  inZone('Pacific/Kiritimati', () => {
    now += 5 * 60000;
    const pending = reviseCapture(original, { dishName: 'Овсянка с ягодами', notes: '', portion: 2, photos }, 20000, now, 'offline');
    assert.equal(store.replaceJobs([pending]), true);
    const oldReply = prepareCaptureReply(pending);
    assert.equal(store.deliverCaptureReply(oldReply), true);
    assert.equal(findJob(store, entry.id).status, 'failed');
    assert.deepEqual(capturePhotos(findJob(store, entry.id), true), original.result.photos);
    assert.deepEqual(contribution(store.getSnapshot().session, entry.dayKey), chicken);
    assert.deepEqual(contribution(store.getSnapshot().session, localDayKey(now)), empty);

    now = Date.parse('2026-10-31T12:00:00Z');
    store = createDemoSessionStore({ storage, now: () => now });
    assert.equal(store.getSnapshot().dayKey, '2026-11-01');
    const retry = retryCapture(findJob(store, entry.id), { delay: 20000 }, now);
    assert.equal(store.replaceJobs([retry]), true);
    assert.equal(store.deliverCaptureReply(oldReply), false);
    assert.deepEqual(contribution(store.getSnapshot().session, entry.dayKey), chicken);
    const reply = prepareCaptureReply(retry);
    assert.equal(store.deliverCaptureReply(reply), true);
    assert.deepEqual(contribution(store.getSnapshot().session, entry.dayKey), breakfast);
    assert.deepEqual(contribution(store.getSnapshot().session, store.getSnapshot().dayKey), empty);
    assert.deepEqual(capturePhotos(findJob(store, entry.id), true), photos);
    assert.equal(findJob(store, entry.id).createdAt, entry.firstPhotoAt);
    assert.equal(findJob(store, entry.id).dayKey, entry.dayKey);
    assert.deepEqual(progress(store.getSnapshot().session), earned);
    store = createDemoSessionStore({ storage, now: () => now });
    assert.equal(store.deliverCaptureReply(reply), false);
    assert.equal(store.deliverCaptureReply(oldReply), false);
    assert.deepEqual(sessionJourneyHistory(store.getSnapshot().session).map(row => [row.dayKey, row.meals.length]), [['2026-10-29', 1]]);
    assert.deepEqual(progress(store.getSnapshot().session), earned);
  });
}));

test('two entries at the same instant in different local dates retain distinct identities and responses', () => inZone('Pacific/Kiritimati', () => {
  const storage = memoryStorage();
  const now = Date.parse('2026-10-29T10:30:00Z');
  const store = createDemoSessionStore({ storage, now: () => now });
  const first = store.startEntry('east');
  const east = submit(store, first, [photo('east-photo', 'breakfast')]);
  inZone('America/Los_Angeles', () => {
    const second = store.startEntry('west');
    const west = submit(store, second, [photo('west-photo')]);
    const earned = progress(store.getSnapshot().session);
    assert.equal(first.firstPhotoAt, second.firstPhotoAt);
    assert.equal(first.dayKey, '2026-10-30');
    assert.equal(second.dayKey, '2026-10-29');
    assert.equal(store.deliverCaptureReply(prepareCaptureReply(west)), true);
    assert.equal(store.deliverCaptureReply(prepareCaptureReply(east)), true);
    assert.deepEqual(contribution(store.getSnapshot().session, first.dayKey), breakfast);
    assert.deepEqual(contribution(store.getSnapshot().session, second.dayKey), chicken);
    assert.deepEqual(captureDay(store.getSnapshot().session.jobs, first.dayKey).meals.map(meal => meal.id), ['east']);
    assert.deepEqual(captureDay(store.getSnapshot().session.jobs, second.dayKey).meals.map(meal => meal.id), ['west']);
    assert.deepEqual(progress(store.getSnapshot().session), earned);
    assert.equal(earned.rewardEvents.length, 2);
    assert.equal(earned.journey, 2);
  });
}));

test('midnight still changes the displayed day when saving a due analysis fails', () => inZone('Europe/London', () => {
  const storage = memoryStorage();
  const write = storage.setItem;
  let now = new Date(2026, 9, 29, 23, 59, 59).getTime();
  const store = createDemoSessionStore({ storage, now: () => now });
  const entry = store.startEntry('write-refused-at-midnight');
  const pending = submit(store, entry, [photo('plate')]);
  const before = store.getSnapshot().session;
  const saved = storage.getItem(DEMO_STORAGE_KEY);
  storage.setItem = () => { throw new Error('quota'); };
  now += 30000;
  store.tick();
  assert.equal(store.getSnapshot().dayKey, '2026-10-30');
  assert.strictEqual(store.getSnapshot().session, before);
  assert.equal(findJob(store, entry.id).status, 'processing');
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);
  assert.match(store.getSnapshot().error, /не применено/);
  assert.deepEqual(contribution(store.getSnapshot().session, store.getSnapshot().dayKey), empty);

  storage.setItem = write;
  store.tick();
  assert.equal(findJob(store, entry.id).status, 'ready');
  assert.equal(findJob(store, entry.id).dayKey, pending.dayKey);
  assert.equal(store.getSnapshot().dayKey, '2026-10-30');
  assert.equal(store.getSnapshot().error, '');
  assert.deepEqual(contribution(store.getSnapshot().session, entry.dayKey), chicken);
  assert.deepEqual(contribution(store.getSnapshot().session, store.getSnapshot().dayKey), empty);
  assert.deepEqual(progress(store.getSnapshot().session), progress(before));
}));
