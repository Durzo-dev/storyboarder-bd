/**
 * tests/real-place-import.test.mjs: a real place turned into the content of a Scene (src/real-place-import.js)
 * and the relief from real altitudes (src/terrain-relief.js, reliefDepuisAltitudes). Extract: Eguisheim
 * (tests/fixtures/osm-eguisheim.json, © OpenStreetMap contributors, ODbL); altitudes: a real IGN answer.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { translateOsm } from '../src/osm-scene.js';
import { sceneContentOf, pathObject } from '../src/real-place-import.js';
import { planRelief } from '../src/real-place-sources.js';
import * as R from '../src/terrain-relief.js';

const village = JSON.parse(readFileSync(new URL('./fixtures/osm-eguisheim.json', import.meta.url), 'utf8'));
const centre = { lat: (village.bbox.sud + village.bbox.nord) / 2, lon: (village.bbox.ouest + village.bbox.est) / 2 };
let n = 0;
const newId = () => `id${++n}`;
const nameOf = (k) => ({ route: 'Route', chemin: 'Chemin de terre', muret: 'Muret', terrain: 'Terrain' })[k] || k;
const translated = translateOsm(village, { centre, halfSize: 60, country: 'fr' });
// A 10 m zone of real IGN altitudes (Eguisheim, 11 Nov. 2026), assembled to a 1 m grid.
const IGN_9 = { elevations: [208.61, 209.52, 209.56, 208.46, 209.27, 209.22, 208.11, 208.78, 209.01] };
const altitudes = planRelief({ centre, halfSize: 5, country: 'fr' }).assemble([IGN_9]);

describe('real place, the content of a Scene', () => {
  const c = sceneContentOf(translated, { panelId: 'P', newId, nameOf, altitudes, reliefCredit: '© IGN, RGE ALTI®' });
  test('Zones first, then Paths, all on the Scene\'s canvas, with fresh ids', () => {
    assert.equal(c.traces.length, c.counts.zones + c.counts.paths);
    assert.ok(c.traces.slice(0, c.counts.zones).every(o => o.tracéType === 'terrain'));
    assert.ok(c.traces.every(o => o.type === 'tracé' && o.panelId === 'P' && /^id\d+$/.test(o.id)));
    assert.equal(new Set(c.traces.map(o => o.id)).size, c.traces.length);
  });
  test('a road keeps its 3D width and its plan stroke follows; a pedestrian street has no marking', () => {
    const grandRue = c.traces.find(o => o.name === 'Grand\'Rue');
    assert.equal(grandRue.world.width, 5);
    assert.equal(grandRue.width, 10, 'the default 10 px stroke for 5 m');
    const square = c.traces.find(o => o.tracéType === 'terrain' && o.name === 'Place du Marché aux Saules');
    assert.equal(square.terrainType, 'bitume');
    assert.ok(square.world.masque);
  });
  test('a wall gets its default height, a river its depth, an unnamed Path the application\'s name', () => {
    const wall = c.traces.find(o => o.tracéType === 'muret');
    assert.equal(wall.wallHeight, 1);
    assert.equal(wall.name, 'Muret');
    const river = pathObject({ kind: 'riviere', world: { pts: [{ x: 0, z: 0 }, { x: 5, z: 0 }], width: 8 } }, { panelId: 'P', newId, nameOf });
    assert.equal(river.profondeur, R.PROFONDEUR_RIVIERE);
    const street = pathObject({ kind: 'route', marking: false, world: { pts: [{ x: 0, z: 0 }, { x: 5, z: 0 }], width: 5 } }, { panelId: 'P', newId, nameOf });
    assert.equal(street.marquage, false);
  });
  test('the buildings and Elements are handed over as translated; the credits name OSM and the relief\'s source', () => {
    assert.equal(c.buildings.length, translated.buildings.length);
    assert.deepEqual(c.credits, ['© OpenStreetMap contributors, ODbL', '© IGN, RGE ALTI®']);
  });
  test('the relief: heights relative to the middle altitude, back to 0 on the edges', () => {
    assert.equal(c.relief.altitude, 209);
    assert.equal(c.relief.nx, 11);
    assert.equal(c.bornee, false);
    for (let i = 0; i < 11; i++) assert.equal(c.relief.h[i], 0, 'the north edge');
    assert.ok(R.reliefValide(c.relief));
  });
  test('without altitudes: a flat Ground, and OSM alone in the credits', () => {
    const flat = sceneContentOf(translated, { panelId: 'P', newId, nameOf });
    assert.equal(flat.relief, null);
    assert.deepEqual(flat.credits, ['© OpenStreetMap contributors, ODbL']);
  });
});

describe('the relief from real altitudes', () => {
  test('heights relative to the middle of the range, rounded to the metre (no edge blending)', () => {
    const r = R.reliefDepuisAltitudes({ x0: -1, z0: -1, pas: 1, nx: 3, nz: 2, altitudes: [312, 382, 452, 315.25, 385, 450] }, 0);
    assert.equal(r.bornee, false);
    assert.equal(r.relief.altitude, 382);
    assert.deepEqual(r.relief.h, [-70, 0, 70, -66.75, 3, 68]);
  });
  test('the edges meet the flat Ground: 0 on the border, full height beyond the blending', () => {
    const alt = new Array(61 * 61).fill(250); alt[30 * 61 + 30] = 230;   // a 20 m high plateau, one dip in the middle
    const r = R.reliefDepuisAltitudes({ x0: -30, z0: -30, nx: 61, nz: 61, altitudes: alt }, 20);
    assert.equal(r.relief.altitude, 240);
    assert.equal(r.relief.h[0], 0);
    assert.equal(r.relief.h[30 * 61 + 0], 0, 'west edge');
    assert.equal(r.relief.h[30 * 61 + 30], -10, 'the middle keeps its height');
    assert.ok(r.relief.h[30 * 61 + 10] > 0 && r.relief.h[30 * 61 + 10] < 10, 'half-way through the blending');
  });
  test('beyond 600 m of rise: clamped and said; an unreadable altitude takes the base; a bad grid is refused', () => {
    const r = R.reliefDepuisAltitudes({ x0: 0, z0: 0, nx: 2, nz: 2, altitudes: [0, 1000, 500, null] }, 0);
    assert.equal(r.bornee, true);
    assert.equal(Math.max(...r.relief.h), R.HAUTEUR_MAX);
    assert.equal(r.relief.h[3], 0);
    assert.equal(R.reliefDepuisAltitudes({ x0: 0, z0: 0, nx: 2, nz: 2, altitudes: [1, 2, 3] }), null);
    assert.equal(R.reliefDepuisAltitudes({ x0: 0, z0: 0, nx: 2, nz: 2, altitudes: [null, null, null, null] }), null);
  });
});
