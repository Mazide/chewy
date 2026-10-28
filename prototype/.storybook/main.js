/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: ['../src/core/**/*.stories.@(js|jsx)'],
  staticDirs: ['../public'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');
    return mergeConfig(config, {
      esbuild: { jsx: 'automatic' },
    });
  },
};

export default config;
