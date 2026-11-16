/**
 * tests/landmarks.test.mjs: CROSSES, CALVARIES, WIND TURBINES, RELAY MASTS AND BELL TOWERS (#482d). From the BD TOPO
 * (src/landmarks.js: the natures measured, their surveyed heights within reason, not twice where OSM maps them,
 * within the zone) and from OSM (furnitureOf); a bell tower may stand in its church (the clearance leaves it).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLandmarks } from '../src/landmarks.js';
import { furnitureOf } from '../src/osm-scene.js';
import { clearOfObstacles } from '../src/placement-clearance.js';

const centre = { lat: 49.95, lon: 2.95 };
const k = 1 / 111320, kx = 1 / (111320 * Math.cos(centre.lat * Math.PI / 180));
const point = (nature, x, z, hauteur = null) => ({ type: 'Feature', properties: { nature, hauteur },
  geometry: { type: 'Point', coordinates: [centre.lon + x * kx, centre.lat - z * k] } });

test('the surveyed natures kept, each its object, its height when within reason', () => {
  const out = readLandmarks({ features: [
    point('Croix', 10, 0), point('Calvaire', -20, 5), point('Eolienne', 50, 50, 150), point('Antenne', 0, -40, 35),
    point('Clocher', 5, 5, 31), point('Cheminée', 1, 1, 25), point('Transformateur', 2, 2), point('Eolienne', -60, 60, 3),
  ] }, centre);
  assert.deepEqual(out.map(e => e.objType), ['croix', 'calvaire', 'eolienne', 'antenne', 'clocher', 'eolienne']);
  assert.ok(Math.abs(out[0].x - 10) < 0.05 && Math.abs(out[0].z) < 0.05);
  assert.equal(out[2].height, 150);
  assert.equal(out[3].height, 35);
  assert.equal(out[5].height, undefined, 'a 3 m wind turbine: no height');
  assert.ok(out.every(e => e.source === 'bdtopo'));
});

test('not twice where OSM maps it; not outside the zone', () => {
  const existing = [{ objType: 'eolienne', x: 70, z: 50 }, { objType: 'croix', x: 30, z: 0 }];
  const out = readLandmarks({ features: [point('Eolienne', 50, 50), point('Croix', 10, 0), point('Croix', 500, 0)] },
    centre, { halfSize: 100, existing });
  assert.deepEqual(out.map(e => e.objType), ['croix'], 'the turbine 20 m from OSM\'s is the same; the far cross out');
});

test('OSM: wayside crosses and calvaries, wind turbines, relay masts', () => {
  assert.equal(furnitureOf({ historic: 'wayside_cross' }), 'croix');
  assert.equal(furnitureOf({ man_made: 'cross' }), 'croix');
  assert.equal(furnitureOf({ historic: 'wayside_cross', name: 'Calvaire de la Croix-Rouge' }), 'calvaire');
  assert.equal(furnitureOf({ power: 'generator', 'generator:source': 'wind' }), 'eolienne');
  assert.equal(furnitureOf({ power: 'generator', 'generator:source': 'solar' }), null);
  assert.equal(furnitureOf({ man_made: 'mast', 'tower:type': 'communication' }), 'antenne');
  assert.equal(furnitureOf({ man_made: 'tower', 'tower:type': 'observation' }), null);
});

test('a bell tower stays in its church; a cross is pushed out of a house', () => {
  const church = [{ x: -10, z: -5 }, { x: 10, z: -5 }, { x: 10, z: 5 }, { x: -10, z: 5 }];
  const els = [{ objType: 'clocher', x: 7, z: 0 }, { objType: 'croix', x: 9, z: 0 }];
  const r = clearOfObstacles(els, { rings: [church], heights: [12], lines: [] });
  assert.deepEqual(els[0], { objType: 'clocher', x: 7, z: 0 });
  assert.equal(r.moved, 1);
});
