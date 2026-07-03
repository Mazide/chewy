// Screenshot Storybook stories via Chromium (Playwright).
// Usage: node scripts/shoot.mjs [storyId ...]
// Serves ./storybook-static and captures the #storybook-root element.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../storybook-static', import.meta.url).pathname;
const OUT = new URL('../shots', import.meta.url).pathname;
const PORT = 6199;

const DEFAULT_STORIES = [
  'screens-homescreen--empty',
  'screens-homescreen--with-meals',
  'screens-homescreen--eating',
  'screens-addfoodscreen--default',
  'screens-addfoodscreen--analyzing',
  'components-hero--all-states',
];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.map': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((r) => server.listen(PORT, r));
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const stories = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_STORIES;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 900, height: 820 } });

for (const id of stories) {
  await page.goto(`http://localhost:${PORT}/iframe.html?id=${id}&viewMode=story`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(1600); // let video buffer + sprite sheet load
  const root = page.locator('#storybook-root > *').first();
  const out = join(OUT, `${id}.png`);
  await root.screenshot({ path: out });
  console.log('shot', out);
}

await browser.close();
server.close();
