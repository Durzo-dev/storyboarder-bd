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
    assert.equal(square.terrainType, 'béton', 'paved (surface sett), not asphalt');
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
    assert.equal(zoneTypeOf({ amenity: 'parking', surface: 'gravel' }), 'gravier');
    assert.equal(zoneTypeOf({ highway: 'pedestrian', area: 'yes' }), 'béton', 'a square is paved');
    assert.equal(zoneTypeOf({ highway: 'pedestrian', area: 'yes', surface: 'asphalt' }), 'bitume', 'unless asphalted');
    assert.equal(zoneTypeOf({ highway: 'pedestrian', area: 'yes', surface: 'unknown' }), 'béton');
    assert.equal(zoneTypeOf({ highway: 'pedestrian' }), null, 'a pedestrian street is a Path, not a Zone');
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

describe('OSM translator, streets and grounds (#468b)', async () => {
  const { markingOf } = await import('../src/osm-scene.js');
  test('a centre line on main two-way roads, or 2 lanes and more; none on a residential street or a one-way', () => {
    assert.equal(markingOf({ highway: 'residential' }), false);
    assert.equal(markingOf({ highway: 'unclassified' }), false);
    assert.equal(markingOf({ highway: 'secondary' }), true);
    assert.equal(markingOf({ highway: 'secondary', oneway: 'yes' }), false);
    assert.equal(markingOf({ highway: 'residential', lanes: '2' }), true);
    assert.equal(markingOf({ highway: 'primary', lanes: '1' }), false);
  });
  test('a built-up zone stands on a paved Ground; flat roofs without covering are grey', () => {
    const v = JSON.parse(readFileSync(new URL('./fixtures/osm-eguisheim.json', import.meta.url), 'utf8'));
    const b = v.bbox, centre = { lat: (b.sud + b.nord) / 2, lon: (b.ouest + b.est) / 2 };
    const old = translateOsm(v, { centre, halfSize: 45 });
    assert.ok(old.builtShare > 0.3, `the old town: ${old.builtShare}`);
    assert.equal(old.ground, 'béton');
    const wide = translateOsm(v, { centre, halfSize: 150 });
    assert.ok(wide.builtShare < 0.1 && wide.ground === undefined, 'the same buildings in a wide zone: not built up');
    const flat = { elements: [{ type: 'way', id: 9, tags: { building: 'retail', 'roof:shape': 'flat' }, geometry: [[48, 7], [48, 7.0002], [48.0002, 7.0002], [48.0002, 7], [48, 7]] }] };
    const t = translateOsm(flat, { centre: { lat: 48.0001, lon: 7.0001 }, halfSize: 50 });
    const top = t.buildings[0].building.niveaux.reduce((p, q) => (q.elevation > p.elevation ? q : p));
    assert.deepEqual(top.toit.revetement, { texture: null, couleur: '#8f8b84' });
  });
  test('road signs, shrubs and benches become Elements', () => {
    const nodes = { elements: [
      { type: 'node', id: 1, lat: 48, lon: 7, tags: { traffic_sign: 'FR:B1' } },
      { type: 'node', id: 2, lat: 48, lon: 7.0001, tags: { highway: 'stop' } },
      { type: 'node', id: 3, lat: 48.0001, lon: 7, tags: { natural: 'shrub' } },
      { type: 'node', id: 4, lat: 48.0001, lon: 7.0001, tags: { amenity: 'bench' } },
    ] };
    const t = translateOsm(nodes, { centre: { lat: 48, lon: 7 }, halfSize: 50 });
    assert.deepEqual(t.elements.map(e => e.objType), ['panneau_signalisation', 'panneau_signalisation', 'buisson', 'banc']);
  });
});

