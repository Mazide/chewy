import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPLORATION_DEMO,
  createExplorationStudy,
  explorationActivityTotal,
  observeExplorationActivity,
  placeExplorationFinding,
  selectExplorationRoute,
  validateExplorationStudy,
} from './exploration-study.js';

const day = '2026-10-29';
const interval = EXPLORATION_DEMO.progressPerDiscovery;
const observe = (state, amount, dayKey = day, kind = 'steps') => observeExplorationActivity(state, { dayKey, kind, amount });
const selected = id => selectExplorationRoute(createExplorationStudy(), id);

test('one discovery is awarded once despite repeated readings and later movement', () => {
  const partial = observe(selected('brook'), interval - 1);
  assert.deepEqual(partial.found, []);
  const found = observe(partial, interval);
  assert.deepEqual(found.found, ['hat-bucket']);
  assert.strictEqual(observe(found, interval), found);
  const later = observe(found, interval * 2);
  assert.deepEqual(later.found, ['hat-bucket']);
  assert.equal(later.progress.brook, interval);
  assert.equal(later.activityPeaks[day].steps, interval * 2);
});

test('downward corrections never remove progress or create repeat credit on recovery', () => {
  const first = observe(selected('brook'), 600);
  assert.strictEqual(observe(first, 200), first);
  assert.strictEqual(observe(first, 500), first);
  const increased = observe(first, 700);
  assert.equal(increased.progress.brook, 700);
  const found = observe(increased, interval);
  assert.strictEqual(observe(found, 0), found);
  assert.deepEqual(found.found, ['hat-bucket']);
});

test('a new calendar day contributes its own total without resetting route progress', () => {
  const first = observe(selected('brook'), 600);
  const second = observe(first, 5, '2026-10-30', 'swimming');
  assert.equal(second.progress.brook, 1100);
  assert.deepEqual(second.activityPeaks, { '2026-10-29': { steps: 600 }, '2026-10-30': { swimming: 5 } });
  assert.strictEqual(observe(second, 5, '2026-10-30', 'swimming'), second);
  assert.equal(explorationActivityTotal(second, day), 600);
  assert.equal(explorationActivityTotal(second, '2026-10-30'), 500);
  assert.equal(explorationActivityTotal(second, '2026-10-31'), 0);
});

test('switching routes retains each route and consumes only fresh movement', () => {
  let state = observe(selected('brook'), 500);
  state = selectExplorationRoute(state, 'pines');
  assert.strictEqual(observe(state, 500), state);
  state = observe(state, 800);
  assert.deepEqual(state.progress, { brook: 500, pines: 300 });
  state = selectExplorationRoute(state, 'brook');
  state = observe(state, 1100);
  assert.deepEqual(state.progress, { brook: 800, pines: 300 });
});

test('readings before selection and overflow are discarded, not banked for another route', () => {
  let state = observe(createExplorationStudy(), 1000);
  assert.deepEqual(state.progress, { brook: 0, pines: 0 });
  state = selectExplorationRoute(state, 'brook');
  assert.strictEqual(observe(state, 1000), state);
  state = observe(state, 1000 + interval + 500);
  assert.equal(state.progress.brook, interval);
  state = selectExplorationRoute(state, 'pines');
  assert.strictEqual(observe(state, 1000 + interval + 500), state);
  state = observe(state, 1000 + interval + 600);
  assert.equal(state.progress.pines, 100);
});

test('both discoveries remain owned and completed routes can still be selected', () => {
  let state = observe(selected('brook'), interval);
  state = selectExplorationRoute(state, 'pines');
  state = observe(state, interval * 2);
  assert.deepEqual(state.found, ['hat-bucket', 'hat-trail']);
  state = selectExplorationRoute(state, 'brook');
  assert.equal(state.selectedRouteId, 'brook');
  state = observe(state, interval * 3);
  assert.deepEqual(state.found, ['hat-bucket', 'hat-trail']);
  assert.deepEqual(state.progress, { brook: interval, pines: interval });
});

test('late previous-day increases go to the currently selected route in this draft', () => {
  let state = observe(selected('brook'), 500);
  state = observe(state, 100, '2026-10-30');
  state = selectExplorationRoute(state, 'pines');
  state = observe(state, 700);
  assert.deepEqual(state.progress, { brook: 600, pines: 200 });
  assert.equal(state.activityPeaks[day].steps, 700);
  assert.strictEqual(observe(state, 600), state);
});

