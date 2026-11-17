/**
 * The farm plots of a place (#481, src/farm-plots.js): the RPG's crop groups read (as measured on 17 Nov. 2026),
 * each parcel a Zone of its ground cut out of OSM's farmland, orchards, olive and nut groves filled with their trees.
 */
import './helpers/dom-stub.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groundOfPlot, readPlots, addPlotGrounds, PLOT_GROUNDS } from '../src/farm-plots.js';
import { maskOfPolygon } from '../src/osm-scene.js';
import { mondeDuMasque } from '../src/terrain-zone-pinceau.js';

test('the crop groups seen (as strings): their ground, their tint, their trees', () => {
  assert.deepEqual(groundOfPlot('1', 'BTH'), PLOT_GROUNDS[1]);
  assert.equal(groundOfPlot('1').terrainType, 'terre');
  assert.ok(groundOfPlot('1').terrainColor, 'a cereal tints its earth');
  assert.equal(groundOfPlot('18', 'PPH').terrainType, 'herbe');
  assert.equal(groundOfPlot('21', 'VRC').vines, true);
  assert.deepEqual(groundOfPlot('23', 'OLI').fill, { kind: 'olives', genera: ['Olea'] });
  assert.deepEqual(groundOfPlot('22', 'NOX').fill.genera, ['Juglans'], 'a walnut grove by its crop');
  assert.equal(groundOfPlot('22', 'XYZ').fill.genera.length, 3, 'a nut grove not said: its genera');
  assert.equal(groundOfPlot('20', 'VRG').fill.kind, 'orchard');
  assert.equal(groundOfPlot('99'), null);
  assert.equal(groundOfPlot(undefined), null);
});

const centre = { lat: 42.555, lon: 2.96 };
const k = 1 / 111320, kx = 1 / (111320 * Math.cos(centre.lat * Math.PI / 180));
const square = (x0, z0, w, d) => [[x0, z0], [x0 + w, z0], [x0 + w, z0 + d], [x0, z0 + d], [x0, z0]]
  .map(([x, z]) => [centre.lon + x * kx, centre.lat - z * k]);
const plot = (group, crop, coords) => ({ properties: { code_group: group, code_cultu: crop }, geometry: { type: 'MultiPolygon', coordinates: [[coords]] } });

test('read: the WFS answer in local metres; a group of none of ours left out', () => {
  const plots = readPlots({ features: [plot('23', 'OLI', square(0, 0, 40, 30)), plot('99', 'ZZZ', square(50, 0, 10, 10))] }, centre);
  assert.equal(plots.length, 1);
  assert.equal(plots[0].crop, 'OLI');
  assert.ok(Math.abs(plots[0].ring[2].x - 40) < 0.1 && Math.abs(plots[0].ring[2].z - 30) < 0.1);
  assert.equal(readPlots(null, centre).length, 0);
});

test('a parcel\'s ground: cut out of OSM\'s farmland under it, left out where another ground holds it', () => {
  const zoneOf = (terrainType, ring, source = 'osm') => ({ terrainType, world: mondeDuMasque(maskOfPolygon(ring, 100)), source });
  const ring = (x0, z0, w, d) => [{ x: x0, z: z0 }, { x: x0 + w, z: z0 }, { x: x0 + w, z: z0 + d }, { x: x0, z: z0 + d }];
  const translated = { zones: [zoneOf('terre', ring(-50, -50, 100, 100)), zoneOf('eau', ring(10, 10, 10, 10)), zoneOf('herbe', ring(70, 70, 10, 10))] };
  const plots = readPlots({ features: [plot('1', 'BTH', square(0, 0, 30, 30))] }, centre);
  assert.equal(addPlotGrounds(translated, plots, 100), 1);
  const [farm, water, untouched, wheat] = translated.zones;
  const cell = (z, x, y) => { const m = z.world.masque; return m.plein[Math.floor((y - m.z0) / m.pas) * m.nx + Math.floor((x - m.x0) / m.pas)]; };
  assert.equal(wheat.source, 'rpg'); assert.equal(wheat.terrainType, 'terre'); assert.equal(wheat.terrainColor, PLOT_GROUNDS[1].terrainColor);
  assert.equal(cell(wheat, 5, 5), '1'); assert.equal(cell(farm, 5, 5), '0', 'the farmland cut out under the wheat');
  assert.equal(cell(farm, -20, -20), '1', 'the farmland kept elsewhere');
  assert.equal(cell(wheat, 15, 15), '0', 'the water keeps its cells'); assert.equal(cell(water, 15, 15), '1');
  assert.equal(untouched.world.masque.plein.includes('1'), true);
  // A cell of the plot held by no other ground.
  for (let x = 0.5; x < 30; x += 1) for (let y = 0.5; y < 30; y += 1) {
    const holders = translated.zones.filter(z => { const m = z.world.masque; const i = Math.floor((x - m.x0) / m.pas), j = Math.floor((y - m.z0) / m.pas);
      return i >= 0 && j >= 0 && i < m.nx && j < m.nz && m.plein[j * m.nx + i] === '1'; });
    if (holders.includes(wheat)) assert.equal(holders.length, 1, `${x},${y}: ${holders.map(z => z.terrainType)}`);
    else assert.ok(holders.length >= 1, `${x},${y}: a hole in the ground`);
  }
});

