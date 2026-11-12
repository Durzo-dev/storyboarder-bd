/**
 * tests/facade-colour.test.mjs: a facade's colour taken from a street photo (src/facade-colour.js): the choice
 * of the photo by geometry, the projection of the wall into it, the colour of what is left of the wall.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { facadesOf, bestView, samplePoints, wallColour } from '../src/facade-colour.js';

// A 10 × 6 m building, its walls drawn round its outline (local metres, z to the south), two levels of 3 m.
const square = (w, d) => [{ x: -w / 2, z: -d / 2 }, { x: w / 2, z: -d / 2 }, { x: w / 2, z: d / 2 }, { x: -w / 2, z: d / 2 }];
function entry(x, z, w = 10, d = 6){
  const pts = square(w, d);
  return { x, z, building: {
    niveaux: [{ id: 'n0', elevation: 0, hauteur: 3 }, { id: 'n1', elevation: 3, hauteur: 3 }],
    murs: pts.map((a, i) => ({ id: `m${i}`, niveauId: 'n0', a, b: pts[(i + 1) % 4] })),
  } };
}

describe('the building\'s facades', () => {
  test('its ground-floor walls of 3 m or more, each facing out, and its eaves', () => {
    const f = facadesOf(entry(0, 0));
    assert.equal(f.facades.length, 4);
    assert.equal(f.eaves, 6);
    const south = f.facades.find(x => x.mid.z > 2);
    assert.ok(south.normal.z > 0.99, 'the south wall looks south');
  });
});

describe('the photo that sees it', () => {
  const b = facadesOf(entry(0, 0));
  test('a camera 12 m south looking north sees the south wall; looking east it does not', () => {
    const v = bestView(b, [{ id: 'n', x: 0, z: 15, yaw: 0, fov: 76 }]);
    assert.ok(v && v.facade.mid.z > 2);
    assert.equal(bestView(b, [{ id: 'e', x: 0, z: 15, yaw: 90, fov: 76 }]), null);
    assert.ok(bestView(b, [{ id: 'p', x: 0, z: 15, yaw: 90, fov: 360 }]), 'a 360° sees it whatever its bearing');
  });
  test('too close, too far, behind the wall, too oblique: no', () => {
    assert.equal(bestView(b, [{ id: 'a', x: 0, z: 5, yaw: 0, fov: 360 }]), null, '2 m away');
    assert.equal(bestView(b, [{ id: 'b', x: 0, z: 60, yaw: 0, fov: 360 }]), null, '57 m away');
    assert.equal(bestView({ facades: b.facades.filter(f => f.mid.z > 2) }, [{ id: 'c', x: 30, z: 4, yaw: 0, fov: 360 }]), null, '82° to the side');
  });
  test('another building in between hides it', () => {
    const other = facadesOf(entry(0, 9, 14, 2)).outline;
    assert.equal(bestView({ facades: b.facades.filter(f => f.mid.z > 2) }, [{ id: 'n', x: 0, z: 15, yaw: 0, fov: 360 }], [other]), null);
  });
});

describe('the wall in the photo', () => {
  test('a flat photo facing the wall: the points in the upper middle (the first floor), inside the picture', () => {
    const b = facadesOf(entry(0, 0));
    const v = bestView(b, [{ id: 'n', x: 0, z: 13, yaw: 0, fov: 76 }]);
    const pts = samplePoints(v, b.eaves, { width: 2048, height: 1536 });
    assert.equal(pts.length, 35);
    assert.ok(pts.every(p => p.u > 0.2 && p.u < 0.8), 'the wall\'s middle part, centred');
    assert.ok(pts.every(p => p.v < 0.5), 'above the camera (2.5 m): the first floor');
  });
  test('a 360° photo: the wall around its bearing', () => {
    const b = facadesOf(entry(0, 0));
    const v = bestView(b, [{ id: 'p', x: 0, z: 13, yaw: 180, fov: 360 }]);
    const pts = samplePoints(v, b.eaves, { width: 4096, height: 2048 });
    // The wall is due north, the photo's centre due south: the wall sits at the picture's edges (u near 0 or 1).
    assert.ok(pts.every(p => p.u < 0.1 || p.u > 0.9));
  });
});

describe('the colour of what is left', () => {
  test('the wall\'s colour, windows, sky and greenery set aside', () => {
    const wall = [214, 196, 160], pixels = [];
    for (let i = 0; i < 20; i++) pixels.push([wall[0] + (i % 3) - 1, wall[1] + (i % 5) - 2, wall[2] + (i % 2)]);
    for (let i = 0; i < 6; i++) pixels.push([25, 28, 30]);        // windows
    for (let i = 0; i < 4; i++) pixels.push([130, 170, 225]);     // sky
    for (let i = 0; i < 4; i++) pixels.push([70, 110, 60]);       // a tree
    const c = wallColour(pixels);
    assert.equal(c.colour, '#d6c4a1', 'the median of each channel of the wall');
    assert.ok(c.kept > 0.55 && c.kept < 0.6);
  });
  test('too little wall: no colour', () => {
    assert.equal(wallColour([[20, 20, 20], [30, 30, 30], [200, 190, 170]]), null);
  });
});

describe('what is not a wall\'s colour', () => {
  const flat = (c, n = 20) => Array.from({ length: n }, () => c.slice());
  test('a vivid colour (a sign, an awning) or a dark one (deep shade) is not taken', () => {
    assert.equal(wallColour(flat([134, 39, 180])), null, 'purple');
    assert.equal(wallColour(flat([63, 60, 55])), null, 'near black');
    assert.ok(wallColour(flat([214, 196, 160])), 'a light stone is');
  });
});
