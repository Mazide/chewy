import test from 'node:test';
import assert from 'node:assert/strict';
import { captureDay, completeDueCaptures, createCapture, reviseCapture } from './capture-session.js';
import { createDemoSession, createDemoSessionStore, DEMO_STORAGE_KEY, sessionJourneyStep, sessionWithJobs } from './demo-session.js';
import { formatJourneyDay, sessionJourneyHistory } from './journey-history.js';
import { JOURNEY_STOPS, journeyBiome } from './journey-world.js';
import { gardenAppearance } from './demo-inventory.js';

const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
const capture = (dayKey, imageKey = 'meal') => ({
  ...createCapture({ source: 'gallery', theme: 'science', portion: 1, notes: '', delay: 20000,
    photos: [{ id: `${dayKey}-${imageKey}`, imageKey, source: 'gallery' }] }, new Date(`${dayKey}T12:00:00Z`).getTime()),
  dayKey,
});
const readyCapture = (dayKey, imageKey) => completeDueCaptures([capture(dayKey, imageKey)], Infinity)[0];
const withJobs = (jobs, creditedDays = []) => ({ ...sessionWithJobs(createDemoSession(), jobs), creditedDays });

test('empty session has no invented history and first photo is a day before submission', () => {
  assert.deepEqual(sessionJourneyHistory(createDemoSession()), []);
  const store = createDemoSessionStore({ now: () => new Date(2026, 9, 29, 12).getTime() });
  const entry = store.startEntry('unsent-photo');
  assert.deepEqual(sessionJourneyHistory(store.getSnapshot().session), [{
    dayKey: entry.dayKey, stopIndex: 1, credited: true, meals: [], jobs: [],
  }]);
});

test('one history row holds several entries of a day and leaves gaps absent', () => {
  const breakfast = readyCapture('2026-10-29', 'breakfast');
  const dinner = readyCapture('2026-10-29', 'chicken');
  const earlier = readyCapture('2026-10-24');
  const pending = capture('2026-10-29');
  const session = withJobs([breakfast, earlier, dinner, pending], ['2026-10-29', '2026-10-24']);
  const history = sessionJourneyHistory(session);
  assert.deepEqual(history.map(row => row.dayKey), ['2026-10-29', '2026-10-24']);
  assert.deepEqual(history.map(row => row.stopIndex), [2, 1]);
  assert.equal(history[0].jobs.length, 3);
  assert.deepEqual(history[0].meals.map(meal => meal.name), ['Овсянка с ягодами', 'Курица с картофелем']);
  assert.equal(history[1].meals.length, 1);
  assert.ok(history.every(row => row.credited));
});

test('legacy dates join the earned route without retroactive reward or advancement', () => {
  const before = readyCapture('2026-10-21');
  const between = readyCapture('2026-10-25');
  const after = readyCapture('2026-10-30');
  const session = withJobs([before, between, after], ['2026-10-24', '2026-10-29']);
  const snapshot = JSON.stringify(session);
  assert.deepEqual(sessionJourneyHistory(session).map(({ dayKey, stopIndex, credited }) => ({ dayKey, stopIndex, credited })), [
    { dayKey: '2026-10-30', stopIndex: 2, credited: false },
    { dayKey: '2026-10-29', stopIndex: 2, credited: true },
    { dayKey: '2026-10-25', stopIndex: 1, credited: false },
    { dayKey: '2026-10-24', stopIndex: 1, credited: true },
    { dayKey: '2026-10-21', stopIndex: 0, credited: false },
  ]);
  assert.equal(sessionJourneyStep(session), 2);
  assert.equal(JSON.stringify(session), snapshot);
});

