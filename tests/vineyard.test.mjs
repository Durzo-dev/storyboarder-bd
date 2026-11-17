/**
 * A vineyard's stocks (#481b, src/vineyard.js): in rows along the parcel's longest side, on the Zone's own cells,
 * under the budget (the rows kept); the RPG's vines given their rows; the render's wiring.
 */
import './helpers/dom-stub.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { vineStocks, vineRowAngle, VINE_ROW_GAP, VINE_STEP, MAX_VINES } from '../src/vineyard.js';
import { maskOfPolygon } from '../src/osm-scene.js';
import { readPlots, addPlotGrounds } from '../src/farm-plots.js';
import { zoneObject } from '../src/real-place-import.js';

const ring = (x0, z0, w, d) => [{ x: x0, z: z0 }, { x: x0 + w, z: z0 }, { x: x0 + w, z: z0 + d }, { x: x0, z: z0 + d }, { x: x0, z: z0 }];

test('the rows\' direction: the parcel\'s longest side', () => {
  assert.equal(vineRowAngle(ring(0, 0, 50, 20)), 0);
  assert.ok(Math.abs(vineRowAngle(ring(0, 0, 20, 50)) - Math.PI / 2) < 1e-3);
  const slanted = [{ x: 0, z: 0 }, { x: 30, z: 30 }, { x: 25, z: 35 }, { x: -5, z: 5 }, { x: 0, z: 0 }];
  assert.ok(Math.abs(vineRowAngle(slanted) - Math.PI / 4) < 1e-3);
});

test('stocks in rows VINE_ROW_GAP apart, one every VINE_STEP or so, only on the Zone\'s cells', () => {
  const m = maskOfPolygon(ring(0, 0, 44, 22), 100);
  const st = vineStocks(m, { angle: 0 });
  // 22 m across: 10 rows; 44 m along: about 40 stocks each.
  const rows = [...new Set(st.map(s => s.z))].sort((a, b) => a - b);
  assert.ok(rows.length >= 9 && rows.length <= 11, `${rows.length} rows`);
  assert.ok(rows.every((z, i) => !i || Math.abs(z - rows[i - 1] - VINE_ROW_GAP) < 0.02), 'rows evenly apart');
  const one = st.filter(s => s.z === rows[3]).map(s => s.x).sort((a, b) => a - b);
  assert.ok(one.length >= 35 && one.length <= 42, `${one.length} along a row`);
  assert.ok(one.every((x, i) => !i || Math.abs(x - one[i - 1] - VINE_STEP) < 0.3));
  assert.ok(st.every(s => s.x >= 0 && s.x <= 44 && s.z >= 0 && s.z <= 22), 'within the Zone');
  assert.ok(st.every(s => s.variant >= 1 && s.variant <= 3 && s.scale >= 0.85 && s.scale <= 1.15));
  assert.deepEqual(vineStocks(m, { angle: 0 }), st, 'the same at each render');
  assert.deepEqual(vineStocks(null), []);
});

test('a vineyard too large: under the budget, its rows kept (the step along them widened)', () => {
  const m = maskOfPolygon(ring(-150, -150, 300, 300), 150);
  const st = vineStocks(m, { angle: 0.3 });
  assert.ok(st.length <= MAX_VINES && st.length > MAX_VINES * 0.7, `${st.length}`);
  const v = (s) => -Math.sin(0.3) * s.x + Math.cos(0.3) * s.z;
  const rows = new Set(st.map(s => Math.round(v(s) / VINE_ROW_GAP)));
  assert.ok(rows.size > 150, `${rows.size} rows: the rows kept`);
});

test('the RPG\'s vines: a Zone of earth with its rows\' direction, carried to the Scene\'s Zone', () => {
  const centre = { lat: 48.08, lon: 7.30 };
  const k = 1 / 111320, kx = 1 / (111320 * Math.cos(centre.lat * Math.PI / 180));
  const coords = [[0, 0], [60, 0], [60, 20], [0, 20], [0, 0]].map(([x, z]) => [centre.lon + x * kx, centre.lat - z * k]);
  const translated = { zones: [] };
  addPlotGrounds(translated, readPlots({ features: [{ properties: { code_group: '21', code_cultu: 'VRC' }, geometry: { type: 'MultiPolygon', coordinates: [[coords]] } }] }, centre), 100);
  const [z] = translated.zones;
  assert.equal(z.terrainType, 'terre');
  assert.ok(z.vines && Math.abs(z.vines.angle) < 0.01, JSON.stringify(z.vines));
  const o = zoneObject(z, { panelId: 'p', newId: () => 'z1' });
  assert.deepEqual(o.vines, z.vines);
});

