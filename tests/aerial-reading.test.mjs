/**
 * tests/aerial-reading.test.mjs: the aerial photo read at the import (src/aerial-reading.js). The pixel classes
 * on colours measured on the IGN's photo of the Écusson (Montpellier); the readings on synthetic grids, each
 * threshold with a case on either side; the whole reading on Eguisheim's real translation
 * (tests/fixtures/osm-eguisheim.json, © OpenStreetMap contributors, ODbL) with a painted photo.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classOfPixel, classGrid, CLASSES as C, groundOfZone, roofOfBuilding, missingTrees, lawnMask, readAerialPhoto,
  CROWN_AREA, SMALLEST_CANOPY } from '../src/aerial-reading.js';
import { translateOsm } from '../src/osm-scene.js';

/** A grid of n × n metres, every cell `fill`, then `paint(i, j)` → a class or undefined. */
function grid(n, fill, paint = () => undefined){
  const cells = new Uint8Array(n * n).fill(fill);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const c = paint(i, j); if (c !== undefined) cells[j * n + i] = c; }
  return { n, cells, halfSize: n / 2 };
}
/** A rectangle's outline in the zone frame. */
const rect = (x0, z0, x1, z1) => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
/** A 1 m mask over a rectangle (cells), as translateOsm gives. */
const mask = (x0, z0, nx, nz) => ({ pas: 1, x0, z0, nx, nz, plein: '1'.repeat(nx * nz) });

describe('aerial reading, the class of a pixel (colours measured on the Écusson)', () => {
  test('each class on its measured colour', () => {
    assert.equal(classOfPixel(80, 104, 90), C.TREE, 'a canopy (the Esplanade\'s plane trees)');
    assert.equal(classOfPixel(71, 92, 88), C.TREE);
    assert.equal(classOfPixel(140, 170, 110), C.LAWN, 'a sunny lawn');
    assert.equal(classOfPixel(229, 190, 160), C.TILES, 'sunny tiles');
    assert.equal(classOfPixel(239, 231, 220), C.LIGHT, 'the Comédie\'s paving');
    assert.equal(classOfPixel(221, 223, 222), C.LIGHT, 'a light terrace');
    assert.equal(classOfPixel(130, 141, 154), C.ASPHALT, 'a shaded street');
    assert.equal(classOfPixel(52, 70, 98), C.SHADOW, 'a shadow: dark and bluish');
    assert.equal(classOfPixel(30, 45, 35), C.SHADOW, 'too dark to tell, even green');
    assert.equal(classOfPixel(145, 143, 146), C.GREY, 'slate');
  });
  test('the grid: the most frequent class of each metre\'s pixels', () => {
    // 4 × 4 px for 2 × 2 m: the top-left metre mostly green, the rest light.
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let p = 0; p < 16; p++) data.set([239, 231, 220, 255], p * 4);
    for (const p of [0, 1, 4]) data.set([80, 104, 90, 255], p * 4);
    const g = classGrid({ width: 4, height: 4, data }, 1);
    assert.equal(g.n, 2);
    assert.deepEqual([...g.cells], [C.TREE, C.LIGHT, C.LIGHT, C.LIGHT]);
  });
});

describe('aerial reading, a Zone\'s real ground', () => {
  const zone = (terrainType) => ({ terrainType, world: { masque: mask(-5, -5, 10, 10) } });
  test('a park that is paving becomes paving; a car park that is grass becomes grass', () => {
    assert.equal(groundOfZone(grid(20, C.LIGHT), zone('gazon')), 'béton');
    assert.equal(groundOfZone(grid(20, C.LAWN), zone('bitume')), 'gazon');
    assert.equal(groundOfZone(grid(20, C.TREE), zone('herbe')), null, 'a grass stays its own grass');
  });
  test('never asphalt (seen: a shaded paving read bluish, turned black)', () => {
    assert.equal(groundOfZone(grid(20, C.ASPHALT), zone('béton')), null);
    assert.equal(groundOfZone(grid(20, C.ASPHALT), zone('gazon')), null);
  });
  test('too little seen (shadows, roofs): kept; water never read', () => {
    // The Zone covers columns 5 to 14.
    assert.equal(groundOfZone(grid(20, C.SHADOW, (i) => (i < 8 ? C.LIGHT : undefined)), zone('gazon')), null, '30 % seen: kept');
    assert.equal(groundOfZone(grid(20, C.SHADOW, (i) => (i < 12 ? C.LIGHT : undefined)), zone('gazon')), 'béton', '70 % seen');
    assert.equal(groundOfZone(grid(20, C.LIGHT), zone('eau')), null);
    assert.equal(groundOfZone(grid(20, C.LIGHT), { terrainType: 'gazon', world: { masque: mask(-1, -1, 3, 3) } }), null, 'too small');
  });
});

