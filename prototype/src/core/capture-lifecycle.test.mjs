import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCaptureReply, cancelCapture, captureDay, capturePhotos, completeDueCaptures, createCapture, deleteCapture,
  prepareCaptureReply, retryCapture, reviseCapture, validateCaptureJobs } from './capture-session.js';
import { createDemoSessionStore, DEMO_STORAGE_KEY, sessionJourneyStep } from './demo-session.js';
import { dailyCampContributions } from './food-assessment.js';

const firstTime = new Date(2026, 9, 29, 12).getTime();
const photos = [{ id: 'plate', imageKey: 'chicken', source: 'camera' }, { id: 'detail', imageKey: 'chicken', source: 'gallery' }];
const changes = { dishName: 'Овсянка с ягодами', notes: '', portion: 2,
  photos: [{ id: 'replacement', imageKey: 'breakfast', source: 'gallery' }] };
const memoryStorage = () => {
  const values = new Map();
  return { reject: false, getItem: key => values.get(key) ?? null,
    setItem(key, value) { if (this.reject) throw new Error('quota'); values.set(key, value); } };
};
const capture = (outcome = 'success', now = firstTime, imageKey = 'chicken') => createCapture({ source: 'camera', theme: 'science',
  portion: 1, notes: 'Соус отдельно', delay: 20000, photos: photos.map(photo => ({ ...photo, imageKey })), outcome }, now);
const finish = job => completeDueCaptures([job], Infinity)[0];
const durableProgress = ({ jobs, ...session }) => ({ ...session, journey: sessionJourneyStep(session) });
const addJob = (store, { outcome = 'success', imageKey = 'chicken' } = {}) => {
  const entry = store.startEntry();
  const job = { ...capture(outcome, entry.firstPhotoAt, imageKey), id: entry.id };
  assert.equal(store.replaceJobs([...store.getSnapshot().session.jobs, job]), true);
  return store.getSnapshot().session.jobs.at(-1);
};
const contribute = (jobs, dayKey) => dailyCampContributions(captureDay(jobs, dayKey).meals);

for (const outcome of ['processing', 'error', 'notFood']) {
  test(`cancelling initial ${outcome} removes only its task and persists earned progress`, () => {
    const storage = memoryStorage();
    const store = createDemoSessionStore({ storage, now: () => firstTime });
    const pending = addJob(store, { outcome: outcome === 'processing' ? 'success' : outcome });
    const late = prepareCaptureReply(pending);
    if (outcome !== 'processing') assert.equal(store.completeAnalysis(), true);
    assert.equal(store.purchaseAppearance('flowers'), true);
    assert.equal(store.applyAppearance('flowers'), true);
    const before = structuredClone(durableProgress(store.getSnapshot().session));
    assert.equal(store.cancelCapture(pending.id), true);
    assert.deepEqual(store.getSnapshot().session.jobs, []);
    assert.deepEqual(durableProgress(store.getSnapshot().session), before);
    const reloaded = createDemoSessionStore({ storage, now: () => firstTime });
    assert.deepEqual(reloaded.getSnapshot().session.jobs, []);
    assert.deepEqual(durableProgress(reloaded.getSnapshot().session), before);
    const saved = storage.getItem(DEMO_STORAGE_KEY);
    assert.equal(reloaded.deliverCaptureReply(late), false);
    assert.equal(reloaded.completeAnalysis(), false);
    assert.equal(reloaded.cancelCapture(pending.id), false);
    reloaded.tick();
    assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);
  });
}

