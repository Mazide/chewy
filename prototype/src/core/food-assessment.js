// Authored examples for visual review, not nutrition inference or a validated score.
const UNKNOWN = {
  tone: 'unknown', label: 'Нужны детали', short: 'Уточнить состав',
  reason: 'По этой записи пока нельзя уверенно оценить состав блюда.',
  next: 'Можно дописать ингредиенты и то, что осталось за кадром.',
  groups: {}, qualities: [],
};

const EXAMPLES = {
  meal: {
    names: ['Овощи с гарниром'], tone: 'good', label: 'Хорошо собрано', short: 'Разные группы вместе',
    reason: 'Овощи занимают большую часть тарелки. Есть нут и зерновой гарнир.',
    next: 'Осталось уточнить вид крупы: цельнозерновой вариант лучше подходит к ориентиру.',
    groups: { veg: 'present', protein: 'present', wholegrain: 'unknown' },
    qualities: ['Разные овощи', 'Бобовые'],
    supplies: { protein: [28, 'нут'], carbs: [18, 'нут'], plants: [36, 'овощи'] },
  },
  breakfast: {
    names: ['Овсянка с ягодами'], tone: 'consider', label: 'Можно дополнить', short: 'Злаки и ягоды',
    reason: 'Овсянка и ягоды дают злаки и фрукты. Белковая часть по снимку неясна.',
    next: 'Если это основной завтрак, можно добавить подходящий йогурт или орехи.',
    groups: { veg: 'present', protein: 'unknown', wholegrain: 'present' },
    qualities: ['Цельные злаки', 'Ягоды'],
    supplies: { carbs: [36, 'овсянка'], plants: [16, 'ягоды'] },
  },
  chicken: {
    names: ['Курица с картофелем'], tone: 'consider', label: 'Можно дополнить овощами', short: 'Можно добавить овощи',
    reason: 'Белковая часть есть. Овощей, кроме картофеля, на снимке не видно.',
    next: 'К этому блюду подойдут салат или тушёные овощи. Картофель не заменяет овощную часть ориентира.',
    groups: { veg: 'missing', protein: 'present', wholegrain: 'missing' },
    qualities: ['Белковая часть есть'], target: 'veg',
    supplies: { protein: [34, 'курица'] },
  },
  apple: {
    names: ['Яблоко'], tone: 'good', label: 'Фрукт к сегодняшнему дню', short: 'Фрукт к дню',
    reason: 'Яблоко добавляет фрукт. Перекусу не обязательно повторять состав целого обеда.',
    next: 'Общий баланс посмотрим по остальным записям.',
    groups: { veg: 'present' }, qualities: ['Цельный фрукт'],
    supplies: { carbs: [10, 'цельное яблоко'], plants: [15, 'яблоко'] },
  },
};

function assessDemoMeal(meal) {
  const key = meal?.imageKey ?? (meal?.preset === 'oatmeal' ? 'breakfast' : meal?.preset);
  const example = EXAMPLES[key];
  const notes = meal?.notes?.trim() ?? '';
  // An edited dish must not inherit an assessment merely because its photo stayed the same.
  if (!example || !example.names.includes(meal?.name)) return UNKNOWN;
  // Explicit authored clarification, not an ingredient parser or photo inference.
  if (key === 'meal' && notes === 'С оливковым маслом') return {
    ...example, qualities: [...example.qualities, 'Оливковое масло'],
    supplies: { ...example.supplies, fats: [30, 'оливковое масло'] },
  };
  if (notes && notes !== 'Соус отдельно') return UNKNOWN;
  return example;
}

export function demoMealName(imageKey) {
  return EXAMPLES[imageKey]?.names[0] ?? 'Блюдо';
}

// The mock answer is saved when analysis completes. Viewing a result or changing
// the illustrative fixtures must not reinterpret a previously completed answer.
export function snapshotMealAssessment(meal) {
  return JSON.parse(JSON.stringify(assessDemoMeal(meal)));
}

// The uncertain mock answer retains only evidence from a compatible authored
// fixture. Changed names or unsupported notes never inherit the old dish's facts.
export function snapshotUncertainAssessment(meal) {
  const assessment = snapshotMealAssessment(meal);
  if (assessment.tone === 'unknown') return assessment;
  return { ...assessment, tone: 'unknown', label: 'Состав понятен частично', short: 'Есть что уточнить',
    reason: 'Известные продукты учтены. Остальную часть состава пока нельзя уверенно определить.',
    next: 'Можно уточнить ингредиенты и то, что осталось за кадром.' };
}

export function mealAssessment(meal) {
  return meal?.assessment ?? assessDemoMeal(meal);
}

