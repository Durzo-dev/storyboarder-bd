/**
 * Demandé le 3 novembre 2026 : une Zone se trace au pinceau ou en rectangle ; avec l'outil Relief, la
 * molette règle la taille et le clic droit change de mode ; l'outil Relief a son icône.
 */
import './helpers/dom-stub.mjs';
import './helpers/render-stub.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Z from '../src/terrain-zone-pinceau.js';
import { deplacerLeMonde, sousLePoint } from '../src/terrain-plan.js';
import { S } from '../src/state.js';
import * as U from '../src/terrain-editeur-ui.js';

const lire = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('le masque : peindre un disque, l\'agrandir, le gommer ; le monde englobant suit', () => {
  let m = Z.peindreLeMasque(null, { x: 0, z: 0 }, 1);
  assert.ok(Z.masqueValide(m));
  assert.ok(Z.dansLeMasque(m, { x: 0.1, z: 0.1 }));
  assert.ok(!Z.dansLeMasque(m, { x: 3, z: 0 }));
  m = Z.peindreLeMasque(m, { x: 5, z: 0 }, 1);
  assert.ok(Z.dansLeMasque(m, { x: 5, z: 0.1 }) && Z.dansLeMasque(m, { x: 0.1, z: 0.1 }));
  const w = Z.mondeDuMasque(m);
  assert.ok(w.w >= 7 && w.corners.length === 4 && w.masque === m);
  m = Z.peindreLeMasque(m, { x: 5, z: 0 }, 1.5, true);
  assert.ok(!Z.dansLeMasque(m, { x: 5, z: 0.1 }));
  assert.ok(Z.mondeDuMasque(m).w < 3, 'resserré');
  assert.equal(Z.peindreLeMasque(m, { x: 0, z: 0 }, 3, true), null, 'tout gommé');
  // Déplacer une Zone peinte déplace son masque ; on la touche par ses cases.
  const d = deplacerLeMonde(Z.mondeDuMasque(Z.peindreLeMasque(null, { x: 0, z: 0 }, 1)), 10, 0);
  assert.ok(Z.dansLeMasque(d.masque, { x: 10.1, z: 0.1 }));
  const f = [{ type: 'zone', id: 'z', pts: d.corners, masque: d.masque }];
  assert.equal(sousLePoint(f, { x: 10.1, z: 0.1 }, 0.1).id, 'z');
  assert.equal(sousLePoint(f, { x: d.corners[0].x + 0.01, z: d.corners[0].z + 0.01 }, 0.001), null, 'le coin du rectangle n\'est pas peint');
});

test('l\'éditeur : peindre une Zone, la molette règle les pinceaux, le clic droit change le mode du relief', () => {
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
  const objets = S.scenes[0].pages[0].objects;
  // La Zone au pinceau : un trait de (0, 0) à (4, 0).
  document.getElementById('terrainOutilZone').onclick();
  assert.deepEqual(document.getElementById('terrainSortesZone').children.map(b => b.dataset.valeur), ['rectangle', 'pinceau'], 'plus de choix Terrain / Eau');
  document.getElementById('terrainSortesZone').children.find(b => b.dataset.valeur === 'pinceau').onclick();
  const avant = Number(document.getElementById('terrainZoneTaille').value);
  jouer('wheel', { deltaY: -100, clientX: 400, clientY: 300 });
  assert.equal(Number(document.getElementById('terrainZoneTaille').value), avant + 0.5, 'la molette grandit le pinceau de Zone');
  jouer('pointerdown', { button: 0, clientX: 400, clientY: 300 });
  jouer('pointermove', { clientX: 400 + 4 * 22.8, clientY: 300 });
  jouer('pointerup', { clientX: 400 + 4 * 22.8, clientY: 300 });
  const zone = objets.find(o => o.tracéType === 'terrain');
  assert.ok(zone && zone.world.masque, 'une Zone peinte');
  assert.ok(Z.dansLeMasque(zone.world.masque, { x: 2, z: 0.1 }), 'le long du trait');
  // Relief : molette = taille, clic droit sans bouger = mode suivant ; glissé = déplacer la vue.
  document.getElementById('terrainOutilRelief').onclick();
  const taille = Number(document.getElementById('terrainReliefTaille').value);
  jouer('wheel', { deltaY: -100, clientX: 400, clientY: 300 });
  assert.equal(Number(document.getElementById('terrainReliefTaille').value), taille + 1);
  const modes = () => document.getElementById('terrainModesRelief').children.find(b => b.classList.contains('actif')).dataset.valeur;
  const m0 = modes();
  jouer('pointerdown', { button: 2, clientX: 300, clientY: 300 });
  jouer('pointerup', { clientX: 301, clientY: 300 });
  assert.notEqual(modes(), m0, 'le clic droit change le mode');
  const m1 = modes();
  jouer('pointerdown', { button: 2, clientX: 300, clientY: 300 });
  jouer('pointermove', { clientX: 360, clientY: 300 });
  jouer('pointerup', { clientX: 360, clientY: 300 });
  assert.equal(modes(), m1, 'un clic droit glissé ne change pas le mode');
  document.getElementById('terrainValiderBtn').onclick();
});

