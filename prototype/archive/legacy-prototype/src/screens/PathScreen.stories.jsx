import { PathScreen } from './PathScreen.jsx';

export default {
  title: 'Screens/PathScreen',
  component: PathScreen,
};

const lit = (n) => Array.from({ length: n }, () => ({ fire: 'lit' }));

/** Day 3: still in the Whispering Forest, Honey Hills teased beyond the bend. */
export const FirstSteps = { args: { streak: 3, record: 3, days: lit(3) } };

/** Day 16: two biomes behind, one ember pause on the way — journey went on. */
export const SecondBiome = {
  args: {
    streak: 7,
    record: 9,
    days: [...lit(10), { fire: 'ember' }, ...lit(5)],
  },
};

/** The fire went out for 2 days once — streak restarted, but the map keeps
 *  every step: cumulative days always walk forward (invariant 6). */
export const BurntButKeptMap = {
  args: {
    streak: 4,
    record: 11,
    days: [...lit(11), { fire: 'out' }, { fire: 'out' }, ...lit(4)],
  },
};
