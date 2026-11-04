import { SANDBOX_DEVICES, getSandboxLayout } from './sandbox-scene-layout.js';

// Approximate composition reconstructed from the owner's 2026-10-24 screenshot.
// Coordinates use the existing 390 × 500 scene; this is a review preset.
const OWNER_COMPOSITION = {
  hero: { anchor: [192, 480], height: 430 },
  tent: { anchor: [154, 220], height: 140 },
  fire: { anchor: [51, 245], height: 86 },
  kettle: { anchor: [86, 262], height: 42 },
  pet: { anchor: [328, 494], height: 150 },
};

export function getOwnerCompositionPlacements() {
  return Object.fromEntries(Object.entries(SANDBOX_DEVICES).map(([key, device]) => {
    const base = getSandboxLayout(device);
    const placements = Object.fromEntries(Object.entries(OWNER_COMPOSITION).map(([id, target]) => {
      const original = base.objects.find((object) => object.id === id);
      return [id, [
        base.scene[0] + target.anchor[0] * base.scale - original.foot[0],
        base.scene[1] + target.anchor[1] * base.scale - original.foot[1],
        target.height * base.scale / original.frame[3],
      ]];
    }));
    return [key, placements];
  }));
}
