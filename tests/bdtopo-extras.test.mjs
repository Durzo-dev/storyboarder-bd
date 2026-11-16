/**
 * tests/bdtopo-extras.test.mjs: THE BD TOPO'S HEDGES, SPORTS GROUNDS, CEMETERIES AND WATERS (#482f,
 * src/bdtopo-extras.js). Added where OSM has nothing of them; a hedge with its surveyed height and width, clipped to
 * the zone; a sports ground its surface; a cemetery gravel and rows of graves, within its walls, under the budget;
 * a running track keeps its red under the soil map.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addExtras, sportsKindOf, gravesOf, MAX_GRAVES } from '../src/bdtopo-extras.js';
import { applySoils } from '../src/soils.js';
import { pathObject } from '../src/real-place-import.js';

const centre = { lat: 48.2, lon: -3.0 };
const k = 1 / 111320, kx = 1 / (111320 * Math.cos(centre.lat * Math.PI / 180));
const geo = ([x, z]) => [centre.lon + x * kx, centre.lat - z * k];
const line = (pts, props = {}) => ({ properties: props, geometry: { type: 'LineString', coordinates: pts.map(geo) } });
const area = (x0, z0, w, d, props = {}) => ({ properties: props, geometry: { type: 'MultiPolygon',
  coordinates: [[[[x0, z0], [x0 + w, z0], [x0 + w, z0 + d], [x0, z0 + d], [x0, z0]].map(geo)]] } });
const empty = () => ({ paths: [], zones: [], elements: [] });

test('the sports grounds measured: their kind', () => {
  assert.equal(sportsKindOf('Terrain de tennis'), 'tennis');
  assert.equal(sportsKindOf('Petit terrain multi-sports'), 'multi');
  assert.equal(sportsKindOf('Grand terrain de sport'), 'large');
  assert.equal(sportsKindOf('Piste de sport'), 'track');
  assert.equal(sportsKindOf('Bassin'), null);
});

test('a hedge: its height and width, clipped to the zone; not twice where OSM has it', () => {
  const t = empty();
  t.paths.push({ kind: 'haie', world: { pts: [{ x: -50, z: 30 }, { x: 50, z: 30 }] } });
  const n = addExtras(t, { hedges: { features: [
    line([[-80, 0], [80, 0]], { hauteur: 2.5, largeur: 1.5 }), line([[-40, 30.5], [40, 30.5]], { hauteur: 2 }),
  ] } }, centre, 60);
  assert.equal(n.hedges, 1);
  const h = t.paths[1];
  assert.equal(h.wallHeight, 2.5);
  assert.equal(h.world.width, 1.5);
  assert.ok(h.world.pts.every(p => Math.abs(p.x) <= 60.01), 'clipped');
  assert.equal(pathObject(h, { panelId: 'p', newId: () => 'x', nameOf: () => 'Haie' }).wallHeight, 2.5, 'its height into the Scene');
});

test('sports grounds, a cemetery with its graves, a pond; nothing where OSM has the same', () => {
  const t = empty();
  const n = addExtras(t, {
    sports: { features: [area(-50, -50, 20, 10, { nature: 'Terrain de tennis' }), area(0, -50, 40, 20, { nature: 'Piste de sport' })] },
    cemeteries: { features: [area(-50, 0, 40, 30, { nature: 'Civil' })] },
    waters: { features: [area(10, 10, 20, 20, { nature: 'Retenue' })] },
  }, centre, 60);
  assert.deepEqual([n.sports, n.cemeteries, n.waters], [2, 1, 1]);
  assert.deepEqual(t.zones.map(z => z.terrainType), ['béton', 'terre', 'gravier', 'eau']);
  assert.equal(t.zones[1].terrainColor, '#a0472f', 'a running track, red');
  assert.ok(n.graves > 50 && t.elements.every(e => e.objType === 'tombe' || e.objType === 'pierre_tombale'));
  assert.ok(t.elements.every(e => e.x >= -48.6 && e.x <= -11.4 && e.z >= 1.4 && e.z <= 28.6), 'within its walls');
  applySoils(t.zones, [{ kind: 'loam', ring: [{ x: -100, z: -100 }, { x: 100, z: -100 }, { x: 100, z: 100 }, { x: -100, z: 100 }] }]);
  assert.equal(t.zones[1].terrainColor, '#a0472f', 'the soil map leaves the track red');
  const again = addExtras(t, { waters: { features: [area(10, 10, 20, 20, { nature: 'Retenue' })] } }, centre, 60);
  assert.equal(again.waters, 0, 'the same pond: not twice');
});

test('a large cemetery: its graves under the budget, spread', () => {
  const ring = [{ x: -100, z: -100 }, { x: 100, z: -100 }, { x: 100, z: 100 }, { x: -100, z: 100 }, { x: -100, z: -100 }];
  const g = gravesOf(ring, 200);
  assert.equal(g.length, MAX_GRAVES);
  assert.ok(Math.min(...g.map(e => e.z)) < -50 && Math.max(...g.map(e => e.z)) > 50);
});
