import { HomeScreen } from './HomeScreen.jsx';

export default {
  title: 'Screens/HomeScreen',
  component: HomeScreen,
  parameters: { layout: 'centered', backgrounds: { default: 'light' } },
  argTypes: {
    status: { control: 'inline-radio', options: ['idle', 'hungry', 'eating', 'happy'] },
  },
};

/** Morning, nothing logged: hero is hungry, the fire is dozing. */
export const MorningHungry = { args: { status: 'hungry', meals: [], fedToday: false, coins: 24 } };

/** Fed day: bright fire, mini day plate filling, log entries. */
export const FedDay = {
  args: {
    status: 'happy',
    fedToday: true,
    coins: 29,
    plate: { veg: 0.55, protein: 0.9, grain: 0.6 },
    meals: [
      { emoji: '🥣', title: 'Oatmeal & berries', time: '08:15' },
      { emoji: '🍗', title: 'Chicken & buckwheat', time: '13:30' },
    ],
  },
};

/** Cosmetics live in the scene: pet by the fire, lantern, magic theme equipped. */
export const WithCosmetics = {
  args: {
    status: 'idle',
    fedToday: true,
    coins: 4,
    plate: { veg: 0.3, protein: 0.5, grain: 0.4 },
    meals: [{ emoji: '🥗', title: 'Green bowl', time: '12:10' }],
    equipped: { pet: 'owl', decor: 'lantern', theme: 'magic' },
  },
};
