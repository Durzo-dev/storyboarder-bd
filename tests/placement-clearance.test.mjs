/**
 * tests/placement-clearance.test.mjs: AN IMPORTED OBJECT STANDS CLEAR OF BUILDINGS, ROADS AND WALLS (src/placement-
 * clearance.js; asked: trees seen inside a small house and astride low walls). Pushed out to the nearest clear
 * place, never moved when already clear, left out when it cannot be cleared within MAX_SHIFT_M; pavements are no
 * obstacle (street trees stand on them).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearOfObstacles, obstaclesOf, clearanceOf, MAX_SHIFT_M } from '../src/placement-clearance.js';

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
  assert.deepEqual(o.lines.map(l => l.half), [3.5, 0.25]);
});
