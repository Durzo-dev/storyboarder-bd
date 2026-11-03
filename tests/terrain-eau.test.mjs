/**
 * #462d, l'eau : la rivière (un Tracé qui creuse son lit et se remplit d'eau) et la Zone d'eau (lac,
 * mer : une nappe plate à son niveau). Le creusement est PUR (terrain-relief.js) ; le rendu réutilise
 * la matière d'eau du Sol.
 */
import './helpers/dom-stub.mjs';
import './helpers/render-stub.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from '../src/terrain-relief.js';
import { S } from '../src/state.js';
import * as U from '../src/terrain-editeur-ui.js';

const lire = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('le lit : plein au milieu, moitié au bord, nul en haut de la berge', () => {
  assert.equal(R.creuxDuLit(0, 4, 1.2), 1.2);
  assert.ok(Math.abs(R.creuxDuLit(2, 4, 1.2) - 0.6) < 1e-9);
  assert.equal(R.creuxDuLit(3.5, 4, 1.2), 0);
});

test('une rivière creuse une Scène plate (le relief est créé), sans toucher le reste', () => {
  const r = R.creuserLesRivieres(null, [{ pts: [{ x: -10, z: 0 }, { x: 10, z: 0 }], largeur: 4, profondeur: 1.2 }]);
  assert.ok(R.reliefValide(r));
  assert.ok(Math.abs(R.hauteurDuRelief(r, 0, 0) + 1.2) < 1e-9, 'le fond du lit');
  assert.equal(R.hauteurDuRelief(r, 0, 6), 0, 'loin de la rivière : le Sol');
  // Sur un relief, le lit est creusé DANS la colline.
  let colline = null;
  for (let k = 0; k < 4; k++) colline = R.peindreLeRelief(colline, { x: 0, z: 0 }, { mode: 'monter', rayon: 8, force: 1 });
  const c = R.creuserLesRivieres(colline, [{ pts: [{ x: -10, z: 0 }, { x: 10, z: 0 }], largeur: 4, profondeur: 1.2 }]);
  assert.ok(Math.abs(R.hauteurDuRelief(c, 0, 0) - (R.hauteurDuRelief(colline, 0, 0) - 1.2)) < 1e-6);
  assert.equal(R.creuserLesRivieres(colline, []), colline);
});

test('l\'éditeur pose une rivière (Tracés) ; une Zone à la texture Eau a son niveau ; réglables', () => {
  globalThis.requestAnimationFrame = (f) => { f(); return 0; };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  const panel = { id: 'p', type: 'panel', x: 0, y: 0, w: 480, h: 360, camRotX: Math.PI / 2, pts: [] };
  S.scenes = [{ id: 's1', name: 'Scène 1', w: 480, h: 360, pages: [{ objects: [panel] }] }];
  S.editingSceneId = 's1';
  U.setTerrainEditeurCallbacks({ instantane: () => {}, ouvrirLaScene: () => {}, apresModification: () => {}, confirmer: async () => true });
  U.initEditeurDeTerrain();
  U.ouvrirEditeurDeTerrain('s1');
  const plan = document.getElementById('terrainPlan');
  const jouer = (type, ev) => (plan._ecouteurs[type] || []).forEach(f => f({ preventDefault(){}, stopPropagation(){}, pointerId: 1, detail: 1, ...ev, type }));
  const px = (x, z) => ({ clientX: 400 + x * 22.8, clientY: 300 + z * 22.8 });
  const objets = S.scenes[0].pages[0].objects;
  // La rivière.
  document.getElementById('terrainOutilTrace').onclick();
  document.getElementById('terrainSortesTrace').children.find(b => b.dataset.valeur === 'riviere').onclick();
  jouer('pointerdown', { button: 0, ...px(-5, 0) });
  jouer('pointerdown', { button: 0, ...px(5, 0) });
  jouer('dblclick', {});
  const riv = objets.find(o => o.tracéType === 'riviere');
  assert.ok(riv);
  assert.equal(riv.world.width, 4);
  assert.equal(riv.profondeur, R.PROFONDEUR_RIVIERE);
  // Ses réglages : largeur, profondeur.
  const curseurs = document.getElementById('terrainChoisiReglages').children.filter(c => c.type === 'range');
  assert.deepEqual(curseurs.map(c => c.dataset.cle), ['largeur', 'profondeur']);
  curseurs[1].value = '2.5'; curseurs[1].oninput();
  assert.equal(riv.profondeur, 2.5);
  // La Zone d'eau : une Zone (rectangle), dont on choisit la texture Eau (« Régler » ; simulé ici).
  document.getElementById('terrainOutilZone').onclick();
  jouer('pointerdown', { button: 0, ...px(-3, 3) });
  jouer('pointermove', px(3, 6));
  jouer('pointerup', px(3, 6));
  const lac = objets.find(o => o.tracéType === 'terrain');
  assert.ok(lac);
  lac.terrainType = 'eau';
  U.rafraichirEditeurDeTerrain();
  const niveau = document.getElementById('terrainChoisiReglages').children.find(c => c.dataset && c.dataset.cle === 'niveau');
  niveau.value = '-1'; niveau.oninput();
  assert.equal(lac.niveauEau, -1);
  document.getElementById('terrainValiderBtn').onclick();
});