test('an OSM Zone wholly under parcels is gone', () => {
  const r = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }];
  const translated = { zones: [{ terrainType: 'herbe', world: mondeDuMasque(maskOfPolygon(r, 100)), source: 'osm' }] };
  addPlotGrounds(translated, readPlots({ features: [plot('18', 'PPH', square(-5, -5, 30, 30))] }, centre), 100);
  assert.deepEqual(translated.zones.map(z => z.source), ['rpg']);
});


test('two neighbouring parcels a few centimetres apart on a diagonal: no hole of bare ground between them', () => {
  // Two triangles splitting a 40 m square along its diagonal, 0.3 m apart (as the RPG's outlines are).
  const tri = (pts) => [...pts, pts[0]].map(([x, z]) => [centre.lon + x * kx, centre.lat - z * k]);
  const plots = readPlots({ features: [plot('23', 'OLI', tri([[0, 0], [40, 0], [0, 39.7]])), plot('18', 'PPH', tri([[40, 0.3], [40, 40], [0.3, 40]]))] }, centre);
  const translated = { zones: [] };
  addPlotGrounds(translated, plots, 100);
  const held = (x, y) => translated.zones.filter(z => { const m = z.world.masque; const i = Math.floor((x - m.x0) / m.pas), j = Math.floor((y - m.z0) / m.pas);
    return i >= 0 && j >= 0 && i < m.nx && j < m.nz && m.plein[j * m.nx + i] === '1'; }).length;
  for (let x = 1.5; x < 39; x += 1) for (let y = 1.5; y < 39; y += 1) assert.equal(held(x, y), 1, `${x},${y}`);
  assert.equal(held(-3.5, -3.5), 0, 'outside both: no creeping');
  assert.equal(held(45.5, 20.5), 0);
});

test('the BD TOPO\'s vineyards: vines where the RPG has none, left to the RPG where it has them', async () => {
  const { readBdTopoVines } = await import('../src/farm-plots.js');
  const zones = { features: [
    { properties: { nature: 'Vigne' }, geometry: { type: 'MultiPolygon', coordinates: [[square(0, 0, 60, 20)]] } },
    { properties: { nature: 'Bois' }, geometry: { type: 'MultiPolygon', coordinates: [[square(0, 40, 20, 20)]] } },
  ] };
  const vines = readBdTopoVines(zones, centre);
  assert.equal(vines.length, 1, 'only the vines');
  assert.equal(vines[0].ground.vines, true);
  const translated = { zones: [] };
  addPlotGrounds(translated, readPlots({ features: [plot('21', 'VRC', square(0, 0, 30, 20))] }, centre), 100);
  addPlotGrounds(translated, vines, 100);
  assert.equal(translated.zones.length, 2);
  const [rpg, bd] = translated.zones;
  assert.equal(rpg.source, 'rpg'); assert.equal(bd.source, 'bdtopo'); assert.ok(bd.vines && rpg.vines);
  const cell = (z, x, y) => { const m = z.world.masque; const i = Math.floor((x - m.x0) / m.pas), j = Math.floor((y - m.z0) / m.pas);
    return i >= 0 && j >= 0 && i < m.nx && j < m.nz ? m.plein[j * m.nx + i] : '0'; };
  assert.equal(cell(rpg, 10.5, 10.5), '1'); assert.equal(cell(bd, 10.5, 10.5), '0', 'the RPG\'s cell left to it');
  assert.equal(cell(bd, 45.5, 10.5), '1', 'the BD TOPO\'s own vines');
});
