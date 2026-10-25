// Bring the native SpriteKit atlas animations into the web prototype.
//
// - Hero (needs alpha)  → a single PNG sprite sheet + meta JSON. The <Hero>
//   component draws frames to a canvas, replicating HeroScene.swift timing.
// - Background (opaque) → a looping WebM (VP8) played via <video>.
//
// The bundled Playwright ffmpeg is built with --disable-everything and only
// decodes MJPEG, so the background is piped in as JPEG frames; the hero keeps
// its transparency via the PNG sheet.
//
// Requires: sharp (dev only) + Playwright ffmpeg. Run: node scripts/encode-assets.mjs
import sharp from 'sharp';
import { spawn } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FF = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const AX = '/home/user/chewy/chewy/chewy/Assets.xcassets';
const OUT = new URL('../public/assets', import.meta.url).pathname;

function frames(atlas, prefix) {
  const dir = join(AX, atlas);
  return readdirSync(dir)
    .filter((d) => d.startsWith(prefix) && d.endsWith('.imageset'))
    .sort()
    .map((d) => join(dir, d, `${d.replace('.imageset', '')}@2x.png`));
}

// ── Hero sprite sheet (alpha preserved) ─────────────────────────────────────
async function heroSheet() {
  const files = frames('hero.spriteatlas', 'idle_');
  const fw = 152, fh = 318, cols = 11;
  const rows = Math.ceil(files.length / cols);
  const tiles = await Promise.all(
    files.map(async (f, i) => ({
      input: await sharp(f).resize(fw, fh, { fit: 'fill' }).png().toBuffer(),
      left: (i % cols) * fw,
      top: Math.floor(i / cols) * fh,
    }))
  );
  await sharp({
    create: { width: cols * fw, height: rows * fh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(tiles)
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, 'hero_idle_sheet.png'));
  const meta = { frameW: fw, frameH: fh, cols, rows, count: files.length, fps: 24 };
  writeFileSync(join(OUT, 'hero_idle.json'), JSON.stringify(meta, null, 2));
  console.log('wrote hero_idle_sheet.png', `${files.length} frames, ${cols * fw}x${rows * fh}`);
}

// ── Background WebM (opaque, MJPEG-piped) ────────────────────────────────────
async function backgroundWebm() {
  const files = frames('background.spriteatlas', 'klbackground_');
  const w = 400, h = 744;
  const ff = spawn(
    FF,
    ['-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '24', '-i', 'pipe:0',
     '-c:v', 'libvpx', '-pix_fmt', 'yuv420p', '-b:v', '1800k', join(OUT, 'background.webm')],
    { stdio: ['pipe', 'ignore', 'ignore'] }
  );
  for (const f of files) {
    const buf = await sharp(f).resize(w, h, { fit: 'fill' }).jpeg({ quality: 88 }).toBuffer();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  console.log('wrote background.webm', `${files.length} frames @ ${w}x${h}`);
}

await heroSheet();
await backgroundWebm();
