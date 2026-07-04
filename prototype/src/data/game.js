/**
 * Prototype sim of the Build-1 game rules (docs/spec/SPEC_v5.md).
 * Pure JS mirror of the future GameConfig.swift + scoring + streak semantics,
 * so the Storybook flow feels like the real loop. No numbers leak to UI
 * except coins and streak.
 */

// --- GameConfig (draft values from DESIGN tuning table / SPEC §15 drafts) ---

export const CONFIG = {
  // day plate targets in units per sector (≈ 50/25/25)
  dayTargets: { veg: 4, protein: 2, grain: 2 },
  // portion stops → total units of food
  portionUnits: [2, 3, 4],
  // coins = base 1 for any log + up to 2 bonus by contribution
  baseCoin: 1,
  bonusT1: 1.0, // contribution units → +1
  bonusT2: 2.0, // contribution units → +2
  // first N meals of the day earn full reward, later ones earn the base only
  fullRewardMeals: 4,
  // wholeness at or below this reads as processed → sluggish reaction
  processedMax: 0.45,
};

// --- Meal presets: what "the camera saw" ---
// proportions: fractions of the meal by sector (veg incl. fruit / protein / grain),
// the remainder is "other" (sauces, sweets, fat). wholeness: 1 whole … 0.2 ultra-processed.

export const MEAL_PRESETS = [
  {
    id: 'oatmeal',
    emoji: '🥣',
    title: 'Oatmeal & berries',
    proportions: { veg: 0.3, protein: 0.05, grain: 0.65 },
    wholeness: 0.95,
  },
  {
    id: 'salad',
    emoji: '🥗',
    title: 'Green bowl',
    proportions: { veg: 0.7, protein: 0.2, grain: 0.1 },
    wholeness: 1,
  },
  {
    id: 'chicken',
    emoji: '🍗',
    title: 'Chicken & buckwheat',
    proportions: { veg: 0.15, protein: 0.45, grain: 0.4 },
    wholeness: 0.9,
  },
  {
    id: 'apple',
    emoji: '🍎',
    title: 'An apple',
    proportions: { veg: 1, protein: 0, grain: 0 },
    wholeness: 1,
  },
  {
    id: 'borscht',
    emoji: '🍲',
    title: 'Borscht (hard to see)',
    proportions: { veg: 0.55, protein: 0.2, grain: 0.15 },
    wholeness: 0.85,
    confidence: 'low',
  },
  {
    id: 'pizza',
    emoji: '🍕',
    title: 'Pizza night',
    proportions: { veg: 0.05, protein: 0.15, grain: 0.55 },
    wholeness: 0.35,
  },
  {
    id: 'burger',
    emoji: '🍔',
    title: 'Burger & fries',
    proportions: { veg: 0.05, protein: 0.2, grain: 0.45 },
    wholeness: 0.3,
  },
  {
    id: 'sock',
    emoji: '🧦',
    title: 'Not food…',
    isFood: false,
  },
];

// --- Hero voice: a pool per reaction, picked at random (variable reward) ---

export const PHRASES = {
  happy: [
    'Ooo, delicious! I feel great!',
    'A feast worthy of a hero!',
    'Fresh as a forest morning!',
    'Mmm! The fire burns brighter already!',
  ],
  content: [
    'Nice little bite. Onward!',
    'Every meal goes in the journal!',
    'Thanks! I was getting peckish.',
  ],
  full: [
    "I'm cozy and full for today — but I wrote it all down!",
    'Phew, what a day of feasts! Into the journal it goes.',
  ],
  sluggish: [
    'So warm and heavy… zzz…',
    'Ugh… sits like a rock…',
    'Cozy… nap time…',
  ],
  unsure: [
    "Steam in my eyes… I'll trust you!",
    "Can't quite see… smells good though!",
  ],
  notFood: [
    "That's… not for eating!",
    'My tummy says no.',
  ],
};

export const VERDICT = {
  happy: 'A hero-worthy meal!',
  content: 'Logged in the journal!',
  full: 'Full for today!',
  sluggish: 'Heavy stuff…',
  unsure: 'Hard to see…',
  notFood: 'Hmm?',
};

export const REACTION_LABEL = {
  happy: 'Happy',
  content: 'Content',
  full: 'Full',
  sluggish: 'Sluggish',
  unsure: 'Unsure',
  notFood: 'Not food',
};

const pick = (pool) => pool[Math.floor(Math.random() * pool.length)];

/**
 * Core scoring: a meal contributes only to the UNFILLED part of the day plate.
 * Moderation is free — full sectors add nothing. Junk fills weakly (×wholeness)
 * but ANY log still earns the base coin (invariant #3).
 *
 * plate: units already on the day plate. slotsUsed: meals already logged today.
 * Returns everything ResultScreen needs.
 */
