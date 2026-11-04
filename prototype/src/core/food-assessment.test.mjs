import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyCampContributions, dayAssessment, mealAssessment, nutritionExampleMeals, nutritionSupplies, snapshotMealAssessment, validMealAssessment } from './food-assessment.js';
import { captureDay, completeDueCaptures, createCapture, reviseCapture } from './capture-session.js';

test('an edited dish does not keep the confidence of its photo fixture', () => {
  const meal = { imageKey: 'meal', name: 'Овощи с гарниром' };
  assert.equal(mealAssessment(meal).tone, 'good');
  assert.equal(mealAssessment({ ...meal, name: 'Другое блюдо' }).tone, 'unknown');
  assert.equal(mealAssessment({ ...meal, notes: 'Внутри мясо вместо нута' }).tone, 'unknown');
});

test('one meal without vegetables does not override vegetables elsewhere in the day', () => {
  const mixed = nutritionExampleMeals('mixed');
  assert.equal(mealAssessment(mixed[2]).target, 'veg');
  assert.equal(dayAssessment(mixed).tone, 'good');
  assert.equal(dayAssessment(nutritionExampleMeals('vegetables')).tone, 'consider');
});

test('potatoes count as neither the vegetable nor wholegrain part of the guide', () => {
  const chicken = nutritionExampleMeals('mixed')[2];
  assert.equal(mealAssessment(chicken).groups.veg, 'missing');
  assert.equal(mealAssessment(chicken).groups.wholegrain, 'missing');
});

test('a fruit snack is a contribution, while missing data stays unknown', () => {
  const apple = mealAssessment({ preset: 'apple', name: 'Яблоко' });
  assert.equal(apple.tone, 'good');
  assert.equal(apple.groups.protein, undefined);
  assert.equal(apple.groups.wholegrain, undefined);
  assert.equal(dayAssessment([]).tone, 'unknown');
  assert.equal(dayAssessment(nutritionExampleMeals('unclear')).tone, 'unknown');
  assert.equal(dayAssessment([...nutritionExampleMeals('mixed'), { name: 'Неизвестно' }]).tone, 'unknown');
});

test('one food can contribute to several supplies, while unseen oil stays unknown', () => {
  const plain = nutritionExampleMeals('mixed');
  const chickpeas = nutritionSupplies([plain[1]]).values;
  assert.ok(chickpeas.protein.fill > 0 && chickpeas.carbs.fill > 0);
  assert.equal(nutritionSupplies(plain).values.fats.fill, 0);
  assert.ok(nutritionSupplies(nutritionExampleMeals('fats')).values.fats.fill > 0);
  const unknown = nutritionSupplies(nutritionExampleMeals('unclear'));
  assert.equal(unknown.hasUnknown, true);
  assert.ok(Object.values(unknown.values).every(value => value.fill === 0 && value.sources.length === 0));
});

test('supplies cap, retain earlier contributions and count revisions only once', () => {
  const meal = nutritionExampleMeals('fats')[1];
  const first = nutritionSupplies([meal]).values;
  assert.deepEqual(nutritionSupplies([meal, meal]).values, first);
  const changed = { ...meal, portion: 0 };
  assert.deepEqual(nutritionSupplies([meal, changed]).values, nutritionSupplies([changed]).values);
  const unknown = { id: 'unknown', name: 'Другое блюдо' };
  assert.deepEqual(nutritionSupplies([meal, unknown]).values, first);
  const many = Array.from({ length: 20 }, (_, id) => ({ ...meal, id }));
  assert.ok(Object.values(nutritionSupplies(many).values).every(value => value.fill === 100));
});

test('a revised capture replaces its supply contribution after analysis completes', () => {
  let job = createCapture({ source: 'camera', theme: 'science', portion: 1, notes: '', delay: 0 });
  job.imageKey = 'meal';
  job.dishName = 'Овощи с гарниром';
  [job] = completeDueCaptures([job], Infinity);
  const before = nutritionSupplies(captureDay([job]).meals).values;
  const pending = reviseCapture(job, { dishName: job.dishName, notes: 'С оливковым маслом', portion: 0 }, 1000);
  assert.deepEqual(nutritionSupplies(captureDay([pending]).meals).values, before);
  const [ready] = completeDueCaptures([pending], Infinity);
  const revisedDay = captureDay([ready]);
  assert.equal(revisedDay.meals.length, 1);
  const after = nutritionSupplies(revisedDay.meals).values;
  assert.ok(after.fats.fill > 0);
  assert.ok(after.protein.fill < before.protein.fill);
});

test('daily camp components show confirmed presence independently of portions and repeated entries', () => {
  const meal = nutritionExampleMeals('fats')[1];
  const expected = { protein: true, carbs: true, fats: true, plants: true };
  assert.deepEqual(dailyCampContributions([meal]), expected);
  assert.deepEqual(dailyCampContributions([meal, meal, { ...meal, portion: 0 }]), expected);
  assert.deepEqual(dailyCampContributions([]), { protein: false, carbs: false, fats: false, plants: false });
});

test('serialized unknown answers stay unknown and never gain supplies', () => {
  const meal = { id: 'unknown', imageKey: 'meal', name: 'Домашнее блюдо' };
  const saved = { ...meal, assessment: snapshotMealAssessment(meal) };
  const loaded = JSON.parse(JSON.stringify(saved));
  assert.equal(validMealAssessment(loaded.assessment), true);
  assert.equal(nutritionSupplies([loaded]).hasUnknown, true);
  assert.equal(dayAssessment([loaded]).tone, 'unknown');
  assert.deepEqual(dailyCampContributions([loaded]), { protein: false, carbs: false, fats: false, plants: false });
});

test('analysis snapshots are independent of the authored fixtures and the prior answer', () => {
  const meal = nutritionExampleMeals('fats')[1];
  const prior = snapshotMealAssessment(meal);
  assert.equal(validMealAssessment(prior), true);
  prior.supplies.fats[1] = 'сохранённый источник';
  const next = snapshotMealAssessment({ ...meal, assessment: prior });
  assert.equal(next.supplies.fats[1], 'оливковое масло');
  assert.equal(mealAssessment(meal).supplies.fats[1], 'оливковое масло');
});
