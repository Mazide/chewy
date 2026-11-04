import test from 'node:test';
import assert from 'node:assert/strict';
import { localDayKey } from './capture-session.js';
import { DEMO_REWARDS } from './demo-config.js';
import { awardPhotoEntry, effectiveMultiplier } from './demo-rewards.js';
import { createDemoSession, sessionJourneyStep } from './demo-session.js';

const at = (day, month = 9, year = 2026) => new Date(year, month, day, 12).getTime();
const entryAt = (id, time) => ({ id, firstPhotoAt: time, dayKey: localDayKey(time) });
const earn = (session, id, time) => awardPhotoEntry(session, entryAt(id, time), time);
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

test('the first photo credits its day and grows before awarding coins', () => {
  const original = freeze(createDemoSession());
  const entry = entryAt('first', at(10));
  const { session, event } = awardPhotoEntry(original, entry);
  assert.deepEqual(event, { entryId: 'first', dayKey: entry.dayKey, coins: 11,
    multiplier: 1.1, multiplierBefore: 1, grew: true });
  assert.deepEqual(session.entries, [entry]);
  assert.deepEqual(session.rewardEvents, [event]);
  assert.deepEqual(session.creditedDays, [entry.dayKey]);
  assert.deepEqual(session.regularity, { multiplier: 1.1, lastCreditedDay: entry.dayKey });
  assert.equal(session.inventory.coins, 11);
  assert.equal(sessionJourneyStep(session), 1);
  assert.deepEqual(original, createDemoSession());
});

test('extra frames, retries and revisits of one entry never award again', () => {
  const entry = entryAt('first', at(10));
  const { session } = awardPhotoEntry(createDemoSession(), entry);
  freeze(session);
  for (const now of [at(10), at(11), at(30)]) {
    const repeated = awardPhotoEntry(session, { ...entry }, now);
    assert.strictEqual(repeated.session, session);
    assert.equal(repeated.event, null);
    assert.equal(session.inventory.coins, 11);
    assert.equal(sessionJourneyStep(session), 1);
  }
  const eventOnly = { ...session, entries: [] };
  assert.deepEqual(awardPhotoEntry(eventOnly, entry), { session: eventOnly, event: null });
});

test('existing entries from the previous session version never gain retroactive awards', () => {
  const entry = entryAt('legacy', at(10));
  const original = freeze({ ...createDemoSession(), entries: [entry] });
  const result = awardPhotoEntry(original, entry, at(11));
  assert.strictEqual(result.session, original);
  assert.equal(result.event, null);
  assert.equal(original.inventory.coins, 0);
  assert.deepEqual(original.creditedDays, []);
  assert.deepEqual(original.rewardEvents, []);
});

test('every new entry earns coins, but only the first entry of each day grows and advances', () => {
  const first = earn(createDemoSession(), 'breakfast', at(10));
  const second = earn(first.session, 'lunch', at(10) + 3600000);
  assert.equal(second.event.coins, 11);
  assert.equal(second.event.multiplier, 1.1);
  assert.equal(second.event.grew, false);
  assert.equal(second.session.inventory.coins, 22);
  assert.equal(sessionJourneyStep(second.session), 1);
  const tomorrow = earn(second.session, 'next-breakfast', at(11));
  assert.equal(tomorrow.event.multiplierBefore, 1.1);
  assert.equal(tomorrow.event.multiplier, 1.2);
  assert.equal(tomorrow.event.coins, 12);
  assert.equal(tomorrow.session.inventory.coins, 34);
  assert.equal(sessionJourneyStep(tomorrow.session), 2);
  const repeatedDay = earn(tomorrow.session, 'next-lunch', at(11) + 3600000);
  assert.equal(repeatedDay.event.multiplier, 1.2);
  assert.equal(repeatedDay.event.grew, false);
  assert.equal(sessionJourneyStep(repeatedDay.session), 2);
});

