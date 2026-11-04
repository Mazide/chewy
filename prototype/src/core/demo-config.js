// Prototype fixtures only. These values do not define the final product economy.
export const DEMO_REWARDS = Object.freeze({
  baseCoins: 10,
  baseMultiplier: 1,
  multiplierStep: 0.1,
  maxMultiplier: 2,
  graceDays: 2,
  decayPerDay: 0.1,
});

// Visibility windows for placeholder reactions, not final product timing.
export const HERO_DEMO_TIMING = Object.freeze({
  happyMs: 60_000,
  returnAfterMs: 6 * 60 * 60 * 1000,
});

// Prices exercise buying and insufficient funds; they are not the product economy.
export const DEMO_GARDEN_COSTS = Object.freeze({
  'garden-base': 0,
  flowers: 5,
  'garden-lush': 8,
  'garden-bloom': 30,
});