for (const outcome of ['processing', 'offline', 'notFood']) {
  test(`cancelling ${outcome} clarification restores the prior result, photos, and original day`, () => {
    const storage = memoryStorage();
    let now = firstTime;
    let store = createDemoSessionStore({ storage, now: () => now });
    addJob(store); store.completeAnalysis();
    const original = structuredClone(store.getSnapshot().session.jobs[0]);
    const originalContribution = contribute([original], original.dayKey);
    const before = structuredClone(durableProgress(store.getSnapshot().session));
    now += 86400000;
    const pending = reviseCapture(original, changes, 20000, now, outcome === 'processing' ? 'success' : outcome);
    const late = prepareCaptureReply(pending);
    assert.equal(store.replaceJobs([pending]), true);
    if (outcome !== 'processing') store.completeAnalysis();
    store = createDemoSessionStore({ storage, now: () => now });
    assert.equal(store.cancelCapture(original.id), true);
    const restored = store.getSnapshot().session.jobs[0];
    assert.equal(restored.status, 'ready');
    assert.equal(restored.failure, undefined);
    assert.equal(restored.id, original.id);
    assert.equal(restored.dayKey, original.dayKey);
    assert.equal(restored.createdAt, original.createdAt);
    assert.deepEqual(restored.result, original.result);
    assert.deepEqual(capturePhotos(restored), photos);
    assert.equal(restored.dishName, original.result.name);
    assert.equal(restored.notes, original.result.notes);
    assert.equal(restored.portion, original.result.portion);
    assert.deepEqual(contribute([restored], original.dayKey), originalContribution);
    assert.equal(captureDay([restored], store.getSnapshot().dayKey).meals.length, 0);
    assert.deepEqual(durableProgress(store.getSnapshot().session), before);
    store = createDemoSessionStore({ storage, now: () => now });
    assert.deepEqual(store.getSnapshot().session.jobs[0], restored);
    assert.equal(store.deliverCaptureReply(late), false);
    const next = reviseCapture(restored, changes, 20000, now);
    assert.ok(next.attempt > pending.attempt);
    assert.equal(store.replaceJobs([next]), true);
    assert.equal(store.deliverCaptureReply(late), false);
    assert.equal(store.getSnapshot().session.jobs[0].status, 'processing');
    assert.equal(store.completeAnalysis(), true);
    assert.equal(store.getSnapshot().session.jobs[0].result.name, changes.dishName);
    assert.equal(captureDay(store.getSnapshot().session.jobs, original.dayKey).meals.length, 1);
    assert.deepEqual(durableProgress(store.getSnapshot().session), before);
  });
}

test('legacy photos and optional attempt counters survive revision cancellation', () => {
  const legacy = finish(capture());
  delete legacy.attempt; delete legacy.mockOutcome; delete legacy.photos; delete legacy.result.photos;
  const pending = reviseCapture(legacy, changes, 20000, firstTime);
  const reply = prepareCaptureReply(pending);
  const [restored] = cancelCapture([pending], pending.id);
  assert.doesNotThrow(() => validateCaptureJobs([restored]));
  assert.equal(capturePhotos(restored)[0].imageKey, 'chicken');
  assert.equal(restored.attempt, 2);
  const next = reviseCapture(restored, changes, 20000, firstTime);
  assert.equal(next.attempt, 3);
  const jobs = [next];
  assert.strictEqual(applyCaptureReply(jobs, reply), jobs);
  const oldPending = capture(); delete oldPending.attempt;
  const legacyReply = prepareCaptureReply(oldPending);
  assert.equal(legacyReply.attempt, 1);
  assert.equal(applyCaptureReply([oldPending], legacyReply)[0].status, 'ready');
});

test('deleting one of several meals removes only its contribution, preserving all earned progress after restart', () => {
  const storage = memoryStorage();
  const store = createDemoSessionStore({ storage, now: () => firstTime });
  const breakfast = addJob(store, { imageKey: 'breakfast' });
  const chicken = addJob(store);
  store.completeAnalysis();
  store.purchaseAppearance('flowers'); store.applyAppearance('flowers');
  const before = structuredClone(durableProgress(store.getSnapshot().session));
  assert.deepEqual(contribute(store.getSnapshot().session.jobs, chicken.dayKey), { protein: true, carbs: true, fats: false, plants: true });
  assert.equal(store.deleteCapture(chicken.id), true);
  const session = store.getSnapshot().session;
  assert.deepEqual(session.jobs.map(job => job.id), [breakfast.id]);
  assert.deepEqual(contribute(session.jobs, chicken.dayKey), { protein: false, carbs: true, fats: false, plants: true });
  assert.deepEqual(durableProgress(session), before);
  const reloaded = createDemoSessionStore({ storage, now: () => firstTime });
  assert.deepEqual(reloaded.getSnapshot().session, session);
  assert.equal(reloaded.deleteCapture(chicken.id), false);
});

test('deleting a historical meal changes only its original day and preserves the current day', () => {
  const storage = memoryStorage();
  let now = firstTime;
  const store = createDemoSessionStore({ storage, now: () => now });
  const old = addJob(store); store.completeAnalysis();
  now += 86400000;
  const today = addJob(store, { imageKey: 'breakfast' }); store.completeAnalysis();
  const before = structuredClone(durableProgress(store.getSnapshot().session));
  const currentContribution = contribute(store.getSnapshot().session.jobs, today.dayKey);
  assert.equal(store.deleteCapture(old.id), true);
  assert.equal(captureDay(store.getSnapshot().session.jobs, old.dayKey).meals.length, 0);
  assert.deepEqual(contribute(store.getSnapshot().session.jobs, today.dayKey), currentContribution);
  assert.deepEqual(durableProgress(store.getSnapshot().session), before);
  assert.deepEqual(createDemoSessionStore({ storage, now: () => now }).getSnapshot().session, store.getSnapshot().session);
});

