import test from 'node:test';
import assert from 'node:assert/strict';
import { captureDay, capturePhotos, completeDueCaptures, createCapture, localDayKey, readCaptureSession,
  retryCapture, reviseCapture, validateCaptureJobs, writeCaptureSession } from './capture-session.js';
import { dailyCampContributions } from './food-assessment.js';
import { createDemoSessionStore, sessionJourneyStep } from './demo-session.js';

const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
const photos = [
  { id: 'plate', imageKey: 'chicken', source: 'camera' },
  { id: 'detail', imageKey: 'chicken', source: 'gallery' },
];
const capture = (outcome = 'success', now = Date.now()) => createCapture({ source: 'camera', theme: 'science',
  portion: 1, notes: 'Соус отдельно', delay: 20000, photos, outcome }, now);

for (const outcome of ['offline', 'error', 'timeout']) {
  test(`${outcome} is a saved outcome of the same capture after leaving and restarting`, () => {
    const db = storage();
    const original = capture(outcome, Date.now() - 30000);
    writeCaptureSession(db, [original]);
    const [failed] = readCaptureSession(db);
    assert.equal(failed.id, original.id);
    assert.equal(failed.createdAt, original.createdAt);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.failure, outcome);
    assert.equal(failed.attempt, 1);
    assert.equal(failed.result, null);
    assert.deepEqual(capturePhotos(failed), photos);
    assert.equal(failed.notes, original.notes);
    assert.equal(captureDay([failed]).meals.length, 0);
    writeCaptureSession(db, [failed]);
    const [restored] = readCaptureSession(db);
    assert.deepEqual(restored, failed);
    assert.strictEqual(completeDueCaptures([restored], Infinity)[0], restored);
  });
}

test('retry keeps identity, original day and submitted data and only replaces the selected outcome', () => {
  const now = Date.now();
  const original = { ...capture('offline', now - 86400000), dayKey: localDayKey(now - 86400000), dishName: 'Ужин' };
  const [failed] = completeDueCaptures([original], now);
  const retry = retryCapture(failed, { delay: 5000 }, now);
  assert.equal(retry.id, failed.id);
  assert.equal(retry.createdAt, failed.createdAt);
  assert.equal(retry.dayKey, failed.dayKey);
  assert.equal(retry.status, 'processing');
  assert.equal(retry.failure, undefined);
  assert.equal(retry.mockOutcome, 'success');
  assert.equal(retry.attempt, 2);
  assert.equal(retry.readyAt, now + 5000);
  for (const field of ['photos', 'dishName', 'portion', 'notes', 'result']) assert.deepEqual(retry[field], failed[field]);
  assert.strictEqual(completeDueCaptures([retry], now + 4999)[0], retry);
  const [ready] = completeDueCaptures([retry], now + 5000);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.result.name, 'Ужин');
  assert.deepEqual(ready.result.photos, photos);
  assert.equal(captureDay([ready], failed.dayKey).meals.length, 1);
  assert.equal(captureDay([ready], localDayKey(now)).meals.length, 0);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.attempt, 1);
});

test('failed clarification keeps old result and contribution plus submitted photos and changes for retry', () => {
  const now = Date.now();
  const dayKey = localDayKey(now - 86400000);
  const [original] = completeDueCaptures([{ ...capture('success', now - 86400000), dayKey }], Infinity);
  const originalResult = structuredClone(original.result);
  const originalContribution = dailyCampContributions(captureDay([original], dayKey).meals);
  const changes = { dishName: 'Овсянка с ягодами', notes: '', portion: 2,
    photos: [{ id: 'replacement', imageKey: 'breakfast', source: 'gallery' }] };
  const pending = reviseCapture(original, changes, 1000, now - 2000, 'error');
  assert.equal(pending.attempt, 2);
  assert.deepEqual(pending.result, originalResult);
  const db = storage();
  writeCaptureSession(db, [pending]);
  const [failed] = readCaptureSession(db);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.failure, 'error');
  assert.deepEqual(failed.result, originalResult);
  assert.deepEqual(captureDay([failed], dayKey).meals[0].photos, photos);
  assert.deepEqual(dailyCampContributions(captureDay([failed], dayKey).meals), originalContribution);
  for (const field of ['photos', 'dishName', 'portion', 'notes']) assert.deepEqual(failed[field], changes[field]);
  writeCaptureSession(db, [failed]);
  const retry = retryCapture(readCaptureSession(db)[0], { delay: 1000 }, now);
  assert.equal(retry.attempt, 3);
  assert.deepEqual(retry.result, originalResult);
  assert.deepEqual(dailyCampContributions(captureDay([retry], dayKey).meals), originalContribution);
  const [ready] = completeDueCaptures([retry], now + 1000);
  assert.equal(ready.id, original.id);
  assert.equal(ready.createdAt, original.createdAt);
  assert.equal(ready.dayKey, dayKey);
  assert.equal(ready.result.name, changes.dishName);
  assert.deepEqual(ready.result.photos, changes.photos);
  assert.equal(captureDay([ready], dayKey).meals.length, 1);
  assert.deepEqual(dailyCampContributions(captureDay([ready], dayKey).meals), { protein: false, carbs: true, fats: false, plants: true });
  assert.deepEqual(original.result, originalResult);
});

