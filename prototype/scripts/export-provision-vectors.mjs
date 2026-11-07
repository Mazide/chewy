// Preserve the existing authored backpack drawing as editable SVG references.
import { build } from 'esbuild';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, '../content-pipeline/rive/camp-component-states/references');
const temp = await mkdtemp(path.join(tmpdir(), 'chewy-provisions-vector-'));
try {
  const file = path.join(temp, 'render.cjs');
  await build({ stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { CampProvisions } from './src/core/CampProvisions.jsx'; export const render = stage => renderToStaticMarkup(React.createElement(CampProvisions, {stage}));`, resolveDir: root, loader: 'jsx' }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile: file });
  const { render } = createRequire(import.meta.url)(file);
  await mkdir(output, { recursive: true });
  for (const stage of ['resting', 'first', 'stocked', 'full', 'extra']) {
    const svg = render(stage).match(/<svg[\s\S]*<\/svg>/)[0];
    await writeFile(path.join(output, `provisions-${stage}.svg`), svg + '\n');
  }
  console.log('Exported five existing backpack drawings.');
} finally { await rm(temp, { recursive: true, force: true }); }
