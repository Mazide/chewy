import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_GARDEN_ITEMS, applyGardenAppearance, buyGardenAppearance, gardenAppearance, ownsGardenAppearance } from './demo-inventory.js';
import { createDemoSession, createDemoSessionStore, DEMO_STORAGE_KEY } from './demo-session.js';

const price = id => DEMO_GARDEN_ITEMS.find(item => item.id === id).cost;
const inventory = coins => ({ coins, owned: [], applied: {} });
const memoryStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('base is always available, and unowned or unknown items cannot be applied', () => {
  const empty = inventory(0);
  assert.equal(gardenAppearance(empty), 'garden-base');
  assert.equal(ownsGardenAppearance(empty, 'garden-base'), true);
  assert.equal(ownsGardenAppearance(empty, 'flowers'), false);
  assert.equal(ownsGardenAppearance(empty, 'unknown'), false);
  assert.strictEqual(applyGardenAppearance(empty, 'garden-base'), empty);
  assert.strictEqual(applyGardenAppearance(empty, 'flowers'), empty);
  assert.strictEqual(applyGardenAppearance(empty, 'unknown'), empty);
  assert.strictEqual(buyGardenAppearance(empty, 'garden-base'), empty);
  assert.strictEqual(buyGardenAppearance(empty, 'unknown'), empty);
});

test('purchase deducts the exact cost once and retains the applied appearance', () => {
  const before = {
    coins: price('flowers') + price('garden-lush'),
    owned: ['legacy-theme'],
    applied: { theme: 'legacy-theme' },
  };
  Object.freeze(before.owned);
  Object.freeze(before.applied);
  Object.freeze(before);
  const bought = buyGardenAppearance(before, 'flowers');
  assert.equal(bought.coins, price('garden-lush'));
  assert.deepEqual(bought.owned, ['legacy-theme', 'flowers']);
  assert.strictEqual(bought.applied, before.applied);
  assert.equal(gardenAppearance(bought), 'garden-base');
  assert.strictEqual(buyGardenAppearance(bought, 'flowers'), bought);
  const second = buyGardenAppearance(bought, 'garden-lush');
  assert.equal(second.coins, 0);
  assert.deepEqual(second.owned, ['legacy-theme', 'flowers', 'garden-lush']);
  assert.equal(gardenAppearance(second), 'garden-base');
});

test('insufficient funds change neither coins nor ownership nor appearance', () => {
  const before = { coins: price('garden-bloom') - 1, owned: ['flowers'], applied: { garden: 'flowers' } };
  assert.strictEqual(buyGardenAppearance(before, 'garden-bloom'), before);
  assert.strictEqual(applyGardenAppearance(before, 'garden-bloom'), before);
  assert.equal(gardenAppearance(before), 'flowers');
});

test('one garden slot can switch between owned appearances and the free base without losing items', () => {
  const before = { coins: 17, owned: ['flowers', 'garden-lush', 'legacy-theme'], applied: { garden: 'flowers', theme: 'legacy-theme' } };
  const applied = applyGardenAppearance(before, 'garden-lush');
  assert.equal(gardenAppearance(applied), 'garden-lush');
  assert.deepEqual(applied.applied, { garden: 'garden-lush', theme: 'legacy-theme' });
  assert.strictEqual(applied.owned, before.owned);
  assert.equal(applied.coins, before.coins);
  assert.strictEqual(applyGardenAppearance(applied, 'garden-lush'), applied);
  const base = applyGardenAppearance(applied, 'garden-base');
  assert.equal(base.applied.garden, null);
  assert.equal(gardenAppearance(base), 'garden-base');
  assert.strictEqual(base.owned, before.owned);
  assert.equal(gardenAppearance(applyGardenAppearance(base, 'flowers')), 'flowers');
});

test('legacy flowers remain selected until an explicit garden selection overrides them', () => {
  const legacy = { coins: 3, owned: ['flowers', 'legacy-theme'], applied: { decor: 'flowers', theme: 'legacy-theme' } };
  assert.equal(gardenAppearance(legacy), 'flowers');
  assert.equal(ownsGardenAppearance(legacy, 'flowers'), true);
  assert.strictEqual(applyGardenAppearance(legacy, 'flowers'), legacy);
  assert.strictEqual(buyGardenAppearance(legacy, 'flowers'), legacy);
  const base = applyGardenAppearance(legacy, 'garden-base');
  assert.deepEqual(base.applied, { decor: 'flowers', theme: 'legacy-theme', garden: null });
  assert.equal(gardenAppearance(base), 'garden-base');
  assert.deepEqual(base.owned, legacy.owned);
  assert.deepEqual(legacy.applied, { decor: 'flowers', theme: 'legacy-theme' });
});

