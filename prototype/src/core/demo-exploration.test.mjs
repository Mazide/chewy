import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapture, localDayKey } from './capture-session.js';
import { createDemoSession, createDemoSessionStore, DEMO_STORAGE_KEY, validateDemoSession } from './demo-session.js';
import { createExplorationStudy, EXPLORATION_DEMO } from './exploration-study.js';

const backupKey = `${DEMO_STORAGE_KEY}.before-exploration-v1`;
const now = () => new Date(2026, 9, 29, 12).getTime();
const interval = EXPLORATION_DEMO.progressPerDiscovery;
const flush = () => new Promise(resolve => setImmediate(resolve));
const memoryStorage = () => {
  const data = new Map();
  const writes = [];
  return { writes, getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { writes.push({ key, value }); data.set(key, value); } };
};
const controlledLocks = () => {
  const requests = [];
  return {
    request: (_key, _options, callback) => new Promise(resolve => requests.push(() => resolve(callback({ mode: 'exclusive' })))),
    grant: async () => { requests.shift()(); await flush(); },
  };
};
function legacySession() {
  const store = createDemoSessionStore({ now });
  const entry = store.startEntry('legacy-photo');
  const job = createCapture({ source: 'camera', theme: 'science', portion: 1, notes: 'Legacy notes', delay: 20000 }, now());
  store.replaceJobs([{ ...job, id: entry.id }]);
  store.setInventory({ coins: 17, owned: ['flowers', 'legacy-pet'], applied: { garden: 'flowers', pet: 'legacy-pet' } });
  const { exploration, ...legacy } = store.getSnapshot().session;
  return { ...legacy, version: 1 };
}
const read = store => store.getSnapshot().session;
const earn = (store, kind = 'steps', amount = interval) => store.observeActivity({ kind, amount });

test('valid v1 save migrates once with its exact raw backup before v2 and preserves all old data', () => {
  const storage = memoryStorage();
  const legacy = legacySession();
  const raw = `${JSON.stringify(legacy, null, 2)}\n`;
  storage.setItem(DEMO_STORAGE_KEY, raw);
  const writesBefore = storage.writes.length;
  const store = createDemoSessionStore({ storage, now });
  assert.equal(store.getSnapshot().error, '');
  assert.equal(read(store).version, 2);
  assert.deepEqual(read(store).exploration, createExplorationStudy());
  const { exploration, version, ...preserved } = read(store);
  const { version: legacyVersion, ...expected } = legacy;
  assert.deepEqual(preserved, expected);
  assert.equal(storage.getItem(backupKey), raw);
  assert.deepEqual(storage.writes.slice(writesBefore).map(write => write.key), [backupKey, DEMO_STORAGE_KEY]);
  const count = storage.writes.length;
  assert.deepEqual(read(createDemoSessionStore({ storage, now })), read(store));
  assert.equal(storage.writes.length, count);
  assert.equal(storage.getItem(backupKey), raw);
});

test('v1 initial fixtures normalize without storage and the source fixture stays unchanged', () => {
  const legacy = legacySession();
  const before = JSON.stringify(legacy);
  const store = createDemoSessionStore({ initialSession: legacy, now });
  assert.equal(read(store).version, 2);
  assert.deepEqual(read(store).exploration, createExplorationStudy());
  assert.equal(JSON.stringify(legacy), before);
  assert.equal(store.selectExplorationRoute('brook'), true);
  assert.equal(earn(store), true);
  assert.deepEqual(read(store).exploration.found, ['hat-bucket']);
});

