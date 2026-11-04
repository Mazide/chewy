import test from 'node:test';
import assert from 'node:assert/strict';
import { HERO_DEMO_TIMING, resolveHeroState, shouldWelcomeBack } from './hero-state.js';

const now = new Date(2026, 9, 29, 12).getTime();

test('the hero is calmly idle without a recent photo or a return event', () => {
  assert.equal(resolveHeroState({ now }), 'idle');
  assert.equal(resolveHeroState({ now, lastPhotoAt: now - 30 * 24 * 3600000 }), 'idle');
  for (const phase of ['morning', 'day', 'evening']) {
    assert.equal(resolveHeroState({ phase, now }), 'idle');
  }
});

test('a first photo makes the hero happy immediately without requiring an analysis', () => {
  assert.equal(resolveHeroState({ now, lastPhotoAt: now }), 'happy');
  assert.equal(resolveHeroState({ now, lastPhotoAt: now - HERO_DEMO_TIMING.happyMs + 1 }), 'happy');
  assert.equal(resolveHeroState({ now, lastPhotoAt: now - HERO_DEMO_TIMING.happyMs }), 'idle');
  assert.equal(resolveHeroState({ now, lastPhotoAt: now + 1 }), 'idle');
});

test('sleep takes precedence over both a photo and a warm return', () => {
  assert.equal(resolveHeroState({ phase: 'night', now }), 'sleeping');
  assert.equal(resolveHeroState({ phase: 'night', now, lastPhotoAt: now, returning: true }), 'sleeping');
  assert.equal(resolveHeroState({ phase: 'night', now, returning: true }), 'sleeping');
});

test('returning is an explicit event and a new photo takes precedence during the day', () => {
  assert.equal(resolveHeroState({ now, returning: true }), 'returning');
  assert.equal(resolveHeroState({ now, returning: true, lastPhotoAt: now }), 'happy');
  assert.equal(resolveHeroState({ now, returning: false }), 'idle');
});

test('a welcome requires a previous visit and enough elapsed demo time', () => {
  assert.equal(shouldWelcomeBack(null, now), false);
  assert.equal(shouldWelcomeBack(undefined, now), false);
  assert.equal(shouldWelcomeBack(now, now), false);
  assert.equal(shouldWelcomeBack(now + 1, now), false);
  assert.equal(shouldWelcomeBack(now - HERO_DEMO_TIMING.returnAfterMs + 1, now), false);
  assert.equal(shouldWelcomeBack(now - HERO_DEMO_TIMING.returnAfterMs, now), true);
  assert.equal(shouldWelcomeBack(now - 30 * 24 * 3600000, now), true);
  assert.equal(shouldWelcomeBack(now, now + HERO_DEMO_TIMING.returnAfterMs), true);
});

test('invalid timestamps do not create happiness or a welcome', () => {
  for (const value of [undefined, null, NaN, Infinity, '']) {
    assert.equal(resolveHeroState({ now, lastPhotoAt: value }), 'idle');
    assert.equal(shouldWelcomeBack(value, now), false);
    assert.equal(shouldWelcomeBack(now, value), false);
  }
  assert.equal(resolveHeroState({ now: NaN, lastPhotoAt: now }), 'idle');
});
