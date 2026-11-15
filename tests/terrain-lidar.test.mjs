/**
 * tests/terrain-lidar.test.mjs: THE GROUND FROM THE LIDAR HD'S TERRAIN (#482c, src/real-place-sources.js). One
 * grid at 1 m, each cell centred on a metre of the relief, read as it is (a bank stays a bank); France only;
 * too little of it known, the point service instead; a cell without data or far off takes the mean.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { terrainPlan, reliefFromTerrain, TERRAIN_LIDAR } from '../src/real-place-sources.js';

const centre = { lat: 48.4062, lon: 2.6858 };

test('the grid asked: the relief\'s metres, half a metre beyond; France only', () => {
  const p = terrainPlan({ centre, halfSize: 100, country: 'fr' });
  assert.equal(p.out, 100);
  assert.equal(p.side, 201);
  const height = (p.bbox.north - p.bbox.south) * 111320;
  assert.ok(Math.abs(height - 201) < 0.5, `${height}`);
  assert.equal(terrainPlan({ centre, halfSize: 100, country: 'de' }), null);
  assert.equal(terrainPlan({ centre, halfSize: 300, country: 'fr' }).out, 200, 'the relief\'s largest');
});

test('read as it is: a 1 m bank stays where and as high as it is', () => {
  const p = terrainPlan({ centre, halfSize: 10, country: 'fr' });
  const f = new Float32Array(p.side * p.side).map((_, k) => 80 + ((k % p.side) >= 10 ? 1 : 0));
  const r = reliefFromTerrain(f, p);
  assert.equal(r.provider, TERRAIN_LIDAR.id);
  assert.deepEqual([r.x0, r.z0, r.nx, r.nz], [-10, -10, 21, 21]);
  assert.equal(r.altitudes[5 * 21 + 9], 80);
  assert.equal(r.altitudes[5 * 21 + 10], 81, 'the step at x = 0, not smeared over 5 m');
  assert.equal(r.missing, 0);
});

test('a hole takes the mean; too many holes: no relief (the point service then)', () => {
  const p = terrainPlan({ centre, halfSize: 10, country: 'fr' });
  const f = new Float32Array(p.side * p.side).fill(80);
  f[0] = -99999; f[1] = NaN;
  const r = reliefFromTerrain(f, p);
  assert.equal(r.altitudes[0], 80);
  assert.ok(r.missing > 0 && r.missing < 0.01);
  assert.equal(reliefFromTerrain(new Float32Array(p.side * p.side).fill(-99999), p), null);
  assert.equal(reliefFromTerrain(new Float32Array(10), p), null, 'not its grid');
});
