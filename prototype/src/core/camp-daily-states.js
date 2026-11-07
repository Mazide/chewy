import { nutritionSupplies } from './food-assessment.js';
import { DEMO_CAMP_STAGE_BOUNDARIES } from './demo-config.js';

export const CAMP_DAILY_OBJECTS = [
  { id: 'tent', metric: 'protein', zone: 'workshop', board: 'TentStates', name: 'Палатка', mapping: 'Белок', widthFactor: 1.05, ratio: 1460 / 780, ground: .935, states: ['Полусложенная', 'Расправляется', 'Собрана'] },
  { id: 'campfire', metric: 'carbs', zone: 'fuel', board: 'CampfireStates', name: 'Костёр', mapping: 'Углеводы', widthFactor: .54, ratio: 950 / 1140, ground: .965, states: ['Маленький огонь', 'Разгорается', 'Ярко горит'] },
  { id: 'plants', metric: 'plants', zone: 'garden', board: 'PlantStates', name: 'Растения', mapping: 'Овощи и фрукты', widthFactor: .92, ratio: 480 / 465, ground: .935, states: ['Росток', 'Подрастают', 'Пышно цветут'] },
  { id: 'lamp', metric: 'fats', zone: 'provisions', board: 'LampStates', name: 'Лампа', mapping: 'Жиры', widthFactor: 1.05, ratio: 420 / 480, ground: .94, states: ['Тихий огонёк', 'Больше масла и света', 'Наполнена и светит'] },
];

// Derived exclusively from saved results for the selected day. No new rewards
// or persistence path; correction, deletion and history keep session semantics.
export function dailyCampStages(meals) {
  const { values } = nutritionSupplies(meals);
  return Object.fromEntries(Object.entries(values).map(([metric, { fill }]) =>
    [metric, DEMO_CAMP_STAGE_BOUNDARIES.filter(boundary => fill >= boundary).length]));
}

export function dailyCampObjectFrame(object, component) {
  const width = object.frame[2] * component.widthFactor;
  const height = width / component.ratio;
  return [object.foot[0] - width / 2, object.foot[1] - height * component.ground, width, height];
}
