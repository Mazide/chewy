import { HomeScreen } from './HomeScreen.jsx';

export default {
  title: 'Screens/HomeScreen',
  component: HomeScreen,
  parameters: { layout: 'centered', backgrounds: { default: 'light' } },
  argTypes: {
    status: { control: 'inline-radio', options: ['idle', 'eating', 'happy'] },
  },
  args: { status: 'idle', meals: [] },
};

export const Empty = { args: { status: 'idle', meals: [] } };

export const WithMeals = {
  args: {
    status: 'happy',
    meals: [
      { emoji: '🥣', title: 'Medium portion', time: '08:15' },
      { emoji: '🍗', title: 'Large portion', time: '13:30' },
    ],
  },
};

export const Eating = { args: { status: 'eating', meals: [] } };