test('drawn at render time: after the drape, its shared meshes never disposed', () => {
  const sc = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  // On the Ground (GROUND_Y_DEFAULT_3D, -3: without it the stocks stood 3 m up, seen on 17 Nov. 2026) and the relief.
  assert.match(sc, /if \(o\.tracéType === 'terrain' && o\.vines\) \{\s*const vines = vineyard3D\(o, \(x, z\) => GROUND_Y_DEFAULT_3D \+ hauteurSousLeTronc\(_relief, x, z, 0\.15\) - 0\.03\);/);
  assert.ok(sc.indexOf('vineyard3D(o,') > sc.indexOf("draperSurLeRelief3D(group, _relief);"), 'after the drape');
  assert.match(sc, /if \(ch\.isMesh && !ch\.userData\.shared\) \{ ch\.geometry\.dispose\(\)/);
  assert.match(readFileSync(new URL('../src/vineyard-3d.js', import.meta.url), 'utf8'), /mesh\.userData\.shared = true;/);
});

test('an OSM vineyard (landuse=vineyard), Detailed: its rows too; Simple: its earth only', async () => {
  const { translateOsm } = await import('../src/osm-scene.js');
  const c = { lat: 48.08, lon: 7.30 }, k = 1 / 111320, kx = 1 / (111320 * Math.cos(c.lat * Math.PI / 180));
  const geometry = [[0, 0], [50, 0], [50, 20], [0, 20], [0, 0]].map(([x, z]) => [c.lat - z * k, c.lon + x * kx]);
  const data = { elements: [{ type: 'way', id: 9, tags: { landuse: 'vineyard' }, geometry }] };
  const z = translateOsm(data, { centre: c, halfSize: 100 }).zones.find(x => x.osmId === 9);
  assert.equal(z.terrainType, 'terre');
  assert.ok(z.vines && Math.abs(z.vines.angle) < 0.01);
  assert.equal(translateOsm(data, { centre: c, halfSize: 100, detail: 'simple' }).zones.find(x => x.osmId === 9).vines, undefined);
});

test('a stock as a vineyard trains it: a trunk to the fruiting wire, two arms along the row, shoots up to the wires; light', async () => {
  const { buildVineStock, VINE_WIRES } = await import('../src/vineyard-3d.js');
  const a = buildVineStock(1), b = buildVineStock(2);
  const xs = (p) => p.position.filter((_, i) => i % 3 === 0), ys = (p) => p.position.filter((_, i) => i % 3 === 1), zs = (p) => p.position.filter((_, i) => i % 3 === 2);
  const tris = (p) => p.index.length / 3;
  assert.ok(tris(a.wood) + tris(a.leaves) < 400, `${tris(a.wood) + tris(a.leaves)} triangles: copied by the thousand`);
  assert.ok(Math.min(...ys(a.wood)) > -0.05 && Math.min(...ys(a.wood)) < 0.05, 'its foot on the ground');
  assert.ok(Math.max(...xs(a.wood)) > 0.45 && Math.min(...xs(a.wood)) < -0.45, 'its arms half a place each way along the row');
  assert.ok(Math.max(...zs(a.wood)) < 0.15 && Math.min(...zs(a.wood)) > -0.15, 'a narrow wall: nothing far across the row');
  assert.ok(Math.max(...ys(a.leaves)) < 2 && Math.max(...ys(a.leaves)) > VINE_WIRES[2], 'its leaves up past the top wire');
  assert.ok(Math.min(...ys(a.leaves)) > VINE_WIRES[0] - 0.25, 'no leaf under the fruiting wire');
  assert.notDeepEqual(a.wood.position, b.wood.position, 'variants differ');
  assert.deepEqual(buildVineStock(1), a, 'the same each time');
});

test('the wired runs: posts between stocks, never on a trunk, at both ends', async () => {
  const { vineRuns } = await import('../src/vineyard.js');
  const stocks = Array.from({ length: 12 }, (_, c) => ({ x: c * 1.1, z: 0, row: 0, col: c }))
    .concat([{ x: 20, z: 0, row: 0, col: 18 }, { x: 21.1, z: 0, row: 0, col: 19 }]);
  const { runs, posts } = vineRuns(stocks);
  assert.equal(runs.length, 2, 'a gap splits a row');
  assert.ok(Math.abs(runs[0].a.x + 0.55) < 0.01 && Math.abs(runs[0].b.x - 12.65) < 0.01);
  assert.ok(posts.every(p => stocks.every(s => Math.hypot(s.x - p.x, s.z - p.z) > 0.4)), 'never on a trunk');
  assert.ok(posts.length >= 5);
});
