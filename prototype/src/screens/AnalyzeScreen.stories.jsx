import { AnalyzeScreen } from './AnalyzeScreen.jsx';

export default {
  title: 'Screens/AnalyzeScreen',
  component: AnalyzeScreen,
  argTypes: {
    theme: { control: 'select', options: ['tavern', 'lab', 'magic'] },
  },
};

export const Tavern = { args: { theme: 'tavern' } };
export const Laboratory = { args: { theme: 'lab' } };
export const Magic = { args: { theme: 'magic' } };
