import { ScreenStudy } from './ScreenStudy.jsx';

export default {
  title: 'Прототип',
  id: 'prototype',
  component: ScreenStudy,
  parameters: { layout: 'padded', controls: { disable: true } },
};

export const App = {
  name: 'Приложение',
  // Keep the existing entry URL and the owner's per-story review preferences.
  parameters: { __id: 'core-sandbox--all-screens' },
  render: () => <ScreenStudy presentation="content" initialScreen="camp" reviewMode="prototype" />,
};
