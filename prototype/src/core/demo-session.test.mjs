import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE_STORAGE_KEY, captureDay, createCapture, localDayKey } from './capture-session.js';
import { createDemoSession, createDemoSessionStore, DEMO_STORAGE_KEY, sessionJourneyStep, WORKBENCH_STORAGE_KEY } from './demo-session.js';
import { effectiveMultiplier } from './demo-rewards.js';
import { HERO_DEMO_TIMING, resolveHeroState } from './hero-state.js';
import { dailyCampContributions } from './food-assessment.js';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
const capture = now => createCapture({ source: 'camera', theme: 'science', portion: 1, notes: 'Соус отдельно', delay: 20000 }, now);

test('one session restores captures, first-photo identity, inventory and progression together', () => {
  const storage = memoryStorage();
  let now = new Date(2026, 9, 29, 23, 59).getTime();
  const store = createDemoSessionStore({ storage, now: () => now });
  const entry = store.startEntry();
  now += 120000;
  assert.equal(store.replaceJobs([{ ...capture(now), id: entry.id }]), true);
  assert.equal(store.setInventory({ coins: 15, owned: ['flowers'], applied: { decor: 'flowers' } }), true);
  store.update(session => ({ ...session, creditedDays: [entry.dayKey],
    regularity: { multiplier: 1.2, lastCreditedDay: entry.dayKey },
    rewardEvents: [{ entryId: entry.id, dayKey: entry.dayKey, coins: 10 }] }));
  const reloaded = createDemoSessionStore({ storage, now: () => now });
  const saved = reloaded.getSnapshot().session;
  assert.equal(saved.jobs[0].id, entry.id);
  assert.equal(saved.jobs[0].createdAt, entry.firstPhotoAt);
  assert.equal(saved.jobs[0].dayKey, entry.dayKey);
  assert.equal(saved.jobs[0].readyAt, now + 20000);
  assert.deepEqual(saved.inventory, { coins: 15, owned: ['flowers'], applied: { decor: 'flowers' } });
  assert.equal(sessionJourneyStep(saved), 1);
  assert.equal(saved.rewardEvents.length, 1);
  now += 20001;
  reloaded.tick();
  assert.equal(reloaded.getSnapshot().session.jobs[0].status, 'ready');
  assert.equal(captureDay(reloaded.getSnapshot().session.jobs, new Date(entry.firstPhotoAt)).meals.length, 1);
  assert.equal(captureDay(reloaded.getSnapshot().session.jobs, new Date(now)).meals.length, 0);
  const completed = reloaded.getSnapshot();
  reloaded.tick();
  assert.strictEqual(reloaded.getSnapshot(), completed);
  assert.equal(completed.session.rewardEvents.length, 1);
});

test('legacy queue migrates once without inventing rewards, and reset cannot resurrect it', () => {
  const storage = memoryStorage();
  const job = capture(Date.now());
  const legacy = JSON.stringify({ version: 1, jobs: [job] });
  storage.setItem(CAPTURE_STORAGE_KEY, legacy);
  const store = createDemoSessionStore({ storage, migrateLegacy: true });
  const session = store.getSnapshot().session;
  assert.equal(session.jobs[0].id, job.id);
  assert.equal(session.jobs[0].dayKey, localDayKey(job.createdAt));
  assert.equal(session.inventory.coins, 0);
  assert.deepEqual(session.rewardEvents, []);
  assert.deepEqual(session.creditedDays, []);
  assert.equal(storage.getItem(CAPTURE_STORAGE_KEY), legacy);
  assert.equal(store.reset(), true);
  assert.deepEqual(createDemoSessionStore({ storage, migrateLegacy: true }).getSnapshot().session, createDemoSession());
  assert.equal(storage.getItem(CAPTURE_STORAGE_KEY), legacy);
});

test('isolated stories and workshop never read or overwrite the main session', () => {
  const storage = memoryStorage();
  const main = createDemoSessionStore({ storage });
  main.startEntry();
  const before = storage.getItem(DEMO_STORAGE_KEY);
  const fixture = createDemoSessionStore({ initialSession: { ...createDemoSession(), inventory: { coins: 80, owned: [], applied: {} } } });
  fixture.replaceJobs([capture(Date.now())]);
  fixture.reset();
  const workshop = createDemoSessionStore({ storage, storageKey: WORKBENCH_STORAGE_KEY });
  workshop.replaceJobs([capture(Date.now())]);
  workshop.reset();
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), before);
  assert.equal(main.getSnapshot().session.entries.length, 1);
});

