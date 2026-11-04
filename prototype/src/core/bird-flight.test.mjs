import test from 'node:test';
import assert from 'node:assert/strict';
import { birdFlightAt, wingbeatAt } from './bird-flight.js';

test('downstroke drives forward acceleration and upward lift; recovery loses speed', () => {
  const before = birdFlightAt(.01), push = birdFlightAt(.16), glide = birdFlightAt(.5);
  assert.ok(push.vx > before.vx * 1.2);
  assert.ok(push.vy < before.vy);
  assert.ok(glide.vx < push.vx * .85);
  assert.equal(wingbeatAt(.09).frame, 4);
  assert.ok(wingbeatAt(.085).thrust > .99);
  assert.equal(wingbeatAt(.35).thrust, 0);
});

test('flight crosses both boundaries without reversing or resetting onscreen', () => {
  let previous = birdFlightAt(0), crossed = false, maxSpeed = 0, minSpeed = 1;
  assert.ok(previous.x + .07 < 0);
  for (let t = .01; t < 8; t += .01) {
    const pose = birdFlightAt(t);
    assert.ok(pose.x >= previous.x);
    assert.ok(Math.abs(pose.y) < .025);
    assert.ok(Math.abs(pose.angle) <= 7);
    assert.ok(pose.frame >= 0 && pose.frame <= 23);
    if (pose.x > 1) crossed = true;
    minSpeed = Math.min(minSpeed, pose.vx); maxSpeed = Math.max(maxSpeed, pose.vx);
    previous = pose;
  }
  assert.ok(crossed && previous.x > 1.12);
  assert.ok(maxSpeed / minSpeed > 1.35);
  assert.equal(birdFlightAt(8).x, birdFlightAt(0).x);
});
