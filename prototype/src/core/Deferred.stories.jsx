import { ScreenStudy } from './ScreenStudy.jsx';

export default {
  title: 'Онбординг',
  id: 'deferred-intro',
  component: ScreenStudy,
  parameters: { layout: 'padded', controls: { disable: true } },
  render: args => <ScreenStudy key={JSON.stringify(args)} presentation="content" reviewMode="onboarding" initialCoins={0} initialPath="first" initialEmpty {...args} />,
};

export const Welcome = { name: 'Первый запуск', args: { initialScreen: 'welcome' }, parameters: { __id: 'core-sandbox--welcome' } };
export const Name = { name: 'Имя', args: { initialScreen: 'name' }, parameters: { __id: 'core-sandbox--name' } };
export const Reminders = { name: 'Напоминания · отдельная проба', args: { initialScreen: 'reminders' }, parameters: { __id: 'core-sandbox--reminders' } };
