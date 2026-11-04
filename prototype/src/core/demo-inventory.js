import { DEMO_GARDEN_COSTS } from './demo-config.js';

// One representative slot, with placeholder names and art for the prototype.
export const DEMO_GARDEN_ITEMS = Object.freeze([
  { id: 'garden-base', name: 'Базовый сад', description: 'Знакомый маленький сад у лагеря.' },
  { id: 'flowers', name: 'Цветы', description: 'Цветы рядом с садом Чуви.' },
  { id: 'garden-lush', name: 'Пышный сад', description: 'Больше зелени в знакомом уголке.' },
  { id: 'garden-bloom', name: 'Цветник', description: 'Яркий цветочный уголок лагеря.' },
].map(item => Object.freeze({ ...item, cost: DEMO_GARDEN_COSTS[item.id] })));

const BASE_APPEARANCE = 'garden-base';
const findAppearance = id => DEMO_GARDEN_ITEMS.find(item => item.id === id);

export function gardenAppearance(inventory) {
  // An explicit base selection overrides the old decor field without deleting it.
  if (Object.hasOwn(inventory.applied, 'garden')) return inventory.applied.garden ?? BASE_APPEARANCE;
  return inventory.applied.decor === 'flowers' ? 'flowers' : BASE_APPEARANCE;
}

export function ownsGardenAppearance(inventory, id) {
  return !!findAppearance(id) && (id === BASE_APPEARANCE || inventory.owned.includes(id));
}

export function buyGardenAppearance(inventory, id) {
  const item = findAppearance(id);
  if (!item || ownsGardenAppearance(inventory, id) || inventory.coins < item.cost) return inventory;
  return { ...inventory, coins: inventory.coins - item.cost, owned: [...inventory.owned, id] };
}

export function applyGardenAppearance(inventory, id) {
  if (!ownsGardenAppearance(inventory, id) || gardenAppearance(inventory) === id) return inventory;
  const garden = id === BASE_APPEARANCE ? null : id;
  return { ...inventory, applied: { ...inventory.applied, garden } };
}
