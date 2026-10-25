import { BackpackScreen } from './BackpackScreen.jsx';

export default {
  title: 'Screens/BackpackScreen',
  component: BackpackScreen,
};

/** Fresh camper: only the cheap decor tier is reachable. */
export const Fresh = { args: { coins: 8 } };

/** Mid-journey: pet by the showcase, lantern equipped, magic theme owned. */
export const Equipped = {
  args: {
    coins: 34,
    owned: ['lantern', 'flag', 'owl', 'theme_magic'],
    equipped: { pet: 'owl', decor: 'lantern', theme: 'magic' },
  },
};
