// Runtime QA for a vector rig using raster video frames as a visual reference.
// The two artworks are deliberately NOT compared for pixel equality.
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
await mkdir(path.join(output, 'standalone'), { recursive: true });
const manifestURL = new URL('../exports/manifest.json', url);
const manifest = await (await fetch(manifestURL)).json();
const duration = manifest.duration_seconds ?? manifest.duration;
// Include the two skin-deformation danger points found in the native audit.
const times = [0, 40 / 24, 2.4, 3.2, 91 / 24, 4, 4.6, duration];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1200, height: 1120 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [], hash = bytes => createHash('sha256').update(bytes).digest('hex');
page.on('pageerror', error => errors.push(error.message));
const report = { passed: false, preview_url: url, duration_seconds: duration,
  versions: { chromium: browser.version(), playwright: require('playwright/package.json').version, rive_webgl2: '2.40.1' },
  artistic_approval: false, native_ios_tested: false, artwork_pixel_equality_tested: false,
  vector_structure: 'Covered by the separate source/build inspection; no-raster networking alone does not prove a vector file.',
  checks: {}, poses: [], browser_errors: errors };

async function ready(target) {
  await target.waitForFunction(() => window.heroVectorReference);
  await target.evaluate(async () => { await window.heroVectorReference.ready; });
  const state = await target.evaluate(() => window.heroVectorReference.state());
  assert.equal(state.ready, true, JSON.stringify(state)); return state;
}
async function shot(target, version, name) {
  const filename = `frames/${name}-${version}.png`;
  const bytes = await target.locator(`canvas[data-version="${version}"]`).screenshot({ path: path.join(output, filename) });
  return { filename, sha256: hash(bytes) };
}
async function capture(time) {
  return page.evaluate(async value => window.heroVectorReference.capture(value), time);
}
try {
  await page.goto(url); const initial = await ready(page);
  assert.equal(initial.playing, false); assert.equal(initial.frameCount, 121); assert.equal(initial.fps, 24);
  assert.deepEqual([initial.referenceWidth, initial.referenceHeight], [253, 530]);
  assert.deepEqual([initial.width, initial.height], [manifest.width, manifest.height]);
  for (const [i, time] of times.entries()) {
    const state = await capture(time);
    report.poses.push({ time, state, reference: await shot(page, 'reference', `pose-${i}`), rive: await shot(page, 'rive', `pose-${i}`) });
  }
  assert.ok(new Set(report.poses.map(pose => pose.rive.sha256)).size >= 5, 'Vector gesture does not change across key poses');
  for (const background of ['dark', 'checker']) {
    await page.evaluate(value => window.heroVectorReference.setBackground(value), background);
    await capture(2.4); await page.screenshot({ path: path.join(output, `viewer-${background}.png`), fullPage: true });
  }
  await page.evaluate(() => window.heroVectorReference.setBackground('light'));
  await capture(2.4);
  const stationary = await shot(page, 'rive', 'paused-before');
  await page.waitForTimeout(250); assert.equal((await shot(page, 'rive', 'paused-after')).sha256, stationary.sha256);

  await page.evaluate(() => window.heroVectorReference.replay());
  await page.waitForTimeout(1300); await page.evaluate(() => window.heroVectorReference.pause());
  const midState = await page.evaluate(() => window.heroVectorReference.state());
  assert.ok(midState.elapsed > 0.9 && midState.elapsed < 2.2, JSON.stringify(midState));
  const paused = await shot(page, 'rive', 'native-paused');
  await page.waitForTimeout(350); assert.equal((await shot(page, 'rive', 'native-paused-held')).sha256, paused.sha256);
  await page.evaluate(() => window.heroVectorReference.resume()); await page.waitForTimeout(300);
  await page.evaluate(() => window.heroVectorReference.pause());
  const resumed = await page.evaluate(() => window.heroVectorReference.state());
  assert.ok(resumed.elapsed - midState.elapsed > .15 && resumed.elapsed - midState.elapsed < .5, 'Pause duration leaked into resumed animation clock');
  await shot(page, 'rive', 'native-resumed'); // The opening authored hold may still show the same pose.
  await page.evaluate(() => window.heroVectorReference.resume());
  await page.waitForFunction(() => window.heroVectorReference.state().finished, null, { timeout: 8000 });
  const end = await shot(page, 'rive', 'native-end');
  await page.waitForTimeout(350); assert.equal((await shot(page, 'rive', 'native-end-held')).sha256, end.sha256);
  assert.equal((await page.evaluate(() => window.heroVectorReference.state())).frame, 120);
  await page.evaluate(() => window.heroVectorReference.replay()); await page.waitForTimeout(300);
  await page.evaluate(() => window.heroVectorReference.replay()); await page.waitForTimeout(350);
  await page.evaluate(() => window.heroVectorReference.pause());
  const replayed = await page.evaluate(() => window.heroVectorReference.state());
  assert.ok(replayed.elapsed > .15 && replayed.elapsed < .65, 'Replay did not restart midway');
  report.checks.native_playback_pause_resume_finish_and_replay = true;

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => !window.heroVectorReference.state().reducedMotion);
  await page.evaluate(() => window.heroVectorReference.replay()); await page.waitForTimeout(400);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.heroVectorReference.state().reducedMotion && !window.heroVectorReference.state().playing, null, { polling: 50, timeout: 5000 });
  const reduced = await shot(page, 'rive', 'reduced-motion'); await page.waitForTimeout(250);
  assert.equal((await shot(page, 'rive', 'reduced-motion-held')).sha256, reduced.sha256);
  await page.evaluate(() => window.heroVectorReference.resume()); await page.waitForTimeout(300);
  assert.equal((await page.evaluate(() => window.heroVectorReference.state())).playing, true);
  await page.evaluate(() => window.heroVectorReference.pause());
  report.checks.initial_and_live_reduced_motion_with_explicit_resume = true;

  // Exercise the visibility handler with an explicit hidden property override;
  // this checks clock accounting, not an OS/browser backgrounding policy.
  await page.evaluate(() => window.heroVectorReference.replay()); await page.waitForTimeout(350);
  const beforeHidden = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    return window.heroVectorReference.state().elapsed;
  });
  await page.waitForTimeout(550);
  assert.equal((await page.evaluate(() => window.heroVectorReference.state())).elapsed, beforeHidden);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(200); await page.evaluate(() => window.heroVectorReference.pause());
  const afterHidden = await page.evaluate(() => window.heroVectorReference.state());
  assert.ok(afterHidden.elapsed - beforeHidden > .08 && afterHidden.elapsed - beforeHidden < .4, 'Hidden duration leaked into resumed clock');
  report.checks.simulated_visibility_handler_clock = true;

  if (manifest.overrides?.lookX && manifest.overrides?.lookY) {
    await capture(2.4);
    const original = await shot(page, 'rive', 'rig-default');
    const source = await shot(page, 'reference', 'rig-reference-default');
    await page.evaluate(() => window.heroVectorReference.setOverride('lookX', 12));
    await page.waitForTimeout(100);
    const changed = await shot(page, 'rive', 'rig-look-right');
    assert.notEqual(changed.sha256, original.sha256, 'lookX did not change vector pixels');
    assert.equal((await shot(page, 'reference', 'rig-reference-unchanged')).sha256, source.sha256);
    await page.evaluate(() => window.heroVectorReference.setOverride('lookY', -8)); await page.waitForTimeout(100);
    assert.notEqual((await shot(page, 'rive', 'rig-look-up')).sha256, changed.sha256, 'lookY did not change vector pixels');
    await page.locator('#reset-look').click(); await page.waitForTimeout(100);
    assert.equal((await shot(page, 'rive', 'rig-reset')).sha256, original.sha256);
    report.checks.independent_live_pupil_controls = true;
  }
  await capture(4); await page.screenshot({ path: path.join(output, 'viewer-desktop.png'), fullPage: true });
  await page.locator('#size').click(); await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(output, 'viewer-camp-scale.png'), fullPage: true });
  await page.locator('#size').click(); await page.waitForTimeout(120);

  // Fresh runtime: no PNG/JPEG/WebP/AVIF/GIF/SVG files can be downloaded.
  // Embedded image absence is verified separately from this networking check.
  const standaloneContext = await browser.newContext({ viewport: { width: manifest.width, height: manifest.height }, deviceScaleFactor: 1 });
  const standalone = await standaloneContext.newPage(); const rasterRequests = [];
  standalone.on('pageerror', error => errors.push(error.message));
  await standalone.route(/\.(png|webp|jpe?g|avif|gif|svg)(\?|$)/i, route => { rasterRequests.push(route.request().url()); return route.abort(); });
  await standalone.goto(manifestURL.href);
  await standalone.setContent(`<style>html,body{margin:0;background:transparent}canvas{display:block;width:${manifest.width}px;height:${manifest.height}px}</style><canvas width="${manifest.width}" height="${manifest.height}"></canvas>`);
  await standalone.evaluate(() => {
    window.createdContexts = [];
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) { const result = original.call(this, kind, ...args); window.createdContexts.push({ kind, success: !!result }); return result; };
  });
  await standalone.addScriptTag({ url: new URL('../vendor/rive.js', url).href });
  await standalone.evaluate(async ({ manifest, rivURL, wasmURL, fallbackURL }) => {
    rive.RuntimeLoader.setWasmUrl(wasmURL); rive.RuntimeLoader.setWasmFallbackUrl(fallbackURL); await rive.RuntimeLoader.awaitInstance();
    const buffer = await (await fetch(rivURL)).arrayBuffer(); let freeze = false;
    await new Promise((resolve, reject) => {
      window.nativeVector = new rive.Rive({ buffer, canvas: document.querySelector('canvas'), artboard: manifest.artboard,
        animations: manifest.animation, autoBind: true, autoplay: false, enableRiveAssetCDN: false,
        drawingOptions: rive.DrawOptimizationOptions.AlwaysDraw, layout: new rive.Layout({ fit: rive.Fit.Contain }),
        onLoad: () => queueMicrotask(() => { window.nativeVector.resizeDrawingSurfaceToCanvas(1); resolve(); }),
        onLoadError: () => reject(new Error('Standalone vector .riv did not load')),
        onAdvance: () => { if (freeze) { freeze = false; window.nativeVector.pause(); window.nativeVector.stopRendering(); } },
      });
    });
    window.captureVector = async time => {
      const p = window.nativeVector; p.pause(); p.stopRendering();
      p.reset({ artboard: manifest.artboard, animations: manifest.animation, autoBind: true, autoplay: false }); p.scrub(manifest.animation, time);
      freeze = true; p.startRendering();
      for (let i = 0; i < 3; i++) await new Promise(resolve => requestAnimationFrame(resolve));
      p.pause(); p.stopRendering();
    };
    window.playVector = () => {
      const p = window.nativeVector; p.pause(); p.stopRendering(); freeze = false;
      p.reset({ artboard: manifest.artboard, animations: manifest.animation, autoBind: true, autoplay: false });
      p.scrub(manifest.animation, 0); p.play(manifest.animation);
    };
    window.startVectorStateMachine = () => {
      const p = window.nativeVector; p.pause(); p.stopRendering(); freeze = false;
      p.reset({ artboard: manifest.artboard, stateMachines: manifest.state_machine, autoBind: true, autoplay: false });
      p.viewModelInstance.number(manifest.property ?? 'action').value = 0;
      p.play(manifest.state_machine);
    };
    window.setVectorAction = value => { window.nativeVector.viewModelInstance.number(manifest.property ?? 'action').value = value; };
  }, { manifest, rivURL: new URL(manifest.rive_file, manifestURL).href, wasmURL: new URL('../vendor/rive.wasm', url).href, fallbackURL: new URL('../vendor/rive_fallback.wasm', url).href });
  const contextTypes = await standalone.evaluate(() => window.createdContexts);
  assert.ok(contextTypes.some(value => value.kind === 'webgl2' && value.success), 'No real WebGL2 context was created');
  report.webgl_contexts = contextTypes;
  for (const [i, time] of times.entries()) {
    await standalone.evaluate(async value => window.captureVector(value), time);
    await standalone.locator('canvas').screenshot({ path: path.join(output, 'standalone', `pose-${i}.png`), omitBackground: true });
  }
  await standalone.evaluate(() => window.playVector());
  await standalone.waitForTimeout(Math.ceil(duration * 1000) + 500);
  const rawEnd = await standalone.locator('canvas').screenshot({ path: path.join(output, 'standalone', 'native-end.png'), omitBackground: true });
  await standalone.waitForTimeout(500);
  assert.equal(hash(await standalone.locator('canvas').screenshot({ omitBackground: true })), hash(rawEnd), 'Raw native timeline loops after its end');
  assert.equal(hash(rawEnd), hash(await readFile(path.join(output, 'standalone', `pose-${times.length - 1}.png`))), 'Native playback did not hold the authored final pose');
  await standalone.evaluate(() => window.startVectorStateMachine()); await standalone.waitForTimeout(100);
  const smRest = await standalone.locator('canvas').screenshot({ omitBackground: true });
  await standalone.evaluate(() => window.setVectorAction(1)); await standalone.waitForTimeout(2400);
  assert.notEqual(hash(await standalone.locator('canvas').screenshot({ path: path.join(output, 'standalone', 'state-machine-gesture.png'), omitBackground: true })), hash(smRest), 'State machine action=1 did not produce the gesture');
  await standalone.evaluate(() => window.setVectorAction(0)); await standalone.waitForTimeout(100);
  assert.equal(hash(await standalone.locator('canvas').screenshot({ omitBackground: true })), hash(smRest), 'State machine action=0 did not return to Rest');
  await standalone.evaluate(() => window.setVectorAction(1)); await standalone.waitForTimeout(2400);
  assert.notEqual(hash(await standalone.locator('canvas').screenshot({ omitBackground: true })), hash(smRest), 'State machine replay after returning to Rest did not start');
  assert.deepEqual(rasterRequests, []); await standaloneContext.close();
  report.checks.standalone_webgl2_without_image_requests = true;
  report.checks.raw_native_one_shot_final_hold = true;
  report.checks.numeric_action_state_machine_rest_gesture_and_replay = true;

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const mobile = await mobileContext.newPage(); mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(url); await ready(mobile); await mobile.evaluate(async () => window.heroVectorReference.capture(4));
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.screenshot({ path: path.join(output, 'viewer-mobile.png'), fullPage: true }); await mobileContext.close();
  const failed = await context.newPage(); const failurePattern = `**/${manifest.rive_file}`;
  await failed.route(failurePattern, route => route.fulfill({ status: 404, body: 'missing fixture' }));
  await failed.goto(url); await failed.locator('#error').waitFor({ state: 'visible' });
  assert.equal(await failed.locator('#replay').isDisabled(), true);
  await failed.unroute(failurePattern); await failed.locator('#retry').click(); await ready(failed);
  assert.equal(await failed.locator('#error').isVisible(), false); await failed.close();
  report.checks.mobile_and_retry_recovery = true;
  await writeFile(path.join(output, 'poses.json'), JSON.stringify(report.poses, null, 2));

  const { stdout } = await execute('python3', ['-c', String.raw`
from pathlib import Path
import json,sys
import numpy as np
from PIL import Image,ImageDraw,ImageFont
out=Path(sys.argv[1]);vector_ratio=float(sys.argv[2])/float(sys.argv[3]);poses=json.loads((out/'poses.json').read_text());bounds=[]
for i,pose in enumerate(poses):
    im=np.asarray(Image.open(out/'standalone'/('pose-%d.png'%i)).convert('RGBA'))
    alpha=im[:,:,3];ys,xs=np.nonzero(alpha>4)
    assert len(xs)>1000,'Vector pose is empty'
    assert alpha.min()==0 and alpha.max()==255,'No useful transparent canvas'
    margin=min(int(xs.min()),int(ys.min()),im.shape[1]-1-int(xs.max()),im.shape[0]-1-int(ys.max()))
    assert margin>=1,('Vector contour touches artboard edge',i,margin)
    bounds.append({'time':pose['time'],'bounds':[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())],'minimum_margin':margin})
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';title=ImageFont.truetype(font,24);small=ImageFont.truetype(font,15)
cw,ch=320,380;sheet=Image.new('RGB',(cw*4+40,ch*2+100),'#f5f1e7');draw=ImageDraw.Draw(sheet)
draw.text((20,16),'Чуви: референс и векторный риг',font=title,fill='#2d3529')
draw.text((20,50),'В каждой паре слева — исходные кадры, справа — вектор. Художественное ревью впереди.',font=small,fill='#65705b')
for j,pose in enumerate(poses):
    x0=20+(j%4)*cw;y0=88+(j//4)*ch
    for k,kind in enumerate(['reference','rive']):
        im=Image.open(out/pose[kind]['filename']).convert('RGB')
        # Remove only contain-layout letterboxing, retaining the full artboard.
        ratio=253/530 if kind=='reference' else vector_ratio
        width=min(im.width,im.height*ratio);height=width/ratio
        left=(im.width-width)/2;top=(im.height-height)/2
        im=im.crop((round(left),round(top),round(left+width),round(top+height)))
        im.thumbnail((cw//2-6,ch-40),Image.Resampling.LANCZOS)
        sheet.paste(im,(x0+k*cw//2+(cw//2-im.width)//2,y0))
    draw.text((x0+8,y0+ch-30),'%.2f с'%pose['time'],font=small,fill='#2d3529')
sheet.save(out/'comparison-contact-sheet.png')
result={'transparent_vector_poses':True,'pose_bounds':bounds,'reference_to_vector_pixel_comparison':False}
(out/'visual-checks.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
`, output, String(manifest.width), String(manifest.height)], { maxBuffer: 1024 * 1024 });
  report.visual_checks = JSON.parse(stdout);

  const recording = await browser.newContext({ viewport: { width: 1200, height: 1120 }, deviceScaleFactor: 1, reducedMotion: 'reduce', recordVideo: { dir: path.join(output, 'video'), size: { width: 1200, height: 1120 } } });
  const review = await recording.newPage(); review.on('pageerror', error => errors.push(error.message));
  try {
    await review.goto(url); await ready(review); await review.waitForTimeout(400);
    await review.evaluate(() => window.heroVectorReference.replay()); await review.waitForTimeout(Math.ceil(duration * 1000) + 700);
    await review.waitForTimeout(500); await review.evaluate(() => window.heroVectorReference.replay()); await review.waitForTimeout(Math.ceil(duration * 1000) + 700);
  } finally { await recording.close(); }
  await copyFile(await review.video().path(), path.join(output, 'review.webm'));
  await execute('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(output, 'review.webm'), '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, 'review.mp4')]);
  assert.deepEqual(errors, []); report.passed = true;
  report.review = { video: 'review.mp4', contact_sheet: 'comparison-contact-sheet.png' };
  console.log(`PASS: vector runtime, standalone WebGL2, transparency, replay/pause/reduced motion, controls, mobile/retry. Visual match requires review. ${output}`);
} catch (error) { report.failure = error.stack || String(error); throw error; }
finally { await writeFile(path.join(output, 'qa.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
