import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE_STORAGE_KEY, createCapture } from './capture-session.js';
import { createDemoSessionStore, DEMO_STORAGE_KEY } from './demo-session.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
// Ownership scheduling itself is tested in demo-session-access.test.mjs and in
// the real browser. These grants isolate the store's access boundaries.
const controlledLocks = () => {
  const requests = [];
  return {
    request: (_key, _options, callback) => new Promise(resolve => {
      requests.push(() => resolve(callback({ mode: 'exclusive' })));
    }),
    grant: async () => { requests.shift()(); await flush(); },
  };
};
const gameState = ({ lastSeenAt, ...session }) => session;

test('initialization and legacy migration wait for ownership, as do all mutations', async () => {
  const storage = memoryStorage();
  const lockManager = controlledLocks();
  const now = () => new Date(2026, 9, 29, 12).getTime();
  const job = createCapture({ source: 'camera', theme: 'science', portion: 1, notes: '', delay: 20000 }, now());
  const legacy = JSON.stringify({ version: 1, jobs: [job] });
  storage.setItem(CAPTURE_STORAGE_KEY, legacy);
  const store = createDemoSessionStore({ storage, lockManager, migrateLegacy: true, now });
  const release = store.connectAccess();
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), null);
  assert.equal(store.enter(), false);
  assert.equal(store.startEntry('blocked-photo'), false);
  assert.equal(store.replaceJobs([]), false);
  assert.equal(store.setInventory({ coins: 100, owned: [], applied: {} }), false);
  assert.equal(store.purchaseAppearance('flowers'), false);
  assert.equal(store.applyAppearance('garden-base'), false);
  assert.equal(store.completeAnalysis(), false);
  assert.equal(store.advanceDays(1), false);
  assert.equal(store.reset(), false);
  store.tick(); store.reactToPhoto();
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), null);
  assert.equal(storage.getItem(`${DEMO_STORAGE_KEY}.clock`), null);
  await lockManager.grant();
  assert.equal(store.getSnapshot().error, '');
  assert.equal(store.getSnapshot().session.jobs[0].id, job.id);
  assert.deepEqual(store.getSnapshot().session.rewardEvents, []);
  assert.equal(storage.getItem(CAPTURE_STORAGE_KEY), legacy);
  assert.ok(store.startEntry('owned-photo'));
  const saved = storage.getItem(DEMO_STORAGE_KEY);
  release();
  assert.equal(store.startEntry('released-photo'), false);
  assert.equal(store.reset(), false);
  assert.equal(store.leave(), false);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);
  await flush();
});

test('waiting store cannot overwrite progress and reloads session and clock on takeover', async () => {
  const storage = memoryStorage();
  const lockManager = controlledLocks();
  const now = () => new Date(2026, 9, 29, 12).getTime();
  const a = createDemoSessionStore({ storage, lockManager, now });
  const stopA = a.connectAccess(() => a.enter());
  await lockManager.grant();
  const b = createDemoSessionStore({ storage, lockManager, now });
  const stopB = b.connectAccess(() => b.enter());
  const entry = a.startEntry('a');
  const job = createCapture({ source: 'camera', theme: 'science', portion: 1, notes: '', delay: 20000 }, now());
  a.replaceJobs([{ ...job, id: entry.id }]);
  a.completeAnalysis();
  assert.equal(a.purchaseAppearance('flowers'), true);
  assert.equal(a.applyAppearance('flowers'), true);
  a.advanceDays(1);
  const earned = a.getSnapshot().session;
  const saved = storage.getItem(DEMO_STORAGE_KEY);
  assert.equal(b.enter(), false); assert.equal(b.leave(), false);
  assert.equal(b.startEntry('b-too-early'), false); assert.equal(b.reset(), false);
  b.tick();
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);
  a.leave(); stopA();
  await lockManager.grant();
  assert.deepEqual(gameState(b.getSnapshot().session), gameState(earned));
  assert.equal(b.now(), a.now());
  assert.ok(b.startEntry('b'));
  const after = b.getSnapshot().session;
  assert.equal(after.entries.length, 2); assert.equal(after.rewardEvents.length, 2);
  assert.equal(after.creditedDays.length, 2);
  assert.deepEqual(after.jobs, earned.jobs);
  assert.deepEqual(after.inventory.owned, ['flowers']);
  assert.deepEqual(after.inventory.applied, { garden: 'flowers' });
  assert.ok(after.inventory.coins > earned.inventory.coins);
  const latest = storage.getItem(DEMO_STORAGE_KEY);
  a.leave(); a.tick();
  assert.equal(a.reset(), false);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), latest);
  stopB(); await flush();
});

test('missing browser locks never fall back to unsynchronized writes', async () => {
  const storage = memoryStorage();
  const store = createDemoSessionStore({ storage, lockManager: null });
  const release = store.connectAccess();
  assert.match(store.getSnapshot().error, /безопасный доступ/);
  assert.equal(store.startEntry('unsafe'), false);
  assert.equal(store.reset(), false);
  assert.equal(store.advanceDays(1), false);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), null);
  release(); await flush();
});

test('an unreadable save requires ownership before explicit reset can repair it', async () => {
  const storage = memoryStorage();
  storage.setItem(DEMO_STORAGE_KEY, '{broken');
  const lockManager = controlledLocks();
  const store = createDemoSessionStore({ storage, lockManager });
  const release = store.connectAccess();
  assert.equal(store.reset(), false);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), '{broken');
  await lockManager.grant();
  assert.equal(store.startEntry(), false);
  assert.equal(store.reset(), true);
  assert.deepEqual(JSON.parse(storage.getItem(DEMO_STORAGE_KEY)).entries, []);
  release(); await flush();
});

test('stale unmanaged or external writers cannot overwrite a newer saved snapshot', () => {
  const storage = memoryStorage();
  let time = new Date(2026, 9, 29, 12).getTime();
  const now = () => time;
  const a = createDemoSessionStore({ storage, now });
  a.enter();
  time += 1000;
  const b = createDemoSessionStore({ storage, now });
  b.enter();
  // Presence is a write too. A must not continue with an outdated base.
  assert.equal(a.startEntry('stale-a'), false);
  assert.match(a.getSnapshot().error, /Перезагрузи/);
  const current = createDemoSessionStore({ storage, now });
  current.startEntry('current'); current.purchaseAppearance('flowers'); current.applyAppearance('flowers');
  const saved = storage.getItem(DEMO_STORAGE_KEY);
  assert.equal(b.leave(), false);
  assert.equal(b.reset(), false);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);
  const reloaded = createDemoSessionStore({ storage }).getSnapshot().session;
  assert.equal(reloaded.entries.length, 1);
  assert.deepEqual(reloaded.inventory.owned, ['flowers']);
  assert.deepEqual(reloaded.inventory.applied, { garden: 'flowers' });
});
