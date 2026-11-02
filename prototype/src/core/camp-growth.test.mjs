import test from 'node:test';
import assert from 'node:assert/strict';
import { SANDBOX_DEVICES, getSandboxLayout } from './sandbox-scene-layout.js';
import { campGrowthLayers } from './camp-growth.js';
import { moveSandboxLayout, readPlacements } from './sandbox-placement.js';
import { getOwnerCampPlacements, mergeOwnerCampPlacements } from './camp-owner-layout.js';

const overlap = ([x,y,w,h], [a,b,c,d]) => x < a+c && a < x+w && y < b+d && b < y+h;

test('both camp stages leave controls and the journal clear on every phone', () => {
  for (const device of Object.values(SANDBOX_DEVICES)) for (const growthStage of ['initial','developed']) {
    const layout = getSandboxLayout(device, { foodLayout:'separate', growthStage });
    const controls = [...layout.controls.map(item => item.frame), layout.food, layout.action];
    for (const frame of controls) assert.ok(frame[2] >= 44 && frame[3] >= 44);
    for (const { id, frame:[x,y,w,h] } of layout.objects) {
      assert.ok(x >= 0 && y >= 0 && x+w <= device.width && y+h <= device.height, `${id} inside ${device.width}`);
      const labelled = ['workshop','provisions','fuel','light','garden'].includes(id) ? [x,y,w,h+24] : [x,y,w,h];
      for (const control of controls) assert.equal(overlap(labelled,control), false, `${id} clear of controls on ${device.width}`);
    }
    assert.equal(overlap(layout.food,layout.action), false);
  }
});

test('camp provisions fit the owner layout and persist separately from inventory navigation', () => {
  const owner = getOwnerCampPlacements();
  for (const [key, device] of Object.entries(SANDBOX_DEVICES)) {
    for (const growthStage of ['initial', 'developed']) {
      const base = getSandboxLayout(device, { foodLayout: 'separate', growthStage, withMirror: true });
      const layout = moveSandboxLayout(base, owner[key]);
      const bag = layout.objects.find(item => item.id === 'provisions');
      const [x,y,w,h] = bag.frame;
      assert.ok(x >= 0 && y >= 0 && x+w <= device.width && y+h <= device.height);
      for (const frame of [...base.controls.map(item => item.frame), base.food, base.action,
        ...layout.objects.filter(item => ['hero', 'garden'].includes(item.id)).map(item => item.frame)]) {
        assert.equal(overlap(bag.frame, frame), false, `provisions have their own space on ${key}`);
      }
      const log = layout.objects.find(item => item.id === 'log');
      for (const frame of [...base.controls.map(item => item.frame), base.food, base.action]) {
        assert.equal(overlap(log.frame, frame), false, `log clear of controls on ${key}`);
      }
      assert.ok(bag.foot[1] > layout.objects.find(item => item.id === 'workshop').foot[1], 'bag is in front of the tent');
      // The pet sprite has transparent space above its artwork; inspect the
      // painted silhouettes in browser rather than treating that margin as solid.
      assert.ok(bag.foot[1] < layout.objects.find(item => item.id === 'pet').foot[1]);
      const saved = readPlacements(JSON.stringify({ version: 1, devices: { [key]: { provisions: [12, 8, .9], backpack: [4, 5, 1] } } }));
      const moved = moveSandboxLayout(base, saved[key]);
      assert.equal(moved.objects.find(item => item.id === 'provisions').foot[0], base.objects.find(item => item.id === 'provisions').foot[0] + 12);
      assert.equal(moved.controls.find(item => item.id === 'backpack').frame[0], base.controls.find(item => item.id === 'backpack').frame[0] + 4);
    }
  }
});

