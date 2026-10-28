import test from 'node:test';
import assert from 'node:assert/strict';
import { SANDBOX_DEVICES, getSandboxLayout } from './sandbox-scene-layout.js';
import { campGrowthLayers } from './camp-growth.js';
import { moveSandboxLayout, readPlacements } from './sandbox-placement.js';

const overlap = ([x,y,w,h], [a,b,c,d]) => x < a+c && a < x+w && y < b+d && b < y+h;

test('both camp stages leave controls and the journal clear on every phone', () => {
  for (const device of Object.values(SANDBOX_DEVICES)) for (const growthStage of ['initial','developed']) {
    const layout = getSandboxLayout(device, { foodLayout:'separate', growthStage });
    const controls = [...layout.controls.map(item => item.frame), layout.food, layout.action];
    for (const frame of controls) assert.ok(frame[2] >= 44 && frame[3] >= 44);
    for (const { id, frame:[x,y,w,h] } of layout.objects) {
      assert.ok(x >= 0 && y >= 0 && x+w <= device.width && y+h <= device.height, `${id} inside ${device.width}`);
      const labelled = ['workshop','fuel','light','garden'].includes(id) ? [x,y,w,h+24] : [x,y,w,h];
      for (const control of controls) assert.equal(overlap(labelled,control), false, `${id} clear of controls on ${device.width}`);
    }
    assert.equal(overlap(layout.food,layout.action), false);
  }
});

test('stage changes retain the hero scale and all ground anchors', () => {
  for (const device of Object.values(SANDBOX_DEVICES)) {
    const initial = getSandboxLayout(device,{ foodLayout:'separate', growthStage:'initial' });
    const developed = getSandboxLayout(device,{ foodLayout:'separate', growthStage:'developed' });
    for (const item of initial.objects) assert.deepEqual(item.foot, developed.objects.find(other=>other.id===item.id).foot);
    const hero = initial.objects.find(item=>item.id==='hero');
    assert.deepEqual(hero.frame, developed.objects.find(item=>item.id==='hero').frame);
    assert.ok(hero.frame[3] < device.height * .31);
  }
});

test('resource layers retain editable placement and use valid atlas bounds', () => {
  const saved = readPlacements(JSON.stringify({version:1,devices:{standard:{workshop:[4,3,1],garden:[-3,0,1]}}}));
  const base = getSandboxLayout(SANDBOX_DEVICES.standard,{foodLayout:'separate',growthStage:'initial'});
  const moved = moveSandboxLayout(base,saved.standard);
  assert.equal(moved.objects.find(item=>item.id==='garden').foot[0],base.objects.find(item=>item.id==='garden').foot[0]-3);
  for (const stage of ['initial','developed']) for (const {bounds:b} of campGrowthLayers(stage)) {
    assert.ok(b.x>=0 && b.y>=0 && b.x+b.width<=b.sourceWidth && b.y+b.height<=b.sourceHeight);
  }
});
