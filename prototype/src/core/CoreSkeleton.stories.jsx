import { CoreOverview, CoreSkeleton } from './CoreSkeleton.jsx';
import { ITEMS } from '../data/game.js';

export default {
  title: 'Core/Skeleton',
  component: CoreSkeleton,
  parameters: { backgrounds: { default: 'light' }, controls: { disable: true } },
  render: (args) => <CoreSkeleton key={JSON.stringify(args)} {...args} />,
};

export const Walkthrough = { name: 'Начать с лагеря' };
export const CampWithMeal = { name: 'Лагерь · после еды', args: { seeded: true } };
export const CampFullDay = { name: 'Лагерь · длинный список', args: { initialMealCount: 5 } };
export const Overview = { name: 'Все экраны', render: () => <CoreOverview />, parameters: { layout: 'padded' } };
export const AddFood = { name: 'Добавить еду', args: { initialScreen: 'add' } };
export const Result = { name: 'Результат', args: { initialScreen: 'result', seeded: true } };
export const Path = { name: 'Путь', args: { initialScreen: 'path', seeded: true } };
export const Backpack = { name: 'Рюкзак · можно купить', args: { initialScreen: 'backpack', initialCoins: ITEMS.find((item) => item.id === 'lantern').cost } };
