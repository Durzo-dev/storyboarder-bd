/**
 * #462b-1 : les gestes de l'Éditeur de terrain, joués sur ses écouteurs (stub de DOM) : tracer une
 * Zone, une route, la choisir, la déplacer, la supprimer ; l'annulation est demandée avant chaque
 * modification.
 */
import './helpers/dom-stub.mjs';
import './helpers/render-stub.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../src/state.js';
import * as U from '../src/terrain-editeur-ui.js';

globalThis.requestAnimationFrame = (f) => { f(); return 0; };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });

const jouer = (el, type, ev) => (el._ecouteurs[type] || []).forEach(f => f({ preventDefault(){}, stopPropagation(){}, pointerId: 1, detail: 1, ...ev, type }));
// Le plan fait 800 × 600 (repli sans mise en page) ; vide, il est centré sur l'origine à 22,8 px/m.
const px = (x, z) => ({ clientX: 400 + x * 22.8, clientY: 300 + z * 22.8 });

test('tracer une Zone, une route ; choisir, déplacer, supprimer ; un instantané avant chaque modification', () => {
  S.scenes = [{ id: 's1', name: 'Scène 1', w: 480, h: 360, pages: [{ objects: [{ id: 'p', type: 'panel', x: 0, y: 0, w: 480, h: 360, camRotX: Math.PI / 2,
    pts: [{ x: 0, y: 0 }, { x: 480, y: 0 }, { x: 480, y: 360 }, { x: 0, y: 360 }] }] }] }];
  S.editingSceneId = 's1';
  let instantanes = 0;
  U.setTerrainEditeurCallbacks({ instantane: () => { instantanes++; }, ouvrirLaScene: () => {}, apresModification: () => {} });
  U.initEditeurDeTerrain();
  assert.ok(U.ouvrirEditeurDeTerrain('s1'));
  const plan = document.getElementById('terrainPlan');
  const objets = S.scenes[0].pages[0].objects;

  // La Zone : outil Zone, glisser de (0, 0) à (4, 3).
  document.getElementById('terrainOutilZone').onclick();
  jouer(plan, 'pointerdown', { button: 0, ...px(0, 0) });
  jouer(plan, 'pointermove', px(4, 3));
  jouer(plan, 'pointerup', px(4, 3));
  const zone = objets.find(o => o.tracéType === 'terrain');
  assert.ok(zone, 'la Zone est posée');
  assert.ok(Math.abs(zone.world.w - 4) < 1e-6 && Math.abs(zone.world.h - 3) < 1e-6);
  assert.equal(zone.panelId, 'p');
  assert.equal(instantanes, 1);

  // La route : outil Tracés, deux clics puis Entrée (le clavier est sur window).
  document.getElementById('terrainOutilTrace').onclick();
  jouer(plan, 'pointerdown', { button: 0, ...px(-5, 6) });
  jouer(plan, 'pointerdown', { button: 0, ...px(5, 6) });
  jouer(plan, 'dblclick', {});
  const route = objets.find(o => o.tracéType === 'route');
  assert.ok(route, 'la route est posée');
  assert.equal(route.world.pts.length, 2);
  assert.equal(route.world.width, 5);
  assert.equal(instantanes, 2);

  // Sélection : clic sur la route, glisser d'un mètre vers la droite.
  document.getElementById('terrainOutilSelection').onclick();
  jouer(plan, 'pointerdown', { button: 0, ...px(0, 6) });
  jouer(plan, 'pointermove', px(1, 6));
  jouer(plan, 'pointerup', px(1, 6));
  assert.ok(Math.abs(route.world.pts[0].x - -4) < 1e-6, JSON.stringify(route.world.pts));
  assert.equal(instantanes, 3);

  // Supprimer la Zone choisie.
  jouer(plan, 'pointerdown', { button: 0, ...px(2, 1) });
  jouer(plan, 'pointerup', px(2, 1));
  document.getElementById('terrainSupprimerBtn').onclick();
  assert.ok(!objets.includes(zone));
  assert.equal(instantanes, 4);
  U.fermerEditeurDeTerrain();
});
