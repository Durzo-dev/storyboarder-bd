/**
 * tests/vegetation-zones.test.mjs: THE WOODS, ORCHARDS, HEATHS AND HEDGES FILLED (src/vegetation-zones.js, #482a/b).
 * The IGN's words read (the essences and natures measured on 15 Nov. 2026), the areas filled on a grid, the same
 * at each import, away from the trees already there, within the zone, within the budget; the BD Forêt before the
 * BD TOPO; vines left to #481; the filled trees never given a model.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kindOfEssence, kindOfNature, readVegetation, fillVegetation, MAX_TREES, AREA_KINDS } from '../src/vegetation-zones.js';
import { applyBank } from '../src/model-bank.js';

test('the BD Forêt\'s essences (as measured): their kind and genera', () => {
  assert.deepEqual(kindOfEssence('Chênes décidus', 'Forêt fermée de chênes décidus purs'), { kind: 'broadleaved', genera: ['Quercus'] });
  assert.deepEqual(kindOfEssence('Pin sylvestre', 'Forêt fermée de pin sylvestre pur'), { kind: 'conifers', genera: ['Pinus'] });
  assert.deepEqual(kindOfEssence('Pin maritime'), { kind: 'conifers', genera: ['Pinus'] });
  assert.deepEqual(kindOfEssence('Sapin, épicéa'), { kind: 'conifers', genera: ['Abies', 'Picea'] });
  assert.deepEqual(kindOfEssence('Feuillus', 'Forêt fermée à mélange de feuillus'), { kind: 'broadleaved', genera: [] });
  assert.deepEqual(kindOfEssence('NC', 'Lande'), { kind: 'heath', genera: [] });
  assert.equal(kindOfEssence('NR', 'Forêt fermée sans couvert arboré'), null);
});

test('the BD TOPO\'s natures (as measured): their kind; vines left out', () => {
  assert.equal(kindOfNature('Forêt fermée de feuillus').kind, 'broadleaved');
  assert.equal(kindOfNature('Forêt fermée de conifères').kind, 'conifers');
  assert.equal(kindOfNature('Forêt fermée mixte').kind, 'mixed');
  assert.equal(kindOfNature('Bois').kind, 'wood');
  assert.equal(kindOfNature('Haie').kind, 'hedge');
  assert.equal(kindOfNature('Lande ligneuse').kind, 'heath');
  assert.deepEqual(kindOfNature('Verger'), { kind: 'orchard', genera: ['Malus', 'Prunus', 'Pyrus'] });
  assert.equal(kindOfNature('Vigne'), null);
});

const centre = { lat: 48.4047, lon: 2.688 };
const k = 1 / 111320, kx = 1 / (111320 * Math.cos(centre.lat * Math.PI / 180));
const ring = (x0, z0, w, d) => [[x0, z0], [x0 + w, z0], [x0 + w, z0 + d], [x0, z0 + d], [x0, z0]]
  .map(([x, z]) => [centre.lon + x * kx, centre.lat - z * k]);
const feature = (props, coords) => ({ properties: props, geometry: { type: 'MultiPolygon', coordinates: [[coords]] } });

test('read: the WFS answers in local metres, BD Forêt then BD TOPO', () => {
  const areas = readVegetation({
    forests: { features: [feature({ essence: 'Pin sylvestre', tfv: '' }, ring(-50, -50, 40, 40))] },
    zones: { features: [feature({ nature: 'Verger' }, ring(10, 10, 30, 20)), feature({ nature: 'Vigne' }, ring(0, 0, 5, 5))] },
  }, centre);
  assert.deepEqual(areas.map(a => [a.source, a.kind]), [['bdforet', 'conifers'], ['bdtopo', 'orchard']]);
  assert.ok(Math.abs(areas[0].ring[0].x + 50) < 0.1 && Math.abs(areas[0].ring[0].z + 50) < 0.1);
});

const area = (kind, x0, z0, w, d, extra = {}) => ({ kind, genera: [], source: 'bdtopo', holes: [], ...extra,
  ring: [{ x: x0, z: z0 }, { x: x0 + w, z: z0 }, { x: x0 + w, z: z0 + d }, { x: x0, z: z0 + d }] });

test('an orchard in rows of its spacing, its fruit trees low; the same at each import', () => {
  const a = [area('orchard', 0, 0, 30, 24, { genera: ['Malus', 'Prunus', 'Pyrus'] })];
  const one = fillVegetation(a, { halfSize: 100 }), two = fillVegetation(a, { halfSize: 100 });
  assert.deepEqual(one, two);
  assert.equal(one.length, 5 * 4);
  assert.ok(one.every(e => e.objType === 'arbre' && e.kindKnown && e.filled && e.height <= 4.6 && ['Malus', 'Prunus', 'Pyrus'].includes(e.genus)));
  assert.ok(one.every(e => ((e.x / AREA_KINDS.orchard.spacing) % 1 + 1) % 1 === 0.5), 'in rows');
});

test('a forest: inside its outline and the zone, away from the trees there, under the budget', () => {
  const forest = [area('conifers', -300, -300, 600, 600, { source: 'bdforet', genera: ['Pinus'] })];
  const existing = [{ objType: 'arbre', x: 0, z: 0 }];
  const out = fillVegetation(forest, { halfSize: 60, existing });
  assert.ok(out.length > 100 && out.length <= MAX_TREES, `${out.length}`);
  assert.ok(out.every(e => Math.abs(e.x) <= 60 && Math.abs(e.z) <= 60 && e.objType === 'conifere' && e.genus === 'Pinus'));
  assert.ok(out.every(e => Math.hypot(e.x, e.z) >= 3), 'not on the tree there');
  const huge = fillVegetation(forest, { halfSize: 200 });
  assert.ok(huge.length <= MAX_TREES && huge.length > MAX_TREES * 0.6, `thousands of places: the budget, the grid made wider (${huge.length})`);
  const xs = huge.map(e => e.x);
  assert.ok(Math.min(...xs) < -150 && Math.max(...xs) > 150, 'spread over the zone');
});

test('a BD TOPO forest inside a BD Forêt one is the same forest: filled once', () => {
  const foret = area('conifers', -50, -50, 100, 100, { source: 'bdforet', genera: ['Pinus'] });
  const topo = area('broadleaved', -40, -40, 80, 80);
  const both = fillVegetation([foret, topo], { halfSize: 100 });
  const alone = fillVegetation([foret], { halfSize: 100 });
  assert.equal(both.length, alone.length);
});

test('heaths and hedges: shrubs; a hedge dense', () => {
  const out = fillVegetation([area('hedge', 0, 0, 20, 2.5), area('heath', 40, 40, 30, 30)], { halfSize: 100 });
  assert.ok(out.length && out.every(e => e.objType === 'buisson'));
  assert.ok(out.filter(e => e.x < 25).length >= 7, 'a hedge every 2.5 m');
});

test('the filled trees: one of our EZ-Tree species when their genus has one, never a model of the bank', () => {
  const bank = [{ file: 'p.glb', objType: 'arbre', genera: ['Platanus', 'Grevillea'], generic: true, ratio: 1 }];
  const els = fillVegetation([area('broadleaved', 0, 0, 30, 30, { genera: ['Platanus'] })], { halfSize: 100 });
  const r = applyBank(els, { bank });
  assert.ok(els.length > 5 && r.species === els.length && r.n === 0);
  assert.ok(els.every(e => !e.modelFile && e.essence === 'Platane'));
  // A genus of none of our species: the built-in tree (hundreds of models would sink the render).
  const odd = fillVegetation([area('broadleaved', 0, 0, 30, 30, { genera: ['Grevillea'] })], { halfSize: 100 });
  const r2 = applyBank(odd, { bank });
  assert.equal(r2.n + r2.species, 0);
  assert.ok(odd.every(e => !e.modelFile && !e.essence));
});

test('« Chênes sempervirents »: the holm oak by its species, carried to every tree filled', () => {
  assert.deepEqual(kindOfEssence('Chênes sempervirents'), { kind: 'broadleaved', genera: ['Quercus'], taxon: 'quercus ilex' });
  assert.deepEqual(kindOfEssence('Chênes décidus'), { kind: 'broadleaved', genera: ['Quercus'] });
  const els = fillVegetation([area('broadleaved', 0, 0, 30, 30, { genera: ['Quercus'], taxon: 'quercus ilex' })], { halfSize: 100 });
  applyBank(els, { bank: [] });
  assert.ok(els.length > 5 && els.every(e => e.essence === 'Yeuse'));
});

test('an orchard too large for the budget keeps its rows, further apart', () => {
  const big = [area('orchard', -200, -200, 400, 400, { genera: ['Malus'] })];
  const out = fillVegetation(big, { halfSize: 200 });
  assert.ok(out.length <= MAX_TREES && out.length > 100);
  // In rows: few distinct x and z (a grid), not a scatter.
  const xs = new Set(out.map(e => e.x)), zs = new Set(out.map(e => e.z));
  assert.ok(xs.size * zs.size <= out.length * 1.2, `${xs.size} × ${zs.size} for ${out.length}`);
});