test('unreadable or future-version saves remain untouched until explicit reset', () => {
  for (const raw of ['{broken', JSON.stringify({ ...createDemoSession(), version: 99 })]) {
    const storage = memoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, raw);
    const store = createDemoSessionStore({ storage, migrateLegacy: true });
    assert.ok(store.getSnapshot().error);
    assert.equal(store.startEntry(), false);
    assert.equal(store.replaceJobs([capture(Date.now())]), false);
    assert.equal(storage.getItem(DEMO_STORAGE_KEY), raw);
    assert.equal(store.reset(), true);
    assert.equal(store.getSnapshot().error, '');
    assert.deepEqual(JSON.parse(storage.getItem(DEMO_STORAGE_KEY)), createDemoSession());
  }
});

test('storage failure rolls back a whole change and a retry succeeds once', () => {
  const db = memoryStorage();
  let fail = false;
  const storage = { getItem: db.getItem, setItem: (key, value) => { if (fail) throw new Error('quota'); db.setItem(key, value); } };
  const store = createDemoSessionStore({ storage });
  const before = store.getSnapshot().session;
  fail = true;
  assert.equal(store.startEntry(), false);
  assert.strictEqual(store.getSnapshot().session, before);
  assert.equal(store.setInventory({ coins: 10, owned: [], applied: {} }), false);
  assert.strictEqual(store.getSnapshot().session, before);
  assert.equal(store.reset(), false);
  fail = false;
  assert.ok(store.startEntry());
  assert.equal(store.getSnapshot().error, '');
  assert.equal(store.getSnapshot().session.entries.length, 1);
  assert.equal(createDemoSessionStore({ storage }).getSnapshot().session.entries.length, 1);
});

test('invalid updates cannot persist duplicate records or unowned appearances', () => {
  const store = createDemoSessionStore();
  const job = capture(Date.now());
  assert.equal(store.replaceJobs([job, job]), false);
  assert.equal(store.getSnapshot().session.jobs.length, 0);
  assert.equal(store.setInventory({ coins: 0, owned: [], applied: { decor: 'flowers' } }), false);
  assert.deepEqual(store.getSnapshot().session.inventory.applied, {});
});

test('first-photo reward and day survive without saving the draft photographs', () => {
  const storage = memoryStorage();
  const store = createDemoSessionStore({ storage });
  const entry = store.startEntry();
  const session = createDemoSessionStore({ storage }).getSnapshot().session;
  assert.deepEqual(session.entries, [entry]);
  assert.deepEqual(session.jobs, []);
  assert.equal(session.rewardEvents.length, 1);
  assert.equal(session.rewardEvents[0].entryId, entry.id);
  assert.equal(session.inventory.coins, session.rewardEvents[0].coins);
  assert.deepEqual(session.creditedDays, [entry.dayKey]);
  const reloaded = createDemoSessionStore({ storage });
  assert.deepEqual(reloaded.startEntry(entry.id), entry);
  assert.deepEqual(reloaded.getSnapshot().session, session);
});

test('one committed photo event credits wallet, day and path atomically, even after a failed write', () => {
  const db = memoryStorage();
  let fail = false;
  const storage = { getItem: db.getItem, setItem: (key, value) => { if (fail) throw new Error('quota'); db.setItem(key, value); } };
  const store = createDemoSessionStore({ storage });
  fail = true;
  assert.equal(store.startEntry('first'), false);
  assert.deepEqual(store.getSnapshot().session, createDemoSession());
  fail = false;
  const first = store.startEntry('first');
  const awarded = store.getSnapshot().session;
  assert.equal(awarded.rewardEvents.length, 1);
  assert.ok(awarded.inventory.coins > 0);
  assert.equal(sessionJourneyStep(awarded), 1);
  store.startEntry(first.id);
  assert.strictEqual(store.getSnapshot().session, awarded);
  store.startEntry('second');
  assert.equal(store.getSnapshot().session.inventory.coins, awarded.inventory.coins * 2);
  assert.equal(store.getSnapshot().session.regularity.multiplier, awarded.regularity.multiplier);
  assert.equal(sessionJourneyStep(store.getSnapshot().session), 1);
});

