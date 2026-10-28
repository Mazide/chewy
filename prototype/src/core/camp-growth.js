import bounds from './camp-growth-bounds.js';

export const CAMP_GROWTH_STAGES = { initial: 'Начальный лагерь', developed: 'Обжитый лагерь' };

// Shared footprints for both stages, in the existing 390 × 500 scene coordinates.
export const CAMP_GROWTH_OBJECTS = {
  workshop: { anchor: [110, 267], width: 210 },
  light: { anchor: [335, 326], height: 145 },
  hero: { anchor: [215, 365], height: 215 },
  pet: { anchor: [266, 425], height: 72 },
  fuel: { anchor: [94, 435], width: 180 },
  garden: { anchor: [335, 441], width: 100 },
};

const GROUPS = {
  workshop: ['Обустройство', 'Белок · материалы и палатка'],
  fuel: ['Топливо', 'Углеводы с клетчаткой · очаг и дрова'],
  light: ['Свет', 'Ненасыщенные жиры · фонарь и масло'],
  garden: ['Сад', 'Овощи и фрукты · семена и растения'],
};

export function campGrowthLayers(stage = 'initial') {
  const resolved = CAMP_GROWTH_STAGES[stage] ? stage : 'initial';
  return Object.entries(GROUPS).map(([id, [label, content]]) => ({
    id, label, content, bounds: bounds[resolved][id],
    src: `/assets/camp-growth/${resolved}-v1.png`,
  }));
}
