import { SANDBOX_DEVICES, getSandboxLayout } from './sandbox-scene-layout.js';

// Owner's 390 × 844 composition, before the assistant's whole-camp rearrangement.
const LEGACY_FRAMES = {
  "provisions": [270, 550, 76, 91.2],
  "log": [195, 531, 134, 61.416666666666664],
  "workshop": [
    -161.40618,
    160.895096,
    390,
    268.70512399999996
  ],
  "garden": [
    245.04948,
    374.54188,
    130.83876,
    80.401972
  ],
  "hero": [
    106.98831,
    227.36515999999997,
    112.48185,
    243.026424
  ],
  "pet": [
    25.790309999999998,
    424.448444,
    69.69027,
    98.15551199999999
  ],
  "fuel": [
    85.02039,
    522.8377439999999,
    235.87551,
    109.97910799999998
  ],
  "light": [
    196.97652,
    758.282516,
    16.671954,
    36.2499688
  ]
};


// Restore the owner's layout; keep the added backpack by the tent and log by the fire.
const FRAMES = {
  ...LEGACY_FRAMES,
  provisions: [27, 345, 76, 91.2],
};

// Rejected assistant layout, retained only to restore its saved defaults.
const RECOMPOSED_FRAMES = {
  ...LEGACY_FRAMES,
  workshop: [-39, 236, 260, 260 * 268.705124 / 390],
  hero: [145, 283, 106, 106 * 243.026424 / 112.48185],
  garden: [261, 395, 108, 108 * 80.401972 / 130.83876],
  pet: [75, 482, 56, 56 * 98.155512 / 69.69027],
  fuel: [42, 563, 222, 222 * 109.979108 / 235.87551],
  log: [146, 570, 126, 57.75],
  provisions: [42, 413, 80, 96],
};

function placementsFromFrames(frames) {
  return Object.fromEntries(Object.entries(SANDBOX_DEVICES).map(([key, device]) => {
    const base = getSandboxLayout(device, { foodLayout: 'separate', growthStage: 'initial' });
    return [key, Object.fromEntries(base.objects.map(object => {
      const [x, y, width, height] = frames[object.id];
      return [object.id, [
        (x + width / 2) * device.width / 390 - object.foot[0],
        (y + height) * device.height / 844 - object.foot[1],
        width * device.width / 390 / object.frame[2],
      ]];
    }))];
  }));
}

export function getOwnerCampPlacements() {
  return placementsFromFrames(FRAMES);
}

// Earlier previews saved their defaults too. Restore only untouched defaults;
// keep every manually edited object and navigation control in its saved place.
export function mergeOwnerCampPlacements(saved) {
  const preset = getOwnerCampPlacements();
  const previous = placementsFromFrames({ ...LEGACY_FRAMES, provisions: [27, 345, 76, 91.2] });
  const previousHearth = placementsFromFrames({ ...LEGACY_FRAMES,
    provisions: [296, 561, 76, 91.2], log: [250, 541, 122, 55.916666666666664],
  });
  const previousCamp = placementsFromFrames(LEGACY_FRAMES);
  const recomposedCamp = placementsFromFrames(RECOMPOSED_FRAMES);
  const previousFrontBag = placementsFromFrames({ ...RECOMPOSED_FRAMES, provisions: [218, 589, 72, 86.4] });
  const samePlacement = (a, b) => a?.length === 3 && a.every((value, i) => Math.abs(value - b[i]) < 1e-6);
  return Object.fromEntries(Object.keys(SANDBOX_DEVICES).map(key => {
    const placements = { ...preset[key], ...saved[key] };
    const bag = saved[key]?.provisions;
    for (const id of ['workshop', 'hero', 'garden', 'pet', 'fuel', 'log', 'provisions']) {
      if (samePlacement(saved[key]?.[id], recomposedCamp[key][id])) placements[id] = preset[key][id];
    }
    if (!saved[key]?.log && samePlacement(bag, previous[key].provisions)) {
      placements.provisions = preset[key].provisions;
    }
    if (samePlacement(bag, previousFrontBag[key].provisions)) placements.provisions = preset[key].provisions;
    if ((samePlacement(bag, previousHearth[key].provisions) && samePlacement(saved[key]?.log, previousHearth[key].log)) ||
      (samePlacement(bag, previousCamp[key].provisions) && samePlacement(saved[key]?.log, previousCamp[key].log))) {
      placements.provisions = preset[key].provisions;
      placements.log = preset[key].log;
    }
    return [key, placements];
  }));
}