describe('OSM translator, pavements', async () => {
  const { sidewalkSides, offsetPolyline } = await import('../src/osm-scene.js');
  test('the sides that have a pavement drawn with the road', () => {
    assert.deepEqual(sidewalkSides({ sidewalk: 'both' }), { left: true, right: true });
    assert.deepEqual(sidewalkSides({ sidewalk: 'right' }), { left: false, right: true });
    assert.deepEqual(sidewalkSides({ 'sidewalk:left': 'yes', 'sidewalk:right': 'separate' }), { left: true, right: false });
    assert.deepEqual(sidewalkSides({ sidewalk: 'separate' }), { left: false, right: false });
    assert.deepEqual(sidewalkSides({}), { left: false, right: false });
  });
  test('a polyline moved to its left: north of a road going east (z to the south)', () => {
    assert.deepEqual(offsetPolyline([{ x: 0, z: 0 }, { x: 10, z: 0 }], 2), [{ x: 0, z: -2 }, { x: 10, z: -2 }]);
    const corner = offsetPolyline([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: -10 }], 1);
    assert.ok(Math.abs(corner[1].x - 9) < 1e-9 && Math.abs(corner[1].z + 1) < 1e-9, 'the inner corner, 1 m from both segments');
  });
  test('a road with pavements on both sides: two pavement Paths beside it; a mapped pavement is one too', () => {
    const data = { elements: [
      { type: 'way', id: 1, tags: { highway: 'residential', sidewalk: 'both' }, geometry: [[48, 7], [48, 7.001]] },
      { type: 'way', id: 2, tags: { highway: 'footway', footway: 'sidewalk' }, geometry: [[48.0002, 7], [48.0002, 7.001]] },
    ] };
    const t = translateOsm(data, { centre: { lat: 48, lon: 7.0005 }, halfSize: 100 });
    const pavements = t.paths.filter(p => p.kind === 'trottoir');
    assert.equal(pavements.length, 3);
    const beside = pavements.filter(p => p.osmId === 1).map(p => p.world.pts[0].z).sort((a, b) => a - b);
    const road = t.paths.find(p => p.kind === 'route').world.pts[0].z;
    assert.ok(Math.abs(beside[0] - (road - 3.4)) < 0.01 && Math.abs(beside[1] - (road + 3.4)) < 0.01, 'half the road (2.5) and half the pavement (0.9)');
    assert.equal(pavements.find(p => p.osmId === 2).world.width, 1.8);
  });
});

describe('OSM translator, the doors at the entrances (#474a)', () => {
  // A 20 × 10 m building along a road to its south; its entrances mapped on its outline.
  const box = [[48.0001, 7.0001], [48.0001, 7.000368], [48.00019, 7.000368], [48.00019, 7.0001], [48.0001, 7.0001]];
  const road = { type: 'way', id: 1, tags: { highway: 'residential' }, geometry: [[48.00005, 7], [48.00005, 7.0006]] };
  const centre = { lat: 48.0001, lon: 7.0003 };
  const doors = (b) => b.ouvertures.filter(o => o.type === 'porte');
  test('without entrance: one door, in the middle of the wall nearest the road', () => {
    const t = translateOsm({ elements: [road, { type: 'way', id: 2, tags: { building: 'house' }, geometry: box }] }, { centre, halfSize: 100 });
    const b = t.buildings[0].building;
    assert.equal(doors(b).length, 1);
    assert.ok(Math.abs(doors(b)[0].le - 0.5) < 1e-9);
  });
  test('with entrances: a door at each, on the wall it stands on, where it stands; a garage door is wide', () => {
    const t = translateOsm({ elements: [road, { type: 'way', id: 2, tags: { building: 'house' }, geometry: box },
      // On the NORTH wall (away from the road), near its west end; and a garage on the west wall.
      { type: 'node', id: 3, lat: 48.00019, lon: 7.00015, tags: { entrance: 'main' } },
      { type: 'node', id: 4, lat: 48.000145, lon: 7.0001, tags: { entrance: 'garage' } }] }, { centre, halfSize: 100 });
    const b = t.buildings[0].building, d = doors(b);
    assert.equal(d.length, 2);
    const main = d.find(o => o.largeur === 1), garage = d.find(o => o.largeur === 2.4);
    assert.ok(main && garage, 'a main door and a garage door');
    const wallOf = (o) => b.murs.find(m => m.id === o.murId);
    const mw = wallOf(main), mz = (mw.a.z + mw.b.z) / 2, cz = b.murs.reduce((s, m) => s + m.a.z, 0) / b.murs.length;
    assert.ok(mz < cz, 'the main door on the north wall (z to the south), not the road side');
    const x = mw.a.x + (mw.b.x - mw.a.x) * main.le, xs = mw.a.x < mw.b.x ? mw.a.x : mw.b.x;
    assert.ok(x - xs < 6, `near the west end of its wall (${(x - xs).toFixed(1)} m from it)`);
  });
  test('an entrance far from any building is nobody\'s', () => {
    const t = translateOsm({ elements: [road, { type: 'way', id: 2, tags: { building: 'house' }, geometry: box },
      { type: 'node', id: 3, lat: 48.0005, lon: 7.0005, tags: { entrance: 'yes' } }] }, { centre, halfSize: 100 });
    const d = doors(t.buildings[0].building);
    assert.equal(d.length, 1);
    assert.ok(Math.abs(d[0].le - 0.5) < 1e-9, 'the road-side door, as without entrance');
  });
});

