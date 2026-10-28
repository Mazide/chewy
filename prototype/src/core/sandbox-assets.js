const background = '/assets/sandbox/camp-v3-flat/background.png';
const hero = '/assets/sandbox/archive-reference/hero_idle_sheet.png';
const tent = '/assets/sandbox/camp-v3-flat/tent.png';
const fire = '/assets/sandbox/camp-v3-flat/fire.png';
const kettle = '/assets/sandbox/camp-v3-flat/kettle.png';
const pet = '/assets/sandbox/camp-v3-flat/dog.png';
const map = '/assets/sandbox/camp-v3-flat/map.png';
const backpack = '/assets/sandbox/camp-v3-flat/backpack.png';
import { CANVAS_ASSETS } from './canvas-layout.js';

const camp = CANVAS_ASSETS.camp;

export const SANDBOX_LAYERS = [
  { id: 'background', ...camp.background, src: background, fit: 'cover', content: 'Плоский фон по архивному герою: простые силуэты деревьев и открытая лужайка, тонкая линия, без объёмного освещения.' },
  { id: 'tent', ...camp.shelter, src: tent },
  { id: 'hero', ...camp.hero, src: hero, content: 'Исходный плоский герой из архива: первый кадр оригинального спрайтшита. Форма, линия и заливки сохранены без перегенерации; эталон для остальных ассетов.' },
  { id: 'fire', ...camp.fire, src: fire },
  { id: 'kettle', ...camp.kettle, src: kettle, frame: [224, 570, 48, 48], content: 'В этой примерке чайник стоит на земле рядом с костром. Он отдельный слой, который можно переставить без перегенерации сцены.' },
  { id: 'pet', ...camp.pet, label: 'Пёс', src: pet, content: 'Приключенческий пёс с вытянутой мордой и глазами-точками по исходному референсу. Проба вместо белки; размер и место можно подобрать в песочнице.' },
  { id: 'map', ...camp.pathLink, src: map },
  { id: 'backpack', ...camp.backpackLink, src: backpack },
];
