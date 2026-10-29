import { HERO_DEMO_TIMING } from './demo-config.js';
export { HERO_DEMO_TIMING } from './demo-config.js';

const isTimestamp = value => typeof value === 'number' && Number.isFinite(value);

export function shouldWelcomeBack(lastSeenAt, now) {
  return isTimestamp(lastSeenAt) && isTimestamp(now)
    && now - lastSeenAt >= HERO_DEMO_TIMING.returnAfterMs;
}

export function resolveHeroState({ phase = 'day', lastPhotoAt = null, now, returning = false } = {}) {
  if (phase === 'night') return 'sleeping';
  const sincePhoto = isTimestamp(lastPhotoAt) && isTimestamp(now) ? now - lastPhotoAt : -1;
  if (sincePhoto >= 0 && sincePhoto < HERO_DEMO_TIMING.happyMs) return 'happy';
  if (returning) return 'returning';
  return 'idle';
}
