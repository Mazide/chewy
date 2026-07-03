import '../src/theme.css';

/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    layout: 'centered',
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    backgrounds: {
      default: 'chewy-green',
      values: [
        { name: 'chewy-green', value: '#2e9e4f' },
        { name: 'camera-dark', value: '#141414' },
        { name: 'light', value: '#f5f5f5' },
      ],
    },
  },
};

export default preview;
