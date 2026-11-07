/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: ['../src/core/**/*.stories.@(js|jsx)'],
  staticDirs: [
    '../public',
    { from: '../../content-pipeline/rive/hero-actions/preview', to: '/hero-actions' },
    { from: '../../content-pipeline/rive/hero-actions/exports', to: '/hero-actions/exports' },
    { from: '../../content-pipeline/rive/camp-scene-vector/preview/vendor/webgl2-2.40.1', to: '/hero-actions/vendor' },
    { from: '../../content-pipeline/rive/camp-daily-states/preview', to: '/camp-states' },
    { from: '../../content-pipeline/rive/camp-daily-states/exports', to: '/camp-states/exports' },
    { from: '../../content-pipeline/rive/motion-pilot/preview', to: '/motion-pilot/preview' },
    { from: '../../content-pipeline/rive/motion-pilot/exports', to: '/motion-pilot/exports' },
    { from: '../../content-pipeline/rive/camp-scene-vector/preview/vendor/webgl2-2.40.1', to: '/motion-pilot/vendor' },
    { from: '../../content-pipeline/rive/hero-motion-pilot/preview', to: '/hero-motion-pilot/preview' },
    { from: '../../content-pipeline/rive/hero-motion-pilot/exports', to: '/hero-motion-pilot/exports' },
    { from: '../../content-pipeline/rive/camp-scene-vector/preview/vendor/webgl2-2.40.1', to: '/hero-motion-pilot/vendor' },
    { from: '../../content-pipeline/rive/hero-video-pilot/preview', to: '/hero-video-pilot/preview' },
    { from: '../../content-pipeline/rive/hero-video-pilot/exports', to: '/hero-video-pilot/exports' },
    { from: '../../content-pipeline/rive/hero-video-pilot/chewy/assets', to: '/hero-video-pilot/reference' },
    { from: '../../content-pipeline/rive/camp-scene-vector/preview/vendor/webgl2-2.40.1', to: '/hero-video-pilot/vendor' },
    { from: '../../content-pipeline/rive/hero-vector-reference/preview', to: '/hero-vector-reference/preview' },
    { from: '../../content-pipeline/rive/hero-vector-reference/exports', to: '/hero-vector-reference/exports' },
    { from: '../../content-pipeline/rive/hero-video-pilot/chewy/assets', to: '/hero-vector-reference/reference' },
    { from: '../../content-pipeline/rive/camp-scene-vector/preview/vendor/webgl2-2.40.1', to: '/hero-vector-reference/vendor' },
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
