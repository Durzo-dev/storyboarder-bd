/**
 * tests/road-marking.test.mjs, a road's centre line fitted to its Path (src/road-marking.js).
 */
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { dashLayout, dashSpans, LEAST_PERIOD } from '../src/road-marking.js';

// As scene3d.js asks for a 5 m road: dashes 1.2 × the width, gaps 2 ×.
const W = 5, DASH = 1.2 * W, GAP = 2 * W, PERIOD = DASH + GAP;

describe('the centre line, fitted to its Path', () => {
  test('⚠️ TWO PATHS END TO END MEET IN ONE WHOLE GAP (the line looked interrupted at every joint)', () => {
    // A street split by OpenStreetMap into 37 m and 53 m: before, each restarted its pattern at its first point and
    // cut it at its last, a stub of a dash then a gap of any length.
    for (const [a, b] of [[37, 53], [16, 70], [24.3, 24.3]]) {
      const sa = dashSpans(a, DASH, GAP), sb = dashSpans(b, DASH, GAP);
      const joint = (a - sa[sa.length - 1][1]) + sb[0][0];
      const ga = dashLayout(a, DASH, GAP).gap, gb = dashLayout(b, DASH, GAP).gap;
      assert.ok(Math.abs(joint - (ga + gb) / 2) < 1e-9, `${a} + ${b}: the gap at the joint is the mean of theirs`);
      assert.ok(joint > 0.75 * GAP && joint < 1.5 * GAP, `${a} + ${b}: ${joint.toFixed(2)} m`);
    }
  });

  test('a whole number of periods, no dash cut at either end, none out of the Path', () => {
    for (const L of [12.5, 13, 20, 37, 120.5]) {
      const l = dashLayout(L, DASH, GAP), s = dashSpans(L, DASH, GAP);
      assert.equal(s.length, l.count);
      assert.ok(Math.abs(l.count * (l.dash + l.gap) - L) < 1e-9, `${L} m: periods fill it`);
      assert.ok(Math.abs(s[0][0] - (L - s[s.length - 1][1])) < 1e-9, 'the same half gap at both ends');
      assert.ok(Math.abs(l.dash / l.gap - DASH / GAP) < 1e-9, 'the dash keeps its share of the period');
      assert.ok(l.dash >= 0.75 * DASH - 1e-9 && l.dash <= 1.5 * DASH + 1e-9, `${L} m: dash ${l.dash.toFixed(2)}`);
    }
  });

  test('⚠️ A CROSSING\'S MIDDLE STAYS CLEAR: the half gap at each end is more than half a road\'s width', () => {
    for (let L = LEAST_PERIOD * PERIOD; L < 200; L += 0.37) assert.ok(dashLayout(L, DASH, GAP).start > W / 2, `${L.toFixed(2)} m`);
  });

  test('a Path shorter than three quarters of a period has no dash (its one dash would be a stub)', () => {
    assert.equal(dashLayout(0.74 * PERIOD, DASH, GAP).count, 0);
    assert.equal(dashLayout(0.76 * PERIOD, DASH, GAP).count, 1);
    assert.deepEqual(dashSpans(0, DASH, GAP), []);
    assert.equal(dashLayout(30, 0, GAP).count, 0);
  });

  test('the geometry lays its quads on those spans only, along the line', async () => {
    const { buildTracéDashGeometry3D } = await import('../src/scene3d.js');
    const geo = buildTracéDashGeometry3D([{ x: 0, z: 0 }, { x: 37, z: 0 }], 0.45, DASH, GAP, 0);
    const p = geo.attributes.position, spans = dashSpans(37, DASH, GAP);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      assert.ok(spans.some(([a, b]) => x >= a - 1e-4 && x <= b + 1e-4), `vertex at x = ${x.toFixed(3)} out of every dash`);
    }
    const xs = Array.from({ length: p.count }, (_, i) => p.getX(i));
    assert.ok(Math.abs(Math.min(...xs) - spans[0][0]) < 1e-3 && Math.abs(Math.max(...xs) - spans[spans.length - 1][1]) < 1e-3);
  });
});
