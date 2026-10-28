import { nutritionSupplies } from './food-assessment.js';

export const CAMP_SUPPLY_METAPHORS = {
  protein: { zone:'workshop', label:'Материалы', detail:'В лагере это материалы: Чуви обустраивает своё место.' },
  carbs: { zone:'fuel', label:'Дрова', detail:'В лагере это дрова: для уютного очага и чайника.' },
  fats: { zone:'light', label:'Фонарь', detail:'В лагере это масло для фонаря: тёплый свет на вечер.' },
  plants: { zone:'garden', label:'Семена', detail:'В лагере это семена: для маленького сада Чуви.' },
};

// An ephemeral visual demo, never an award or a progression event.
export function createCampSupplyMoment(meal) {
  const values = nutritionSupplies([meal]).values;
  const metric = Object.keys(CAMP_SUPPLY_METAPHORS).reduce((best, key) =>
    values[key].fill > (best ? values[best].fill : 0) ? key : best, null);
  return metric ? { metric, createdAt:Date.now() } : null;
}