test('regularity caps without floating point drift while new days keep advancing', () => {
  let session = createDemoSession();
  let event;
  for (let day = 1; day <= 25; day++) ({ session, event } = earn(session, `entry-${day}`, at(day)));
  assert.equal(session.regularity.multiplier, DEMO_REWARDS.maxMultiplier);
  assert.equal(event.multiplierBefore, DEMO_REWARDS.maxMultiplier);
  assert.equal(event.multiplier, DEMO_REWARDS.maxMultiplier);
  assert.equal(event.grew, false);
  assert.equal(event.coins, 20);
  assert.equal(sessionJourneyStep(session), 25);
});

test('absence uses grace then gradual bounded decay, independent of repeated reads', () => {
  const session = freeze({ ...createDemoSession(), creditedDays: ['2026-10-10'],
    regularity: { multiplier: 1.6, lastCreditedDay: '2026-10-10' } });
  assert.equal(effectiveMultiplier(session, at(10)), 1.6);
  assert.equal(effectiveMultiplier(session, at(11)), 1.6);
  assert.equal(effectiveMultiplier(session, at(13)), 1.6);
  assert.equal(effectiveMultiplier(session, at(14)), 1.5);
  assert.equal(effectiveMultiplier(session, at(15)), 1.4);
  for (let read = 0; read < 10; read++) assert.equal(effectiveMultiplier(session, at(15)), 1.4);
  assert.equal(effectiveMultiplier(session, at(30)), DEMO_REWARDS.baseMultiplier);
  assert.equal(effectiveMultiplier(session, at(9)), 1.6);
  assert.deepEqual(session.regularity, { multiplier: 1.6, lastCreditedDay: '2026-10-10' });
  assert.equal(effectiveMultiplier(createDemoSession(), at(30)), DEMO_REWARDS.baseMultiplier);
});

test('returning grows from the decayed multiplier and preserves previous money and progress', () => {
  const base = earn(createDemoSession(), 'old', at(10)).session;
  const original = freeze({ ...base, regularity: { multiplier: 1.8, lastCreditedDay: '2026-10-10' },
    inventory: { coins: 75, owned: ['flowers'], applied: { decor: 'flowers' } },
    record: 12 });
  const { session, event } = earn(original, 'return', at(15));
  assert.equal(event.multiplierBefore, 1.6);
  assert.equal(event.multiplier, 1.7);
  assert.equal(event.coins, 17);
  assert.equal(session.inventory.coins, 92);
  assert.deepEqual(session.inventory.owned, ['flowers']);
  assert.deepEqual(session.inventory.applied, { decor: 'flowers' });
  assert.equal(session.record, 12);
  assert.deepEqual(session.creditedDays, ['2026-10-10', '2026-10-15']);
  assert.equal(sessionJourneyStep(session), 2);
  assert.deepEqual(session.rewardEvents[0], original.rewardEvents[0]);
  assert.equal(effectiveMultiplier(session, at(16)), 1.7);
  const muchLater = earn(session, 'long-return', at(30));
  assert.equal(muchLater.event.multiplierBefore, 1);
  assert.equal(muchLater.event.multiplier, 1.1);
  assert.equal(muchLater.session.inventory.coins, 103);
  assert.equal(sessionJourneyStep(muchLater.session), 3);
});

test('calendar gaps cross month/year boundaries and leap dates', () => {
  const session = { ...createDemoSession(), creditedDays: ['2026-12-30'],
    regularity: { multiplier: 1.6, lastCreditedDay: '2026-12-30' } };
  assert.equal(effectiveMultiplier(session, at(3, 0, 2027)), 1.5);
  const leap = { ...session, creditedDays: ['2028-02-27'],
    regularity: { multiplier: 1.6, lastCreditedDay: '2028-02-27' } };
  assert.equal(effectiveMultiplier(leap, at(2, 2, 2028)), 1.5);
});

test('DST changes do not change the number of missing calendar days', () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'Europe/London';
  try {
    for (const [month, startDay, endDay, expectedHours] of [[2, 27, 31, 95], [9, 23, 27, 97]]) {
      const start = new Date(2026, month, startDay, 12);
      const end = new Date(2026, month, endDay, 12);
      const dayKey = '2026-' + String(month + 1).padStart(2, '0') + '-' + startDay;
      assert.equal((end - start) / 3600000, expectedHours);
      assert.equal(effectiveMultiplier({ regularity: { multiplier: 1.6, lastCreditedDay: dayKey } }, end), 1.5);
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
