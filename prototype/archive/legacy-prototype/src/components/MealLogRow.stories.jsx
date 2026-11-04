import { MealLogRow } from './MealLogRow.jsx';

export default {
  title: 'Components/MealLogRow',
  component: MealLogRow,
  args: { emoji: '🥩', title: 'Large portion', time: '13:45' },
};

export const Default = {};

export const List = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 280 }}>
      <MealLogRow emoji="🥣" title="Medium portion" time="08:15" />
      <MealLogRow emoji="🍗" title="Large portion" time="13:30" />
      <MealLogRow emoji="🍕" title="Full portion" time="19:45" />
    </div>
  ),
};
