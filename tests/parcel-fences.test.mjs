/**
 * tests/parcel-fences.test.mjs: the walls, fences and hedges along the cadastre's parcels (src/parcel-fences.js).
 * A street of drawn parcels, as the cadastre answers them (GeoJSON, degrees), around a centre: two houses side by
 * side on a road, an empty plot, an old centre's parcel; and the LiDAR's heights along a limit.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { builtParcels, parcelFences, HEIGHTS } from '../src/parcel-fences.js';
import { projector } from '../src/geo-local.js';
import { pathObject } from '../src/real-place-import.js';

const centre = { lat: 48.6, lon: -4.5 };
const { toLocal, toGeo } = projector(centre);
/** A parcel as the cadastre gives it: a GeoJSON polygon from a local rectangle. */
const parcel = (x0, z0, x1, z1) => ({ type: 'Feature', geometry: { type: 'Polygon',
  coordinates: [[[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]].map(([x, z]) => { const g = toGeo({ x, z }); return [g.lon, g.lat]; })] } });
const house = (x0, z0, x1, z1) => ({ footprint: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }] });
const lengthOf = (pts) => pts.slice(1).reduce((s, p, k) => s + Math.hypot(p.x - pts[k].x, p.z - pts[k].z), 0);
const total = (pieces) => pieces.reduce((s, p) => s + lengthOf(p.world.pts), 0);
const along = (pieces, test) => pieces.filter(p => p.world.pts.every(test));
const within = (pieces, x0, x1, z0, z1) => pieces.filter(p => p.world.pts.every(q => q.x >= x0 - 0.6 && q.x <= x1 + 0.6 && q.z >= z0 - 0.6 && q.z <= z1 + 0.6));

// The road runs along z = 0 (5 m wide: its edge at z = 2.5); the parcels north of it, from z = -3 to z = -30.
const road = { kind: 'route', world: { pts: [{ x: -60, z: 0 }, { x: 60, z: 0 }], width: 5 } };
const street = () => ({ buildings: [house(-25, -20, -15, -12), house(5, -20, 15, -12)], paths: [road] });
const answer = { features: [parcel(-30, -30, 0, -3), parcel(0, -30, 30, -3), parcel(30, -30, 55, -3)] };

