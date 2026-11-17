/**
 * tests/placement-clearance.test.mjs: AN IMPORTED OBJECT STANDS CLEAR OF BUILDINGS, ROADS AND WALLS (src/placement-
 * clearance.js; asked: trees seen inside a small house and astride low walls). Pushed out to the nearest clear
 * place, never moved when already clear, left out when it cannot be cleared within MAX_SHIFT_M; pavements are no
 * obstacle (street trees stand on them).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { clearOfObstacles, obstaclesOf, clearanceOf, MAX_SHIFT_M, fitCrowns, spaceTrees, TREE_GAP_M } from '../src/placement-clearance.js';

const square = (x0, z0, s) => [{ x: x0, z: z0 }, { x: x0 + s, z: z0 }, { x: x0 + s, z: z0 + s }, { x: x0, z: z0 + s }];
const place = (paths = [], footprints = []) => obstaclesOf({ buildings: footprints.map(f => ({ footprint: f })), paths });

test('a tree just inside a house goes out by its nearest wall, 1 m clear', () => {
  const els = [{ objType: 'arbre', x: 9.5, z: 5 }];
  const r = clearOfObstacles(els, place([], [square(0, 0, 10)]));
  assert.deepEqual(r, { moved: 1, removed: 0 });
  assert.ok(Math.abs(els[0].x - 11) < 0.02 && Math.abs(els[0].z - 5) < 0.02, JSON.stringify(els[0]));
});

test('a bench against a house: 0.4 m clear, not a tree\'s 1 m', () => {
  const els = [{ objType: 'banc', x: 10.1, z: 5 }];
  clearOfObstacles(els, place([], [square(0, 0, 10)]));
  assert.ok(Math.abs(els[0].x - 10.4) < 0.02, JSON.stringify(els[0]));
  assert.equal(clearanceOf('banc'), 0.4);
  assert.equal(clearanceOf('platane'), 0.4);
  assert.equal(clearanceOf('olivier'), 1);
});

test('a tree on a low wall or a road steps aside; on a pavement it stays', () => {
  const wall = { kind: 'muret', world: { pts: [{ x: -20, z: 0 }, { x: 20, z: 0 }] } };
  const road = { kind: 'route', world: { pts: [{ x: -20, z: 30 }, { x: 20, z: 30 }], width: 8 } };
  const pavement = { kind: 'trottoir', world: { pts: [{ x: -20, z: 60 }, { x: 20, z: 60 }], width: 2 } };
  const els = [{ objType: 'arbre', x: 0, z: 0.2 }, { objType: 'arbre', x: 3, z: 32 }, { objType: 'arbre', x: 5, z: 60 }];
  const r = clearOfObstacles(els, place([wall, road, pavement]));
  assert.deepEqual(r, { moved: 2, removed: 0 });
  assert.ok(Math.abs(els[0].z - 1.25) < 0.02, `wall: ${els[0].z}`);
  assert.ok(Math.abs(els[1].z - 35) < 0.02, `road: ${els[1].z}`);
  assert.deepEqual(els[2], { objType: 'arbre', x: 5, z: 60 });
});

test('exactly on a wall\'s line: across it, not left there', () => {
  const els = [{ objType: 'arbre', x: 0, z: 0 }];
  clearOfObstacles(els, place([{ kind: 'muret', world: { pts: [{ x: -5, z: 0 }, { x: 5, z: 0 }] } }]));
  assert.ok(Math.abs(Math.abs(els[0].z) - 1.25) < 0.02, JSON.stringify(els[0]));
});

test('clear already: not moved by a hair', () => {
  const els = [{ objType: 'arbre', x: 20, z: 20 }];
  assert.deepEqual(clearOfObstacles(els, place([], [square(0, 0, 10)])), { moved: 0, removed: 0 });
  assert.deepEqual(els[0], { objType: 'arbre', x: 20, z: 20 });
});

test('between a house and a road: in the gap when it holds the tree, left out when it does not', () => {
  const house = square(0, 0, 10);
  const wide = place([{ kind: 'route', world: { pts: [{ x: -20, z: 16 }, { x: 40, z: 16 }], width: 4 } }], [house]);
  const a = [{ objType: 'arbre', x: 5, z: 9.5 }];
  clearOfObstacles(a, wide);
  assert.equal(a.length, 1);
  assert.ok(a[0].z >= 11 - 0.02 && a[0].z <= 13 + 0.02, `in the gap: ${a[0].z}`);
  const narrow = place([{ kind: 'route', world: { pts: [{ x: -20, z: 13 }, { x: 40, z: 13 }], width: 4 } }], [house]);
  const b = [{ objType: 'arbre', x: 5, z: 10.5 }];
  assert.deepEqual(clearOfObstacles(b, narrow), { moved: 0, removed: 1 });
});

test('deep inside a large building: left out rather than dragged out far', () => {
  const els = [{ objType: 'arbre', x: 25, z: 25 }, { objType: 'banc', x: 60, z: 60 }];
  const r = clearOfObstacles(els, place([], [square(0, 0, 50)]));
  assert.deepEqual(r, { moved: 0, removed: 1 });
  assert.deepEqual(els.map(e => e.objType), ['banc']);
  assert.ok(MAX_SHIFT_M >= 3 && MAX_SHIFT_M <= 6);
});

test('the obstacles of a place: footprints, and the paths that bar the way, their width or the kind\'s', () => {
  const o = obstaclesOf({ buildings: [{ footprint: square(0, 0, 5) }, { building: {} }],
    paths: [{ kind: 'route', world: { pts: [{ x: 0, z: 0 }, { x: 1, z: 0 }], width: 7 } },
      { kind: 'muret', world: { pts: [{ x: 0, z: 0 }, { x: 1, z: 0 }] } },
      { kind: 'trottoir', world: { pts: [{ x: 0, z: 0 }, { x: 1, z: 0 }], width: 2 } },
      { kind: 'chemin', world: { pts: [{ x: 0, z: 0 }, { x: 1, z: 0 }] } }] });
  assert.equal(o.rings.length, 1);
  assert.deepEqual(o.lines.map(l => l.half), [3.5, 0.25, 0.75], 'a footpath too');
});

test('a street lamp on a facade stays there (OSM puts it on the outline); off the road all the same', () => {
  const road = { kind: 'route', world: { pts: [{ x: -20, z: 13 }, { x: 40, z: 13 }], width: 4 } };
  const els = [{ objType: 'lampadaire', x: 5, z: 10 }, { objType: 'lampadaire', x: 20, z: 13.5 }];
  const r = clearOfObstacles(els, place([road], [square(0, 0, 10)]));
  assert.deepEqual(r, { moved: 1, removed: 0 });
  assert.deepEqual(els[0], { objType: 'lampadaire', x: 5, z: 10 });
  assert.ok(Math.abs(els[1].z - 15.4) < 0.02, JSON.stringify(els[1]));
});

// ─── The crowns of our generated trees ─────────────────────────────────────────────────────────────────────
// A house 10 m square, 5 m high, its west wall at x = 0; a tree 10 m high, its crown starting at 3 m (lower than
// the roof): crossing it, unless it is turned, moved or regrown.
const house = (h = 5) => ({ rings: [square(0, -5, 10)], heights: [h], lines: [] });
const circle = (r) => ({ hull: Array.from({ length: 12 }, (_, i) => ({ x: r * Math.cos(i * Math.PI / 6), z: r * Math.sin(i * Math.PI / 6) })), base: 0.3 });
const leaning = { hull: [{ x: -0.05, z: -0.1 }, { x: 0.45, z: -0.1 }, { x: 0.45, z: 0.1 }, { x: -0.05, z: 0.1 }], base: 0.3 };
const tree = (extra = {}) => ({ objType: 'arbre', essence: 'Platane', variante: 1, height: 10, x: -1.5, z: 0, ...extra });

test('a crown leaning into a house: turned away, the tree where it stands', () => {
  const e = tree();
  assert.deepEqual(fitCrowns([e], house(), () => leaning), { turned: 1, moved: 0, regrown: 0, crossing: 0 });
  assert.equal(e.x, -1.5); assert.equal(e.z, 0);
  assert.ok(Math.cos(e.rotY) < 0, `turned ${e.rotY}`);
});

test('a round crown: turning is no help, moved away (its trunk clear all the same)', () => {
  const e = tree();
  assert.deepEqual(fitCrowns([e], house(), () => circle(0.25)), { turned: 0, moved: 1, regrown: 0, crossing: 0 });
  assert.ok(e.x <= -2.5 + 0.01 && Math.hypot(e.x + 1.5, e.z) <= MAX_SHIFT_M + 1e-9, JSON.stringify(e));
});

test('too wide wherever it goes: another variant, narrower', () => {
  const e = tree();
  const r = fitCrowns([e], house(), (s, v) => (v === 3 ? circle(0.1) : circle(0.9)));
  assert.deepEqual(r, { turned: 0, moved: 0, regrown: 1, crossing: 0 });
  assert.equal(e.variante, 3);
});

test('a house lower than where the crown starts: nothing to do; no variant fits: left as it was', () => {
  const low = tree();
  assert.deepEqual(fitCrowns([low], house(2.5), () => leaning), { turned: 0, moved: 0, regrown: 0, crossing: 0 });
  assert.deepEqual(low, tree());
  const big = tree();
  assert.deepEqual(fitCrowns([big], house(), () => circle(0.9)), { turned: 0, moved: 0, regrown: 0, crossing: 1 });
  assert.deepEqual(big, tree());
  const bank = { objType: 'arbre', modelFile: 'bank--erable-1.glb', height: 10, x: -1.5, z: 0 };
  assert.deepEqual(fitCrowns([bank], house(), () => circle(0.9)).crossing, 0, 'only our generated trees');
});

describe('trees apart (asked by Durzo on 16 Nov. 2026: trunks in each other)', () => {
  test('a tree closer than TREE_GAP_M to one kept before it is left out; shrubs and furniture are not trees', () => {
    const els = [
      { objType: 'arbre', x: 0, z: 0 }, { objType: 'arbre', x: 0.91, z: 0.91 },   // sc15727's pairs
      { objType: 'conifere', x: 1.46, z: 0.38 },                                  // sc16366's, another type
      { objType: 'arbre', x: TREE_GAP_M, z: 0 },                                  // just far enough
      { objType: 'buisson', x: 0.5, z: 0 }, { objType: 'banc', x: 0.2, z: 0.2 },
    ];
    assert.equal(spaceTrees(els), 2);
    assert.deepEqual(els.map(e => [e.objType, e.x]), [['arbre', 0], ['arbre', TREE_GAP_M], ['buisson', 0.5], ['banc', 0.2]]);
    assert.equal(TREE_GAP_M, 2.5);
  });
  test('a crown is not moved against another tree\'s trunk', () => {
    // A tree whose crown crosses a building on its east; moving it 1 m west would put it 0.5 m from a neighbour.
    const ring = [{ x: 1, z: -5 }, { x: 10, z: -5 }, { x: 10, z: 5 }, { x: 1, z: 5 }];
    const obstacles = { rings: [ring], heights: [20], lines: [] };
    // A crown 2.5 m round its trunk: at x −1 it reaches 1.5, inside the building; 1 m west would clear it.
    const crown = { hull: [{ x: -0.25, z: -0.25 }, { x: 0.25, z: -0.25 }, { x: 0.25, z: 0.25 }, { x: -0.25, z: 0.25 }], base: 0 };
    const e = { objType: 'arbre', essence: 'X', height: 10, x: -1, z: 0, rotY: 0, variante: 1 };
    const neighbour = { objType: 'arbre', x: -2.5, z: 0 };
    fitCrowns([e, neighbour], obstacles, () => crown);
    const gap = Math.hypot(e.x - neighbour.x, e.z - neighbour.z);
    assert.ok(e.x !== -1 || e.z !== 0, 'moved');
    assert.ok(gap >= TREE_GAP_M - 1e-9, `moved to (${e.x}, ${e.z}), ${gap.toFixed(2)} m from its neighbour`);
  });
});

test('nothing on a footpath (chemin), as on a road (decided by Durzo: trees on the traces seen)', async () => {
  const { clearOfObstacles, obstaclesOf } = await import('../src/placement-clearance.js');
  const translated = { buildings: [], paths: [{ kind: 'chemin', world: { pts: [{ x: 0, z: -20 }, { x: 0, z: 20 }], width: 2 } }] };
  const els = [{ objType: 'arbre', x: 0.3, z: 0 }, { objType: 'arbre', x: 8, z: 0 }];
  clearOfObstacles(els, obstaclesOf(translated));
  assert.equal(els.length, 2);
  assert.ok(Math.abs(els[0].x) >= 2 - 1e-6, `moved off the path: ${els[0].x}`);
  assert.equal(els[1].x, 8);
  const bench = [{ objType: 'banc', x: 0.3, z: 0 }];
  clearOfObstacles(bench, obstaclesOf(translated));
  assert.ok(Math.abs(bench[0].x) >= 1.4 - 1e-6, `a bench too: ${bench[0].x}`);
});