test('only owned known finds can be placed and removal preserves ownership', () => {
  const empty = createExplorationStudy();
  assert.strictEqual(placeExplorationFinding(empty, 'hat-bucket'), empty);
  assert.strictEqual(placeExplorationFinding(empty, 'unknown'), empty);
  let state = observe(selected('brook'), interval);
  state = placeExplorationFinding(state, 'hat-bucket');
  assert.equal(state.placedId, 'hat-bucket');
  assert.strictEqual(placeExplorationFinding(state, 'hat-bucket'), state);
  assert.strictEqual(placeExplorationFinding(state, 'hat-trail'), state);
  state = observe(selectExplorationRoute(state, 'pines'), interval * 2);
  state = placeExplorationFinding(state, 'hat-trail');
  assert.equal(state.placedId, 'hat-trail');
  state = placeExplorationFinding(state, null);
  assert.equal(state.placedId, null);
  assert.deepEqual(state.found, ['hat-bucket', 'hat-trail']);
});

test('invalid identifiers, malformed dates and unsafe activity samples leave the draft unchanged', () => {
  const state = selected('brook');
  for (const id of [null, undefined, '', 'unknown', '__proto__', {}, 1]) {
    assert.strictEqual(selectExplorationRoute(state, id), state);
  }
  for (const id of [undefined, '', 'unknown', '__proto__', {}, 1]) {
    assert.strictEqual(placeExplorationFinding(state, id), state);
  }
  for (const sample of [null, undefined, {}, { dayKey: day }, { amount: 100 }, { dayKey: day, amount: 100 }]) {
    assert.strictEqual(observeExplorationActivity(state, sample), state);
  }
  for (const kind of [undefined, null, '', 'unknown', '__proto__', {}, 1]) {
    assert.strictEqual(observeExplorationActivity(state, { dayKey: day, kind, amount: 100 }), state);
  }
  for (const amount of [-1, 0.1, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '100', null]) {
    assert.strictEqual(observe(state, amount), state);
    assert.strictEqual(observe(state, amount, day, 'cycling'), state);
  }
  for (const dayKey of ['', '2026-2-03', '2026-02-29', '2026-04-31', '2026-13-01', '2026-10-29T00:00:00Z', '__proto__', null]) {
    assert.strictEqual(observe(state, 100, dayKey), state);
  }
  assert.equal(observe(state, 100, '2024-02-29').progress.brook, 100);
  assert.strictEqual(observe(state, 0), state);
  assert.equal(observe(state, Number.MAX_SAFE_INTEGER).progress.brook, interval);
  assert.equal(explorationActivityTotal(state, 'invalid'), 0);
});

test('minute samples whose normalized amount overflows are rejected before changing peaks', () => {
  const state = selected('brook');
  const maximumSafeMinutes = Math.floor(Number.MAX_SAFE_INTEGER / 100);
  for (const kind of ['cycling', 'swimming', 'other']) {
    assert.strictEqual(observe(state, Number.MAX_SAFE_INTEGER, day, kind), state);
    assert.strictEqual(observe(state, maximumSafeMinutes + 1, day, kind), state);
    const accepted = observe(state, maximumSafeMinutes, day, kind);
    assert.equal(accepted.progress.brook, interval);
    assert.equal(explorationActivityTotal(accepted, day), maximumSafeMinutes * 100);
  }
});

test('cycling, swimming and other activities can each reveal a find without any steps', () => {
  for (const kind of ['cycling', 'swimming', 'other']) {
    const partial = observe(selected('brook'), 19, day, kind);
    assert.equal(partial.progress.brook, 1900);
    assert.deepEqual(partial.found, []);
    const found = observe(partial, 20, day, kind);
    assert.deepEqual(found.found, ['hat-bucket']);
    assert.equal(found.activityPeaks[day].steps, undefined);
  }
});

test('mixed activity streams use their maximum and never sum even independent activity', () => {
  let state = observe(selected('brook'), 1000);
  state = observe(state, 10, day, 'cycling');
  state = observe(state, 5, day, 'swimming');
  assert.deepEqual(state.activityPeaks[day], { steps: 1000, cycling: 10, swimming: 5 });
  assert.equal(state.progress.brook, 1000);
  assert.equal(explorationActivityTotal(state, day), 1000);
  state = observe(state, 15, day, 'other');
  assert.equal(state.progress.brook, 1500);
  assert.equal(explorationActivityTotal(state, day), 1500);
  state = observe(state, 1400);
  assert.equal(state.progress.brook, 1500);
  state = observe(state, 1600);
  assert.equal(state.progress.brook, 1600);
});

test('corrections in each stream retain their peaks and cannot repeat mixed activity credit', () => {
  let state = observe(selected('brook'), 600);
  state = observe(state, 10, day, 'cycling');
  assert.strictEqual(observe(state, 2, day, 'cycling'), state);
  assert.strictEqual(observe(state, 300), state);
  state = observe(state, 900);
  assert.equal(state.progress.brook, 1000);
  assert.strictEqual(observe(state, 9, day, 'cycling'), state);
  state = observe(state, 11, day, 'cycling');
  assert.equal(state.progress.brook, 1100);
  assert.deepEqual(state.activityPeaks[day], { steps: 900, cycling: 11 });
});

