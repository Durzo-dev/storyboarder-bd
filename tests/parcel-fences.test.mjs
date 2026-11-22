/**
 * tests/parcel-fences.test.mjs: the walls, fences and hedges along the cadastre's parcels (src/parcel-fences.js).
 * A street of drawn parcels, as the cadastre answers them (GeoJSON, degrees), around a centre: two houses side by
 * side on a road, an empty plot, an old centre's parcel; and the LiDAR's heights along a limit.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { builtParcels, parcelFences, HEIGHTS, MIN_RUN } from '../src/parcel-fences.js';
import { projector } from '../src/geo-local.js';

const centre = { lat: 48.6, lon: -4.5 };
const { toLocal, toGeo } = projector(centre);
/** A parcel as the cadastre gives it: a GeoJSON polygon from a local rectangle. */
const parcel = (x0, z0, x1, z1) => ({ type: 'Feature', geometry: { type: 'Polygon',
  coordinates: [[[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]].map(([x, z]) => { const g = toGeo({ x, z }); return [g.lon, g.lat]; })] } });
const house = (x0, z0, x1, z1) => ({ footprint: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }] });
const lengthOf = (pts) => pts.slice(1).reduce((s, p, k) => s + Math.hypot(p.x - pts[k].x, p.z - pts[k].z), 0);
const along = (pieces, test) => pieces.filter(p => p.world.pts.every(test));

// The road runs along z = 0 (6 m wide: its edge at z = 3); the parcels north of it, from z = -3 to z = -30.
const road = { kind: 'route', world: { pts: [{ x: -60, z: 0 }, { x: 60, z: 0 }], width: 6 } };
const street = () => ({
  buildings: [house(-25, -20, -15, -12), house(5, -20, 15, -12)],
  paths: [road],
});
const answer = { features: [parcel(-30, -30, 0, -3), parcel(0, -30, 30, -3), parcel(30, -30, 55, -3)] };