test('store rejects unavailable actions, and duplicate purchase or apply never writes twice', () => {
  const db = memoryStorage();
  let writes = 0;
  const storage = { getItem: db.getItem, setItem: (key, value) => { writes++; db.setItem(key, value); } };
  const store = createDemoSessionStore({ storage, initialSession: { ...createDemoSession(), inventory: inventory(price('flowers')) } });
  const before = store.getSnapshot().session;
  const initialWrites = writes;
  assert.equal(store.purchaseAppearance('unknown'), false);
  assert.equal(store.purchaseAppearance('garden-bloom'), false);
  assert.equal(store.applyAppearance('flowers'), false);
  assert.equal(store.applyAppearance('unknown'), false);
  assert.equal(store.purchaseAppearance('garden-base'), true);
  assert.equal(store.applyAppearance('garden-base'), true);
  assert.strictEqual(store.getSnapshot().session, before);
  assert.equal(writes, initialWrites);

  assert.equal(store.purchaseAppearance('flowers'), true);
  assert.equal(store.getSnapshot().session.inventory.coins, 0);
  assert.equal(gardenAppearance(store.getSnapshot().session.inventory), 'garden-base');
  assert.equal(store.purchaseAppearance('flowers'), true);
  assert.equal(writes, initialWrites + 1);
  assert.equal(store.applyAppearance('flowers'), true);
  assert.equal(store.applyAppearance('flowers'), true);
  assert.equal(writes, initialWrites + 2);
  assert.equal(store.applyAppearance('garden-base'), true);
  assert.equal(store.applyAppearance('garden-base'), true);
  assert.equal(writes, initialWrites + 3);
  assert.deepEqual(store.getSnapshot().session.entries, []);
  assert.deepEqual(store.getSnapshot().session.rewardEvents, []);
});

test('failed purchases and applications remain atomic, then retry and reload preserve them', () => {
  const db = memoryStorage();
  let fail = false;
  const storage = { getItem: db.getItem, setItem: (key, value) => { if (fail) throw new Error('quota'); db.setItem(key, value); } };
  const initialSession = { ...createDemoSession(), inventory: {
    coins: price('flowers'), owned: ['legacy-theme'], applied: { theme: 'legacy-theme' },
  } };
  const store = createDemoSessionStore({ storage, initialSession });
  const original = store.getSnapshot().session;
  const originalSave = storage.getItem(DEMO_STORAGE_KEY);
  fail = true;
  assert.equal(store.purchaseAppearance('flowers'), false);
  assert.strictEqual(store.getSnapshot().session, original);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), originalSave);
  assert.ok(store.getSnapshot().error);

  fail = false;
  assert.equal(store.purchaseAppearance('flowers'), true);
  assert.equal(store.getSnapshot().error, '');
  const bought = store.getSnapshot().session;
  assert.equal(bought.inventory.coins, 0);
  assert.deepEqual(bought.inventory.owned, ['legacy-theme', 'flowers']);
  const boughtSave = storage.getItem(DEMO_STORAGE_KEY);
  fail = true;
  assert.equal(store.applyAppearance('flowers'), false);
  assert.strictEqual(store.getSnapshot().session, bought);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), boughtSave);
  fail = false;
  assert.equal(store.applyAppearance('flowers'), true);
  assert.equal(store.getSnapshot().error, '');
  const reloaded = createDemoSessionStore({ storage });
  assert.deepEqual(reloaded.getSnapshot().session, store.getSnapshot().session);
  assert.equal(gardenAppearance(reloaded.getSnapshot().session.inventory), 'flowers');
  assert.equal(reloaded.purchaseAppearance('flowers'), true);
  assert.equal(reloaded.getSnapshot().session.inventory.coins, 0);
  assert.equal(reloaded.applyAppearance('garden-base'), true);
  assert.equal(gardenAppearance(createDemoSessionStore({ storage }).getSnapshot().session.inventory), 'garden-base');
});

test('unreadable saves block inventory mutations instead of replacing saved data', () => {
  const storage = memoryStorage();
  storage.setItem(DEMO_STORAGE_KEY, '{broken');
  const store = createDemoSessionStore({ storage });
  assert.equal(store.purchaseAppearance('flowers'), false);
  assert.equal(store.purchaseAppearance('garden-base'), false);
  assert.equal(store.applyAppearance('garden-base'), false);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), '{broken');
});
