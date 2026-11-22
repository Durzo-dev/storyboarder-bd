/**
 * tests/realistic-textures.test.mjs: the textures a real place wears. Detailed: the bundled ones, decided by the
 * import (src/osm-scene.js, src/building-survey.js) and found by the renderers (src/textures-utilisateur.js,
 * src/textures-integrees.js); Realistic: the stores' in their place (src/realistic-textures.js).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { REALISTIC_TEXTURES, realisticTextureOf, realisticNeeds, applyRealisticTextures, pathSlot } from '../src/realistic-textures.js';
import { pathTextureOf, zoneTypeOf, translateOsm } from '../src/osm-scene.js';
import { BRICK_TINT } from '../src/building-survey.js';
import { texturesIntegrees, valeurChoisie, textureDeLaValeur, FACADES_LIVREES } from '../src/textures-integrees.js';
import { textureDuTrace } from '../src/textures-utilisateur.js';
import { pathObject } from '../src/real-place-import.js';
import { TRACÉ_TEXTURES, GROUND_TYPE_DEFS } from '../src/constants.js';

describe('Detailed: the bundled textures the import lays', () => {
  test('a Path in cobbles, a gravel path, a low wall of stone unless OSM says another material', () => {
    assert.equal(pathTextureOf('route', { surface: 'sett' }), 'int:sol:paves');
    assert.equal(pathTextureOf('chemin', { surface: 'cobblestone' }), 'int:sol:paves');
    assert.equal(pathTextureOf('chemin', { surface: 'gravel' }), 'int:sol:gravier');
    assert.equal(pathTextureOf('route', { surface: 'gravel' }), null, 'no gravel on a road: no texture of ours serves it');
    assert.equal(pathTextureOf('route', { surface: 'asphalt' }), null, 'asphalt: the road\'s own');
    assert.equal(pathTextureOf('route', {}), null);
    assert.equal(pathTextureOf('muret', {}), 'int:facade:pierre');
    assert.equal(pathTextureOf('muret', { wall: 'dry_stone' }), 'int:facade:pierre');
    assert.equal(pathTextureOf('muret', { 'wall:material': 'brick' }), null, 'brick: the low wall\'s bricks');
    assert.equal(pathTextureOf('muret', { material: 'concrete' }), null);
    assert.equal(pathTextureOf('cloture', { surface: 'sett' }), null);
  });
  test('a Zone in cobbles is cobbled; a pedestrian square with no surface stays paved', () => {
    assert.equal(zoneTypeOf({ highway: 'pedestrian', area: 'yes', surface: 'paving_stones' }), 'paves');
    assert.equal(zoneTypeOf({ amenity: 'parking', surface: 'sett' }), 'paves');
    assert.equal(zoneTypeOf({ highway: 'pedestrian', area: 'yes' }), 'béton');
    assert.equal(zoneTypeOf({ amenity: 'parking' }), 'bitume');
  });
  const way = (id, tags, pts) => ({ type: 'way', id, tags, geometry: pts.map(([lat, lon]) => ({ lat, lon })) });
  const square = [[43.6100, 3.8770], [43.6100, 3.8772], [43.6102, 3.8772], [43.6102, 3.8770], [43.6100, 3.8770]];
  const data = { elements: [
    way(1, { highway: 'pedestrian', area: 'yes', surface: 'sett' }, square),
    way(2, { highway: 'residential', surface: 'sett' }, [[43.6099, 3.8768], [43.6099, 3.8775]]),
    way(3, { barrier: 'wall' }, [[43.6104, 3.8768], [43.6104, 3.8775]]),
  ] };
  const centre = { lat: 43.6101, lon: 3.8771 };
  test('translated: Detailed lays them, Simple keeps the plain grounds and Paths of before', () => {
    const d = translateOsm(data, { centre, halfSize: 100, detail: 'detailed' });
    assert.equal(d.zones[0].terrainType, 'paves');
    assert.deepEqual(d.paths.map(p => [p.kind, p.traceTexture]), [['route', 'int:sol:paves'], ['muret', 'int:facade:pierre']]);
    const s = translateOsm(data, { centre, halfSize: 100, detail: 'simple' });
    assert.equal(s.zones[0].terrainType, 'béton');
    assert.ok(s.paths.every(p => !p.traceTexture));
    const o = pathObject(d.paths[0], { panelId: 'p', newId: () => 'x' });
    assert.equal(o.traceTexture, 'int:sol:paves', 'the Path object carries it');
    assert.equal(pathObject(s.paths[0], { panelId: 'p', newId: () => 'x' }).traceTexture, undefined);
  });
});

describe('the bundled textures, found where they are worn', () => {
  const all = texturesIntegrees();
  test('the facades: a render and a dressed stone, for the buildings; the stone for the low walls too', () => {
    assert.deepEqual(FACADES_LIVREES.map(f => f.id), ['enduit', 'pierre']);
    const pierre = all.find(t => t.id === 'facade:pierre');
    assert.equal(valeurChoisie(pierre, 'mur-ext'), 'int:facade:pierre');
    assert.equal(valeurChoisie(pierre, 'muret'), 'int:facade:pierre');
    assert.equal(valeurChoisie(all.find(t => t.id === 'facade:enduit'), 'muret'), 'int:facade:enduit', 'a rendered low wall (#495)');
    assert.equal(valeurChoisie(all.find(t => t.id === 'facade:enduit'), 'route'), undefined);
    assert.ok(GROUND_TYPE_DEFS.some(d => d.id === 'paves' && d.grain === 'paves.couleur'));
  });
  test('a Path wears a bundled texture of another kind by its id; its own original stays null', () => {
    assert.equal(valeurChoisie(all.find(t => t.id === 'sol:paves'), 'route'), 'int:sol:paves');
    assert.equal(valeurChoisie(all.find(t => t.id === 'sol:gravier'), 'chemin'), 'int:sol:gravier');
    assert.equal(valeurChoisie(all.find(t => t.id === 'sol:gravier'), 'route'), undefined);
    assert.equal(valeurChoisie(all.find(t => t.id === 'trace:route'), 'route'), null);
    assert.equal(textureDeLaValeur('int:sol:paves', 'chemin').id, 'sol:paves');
    assert.equal(textureDeLaValeur(null, 'chemin').id, 'trace:chemin');
  });
  test('the renderer finds it, with its tile; a texture that does not serve the kind gives the kind\'s own', () => {
    const paves = textureDuTrace('route', 'int:sol:paves');
    assert.equal(paves.grain, 'paves.couleur');
    assert.deepEqual(paves.tuile, [2, 2], 'the Ground\'s tile: 12000 / 6000');
    assert.equal(textureDuTrace('muret', 'int:facade:pierre').grain, 'facade-pierre.couleur');
    assert.deepEqual(textureDuTrace('muret', 'int:facade:pierre').tuile, [3, 3], 'its real size');
    assert.equal(textureDuTrace('route', 'int:sol:gravier'), TRACÉ_TEXTURES.route);
    assert.equal(textureDuTrace('chemin', 'int:sol:inconnue'), TRACÉ_TEXTURES.chemin);
    assert.equal(textureDuTrace('route', null), TRACÉ_TEXTURES.route);
  });
});

describe('Realistic: the stores\' textures in the bundled ones\' place', () => {
  test('the table: a Poly Haven id per region; the bundled sources need nothing', () => {
    assert.equal(realisticTextureOf('stone', { south: false }), 'medieval_blocks_03');
    assert.equal(realisticTextureOf('stone', { south: true }), null, 'sandstone_blocks_05 is the bundled stone');
    assert.equal(realisticTextureOf('render', { south: false }), null, 'white_stucco_02 is the bundled render');
    assert.equal(realisticTextureOf('render', { south: true }), 'painted_plaster_wall');
    assert.equal(realisticTextureOf('paving', { south: true }), null);
    assert.equal(realisticTextureOf('road', {}), 'asphalt_01');
    assert.throws(() => realisticTextureOf('marble', {}), /unknown slot/);
    assert.ok(Object.values(REALISTIC_TEXTURES).every(s => s.south && s.north && s.usages.length));
  });
  const place = () => ({
    buildings: [
      { building: { facade: { texture: 'int:facade:enduit', couleur: '#e2c46a' } } },
      { building: { facade: { texture: 'int:trace:muret', couleur: BRICK_TINT } } },
      { building: { facade: { texture: 'int:trace:muret', couleur: '#884433' } } },
      { building: { facade: { texture: 'int:trace:cloture', couleur: null } } },
      { building: {} },
    ],
    zones: [{ terrainType: 'paves' }, { terrainType: 'bitume', terrainColor: '#222222' }, { terrainType: 'herbe' }],
    paths: [{ kind: 'route' }, { kind: 'route', traceTexture: 'int:sol:paves' }, { kind: 'muret', traceTexture: 'int:facade:pierre' },
      { kind: 'muret' }, { kind: 'chemin' }, { kind: 'trottoir' }],
  });
  test('what a place needs: each slot it uses once, in the table\'s order, the bundled ones left out', () => {
    assert.deepEqual(realisticNeeds(place(), { south: true }).map(n => [n.slot, n.polyhaven]),
      [['render', 'painted_plaster_wall'], ['brick', 'red_bricks_04'], ['asphalt', 'clean_asphalt'], ['road', 'asphalt_01'], ['lowWall', 'rustic_stone_wall_02']]);
    assert.deepEqual(realisticNeeds(place(), { south: false }).map(n => n.slot), ['brick', 'asphalt', 'road', 'lowWall']);
    assert.deepEqual(realisticNeeds({}, {}), []);
    assert.deepEqual(realisticNeeds(place(), { south: true })[0].usages, ['mur-ext']);
  });
  test('laid: the render keeps its colour, the bricks lose their default tint only; nothing else is touched', () => {
    const p = place();
    const ids = { render: 'tex:r', brick: 'tex:b', asphalt: 'tex:a', road: 'tex:road', lowWall: 'tex:w', paving: 'tex:p' };
    assert.equal(applyRealisticTextures(p, ids), 8);
    assert.deepEqual(p.buildings.map(e => e.building.facade || null), [
      { texture: 'tex:r', couleur: '#e2c46a' }, { texture: 'tex:b', couleur: null }, { texture: 'tex:b', couleur: '#884433' },
      { texture: 'int:trace:cloture', couleur: null }, null]);
    assert.deepEqual(p.zones, [{ terrainType: 'tex:p' }, { terrainType: 'tex:a' }, { terrainType: 'herbe' }]);
    assert.deepEqual(p.paths.map(q => q.traceTexture || null), ['tex:road', 'tex:p', 'tex:w', null, null, null]);
    const q = place();
    assert.equal(applyRealisticTextures(q, {}), 0, 'nothing downloaded: the bundled ones stay');
    assert.deepEqual(q, place());
  });
  test('a Path\'s slot', () => {
    assert.equal(pathSlot({ kind: 'chemin', traceTexture: 'int:sol:gravier' }), 'gravel');
    assert.equal(pathSlot({ kind: 'chemin', traceTexture: 'int:sol:paves' }), 'paving');
    assert.equal(pathSlot({ kind: 'route', traceTexture: 'tex:x' }), null, 'a texture of the user\'s: left alone');
    assert.equal(pathSlot(null), null);
  });
});
