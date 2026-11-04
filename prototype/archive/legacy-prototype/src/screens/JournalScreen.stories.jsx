import { JournalScreen } from './JournalScreen.jsx';

export default {
  title: 'Screens/JournalScreen',
  component: JournalScreen,
};

const meals = [
  { emoji: '🥣', title: 'Morning porridge', time: '08:15' },
  { emoji: '🍗', title: 'Roast & veggies', time: '13:40' },
];

export const Empty = { args: { meals: [], mood: 'idle' } };
export const TwoMeals = {
  args: { meals, mood: 'happy', plate: { veg: 0.5, protein: 0.6, grain: 0.3 } },
};