test('camp defaults migrate old backpack previews and retain hand edits', () => {
  const preset = getOwnerCampPlacements();
  for (const [key, device] of Object.entries(SANDBOX_DEVICES)) {
    const base = getSandboxLayout(device, { foodLayout: 'separate', growthStage: 'initial' });
    const bag = base.objects.find(item => item.id === 'provisions');
    const old = [(27 + 76 / 2) * device.width / 390 - bag.foot[0],
      (345 + 91.2) * device.height / 844 - bag.foot[1], 76 * device.width / 390 / bag.frame[2]];
    const saved = { [key]: { provisions: old, hero: [2, 3, 1.1], backpack: [4, 5, 1] } };
    const merged = mergeOwnerCampPlacements(saved)[key];
    assert.deepEqual(merged.provisions, preset[key].provisions);
    assert.deepEqual(merged.log, preset[key].log);
    assert.deepEqual(merged.hero, saved[key].hero);
    assert.deepEqual(merged.backpack, saved[key].backpack);
    const edited = { [key]: { ...saved[key], provisions: [old[0] + 2, old[1], old[2]] } };
    assert.deepEqual(mergeOwnerCampPlacements(edited)[key].provisions, edited[key].provisions);
    // Once the new composition has been saved, even deliberate movement back
    // to the old location must survive the next visit.
    saved[key].log = preset[key].log;
    assert.deepEqual(mergeOwnerCampPlacements(saved)[key].provisions, old);
    const oldFramePlacement = (id, [x, y, w, h]) => {
      const object = base.objects.find(item => item.id === id);
      return [(x + w / 2) * device.width / 390 - object.foot[0],
        (y + h) * device.height / 844 - object.foot[1], w * device.width / 390 / object.frame[2]];
    };
    const earlierHearth = { [key]: {
      provisions: oldFramePlacement('provisions', [296, 561, 76, 91.2]),
      log: oldFramePlacement('log', [250, 541, 122, 55.916666666666664]),
    } };
    const shifted = mergeOwnerCampPlacements(earlierHearth)[key];
    assert.deepEqual(shifted.provisions, preset[key].provisions);
    assert.deepEqual(shifted.log, preset[key].log);
    earlierHearth[key].log[0] += 2;
    const custom = mergeOwnerCampPlacements(earlierHearth)[key];
    assert.deepEqual(custom.provisions, earlierHearth[key].provisions);
    assert.deepEqual(custom.log, earlierHearth[key].log);
    const previousCampFrames = {
      workshop: [-161.40618, 160.895096, 390, 268.705124],
      hero: [106.98831, 227.36516, 112.48185, 243.026424],
      garden: [245.04948, 374.54188, 130.83876, 80.401972],
      pet: [25.79031, 424.448444, 69.69027, 98.155512],
      fuel: [85.02039, 522.837744, 235.87551, 109.979108],
      log: [195, 531, 134, 61.416666666666664],
      provisions: [270, 550, 76, 91.2],
    };
    const oldCamp = { [key]: Object.fromEntries(Object.entries(previousCampFrames).map(([id, frame]) => [id, oldFramePlacement(id, frame)])) };
    const original = mergeOwnerCampPlacements(oldCamp)[key];
    for (const id of ['workshop', 'hero', 'garden', 'pet', 'fuel']) assert.deepEqual(original[id], oldCamp[key][id]);
    for (const id of ['provisions', 'log']) assert.deepEqual(original[id], preset[key][id]);
    oldCamp[key].garden[0] += 5;
    const withHandEdit = mergeOwnerCampPlacements(oldCamp)[key];
    assert.deepEqual(withHandEdit.garden, oldCamp[key].garden);
    assert.deepEqual(withHandEdit.hero, oldCamp[key].hero);
    const frontBag = { [key]: { provisions: oldFramePlacement('provisions', [218, 589, 72, 86.4]), log: [3, 4, 1] } };
    const tentBag = mergeOwnerCampPlacements(frontBag)[key];
    assert.deepEqual(tentBag.provisions, preset[key].provisions);
    assert.deepEqual(tentBag.log, frontBag[key].log);
    frontBag[key].provisions[0] += 2;
    assert.deepEqual(mergeOwnerCampPlacements(frontBag)[key].provisions, frontBag[key].provisions);
  }
});