describe('aerial reading, a roof\'s material', () => {
  const house = rect(-4, -4, 4, 4);
  test('tiles, grey (zinc, terrace), or nothing said', () => {
    assert.equal(roofOfBuilding(grid(20, C.TILES), house), 'tiles');
    assert.equal(roofOfBuilding(grid(20, C.GREY), house), 'grey');
    assert.equal(roofOfBuilding(grid(20, C.LIGHT), house), 'grey');
    assert.equal(roofOfBuilding(grid(20, C.TILES, (i) => (i < 10 ? C.GREY : undefined)), house), null, 'half and half');
    assert.equal(roofOfBuilding(grid(20, C.SHADOW), house), null, 'in the shade');
  });
  test('its edge is set aside (the street\'s metres)', () => {
    // A 3 m wide building: only its middle row counts; the street around it is grey.
    const g = grid(20, C.GREY, (i, j) => (i >= 9 && i <= 11 && j >= 2 && j <= 17 ? C.TILES : undefined));
    assert.equal(roofOfBuilding(g, rect(-1, -8, 2, 8)), 'tiles');
  });
});

describe('aerial reading, the trees OpenStreetMap lacks', () => {
  const canopy = (i0, j0, side) => (i, j) => (i >= i0 && i < i0 + side && j >= j0 && j < j0 + side ? C.TREE : undefined);
  test('one tree per crown, spread over the canopy', () => {
    const g = grid(40, C.LIGHT, canopy(5, 5, 12));   // 144 m²: 4 crowns
    const t = missingTrees(g);
    assert.equal(t.length, Math.round(144 / CROWN_AREA));
    for (const p of t) assert.ok(p.x > -15 && p.x < -3 && p.z > -15 && p.z < -3, 'on the canopy');
    for (let a = 0; a < t.length; a++) for (let b = a + 1; b < t.length; b++) assert.ok(Math.hypot(t[a].x - t[b].x, t[a].z - t[b].z) > 4, 'apart');
  });
  test('a small canopy, a building\'s cells, a mapped tree: no tree added', () => {
    assert.equal(missingTrees(grid(40, C.LIGHT, canopy(5, 5, 2))).length, 0, `under ${SMALLEST_CANOPY} m²`);
    const g = grid(40, C.LIGHT, canopy(5, 5, 4));
    assert.equal(missingTrees(g).length, 1);
    const taken = new Set(); for (let c = 0; c < 40 * 40; c++) taken.add(c);
    assert.equal(missingTrees(g, { taken }).length, 0, 'inside a building (a roof garden)');
    assert.equal(missingTrees(g, { trees: [{ x: -13, z: -13 }] }).length, 0, 'OSM has it');
  });
});

describe('aerial reading, the lawns no Zone covers', () => {
  test('one painted mask over the lawns of 25 m² or more, outside what is taken', () => {
    const g = grid(20, C.LIGHT, (i, j) => ((i < 5 && j < 5) || (i >= 15 && j >= 15 && i < 19 && j < 19) ? C.LAWN : undefined));
    const m = lawnMask(g);
    assert.deepEqual([m.x0, m.z0, m.nx, m.nz, m.pas], [-10, -10, 5, 5, 1]);
    assert.equal(m.plein, '1'.repeat(25), 'the 16 m² one left out');
    const taken = new Set(); for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) taken.add(j * 20 + i);
    assert.equal(lawnMask(g, { taken }), null);
  });
});

describe('aerial reading, the whole reading on a real translation (Eguisheim)', () => {
  const village = JSON.parse(readFileSync(new URL('./fixtures/osm-eguisheim.json', import.meta.url), 'utf8'));
  const centre = { lat: (village.bbox.sud + village.bbox.nord) / 2, lon: (village.bbox.ouest + village.bbox.est) / 2 };
  test('roofs read where no source gives them; a park in the north-east; the square stays', () => {
    const t = translateOsm(village, { centre, halfSize: 100, detail: 'realistic' });
    const known = t.buildings.filter(e => e.roofKnown).length;
    // The photo: tiles everywhere, a 12 × 12 m canopy in a corner, the square's paving light.
    const g = grid(200, C.TILES, (i, j) => (i >= 180 && i < 192 && j >= 5 && j < 17 ? C.TREE : undefined));
    const before = t.elements.length;
    const s = readAerialPhoto(g, t, { south: false });
    assert.equal(s.trees, 4); assert.equal(t.elements.length, before + 4);
    assert.ok(t.elements.slice(-4).every(e => e.objType === 'arbre' && e.aerial));
    const pitched = t.buildings.filter(e => !e.roofKnown && e.building.niveaux.reduce((p, q) => (q.elevation > p.elevation ? q : p)).toit.type !== 'plat');
    assert.equal(s.roofs, pitched.length, `${pitched.length} roofs read (${known} given by a source)`);
    for (const e of pitched) assert.equal(e.building.niveaux.reduce((p, q) => (q.elevation > p.elevation ? q : p)).toit.revetement.texture, 'int:toit:tuiles-plates');
    assert.equal(s.grounds, 0, 'tiles say nothing of a ground');
  });
});