test('corrupt, unsupported and inconsistent saves stay untouched and never create a backup', () => {
  const legacy = legacySession();
  for (const raw of ['', 'null', '{broken', JSON.stringify({ ...legacy, version: 99 }),
    JSON.stringify({ ...legacy, inventory: { coins: -1, owned: [], applied: {} } }),
    JSON.stringify({ ...createDemoSession(), exploration: { ...createExplorationStudy(), found: ['hat-bucket'] } }),
  ]) {
    const storage = memoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, raw);
    const store = createDemoSessionStore({ storage, now });
    assert.ok(store.getSnapshot().error);
    assert.equal(store.selectExplorationRoute('brook'), false);
    assert.equal(earn(store), false);
    assert.equal(store.applyHeadwear('hat-bucket'), false);
    assert.equal(store.markExplorationSeen(), false);
    assert.equal(storage.getItem(DEMO_STORAGE_KEY), raw);
    assert.equal(storage.getItem(backupKey), null);
  }
});

test('migration write failures keep v1 intact and retry uses its existing exact backup', () => {
  for (const failedKey of [backupKey, DEMO_STORAGE_KEY]) {
    const db = memoryStorage();
    const raw = JSON.stringify(legacySession());
    db.setItem(DEMO_STORAGE_KEY, raw);
    let fail = true;
    const storage = { getItem: db.getItem, setItem: (key, value) => {
      if (fail && key === failedKey) throw new Error('quota');
      db.setItem(key, value);
    } };
    const failed = createDemoSessionStore({ storage, now });
    assert.ok(failed.getSnapshot().error);
    assert.deepEqual(read(failed), createDemoSession());
    assert.equal(storage.getItem(DEMO_STORAGE_KEY), raw);
    assert.equal(storage.getItem(backupKey), failedKey === backupKey ? null : raw);
    assert.equal(failed.selectExplorationRoute('brook'), false);
    fail = false;
    const retried = createDemoSessionStore({ storage, now });
    assert.equal(retried.getSnapshot().error, '');
    assert.equal(read(retried).version, 2);
    assert.equal(storage.getItem(backupKey), raw);
    assert.equal(db.writes.filter(write => write.key === backupKey).length, 1);
  }
});

test('a different preexisting backup blocks migration without overwriting either save', () => {
  const storage = memoryStorage();
  const raw = JSON.stringify(legacySession());
  storage.setItem(DEMO_STORAGE_KEY, raw);
  storage.setItem(backupKey, 'previous recoverable save');
  const count = storage.writes.length;
  const store = createDemoSessionStore({ storage, now });
  assert.ok(store.getSnapshot().error);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), raw);
  assert.equal(storage.getItem(backupKey), 'previous recoverable save');
  assert.equal(storage.writes.length, count);
});

test('migration and all exploration mutations wait for ownership and reload before taking over', async () => {
  const storage = memoryStorage();
  const raw = JSON.stringify(legacySession());
  storage.setItem(DEMO_STORAGE_KEY, raw);
  const lockManager = controlledLocks();
  const a = createDemoSessionStore({ storage, lockManager, now });
  const releaseA = a.connectAccess();
  assert.equal(storage.getItem(backupKey), null);
  assert.equal(a.selectExplorationRoute('brook'), false);
  assert.equal(earn(a), false);
  assert.equal(a.applyHeadwear(null), false);
  assert.equal(a.markExplorationSeen(), false);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), raw);
  await lockManager.grant();
  assert.equal(storage.getItem(backupKey), raw);
  const b = createDemoSessionStore({ storage, lockManager, now });
  const releaseB = b.connectAccess();
  assert.equal(a.selectExplorationRoute('brook'), true);
  assert.equal(earn(a), true);
  assert.equal(a.applyHeadwear('hat-bucket'), true);
  assert.equal(b.selectExplorationRoute('pines'), false);
  const earned = read(a);
  releaseA();
  assert.equal(a.markExplorationSeen(), false);
  await lockManager.grant();
  assert.deepEqual(read(b), earned);
  assert.equal(b.markExplorationSeen(), true);
  assert.deepEqual(read(b).exploration.seenFindings, ['hat-bucket']);
  releaseB();
  await flush();
});

