/**
 * tests/courtyards.test.mjs: A BLOCK'S COURTYARDS KEPT (#484b, the quai de la Tournelle: a Paris block mapped as an
 * OSM multipolygon, its courtyard lost, its roof spread over 48 × 55 m and rising 17 m). The relation's rings
 * joined, its inner rings made courtyards (rooms left void, the roof going round them), the BD TOPO's inner
 * rings likewise; the roof's climb measured to the middle of a wing, not of the block.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringsOf, buildingOf, translateOsm } from '../src/osm-scene.js';
import { readBdTopo, roofHalfSpan, pitchWithin, MAX_GUESSED_RISE } from '../src/building-survey.js';
import { encombrementDuBatiment } from '../src/batiment-element.js';

const sq = (x, z, w, d = w) => [{ x, z }, { x: x + w, z }, { x: x + w, z: z + d }, { x, z: z + d }];
const block = sq(-24, -27.5, 48, 55), court = sq(-10, -12.5, 20, 25);

test('a multipolygon\'s rings: ways joined end to end, either way round; an open one left out', () => {
  const a = { x: 0, z: 0 }, b = { x: 10, z: 0 }, c = { x: 10, z: 10 }, d = { x: 0, z: 10 };
  const rings = ringsOf([[a, b], [c, b], [c, d, a], [{ x: 50, z: 50 }, { x: 60, z: 50 }]]);
  assert.equal(rings.length, 1);
  assert.equal(rings[0].length, 5);
  assert.deepEqual(rings[0][0], rings[0][4]);
});

test('a courtyard: its room a void on every level, the roof round it, lower than over the whole block', () => {
  const tags = { building: 'apartments', 'building:levels': '5' };
  const whole = buildingOf(block, tags, { x: 0, z: 0 }, [], undefined, null, null, true, null, [], []);
  const courted = buildingOf(block, tags, { x: 0, z: 0 }, [], undefined, null, null, true, null, [], [court]);
  assert.equal(courted.pieces.filter(p => p.vide).length, courted.niveaux.length);
  assert.equal(whole.pieces.filter(p => p.vide).length, 0);
  assert.ok(courted.murs.length > whole.murs.length, 'the courtyard\'s walls');
  const walls = 5 * 2.8;
  const rise = (b) => encombrementDuBatiment(b).hauteur - walls;
  // Round a courtyard, wings 14 m deep: at 35°, about 5 m (and its overhang); never the block's 17 m.
  assert.ok(rise(courted) < 7.5, `${rise(courted)}`);
});

test('a courtyard touching the outline is left out (its walls would cross the outer ones)', () => {
  const b = buildingOf(block, { building: 'yes' }, { x: 0, z: 0 }, [], undefined, null, null, true, null, [], [sq(-24, -5, 10, 10)]);
  assert.ok(b);
  assert.equal(b.pieces.filter(p => p.vide).length, 0);
});

test('a roof climbs to the middle of a wing, not of the block', () => {
  assert.ok(Math.abs(roofHalfSpan(block) - 24) < 1, `${roofHalfSpan(block)}`);
  // The wings are 14 and 15 m deep; at their corners, away from the courtyard's corner, a little more.
  assert.ok(roofHalfSpan(block, [court]) >= 7 && roofHalfSpan(block, [court]) <= 9, `${roofHalfSpan(block, [court])}`);
  assert.ok(pitchWithin(35, MAX_GUESSED_RISE, block, [court]) > pitchWithin(35, MAX_GUESSED_RISE, block));
});

test('BD TOPO: a polygon\'s inner rings read as its courtyards', () => {
  const centre = { lat: 48.85, lon: 2.35 };
  const ring = (x0, y0, w, h) => [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h], [x0, y0]];
  const geojson = { features: [{ id: 'b1', properties: { hauteur: 16.6 }, geometry: { type: 'Polygon',
    coordinates: [ring(2.3497, 48.8498, 0.0006, 0.0005), ring(2.3499, 48.8499, 0.0002, 0.0002)] } }] };
  const [s] = readBdTopo(geojson, centre);
  assert.equal(s.holes.length, 1);
  assert.equal(s.holes[0].length, 4);
});

test('OSM: a building multipolygon becomes a building, its tags and its courtyard kept', () => {
  const centre = { lat: 48.85, lon: 2.35 };
  const k = 1 / 111320, kx = 1 / (111320 * Math.cos(48.85 * Math.PI / 180));
  const g = (x, z) => ({ lat: 48.85 - z * k, lon: 2.35 + x * kx });
  const way = (pts) => pts.map(([x, z]) => g(x, z));
  const data = { elements: [{ type: 'relation', id: 568709, tags: { type: 'multipolygon', building: 'apartments', 'building:levels': '5', name: 'Hôtel Montmien' },
    members: [
      { type: 'way', role: 'outer', geometry: way([[-24, -27.5], [24, -27.5], [24, 27.5]]) },
      { type: 'way', role: 'outer', geometry: way([[24, 27.5], [-24, 27.5], [-24, -27.5]]) },
      { type: 'way', role: 'inner', geometry: way([[-10, -12.5], [10, -12.5], [10, 12.5], [-10, 12.5], [-10, -12.5]]) },
    ] }] };
  const out = translateOsm(data, { centre, halfSize: 60 });
  assert.equal(out.buildings.length, 1);
  assert.equal(out.skipped.relations, 0);
  const b = out.buildings[0].building;
  assert.equal(b.niveaux.length, 5);
  assert.equal(b.nom, 'Hôtel Montmien');
  assert.ok(b.pieces.some(p => p.vide), 'its courtyard');
});

test('OSM: a ground multipolygon (Eguisheim\'s vineyards) becomes a Zone, its inner rings left out', () => {
  const centre = { lat: 48.04, lon: 7.3 };
  const k = 1 / 111320, kx = 1 / (111320 * Math.cos(48.04 * Math.PI / 180));
  const way = (pts) => pts.map(([x, z]) => ({ lat: 48.04 - z * k, lon: 7.3 + x * kx }));
  const data = { elements: [{ type: 'relation', id: 1020508, tags: { type: 'multipolygon', landuse: 'vineyard' }, members: [
    { type: 'way', role: 'outer', geometry: way([[-40, -40], [40, -40], [40, 40], [-40, 40], [-40, -40]]) },
    { type: 'way', role: 'inner', geometry: way([[-10, -10], [10, -10], [10, 10], [-10, 10], [-10, -10]]) },
  ] }] };
  const out = translateOsm(data, { centre, halfSize: 60 });
  assert.equal(out.zones.length, 1);
  assert.equal(out.zones[0].terrainType, 'terre');
  const m = out.zones[0].world.masque;
  const at = (x, z) => m.plein[Math.floor((z - m.z0) / m.pas) * m.nx + Math.floor((x - m.x0) / m.pas)];
  assert.equal(at(30, 30), '1');
  assert.equal(at(0, 0), '0', 'the hole');
});