test('another failed retry waits for an explicit retry and does not increment attempts on ticks', () => {
  const now = Date.now();
  const [first] = completeDueCaptures([capture('offline', now)], Infinity);
  const second = retryCapture(first, { outcome: 'timeout', delay: 1000 }, now);
  const [failedAgain] = completeDueCaptures([second], Infinity);
  assert.equal(failedAgain.failure, 'timeout');
  assert.equal(failedAgain.attempt, 2);
  assert.strictEqual(completeDueCaptures([failedAgain], Infinity)[0], failedAgain);
  const third = retryCapture(failedAgain, { outcome: 'error', delay: 1000 }, now);
  assert.equal(third.attempt, 3);
  assert.equal(third.id, first.id);
  assert.deepEqual(third.photos, photos);
});

test('failures and retries across restart and a new day preserve first-photo rewards and journey progress', () => {
  let now = Date.now();
  const db = storage();
  let store = createDemoSessionStore({ storage: db, now: () => now });
  const entry = store.startEntry();
  const job = { ...capture('offline', now), id: entry.id };
  assert.equal(store.replaceJobs([job]), true);
  const session = store.getSnapshot().session;
  const earned = structuredClone({ entries: session.entries, rewardEvents: session.rewardEvents, creditedDays: session.creditedDays,
    regularity: session.regularity, inventory: session.inventory, journey: sessionJourneyStep(session) });
  for (const outcome of ['error', 'timeout', 'success']) {
    assert.equal(store.completeAnalysis(), true);
    assert.equal(store.getSnapshot().session.jobs[0].status, 'failed');
    now += 86400000;
    store = createDemoSessionStore({ storage: db, now: () => now });
    const failed = store.getSnapshot().session.jobs[0];
    assert.equal(store.replaceJobs([retryCapture(failed, { outcome, delay: 1000 }, now)]), true);
    const current = store.getSnapshot().session;
    assert.deepEqual({ entries: current.entries, rewardEvents: current.rewardEvents, creditedDays: current.creditedDays,
      regularity: current.regularity, inventory: current.inventory, journey: sessionJourneyStep(current) }, earned);
  }
  assert.equal(store.completeAnalysis(), true);
  const final = store.getSnapshot().session;
  assert.equal(final.jobs.length, 1);
  assert.equal(final.jobs[0].status, 'ready');
  assert.equal(final.jobs[0].dayKey, entry.dayKey);
  assert.deepEqual(final.rewardEvents, earned.rewardEvents);
  assert.deepEqual(final.inventory, earned.inventory);
  assert.deepEqual(final.creditedDays, earned.creditedDays);
});

test('legacy outcome and attempt fields remain optional for saved jobs and revisions', () => {
  const legacy = capture('success', Date.now() - 30000);
  delete legacy.mockOutcome;
  delete legacy.attempt;
  const db = storage();
  writeCaptureSession(db, [legacy]);
  const [ready] = readCaptureSession(db);
  assert.equal(ready.status, 'ready');
  const revised = reviseCapture(ready, { dishName: 'Уточнение', notes: '', portion: 1 }, 1000);
  assert.equal(revised.attempt, 2);
  assert.equal(revised.mockOutcome, 'success');
  const failed = { ...legacy, status: 'failed', failure: 'offline' };
  assert.doesNotThrow(() => validateCaptureJobs([failed]));
  assert.equal(retryCapture(failed, { delay: 1000 }).attempt, 2);
});

test('invalid failure states, outcomes and attempt counters fail validation', () => {
  const job = capture();
  const invalid = [
    { mockOutcome: 'unknown' }, { mockOutcome: null },
    ...[0, -1, 1.5, Infinity, '1', null].map(attempt => ({ attempt })),
    { status: 'failed' }, { status: 'failed', failure: 'success' }, { status: 'failed', failure: 'unknown' },
    { status: 'failed', failure: 'offline', mockOutcome: 'success' },
    { status: 'failed', failure: 'offline', mockOutcome: 'error' },
    { failure: 'offline' }, { status: 'ready', failure: 'error' },
  ];
  for (const changes of invalid) assert.throws(() => validateCaptureJobs([{ ...job, ...changes }]), /Invalid capture session/);
  assert.throws(() => capture('unknown'), /Invalid capture outcome/);
  assert.throws(() => reviseCapture(job, { dishName: '', notes: '', portion: 1 }, 1000, Date.now(), 'unknown'), /Invalid capture outcome/);
  assert.throws(() => retryCapture(job, { delay: 1000 }), /Only failed captures/);
  const [ready] = completeDueCaptures([job], Infinity);
  assert.throws(() => retryCapture(ready, { delay: 1000 }), /Only failed captures/);
  const [failed] = completeDueCaptures([capture('error')], Infinity);
  assert.throws(() => retryCapture(failed, { outcome: 'unknown', delay: 1000 }), /Invalid capture outcome/);
});
