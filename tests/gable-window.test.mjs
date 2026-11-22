/**
 * tests/gable-window.test.mjs: a window in a gable tall enough for a room under the roof (src/batiment-3d.js,
 * fenetreDuPignon). Signalled: a big blind gable under a steep roof looked odd.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fenetreDuPignon, GABLE_WINDOW } from '../src/batiment-3d.js';

/** A gable: base from (0, y0, 0) to (L, y0, 0), its peak at u along it, `rise` metres above. */
const gable = (L, rise, u = L / 2, y0 = 3) => [{ x: 0, y: y0, z: 0 }, { x: L, y: y0, z: 0 }, { x: u, y: y0 + rise, z: 0 }];

test('a tall gable: a window under its peak, on its face, with room under the roof', () => {
  const f = fenetreDuPignon(gable(8, 4));
  assert.ok(f);
  assert.equal(f.x, 4);
  assert.equal(f.z, 0);
  assert.ok(f.y >= 3 && f.y <= 3.6, `its sill: ${f.y}`);
  assert.ok(f.y + f.h <= 3 + 4 * (1 - (f.w / 2) / 4) - GABLE_WINDOW.margin + 1e-9, 'under the slopes at its sides');
  assert.equal(f.w, GABLE_WINDOW.width);
});
test('NOT in a low gable nor a narrow one', () => {
  assert.equal(fenetreDuPignon(gable(8, 1.5)), null, 'a gentle roof');
  assert.equal(fenetreDuPignon(gable(2, 4)), null, 'too narrow');
  assert.equal(fenetreDuPignon(null), null);
});
test('under a single slope (a lean-to\'s end), toward its high side, kept off its edge', () => {
  const f = fenetreDuPignon([{ x: 0, y: 3, z: 0 }, { x: 0, y: 3, z: 6 }, { x: 0, y: 6, z: 6 }, { x: 0, y: 3.5, z: 0 }]);
  assert.ok(f && f.z > 4 && f.z <= 6 - GABLE_WINDOW.width / 2 - GABLE_WINDOW.margin + 1e-9, `toward the high side: ${f && f.z}`);
  assert.equal(f.x, 0);
});
