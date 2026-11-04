// Cosmetic scene motion, in scene widths and seconds. One clock drives the
// original wing frames and fixed-step flight physics, independent of render FPS.
const STEP = 1 / 240;
const BEAT = .55;
const DOWNSTROKE = .17;
const CYCLE = 8;
const START = -.12;
const EXIT = 1.12;

export function wingbeatAt(seconds) {
  const phase = ((seconds % BEAT) + BEAT) % BEAT;
  const down = phase < DOWNSTROKE;
  return {
    // Source frames 0–8: wings descend; 8–23: recovery to the next raised pose.
    frame: Math.min(23, Math.floor(down ? phase / DOWNSTROKE * 8 : 8 + (phase - DOWNSTROKE) / (BEAT - DOWNSTROKE) * 16)),
    thrust: down ? Math.sin(Math.PI * phase / DOWNSTROKE) : 0,
  };
}

const flight = [];
let x = START, y = 0, vx = .23, vy = 0;
for (let i = 0; i <= Math.ceil(CYCLE / STEP); i++) {
  const time = i * STEP;
  const wing = wingbeatAt(time);
  flight.push({ x, y, vx, vy });
  if (x > EXIT) continue; // Wait fully outside the right edge before the next pass.
  // Forward impulse during the downstroke, then drag towards gliding speed.
  vx += (1.1 * wing.thrust + 3 * (.17 - vx)) * STEP;
  // Lift opposes gravity; damping and a weak restoring force hold the flight lane.
  vy += (.394 - 2 * wing.thrust - 3 * vy - 8 * y) * STEP;
  x += vx * STEP;
  y += vy * STEP;
}

export function birdFlightAt(seconds) {
  const time = Math.max(0, seconds) % CYCLE;
  const sample = time / STEP;
  const index = Math.floor(sample);
  const a = flight[index], b = flight[Math.min(index + 1, flight.length - 1)];
  const mix = key => a[key] + (b[key] - a[key]) * (sample - index);
  const vx = mix('vx'), vy = mix('vy');
  return {
    x: mix('x'), y: mix('y'), vx, vy,
    // A small pitch follows velocity rather than rotating the sprite on a sine wave.
    angle: Math.max(-7, Math.min(7, Math.atan2(vy, vx) * 180 / Math.PI * .3)),
    ...wingbeatAt(time),
  };
}
