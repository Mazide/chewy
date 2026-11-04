import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDayPhase, journeyBiome, JOURNEY_BIOMES, JOURNEY_STOPS, JOURNEY_REGIONS } from './journey-world.js';

test('automatic light changes at the London day boundaries', () => {
  const cases = [['05:59','night'],['06:00','morning'],['09:59','morning'],['10:00','day'],['16:59','day'],['17:00','evening'],['20:59','evening'],['21:00','night']];
  for (const [time, expected] of cases) {
    assert.equal(resolveDayPhase('auto', new Date(`2026-12-01T${time}:00Z`)), expected);
  }
  assert.equal(resolveDayPhase('auto', new Date('2026-07-01T05:00:00Z')), 'morning');
  assert.equal(resolveDayPhase('auto', new Date('2026-07-01T20:00:00Z')), 'night');
});

test('manual light and camp biome remain independent of the current clock', () => {
  assert.equal(resolveDayPhase('night', new Date('2026-12-01T12:00:00Z')), 'night');
  assert.equal(journeyBiome(2).name, 'Хвойный лес');
  assert.equal(journeyBiome(3).name, 'Тихое озеро');
  assert.equal(journeyBiome(6).name, 'Золотая роща');
  assert.equal(journeyBiome(-1).name, 'Хвойный лес');
  assert.equal(journeyBiome(9).name, 'Цветущий луг');
  assert.equal(journeyBiome(15).name, 'Морское побережье');
  assert.equal(journeyBiome(24).name, 'Снежный перевал');
  assert.equal(journeyBiome(999).name, 'Снежный перевал');
});

test('all biomes have reachable stops in bottom-to-top world order', () => {
  assert.deepEqual([...new Set(JOURNEY_STOPS.map(stop => stop.biome))], Object.keys(JOURNEY_BIOMES));
  assert.equal(new Set(JOURNEY_STOPS.map(stop => stop.name)).size, JOURNEY_STOPS.length);
  for (const [index, stop] of JOURNEY_STOPS.entries()) {
    assert.ok(stop.y > 0 && stop.y < 100);
    assert.ok(JOURNEY_BIOMES[stop.biome].background);
    if (index) assert.ok(stop.y < JOURNEY_STOPS[index-1].y);
  }
  assert.equal(JOURNEY_REGIONS.length, 3);
});