test('missing locks and stale unmanaged stores cannot write exploration changes', async () => {
  const storage = memoryStorage();
  const missing = createDemoSessionStore({ storage, lockManager: null, now });
  const release = missing.connectAccess();
  assert.equal(missing.selectExplorationRoute('brook'), false);
  assert.equal(earn(missing), false);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), null);
  release();
  const first = createDemoSessionStore({ storage, now });
  const stale = createDemoSessionStore({ storage, now });
  assert.equal(first.selectExplorationRoute('brook'), true);
  assert.equal(earn(first), true);
  const raw = storage.getItem(DEMO_STORAGE_KEY);
  assert.equal(stale.selectExplorationRoute('pines'), false);
  assert.equal(earn(stale), false);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), raw);
  await flush();
});

test('activity grants hats atomically once without changing food, coins, history or selected garden', () => {
  const storage = memoryStorage();
  const store = createDemoSessionStore({ storage, initialSession: { ...createDemoSession(),
    inventory: { coins: 17, owned: ['flowers'], applied: { garden: 'flowers' } } }, now });
  store.startEntry('food');
  const before = read(store);
  assert.equal(store.selectExplorationRoute('brook'), true);
  assert.equal(earn(store, 'cycling', 20), true);
  const found = read(store);
  assert.deepEqual(found.exploration.found, ['hat-bucket']);
  assert.deepEqual(found.inventory.owned, ['flowers', 'hat-bucket']);
  assert.equal(found.inventory.coins, before.inventory.coins);
  assert.deepEqual(found.inventory.applied, before.inventory.applied);
  for (const field of ['entries', 'jobs', 'rewardEvents', 'creditedDays', 'regularity', 'lastSeenAt']) assert.deepEqual(found[field], before[field]);
  const writes = storage.writes.length;
  assert.equal(earn(store, 'cycling', 20), true);
  assert.equal(storage.writes.length, writes);
  assert.equal(earn(store, 'steps', interval), true);
  assert.equal(read(store).inventory.owned.filter(id => id === 'hat-bucket').length, 1);
  assert.deepEqual(read(createDemoSessionStore({ storage, now })), read(store));
});

test('failed selection, grant, wear and notice writes leave all prior state available for retry', () => {
  const db = memoryStorage();
  let fail = false;
  const storage = { getItem: db.getItem, setItem: (key, value) => {
    if (fail) throw new Error('quota');
    db.setItem(key, value);
  } };
  const store = createDemoSessionStore({ storage, now });
  const rejectThenRetry = action => {
    const before = read(store);
    const raw = storage.getItem(DEMO_STORAGE_KEY);
    fail = true;
    assert.equal(action(), false);
    assert.strictEqual(read(store), before);
    assert.equal(storage.getItem(DEMO_STORAGE_KEY), raw);
    fail = false;
    assert.equal(action(), true);
    assert.equal(store.getSnapshot().error, '');
  };
  rejectThenRetry(() => store.selectExplorationRoute('brook'));
  rejectThenRetry(() => earn(store));
  rejectThenRetry(() => store.applyHeadwear('hat-bucket'));
  rejectThenRetry(() => store.markExplorationSeen());
  assert.deepEqual(read(store).exploration.found, ['hat-bucket']);
  assert.deepEqual(read(store).inventory.owned, ['hat-bucket']);
});

test('two hats can be earned, worn and removed without losing ownership or garden purchases', () => {
  const store = createDemoSessionStore({ now });
  assert.equal(store.applyHeadwear('hat-bucket'), false);
  assert.equal(store.applyHeadwear('unknown'), false);
  assert.equal(store.applyHeadwear(undefined), false);
  store.selectExplorationRoute('brook');
  earn(store);
  assert.equal(store.applyHeadwear('hat-bucket'), true);
  assert.equal(store.applyHeadwear('hat-trail'), false);
  store.selectExplorationRoute('pines');
  earn(store, 'steps', interval * 2);
  assert.equal(store.applyHeadwear('hat-trail'), true);
  assert.equal(read(store).inventory.applied.headwear, 'hat-trail');
  assert.equal(store.applyHeadwear(null), true);
  assert.equal(read(store).inventory.applied.headwear, null);
  assert.deepEqual(read(store).inventory.owned, ['hat-bucket', 'hat-trail']);
  store.selectExplorationRoute('brook');
  earn(store, 'steps', interval * 3);
  assert.deepEqual(read(store).inventory.owned, ['hat-bucket', 'hat-trail']);
});

