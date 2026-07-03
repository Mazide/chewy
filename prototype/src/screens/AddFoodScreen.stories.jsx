import { AddFoodScreen } from './AddFoodScreen.jsx';

export default {
  title: 'Screens/AddFoodScreen',
  component: AddFoodScreen,
  parameters: { layout: 'centered', backgrounds: { default: 'light' } },
  argTypes: { analyzing: { control: 'boolean' } },
  args: { analyzing: false },
};

export const Default = { args: { analyzing: false } };
export const Analyzing = { args: { analyzing: true } };