describe('the homes\' parcels, closed all round', () => {
  const parcels = builtParcels(answer, street(), { toLocal });
  const pieces = parcelFences(parcels, street(), { halfSize: 60 });
  test('the parcels: a home\'s or not, by the buildings standing in them', () => {
    assert.deepEqual(parcels.map(p => p.built), [true, true, false]);
    assert.deepEqual(parcels.map(p => p.dense), [false, false, false]);
  });
  test('along the road, a low wall of render, opened 3 m before the house', () => {
    const fronts = along(pieces, p => Math.abs(p.z + 3) < 0.6);
    assert.ok(fronts.length >= 3 && fronts.every(f => f.kind === 'muret' && f.wallHeight === HEIGHTS.front && f.traceTexture === 'int:facade:enduit'));
    const west = fronts.filter(f => f.world.pts.every(p => p.x <= 0.5));
    assert.equal(west.length, 2, 'the first front in two, around its way in');
    const gap = west.map(f => f.world.pts.map(p => p.x)).flat().filter(x => x > -28 && x < -2).sort((a, b) => a - b);
    assert.ok(gap.length === 2 && gap[1] - gap[0] >= 2.5 && gap[1] - gap[0] <= 4 && gap[0] > -26 && gap[1] < -14, `the opening: ${gap}`);
  });
  test('ALL ROUND: each home parcel closed but for its opening; a shared limit laid once', () => {
    assert.ok(Math.abs(total(within(pieces, -30, 0, -30, -3)) - 111) < 3, `the first: ${total(within(pieces, -30, 0, -30, -3))} of 114 - 3`);
    assert.ok(Math.abs(total(within(pieces, 0, 30, -30, -3)) - (84 + 27)) < 4, 'the second: its three sides and the shared one');
    assert.ok(Math.abs(total(along(pieces, p => Math.abs(p.x) < 0.6)) - 27) < 0.5, 'the shared limit: laid once (a fence, its low wall near the road)');
    assert.ok(along(pieces, p => Math.abs(p.x - 30) < 0.6).length >= 1, 'along the empty plot too');
    assert.deepEqual(within(pieces, 31, 55, -30, -3).filter(p => p.world.pts.some(q => q.x > 31)), [], 'the empty plot itself: open');
  });
  test('the pieces meet: each end is another piece\'s, or the opening\'s', () => {
    const ends = pieces.flatMap(p => [p.world.pts[0], p.world.pts[p.world.pts.length - 1]]);
    const lone = ends.filter(e => ends.filter(f => Math.hypot(f.x - e.x, f.z - e.z) < 1.1).length < 2);
    assert.equal(lone.length, 4, `only the four ends at the two openings: ${JSON.stringify(lone)}`);
  });
  test('NOT across a road or a path: the limit opens where a path crosses it', () => {
    const t = street();
    t.paths.push({ kind: 'chemin', world: { pts: [{ x: 22, z: -40 }, { x: 22, z: -5 }], width: 3 } });
    const p = parcelFences(builtParcels(answer, t, { toLocal }), t, { halfSize: 60 });
    const crossing = p.filter(q => q.world.pts.some((a, i) => i && Math.min(a.x, q.world.pts[i - 1].x) < 22 && Math.max(a.x, q.world.pts[i - 1].x) > 22
      && Math.abs(a.z + 30) < 0.6));
    assert.deepEqual(crossing, [], 'the back limit is open where the path crosses it');
  });
  test('NOT along a car park (a Zone of asphalt): open there, as a road', () => {
    const t = street();
    // A car park over x 10 to 30, z -40 to -26: across the second parcel's back limit (z = -30).
    t.zones = [{ terrainType: 'bitume', world: { masque: { x0: 10, z0: -40, pas: 1, nx: 20, nz: 14, plein: '1'.repeat(280) } } }];
    const p = parcelFences(builtParcels(answer, t, { toLocal }), t, { halfSize: 60 });
    assert.ok(total(along(p, q => Math.abs(q.z + 30) < 0.6 && q.x >= 0)) < 11, 'only the back limit west of the car park');
  });
  test('a garden hedge, trimmed: thinner than its height would make it', () => {
    const hedges = pieces.filter(q => q.kind === 'haie');
    assert.ok(hedges.length && hedges.every(q => q.wallThickness === 0.8));
    assert.equal(pathObject(hedges[0], { panelId: 'p', newId: () => 'x' }).wallThickness, 0.8, 'the Path object carries it');
    assert.equal(pathObject({ kind: 'route', world: { pts: [{ x: 0, z: 0 }, { x: 1, z: 0 }] }, wallThickness: 2 }, { panelId: 'p', newId: () => 'x' }).wallThickness, undefined, 'not a road');
  });
  test('up to a building\'s wall: the piece reaches it', () => {
    const t = street();
    t.buildings.push(house(-30, -12, -24, -3));   // a shed on the corner, west
    const p = parcelFences(builtParcels(answer, t, { toLocal }), t, { halfSize: 60 });
    const west = along(p, q => Math.abs(q.x + 30) < 0.6);
    assert.ok(west.some(f => f.world.pts.some(q => Math.abs(q.z + 12) < 0.3)), 'the west side runs up to the shed\'s wall at z = -12');
  });
  test('a side that has a known hedge is completed with it, at its height, joined to it', () => {
    const t = street();
    t.paths.push({ kind: 'haie', world: { pts: [{ x: 0, z: -30 }, { x: 0, z: -20 }] }, wallHeight: 2.2 });
    const p = parcelFences(builtParcels(answer, t, { toLocal }), t, { halfSize: 60 });
    const rest = along(p, q => Math.abs(q.x) < 0.6);
    assert.equal(rest.length, 1);
    assert.deepEqual([rest[0].kind, rest[0].wallHeight], ['haie', 2.2]);
    assert.ok(rest[0].world.pts.some(q => Math.abs(q.z + 20) < 0.3), 'joined to the known hedge\'s end');
  });
  test('a known hedge a little off the limit: its side is not laid again beside it', () => {
    // Plouguerneau: a 1.5 m thick hedge 2.2 m off the cadastre's limit; the limit's pieces drew a second one alongside.
    const t = street();
    t.paths.push({ kind: 'haie', world: { pts: [{ x: 2.2, z: -32 }, { x: 2.2, z: -1 }] }, wallHeight: 2.2, wallThickness: 1.5 });
    const p = parcelFences(builtParcels(answer, t, { toLocal }), t, { halfSize: 60 });
    assert.equal(along(p, q => Math.abs(q.x) < 0.6).length, 0, 'nothing along x = 0 beside the hedge');
    assert.ok(along(p, q => Math.abs(q.x + 30) < 0.6).length, 'the far side (x = -30), away from it, still laid');
    const far = street();
    far.paths.push({ kind: 'haie', world: { pts: [{ x: 6, z: -32 }, { x: 6, z: -1 }] }, wallHeight: 2.2, wallThickness: 1.5 });
    assert.ok(along(parcelFences(builtParcels(answer, far, { toLocal }), far, { halfSize: 60 }), q => Math.abs(q.x) < 0.6).length,
      '6 m off: another barrier, the limit laid');
  });
  test('an old centre\'s parcel, mostly built: a high wall of stone', () => {
    const t = { buildings: [house(-28, -28, -12, -8), house(-11, -28, -2, -8)], paths: [road] };
    const p = parcelFences(builtParcels({ features: [parcel(-30, -30, 0, -3)] }, t, { toLocal }), t, { halfSize: 60 });
    assert.ok(p.length && p.every(x => x.kind === 'muret' && x.wallHeight === HEIGHTS.wall && x.traceTexture === 'int:facade:pierre'));
  });
  test('a parcel with something larger than a house (a shop, a school), or too large itself: left open', () => {
    const t = { buildings: [house(-28, -28, -2, -8)], paths: [road] };   // 520 m²
    assert.equal(builtParcels({ features: [parcel(-30, -30, 0, -3)] }, t, { toLocal })[0].built, false);
    const p = builtParcels({ features: [parcel(-60, -60, 0, -3)] }, { buildings: [house(-25, -20, -15, -12)], paths: [road] }, { toLocal });
    assert.equal(p[0].built, false, '3420 m²: too large');
  });
  test('the LiDAR confirms a wall: raised along most of the limit, on the ground classes, 0.6 to 3 m', () => {
    const n = 240, step = 0.5;
    const heights = { n, step, halfSize: 60, h: new Float32Array(n * n) };
    for (let z = -30; z < -3; z += step) { const i = Math.floor(60 / step), j = Math.floor((z + 60) / step); heights.h[j * n + i] = 1.4; }
    const walls = new Uint8Array(n * n).fill(1);
    const shared = (o) => along(parcelFences(parcels, street(), { halfSize: 60, ...o }), q => Math.abs(q.x) < 0.6)[0];
    assert.deepEqual(['kind', 'wallHeight', 'source'].map(k => shared({ heights, walls })[k]), ['muret', 1.4, 'lidar']);
    assert.notEqual(shared({ heights, walls: new Uint8Array(n * n) }).source, 'lidar', 'on vegetation, a building or a car: not a wall');
    assert.notEqual(shared({ heights }).source, 'lidar', 'no class map: the rules');
    heights.h.forEach((v, i) => { if (v) heights.h[i] = 4.5; });
    assert.notEqual(shared({ heights, walls }).source, 'lidar', '4.5 m: eaves or a tree, not a wall');
  });
  test('no answer, nothing', () => {
    assert.deepEqual(builtParcels(null, street(), { toLocal }), []);
    assert.deepEqual(parcelFences([], street(), { halfSize: 60 }), []);
  });
});
