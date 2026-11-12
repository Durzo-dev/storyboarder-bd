/**
 * tests/facade-style.test.mjs: the facades of a real place at the « Realistic » level (src/facade-style.js,
 * src/osm-scene.js) and their drawing (src/batiment-3d.js): shutters and surrounds on the OUTSIDE face.
 * Extract: Eguisheim (tests/fixtures/osm-eguisheim.json, © OpenStreetMap contributors, ODbL).
 */
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../node_modules/three/build/three.module.js';
import { facadeStyleOf, regionOf } from '../src/facade-style.js';
import { translateOsm } from '../src/osm-scene.js';
import { creerBatiment } from '../src/batiment.js';
import { ajouterMur } from '../src/batiment-trace.js';
import { actualiserPieces } from '../src/batiment-pieces.js';
import { ajouterOuverture } from '../src/batiment-ouvertures.js';
import { construireBatiment3D, materiauxBatiment3D } from '../src/batiment-3d.js';

describe('the facade of a building, by type, height and region', () => {
  test('regions: Alsace, the South, elsewhere', () => {
    assert.equal(regionOf(48.04, 7.3), 'alsace');
    assert.equal(regionOf(43.61, 3.88), 'south');
    assert.equal(regionOf(48.86, 2.31), 'north');
  });
  test('a house has shutters and a surround; a tall block no shutters; a church neither', () => {
    const house = facadeStyleOf({ type: 'house', levels: 2, lat: 48.04, lon: 7.3, seed: 12 });
    assert.equal(house.shutters, true);
    assert.match(house.shutterColour, /^#[0-9a-f]{6}$/);
    assert.equal(house.surround, '#b9877a', 'Alsace: pink sandstone');
    assert.equal(facadeStyleOf({ type: 'apartments', levels: 7 }).shutters, false);
    const church = facadeStyleOf({ type: 'church', levels: 3 });
    assert.equal(church.shutters, false);
    assert.equal(church.surround, null);
  });
  test('the same building, the same colour at every import', () => {
    assert.equal(facadeStyleOf({ type: 'house', seed: 'w42', lat: 43.6, lon: 3.9 }).shutterColour,
      facadeStyleOf({ type: 'house', seed: 'w42', lat: 43.6, lon: 3.9 }).shutterColour);
  });
});

describe('the realistic level, in the translation', () => {
  const v = JSON.parse(readFileSync(new URL('./fixtures/osm-eguisheim.json', import.meta.url), 'utf8'));
  const centre = { lat: (v.bbox.sud + v.bbox.nord) / 2, lon: (v.bbox.ouest + v.bbox.est) / 2 };
  test('windows with shutters and surrounds; none at the detailed level', () => {
    const realistic = translateOsm(v, { centre, halfSize: 100, detail: 'realistic' }).buildings;
    const detailed = translateOsm(v, { centre, halfSize: 100 }).buildings;
    const count = (bs, f) => bs.reduce((s, b) => s + b.building.ouvertures.filter(f).length, 0);
    assert.ok(count(realistic, o => o.volets) > 100);
    assert.ok(count(realistic, o => o.encadrement) > 100);
    assert.equal(count(detailed, o => o.volets || o.encadrement), 0);
    const church = realistic.find(b => /Église/.test(b.building.nom));
    assert.equal(church.building.ouvertures.filter(o => o.volets).length, 0, 'a church has no shutters');
  });
  test('a shop inside a building: shop windows on its street side', () => {
    const data = { elements: [
      { type: 'way', id: 1, tags: { highway: 'residential' }, geometry: [[48, 7], [48, 7.001]] },
      { type: 'way', id: 2, tags: { building: 'yes' }, geometry: [[48.00005, 7.0003], [48.00005, 7.0005], [48.00015, 7.0005], [48.00015, 7.0003], [48.00005, 7.0003]] },
      { type: 'node', id: 3, lat: 48.0001, lon: 7.0004, tags: { shop: 'bakery' } },
    ] };
    const b = translateOsm(data, { centre: { lat: 48, lon: 7.0005 }, halfSize: 100, detail: 'realistic' }).buildings[0].building;
    assert.ok(b.ouvertures.some(o => o.type === 'baie' && o.y === 0), 'a shop window');
  });
});

describe('the shutters are drawn outside', () => {
  test('a room of 4 × 3 m, a window on its south wall: its shutters stand south of the wall', () => {
    const b = creerBatiment('Essai');
    const pts = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }];
    for (let i = 0; i < 4; i++) ajouterMur(b, 'n0', pts[i], pts[(i + 1) % 4], 0.2);
    actualiserPieces(b, 'n0', (en, fr) => fr);
    const sud = b.murs.find(m => m.a.z === 3 && m.b.z === 3);
    ajouterOuverture(b, sud.id, 0.5, { type: 'fenetre', largeur: 1, hauteur: 1.3, y: 0.9, volets: true, couleurVolets: '#123456' });
    const g = construireBatiment3D(THREE, b, materiauxBatiment3D(THREE));
    g.updateMatrixWorld(true);
    const z = [];
    g.traverse(o => { if (o.isMesh && o.material.color && o.material.color.getHexString() === '123456') z.push(new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).z); });
    assert.equal(z.length, 2, 'two shutters');
    assert.ok(z.every(v => v > 3.1), `outside the room (z > 3.1): ${z.map(v => v.toFixed(2))}`);
    // And on the north wall, drawn the other way round: north of it.
    const nord = b.murs.find(m => m.a.z === 0 && m.b.z === 0);
    ajouterOuverture(b, nord.id, 0.5, { type: 'fenetre', largeur: 1, hauteur: 1.3, y: 0.9, volets: true, couleurVolets: '#654321' });
    const g2 = construireBatiment3D(THREE, b, materiauxBatiment3D(THREE));
    g2.updateMatrixWorld(true);
    const zn = [];
    g2.traverse(o => { if (o.isMesh && o.material.color && o.material.color.getHexString() === '654321') zn.push(new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).z); });
    assert.ok(zn.length === 2 && zn.every(v => v < -0.1), `north of the north wall: ${zn.map(v => v.toFixed(2))}`);
  });
});