test('route origin and progress survive new days and camp moves while notices track both finds', () => {
  const storage = memoryStorage();
  const store = createDemoSessionStore({ storage, now });
  store.startEntry('first-photo');
  store.selectExplorationRoute('brook');
  earn(store, 'steps', 500);
  store.advanceDays(1);
  store.startEntry('second-photo');
  earn(store, 'cycling', 5);
  assert.equal(read(store).exploration.progress.brook, 1000);
  assert.equal(read(store).exploration.originStops.brook, 1);
  store.selectExplorationRoute('pines');
  assert.equal(read(store).exploration.originStops.pines, 2);
  store.selectExplorationRoute('brook');
  earn(store, 'cycling', 15);
  assert.deepEqual(read(store).exploration.found, ['hat-bucket']);
  assert.equal(store.markExplorationSeen(), true);
  assert.deepEqual(read(store).exploration.seenFindings, ['hat-bucket']);
  store.selectExplorationRoute('pines');
  store.advanceDays(1);
  earn(store, 'swimming', 20);
  assert.deepEqual(read(store).exploration.seenFindings, ['hat-bucket']);
  assert.deepEqual(read(store).exploration.found, ['hat-bucket', 'hat-trail']);
  assert.deepEqual(read(store).exploration.originStops, { brook: 1, pines: 2 });
  assert.equal(store.markExplorationSeen(), true);
  assert.deepEqual(read(store).exploration.seenFindings, ['hat-bucket', 'hat-trail']);
  assert.deepEqual(read(createDemoSessionStore({ storage, now })), read(store));
});

test('invalid activities and invalid inventory relationships cannot write an inconsistent session', () => {
  const storage = memoryStorage();
  const store = createDemoSessionStore({ storage, now });
  for (const sample of [null, {}, { kind: 'unknown', amount: 20 }, { kind: 'steps', amount: -1 },
    { kind: 'cycling', amount: 0.5 }, { kind: 'swimming', amount: Number.MAX_SAFE_INTEGER }]) {
    assert.equal(store.observeActivity(sample), false);
  }
  assert.equal(store.selectExplorationRoute('unknown'), false);
  store.selectExplorationRoute('brook');
  earn(store);
  const before = read(store);
  assert.equal(store.setInventory({ coins: 0, owned: [], applied: {} }), false);
  assert.strictEqual(read(store), before);
  assert.throws(() => validateDemoSession({ ...before, inventory: { coins: 0, owned: ['hat-bucket', 'unknown'], applied: { headwear: 'unknown' } } }));
  assert.throws(() => validateDemoSession({ ...before, inventory: { coins: 0, owned: ['hat-bucket'], applied: { headwear: 'hat-trail' } } }));
});

test('reset clears exploration and hats without restoring the archived pre-migration session', () => {
  const storage = memoryStorage();
  const raw = JSON.stringify(legacySession());
  storage.setItem(DEMO_STORAGE_KEY, raw);
  const store = createDemoSessionStore({ storage, now });
  store.selectExplorationRoute('brook');
  earn(store);
  store.applyHeadwear('hat-bucket');
  store.markExplorationSeen();
  const dayKey = localDayKey(store.now());
  assert.ok(read(store).exploration.activityPeaks[dayKey]);
  assert.equal(store.reset(), true);
  assert.deepEqual(read(store), createDemoSession());
  assert.deepEqual(read(createDemoSessionStore({ storage, now, migrateLegacy: true })), createDemoSession());
  assert.equal(storage.getItem(backupKey), raw);
});