test('l\'outil Relief a son icône, distincte de celle de l\'Éditeur de terrain', () => {
  const html = lire('index.html');
  const svg = (id) => html.slice(html.indexOf(`id="${id}"`), html.indexOf('</svg>', html.indexOf(`id="${id}"`)));
  const chemins = (b) => [...b.matchAll(/<path d="([^"]+)"/g)].map(m => m[1]).join('|');
  assert.notEqual(chemins(svg('terrainOutilRelief')), chemins(svg('openTerrainEditorBtn')));
  assert.match(lire('scene3d.js'), /geometrieDuMasque3D\(w, GROUND_Y_DEFAULT_3D \+ 0\.005\)/);
});

// Demandé : clic droit avec l'outil Zone = rectangle ↔ pinceau ; les réglages d'une Zone dans
// « Sélection » ; signalé : une Zone à la texture Eau ne se voyait pas (nappe sous le Sol).
test('outil Zone : clic droit = rectangle ↔ pinceau ; une Zone se règle dans « Sélection » ; l\'eau au-dessus du Sol', async () => {
  const R = await import('../src/terrain-relief.js');
  assert.ok(R.NIVEAU_EAU_PAR_DEFAUT > 0, 'la nappe par défaut est juste au-dessus du Sol plat');
  globalThis.requestAnimationFrame = (f) => { f(); return 0; };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  const panel = { id: 'p', type: 'panel', x: 0, y: 0, w: 480, h: 360, camRotX: Math.PI / 2, pts: [] };
  const zone = { id: 'z1', type: 'tracé', tracéType: 'terrain', terrainType: 'herbe', name: 'Pré', panelId: 'p',
    world: { cx: 0, cz: 0, w: 4, h: 4, rotY: 0, corners: [{ x: -2, z: -2 }, { x: 2, z: -2 }, { x: 2, z: 2 }, { x: -2, z: 2 }] } };
  S.scenes = [{ id: 's1', name: 'Scène 1', w: 480, h: 360, pages: [{ objects: [panel, zone] }] }];
  S.editingSceneId = 's1';
  U.setTerrainEditeurCallbacks({ instantane: () => {}, ouvrirLaScene: () => {}, apresModification: () => {}, confirmer: async () => true });
  U.initEditeurDeTerrain();
  U.ouvrirEditeurDeTerrain('s1', { choisi: 'z1' });
  const plan = document.getElementById('terrainPlan');
  const jouer = (type, ev) => (plan._ecouteurs[type] || []).forEach(f => f({ preventDefault(){}, stopPropagation(){}, pointerId: 1, detail: 1, ...ev, type }));
  U.rafraichirEditeurDeTerrain();
  const reglages = document.getElementById('terrainChoisiZone').children;
  const nom = reglages.find(c => c.dataset && c.dataset.cle === 'name');
  assert.equal(nom.value, 'Pré');
  nom.value = 'Prairie'; nom.onchange();
  assert.equal(zone.name, 'Prairie');
  assert.ok(reglages.some(c => c.dataset && c.dataset.cle === 'terrainColor'), 'la couleur');
  assert.equal(document.getElementById('terrainReglerBtn').hidden, true, 'plus de fenêtre pour une Zone');
  // Clic droit sans bouger, outil Zone : la forme change.
  document.getElementById('terrainOutilZone').onclick();
  const forme = () => document.getElementById('terrainSortesZone').children.find(b => b.classList.contains('actif')).dataset.valeur;
  const f0 = forme();
  jouer('pointerdown', { button: 2, clientX: 300, clientY: 300 });
  jouer('pointerup', { clientX: 300, clientY: 300 });
  assert.notEqual(forme(), f0);
  document.getElementById('terrainValiderBtn').onclick();
});
