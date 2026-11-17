/**
 * Orchards drawn as copies (#481, src/orchard-3d.js, farm-plots.js orchardOf): an orchard, olive or nut grove a Zone
 * with its rows and species; its trees in rows of its kind's spacing, on its cells, off the Traces; light trees.
 */
import './helpers/dom-stub.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPlots, addPlotGrounds, orchardOf, ORCHARD_KINDS, readBdTopoVines } from '../src/farm-plots.js';
import { orchardTrees, MAX_ORCHARD_TREES } from '../src/orchard-3d.js';
import { onTraces } from '../src/vineyard.js';
import { zoneObject } from '../src/real-place-import.js';

const centre = { lat: 42.555, lon: 2.96 };
const k = 1 / 111320, kx = 1 / (111320 * Math.cos(centre.lat * Math.PI / 180));
const square = (x0, z0, w, d) => [[x0, z0], [x0 + w, z0], [x0 + w, z0 + d], [x0, z0 + d], [x0, z0]].map(([x, z]) => [centre.lon + x * kx, centre.lat - z * k]);
const plot = (group, crop, coords) => ({ properties: { code_group: group, code_cultu: crop }, geometry: { type: 'MultiPolygon', coordinates: [[coords]] } });
const zoneOf = (features) => { const t = { zones: [] }; addPlotGrounds(t, readPlots({ features }, centre), 150); return t.zones[0]; };

test('an olive grove, an orchard, a walnut grove: a Zone with its rows and species', () => {
  const olives = zoneOf([plot('23', 'OLI', square(0, 0, 70, 35))]);
  assert.deepEqual({ ...olives.orchard, angle: 0 }, { angle: 0, essence: 'Olivier', gap: 7, step: 6, height: 5 });
  assert.ok(Math.abs(olives.orchard.angle) < 0.01, 'along its longest side');
  assert.ok(['Pommier', 'Cerisier'].includes(zoneOf([plot('20', 'VRG', square(0, 0, 50, 30))]).orchard.essence));
  assert.equal(zoneOf([plot('22', 'NOX', square(0, 0, 50, 30))]).orchard.essence, 'Noyer');
  assert.equal(zoneOf([plot('1', 'BTH', square(0, 0, 50, 30))]).orchard, undefined, 'a wheat field has none');
  assert.equal(orchardOf({ ground: {}, ring: [] }), null);
  const o = zoneObject(olives, { panelId: 'p', newId: () => 'z' });
  assert.deepEqual(o.orchard, olives.orchard, 'carried to the Scene');
});

test('its trees in rows of its spacing, on its cells, a whole orchard (no more scattered rows), under the budget', () => {
  const z = zoneOf([plot('20', 'VRG', square(0, 0, 100, 50))]);
  const trees = orchardTrees(z);
  const { gap, step } = ORCHARD_KINDS.orchard;
  assert.ok(trees.length > 0.8 * (100 / step) * (50 / gap), `${trees.length}: dense, as an orchard is`);
  const rows = [...new Set(trees.map(t => t.z))].sort((a, b) => a - b);
  assert.ok(rows.every((r, i) => !i || Math.abs(r - rows[i - 1] - gap) < 0.05), 'rows evenly apart');
  assert.ok(trees.every(t => t.x >= 0 && t.x <= 100 && t.z >= 0 && t.z <= 50));
  assert.ok(trees.every(t => t.rotY >= 0 && t.rotY <= Math.PI * 2), 'each tree turned its own way');
  const big = zoneOf([plot('20', 'VRG', square(-150, -150, 300, 300))]);
  assert.ok(orchardTrees(big).length <= MAX_ORCHARD_TREES);
});

test('off the Traces across it (nothing on a path)', () => {
  const z = zoneOf([plot('23', 'OLI', square(0, 0, 70, 35))]);
  const avoid = onTraces([{ tracéType: 'chemin', world: { pts: [{ x: 35, z: -5 }, { x: 35, z: 40 }], width: 3 } }], 1.5);
  assert.ok(orchardTrees(z, { avoid }).every(t => Math.abs(t.x - 35) >= 3));
  assert.ok(orchardTrees(z, { avoid }).length < orchardTrees(z).length);
});

test('a BD TOPO orchard: a plot with its trees, where the RPG has none', () => {
  const plots = readBdTopoVines({ features: [{ properties: { nature: 'Verger' }, geometry: { type: 'MultiPolygon', coordinates: [[square(0, 0, 40, 20)]] } }] }, centre);
  assert.equal(plots[0].group, 20);
  const t = { zones: [] }; addPlotGrounds(t, plots, 150);
  assert.ok(t.zones[0].orchard && t.zones[0].source === 'bdtopo');
});

test('an OSM orchard (landuse=orchard), Detailed: its rows; olive trees when OSM says so', async () => {
  const { translateOsm } = await import('../src/osm-scene.js');
  const geometry = [[0, 0], [50, 0], [50, 20], [0, 20], [0, 0]].map(([x, z]) => [centre.lat - z * k, centre.lon + x * kx]);
  const z = (tags) => translateOsm({ elements: [{ type: 'way', id: 9, tags, geometry }] }, { centre, halfSize: 100 }).zones.find(x => x.osmId === 9);
  assert.equal(z({ landuse: 'orchard' }).orchard.essence, 'Pommier');
  assert.equal(z({ landuse: 'orchard', trees: 'olive_trees' }).orchard.essence, 'Olivier');
});

test('drawn at render time on the Ground, off the Traces; the trees light', async () => {
  const sc = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(sc, /const trees = orchard3D\(o, \(x, z\) => GROUND_Y_DEFAULT_3D \+ hauteurSousLeTronc\(_relief, x, z, 0\.4\) - 0\.03,\s*\{ avoid: _plantsAvoid3D\(panelTracés3D, panel, page, 1\.5\) \}\);/);
  const { generateSpeciesTree } = await import('../src/ez-trees.js');
  const fake = () => ({ width: 512, height: 512, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) });
  for (const n of ['Pommier', 'Olivier', 'Noyer']) {
    const light = generateSpeciesTree(n, 1, { lods: null, light: true, makeCanvas: fake }).triangleCount;
    const full = generateSpeciesTree(n, 1, { lods: null, makeCanvas: fake }).triangleCount;
    assert.ok(light < full / 3 && light < 3500, `${n}: ${light} against ${full}`);
  }
});

test('an orchard\'s leaves cut out at 0.2: from afar the crowns no longer empty (seen)', () => {
  assert.match(readFileSync(new URL('../src/orchard-3d.js', import.meta.url), 'utf8'), /tree\.leavesMesh\.material\.alphaTest = 0\.2;/);
});