export function scoreMeal(plate, preset, portionIdx, slotsUsed) {
  if (preset.isFood === false) {
    return { kind: 'notFood', preset, reaction: 'notFood', verdict: VERDICT.notFood, speech: pick(PHRASES.notFood) };
  }

  const units = CONFIG.portionUnits[portionIdx] ?? CONFIG.portionUnits[1];
  const plateAfter = { ...plate };
  let contribution = 0;

  for (const key of Object.keys(CONFIG.dayTargets)) {
    const added = units * (preset.proportions[key] ?? 0) * preset.wholeness;
    const room = Math.max(0, CONFIG.dayTargets[key] - plate[key]);
    contribution += Math.min(added, room);
    plateAfter[key] = plate[key] + added; // plate keeps raw units; ring clamps visually
  }

  const slotCapped = slotsUsed >= CONFIG.fullRewardMeals;
  const bonus = slotCapped ? 0 : (contribution >= CONFIG.bonusT1 ? 1 : 0) + (contribution >= CONFIG.bonusT2 ? 1 : 0);
  const coins = CONFIG.baseCoin + bonus;

  const lowConfidence = preset.confidence === 'low';
  const processed = preset.wholeness <= CONFIG.processedMax;
  const stuffed = processed && portionIdx === 2;

  const reaction = lowConfidence ? 'unsure'
    : processed ? 'sluggish'
    : slotCapped ? 'full'
    : contribution >= CONFIG.bonusT1 ? 'happy'
    : 'content';

  return {
    kind: 'meal',
    preset,
    portionIdx,
    coins,
    contribution,
    plateBefore: plate,
    plateAfter,
    reaction,
    stuffed,
    slotCapped,
    lowConfidence,
    verdict: stuffed ? 'Ooof… a lot at once' : VERDICT[reaction],
    speech: stuffed ? 'Ugh… heavy. Something fresh tomorrow?' : pick(PHRASES[reaction]),
  };
}

/** Day plate units → 0..1 fractions for PlateRing. */
export function plateFractions(plate) {
  return {
    veg: Math.min(1, plate.veg / CONFIG.dayTargets.veg),
    protein: Math.min(1, plate.protein / CONFIG.dayTargets.protein),
    grain: Math.min(1, plate.grain / CONFIG.dayTargets.grain),
  };
}

export const EMPTY_PLATE = { veg: 0, protein: 0, grain: 0 };

// --- Hero Path: fire per day (SPEC §6 ember semantics, not "logged a little") ---
// 'lit' = day has a log · 'ember' = single missed day, streak paused, chain alive
// 'out' = fire went out (2+ missed), record survives forever.

export const WEEK_LIVE = [
  { day: 'Mon', fire: 'lit' },
  { day: 'Tue', fire: 'lit' },
  { day: 'Wed', fire: 'lit' },
  { day: 'Thu', fire: 'ember' },
  { day: 'Fri', fire: 'lit' },
  { day: 'Sat', fire: 'lit' },
  { day: 'Sun', fire: 'lit', today: true },
];

export const WEEK_WENT_OUT = [
  { day: 'Mon', fire: 'lit' },
  { day: 'Tue', fire: 'lit' },
  { day: 'Wed', fire: 'ember' },
  { day: 'Thu', fire: 'out' },
  { day: 'Fri', fire: 'out' },
  { day: 'Sat', fire: 'lit' },
  { day: 'Sun', fire: 'lit', today: true },
];

export const FIRE_EMOJI = { lit: '🔥', ember: '🟠', out: '⚫' };

// --- Trail biomes: the landscape changes as the TOTAL of logged days grows.
// Tied to cumulative days, never to the current streak — a burnt streak leaves
// dead campfires behind but the hero keeps every step of the map (invariant 6).
// The next biome is teased as a silhouette "beyond the bend" (return hook).

export const DAYS_PER_BIOME = 7;

export const BIOMES = [
  { id: 'forest', name: 'Whispering Forest', emoji: '🌲', tint: 'rgba(63,174,92,.12)' },
  { id: 'hills', name: 'Honey Hills', emoji: '🌾', tint: 'rgba(217,165,63,.14)' },
  { id: 'peaks', name: 'Flint Peaks', emoji: '🏔️', tint: 'rgba(120,140,170,.16)' },
  { id: 'lake', name: 'Mirror Lake', emoji: '🌊', tint: 'rgba(80,150,200,.14)' },
];

// --- Backpack catalog: decor / pets / themes only (hero outfits — after the D7 signal).
// Price tiers 5–10 / 20–40 / 60–100 vs earnings ~4–8 coins/day: a month of wants.

export const ITEMS = [
  { id: 'flowers', emoji: '🌼', name: 'Camp flowers', kind: 'decor', cost: 5 },
  { id: 'lantern', emoji: '🏮', name: 'Lantern', kind: 'decor', cost: 6 },
  { id: 'flag', emoji: '🚩', name: 'Camp flag', kind: 'decor', cost: 8 },
  { id: 'herbs', emoji: '🌿', name: 'Drying herbs', kind: 'decor', cost: 22 },
  { id: 'hammock', emoji: '🛖', name: 'Log shelter', kind: 'decor', cost: 28 },
  { id: 'tent', emoji: '⛺', name: 'Cozy tent', kind: 'decor', cost: 35 },
  { id: 'theme_lab', emoji: '🔬', name: 'Lab theme', kind: 'theme', theme: 'lab', cost: 40 },
  { id: 'theme_magic', emoji: '🔮', name: 'Magic theme', kind: 'theme', theme: 'magic', cost: 55 },
  { id: 'owl', emoji: '🦉', name: 'Night owl', kind: 'pet', cost: 60 },
  { id: 'squirrel', emoji: '🐿️', name: 'Camp squirrel', kind: 'pet', cost: 75 },
];

export const KIND_BADGE = { decor: '🏕️', pet: '🐾', theme: '🎨' };
