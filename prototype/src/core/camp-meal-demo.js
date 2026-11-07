// Arbitrary visual-demo units only. Never use these as nutrition or gameplay tuning.
export const DEMO_SESSION_KEY = 'chewy.camp-meal-demo.v1';
export const DEMO_METRICS = ['protein', 'carbs', 'fats', 'plants'];
const DEMO_STAGE_BOUNDARIES = [5, 13];
const DEMO_TOTAL_CAP = 24;

export const emptyMealDemo = (day = 1) => ({ version: 1, day, meals: [] });

export function randomDemoContribution(random = Math.random) {
  const order = [...DEMO_METRICS];
  for (let index = order.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  return Object.fromEntries(order.map((metric, index) => [metric,
    index === 0 ? 7 + Math.floor(random() * 2) : index === 1 ? 3 : 3 + Math.floor(random() * 4),
  ]));
}

export function demoTotals(session) {
  return Object.fromEntries(DEMO_METRICS.map(metric => [metric, Math.min(DEMO_TOTAL_CAP,
    session.meals.reduce((sum, meal) => sum + meal.contribution[metric], 0))]));
}

export function demoStages(session) {
  return Object.fromEntries(Object.entries(demoTotals(session)).map(([metric, total]) =>
    [metric, DEMO_STAGE_BOUNDARIES.filter(boundary => total >= boundary).length]));
}

export function addDemoMeal(session, contribution) {
  return { ...session, meals: [...session.meals, { id: session.meals.length + 1, contribution }] };
}

export function restoreMealDemo(raw) {
  try {
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !Number.isSafeInteger(saved.day) || saved.day < 1 ||
        !Array.isArray(saved.meals) || saved.meals.length > 1000) return emptyMealDemo();
    if (saved.meals.some((meal, index) => meal?.id !== index + 1 ||
      DEMO_METRICS.some(metric => !Number.isInteger(meal.contribution?.[metric]) ||
        meal.contribution[metric] < 3 || meal.contribution[metric] > 8))) return emptyMealDemo();
    return { version: 1, day: saved.day, meals: saved.meals.map(({ id, contribution }) => ({
      id, contribution: Object.fromEntries(DEMO_METRICS.map(metric => [metric, contribution[metric]])),
    })) };
  } catch { return emptyMealDemo(); }
}

export function changedDemoComponents(session) {
  if (!session.meals.length) return [];
  const previous = demoStages({ ...session, meals: session.meals.slice(0, -1) });
  const current = demoStages(session);
  return DEMO_METRICS.filter(metric => current[metric] > previous[metric]);
}
