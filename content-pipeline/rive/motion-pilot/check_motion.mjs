// Verify the exported files in the real browser runtime and capture owner review.
// This checks observable technical motion constraints, never artistic acceptance.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(new URL('../../../prototype/package.json', import.meta.url));
const { chromium } = require('playwright');
const runtimePackage = JSON.parse(await readFile(new URL('../camp-scene-vector/preview/vendor/webgl2-2.40.1/package.json', import.meta.url), 'utf8'));
const execute = promisify(execFile);
const args = process.argv.slice(2);
const url = args[0];
const outIndex = args.indexOf('--out');
if (!url || outIndex < 0 || !args[outIndex + 1]) {
  throw new Error('Usage: node check_motion.mjs <full-preview-url> --out <run-dir>/browser-qa');
}
const output = path.resolve(args[outIndex + 1]);
await mkdir(path.join(output, 'frames'), { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1200, height: 980 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
const report = {
  preview_url: url,
  versions: {
    chromium: browser.version(),
    playwright: require('playwright/package.json').version,
    rive_runtime: { package: runtimePackage.name, version: runtimePackage.version },
  },
  artistic_approval: false,
  native_tested: false,
  scope: 'Web runtime behaviour and deterministic pixels; artistic judgement remains manual.',
  states: {}, captures: [], browser_errors: errors,
};
page.on('pageerror', error => errors.push(error.message));
const selector = version => `canvas[data-version="${version}"]`;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function ready(target) {
  await target.waitForFunction(() => window.motionPilot);
  await target.evaluate(async () => { await window.motionPilot.ready; });
  const state = await target.evaluate(() => window.motionPilot.state());
  assert.equal(state.ready, true, JSON.stringify(state));
}
async function screenshot(version, name) {
  const filename = `frames/${name}-${version}.png`;
  const bytes = await page.locator(selector(version)).screenshot({ path: path.join(output, filename) });
  return { filename, sha256: sha(bytes) };
}
async function capture(stage, time, name) {
  await page.evaluate(async ({ stage, time }) => { await window.motionPilot.capture(stage, time); }, { stage, time });
  const entry = { stage, time, name };
  for (const version of ['baseline', 'pilot']) entry[version] = await screenshot(version, name);
  report.captures.push(entry);
  return entry;
}
try {
  await page.goto(url);
  await ready(page);
  // A background-only capture subtracts the page's decorative gradient from
  // coverage/clipping metrics, so empty canvas cannot satisfy those checks.
  await page.evaluate(() => window.motionPilot.pause());
  for (const version of ['baseline', 'pilot']) {
    await page.locator(selector(version)).screenshot({
      path: path.join(output, `background-${version}.png`),
      style: 'canvas { opacity: 0 !important; }',
    });
  }
  // Standalone timeline samples are deterministic and do not depend on timers.
  for (let stage = 0; stage < 3; stage++) {
    const first = await capture(stage, 0, `stage-${stage}`);
    await capture(stage, 1.4, `stage-${stage}-motion`);
    await capture((stage + 1) % 3, 3.1, `stage-${stage}-detour`);
    const repeat = await capture(stage, 0, `stage-${stage}-repeat`);
    for (const version of ['baseline', 'pilot']) {
      assert.equal(repeat[version].sha256, first[version].sha256, `${version}: stage ${stage} deterministic after unrelated state`);
    }
    report.states[stage] = { deterministic_return: true };
  }
  for (const version of ['baseline', 'pilot']) {
    const hashes = report.captures.filter(row => /^stage-\d$/.test(row.name)).map(row => row[version].sha256);
    assert.equal(new Set(hashes).size, 3, `${version}: three distinguishable states`);
  }
  // Include the authored extremes, quieter poses and both sides of the loop seam.
  for (const [name, time] of [
    ['phase-0', 0], ['phase-1', .8], ['phase-2', 1.8], ['phase-3', 2.9], ['phase-4', 4], ['phase-5', 5.1],
    ['seam-before-2', 6 - 2 / 30], ['seam-before', 6 - 1 / 30], ['seam-end', 6],
    ['seam-after', 1 / 30], ['seam-after-2', 2 / 30],
  ]) await capture(2, time, name);
  await writeFile(path.join(output, 'captures.json'), JSON.stringify(report.captures, null, 2) + '\n');

  // Exercise the actual state machine, without the deterministic capture path.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { window.motionPilot.setStage(0); window.motionPilot.resume(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.motionPilot.setStage(2));
  await page.waitForTimeout(180);
  await page.evaluate(() => window.motionPilot.pause());
  await page.waitForTimeout(100);
  const held = await screenshot('pilot', 'transition-paused');
  await page.waitForTimeout(250);
  assert.equal((await screenshot('pilot', 'transition-still-paused')).sha256, held.sha256, 'pause preserves a real intermediate state-machine frame');
  await page.evaluate(() => window.motionPilot.resume());
  for (const stage of [0, 2, 1, 0, 1, 2]) {
    await page.evaluate(stage => window.motionPilot.setStage(stage), stage);
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(1100);
  assert.equal((await page.evaluate(() => window.motionPilot.state())).stage, 2, 'rapid state changes settle on the latest command');
  const running = await screenshot('pilot', 'state-machine-running');
  await page.waitForTimeout(440);
  assert.notEqual((await screenshot('pilot', 'state-machine-later')).sha256, running.sha256, 'state machine resumes visible authored motion');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(180);
  const reduced = await page.evaluate(() => window.motionPilot.state());
  assert.equal(reduced.playing, false, 'OS reduced motion pauses playback');
  await page.evaluate(() => window.motionPilot.setStage(1));
  await page.waitForTimeout(180);
  const frozen = await screenshot('pilot', 'reduced-stage-1');
  await page.waitForTimeout(220);
  assert.equal((await screenshot('pilot', 'reduced-stage-1-repeat')).sha256, frozen.sha256, 'reduced motion preserves a readable stable stage');
  assert.equal(frozen.sha256, report.captures.find(row => row.name === 'stage-1').pilot.sha256, 'reduced motion displays the selected authored pose, not a stale previous stage');
  report.state_machine = { transition_pause: true, rapid_changes: true, resumed_motion: true, reduced_motion: true };

  for (const width of [390, 1200]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 980 });
    await page.waitForTimeout(160);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal overflow at ${width}px`);
    await page.screenshot({ path: path.join(output, `viewer-${width}.png`), fullPage: true });
  }
  assert.deepEqual(errors, [], 'no browser runtime errors');

  // Pixel QA is performed on decoded PNGs, including the fixed visible base.
  const { stdout } = await execute('python3', ['-c', String.raw`
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
root=Path(sys.argv[1]); rows=json.loads((root/'captures.json').read_text())
by_name={row['name']:row for row in rows}
def pixels(name,version):
    return np.asarray(Image.open(root/by_name[name][version]['filename']).convert('RGB'),dtype=np.int16)
def difference(a,b):
    d=np.abs(a-b)
    return {'mean_channel_delta':float(d.mean()),'changed_pixels':int((d.max(axis=2)>3).sum())}
def bounds(frame,background):
    mask=np.abs(frame-background).max(axis=2)>8
    yy,xx=np.where(mask)
    assert len(xx)>100,'state must contain visible artwork'
    return {'pixels':len(xx),'left':int(xx.min()),'top':int(yy.min()),'right':int(xx.max()),'bottom':int(yy.max()),'edge_margin':int(min(xx.min(),yy.min(),frame.shape[1]-1-xx.max(),frame.shape[0]-1-yy.max()))}
result={'versions':{},'root_roi':'artboard y >= 405 of 465; visible stationary grass base','quality_claim':'These measurements reject structural faults; they do not score aesthetic quality.'}
for version in ['baseline','pilot']:
    frames=[pixels('phase-'+str(i),version) for i in range(6)]
    background=np.asarray(Image.open(root/('background-'+version+'.png')).convert('RGB'),dtype=np.int16)
    shape=frames[0].shape
    assert abs(shape[1]/shape[0]-480/465)<.02,'Canvas must preserve 480:465 artboard aspect ratio for root ROI'
    cut=int(round(shape[0]*405/465)); base=frames[0][cut:]
    root_visible=int((np.abs(base-background[cut:]).max(axis=2)>8).sum())
    assert root_visible>50,'fixed-base assertion must include visible grass, not blank background'
    root_deltas=[difference(base,frame[cut:]) for frame in frames[1:]]
    assert max(d['changed_pixels'] for d in root_deltas)<=2,version+': anchored visible grass must remain stationary'
    extent=[bounds(pixels(row['name'],version),background) for row in rows]
    assert min(b['edge_margin'] for b in extent)>=3,version+': artwork touches canvas edge'
    states=[bounds(pixels('stage-'+str(stage),version),background) for stage in range(3)]
    assert states[0]['pixels']<states[1]['pixels']<states[2]['pixels'],version+': visible coverage must grow across the three intended plant states'
    seam=difference(pixels('seam-end',version),frames[0])
    assert seam['changed_pixels']<=3,version+': loop endpoint must match start'
    before2=pixels('seam-before-2',version); before=pixels('seam-before',version)
    after=pixels('seam-after',version); after2=pixels('seam-after-2',version)
    nearby=[difference(before2,before),difference(before,frames[0]),difference(frames[0],after),difference(after,after2)]
    # A jump at wrap cannot hide behind equality of the exact end key alone.
    assert max(nearby[1]['mean_channel_delta'],nearby[2]['mean_channel_delta'])<=max(.3,3*max(nearby[0]['mean_channel_delta'],nearby[3]['mean_channel_delta'])),version+': discontinuity near loop wrap'
    top_deltas=[difference(frames[0][:cut],frame[:cut]) for frame in frames[1:]]
    assert max(d['changed_pixels'] for d in top_deltas)>30,version+': full-stage upper plant should actually move'
    result['versions'][version]={'state_coverage':states,'root_visible_pixels':root_visible,'root_deltas':root_deltas,'minimum_edge_margin':min(b['edge_margin'] for b in extent),'loop_endpoint':seam,'loop_neighbour_deltas':nearby,'upper_motion':top_deltas}
    if version=='pilot':
        final=np.asarray(Image.open(root/'frames/state-machine-running-pilot.png').convert('RGB'),dtype=np.int16)
        actual=bounds(final,background)
        assert abs(actual['pixels']-states[2]['pixels'])<=.12*states[2]['pixels'],'Rapid transitions must actually render Full, not merely report stage=2'
        result['state_machine_final_coverage']=actual
result['baseline_pilot_difference']=difference(pixels('phase-2','baseline'),pixels('phase-2','pilot'))
assert result['baseline_pilot_difference']['changed_pixels']>30,'new output must not silently reuse baseline'

font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(font_path,21); small=ImageFont.truetype(font_path,16)
def sheet(names,filename,title,labels):
    cellw,cellh=300,310; margin,header=24,96
    sheet=Image.new('RGB',(margin*2+len(names)*cellw,header+2*cellh+35),'#f5f1e7');d=ImageDraw.Draw(sheet)
    d.text((margin,18),title,font=font,fill='#2d3529')
    d.text((margin,50),'Реальные кадры Rive · художественная приёмка отдельно',font=small,fill='#65705b')
    for col,name in enumerate(names):
        for row,version in enumerate(['baseline','pilot']):
            img=Image.open(root/by_name[name][version]['filename']).convert('RGB');img.thumbnail((cellw-12,cellh-42),Image.Resampling.LANCZOS)
            x=margin+col*cellw+(cellw-img.width)//2;y=header+row*cellh
            sheet.paste(img,(x,y));d.text((margin+col*cellw+5,y+cellh-31),('Было' if row==0 else 'Пилот')+' · '+labels[col],font=small,fill='#2d3529')
    sheet.save(root/filename)
sheet(['stage-0','stage-1','stage-2'],'states-contact-sheet.png','Три состояния: исходник и новый риг',['начало','в процессе','полное'])
sheet(['phase-'+str(i) for i in range(6)],'motion-contact-sheet.png','Фазы одного цикла: опора и вторичное движение',[str(t)+' с' for t in [0,.8,1.8,2.9,4,5.1]])
(root/'pixel-qa.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
`, output], { maxBuffer: 1024 * 1024 });
  report.pixel_qa = JSON.parse(stdout);

  // This recording plays the real state machines. Unlike the still captures,
  // its clock is realtime; it is an owner-review artefact, not a pixel fixture.
  const recording = await browser.newContext({
    viewport: { width: 1200, height: 980 }, deviceScaleFactor: 1, reducedMotion: 'no-preference',
    recordVideo: { dir: path.join(output, 'video'), size: { width: 1200, height: 980 } },
  });
  const review = await recording.newPage();
  review.on('pageerror', error => errors.push(error.message));
  try {
    await review.goto(url); await ready(review);
    await review.evaluate(() => { window.motionPilot.setStage(2); window.motionPilot.resume(); });
    await review.waitForTimeout(6500);
    for (const stage of [0, 1, 2]) {
      await review.evaluate(stage => window.motionPilot.setStage(stage), stage);
      await review.waitForTimeout(2200);
    }
    await review.evaluate(() => window.motionPilot.pause());
    await review.waitForTimeout(700);
  } finally { await recording.close(); }
  await copyFile(await review.video().path(), path.join(output, 'review.webm'));
  await execute('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(output, 'review.webm'), '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, 'review.mp4')]);
  assert.deepEqual(errors, []);
  report.passed = true;
  report.review = { video: 'review.mp4', states: 'states-contact-sheet.png', motion: 'motion-contact-sheet.png' };
  console.log(`PASS: deterministic states, fixed visible roots, nonempty unclipped poses, loop seam, actual transitions, pause, rapid changes and reduced motion. Review: ${output}`);
} catch (error) {
  report.passed = false;
  report.failure = error.stack || String(error);
  throw error;
} finally {
  await writeFile(path.join(output, 'qa.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
