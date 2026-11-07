// Real WebGL2 playback + image constraints for the isolated greeting pilot.
// Passing this test does not constitute artistic or native iOS approval.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(new URL('../../../prototype/package.json', import.meta.url));
const { chromium } = require('playwright');
const execute = promisify(execFile);
const args = process.argv.slice(2);
const url = args[0];
const outIndex = args.indexOf('--out');
if (!url || outIndex < 0 || !args[outIndex + 1]) throw new Error('Usage: node check_motion.mjs <full-review-url> --out <run-dir>/browser-qa');
const output = path.resolve(args[outIndex + 1]);
await mkdir(path.join(output, 'frames'), { recursive: true });
const browser = await chromium.launch({ headless: true });
const runtimePackage = JSON.parse(await readFile(new URL('../camp-scene-vector/preview/vendor/webgl2-2.40.1/package.json', import.meta.url), 'utf8'));
const context = await browser.newContext({ viewport: { width: 1200, height: 1120 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
const report = { preview_url: url, artistic_approval: false, native_tested: false,
  scope: 'WebGL2 file playback, fixed visible feet, gesture extent, one-shot endpoint/replay, pause and reduced-motion; manual artistic review remains required.',
  versions: { chromium: browser.version(), playwright: require('playwright/package.json').version,
    rive_runtime: { package: runtimePackage.name, version: runtimePackage.version } },
  captures: [], browser_errors: errors, checks: {},
};
page.on('pageerror', error => errors.push(error.message));
const selector = version => `canvas[data-version="${version}"]`;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function ready(target) {
  await target.waitForFunction(() => window.heroMotionPilot);
  await target.evaluate(async () => { await window.heroMotionPilot.ready; });
  const state = await target.evaluate(() => window.heroMotionPilot.state());
  assert.equal(state.ready, true, JSON.stringify(state));
  assert.deepEqual(state.errors, []);
  return state;
}
async function shot(version, name, target = page) {
  const filename = `frames/${name}-${version}.png`;
  const bytes = await target.locator(selector(version)).screenshot({ path: path.join(output, filename) });
  return { filename, sha256: sha(bytes) };
}
async function capture(time, name) {
  await page.evaluate(async time => { await window.heroMotionPilot.capture(time); }, time);
  const result = { time, name, baseline: await shot('baseline', name), pilot: await shot('pilot', name) };
  report.captures.push(result);
  return result;
}
try {
  await page.goto(url);
  const initial = await ready(page);
  assert.equal(initial.playing, false, 'Reduced motion must suppress automatic greeting');
  assert.equal(initial.reducedMotion, true);
  for (const version of ['baseline', 'pilot']) {
    await page.locator(selector(version)).screenshot({ path: path.join(output, `background-${version}.png`), style: 'canvas { opacity: 0 !important; }' });
  }
  const times = [0, 0.65, 1.35, 2.1, 2.85, 3.6, 4.25, 4.8];
  for (let index = 0; index < times.length; index++) await capture(times[index], `phase-${index}`);
  const firstSample = await capture(1.8, 'deterministic-first');
  await capture(4.8, 'detour');
  const repeatSample = await capture(1.8, 'deterministic-repeat');
  assert.equal(firstSample.pilot.sha256, repeatSample.pilot.sha256, 'Timeline capture depends on previous pose');
  await page.waitForTimeout(250);
  const paused = await shot('pilot', 'paused');
  assert.equal(paused.sha256, repeatSample.pilot.sha256, 'Paused canvas changed');
  report.checks.deterministic_scrub = true;
  report.checks.paused_frame_stable = true;

  // The next captures exercise native StateMachine + action, not timeline scrub.
  await page.evaluate(() => window.heroMotionPilot.replay());
  await page.waitForTimeout(1450);
  await page.evaluate(() => window.heroMotionPilot.pause());
  report.native_mid = await shot('pilot', 'native-mid');
  const nativePaused = await shot('pilot', 'native-mid-paused');
  assert.equal(nativePaused.sha256, report.native_mid.sha256);
  await page.waitForTimeout(200);
  assert.equal((await shot('pilot', 'native-mid-later')).sha256, nativePaused.sha256, 'Paused state-machine pose moved');
  await page.evaluate(() => window.heroMotionPilot.resume());
  await page.waitForFunction(() => window.heroMotionPilot.state().finished, null, { timeout: 8000 });
  const ended = await page.evaluate(() => window.heroMotionPilot.state());
  assert.equal(ended.playing, false); assert.equal(ended.elapsed, 4.8); assert.equal(ended.action, 1);
  report.native_end = await shot('pilot', 'native-end');
  report.checks.one_shot = { finished: true, neutral_final_held: true, action: ended.action, automatic_idle_transition_claimed: false };
  await page.evaluate(() => window.heroMotionPilot.replay());
  await page.waitForTimeout(1450);
  await page.evaluate(() => window.heroMotionPilot.pause());
  report.native_replay = await shot('pilot', 'native-replay');
  // Replay also has to work midway and through quick successive taps.
  for (let index = 0; index < 3; index++) { await page.evaluate(() => window.heroMotionPilot.replay()); await page.waitForTimeout(100); }
  await page.waitForTimeout(1350);
  const rapidly = await page.evaluate(() => window.heroMotionPilot.state());
  assert.equal(rapidly.action, 1); assert.equal(rapidly.playing, true);
  await page.evaluate(() => window.heroMotionPilot.pause());
  report.native_rapid_replay = await shot('pilot', 'native-rapid-replay');
  await page.evaluate(async () => { await window.heroMotionPilot.rest(); });
  await page.waitForTimeout(80);
  assert.equal((await page.evaluate(() => window.heroMotionPilot.state())).action, 0);
  report.native_rest = await shot('pilot', 'native-rest');
  report.checks.replay_after_completion_midway_and_rapid = true;
  await capture(1.8, 'owner-pose');
  await page.screenshot({ path: path.join(output, 'viewer-desktop.png'), fullPage: true });
  await page.locator('#size').click(); await page.waitForTimeout(120);
  await capture(1.8, 'camp-scale');
  await page.screenshot({ path: path.join(output, 'viewer-camp-scale.png'), fullPage: true });
  await page.locator('#size').click(); await page.waitForTimeout(120);

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const mobilePage = await mobile.newPage();
  mobilePage.on('pageerror', error => errors.push(error.message));
  await mobilePage.goto(url); await ready(mobilePage);
  await mobilePage.evaluate(async () => { await window.heroMotionPilot.capture(1.8); });
  assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile horizontal overflow');
  for (const version of ['baseline', 'pilot']) assert.equal(await mobilePage.locator(selector(version)).isVisible(), true);
  await mobilePage.screenshot({ path: path.join(output, 'viewer-mobile.png'), fullPage: true });
  await mobile.close(); report.checks.mobile_and_reduced_motion = true;

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.heroMotionPilot.replay());
  await page.waitForTimeout(700);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !window.heroMotionPilot.state().playing);
  const reducedFirst = await shot('pilot', 'live-reduced-motion');
  await page.waitForTimeout(250);
  assert.equal((await shot('pilot', 'live-reduced-motion-later')).sha256, reducedFirst.sha256, 'Live reduced-motion change must stop the native animation');
  report.checks.live_reduced_motion_change = true;

  const failurePage = await context.newPage();
  await failurePage.route('**/chewy.riv', route => route.fulfill({ status: 404, body: 'missing fixture' }));
  await failurePage.goto(url);
  await failurePage.locator('#error').waitFor({ state: 'visible' });
  assert.equal(await failurePage.locator('#replay').isDisabled(), true);
  assert.equal(await failurePage.locator('#retry').isVisible(), true);
  await failurePage.screenshot({ path: path.join(output, 'viewer-error.png'), fullPage: true });
  await failurePage.unroute('**/chewy.riv');
  await failurePage.locator('#retry').click();
  await ready(failurePage);
  assert.equal(await failurePage.locator('#error').isVisible(), false);
  assert.equal(await failurePage.locator('#replay').isEnabled(), true);
  await failurePage.screenshot({ path: path.join(output, 'viewer-recovered.png'), fullPage: true });
  await failurePage.close(); report.checks.failed_asset_and_retry_recovery = true;

  await writeFile(path.join(output, 'captures.json'), JSON.stringify(report.captures, null, 2));
  const { stdout } = await execute('python3', ['-c', String.raw`
from pathlib import Path
import json,sys
import numpy as np
from PIL import Image,ImageDraw,ImageFont
root=Path(sys.argv[1]); captures=json.loads((root/'captures.json').read_text()); entries={x['name']:x for x in captures}
def image(name,version='pilot'):
    return np.asarray(Image.open(root/entries[name][version]['filename']).convert('RGB'),dtype=np.int16)
def direct(name):
    return np.asarray(Image.open(root/'frames'/name).convert('RGB'),dtype=np.int16)
def diff(a,b):
    d=np.abs(a-b);return {'changed_pixels':int(np.any(d>3,axis=2).sum()),'mean_channel_delta':float(d.mean()),'max_channel_delta':int(d.max())}
def bounds(a,bg):
    mask=np.any(np.abs(a-bg)>12,axis=2);ys,xs=np.where(mask)
    assert len(xs)>100,'empty character canvas'
    h,w=mask.shape
    return {'pixels':int(len(xs)),'bbox':[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())],'edge_margin':int(min(xs.min(),ys.min(),w-1-xs.max(),h-1-ys.max()))}
result={'artistic_approval':False,'fixed_region_artboard_y':[720,1120]}
base=image('phase-0'); background=np.asarray(Image.open(root/'background-pilot.png').convert('RGB'),dtype=np.int16)
frames=[image('phase-'+str(i)) for i in range(8)]
extent=[bounds(frame,background) for frame in frames]
assert min(b['edge_margin'] for b in extent)>=2,'gesture clips artboard/canvas edge'
# With Contain and this review's portrait canvas, the artboard fills the height.
# y>=720 is an explicitly authored fixed-foot region, not the empty canvas margin.
cut=int(round(base.shape[0]*720/1120))+2
fixed_mask=np.any(np.abs(base[cut:]-background[cut:])>12,axis=2)
assert int(fixed_mask.sum())>100,'fixed-foot test must include visible art'
feet=[diff(base[cut:],frame[cut:]) for frame in frames]
assert max(d['changed_pixels'] for d in feet)==0,'feet/lower body moved'
movement=[diff(base[:cut],frame[:cut]) for frame in frames]
assert max(d['changed_pixels'] for d in movement)>80,'greeting has no upper-body motion'
endpoint=diff(frames[0],frames[-1]);assert endpoint['changed_pixels']<=8,'Wave does not return to its neutral start'
baseline_frames=[image('phase-'+str(i),'baseline') for i in range(8)]
assert all(diff(baseline_frames[0],frame)['changed_pixels']==0 for frame in baseline_frames),'baseline must stay still'
neutral_fidelity=diff(baseline_frames[0],base)
assert neutral_fidelity['mean_channel_delta']<=.5 and neutral_fidelity['changed_pixels']<=max(20,int(extent[0]['pixels']*.005)),'neutral pilot diverges from original baseline artwork'
native={name:diff(base,direct(name+'-pilot.png')) for name in ['native-mid','native-replay','native-rapid-replay']}
assert all(v['changed_pixels']>80 for v in native.values()),'real state-machine replay failed to move'
native_end=diff(base,direct('native-end-pilot.png'));assert native_end['changed_pixels']<=max(12,int(extent[0]['pixels']*.002)),'native one-shot did not settle to neutral'
native_rest=diff(base,direct('native-rest-pilot.png'));assert native_rest['changed_pixels']<=max(12,int(extent[0]['pixels']*.002)),'action0 does not restore neutral'
result.update({'visible_fixed_pixels':int(fixed_mask.sum()),'fixed_region_deltas':feet,'upper_motion':movement,'extent':extent,'neutral_fidelity':neutral_fidelity,'endpoint':endpoint,'native_replays':native,'native_end':native_end,'native_rest':native_rest})
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';title=ImageFont.truetype(font,22);small=ImageFont.truetype(font,16)
names=['phase-0','phase-1','phase-2','phase-3','phase-4','phase-5','phase-6','phase-7']
cellw,cellh=225,355;margin,header=22,92
sheet=Image.new('RGB',(margin*2+4*cellw,header+2*cellh+20),'#f5f1e7');draw=ImageDraw.Draw(sheet)
draw.text((margin,18),'Чуви · один жест от начала до возвращения',font=title,fill='#2d3529')
draw.text((margin,52),'Кадры из Rive. Открытая ладонь — черновик. Художественная приёмка отдельно.',font=small,fill='#65705b')
for i,name in enumerate(names):
    frame=Image.open(root/entries[name]['pilot']['filename']).convert('RGB');frame.thumbnail((cellw-12,cellh-35),Image.Resampling.LANCZOS)
    x=margin+(i%4)*cellw+(cellw-frame.width)//2;y=header+(i//4)*cellh
    sheet.paste(frame,(x,y));draw.text((margin+(i%4)*cellw+10,y+cellh-28),str(entries[name]['time'])+' с',font=small,fill='#2d3529')
sheet.save(root/'motion-contact-sheet.png')
pair=Image.new('RGB',(2*330+44,610),'#f5f1e7');d=ImageDraw.Draw(pair)
d.text((22,18),'Исходная поза и приветствие',font=title,fill='#2d3529')
for i,version in enumerate(['baseline','pilot']):
    frame=Image.open(root/entries['deterministic-first'][version]['filename']).convert('RGB');frame.thumbnail((310,480),Image.Resampling.LANCZOS)
    pair.paste(frame,(22+i*330+(310-frame.width)//2,70));d.text((22+i*330,565),'Исходник' if i==0 else 'Приветствие · черновик',font=small,fill='#2d3529')
pair.save(root/'comparison-contact-sheet.png')
(root/'pixel-qa.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
`, output], { maxBuffer: 1024 * 1024 });
  report.pixel_qa = JSON.parse(stdout);

  const recording = await browser.newContext({ viewport: { width: 1200, height: 1120 }, deviceScaleFactor: 1,
    reducedMotion: 'reduce', recordVideo: { dir: path.join(output, 'video'), size: { width: 1200, height: 1120 } } });
  const review = await recording.newPage();
  review.on('pageerror', error => errors.push(error.message));
  try {
    await review.goto(url); await ready(review); await review.waitForTimeout(500);
    await review.evaluate(() => window.heroMotionPilot.replay()); await review.waitForTimeout(5350);
    await review.waitForTimeout(500); await review.evaluate(() => window.heroMotionPilot.replay()); await review.waitForTimeout(5350);
  } finally { await recording.close(); }
  await copyFile(await review.video().path(), path.join(output, 'review.webm'));
  await execute('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(output, 'review.webm'), '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, 'review.mp4')]);
  assert.deepEqual(errors, []);
  report.passed = true;
  report.review = { video: 'review.mp4', motion: 'motion-contact-sheet.png', comparison: 'comparison-contact-sheet.png' };
  console.log(`PASS: real Chewy greeting, neutral endpoint, replay after completion/midway, fixed visible feet, no clipping, pause, reduced motion and mobile/error. Review: ${output}`);
} catch (error) { report.passed = false; report.failure = error.stack || String(error); throw error; }
finally { await writeFile(path.join(output, 'qa.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