test('owner composition is restored from saved assistant layouts without losing hand edits', () => {
  const originalFrames = {
    workshop: [-161.40618, 160.895096, 390, 268.705124],
    hero: [106.98831, 227.36516, 112.48185, 243.026424],
    garden: [245.04948, 374.54188, 130.83876, 80.401972],
    pet: [25.79031, 424.448444, 69.69027, 98.155512],
    fuel: [85.02039, 522.837744, 235.87551, 109.979108],
    log: [195, 531, 134, 61.416666666666664],
    provisions: [27, 345, 76, 91.2],
  };
  const assistantFrames = {
    workshop: [-39, 236, 260, 260 * 268.705124 / 390],
    hero: [145, 283, 106, 106 * 243.026424 / 112.48185],
    garden: [261, 395, 108, 108 * 80.401972 / 130.83876],
    pet: [75, 482, 56, 56 * 98.155512 / 69.69027],
    fuel: [42, 563, 222, 222 * 109.979108 / 235.87551],
    log: [146, 570, 126, 57.75],
    provisions: [42, 413, 80, 96],
  };
  const preset = getOwnerCampPlacements();
  for (const [key, device] of Object.entries(SANDBOX_DEVICES)) {
    const base = getSandboxLayout(device, { foodLayout: 'separate', growthStage: 'initial' });
    const asPlacement = (id, [x, y, w, h]) => {
      const object = base.objects.find(item => item.id === id);
      return [(x + w / 2) * device.width / 390 - object.foot[0],
        (y + h) * device.height / 844 - object.foot[1], w * device.width / 390 / object.frame[2]];
    };
    const saved = { [key]: Object.fromEntries(Object.entries(assistantFrames).map(([id, frame]) => [id, asPlacement(id, frame)])) };
    saved[key].backpack = [4, 5, 1];
    const snapshot = structuredClone(saved);
    const restored = mergeOwnerCampPlacements(saved);
    for (const [id, frame] of Object.entries(originalFrames)) {
      const expected = asPlacement(id, frame);
      for (const actual of [preset[key][id], restored[key][id]]) {
        actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-6, `${id} restored on ${key}`));
      }
    }
    assert.deepEqual(restored[key].backpack, saved[key].backpack);
    assert.deepEqual(saved, snapshot, 'restoration does not mutate saved data');
    assert.deepEqual(mergeOwnerCampPlacements(restored), restored, 'restoration survives reload');
    for (const id of Object.keys(assistantFrames)) {
      const edited = structuredClone(saved);
      edited[key][id][0] += 5;
      assert.deepEqual(mergeOwnerCampPlacements(edited)[key][id], edited[key][id], `${id} hand edit survives`);
    }
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

test('saved layers can extend beyond every screen edge on all phone sizes', () => {
  const closeFrame = (actual, expected) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-8));
  for (const [device, size] of Object.entries(SANDBOX_DEVICES)) {
    const base = getSandboxLayout(size, { foodLayout: 'separate', growthStage: 'initial' });
    for (const [dx, dy] of [[-1000, 0], [1000, 0], [0, -1000], [0, 1000]]) {
      const saved = readPlacements(JSON.stringify({ version: 1, devices: { [device]: { hero: [dx, dy, 1], food: [dx, dy, 1], map: [dx, dy, 1] } } }));
      const moved = moveSandboxLayout(base, saved[device]);
      const pairs = [
        [base.objects.find(o => o.id === 'hero').frame, moved.objects.find(o => o.id === 'hero').frame],
        [base.food, moved.food],
        [base.controls.find(o => o.id === 'map').frame, moved.controls.find(o => o.id === 'map').frame],
      ];
      for (const [before, after] of pairs) closeFrame(after, [before[0] + dx, before[1] + dy, ...before.slice(2)]);
    }
  }
});