test('pending revision retains the saved answer in its original day without completing on view', () => {
  const old = readyCapture('2026-10-27', 'chicken');
  old.result.assessment.reason = 'Ответ, сохранённый до уточнения.';
  const revised = reviseCapture(old, { dishName: 'Овсянка с ягодами', notes: '', portion: 1,
    photos: [{ id: 'replacement', imageKey: 'breakfast', source: 'gallery' }] }, 20000, new Date('2026-10-29T12:00:00Z').getTime());
  const session = withJobs([revised], ['2026-10-27']);
  const before = JSON.stringify(session);
  const [row] = sessionJourneyHistory(session);
  assert.equal(row.dayKey, '2026-10-27');
  assert.equal(row.jobs[0].status, 'processing');
  assert.equal(row.meals[0].name, old.result.name);
  assert.equal(row.meals[0].imageKey, 'chicken');
  assert.strictEqual(row.meals[0].assessment, old.result.assessment);
  assert.equal(row.meals[0].assessment.reason, 'Ответ, сохранённый до уточнения.');
  assert.equal(JSON.stringify(session), before);
  const [completed] = sessionJourneyHistory({ ...session, jobs: completeDueCaptures(session.jobs, Infinity) });
  assert.equal(completed.dayKey, row.dayKey);
  assert.equal(completed.meals.length, 1);
  assert.equal(completed.meals[0].name, 'Овсянка с ягодами');
});

test('history keeps every earned day after the finite map reaches its last stop', () => {
  const store = createDemoSessionStore({ now: () => new Date(2026, 9, 1, 12).getTime() });
  const days = JOURNEY_STOPS.length + 7;
  for (let index = 0; index < days; index++) {
    store.startEntry(`day-${index}`);
    store.advanceDays(1);
  }
  const session = store.getSnapshot().session;
  const history = sessionJourneyHistory(session);
  assert.equal(sessionJourneyStep(session), days);
  assert.equal(history.length, days);
  assert.equal(history[0].stopIndex, JOURNEY_STOPS.length - 1);
  assert.equal(history.at(-1).stopIndex, 1);
  assert.equal(new Set(history.map(row => row.dayKey)).size, days);
  assert.equal(history.filter(row => row.stopIndex === JOURNEY_STOPS.length - 1).length,
    days - (JOURNEY_STOPS.length - 1) + 1);
});

test('fixed date queries and Russian labels do not shift with the viewing time zone', () => {
  const originalTZ = process.env.TZ;
  const job = { ...readyCapture('2026-10-29'), createdAt: new Date('2026-10-28T23:30:00Z').getTime() };
  try {
    for (const timeZone of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
      process.env.TZ = timeZone;
      assert.equal(captureDay([job], '2026-10-29').meals.length, 1);
      assert.equal(captureDay([job], '2026-10-28').meals.length, 0);
      assert.deepEqual(sessionJourneyHistory(withJobs([job])).map(row => row.dayKey), ['2026-10-29']);
      assert.equal(formatJourneyDay('2026-10-29'), '29 октября 2026 г.');
      assert.equal(formatJourneyDay('2027-01-01'), '1 января 2027 г.');
    }
  } finally {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  }
});

test('viewing and reloading history preserve rewards and purchased appearance across a biome transition', () => {
  const storage = memoryStorage();
  const now = () => new Date(2026, 9, 29, 12).getTime();
  const store = createDemoSessionStore({ storage, now });
  const firstEntry = store.startEntry('first');
  store.replaceJobs([{ ...capture(firstEntry.dayKey), id: firstEntry.id }]);
  store.completeAnalysis();
  assert.equal(store.purchaseAppearance('flowers'), true);
  assert.equal(store.applyAppearance('flowers'), true);
  const firstBiome = journeyBiome(sessionJourneyStep(store.getSnapshot().session));
  for (const id of ['second', 'third']) { store.advanceDays(1); store.startEntry(id); }
  const earned = store.getSnapshot().session;
  assert.notEqual(journeyBiome(sessionJourneyStep(earned)), firstBiome);
  assert.equal(gardenAppearance(earned.inventory), 'flowers');
  const saved = storage.getItem(DEMO_STORAGE_KEY);
  const history = sessionJourneyHistory(earned);
  for (let index = 0; index < 3; index++) assert.deepEqual(sessionJourneyHistory(earned), history);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), saved);
  assert.equal(history.at(-1).meals.length, 1);

  const reloaded = createDemoSessionStore({ storage, now });
  assert.deepEqual(reloaded.getSnapshot().session, earned);
  assert.deepEqual(sessionJourneyHistory(reloaded.getSnapshot().session), history);
  assert.equal(reloaded.now(), store.now());
  assert.equal(gardenAppearance(reloaded.getSnapshot().session.inventory), 'flowers');
  assert.equal(reloaded.getSnapshot().session.rewardEvents.length, 3);
  assert.equal(sessionJourneyStep(reloaded.getSnapshot().session), 3);
});