test('switching routes cannot reuse movement by switching the activity source', () => {
  let state = observe(selected('brook'), 1000);
  state = selectExplorationRoute(state, 'pines');
  state = observe(state, 10, day, 'cycling');
  assert.deepEqual(state.progress, { brook: 1000, pines: 0 });
  state = observe(state, 15, day, 'swimming');
  assert.deepEqual(state.progress, { brook: 1000, pines: 500 });
  state = selectExplorationRoute(state, 'brook');
  state = observe(state, 1600);
  assert.deepEqual(state.progress, { brook: 1100, pines: 500 });
});

test('factories and all transitions preserve their source objects', () => {
  const freeze = state => {
    Object.freeze(state.progress);
    Object.freeze(state.originStops);
    Object.freeze(state.seenFindings);
    Object.values(state.activityPeaks).forEach(Object.freeze);
    Object.freeze(state.activityPeaks);
    Object.freeze(state.found);
    return Object.freeze(state);
  };
  const empty = freeze(createExplorationStudy());
  const other = createExplorationStudy();
  assert.notStrictEqual(empty.progress, other.progress);
  assert.notStrictEqual(empty.activityPeaks, other.activityPeaks);
  assert.notStrictEqual(empty.found, other.found);
  const chosen = freeze(selectExplorationRoute(empty, 'brook'));
  const partial = freeze(observe(chosen, 5, day, 'cycling'));
  const found = freeze(observe(partial, interval));
  const placed = placeExplorationFinding(found, 'hat-bucket');
  assert.deepEqual(empty, other);
  assert.deepEqual(chosen.progress, { brook: 0, pines: 0 });
  assert.deepEqual(chosen.activityPeaks, {});
  assert.deepEqual(chosen.found, []);
  assert.deepEqual(partial.activityPeaks, { [day]: { cycling: 5 } });
  assert.equal(found.placedId, null);
  assert.equal(placed.placedId, 'hat-bucket');
});

test('each route keeps its first origin across switching, new days and later stops', () => {
  let state = selectExplorationRoute(createExplorationStudy(), 'brook', 3);
  state = observe(state, 500);
  state = selectExplorationRoute(state, 'pines', 5);
  state = selectExplorationRoute(state, 'brook', 9);
  state = observe(state, 500, '2026-10-30');
  assert.deepEqual(state.originStops, { brook: 3, pines: 5 });
  assert.equal(state.progress.brook, 1000);
  for (const stop of [-1, 0.5, NaN, Infinity, '4', null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.strictEqual(selectExplorationRoute(state, 'pines', stop), state);
  }
  assert.strictEqual(validateExplorationStudy(state), state);
});

test('validation accepts complete prototype states and rejects inconsistent rewards or origins', () => {
  const empty = createExplorationStudy();
  assert.strictEqual(validateExplorationStudy(empty), empty);
  const earned = observe(selected('brook'), interval);
  const valid = { ...placeExplorationFinding(earned, 'hat-bucket'), seenFindings: ['hat-bucket'] };
  assert.strictEqual(validateExplorationStudy(valid), valid);
  for (const state of [null, [], {},
    { ...empty, selectedRouteId: 'unknown' },
    { ...empty, selectedRouteId: 'brook' },
    { ...empty, progress: { brook: 0 } },
    { ...empty, progress: { ...empty.progress, unknown: 0 } },
    { ...empty, progress: { ...empty.progress, brook: 1 } },
    { ...earned, progress: { ...earned.progress, brook: interval - 1 } },
    { ...earned, originStops: {} },
    { ...earned, originStops: { brook: -1 } },
    { ...earned, originStops: { brook: 0.5 } },
    { ...earned, originStops: { brook: 0, unknown: 1 } },
    { ...earned, found: [] },
    { ...earned, found: ['hat-bucket', 'hat-bucket'] },
    { ...earned, seenFindings: ['hat-trail'] },
    { ...earned, seenFindings: ['hat-bucket', 'hat-bucket'] },
    { ...earned, placedId: 'hat-trail' },
  ]) assert.throws(() => validateExplorationStudy(state));
});

test('validation rejects invalid saved activity dates, sources and numeric overflow', () => {
  const empty = createExplorationStudy();
  for (const activityPeaks of [null, [], { '2026-02-30': { steps: 1 } },
    { [day]: [] }, { [day]: { unknown: 1 } }, { [day]: { steps: -1 } },
    { [day]: { steps: 0.1 } }, { [day]: { steps: '1' } },
    { [day]: { cycling: Number.MAX_SAFE_INTEGER } },
  ]) assert.throws(() => validateExplorationStudy({ ...empty, activityPeaks }));
});
