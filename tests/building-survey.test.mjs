/**
 * tests/building-survey.test.mjs: the IGN BD TOPO read and matched to OpenStreetMap (src/building-survey.js,
 * src/osm-scene.js). Fixtures: Eguisheim's old town, the same zone in both (tests/fixtures/osm-eguisheim.json,
 * © OpenStreetMap contributors, ODbL; tests/fixtures/bdtopo-eguisheim.json, © IGN BD TOPO®, Etalab 2.0,
 * a real WFS answer of 12 Nov. 2026 reduced to the properties read).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { readBdTopo, matchSurvey, surveyedRoof, wallFinishOf, roofFinishOf, buildingTypeOf, BDTOPO_ATTRIBUTION } from '../src/building-survey.js';
import { translateOsm, levelsOf } from '../src/osm-scene.js';
import { sceneContentOf } from '../src/real-place-import.js';

const osm = JSON.parse(readFileSync(new URL('./fixtures/osm-eguisheim.json', import.meta.url), 'utf8'));
const bd = JSON.parse(readFileSync(new URL('./fixtures/bdtopo-eguisheim.json', import.meta.url), 'utf8'));
const centre = { lat: (osm.bbox.sud + osm.bbox.nord) / 2, lon: (osm.bbox.ouest + osm.bbox.est) / 2 };
const survey = readBdTopo(bd, centre);
const square = (x, z, w, d = w) => [{ x, z }, { x: x + w, z }, { x: x + w, z: z + d }, { x, z: z + d }];

describe('BD TOPO, read', () => {
  test('every feature with a footprint of 1 m² or more, in local metres, with its measures', () => {
    assert.equal(survey.length, 78, 'of 84: six slivers under 1 m² left out');
    assert.ok(survey.every(s => s.footprint.length >= 3 && s.area > 1 && Number.isFinite(s.centre.x)));
    assert.ok(survey.every(s => Math.abs(s.centre.x) < 120 && Math.abs(s.centre.z) < 120), 'around the centre');
    assert.ok(survey.filter(s => s.eaves > 0).length / survey.length > 0.85, 'the eaves height, nearly always');
    assert.ok(survey.filter(s => s.roofRise !== null).length > 60);
    const s0 = survey[0], first = bd.features.find(f => String(f.id) === s0.id).properties;
    assert.equal(s0.eaves, first.hauteur);
    assert.ok(Math.abs(s0.roofRise - (first.altitude_maximale_toit - first.altitude_minimale_toit)) < 1e-9);
  });
  test('material codes: each digit a material, 0 or empty unknown', () => {
    const s = readBdTopo({ features: [{ id: 'a', geometry: { type: 'Polygon', coordinates: [[[7.3, 48], [7.3001, 48], [7.3001, 48.0001], [7.3, 48.0001], [7.3, 48]]] },
      properties: { materiaux_des_murs: '16', materiaux_de_la_toiture: '00' } }] }, { lat: 48, lon: 7.3 });
    assert.deepEqual(s[0].walls, [1, 6]);
    assert.deepEqual(s[0].roof, []);
    assert.deepEqual(readBdTopo({ features: [{ geometry: null }] }, centre), [], 'no footprint: left out');
    assert.deepEqual(readBdTopo(null, centre), []);
  });
});

describe('BD TOPO, matched to OSM', () => {
  const plain = translateOsm(osm, { centre, halfSize: 100 });
  const surveyed = translateOsm(osm, { centre, halfSize: 100, survey });
  test('nearly every OSM building finds its surveyed twin; the survey\'s missing ones are added', () => {
    const matched = surveyed.buildings.filter(b => b.osmId && b.surveyId);
    assert.ok(matched.length >= 0.9 * plain.buildings.length, `${matched.length} of ${plain.buildings.length}`);
    assert.equal(new Set(matched.map(b => b.surveyId)).size, matched.length, 'one surveyed building per OSM building');
    const added = surveyed.buildings.filter(b => !b.osmId);
    assert.ok(added.every(b => b.surveyId && b.building.niveaux.length >= 1));
    assert.equal(surveyed.surveyAttribution, BDTOPO_ATTRIBUTION);
    assert.equal(plain.surveyAttribution, undefined, 'no survey, no credit');
  });
  test('the credit follows into the Scene\'s credits', () => {
    const c = sceneContentOf(surveyed, { panelId: 'P', newId: () => 'x' });
    assert.ok(c.credits.includes(BDTOPO_ATTRIBUTION));
  });
  test('a surveyed building takes its materials: stone walls, flat tiles', () => {
    const stone = surveyed.buildings.filter(b => b.building.facade && b.building.facade.texture === 'int:trace:muret');
    assert.ok(stone.length >= 3);
    const tiles = surveyed.buildings.filter(b => b.building.niveaux.some(n => n.toit && n.toit.revetement && n.toit.revetement.texture === 'int:toit:tuiles-plates'));
    assert.ok(tiles.length >= 10);
    assert.ok(plain.buildings.every(b => !b.building.facade), 'OSM alone says nothing of it here');
  });
  test('the area must compare: a shed is not the house it stands in', () => {
    const house = { id: 'h', footprint: square(0, 0, 10), area: 100, centre: { x: 5, z: 5 } };
    assert.equal(matchSurvey(square(4, 4, 2), [house]), null);
    assert.equal(matchSurvey(square(0.5, 0.5, 9), [house]), house);
    const taken = new Set(['h']);
    assert.equal(matchSurvey(square(0.5, 0.5, 9), [house], taken), null, 'taken already');
  });
});

describe('BD TOPO, what it decides', () => {
  test('levels from the eaves height when OSM gives neither levels nor height', () => {
    assert.deepEqual(levelsOf({ building: 'house' }, undefined, { eaves: 5.7 }), { count: 2, height: 2.85 });
    assert.deepEqual(levelsOf({ building: 'house' }, undefined, { eaves: 1.4 }), { count: 1, height: 2 }, 'a shed: one level, the least height');
    assert.equal(levelsOf({ building: 'house', 'building:levels': '3' }, undefined, { eaves: 5.7 }).count, 3, 'OSM first');
  });
  test('the roof: flat under 0.5 m, else its pitch over half the narrow width', () => {
    assert.deepEqual(surveyedRoof({ roofRise: 0.3 }, square(0, 0, 8, 12)), { flat: true });
    assert.deepEqual(surveyedRoof({ roofRise: 4 }, square(0, 0, 8, 12)), { flat: false, pitch: 45 });
    assert.deepEqual(surveyedRoof({ roofRise: 40 }, square(0, 0, 8, 12)), { flat: false, pitch: 60 }, 'bounded');
    assert.equal(surveyedRoof({ roofRise: null }, square(0, 0, 8)), null);
    assert.equal(surveyedRoof(null, square(0, 0, 8)), null);
  });
  test('materials: OSM first, then the survey; mixed or rendered walls keep the plain render', () => {
    assert.deepEqual(wallFinishOf({}, { walls: [1] }), { texture: 'int:trace:muret', couleur: '#d9ccb0' }, 'dressed stone: the stone grain, pale');
    assert.deepEqual(wallFinishOf({}, { walls: [6] }), { texture: 'int:trace:cloture', couleur: null });
    assert.equal(wallFinishOf({}, { walls: [1, 6] }), null, 'half-timbered: its facade is for later');
    assert.equal(wallFinishOf({}, { walls: [3, 4] }), null);
    assert.deepEqual(wallFinishOf({ 'building:colour': 'yellow' }, { walls: [1] }), { texture: null, couleur: '#e2c46a' });
    assert.deepEqual(roofFinishOf({}, { roof: [1] }), { texture: 'int:toit:tuiles-plates', couleur: null });
    assert.deepEqual(roofFinishOf({}, { roof: [1], south: true }), { texture: 'int:toit:tuiles-canal', couleur: null }, 'the south: barrel tiles');
    assert.equal(readBdTopo(bd, { lat: 43.61, lon: 3.877 })[0].south, true, 'Montpellier is in the south');
    assert.equal(survey[0].south, false, 'Eguisheim is not');
    assert.deepEqual(roofFinishOf({}, { roof: [2] }), { texture: 'int:toit:ardoise', couleur: null });
    assert.deepEqual(roofFinishOf({ 'roof:material': 'slate' }, { roof: [1] }), { texture: 'int:toit:ardoise', couleur: null });
    assert.deepEqual(roofFinishOf({ 'roof:colour': '#AA3322' }, null), { texture: null, couleur: '#aa3322' });
    assert.equal(roofFinishOf({}, { roof: [] }), null);
  });
  test('a building only the survey knows takes its type from its use', () => {
    assert.equal(buildingTypeOf({ use: 'Religieux' }), 'church');
    assert.equal(buildingTypeOf({ use: 'Indifférencié', light: true }), 'shed');
    assert.equal(buildingTypeOf({ use: 'Indifférencié' }), 'yes');
  });
  test('the main process asks the WFS for the zone and only the properties read', async () => {
    const net = readFileSync(new URL('../electron/bibliotheque/real-place.js', import.meta.url), 'utf8');
    for (const k of ['hauteur', 'altitude_minimale_toit', 'altitude_maximale_toit', 'usage_1', 'materiaux_des_murs', 'materiaux_de_la_toiture', 'construction_legere']) {
      assert.match(net, new RegExp(`'${k}'`));
    }
    assert.match(net, /TYPENAMES=BDTOPO_V3:batiment/);
  });
});