test('a deleted result with pending clarification cannot be recreated by the queued response', () => {
  const storage = memoryStorage();
  let store = createDemoSessionStore({ storage, now: () => firstTime });
  addJob(store); store.completeAnalysis();
  const pending = reviseCapture(store.getSnapshot().session.jobs[0], changes, 20000, firstTime);
  const reply = prepareCaptureReply(pending);
  store.replaceJobs([pending]);
  assert.equal(store.deleteCapture(pending.id), true);
  store = createDemoSessionStore({ storage, now: () => firstTime });
  const before = store.getSnapshot().session;
  assert.equal(store.deliverCaptureReply(reply), false);
  assert.strictEqual(store.getSnapshot().session, before);
  assert.equal(captureDay(before.jobs, pending.dayKey).meals.length, 0);
  assert.equal(before.rewardEvents.length, 1);
});

test('ready-state cancellation and no applicable deletion are no-ops, including completion while confirmation is open', () => {
  const storage = memoryStorage();
  const store = createDemoSessionStore({ storage, now: () => firstTime });
  const pending = addJob(store);
  assert.equal(store.deleteCapture(pending.id), false);
  assert.equal(store.deleteCapture('missing'), false);
  assert.equal(store.cancelCapture('missing'), false);
  store.completeAnalysis();
  const before = store.getSnapshot().session;
  const saved = storage.getItem(DEMO_STORAGE_KEY);
  assert.equal(store.cancelCapture(pending.id), false);
  assert.strictEqual(store.getSnapshot().session, before);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);
  assert.strictEqual(cancelCapture(before.jobs, pending.id), before.jobs);
  assert.strictEqual(deleteCapture(before.jobs, 'missing'), before.jobs);
});

test('delivery ignores duplicate replies and replies from an older retry attempt', () => {
  const storage = memoryStorage();
  const store = createDemoSessionStore({ storage, now: () => firstTime });
  const pending = addJob(store, { outcome: 'offline' });
  const oldReply = prepareCaptureReply(pending);
  assert.equal(store.deliverCaptureReply(oldReply), true);
  const retry = retryCapture(store.getSnapshot().session.jobs[0], { delay: 20000 }, firstTime);
  store.replaceJobs([retry]);
  assert.equal(store.deliverCaptureReply(oldReply), false);
  const reply = prepareCaptureReply(retry);
  assert.equal(store.deliverCaptureReply(reply), true);
  const before = store.getSnapshot().session;
  const saved = storage.getItem(DEMO_STORAGE_KEY);
  assert.equal(store.deliverCaptureReply(reply), false);
  assert.equal(store.deliverCaptureReply(null), false);
  assert.strictEqual(store.getSnapshot().session, before);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);
  assert.equal(before.jobs[0].status, 'ready');
});

test('partial or malformed new replies cannot complete a task or overwrite a previous result', () => {
  const storage = memoryStorage();
  const store = createDemoSessionStore({ storage, now: () => firstTime });
  addJob(store); store.completeAnalysis();
  const pending = reviseCapture(store.getSnapshot().session.jobs[0], changes, 20000, firstTime);
  store.replaceJobs([pending]);
  const reply = prepareCaptureReply(pending);
  const before = store.getSnapshot().session;
  const saved = storage.getItem(DEMO_STORAGE_KEY);
  const invalid = [
    { ...reply, outcome: 'unknown' }, { ...reply, result: undefined }, { ...reply, result: null },
    { ...reply, result: { ...reply.result, notes: null } },
    { ...reply, result: { ...reply.result, portion: 8 } },
    { ...reply, result: { ...reply.result, photos: undefined } },
    { ...reply, result: { ...reply.result, photos: [null] } },
    { ...reply, result: { ...reply.result, photos: [] } },
    { ...reply, result: { ...reply.result, assessment: undefined } },
    { ...reply, result: { ...reply.result, assessment: {} } },
  ];
  for (const response of invalid) {
    assert.equal(store.deliverCaptureReply(response), false);
    assert.strictEqual(store.getSnapshot().session, before);
    assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);
  }
  assert.equal(store.deliverCaptureReply(reply), true);
});

