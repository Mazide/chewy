/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    options: { storySort: { order: ['Прототип', 'Онбординг', 'Состояния', 'Мастерская', 'Отложено'] } },
    layout: 'centered',
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#f5f5f5' },
      ],
    },
  },
};

export default preview;
