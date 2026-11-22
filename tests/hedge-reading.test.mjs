/**
 * tests/hedge-reading.test.mjs: the hedges read on the LiDAR's heights (src/hedge-reading.js). Grids drawn here,
 * at the MNH's 50 cm, in the shapes measured on real places (durzo-docs, #493): a garden hedge 1.5 to 3 m high and
 * 1 to 3 m wide; a tree crown, wide and round; a parked car, short.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { readHedges, ridgeMask, hedgeMayStand, wallMayStand, hedgeCells, wallCells, MIN_LENGTH, MAX_RISE } from '../src/hedge-reading.js';

const HALF = 30, STEP = 0.5, N = 2 * HALF / STEP;
const grid = () => ({ n: N, step: STEP, halfSize: HALF, h: new Float32Array(N * N) });
const cell = (x, z) => ({ i: Math.floor((x + HALF) / STEP), j: Math.floor((z + HALF) / STEP) });
/** A raised band from (x0, z) to (x1, z), `width` metres wide, `rise` high. */
function band(g, x0, x1, z, width, rise){
  for (let x = x0; x < x1; x += STEP) for (let d = -width / 2; d < width / 2; d += STEP) {
    const { i, j } = cell(x + STEP / 2, z + d + STEP / 2);
    g.h[j * N + i] = rise;
  }
}
/** A round crown of `radius` metres, `rise` high at its middle, lower to its edge. */
function crown(g, cx, cz, radius, rise){
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -HALF + (i + 0.5) * STEP, z = -HALF + (j + 0.5) * STEP, d = Math.hypot(x - cx, z - cz);
    if (d < radius) g.h[j * N + i] = Math.max(g.h[j * N + i], rise * (1 - 0.4 * d / radius));
  }
}
const lengthOf = (pts) => pts.slice(1).reduce((s, p, k) => s + Math.hypot(p.x - pts[k].x, p.z - pts[k].z), 0);

describe('hedges read on the heights', () => {
  test('a garden hedge: one line along it, its height and width', () => {
    const g = grid();
    band(g, -15, 10, 5, 1.5, 2.2);
    const r = readHedges(g);
    assert.equal(r.length, 1);
    assert.ok(lengthOf(r[0].pts) > 23 && lengthOf(r[0].pts) < 26, `about 25 m: ${lengthOf(r[0].pts)}`);
    assert.ok(r[0].pts.every(p => Math.abs(p.z - 5) < 1), 'along its middle');
    assert.equal(r[0].rise, 2.2);
    assert.ok(r[0].width >= 1 && r[0].width <= 2.5, `its width: ${r[0].width}`);
  });
  test('an L: both arms, each as long as it is', () => {
    const g = grid();
    band(g, -20, 5, -10, 1, 1.8);
    for (let z = -10; z < 15; z += STEP) for (let x = 4; x < 5; x += STEP) { const { i, j } = cell(x + 0.25, z + 0.25); g.h[j * N + i] = 1.8; }
    const r = readHedges(g);
    const total = r.reduce((s, h) => s + lengthOf(h.pts), 0);
    assert.ok(total > 40 && total < 52, `both arms: ${total} m in ${r.length}`);
  });
  test('NOT: a tree crown, a short line (a parked car), what is too low or too high', () => {
    const g = grid();
    crown(g, -15, -15, 5, 4.5);
    band(g, 10, 10 + MIN_LENGTH - 3, 20, 1.8, 1.5);
    band(g, -20, 10, 0, 1, 0.3);
    band(g, -20, 10, 12, 1.5, MAX_RISE + 2);
    assert.deepEqual(readHedges(g), []);
  });
  test('NOT in a building, nor along a road or a known barrier, nor where the classes say no', () => {
    const g = grid();
    band(g, -15, 10, 5, 1.5, 2.2);
    const ring = [{ x: -20, z: 0 }, { x: 15, z: 0 }, { x: 15, z: 10 }, { x: -20, z: 10 }];
    assert.deepEqual(readHedges(g, { rings: [ring] }), []);
    assert.deepEqual(readHedges(g, { lines: [{ pts: [{ x: -20, z: 6 }, { x: 15, z: 6 }], half: 1 }] }), []);
    assert.equal(readHedges(g, { lines: [{ pts: [{ x: -20, z: 12 }, { x: 15, z: 12 }], half: 3 }] }).length, 1, 'a road 4 m away: kept');
    assert.deepEqual(readHedges(g, { cells: new Uint8Array(N * N) }), []);
    assert.equal(readHedges(g, { cells: new Uint8Array(N * N).fill(1) }).length, 1);
  });
  test('the ridge: lower on both sides, not on one only (a building\'s edge, a bank)', () => {
    const g = grid();
    for (let j = 0; j < N; j++) for (let i = 0; i < N / 2; i++) g.h[j * N + i] = 2;
    assert.equal(ridgeMask(g).reduce((s, v) => s + v, 0), 0);
  });
  test('no grid, nothing', () => {
    assert.deepEqual(readHedges(null), []);
    assert.equal(hedgeCells(null, grid()), null);
  });
});

describe('the LiDAR\'s classes', () => {
  test('its palette, as it answered: a ridge on vegetation, the ground or above-ground; not on a building nor on nothing', () => {
    assert.equal(hedgeMayStand(70, 150, 60, 255), true, 'vegetation');
    assert.equal(hedgeMayStand(90, 110, 40, 255), true, 'low vegetation');
    assert.equal(hedgeMayStand(207, 150, 70, 255), true, 'ground');
    assert.equal(hedgeMayStand(255, 0, 255, 255), true, 'perennial above-ground');
    assert.equal(hedgeMayStand(180, 20, 20, 255), false, 'building');
    assert.equal(hedgeMayStand(0, 0, 0, 0), false, 'nothing named (a car)');
    assert.equal(hedgeMayStand(70, 150, 60, 0), false, 'transparent, whatever its colour');
    assert.equal(hedgeMayStand(30, 150, 160, 255), false, 'water, or any colour unknown');
  });
  test('a wall is read on the ground or above-ground only: not on vegetation (a hedge), a building (eaves), a car', () => {
    assert.equal(wallMayStand(207, 150, 70, 255), true);
    assert.equal(wallMayStand(255, 0, 255, 255), true);
    assert.equal(wallMayStand(70, 150, 60, 255), false);
    assert.equal(wallMayStand(90, 110, 40, 255), false);
    assert.equal(wallMayStand(180, 20, 20, 255), false);
    assert.equal(wallMayStand(207, 150, 70, 0), false);
    const map = { width: 2, height: 1, data: new Uint8ClampedArray([207, 150, 70, 255, 70, 150, 60, 255]) };
    const c = wallCells(map, { n: 4 });
    assert.deepEqual([...c.slice(0, 4)], [1, 1, 0, 0]);
  });
  test('the map laid on the grid, whatever its size', () => {
    const g = grid();
    const map = { width: 4, height: 4, data: new Uint8ClampedArray(64) };
    for (let k = 0; k < 16; k++) map.data.set(k % 4 < 2 ? [70, 150, 60, 255] : [180, 20, 20, 255], k * 4);
    const c = hedgeCells(map, g);
    assert.equal(c[0], 1, 'west: vegetation');
    assert.equal(c[N - 1], 0, 'east: building');
    assert.equal(c.reduce((s, v) => s + v, 0), N * N / 2);
  });
});