test('test clock persists separately and decay is repeatable without taking earned progress', () => {
  const storage = memoryStorage();
  const now = () => new Date(2026, 9, 29, 12).getTime();
  const store = createDemoSessionStore({ storage, now });
  for (let day = 0; day < 6; day++) { store.startEntry(); store.advanceDays(1); }
  const earned = store.getSnapshot().session;
  store.advanceDays(7);
  const reduced = effectiveMultiplier(earned, store.now());
  assert.ok(reduced < earned.regularity.multiplier);
  assert.ok(reduced >= 1);
  const reloaded = createDemoSessionStore({ storage, now });
  assert.equal(reloaded.now(), store.now());
  assert.equal(effectiveMultiplier(reloaded.getSnapshot().session, reloaded.now()), reduced);
  assert.deepEqual(reloaded.getSnapshot().session, earned);
  const job = capture(reloaded.now());
  reloaded.replaceJobs([job]);
  reloaded.tick();
  assert.equal(reloaded.getSnapshot().session.jobs[0].status, 'processing');
  reloaded.advanceDays(1);
  reloaded.tick();
  assert.equal(reloaded.getSnapshot().session.jobs[0].status, 'ready');
  const time = reloaded.now();
  reloaded.reset();
  assert.equal(reloaded.now(), time);
  assert.deepEqual(reloaded.getSnapshot().session, createDemoSession());
});

test('visits persist the last exit and welcome a return only after an absence', () => {
  const storage = memoryStorage();
  let now = new Date(2026, 9, 29, 12).getTime();
  const store = createDemoSessionStore({ storage, now: () => now });
  assert.equal(store.getSnapshot().session.lastSeenAt, null);
  assert.equal(store.enter(), true);
  assert.equal(store.getSnapshot().session.lastSeenAt, now);
  assert.equal(store.getSnapshot().hero.returning, false);
  assert.equal(store.enter(), false);

  now += HERO_DEMO_TIMING.returnAfterMs * 2;
  assert.equal(store.leave(), true);
  const lastExit = now;
  assert.equal(JSON.parse(storage.getItem(DEMO_STORAGE_KEY)).lastSeenAt, lastExit);
  assert.equal(store.leave(), false);
  now += HERO_DEMO_TIMING.returnAfterMs - 1;
  const shortReturn = createDemoSessionStore({ storage, now: () => now });
  assert.equal(shortReturn.enter(), true);
  assert.equal(shortReturn.getSnapshot().hero.returning, false);
  assert.equal(shortReturn.leave(), true);

  now += HERO_DEMO_TIMING.returnAfterMs;
  const longReturn = createDemoSessionStore({ storage, now: () => now });
  assert.equal(longReturn.enter(), true);
  assert.equal(longReturn.getSnapshot().hero.returning, true);
  assert.equal(resolveHeroState({ ...longReturn.getSnapshot().hero, now }), 'returning');
  assert.equal(longReturn.getSnapshot().session.lastSeenAt, now);
  assert.deepEqual(longReturn.getSnapshot().session.rewardEvents, []);
  assert.equal(longReturn.getSnapshot().session.inventory.coins, 0);
});

test('photo joy is transient and expires without reissuing rewards on reload', () => {
  const storage = memoryStorage();
  let now = new Date(2026, 9, 29, 12).getTime();
  const store = createDemoSessionStore({ storage, now: () => now });
  store.enter();
  const entry = store.startEntry('first-photo');
  const earned = store.getSnapshot().session;
  const saved = storage.getItem(DEMO_STORAGE_KEY);
  assert.equal(resolveHeroState({ ...store.getSnapshot().hero, now }), 'happy');
  now += 1000;
  store.reactToPhoto();
  const latestPhoto = now;
  assert.equal(store.getSnapshot().hero.lastPhotoAt, latestPhoto);
  assert.strictEqual(store.getSnapshot().session, earned);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);

  now = latestPhoto + HERO_DEMO_TIMING.happyMs - 1;
  store.tick();
  assert.equal(store.getSnapshot().hero.lastPhotoAt, latestPhoto);
  now += 1;
  store.tick();
  assert.equal(store.getSnapshot().hero.lastPhotoAt, null);
  assert.equal(resolveHeroState({ ...store.getSnapshot().hero, now }), 'idle');
  assert.strictEqual(store.getSnapshot().session, earned);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);

  const reloaded = createDemoSessionStore({ storage, now: () => now });
  assert.deepEqual(reloaded.getSnapshot().hero, { lastPhotoAt: null, returning: false });
  assert.equal(reloaded.enter(), true);
  const afterVisit = reloaded.getSnapshot().session;
  assert.deepEqual(reloaded.startEntry(entry.id), entry);
  assert.strictEqual(reloaded.getSnapshot().session, afterVisit);
  assert.equal(reloaded.getSnapshot().hero.lastPhotoAt, null);
  assert.deepEqual(afterVisit.rewardEvents, earned.rewardEvents);
  assert.equal(afterVisit.inventory.coins, earned.inventory.coins);
  assert.deepEqual(afterVisit.creditedDays, earned.creditedDays);
});

