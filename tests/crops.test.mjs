/**
 * Field crops in relief (#481c, src/crops-3d.js): the RPG's groups to their crop, the field a Zone with its crop and
 * rows, its cards in rows on its cells and off the Traces, under the budget; the card two crossed planes; wired.
 */
import './helpers/dom-stub.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cropOfGroup, cropCards, cropCardGeometry, CROP_KINDS } from '../src/crops-3d.js';
import { readPlots, addPlotGrounds, readBdTopoVines } from '../src/farm-plots.js';
import { onTraces } from '../src/vineyard.js';
import { zoneObject } from '../src/real-place-import.js';

const centre = { lat: 48.25, lon: 1.65 };
const k = 1 / 111320, kx = 1 / (111320 * Math.cos(centre.lat * Math.PI / 180));
const square = (x0, z0, w, d) => [[x0, z0], [x0 + w, z0], [x0 + w, z0 + d], [x0, z0 + d], [x0, z0]].map(([x, z]) => [centre.lon + x * kx, centre.lat - z * k]);
const field = (group, crop, w = 60, d = 30) => {
  const t = { zones: [] };
  addPlotGrounds(t, readPlots({ features: [{ properties: { code_group: group, code_cultu: crop }, geometry: { type: 'MultiPolygon', coordinates: [[square(0, 0, w, d)]] } }] }, centre), 200);
  return t.zones[0];
};

test('the RPG\'s groups: wheat for the cereals, maize, rape, sunflowers; nothing else stands', () => {
  assert.equal(cropOfGroup('1'), 'wheat'); assert.equal(cropOfGroup('3'), 'wheat'); assert.equal(cropOfGroup('4'), 'wheat');
  assert.equal(cropOfGroup('2'), 'maize'); assert.equal(cropOfGroup('5'), 'rape'); assert.equal(cropOfGroup('6'), 'sunflower');
  for (const g of ['11', '16', '18', '21', '25', undefined]) assert.equal(cropOfGroup(g), null, String(g));
});

test('a wheat field: a Zone with its crop along its longest side, carried to the Scene; a meadow has none', () => {
  const z = field('1', 'BTH');
  assert.equal(z.crop.kind, 'wheat'); assert.ok(Math.abs(z.crop.angle) < 0.01);
  assert.deepEqual(zoneObject(z, { panelId: 'p', newId: () => 'z' }).crop, z.crop);
  assert.equal(field('18', 'PPH').crop, undefined);
  assert.equal(field('2', 'MIS').crop.kind, 'maize');
});

test('its cards in rows on its cells, off the Traces, under the budget', () => {
  const z = field('2', 'MIS');
  const cards = cropCards(z);
  const { gap, step } = CROP_KINDS.maize;
  assert.ok(cards.length > 0.8 * (60 / step) * (30 / gap), `${cards.length}`);
  assert.ok(cards.every(c => c.x >= 0 && c.x <= 60 && c.z >= 0 && c.z <= 30));
  const avoid = onTraces([{ tracéType: 'chemin', world: { pts: [{ x: 30, z: -5 }, { x: 30, z: 40 }], width: 3 } }], 0.3);
  assert.ok(cropCards(z, { avoid }).every(c => Math.abs(c.x - 30) >= 1.8));
  const big = field('1', 'BTH', 400, 400);
  assert.ok(cropCards(big).length <= CROP_KINDS.wheat.max);
  assert.deepEqual(cropCards(null), []);
});

test('a BD TOPO plot never says its crop', () => {
  const t = { zones: [] };
  addPlotGrounds(t, readBdTopoVines({ features: [{ properties: { nature: 'Vigne' }, geometry: { type: 'MultiPolygon', coordinates: [[square(0, 0, 30, 20)]] } }] }, centre), 200);
  assert.equal(t.zones[0].crop, undefined);
});

test('a card: crossed planes, its foot on the ground; a stand three, with a level card at its ears (no bare squares)', () => {
  const g = cropCardGeometry(1.5, 2.4);
  assert.equal(g.index.length, 12);
  assert.equal(cropCardGeometry(1.2, 0.95, 3).index.length, 18);
  assert.ok(CROP_KINDS.wheat.planes === 3 && CROP_KINDS.wheat.scatter && CROP_KINDS.wheat.canopy > 0.5);
  assert.ok(CROP_KINDS.rape.planes === 3 && CROP_KINDS.rape.canopy > 0.5);
  const ys = g.position.filter((_, i) => i % 3 === 1);
  assert.equal(Math.min(...ys), 0); assert.equal(Math.max(...ys), 2.4);
});

test('drawn at render time on the Ground, off the Traces, its meshes shared', () => {
  const sc = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(sc, /const crop = crops3D\(o, \(x, z\) => GROUND_Y_DEFAULT_3D \+ hauteurDuRelief\(_relief, x, z\) \+ 0\.01, \{ avoid: _plantsAvoid3D\(panelTracés3D, panel, page, 0\.3\) \}\);/);
  assert.match(readFileSync(new URL('../src/crops-3d.js', import.meta.url), 'utf8'), /mesh\.userData\.shared = true;/);
});

test('plants keep out of the buildings (asked: a crop through a house, seen)', () => {
  const sc = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(sc, /function _plantsAvoid3D\(traces, panel, page, margin\)\{\s*const onT = onTraces\(traces, margin\);\s*const fps = _footprints3D\(panel, page\);/);
  // A building moved, or a path drawn, redraws the field.
  assert.match(sc, /\+ '#' \+ panelOwnedElements3D\(panel, page\)\.filter\(estUnBatimentPlace\)/);
});
