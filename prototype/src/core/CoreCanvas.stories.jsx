import { CoreOverview, CoreSkeleton } from './CoreSkeleton.jsx';
import * as skeleton from './CoreSkeleton.stories.jsx';

export default {
  ...skeleton.default,
  title: 'Core/Canvas',
  render: (args) => <CoreSkeleton key={JSON.stringify(args)} {...args} presentation="canvas" />,
};

export const Walkthrough = { ...skeleton.Walkthrough };
export const CampWithMeal = { ...skeleton.CampWithMeal };
export const CampFullDay = { ...skeleton.CampFullDay };
export const Overview = { ...skeleton.Overview, render: () => <CoreOverview presentation="canvas" /> };
export const AddFood = { ...skeleton.AddFood };
export const Result = { ...skeleton.Result };
export const Path = { ...skeleton.Path };
export const Backpack = { ...skeleton.Backpack };