test('a new photo replaces the return greeting without making it another visit or reward', () => {
  let now = new Date(2026, 9, 29, 12).getTime();
  const initialSession = { ...createDemoSession(), lastSeenAt: now - HERO_DEMO_TIMING.returnAfterMs };
  const store = createDemoSessionStore({ initialSession, now: () => now });
  store.enter();
  assert.equal(store.getSnapshot().hero.returning, true);
  const before = store.getSnapshot().session;
  now += 1000;
  store.reactToPhoto();
  assert.deepEqual(store.getSnapshot().hero, { lastPhotoAt: now, returning: false });
  assert.strictEqual(store.getSnapshot().session, before);
  now += HERO_DEMO_TIMING.happyMs;
  store.tick();
  assert.equal(resolveHeroState({ ...store.getSnapshot().hero, now }), 'idle');
});

test('reset keeps an active visit able to preview a later return and save its exit', () => {
  const storage = memoryStorage();
  const now = () => new Date(2026, 9, 29, 12).getTime();
  const store = createDemoSessionStore({ storage, now });
  assert.equal(store.enter(), true);
  store.startEntry('before-reset');
  assert.equal(store.reset(), true);
  assert.deepEqual(store.getSnapshot().session, createDemoSession());
  assert.deepEqual(store.getSnapshot().hero, { lastPhotoAt: null, returning: false });
  assert.equal(store.enter(), false);
  assert.ok(store.startEntry('after-reset'));
  const earned = store.getSnapshot().session;
  assert.equal(store.getSnapshot().hero.lastPhotoAt, store.now());
  assert.equal(store.advanceDays(7), true);
  assert.deepEqual(store.getSnapshot().hero, { lastPhotoAt: null, returning: true });
  assert.strictEqual(store.getSnapshot().session, earned);
  assert.equal(resolveHeroState({ ...store.getSnapshot().hero, now: store.now() }), 'returning');
  assert.equal(store.leave(), true);
  assert.equal(store.getSnapshot().session.lastSeenAt, store.now());
  assert.equal(JSON.parse(storage.getItem(DEMO_STORAGE_KEY)).lastSeenAt, store.now());
  const reloaded = createDemoSessionStore({ storage, now });
  assert.equal(reloaded.enter(), true);
  assert.equal(reloaded.getSnapshot().hero.returning, false);
  assert.deepEqual(reloaded.getSnapshot().session.rewardEvents, earned.rewardEvents);
});

test('failed visit and reward writes keep session and transient reactions atomic', () => {
  const db = memoryStorage();
  let fail = false;
  const storage = { getItem: db.getItem, setItem: (key, value) => { if (fail) throw new Error('quota'); db.setItem(key, value); } };
  let now = new Date(2026, 9, 29, 12).getTime();
  const initialSession = { ...createDemoSession(), lastSeenAt: now - HERO_DEMO_TIMING.returnAfterMs };
  const store = createDemoSessionStore({ storage, initialSession, now: () => now });
  const initial = store.getSnapshot();
  const saved = storage.getItem(DEMO_STORAGE_KEY);
  fail = true;
  assert.equal(store.enter(), false);
  assert.strictEqual(store.getSnapshot().session, initial.session);
  assert.strictEqual(store.getSnapshot().hero, initial.hero);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);
  fail = false;
  assert.equal(store.enter(), true);
  const entered = store.getSnapshot();
  const savedVisit = storage.getItem(DEMO_STORAGE_KEY);
  assert.equal(entered.hero.returning, true);
  fail = true;
  assert.equal(store.startEntry('retry-photo'), false);
  assert.strictEqual(store.getSnapshot().session, entered.session);
  assert.strictEqual(store.getSnapshot().hero, entered.hero);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), savedVisit);
  fail = false;
  assert.ok(store.startEntry('retry-photo'));
  assert.equal(store.getSnapshot().hero.returning, false);
  assert.equal(store.getSnapshot().session.rewardEvents.length, 1);
  now += 1000;
  const beforeLeave = store.getSnapshot();
  const savedPhoto = storage.getItem(DEMO_STORAGE_KEY);
  fail = true;
  assert.equal(store.leave(), false);
  assert.strictEqual(store.getSnapshot().session, beforeLeave.session);
  assert.strictEqual(store.getSnapshot().hero, beforeLeave.hero);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), savedPhoto);
  fail = false;
  assert.equal(store.leave(), true);
  assert.equal(store.getSnapshot().session.lastSeenAt, now);
  assert.equal(JSON.parse(storage.getItem(DEMO_STORAGE_KEY)).lastSeenAt, now);
});