test('le rendu : la rivière coule sous la berge, le lac à son niveau ; ni l\'une ni l\'autre ne projette', async () => {
  const SC = await import('../src/scene3d.js');
  const RIG = await import('../src/rig3d.js');
  const panel = { id: 'pe', type: 'panel', x: 0, y: 0, w: 480, h: 360, camRotX: 0.6, camDist: 30, pts: [] };
  const riv = { id: 're', type: 'tracé', tracéType: 'riviere', panelId: 'pe', profondeur: 1.2, world: { pts: [{ x: -8, z: 0 }, { x: 8, z: 0 }], width: 4 } };
  const lac = { id: 'le', type: 'tracé', tracéType: 'terrain', terrainType: 'eau', niveauEau: -0.8, panelId: 'pe',
    world: { cx: 0, cz: 20, w: 6, h: 6, rotY: 0, corners: [{ x: -3, z: 17 }, { x: 3, z: 17 }, { x: 3, z: 23 }, { x: -3, z: 23 }] } };
  SC.rendreSceneVueLibre3D(panel, { w: 480, h: 360, objects: [panel, riv, lac] }, { rotX: 0.6, rotY: 0, dist: 30, x: 0, y: 0, z: 0 }, 0.5);
  const eaux = [];
  RIG.personaScene3D.updateMatrixWorld(true);
  RIG.personaScene3D.traverseVisible(o => { if (o.isMesh && o.material && o.material.customProgramCacheKey && /eau/.test(o.material.customProgramCacheKey()) && o.material !== RIG.groundMesh3D.material) eaux.push(o); });
  assert.equal(eaux.length, 2, 'la rivière et le lac');
  const yMonde = (m) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld).max.y; };
  const yRiv = yMonde(eaux.find(m => m.geometry.type !== 'PlaneGeometry'));
  const yLac = yMonde(eaux.find(m => m.geometry.type === 'PlaneGeometry'));
  assert.ok(Math.abs(yRiv - (-3 - R.EAU_SOUS_LA_BERGE)) < 1e-6, `rivière : ${yRiv}`);
  assert.ok(Math.abs(yLac - (-3 - 0.8)) < 1e-6, `lac : ${yLac}`);
  RIG.marquerProjectionDOmbre3D();
  assert.ok(eaux.every(m => m.castShadow === false));
  assert.match(lire('scene3d.js'), /const r = creuserLesRivieres\(releverLesZones\(panel && panel\.relief, zones\), rivieres\);/);
});
