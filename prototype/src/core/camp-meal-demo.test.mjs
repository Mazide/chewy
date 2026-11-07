import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyMealDemo, randomDemoContribution, demoStages, addDemoMeal, restoreMealDemo } from './camp-meal-demo.js';

function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

test('three meals show progressive, independent states and never take back a contribution', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const random = seeded(seed);
    let session = emptyMealDemo(), previous = demoStages(session);
    assert.ok(Object.values(previous).every(value => value === 0));
    for (let meal = 1; meal <= 20; meal++) {
      const original = JSON.stringify(session);
      const next = addDemoMeal(session, randomDemoContribution(random));
      assert.equal(JSON.stringify(session), original, 'adding food does not mutate a previous snapshot');
      session = next;
      const stages = demoStages(session);
      assert.ok(Object.keys(stages).every(key => stages[key] >= previous[key] && stages[key] <= 2));
      if (meal === 1) { assert.ok(Object.values(stages).includes(0)); assert.ok(Object.values(stages).includes(1)); }
      if (meal === 2) assert.ok(Object.values(stages).every(value => value >= 1));
      if (meal === 3) assert.ok(Object.values(stages).includes(2));
      previous = stages;
    }
    assert.ok(Object.values(previous).every(value => value === 2));
  }
});

test('random meals vary across all four components and survive a reload unchanged', () => {
  let session = emptyMealDemo();
  const random = seeded(46);
  for (let index = 0; index < 30; index++) session = addDemoMeal(session, randomDemoContribution(random));
  assert.ok(new Set(session.meals.map(meal => JSON.stringify(meal.contribution))).size > 10);
  assert.deepEqual(restoreMealDemo(JSON.stringify(session)), session);
  assert.deepEqual(demoStages(restoreMealDemo(JSON.stringify(session))), demoStages(session));
  const nextDay = emptyMealDemo(session.day + 1);
  assert.equal(nextDay.day, 2); assert.equal(nextDay.meals.length, 0);
  assert.ok(Object.values(demoStages(nextDay)).every(value => value === 0));
  assert.equal(session.meals.length, 30, 'the earlier day remains a separate snapshot');
});

test('invalid or foreign saved data cannot become a food contribution', () => {
  for (const raw of [null, '{', '{}', 'null', JSON.stringify({ version: 1, day: 1, meals: [{ id: 1, contribution: { protein: -4 } }] }), JSON.stringify({ version: 1, day: 1, meals: [null] })]) {
    assert.deepEqual(restoreMealDemo(raw), emptyMealDemo());
  }
});