test('completeAnalysis saves different answers to original days without changing rewards', () => {
  const storage = memoryStorage();
  let now = new Date(2026, 9, 29, 23, 59).getTime();
  const store = createDemoSessionStore({ storage, now: () => now });
  const first = store.startEntry('breakfast-entry');
  const makeJob = (entry, imageKey) => ({ ...createCapture({ source: 'gallery', theme: 'science', portion: 1, notes: '', delay: 20000,
    photos: [{ id: `${entry.id}-photo`, imageKey, source: 'gallery' }] }, now), id: entry.id });
  const breakfast = makeJob(first, 'breakfast');
  now += 120000;
  const second = store.startEntry('chicken-entry');
  assert.equal(store.replaceJobs([breakfast, makeJob(second, 'chicken')]), true);
  const before = store.getSnapshot().session;
  assert.ok(before.jobs.every(job => job.result === null));
  assert.equal(store.completeAnalysis(), true);
  const completed = store.getSnapshot().session;
  assert.deepEqual(completed.jobs.map(job => job.result.name), ['Овсянка с ягодами', 'Курица с картофелем']);
  assert.deepEqual(completed.jobs.map(job => [job.id, job.createdAt, job.dayKey]), before.jobs.map(job => [job.id, job.createdAt, job.dayKey]));
  assert.ok(completed.jobs.every(job => !job.seen && job.result.assessment));
  assert.deepEqual(completed.rewardEvents, before.rewardEvents);
  assert.deepEqual(completed.creditedDays, before.creditedDays);
  assert.deepEqual(completed.regularity, before.regularity);
  assert.deepEqual(completed.inventory, before.inventory);
  assert.deepEqual(dailyCampContributions(captureDay(completed.jobs, new Date(first.firstPhotoAt)).meals), { protein: false, carbs: true, fats: false, plants: true });
  assert.deepEqual(dailyCampContributions(captureDay(completed.jobs, new Date(second.firstPhotoAt)).meals), { protein: true, carbs: false, fats: false, plants: false });
  const reloaded = createDemoSessionStore({ storage, now: () => now });
  assert.deepEqual(reloaded.getSnapshot().session, completed);
  reloaded.completeAnalysis();
  reloaded.tick();
  assert.deepEqual(reloaded.getSnapshot().session, completed);
});

test('failed manual or timed analysis leaves the prior persisted jobs available for retry', () => {
  const db = memoryStorage();
  let fail = false;
  const storage = { getItem: db.getItem, setItem: (key, value) => { if (fail) throw new Error('quota'); db.setItem(key, value); } };
  let now = new Date(2026, 9, 29, 12).getTime();
  const store = createDemoSessionStore({ storage, now: () => now });
  const entry = store.startEntry('pending');
  store.replaceJobs([{ ...capture(now), id: entry.id }]);
  const before = store.getSnapshot().session;
  const saved = storage.getItem(DEMO_STORAGE_KEY);
  fail = true;
  assert.equal(store.completeAnalysis(), false);
  assert.strictEqual(store.getSnapshot().session, before);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);
  now += 20000;
  store.tick();
  assert.strictEqual(store.getSnapshot().session, before);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);
  fail = false;
  store.tick();
  const completed = store.getSnapshot().session;
  assert.equal(completed.jobs[0].status, 'ready');
  assert.ok(completed.jobs[0].result.assessment);
  assert.deepEqual(completed.rewardEvents, before.rewardEvents);
  assert.equal(completed.inventory.coins, before.inventory.coins);
  assert.deepEqual(createDemoSessionStore({ storage, now: () => now }).getSnapshot().session, completed);
});
