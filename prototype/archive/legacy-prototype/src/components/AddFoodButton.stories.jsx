import { AddFoodButton } from './AddFoodButton.jsx';

export default {
  title: 'Components/AddFoodButton',
  component: AddFoodButton,
  argTypes: { size: { control: { type: 'range', min: 48, max: 120, step: 4 } } },
  args: { size: 80 },
};

export const Default = {};
