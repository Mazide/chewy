import { nutritionSupplies } from './food-assessment.js';

export const CAMP_SUPPLY_METAPHORS = {
  protein: { zone:'workshop', label:'Палатка', detail:'Белок помогает обустроить место Чуви: палатка расправляется.' },
  carbs: { zone:'fuel', label:'Костёр', detail:'Углеводы поддерживают огонь: костёр разгорается.' },
  fats: { zone:'provisions', label:'Масляная лампа', detail:'Жиры — масло для лампы: больше масла и мягкого света.' },
  plants: { zone:'garden', label:'Растения', detail:'Овощи и фрукты добавляют зелень: растения подрастают.' },
};

// An ephemeral visual demo, never an award or a progression event.
export function createCampSupplyMoment(meal) {
  const values = nutritionSupplies([meal]).values;
  const metric = Object.keys(CAMP_SUPPLY_METAPHORS).reduce((best, key) =>
    values[key].fill > (best ? values[best].fill : 0) ? key : best, null);
  return metric ? { metric, createdAt:Date.now() } : null;
}