describe('the limits of the built parcels', () => {
  const parcels = builtParcels(answer, street(), { toLocal });
  const pieces = parcelFences(parcels, street(), { halfSize: 60 });
  test('the parcels: built or not, by the buildings standing in them', () => {
    assert.deepEqual(parcels.map(p => p.built), [true, true, false]);
    assert.deepEqual(parcels.map(p => p.dense), [false, false, false]);
  });
  test('along the road, a low wall of render, opened before the house', () => {
    // A front turns the corners a little (within the road's reach), along the side limits.
    const fronts = pieces.filter(f => f.world.pts.some(p => Math.abs(p.z + 3) < 0.6));
    assert.equal(fronts.length, 4, 'two fronts, each opened in two');
    assert.ok(fronts.every(f => f.kind === 'muret' && f.wallHeight === HEIGHTS.front && f.traceTexture === 'int:facade:enduit'));
    const west = fronts.filter(f => f.world.pts.every(p => p.x <= 0.5));
    const ends = west.map(f => f.world.pts.filter(p => Math.abs(p.z + 3) < 0.6).map(p => p.x)).flat().filter(x => x > -29 && x < -1);
    assert.ok(ends.length === 2 && Math.min(...ends) > -26 && Math.max(...ends) < -14 && Math.max(...ends) - Math.min(...ends) >= 3,
      `the opening before the house (x -25 to -15): ${ends}`);
  });
  test('between the two houses, one fence or hedge, read once; nothing along the empty plot', () => {
    const shared = along(pieces, p => Math.abs(p.x) < 0.6);
    assert.equal(shared.length, 1);
    assert.equal(shared[0].world.pts.length, 2, 'a straight limit: its two ends');
    assert.ok(['cloture', 'haie'].includes(shared[0].kind));
    assert.ok(lengthOf(shared[0].world.pts) > 20);
    assert.deepEqual(along(pieces, p => Math.abs(p.x - 30) < 0.6), [], 'the empty plot east: nothing');
    assert.ok(pieces.every(p => lengthOf(p.world.pts) >= MIN_RUN - 1));
  });
  test('the back limits face nothing built: nothing', () => {
    assert.deepEqual(along(pieces, p => Math.abs(p.z + 30) < 0.6), []);
  });
  test('never against a building, nor where a Path already is', () => {
    const t = street();
    t.buildings.push(house(-30, -12, -24, -3));   // a house on the front, west
    t.paths.push({ kind: 'haie', world: { pts: [{ x: 0, z: -30 }, { x: 0, z: -3 }] } });
    const p2 = parcelFences(builtParcels(answer, t, { toLocal }), t, { halfSize: 60 });
    assert.deepEqual(along(p2, p => Math.abs(p.x) < 0.6), [], 'the known hedge between them');
    assert.ok(along(p2, p => Math.abs(p.z + 3) < 0.6 && p.x < -24).length === 0, 'not along the house on the front');
  });
  test('a parcel with something larger than a house (a shop, a school), or too large itself: left open', () => {
    const t = { buildings: [house(-28, -28, -2, -8)], paths: [road] };   // 520 m²
    const p = builtParcels({ features: [parcel(-60, -60, 0, -3)] }, { buildings: [house(-25, -20, -15, -12)], paths: [road] }, { toLocal });
    assert.equal(p[0].built, false, '3420 m²: too large');
    assert.equal(builtParcels({ features: [parcel(-30, -30, 0, -3)] }, t, { toLocal })[0].built, false);
  });
  test('an old centre\'s parcel, mostly built: a high wall of stone', () => {
    const t = { buildings: [house(-28, -28, -12, -8), house(-11, -28, -2, -8)], paths: [road] };   // 320 + 180 m² of 810
    const p = parcelFences(builtParcels({ features: [parcel(-30, -30, 0, -3)] }, t, { toLocal }), t, { halfSize: 60 });
    assert.ok(p.length && p.every(x => x.kind === 'muret' && x.wallHeight === HEIGHTS.wall && x.traceTexture === 'int:facade:pierre'));
  });
  test('the LiDAR confirms a wall: raised along most of the limit, not vegetation; its height measured', () => {
    const n = 240, step = 0.5;
    const heights = { n, step, halfSize: 60, h: new Float32Array(n * n) };
    // A 1.4 m wall on the shared limit (x = 0), z from -30 to -3.
    for (let z = -30; z < -3; z += step) { const i = Math.floor(60 / step), j = Math.floor((z + 60) / step); heights.h[j * n + i] = 1.4; }
    const walls = new Uint8Array(n * n).fill(1);
    const p = parcelFences(parcels, street(), { halfSize: 60, heights, walls });
    const shared = along(p, q => Math.abs(q.x) < 0.6);
    assert.equal(shared.length, 1);
    assert.deepEqual([shared[0].kind, shared[0].wallHeight, shared[0].source], ['muret', 1.4, 'lidar']);
    const p2 = parcelFences(parcels, street(), { halfSize: 60, heights, walls: new Uint8Array(n * n) });
    assert.notEqual(along(p2, q => Math.abs(q.x) < 0.6)[0].source, 'lidar', 'on vegetation, a building or a car: not a wall');
    assert.notEqual(along(parcelFences(parcels, street(), { halfSize: 60, heights }), q => Math.abs(q.x) < 0.6)[0].source, 'lidar', 'no class map: the rules');
    heights.h.forEach((v, i) => { if (v) heights.h[i] = 4.5; });
    assert.notEqual(along(parcelFences(parcels, street(), { halfSize: 60, heights, walls }), q => Math.abs(q.x) < 0.6)[0].source, 'lidar', '4.5 m: eaves or a tree, not a wall');
  });
  test('no answer, nothing', () => {
    assert.deepEqual(builtParcels(null, street(), { toLocal }), []);
    assert.deepEqual(parcelFences([], street(), { halfSize: 60 }), []);
  });
});
