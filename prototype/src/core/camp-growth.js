import bounds from './camp-growth-bounds.js';

export const CAMP_GROWTH_STAGES = { initial: 'Начальный лагерь', developed: 'Обжитый лагерь' };

// Shared footprints for both stages, in the existing 390 × 500 scene coordinates.
export const CAMP_GROWTH_OBJECTS = {
  workshop: { anchor: [110, 267], width: 210 },
  provisions: { anchor: [62, 330], width: 78 },
  log: { anchor: [234, 456], width: 122 },
  light: { anchor: [335, 326], height: 145 },
  hero: { anchor: [215, 365], height: 215 },
  pet: { anchor: [266, 425], height: 72 },
  fuel: { anchor: [94, 435], width: 180 },
  garden: { anchor: [335, 441], width: 100 },
};

const GROUPS = {
  workshop: ['Обустройство', 'Белок · материалы и палатка'],
  provisions: ['Припасы', 'Углеводы с клетчаткой · припасы в походном рюкзаке'],
  log: ['Бревно', 'Место у костра · декоративный предмет без пищевого вклада'],
  fuel: ['Очаг', 'Ненасыщенные жиры · уютный костёр'],
  light: ['Свет', 'Убранный фонарь · прежний слой мастерской'],
  garden: ['Сад', 'Овощи и фрукты · семена и растения'],
};

export function campGrowthLayers(stage = 'initial') {
  const resolved = CAMP_GROWTH_STAGES[stage] ? stage : 'initial';
  return Object.entries(GROUPS).map(([id, [label, content]]) => ({
    id, label, content,
    bounds: id === 'log' ? { x: 0, y: 0, width: 240, height: 110, sourceWidth: 240, sourceHeight: 110 } : id === 'provisions' ? { x: 0, y: 0, width: 200, height: 240, sourceWidth: 200, sourceHeight: 240 } : bounds[resolved][id],
    src: id === 'log' ? undefined : id === 'provisions' ? '/assets/sandbox/camp-v3-flat/backpack.png' : `/assets/camp-growth/${resolved}-v1.png`,
  }));
}
