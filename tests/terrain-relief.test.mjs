/**
 * #462c-1, le relief d'une Scène : la grille de hauteurs (terrain-relief.js), le pinceau, son rendu 3D
 * (une grille à la matière du Sol, le Sol plat percé dessous) et l'outil de l'Éditeur de terrain.
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

test('sans relief, tout est à 0 ; monter élève le centre, pas le bord ; la grille s\'agrandit au besoin', () => {
  assert.equal(R.hauteurDuRelief(null, 3, 4), 0);
  let r = R.peindreLeRelief(null, { x: 0, z: 0 }, { mode: 'monter', rayon: 4, force: 1 });
  assert.ok(R.reliefValide(r));
  assert.ok(R.hauteurDuRelief(r, 0, 0) > 0.2);
  assert.equal(R.hauteurDuRelief(r, 3.9, 0) < 0.01, true, 'presque rien au bord du pinceau');
  assert.equal(R.hauteurDuRelief(r, 50, 50), 0, 'hors de la grille');
  // Le bord de la grille reste à 0 : raccord au Sol plat.
  for (let i = 0; i < r.nx; i++) { assert.equal(r.h[i], 0); assert.equal(r.h[(r.nz - 1) * r.nx + i], 0); }
  const avant = { x0: r.x0, nx: r.nx };
  r = R.peindreLeRelief(r, { x: 20, z: 0 }, { mode: 'monter', rayon: 3, force: 1 });
  assert.ok(r.nx > avant.nx && r.x0 === avant.x0, 'agrandie vers la droite, l\'existant gardé');
  assert.ok(R.hauteurDuRelief(r, 0, 0) > 0.2, 'la première bosse est toujours là');
});

test('creuser descend ; aplanir va vers la cible ; adoucir rapproche des voisins ; bornes', () => {
  let r = R.peindreLeRelief(null, { x: 0, z: 0 }, { mode: 'creuser', rayon: 4, force: 1 });
  assert.ok(R.hauteurDuRelief(r, 0, 0) < -0.2);
  for (let k = 0; k < 10; k++) r = R.peindreLeRelief(r, { x: 0, z: 0 }, { mode: 'aplanir', rayon: 6, force: 1, cible: 1 });
  assert.ok(Math.abs(R.hauteurDuRelief(r, 0, 0) - 1) < 1e-6);
  let pic = R.peindreLeRelief(null, { x: 0, z: 0 }, { mode: 'monter', rayon: 1.5, force: 1 });
  const h0 = R.hauteurDuRelief(pic, 0, 0);
  pic = R.peindreLeRelief(pic, { x: 0, z: 0 }, { mode: 'adoucir', rayon: 4, force: 1 });
  assert.ok(R.hauteurDuRelief(pic, 0, 0) < h0);
  let haut = null;
  for (let k = 0; k < 400; k++) haut = R.peindreLeRelief(haut, { x: 0, z: 0 }, { mode: 'monter', rayon: 4, force: 1 });
  assert.ok(R.hauteurDuRelief(haut, 0, 0) <= R.HAUTEUR_MAX);
});

test('la signature suit les hauteurs, pas le seul compteur ; plat = rien à dessiner', () => {
  const a = R.peindreLeRelief(null, { x: 0, z: 0 }, { mode: 'monter', rayon: 4, force: 1 });
  const b = R.peindreLeRelief(null, { x: 0, z: 0 }, { mode: 'creuser', rayon: 4, force: 1 });
  assert.equal(a.v, b.v);
  assert.notEqual(R.signatureDuRelief(a), R.signatureDuRelief(b));
  assert.equal(R.signatureDuRelief(null), '');
  assert.ok(R.reliefPlat(null));
  assert.ok(!R.reliefPlat(a));
  assert.ok(R.reliefPlat(R.etendreLeRelief(null, 0, 0, 5, 5)));
});

test('l\'outil Relief : un glisser peint le relief du canevas de la Scène, un instantané par coup', () => {
  globalThis.requestAnimationFrame = (f) => { f(); return 0; };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  const panel = { id: 'p', type: 'panel', x: 0, y: 0, w: 480, h: 360, camRotX: Math.PI / 2, pts: [] };
  S.scenes = [{ id: 's1', name: 'Scène 1', w: 480, h: 360, pages: [{ objects: [panel] }] }];
  S.editingSceneId = 's1';
  let instantanes = 0, apres = 0;
  U.setTerrainEditeurCallbacks({ instantane: () => { instantanes++; }, ouvrirLaScene: () => {}, apresModification: () => { apres++; } });
  U.initEditeurDeTerrain();
  U.ouvrirEditeurDeTerrain('s1');
  const plan = document.getElementById('terrainPlan');
  const jouer = (type, ev) => (plan._ecouteurs[type] || []).forEach(f => f({ preventDefault(){}, stopPropagation(){}, pointerId: 1, detail: 1, ...ev, type }));
  document.getElementById('terrainOutilRelief').onclick();
  jouer('pointerdown', { button: 0, clientX: 400, clientY: 300 });
  jouer('pointermove', { clientX: 420, clientY: 300 });
  jouer('pointermove', { clientX: 440, clientY: 300 });
  jouer('pointerup', { clientX: 440, clientY: 300 });
  assert.ok(R.reliefValide(panel.relief), 'le relief est posé sur le canevas de la Scène');
  assert.ok(R.hauteurDuRelief(panel.relief, 0, 0) > 0);
  assert.equal(instantanes, 1, 'un seul instantané pour tout le coup');
  assert.equal(apres, 1, 'la Scène redessinée au relâcher seulement');
  U.fermerEditeurDeTerrain();
});

test('câblage du rendu : le relief dans la signature de la Case, posé avec la matière du Sol, le Sol percé dessous', () => {
  const sc = lire('scene3d.js');
  assert.match(sc, /relief: signatureDuRelief\(panel\.relief\),/);
  assert.match(sc, /poserRelief3D\(panel, !!groundMesh3D && !_camBelowGround\);/);
  assert.match(sc, /stencilWrite: true, stencilRef: MARQUE_SOL_PERCE, stencilFunc: THREE\.AlwaysStencilFunc,/);
  assert.match(sc, /uv\[k \* 2\] = 0\.5 \+ \(x - gx\) \/ taille; uv\[k \* 2 \+ 1\] = 0\.5 - \(z - gz\) \/ taille;/);
  assert.match(sc, /libererReliefs3D\(\);/);
});
