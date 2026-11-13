/**
 * tests/height-reading.test.mjs: the IGN LiDAR's heights read at the import (src/height-reading.js, #477d):
 * roofs on synthetic height grids (flat, gabled either way, hipped, too small, no data), the ridge's `sens`,
 * a tree's height, the plan asked, a building's parts of different heights (#477d-2); and a translation using them (src/osm-scene.js).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { heightPlan, heightGrid, roofFromHeights, ridgeSense, treeHeightAt, partsFromHeights, FLAT_RISE } from '../src/height-reading.js';
import { translateOsm } from '../src/osm-scene.js';

/** A grid of `side` metres at 0.5 m, every cell `fn(x, z)` (zone frame). */
function grid(side, fn){
  const n = side * 2, h = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[j * n + i] = fn(-side / 2 + (i + 0.5) / 2, -side / 2 + (j + 0.5) / 2);
  return heightGrid(h, n, side / 2);
}
const rect = (x0, z0, x1, z1) => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
const inRect = (x, z, [x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
const deg = (d) => Math.tan(d * Math.PI / 180);

describe('LiDAR heights, a building\'s roof', () => {
  const box = [-10, -5, 10, 5];   // 20 m along x, 10 m deep
  test('a flat roof: its height, flat (a parapet\'s metre does not make it pitched)', () => {
    const g = grid(40, (x, z) => (inRect(x, z, box) ? (Math.abs(z) > 4.6 ? 12.8 : 12) : 0));
    const r = roofFromHeights(g, rect(...box));
    assert.equal(r.flat, true);
    assert.ok(Math.abs(r.eaves - 12) < 0.3, `eaves ${r.eaves}`);
    assert.ok(r.top - 12 < FLAT_RISE);
  });
  test('a gabled roof, its ridge along x (the long side): eaves, top, pitch, ridge, two slopes', () => {
    const g = grid(40, (x, z) => (inRect(x, z, box) ? 9 + (5 - Math.abs(z)) * deg(35) : 0));
    const r = roofFromHeights(g, rect(...box));
    assert.equal(r.flat, false); assert.equal(r.hip, false);
    assert.ok(Math.abs(r.eaves - 9.4) < 0.7, `eaves ${r.eaves}`);
    assert.ok(Math.abs(r.top - (9 + 5 * deg(35))) < 0.5, `top ${r.top}`);
    assert.ok(Math.abs(r.pitch - 35) <= 3, `pitch ${r.pitch}`);
    assert.ok(Math.abs(Math.abs(r.ridge.x) - 1) < 0.05, `ridge ${JSON.stringify(r.ridge)}`);
    assert.equal(ridgeSense(rect(...box), r.ridge), 0, 'along the longest side');
  });
  test('a gabled roof across its length: sens 1', () => {
    const g = grid(40, (x, z) => (inRect(x, z, box) ? 9 + Math.max(0, 10 - Math.abs(x)) * deg(20) : 0));
    const r = roofFromHeights(g, rect(...box));
    assert.ok(Math.abs(Math.abs(r.ridge.z) - 1) < 0.05);
    assert.equal(ridgeSense(rect(...box), r.ridge), 1);
  });
  test('a hipped roof: slopes on its four sides', () => {
    const g = grid(40, (x, z) => (inRect(x, z, box) ? 9 + Math.min(5 - Math.abs(z), 10 - Math.abs(x)) * deg(30) : 0));
    const r = roofFromHeights(g, rect(...box));
    assert.equal(r.hip, true);
    assert.ok(Math.abs(r.pitch - 30) <= 3, `pitch ${r.pitch}`);
  });
  test('an L-shaped building is not hipped (its wings\' slopes cross: measured 0.16 to 0.22 on Eguisheim)', () => {
    // Two gabled wings: one along x (ridge z = 0), one along z (ridge x = -7).
    const L = [{ x: -10, z: -5 }, { x: 10, z: -5 }, { x: 10, z: 5 }, { x: -4, z: 5 }, { x: -4, z: 15 }, { x: -10, z: 15 }];
    const g = grid(40, (x, z) => {
      if (x >= -10 && x <= 10 && z >= -5 && z <= 5) return 9 + (5 - Math.abs(z)) * deg(40);
      if (x >= -10 && x <= -4 && z >= -5 && z <= 15) return 9 + (3 - Math.abs(x + 7)) * deg(40);
      return 0;
    });
    assert.equal(roofFromHeights(g, L).hip, false);
  });
  test('nothing said: too small, nothing standing there, no data', () => {
    assert.equal(roofFromHeights(grid(40, () => 9), rect(0, 0, 2, 2)), null, '4 m²');
    assert.equal(roofFromHeights(grid(40, () => 0.3), rect(...box)), null, 'a building gone');
    assert.equal(roofFromHeights(grid(40, () => NaN), rect(...box)), null);
    assert.equal(roofFromHeights(null, rect(...box)), null);
  });
});

describe('LiDAR heights, trees and the plan', () => {
  test('a tree: the highest within 2 m of its trunk; under 3 m, none', () => {
    const g = grid(40, (x, z) => Math.max(0, 11 - 2 * Math.hypot(x - 5, z - 5)));
    assert.equal(treeHeightAt(g, 5.5, 5.5), 10.3, 'the cell nearest its top');
    assert.equal(treeHeightAt(g, -15, -15), undefined);
  });
  test('the grid asked: the zone at 50 cm, France only; a grid of the wrong size is refused', () => {
    const toGeo = ({ x, z }) => ({ lat: 43.6 - z / 111320, lon: 3.88 + x / 80000 });
    const p = heightPlan({ toGeo, halfSize: 100, country: 'fr' });
    assert.equal(p.width, 400);
    assert.ok(p.bbox.north > p.bbox.south && p.bbox.east > p.bbox.west);
    assert.equal(heightPlan({ toGeo, halfSize: 100, country: 'es' }), null);
    assert.equal(heightGrid(new Float32Array(10), 4, 1), null);
  });
});

describe('LiDAR heights, a building\'s parts (#477d-2)', () => {
  const long = rect(-15, -5, 15, 5);
  const gable = (x, z, eaves, d) => eaves + (5 - Math.abs(z)) * deg(d);
  test('a high body and a low flat wing: two parts, cut along the wall between them', () => {
    const g = grid(50, (x, z) => (inRect(x, z, [-15, -5, 15, 5]) ? (x < 3 ? gable(x, z, 12, 45) : 4) : 0));
    const parts = partsFromHeights(g, long);
    assert.equal(parts.length, 2);
    const xs = parts.map(q => q.map(p => p.x).sort((a, b) => a - b));
    assert.ok(xs.some(x => Math.abs(x[0] - 3) < 0.6) && xs.some(x => Math.abs(x[x.length - 1] - 3) < 0.6), JSON.stringify(parts));
  });
  test('three heights in a row: three parts', () => {
    const g = grid(60, (x, z) => (inRect(x, z, [-15, -5, 15, 5]) ? (x < -5 ? gable(x, z, 12, 45) : x < 5 ? 6 : gable(x, z, 9, 40)) : 0));
    assert.equal(partsFromHeights(g, long).length, 3);
  });
  test('one roof, a dormer, a step under 2 m, a small annex: one building', () => {
    assert.equal(partsFromHeights(grid(50, (x, z) => (inRect(x, z, [-15, -5, 15, 5]) ? gable(x, z, 12, 45) : 0)), long), null, 'one roof');
    assert.equal(partsFromHeights(grid(50, (x, z) => (inRect(x, z, [-15, -5, 15, 5]) ? (inRect(x, z, [0, 1, 2, 3]) ? 20 : gable(x, z, 12, 45)) : 0)), long), null, 'a dormer');
    assert.equal(partsFromHeights(grid(50, (x, z) => (inRect(x, z, [-15, -5, 15, 5]) ? (x < 0 ? 10 : 8.8) : 0)), long), null, '1.2 m');
    assert.equal(partsFromHeights(grid(50, (x, z) => (inRect(x, z, [-15, -5, 15, 5]) ? (x < 13.5 ? gable(x, z, 12, 45) : 4) : 0)), long), null, 'an annex under PART_MIN (1.5 × 10 m)');
    assert.equal(partsFromHeights(null, long), null);
  });
});

describe('LiDAR heights, in a translation', () => {
  test('a building takes the measured eaves (levels from it) and roof (type, pitch, ridge)', () => {
    const centre = { lat: 48, lon: 7 };
    const dLat = 1 / 111320, dLon = 1 / (111320 * Math.cos(48 * Math.PI / 180));
    const at = (x, z) => [48 - z * dLat, 7 + x * dLon];
    const ring = [at(-10, -5), at(10, -5), at(10, 5), at(-10, 5), at(-10, -5)];
    // Hipped, 15 m to the eaves.
    const heights = grid(60, (x, z) => (inRect(x, z, [-10, -5, 10, 5]) ? 15 + Math.min(5 - Math.abs(z), 10 - Math.abs(x)) * deg(40) : 0));
    const t = translateOsm({ elements: [{ type: 'way', id: 1, tags: { building: 'yes', 'roof:shape': 'gabled' }, geometry: ring }] }, { centre, halfSize: 30, heights });
    const b = t.buildings[0].building;
    const top = b.niveaux.reduce((p, q) => (q.elevation > p.elevation ? q : p));
    assert.equal(top.toit.type, 'quatre-pans', 'the LiDAR before the tag');
    assert.ok(Math.abs(top.toit.pente - 40) <= 4);
    const eaves = top.elevation + top.hauteur + top.dalle;
    assert.ok(Math.abs(eaves - 15.6) < 1.2, `eaves ${eaves}`);
    assert.equal(b.niveaux.length, 5, '15 m: five levels');
    const t2 = translateOsm({ elements: [{ type: 'way', id: 1, tags: { building: 'yes', 'roof:shape': 'gabled' }, geometry: ring }] }, { centre, halfSize: 30 });
    assert.equal(t2.buildings[0].building.niveaux.reduce((p, q) => (q.elevation > p.elevation ? q : p)).toit.type, 'deux-pans', 'without heights: the tag');
  });
  test('a building of two heights becomes two buildings, the name on the largest', () => {
    const centre = { lat: 48, lon: 7 };
    const dLat = 1 / 111320, dLon = 1 / (111320 * Math.cos(48 * Math.PI / 180));
    const at = (x, z) => [48 - z * dLat, 7 + x * dLon];
    const ring = [at(-15, -5), at(15, -5), at(15, 5), at(-15, 5), at(-15, -5)];
    const heights = grid(60, (x, z) => (inRect(x, z, [-15, -5, 15, 5]) ? (x < 3 ? 12 + (5 - Math.abs(z)) * deg(45) : 4) : 0));
    const el = { type: 'way', id: 1, tags: { building: 'yes', name: 'Maison' }, geometry: ring };
    const t = translateOsm({ elements: [el] }, { centre, halfSize: 30, heights });
    assert.equal(t.buildings.length, 2);
    const tops = t.buildings.map(b => Math.max(...b.building.niveaux.map(n => n.elevation + n.hauteur)));
    assert.ok(Math.max(...tops) > 10 && Math.min(...tops) < 6, `tops ${tops}`);
    assert.equal(t.buildings.filter(b => b.building.nom === 'Maison').length, 1);
    assert.deepEqual(t.buildings.map(b => b.part), [0, 1]);
    const monument = translateOsm({ elements: [{ ...el, tags: { ...el.tags, wikidata: 'Q1', historic: 'castle' } }] }, { centre, halfSize: 30, heights });
    assert.equal(monument.buildings.length, 1, 'a monument stays whole');
  });
});
