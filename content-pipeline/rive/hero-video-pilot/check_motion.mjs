// Verify the original raster sequence inside a real, standalone WebGL2 .riv.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(new URL('../../../prototype/package.json', import.meta.url));
const { chromium } = require('playwright');
const execute = promisify(execFile);
const args = process.argv.slice(2), url = args[0], outIndex = args.indexOf('--out');
if (!url || outIndex < 0 || !args[outIndex + 1]) throw new Error('Usage: node check_motion.mjs <review-url> --out <output-dir>');
const output = path.resolve(args[outIndex + 1]);
await mkdir(path.join(output, 'frames'), { recursive: true });
await mkdir(path.join(output, 'embedded'), { recursive: true });
const manifestURL = new URL('../exports/manifest.json', url);
const manifest = await (await fetch(manifestURL)).json();
const duration = manifest.duration_seconds ?? manifest.duration;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1200, height: 1120 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const report = { passed: false, preview_url: url, original_frame_count: manifest.frame_count,
  fps: manifest.fps, duration_seconds: duration, artistic_approval: false, native_ios_tested: false,
  versions: { chromium: browser.version(), playwright: require('playwright/package.json').version, rive_webgl2: '2.40.1' },
  checks: {}, pairs: [], browser_errors: errors };
const hash = value => createHash('sha256').update(value).digest('hex');
async function ready(target) {
  await target.waitForFunction(() => window.heroVideoPilot);
  await target.evaluate(async () => { await window.heroVideoPilot.ready; });
  const state = await target.evaluate(() => window.heroVideoPilot.state());
  assert.equal(state.ready, true, JSON.stringify(state)); return state;
}
async function shot(target, version, name) {
  const filename = `frames/${name}-${version}.png`;
  const bytes = await target.locator(`canvas[data-version="${version}"]`).screenshot({ path: path.join(output, filename) });
  return { filename, sha256: hash(bytes) };
}
async function pair(name) {
  const entry = { name, state: await page.evaluate(() => window.heroVideoPilot.state()),
    reference: await shot(page, 'reference', name), rive: await shot(page, 'rive', name) };
  report.pairs.push(entry); return entry;
}
try {
  await page.goto(url); const initial = await ready(page);
  assert.equal(initial.playing, false); assert.equal(initial.frameCount, 121); assert.equal(initial.fps, 24);
  for (const frame of [0, 1, 24, 48, 60, 72, 96, 120]) {
    await page.evaluate(async frame => { await window.heroVideoPilot.captureFrame(frame); }, frame);
    assert.equal((await page.evaluate(() => window.heroVideoPilot.state())).frame, frame);
    await pair(`light-${String(frame).padStart(3, '0')}`);
  }
  await page.evaluate(() => window.heroVideoPilot.setBackground('dark'));
  for (const frame of [0, 24, 60, 96, 120]) {
    await page.evaluate(async frame => { await window.heroVideoPilot.captureFrame(frame); }, frame);
    await pair(`dark-${String(frame).padStart(3, '0')}`);
  }
  await page.evaluate(() => window.heroVideoPilot.setBackground('light'));
  await page.evaluate(async () => { await window.heroVideoPilot.captureFrame(60); });
  const stationary = await shot(page, 'rive', 'paused-before');
  await page.waitForTimeout(250);
  assert.equal((await shot(page, 'rive', 'paused-after')).sha256, stationary.sha256);
  await page.evaluate(() => window.heroVideoPilot.replay());
  await page.waitForTimeout(1600); await page.evaluate(() => window.heroVideoPilot.pause());
  const mid = await pair('native-mid'); assert.ok(mid.state.frame > 15 && mid.state.frame < 80);
  await page.evaluate(() => window.heroVideoPilot.resume());
  await page.waitForFunction(() => window.heroVideoPilot.state().finished, null, { timeout: 8000 });
  const end = await pair('native-end'); assert.equal(end.state.frame, 120); assert.equal(end.state.playing, false);
  await page.waitForTimeout(300); assert.equal((await shot(page, 'rive', 'native-end-held')).sha256, end.rive.sha256);
  await page.evaluate(() => window.heroVideoPilot.replay()); await page.waitForTimeout(700);
  await page.evaluate(() => window.heroVideoPilot.pause());
  const replayed = await pair('native-replay'); assert.ok(replayed.state.frame > 4 && replayed.state.frame < 45);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => !window.heroVideoPilot.state().reducedMotion);
  await page.evaluate(() => window.heroVideoPilot.replay()); await page.waitForTimeout(400);
  await page.waitForFunction(() => window.heroVideoPilot.state().frame > 2);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    await page.waitForFunction(() => window.heroVideoPilot.state().reducedMotion && !window.heroVideoPilot.state().playing, null, { polling: 50, timeout: 5000 });
  } catch (error) {
    report.reduced_motion_failure_state = await page.evaluate(() => window.heroVideoPilot.state());
    throw error;
  }
  const reduced = await shot(page, 'rive', 'live-reduced-motion'); await page.waitForTimeout(200);
  assert.equal((await shot(page, 'rive', 'live-reduced-motion-held')).sha256, reduced.sha256);
  const reducedPair = await pair('native-reduced-paused');
  await page.evaluate(() => window.heroVideoPilot.resume()); await page.waitForTimeout(300);
  await page.evaluate(() => window.heroVideoPilot.pause());
  const resumedReduced = await pair('native-explicit-resume-reduced');
  assert.ok(resumedReduced.state.frame > reducedPair.state.frame, 'Explicit resume under reduced motion did not advance');
  report.checks.playback_pause_resume_one_shot_replay_and_reduced_motion = true;
  await page.evaluate(async () => { await window.heroVideoPilot.capture(4); });
  await page.screenshot({ path: path.join(output, 'viewer-desktop.png'), fullPage: true });
  await page.locator('#size').click(); await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(output, 'viewer-camp-scale.png'), fullPage: true });
  await page.locator('#size').click(); await page.waitForTimeout(120);
  await page.evaluate(() => window.heroVideoPilot.setBackground('checker'));
  await page.screenshot({ path: path.join(output, 'viewer-checker.png'), fullPage: true });
  await page.evaluate(() => window.heroVideoPilot.setBackground('light'));

  // A fresh context has no prepared-frame cache; every PNG request is blocked.
  // Only .riv + the official runtime may supply the right-hand images.
  const embedContext = await browser.newContext({ viewport: { width: manifest.width, height: manifest.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const embedded = await embedContext.newPage();
  const pngRequests = [];
  await embedded.route(/\.(png|webp|jpe?g)(\?|$)/i, route => { pngRequests.push(route.request().url()); return route.abort(); });
  embedded.on('pageerror', error => errors.push(error.message));
  await embedded.goto(new URL('../exports/manifest.json', url).href);
  await embedded.setContent(`<style>html,body{margin:0;background:transparent}canvas{display:block;width:${manifest.width}px;height:${manifest.height}px}</style><canvas width="${manifest.width}" height="${manifest.height}"></canvas>`);
  await embedded.addScriptTag({ url: new URL('../vendor/rive.js', url).href });
  await embedded.evaluate(async ({ manifest, rivURL, wasmURL, fallbackURL }) => {
    rive.RuntimeLoader.setWasmUrl(wasmURL); rive.RuntimeLoader.setWasmFallbackUrl(fallbackURL); await rive.RuntimeLoader.awaitInstance();
    const buffer = await (await fetch(rivURL)).arrayBuffer();
    let freeze = false;
    await new Promise((resolve, reject) => {
      window.embeddedPlayer = new rive.Rive({ buffer, canvas: document.querySelector('canvas'), artboard: manifest.artboard,
        animations: manifest.animation, autoplay: false, enableRiveAssetCDN: false,
        drawingOptions: rive.DrawOptimizationOptions.AlwaysDraw, layout: new rive.Layout({ fit: rive.Fit.Contain }),
        onLoad: () => queueMicrotask(() => { window.embeddedPlayer.resizeDrawingSurfaceToCanvas(1); resolve(); }),
        onLoadError: () => reject(new Error('Standalone .riv did not load')),
        onAdvance: () => { if (freeze) { freeze = false; window.embeddedPlayer.pause(); window.embeddedPlayer.stopRendering(); } },
      });
    });
    window.embedCapture = async time => {
      const p = window.embeddedPlayer; p.pause(); p.stopRendering();
      p.reset({ artboard: manifest.artboard, animations: manifest.animation, autoplay: false }); p.scrub(manifest.animation, time);
      freeze = true; p.startRendering();
      for (let i = 0; i < 3; i++) await new Promise(resolve => requestAnimationFrame(resolve));
      p.pause(); p.stopRendering();
    };
  }, { manifest, rivURL: new URL(manifest.rive_file, manifestURL).href, wasmURL: new URL('../vendor/rive.wasm', url).href, fallbackURL: new URL('../vendor/rive_fallback.wasm', url).href });
  for (let index = 0; index < manifest.frame_count; index++) {
    await embedded.evaluate(async time => { await window.embedCapture(time); }, (index + 0.5) / manifest.fps);
    await embedded.locator('canvas').screenshot({ path: path.join(output, 'embedded', `frame-${String(index).padStart(3, '0')}.png`), omitBackground: true });
  }
  for (const frame of [1, 60, 120]) {
    for (const side of ['before', 'after']) {
      const time = (frame + (side === 'before' ? -0.001 : 0.001)) / manifest.fps;
      await embedded.evaluate(async time => { await window.embedCapture(time); }, time);
      await embedded.locator('canvas').screenshot({ path: path.join(output, 'embedded', `boundary-${frame}-${side}.png`), omitBackground: true });
    }
  }
  assert.deepEqual(pngRequests, []); await embedContext.close();
  report.checks.standalone_riv_without_external_images = true;
  report.checks.all_frames_rendered = manifest.frame_count;

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const mobile = await mobileContext.newPage(); mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(url); await ready(mobile); await mobile.evaluate(async () => { await window.heroVideoPilot.capture(4); });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.screenshot({ path: path.join(output, 'viewer-mobile.png'), fullPage: true }); await mobileContext.close();
  const failed = await context.newPage();
  await failed.route('**/chewy-video.riv', route => route.fulfill({ status: 404, body: 'missing fixture' }));
  await failed.goto(url); await failed.locator('#error').waitFor({ state: 'visible' });
  assert.equal(await failed.locator('#replay').isDisabled(), true);
  await failed.unroute('**/chewy-video.riv'); await failed.locator('#retry').click(); await ready(failed);
  assert.equal(await failed.locator('#error').isVisible(), false); await failed.close();
  report.checks.mobile_and_retry_recovery = true;
  await writeFile(path.join(output, 'pairs.json'), JSON.stringify(report.pairs, null, 2));
  const sourceFrames = new URL('chewy/assets/', import.meta.url).pathname;
  const { stdout } = await execute('python3', ['-c', String.raw`
from pathlib import Path
import json,sys
import numpy as np
from PIL import Image,ImageDraw,ImageFont
out=Path(sys.argv[1]);source=Path(sys.argv[2]);pairs=json.loads((out/'pairs.json').read_text())
def rgba(path):return np.asarray(Image.open(path).convert('RGBA'),dtype=np.float32)
def premultiply(a):
    value=a.copy();value[:,:,:3]*=value[:,:,3:]/255;return value
def compare(a,b):
    assert a.shape==b.shape,(a.shape,b.shape)
    d=np.abs(premultiply(a)-premultiply(b));alpha=np.abs(a[:,:,3]-b[:,:,3]);return {'mean_premultiplied_delta':float(d.mean()),'max_premultiplied_delta':float(d.max()),'max_alpha_delta':float(alpha.max())}
frames=[]
for i in range(121):
    expected=rgba(source/('frame-%03d.png'%i));actual=rgba(out/'embedded'/('frame-%03d.png'%i));r=compare(expected,actual)
    assert actual[:,:,3].min()==0 and actual[:,:,3].max()==255,'embedded PNG lost useful transparency'
    assert r['mean_premultiplied_delta']<=.25 and r['max_premultiplied_delta']<=8 and r['max_alpha_delta']<=3,('frame mismatch',i,r)
    frames.append(r)
boundaries=[]
for i in [1,60,120]:
    for side,expected in [('before',i-1),('after',i)]:
        r=compare(rgba(source/('frame-%03d.png'%expected)),rgba(out/'embedded'/('boundary-%s-%s.png'%(i,side))))
        assert r['mean_premultiplied_delta']<=.25 and r['max_premultiplied_delta']<=8,('boundary timing mismatch',i,side,r)
        boundaries.append({'frame':i,'side':side,**r})
composites=[]
for pair in pairs:
    a=rgba(out/pair['reference']['filename']);b=rgba(out/pair['rive']['filename']);d=np.abs(a-b)
    r={'name':pair['name'],'frame':pair['state']['frame'],'mean_channel_delta':float(d.mean()),'max_channel_delta':float(d.max())}
    assert r['mean_channel_delta']<=.02 and r['max_channel_delta']<=3,('reference/Rive composite mismatch',r)
    composites.append(r)
result={'all_121_frames_match':True,'alpha_preserved':True,'frames':frames,'boundaries':boundaries,'composites':composites,
        'max_frame_mean_delta':max(x['mean_premultiplied_delta'] for x in frames),'max_frame_channel_delta':max(x['max_premultiplied_delta'] for x in frames)}
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';title=ImageFont.truetype(font,22);small=ImageFont.truetype(font,15)
ids=[0,24,48,60,72,96,108,120];cw,ch=200,440;sheet=Image.new('RGB',(cw*4+40,ch*2+100),'#f5f1e7');draw=ImageDraw.Draw(sheet)
draw.text((20,18),'Исходное движение Чуви внутри Rive',font=title,fill='#2d3529');draw.text((20,51),'Без новых поз. Один эпизод; последний кадр отличается от первого.',font=small,fill='#65705b')
for j,i in enumerate(ids):
    im=Image.open(out/'embedded'/('frame-%03d.png'%i)).convert('RGBA');im.thumbnail((cw-20,ch-35),Image.Resampling.LANCZOS)
    x=20+(j%4)*cw+(cw-im.width)//2;y=85+(j//4)*ch;sheet.paste(im,(x,y),im)
    draw.text((25+(j%4)*cw,y+ch-26),'Кадр %s · %.2f с'%(i+1,i/24),font=small,fill='#2d3529')
sheet.save(out/'sequence-contact-sheet.png');(out/'pixel-qa.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
`, output, sourceFrames], { maxBuffer: 1024 * 1024 });
  report.pixel_qa = JSON.parse(stdout);

  const recording = await browser.newContext({ viewport: { width: 1200, height: 1120 }, deviceScaleFactor: 1, reducedMotion: 'reduce', recordVideo: { dir: path.join(output, 'video'), size: { width: 1200, height: 1120 } } });
  const review = await recording.newPage(); review.on('pageerror', error => errors.push(error.message));
  try { await review.goto(url); await ready(review); await review.waitForTimeout(400); await review.evaluate(() => window.heroVideoPilot.replay()); await review.waitForTimeout(5500); await review.waitForTimeout(500); await review.evaluate(() => window.heroVideoPilot.replay()); await review.waitForTimeout(5500); }
  finally { await recording.close(); }
  await copyFile(await review.video().path(), path.join(output, 'review.webm'));
  await execute('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(output, 'review.webm'), '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, 'review.mp4')]);
  assert.deepEqual(errors, []); report.passed = true;
  report.review = { video: 'review.mp4', sequence: 'sequence-contact-sheet.png' };
  console.log(`PASS: all 121 original frames + alpha embedded in Rive, source timing, native playback/replay/pause, light/dark comparison, mobile and retry. ${output}`);
} catch (error) { report.failure = error.stack || String(error); throw error; }
finally { await writeFile(path.join(output, 'qa.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
