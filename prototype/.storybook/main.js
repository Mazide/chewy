/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: ['../src/core/**/*.stories.@(js|jsx)'],
  staticDirs: [
    '../public',
    { from: '../../content-pipeline/rive/hero-actions/preview', to: '/hero-actions' },
    { from: '../../content-pipeline/rive/hero-actions/exports', to: '/hero-actions/exports' },
    { from: '../../content-pipeline/rive/camp-scene-vector/preview/vendor/webgl2-2.40.1', to: '/hero-actions/vendor' },
  ],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');
    return mergeConfig(config, {
      esbuild: { jsx: 'automatic' },
      // Storybook owns staticDirs; Vite copying public in parallel races mkdir.
      build: { copyPublicDir: false },
    });
  },
};

export default config;
