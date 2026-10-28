import { SANDBOX_DEVICES, getSandboxLayout } from './sandbox-scene-layout.js';

// Rough composition studies in the existing 390 × 500 scene. These are not art specs.
export const CAMP_COMPOSITIONS = {
  growth: {
    label: 'Обживаем лагерь',
    description: 'Принятая раскладка: герой меньше, вокруг четыре постоянные зоны. Обустройство у палатки слева, топливо внизу слева, свет справа, сад внизу справа.',
  },
  triangle: {
    label: 'Треугольник',
    description: 'Крупный герой в центре; костёр слева и пёс справа держат нижние углы. Палатка связывает группу на заднем плане.',
    objects: {
      hero: { anchor: [190, 440], height: 380 },
      tent: { anchor: [143, 280], height: 125 },
      fire: { anchor: [61, 420], height: 92 },
      kettle: { anchor: [106, 440], height: 54 },
      pet: { anchor: [325, 460], height: 100 },
    },
  },
  airy: {
    label: 'Больше воздуха',
    description: 'Герой немного меньше, между группами больше просветов. Проверяем, сохраняется ли его выразительность при более свободной сцене.',
    objects: {
      hero: { anchor: [187, 420], height: 326 },
      tent: { anchor: [114, 245], height: 102 },
      fire: { anchor: [51, 404], height: 80 },
      kettle: { anchor: [85, 429], height: 48 },
      pet: { anchor: [304, 448], height: 94 },
    },
  },
  diagonal: {
    label: 'По диагонали',
    description: 'Герой левее центра; палатка уходит вправо в глубину. Костёр и пёс справа уравновешивают большую фигуру.',
    objects: {
      hero: { anchor: [131, 436], height: 366 },
      tent: { anchor: [223, 275], height: 122 },
      fire: { anchor: [255, 410], height: 90 },
      kettle: { anchor: [256, 453], height: 52 },
      pet: { anchor: [325, 495], height: 95 },
    },
  },
};

export function getCampCompositionPlacements(preset, foodLayout = 'stacked') {
  const composition = CAMP_COMPOSITIONS[preset];
  if (!composition || preset === 'growth') return {};
  return Object.fromEntries(Object.entries(SANDBOX_DEVICES).map(([key, device]) => {
    const base = getSandboxLayout(device, { foodLayout });
    const objects = Object.entries(composition.objects).map(([id, target]) => {
      const original = base.objects.find((object) => object.id === id);
      return [id, [
        base.scene[0] + target.anchor[0] * base.scale - original.foot[0],
        base.scene[1] + target.anchor[1] * base.scale - original.foot[1],
        target.height * base.scale / original.frame[3],
      ]];
    });
    const controls = base.controls.map((control, index) => [control.id, [
      0, base.scene[1] + 34 * base.scale + index * (control.frame[3] + 14) - control.frame[1], 1,
    ]]);
    return [key, Object.fromEntries([...objects, ...controls])];
  }));
}