test('a response snapshots submitted data and cannot mutate the session after delivery', () => {
  const storage = memoryStorage();
  const store = createDemoSessionStore({ storage, now: () => firstTime });
  const pending = addJob(store);
  const submitted = structuredClone(pending);
  const reply = prepareCaptureReply(submitted);
  submitted.photos[0].imageKey = 'apple';
  assert.equal(reply.result.photos[0].imageKey, 'chicken');
  assert.equal(store.deliverCaptureReply(reply), true);
  const before = structuredClone(store.getSnapshot().session);
  reply.result.name = 'Changed later';
  reply.result.photos[0].imageKey = 'breakfast';
  reply.result.assessment.supplies.protein[0] = 0;
  assert.deepEqual(store.getSnapshot().session, before);
  assert.deepEqual(createDemoSessionStore({ storage, now: () => firstTime }).getSnapshot().session, before);
});

test('normal timer and explicit completion share the guarded response delivery behavior', () => {
  const storage = memoryStorage();
  let now = firstTime;
  const store = createDemoSessionStore({ storage, now: () => now });
  const first = addJob(store, { outcome: 'uncertain' });
  const timerReply = prepareCaptureReply(first);
  now = first.readyAt;
  store.tick();
  assert.equal(store.getSnapshot().session.jobs[0].status, 'ready');
  assert.deepEqual(store.getSnapshot().session.jobs[0].result, timerReply.result);
  assert.equal(store.deliverCaptureReply(timerReply), false);
  const second = addJob(store);
  const explicitReply = prepareCaptureReply(second);
  assert.equal(store.completeAnalysis(), true);
  assert.deepEqual(store.getSnapshot().session.jobs[1].result, explicitReply.result);
  assert.equal(store.deliverCaptureReply(explicitReply), false);
  assert.equal(store.getSnapshot().session.jobs.length, 2);
});

for (const action of ['cancelCapture', 'deleteCapture', 'deliverCaptureReply', 'completeAnalysis']) {
  test(`${action} leaves memory and saved data intact when storage refuses the transaction`, () => {
    const storage = memoryStorage();
    const store = createDemoSessionStore({ storage, now: () => firstTime });
    const pending = addJob(store);
    if (action === 'deleteCapture') store.completeAnalysis();
    const before = store.getSnapshot().session;
    const saved = storage.getItem(DEMO_STORAGE_KEY);
    const argument = action === 'deliverCaptureReply' ? prepareCaptureReply(pending) : pending.id;
    storage.reject = true;
    assert.equal(store[action](argument), false);
    assert.strictEqual(store.getSnapshot().session, before);
    assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);
    assert.match(store.getSnapshot().error, /не применено/);
    storage.reject = false;
    assert.equal(store[action](argument), true);
    assert.equal(store.getSnapshot().error, '');
  });
}

test('cancelling a revision cannot claim restoration when storage fails', () => {
  const storage = memoryStorage();
  const store = createDemoSessionStore({ storage, now: () => firstTime });
  addJob(store); store.completeAnalysis();
  const pending = reviseCapture(store.getSnapshot().session.jobs[0], changes, 20000, firstTime);
  store.replaceJobs([pending]);
  const before = store.getSnapshot().session;
  storage.reject = true;
  assert.equal(store.cancelCapture(pending.id), false);
  assert.strictEqual(store.getSnapshot().session, before);
  assert.equal(store.getSnapshot().session.jobs[0].status, 'processing');
  assert.deepEqual(capturePhotos(store.getSnapshot().session.jobs[0]), changes.photos);
});

test('read-only sessions cannot cancel, delete, or deliver responses', () => {
  const storage = memoryStorage();
  const writable = createDemoSessionStore({ storage, now: () => firstTime });
  const ready = addJob(writable); writable.completeAnalysis();
  const pending = addJob(writable);
  const readOnly = createDemoSessionStore({ storage, now: () => firstTime, lockManager: null });
  const before = readOnly.getSnapshot().session;
  const saved = storage.getItem(DEMO_STORAGE_KEY);
  assert.equal(readOnly.cancelCapture(pending.id), false);
  assert.equal(readOnly.deleteCapture(ready.id), false);
  assert.equal(readOnly.deliverCaptureReply(prepareCaptureReply(pending)), false);
  assert.equal(readOnly.completeAnalysis(), false);
  assert.strictEqual(readOnly.getSnapshot().session, before);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);
});
