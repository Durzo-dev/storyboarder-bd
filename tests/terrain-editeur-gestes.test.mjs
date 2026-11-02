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
  U.setTerrainEditeurCallbacks({ instantane: () => { instantanes++; }, ouvrirLaScene: () => {}, apresModification: () => {}, confirmer: async () => true });
  const valider = document.getElementById('terrainValiderBtn');
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
  assert.equal(valider.disabled, false, 'une modification à valider');

  // La route : outil Tracés, deux clics puis Entrée (le clavier est sur window).
  document.getElementById('terrainOutilTrace').onclick();
  jouer(plan, 'pointerdown', { button: 0, ...px(-5, 6) });
  jouer(plan, 'pointerdown', { button: 0, ...px(5, 6) });
  jouer(plan, 'dblclick', {});
  const route = objets.find(o => o.tracéType === 'route');
  assert.ok(route, 'la route est posée');
  assert.equal(route.world.pts.length, 2);
  assert.equal(route.world.width, 5);

  // Sélection : clic sur la route, glisser d'un mètre vers la droite.
  document.getElementById('terrainOutilSelection').onclick();
  jouer(plan, 'pointerdown', { button: 0, ...px(0, 6) });
  jouer(plan, 'pointermove', px(1, 6));
  jouer(plan, 'pointerup', px(1, 6));
  assert.ok(Math.abs(route.world.pts[0].x - -4) < 1e-6, JSON.stringify(route.world.pts));

  // Supprimer la Zone choisie.
  jouer(plan, 'pointerdown', { button: 0, ...px(2, 1) });
  jouer(plan, 'pointerup', px(2, 1));
  document.getElementById('terrainSupprimerBtn').onclick();
  assert.ok(!objets.includes(zone));
  assert.equal(instantanes, 0, 'rien sur la Scène avant « Valider » : aucune annulation de l\'application');
  // Valider : UNE annulation de l'application, les modifications restent.
  valider.onclick();
  assert.equal(instantanes, 1);
  assert.ok(objets.some(o => o.tracéType === 'route'));
  assert.ok(!objets.some(o => o.tracéType === 'terrain'));
});

test('Quitter sans valider : demandé, puis la Scène revient à son état de départ ; Ctrl+Z annule dans l\'éditeur', async () => {
  const panel = { id: 'p', type: 'panel', x: 0, y: 0, w: 480, h: 360, camRotX: Math.PI / 2, pts: [] };
  const route = { id: 'r0', type: 'tracé', tracéType: 'route', panelId: 'p', world: { pts: [{ x: -5, z: 6 }, { x: 5, z: 6 }], width: 5 } };
  S.scenes = [{ id: 's1', name: 'Scène 1', w: 480, h: 360, pages: [{ objects: [panel, route] }] }];
  S.editingSceneId = 's1';
  let reponse = false, demandes = 0, instantanes = 0;
  U.setTerrainEditeurCallbacks({ instantane: () => { instantanes++; }, ouvrirLaScene: () => {}, apresModification: () => {},
    confirmer: async () => { demandes++; return reponse; } });
  U.initEditeurDeTerrain();
  U.ouvrirEditeurDeTerrain('s1');
  const objets = S.scenes[0].pages[0].objects;
  const plan = document.getElementById('terrainPlan');
  // Choisir la route (le plan est cadré sur elle : son milieu est au centre), la supprimer.
  jouer(plan, 'pointerdown', { button: 0, clientX: 400, clientY: 300 });
  jouer(plan, 'pointerup', { clientX: 400, clientY: 300 });
  document.getElementById('terrainSupprimerBtn').onclick();
  assert.ok(!objets.some(o => o.id === 'r0'));
  // Ctrl+Z (sur window) : la route revient ; Ctrl+Y : repartie.
  const clavier = (k, mod = {}) => (window._ecouteurs.keydown || []).forEach(f => f({ key: k, ctrlKey: true, target: {}, preventDefault(){}, stopPropagation(){}, ...mod }));
  const qs = document.querySelector;
  document.querySelector = () => null;   // aucune fenêtre ouverte par-dessus
  clavier('z');
  assert.ok(objets.some(o => o.id === 'r0'), 'Ctrl+Z de l\'éditeur');
  clavier('y');
  assert.ok(!objets.some(o => o.id === 'r0'), 'Ctrl+Y de l\'éditeur');
  document.querySelector = qs;
  // Quitter : la question ; refusée, l'éditeur reste.
  assert.equal(await U.fermerEditeurDeTerrain(), false);
  assert.equal(U.editeurDeTerrainOuvert(), true);
  reponse = true;
  assert.equal(await U.fermerEditeurDeTerrain(), true);
  assert.equal(demandes, 2);
  assert.ok(objets.some(o => o.id === 'r0'), 'non validé : la route est rendue à la Scène');
  assert.equal(instantanes, 0);
  assert.equal(S.terrainEnEdition, false);
});