export function validMealAssessment(value) {
  return value && ['good', 'consider', 'unknown'].includes(value.tone)
    && ['label', 'short', 'reason', 'next'].every(key => typeof value[key] === 'string')
    && value.groups && typeof value.groups === 'object' && !Array.isArray(value.groups)
    && Object.entries(value.groups).every(([key, state]) => ['veg', 'protein', 'wholegrain'].includes(key) && ['present', 'missing', 'unknown'].includes(state))
    && Array.isArray(value.qualities) && value.qualities.every(item => typeof item === 'string')
    && (value.supplies === undefined || (value.supplies && typeof value.supplies === 'object' && !Array.isArray(value.supplies)
      && Object.entries(value.supplies).every(([key, contribution]) => NUTRITION_METRICS.some(metric => metric.key === key)
        && Array.isArray(contribution) && contribution.length === 2 && Number.isFinite(contribution[0]) && contribution[0] >= 0 && typeof contribution[1] === 'string')));
}

export const NUTRITION_METRICS = [
  { key: 'protein', label: 'Белок', color: '#ad7155', pale: '#e8b89b' },
  { key: 'carbs', label: 'Углеводы с клетчаткой', color: '#af8733', pale: '#ecd48a' },
  { key: 'fats', label: 'Ненасыщенные жиры', color: '#648883', pale: '#b0d0c7' },
  { key: 'plants', label: 'Овощи и фрукты', color: '#6e8c4e', pale: '#bdd19b' },
];

// Illustration units only: these capacities and weights are not dietary targets.
export function nutritionSupplies(meals) {
  const unique = [...new Map(meals.map((meal, index) => [meal.id ?? Symbol(index), meal])).values()];
  const rows = unique.map(meal => ({ meal, assessment: mealAssessment(meal) }));
  const values = Object.fromEntries(NUTRITION_METRICS.map(({ key }) => {
    const sources = new Set();
    let fill = 0;
    for (const { meal, assessment } of rows) {
      const contribution = assessment.supplies?.[key];
      if (!contribution) continue;
      fill += contribution[0] * ([0.75, 1, 1.25][meal.portion] ?? 1);
      sources.add(contribution[1]);
    }
    return [key, { fill: Math.min(100, fill), sources: [...sources] }];
  }));
  return { values, hasUnknown: rows.some(({ assessment }) => assessment.tone === 'unknown') };
}

// Presence only: a colored camp component is not a completed nutritional target.
export function dailyCampContributions(meals) {
  const { values } = nutritionSupplies(meals);
  return Object.fromEntries(NUTRITION_METRICS.map(({ key }) => [key, values[key].fill > 0]));
}

export function dayAssessment(meals) {
  if (!meals.length) return { tone: 'unknown', label: 'День начинается', short: 'Чистая страница', reason: 'Добавь еду — здесь появятся состав дня и подсказки.', groups: {}, qualities: [] };
  const assessments = meals.map(mealAssessment);
  const known = assessments.filter(item => item.tone !== 'unknown');
  const groups = Object.fromEntries(['veg', 'protein', 'wholegrain'].map(key => [key, assessments.some(item => item.groups[key] === 'present') ? 'present' : 'unknown']));
  const qualities = [...new Set(assessments.flatMap(item => item.qualities))].filter(label => ['Разные овощи', 'Бобовые', 'Цельные злаки', 'Цельный фрукт'].includes(label));
  if (known.length < assessments.length) return { ...UNKNOWN, label: 'Не всё понятно по записям', short: 'Есть что уточнить', reason: 'Часть состава ещё неизвестна. Уточнения помогут собрать картину дня.', groups, qualities };
  if (known.some(item => item.target === 'veg') && !qualities.includes('Разные овощи')) return { tone: 'consider', label: 'Овощи пока не видны', short: 'Можно добавить овощи', reason: 'К следующему обеду можно добавить салат или овощной гарнир.', groups, qualities };
  if (Object.values(groups).every(state => state === 'present')) return { tone: 'good', label: 'Разные группы на месте', short: 'Разные группы на месте', reason: 'В записях есть овощи, фрукты, белковые продукты и цельные злаки.', groups, qualities };
  return { tone: 'consider', label: 'День складывается', short: 'День складывается', reason: 'Первые продукты уже в дневнике. Остальные записи помогут увидеть сочетание групп.', groups, qualities };
}

export const NUTRITION_DAY_EXAMPLES = {
  auto: 'Сегодняшние записи', mixed: 'Пример · разные блюда',
  fats: 'Пример · масло уточнено',
  vegetables: 'Пример · овощи не видны', varied: 'Пример · разные группы', unclear: 'Пример · состав неизвестен', empty: 'Пустой день',
};

export function nutritionExampleMeals(key) {
  const meal = { id: 'sample-meal', imageKey: 'meal', name: 'Овощи с гарниром', time: '13:20' };
  const breakfast = { id: 'sample-breakfast', imageKey: 'breakfast', name: 'Овсянка с ягодами', time: '08:40' };
  const chicken = { id: 'sample-chicken', imageKey: 'chicken', name: 'Курица с картофелем', time: '19:10' };
  return key === 'empty' ? [] : key === 'unclear' ? [{ ...meal, id: 'sample-unclear', name: 'Домашнее блюдо' }] : key === 'vegetables' ? [breakfast, chicken] : key === 'varied' ? [breakfast, meal] : key === 'fats' ? [breakfast, { ...meal, notes: 'С оливковым маслом' }, chicken] : [breakfast, meal, chicken];
}
