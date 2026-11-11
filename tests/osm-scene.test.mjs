/**
 * tests/osm-scene.test.mjs: #457b-2, the OSM translator (src/osm-scene.js), on two REAL extracts recorded
 * on 11 November 2026 from the OSM API (tests/fixtures/osm-eguisheim.json: a village centre;
 * osm-paris-mouffetard.json: a dense city street), compacted to the Overpass `out geom` shape.
 * Data © OpenStreetMap contributors, ODbL.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  translateOsm, clipPolyline, maskOfPolygon, cleanFootprint, levelsOf, roofOf, pathKindOf, zoneTypeOf,
  OSM_ATTRIBUTION, ZONE_SIDE_MAX,
} from '../src/osm-scene.js';
import { lireBatiment, ecrireBatiment } from '../src/batiment.js';
import { projector } from '../src/geo-local.js';
import { toitsDuNiveau } from '../src/batiment-toits.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const centreOf = (d) => ({ lat: (d.bbox.sud + d.bbox.nord) / 2, lon: (d.bbox.ouest + d.bbox.est) / 2 });
const village = fixture('osm-eguisheim');
const street = fixture('osm-paris-mouffetard');
const V = translateOsm(village, { centre: centreOf(village) });
const P = translateOsm(street, { centre: centreOf(street) });
const top = (b) => b.niveaux.reduce((p, q) => (q.elevation > p.elevation ? q : p));
const byName = (r, name) => r.buildings.find(x => x.building.nom === name);

describe('#457b-2, projection', () => {
  test('local metres: x to the east, z to the SOUTH (north is up in the top view)', () => {
    const { toLocal, toGeo } = projector({ lat: 48, lon: 7 });
    const north = toLocal({ lat: 48.001, lon: 7 }), east = toLocal({ lat: 48, lon: 7.001 });
    assert.ok(Math.abs(north.z + 111.2) < 0.2 && Math.abs(north.x) < 1e-9, `north ${JSON.stringify(north)}`);
    assert.ok(Math.abs(east.x - 74.4) < 0.2 && Math.abs(east.z) < 1e-9, `east ${JSON.stringify(east)}`);
    const back = toGeo(toLocal({ lat: 48.0012, lon: 7.0007 }));
    assert.ok(Math.abs(back.lat - 48.0012) < 1e-9 && Math.abs(back.lon - 7.0007) < 1e-9);
  });
});

describe('#457b-2, the village (Eguisheim)', () => {
  test('every building is complete: levels, walls, rooms, a roof, a door, windows', () => {
    assert.equal(V.buildings.length, 38);
    for (const { building: b } of V.buildings) {
      assert.ok(b.niveaux.length >= 1 && b.murs.length >= 3, b.nom);
      assert.ok(b.pieces.length >= b.niveaux.length, `${b.nom}: a room per level`);
      assert.ok(toitsDuNiveau(b, top(b).id).length >= 1, `${b.nom}: a roof`);
      assert.equal(b.ouvertures.filter(o => o.type === 'porte').length, 1, `${b.nom}: one door`);
      assert.ok(b.ouvertures.some(o => o.type === 'fenetre'), `${b.nom}: windows`);
    }
  });
  test('each building survives the building file format unchanged', () => {
    for (const { building: b } of V.buildings) {
      const back = lireBatiment(ecrireBatiment(b)).batiment;
      assert.ok(back, b.nom);
      assert.equal(back.murs.length, b.murs.length);
      assert.equal(back.ouvertures.length, b.ouvertures.length);
    }
  });
  test('tags: levels and roof shape when given, names kept', () => {
    const church = byName(V, 'Église Saints-Pierre-et-Paul');
    assert.ok(church, 'the church, by its name');
    const gabled = V.buildings.find(x => x.osmId === 81928494).building;   // apartments, 3 levels, gabled
    assert.equal(gabled.niveaux.length, 3);
    assert.equal(top(gabled).toit.type, 'deux-pans');
    const halfHipped = V.buildings.find(x => x.osmId === 81928411).building;
    assert.equal(top(halfHipped).toit.type, 'quatre-pans');
  });
  test('roads, paths, the retaining wall; the pedestrian square becomes paved ground', () => {
    const grandRue = V.paths.find(p => p.name === 'Grand\'Rue');
    assert.equal(grandRue.kind, 'route');
    assert.equal(grandRue.world.width, 5);
    assert.ok(V.paths.some(p => p.kind === 'chemin' && p.world.width === 1.2), 'a path');
    assert.ok(V.paths.some(p => p.kind === 'muret'), 'the retaining wall');
    const square = V.zones.find(z => z.name === 'Place du Marché aux Saules');
    assert.equal(square.terrainType, 'bitume');
    assert.ok(square.world.masque.plein.includes('1'));
  });
  test('relations are counted as skipped (multipolygons: later), the attribution is given', () => {
    assert.equal(V.attribution, OSM_ATTRIBUTION);
    assert.match(OSM_ATTRIBUTION, /OpenStreetMap contributors, ODbL/);
  });
});

describe('#457b-2, the city street (rue Mouffetard)', () => {
  test('six-level blocks, the street, the lamps; the building passage (a tunnel) is skipped', () => {
    assert.ok(P.buildings.some(x => x.building.niveaux.length === 6));
    assert.equal(P.elements.filter(e => e.objType === 'lampadaire').length, 9);
    const mouffetard = P.paths.find(p => p.name === 'Rue Mouffetard');
    assert.equal(mouffetard.kind, 'route');
    assert.equal(mouffetard.marking, false, 'a pedestrian street: no road marking');
    assert.equal(P.skipped.tunnels, 1);
  });
  test('the doors face a street: each block along one opens within 12 m of a road or path', () => {
    // The theatre opens on the service lane beside it, not on rue Mouffetard: the NEAREST way wins.
    const voies = P.paths.filter(p => p.kind === 'route' || p.kind === 'chemin').map(p => p.world.pts);
    const dist = (p) => Math.min(...voies.flatMap(rue => rue.slice(1).map((b, i) => {
      const a = rue[i], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
      return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
    })));
    let along = 0;
    for (const { building: b, x, z } of P.buildings) {
      const door = b.ouvertures.find(o => o.type === 'porte'), m = b.murs.find(w => w.id === door.murId);
      const near = Math.min(...b.murs.map(w => dist({ x: x + (w.a.x + w.b.x) / 2, z: z + (w.a.z + w.b.z) / 2 })));
      if (near > 12) continue;   // a block behind, not on the street
      along++;
      // The door is on the wall nearest the way, or the next one when that wall is too short for a door.
      assert.ok(dist({ x: x + m.a.x + (m.b.x - m.a.x) * door.le, z: z + m.a.z + (m.b.z - m.a.z) * door.le }) < near + 3, b.nom);
    }
    assert.ok(along >= 8, `${along} blocks along the street`);
  });
  test('fast enough: both extracts in well under a second each', () => {
    const t0 = Date.now();
    translateOsm(street, { centre: centreOf(street) });
    assert.ok(Date.now() - t0 < 1500);
  });
});

describe('#457b-2, the pieces', () => {
  test('a polyline clipped to the zone, in pieces when it leaves and comes back', () => {
    const pieces = clipPolyline([{ x: -20, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 20 }, { x: 5, z: 20 }, { x: 5, z: 0 }], 10);
    assert.equal(pieces.length, 2);
    assert.deepEqual(pieces[0][0], { x: -10, z: 0 });
    assert.deepEqual(pieces[0][pieces[0].length - 1], { x: 0, z: 10 });
    assert.deepEqual(pieces[1][0], { x: 5, z: 10 });
    assert.deepEqual(clipPolyline([{ x: 20, z: 20 }, { x: 30, z: 30 }], 10), []);
  });
  test('a polygon as a Zone mask, clipped to the zone', () => {
    const m = maskOfPolygon([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }], 100);
    assert.equal(m.plein.split('').filter(c => c === '1').length, 100);
    const c = maskOfPolygon([{ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 30 }, { x: 0, z: 30 }], 10);
    assert.equal(c.nx, 10, 'clipped to x ≤ 10');
    assert.equal(maskOfPolygon([{ x: 50, z: 50 }, { x: 60, z: 50 }, { x: 60, z: 60 }], 10), null);
  });
  test('a footprint cleaned: closing point, too close and aligned points removed', () => {
    const fp = cleanFootprint([{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 10, z: 0.01 }, { x: 10, z: 8 }, { x: 10.1, z: 8.1 }, { x: 0, z: 8 }, { x: 0, z: 0 }]);
    assert.equal(fp.length, 4);
  });
  test('levels and roofs from the tags, else the French defaults', () => {
    assert.deepEqual(levelsOf({ building: 'apartments', 'building:levels': '5' }), { count: 5, height: 2.8 });
    assert.deepEqual(levelsOf({ building: 'yes', height: '12' }), { count: 4, height: 2.8 });
    assert.deepEqual(levelsOf({ building: 'yes', height: '12', 'building:levels': '3' }), { count: 3, height: 4 });
    assert.equal(levelsOf({ building: 'house' }).count, 2);
    assert.equal(levelsOf({ building: 'shed' }).count, 1);
    assert.equal(roofOf({ building: 'house' }), 'deux-pans');
    assert.equal(roofOf({ building: 'retail' }), 'plat');
    assert.equal(roofOf({ building: 'house', 'roof:shape': 'skillion' }), 'un-pan');
  });
  test('which ways are paths, which are Zones', () => {
    assert.deepEqual(pathKindOf({ highway: 'primary' }), { kind: 'route', width: 8, marking: true });
    assert.deepEqual(pathKindOf({ highway: 'track', width: '2.5' }), { kind: 'chemin', width: 2.5 });
    assert.equal(pathKindOf({ highway: 'primary', tunnel: 'yes' }), null);
    assert.deepEqual(pathKindOf({ barrier: 'hedge' }), { kind: 'haie' });
    assert.deepEqual(pathKindOf({ waterway: 'stream' }), { kind: 'riviere', width: 2 });
    assert.equal(zoneTypeOf({ landuse: 'grass' }), 'herbe');
    assert.equal(zoneTypeOf({ leisure: 'park' }), 'gazon');
    assert.equal(zoneTypeOf({ natural: 'water' }), 'eau');
    assert.equal(zoneTypeOf({ amenity: 'parking' }), 'bitume');
    assert.equal(zoneTypeOf({ landuse: 'residential' }), null, 'too wide: not a ground');
  });
  test('a synthetic extract: a lawn, a lake, a tree, a relation; everything outside the zone is left out', () => {
    const ring = (lat0, lon0, d) => [[lat0, lon0], [lat0, lon0 + d], [lat0 + d, lon0 + d], [lat0 + d, lon0], [lat0, lon0]];
    const r = translateOsm({ elements: [
      { type: 'way', id: 1, tags: { landuse: 'grass' }, geometry: ring(48, 7, 0.0002) },
      { type: 'way', id: 2, tags: { natural: 'water' }, geometry: ring(48.0003, 7, 0.0001) },
      { type: 'node', id: 3, lat: 48.0001, lon: 7.0001, tags: { natural: 'tree' } },
      { type: 'node', id: 4, lat: 48.01, lon: 7.01, tags: { natural: 'tree' } },
      { type: 'relation', id: 5, tags: { building: 'yes' } },
    ] }, { centre: { lat: 48.0002, lon: 7.0001 }, halfSize: 100 });
    assert.deepEqual(r.zones.map(z => z.terrainType), ['herbe', 'eau']);
    assert.deepEqual(r.elements.map(e => e.objType), ['arbre']);
    assert.equal(r.skipped.relations, 1);
  });
  test('the zone is at most 400 m wide', () => {
    assert.equal(ZONE_SIDE_MAX, 400);
    const r = translateOsm({ elements: [{ type: 'node', id: 1, lat: 48.0025, lon: 7, tags: { natural: 'tree' } }] }, { centre: { lat: 48, lon: 7 }, halfSize: 5000 });
    assert.equal(r.elements.length, 0, '278 m north: outside a 400 m zone');
  });
});