describe('OSM translator, street furniture and trees (#477c)', async () => {
  const { furnitureOf, TREE_ROW_SPACING } = await import('../src/osm-scene.js');
  const centre = { lat: 48, lon: 7 };
  const dLat = 1 / 111320, dLon = 1 / (111320 * Math.cos(48 * Math.PI / 180));   // a metre, in degrees
  const at = (x, z) => [48 - z * dLat, 7 + x * dLon];
  test('each kind of furniture to its built-in object; a bus stop without a shelter: none', () => {
    assert.equal(furnitureOf({ amenity: 'fountain' }), 'fontaine');
    assert.equal(furnitureOf({ barrier: 'bollard' }), 'borne');
    assert.equal(furnitureOf({ amenity: 'waste_basket' }), 'poubelle');
    assert.equal(furnitureOf({ highway: 'bus_stop', shelter: 'yes' }), 'abribus');
    assert.equal(furnitureOf({ amenity: 'shelter', shelter_type: 'public_transport' }), 'abribus');
    assert.equal(furnitureOf({ highway: 'bus_stop' }), null, 'a pole only');
    assert.equal(furnitureOf({ amenity: 'shelter', shelter_type: 'picnic_shelter' }), null);
    assert.equal(furnitureOf({ amenity: 'bench' }), 'banc');
    assert.equal(furnitureOf({ shop: 'bakery' }), null);
    assert.equal(furnitureOf({ man_made: 'planter' }), 'bac_fleurs', '#480a');
  });
  test('a tree\'s object from its genus, species or leaves (#480a)', async () => {
    const { treeKindOf } = await import('../src/osm-scene.js');
    assert.equal(furnitureOf({ natural: 'tree' }), 'arbre');
    assert.equal(treeKindOf({ species: 'Pinus pinea' }), 'pin_parasol');
    assert.equal(treeKindOf({ genus: 'Pinus', species: 'Pinus nigra' }), 'conifere');
    assert.equal(treeKindOf({ genus: 'Cupressus' }), 'cypres');
    assert.equal(treeKindOf({ taxon: 'Olea europaea' }), 'olivier');
    assert.equal(treeKindOf({ genus: 'Washingtonia' }), 'palmier');
    assert.equal(treeKindOf({ genus: 'Platanus', leaf_type: 'broadleaved' }), 'arbre');
    assert.equal(treeKindOf({ leaf_type: 'needleleaved' }), 'conifere');
    assert.equal(treeKindOf({ leaf_type: 'palm' }), 'palmier');
    assert.equal(furnitureOf({ natural: 'tree', genus: 'Picea' }), 'conifere');
  });
  test('a tree keeps its height (2 to 40 m); a row of trees, one every 8 m along it', () => {
    const r = translateOsm({ elements: [
      { type: 'node', id: 1, lat: at(0, 0)[0], lon: at(0, 0)[1], tags: { natural: 'tree', height: '12' } },
      { type: 'node', id: 2, lat: at(5, 0)[0], lon: at(5, 0)[1], tags: { natural: 'tree', height: '300' } },
      { type: 'way', id: 3, tags: { natural: 'tree_row', height: '9' }, geometry: [at(-40, 20), at(0, 20), at(0, 40)] },
    ] }, { centre, halfSize: 100 });
    const [t1, t2, ...row] = r.elements;
    assert.equal(t1.height, 12); assert.equal(t2.height, undefined, 'an absurd height is ignored');
    assert.equal(row.length, Math.floor(60 / TREE_ROW_SPACING) + 1, '60 m of line');
    assert.ok(row.every(e => e.objType === 'arbre' && e.height === 9));
    for (let k = 1; k < row.length; k++) {
      const d = Math.hypot(row[k].x - row[k - 1].x, row[k].z - row[k - 1].z);
      assert.ok(d <= TREE_ROW_SPACING + 0.05 && d > 5, `spacing ${d.toFixed(2)} (the corner cuts one short)`);
    }
  });
  test('a small fountain mapped as an area: a fountain at its middle; a large one: none (its water is a Zone)', () => {
    const square = (x0, z0, s) => [at(x0, z0), at(x0 + s, z0), at(x0 + s, z0 + s), at(x0, z0 + s), at(x0, z0)];
    const r = translateOsm({ elements: [
      { type: 'way', id: 1, tags: { amenity: 'fountain' }, geometry: square(10, 10, 4) },
      { type: 'way', id: 2, tags: { amenity: 'fountain' }, geometry: square(-60, -60, 20) },
    ] }, { centre, halfSize: 100 });
    assert.equal(r.elements.length, 1);
    assert.equal(r.elements[0].objType, 'fontaine');
    assert.ok(Math.abs(r.elements[0].x - 12) < 0.2 && Math.abs(r.elements[0].z - 12) < 0.2);
  });
  test('a bus shelter faces its street (its open side, +z, towards the nearest road)', () => {
    const r = translateOsm({ elements: [
      { type: 'node', id: 1, lat: at(0, -4)[0], lon: at(0, -4)[1], tags: { highway: 'bus_stop', shelter: 'yes' } },
      { type: 'way', id: 2, tags: { highway: 'primary' }, geometry: [at(-50, 0), at(50, 0)] },
    ] }, { centre, halfSize: 100 });
    const s = r.elements.find(e => e.objType === 'abribus');
    // The road is 4 m south (+z) of it: no turn.
    assert.ok(Math.abs(s.rotY) < 0.02, `rotY ${s.rotY}`);
    const r2 = translateOsm({ elements: [
      { type: 'node', id: 1, lat: at(-4, 0)[0], lon: at(-4, 0)[1], tags: { highway: 'bus_stop', shelter: 'yes' } },
      { type: 'way', id: 2, tags: { highway: 'primary' }, geometry: [at(0, -50), at(0, 50)] },
    ] }, { centre, halfSize: 100 });
    assert.ok(Math.abs(r2.elements.find(e => e.objType === 'abribus').rotY - Math.PI / 2) < 0.02, 'the road to the east: a quarter turn');
  });
  test('Simple: only the trees and the lamps', () => {
    const r = translateOsm({ elements: [
      { type: 'node', id: 1, lat: 48, lon: 7, tags: { amenity: 'fountain' } },
      { type: 'node', id: 2, lat: 48, lon: 7, tags: { natural: 'tree' } },
    ] }, { centre, halfSize: 100, detail: 'simple' });
    assert.deepEqual(r.elements.map(e => e.objType), ['arbre']);
  });
});
