import { ResultScreen } from './ResultScreen.jsx';
import { MEAL_PRESETS, EMPTY_PLATE, scoreMeal } from '../data/game.js';

export default {
  title: 'Screens/ResultScreen',
  component: ResultScreen,
};

const preset = (id) => MEAL_PRESETS.find((p) => p.id === id);

/** First meal of the day: big contribution → happy, full reward. */
export const FirstMealHappy = {
  args: { result: scoreMeal(EMPTY_PLATE, preset('salad'), 1, 0) },
};

/** Pizza XL in the evening, grains already full → tiny contribution, min coin, stuffed phrase. No shame. */
export const JunkEvening = {
  args: { result: scoreMeal({ veg: 1, protein: 1, grain: 2 }, preset('pizza'), 2, 2) },
};

/** An apple as a snack while veg is still unfilled → honest reward (fixes the 50/25/25 snack trap). */
export const AppleSnack = {
  args: { result: scoreMeal({ veg: 1.5, protein: 2, grain: 2 }, preset('apple'), 0, 2) },
};

/** 5th meal of the day: anti-farm cap → base coin only, gentle note, streak untouched. */
export const FifthMealCapped = {
  args: { result: scoreMeal(EMPTY_PLATE, preset('chicken'), 1, 4) },
};

/** Gemini not sure (soup, steam) → hero admits it, log still counts. */
export const LowConfidence = {
  args: { result: scoreMeal(EMPTY_PLATE, preset('borscht'), 1, 1) },
};

/** Troll photo → playful reaction, no log, no coins. */
export const NotFood = {
  args: { result: scoreMeal(EMPTY_PLATE, preset('sock'), 1, 0) },
};
