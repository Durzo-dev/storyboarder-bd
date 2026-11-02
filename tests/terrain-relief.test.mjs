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
  U.setTerrainEditeurCallbacks({ instantane: () => { instantanes++; }, ouvrirLaScene: () => {}, apresModification: () => { apres++; }, confirmer: async () => true });
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
  assert.equal(instantanes, 0, 'rien sur la Scène avant « Valider »');
  assert.equal(apres, 1, 'redessiné au relâcher seulement');
  document.getElementById('terrainValiderBtn').onclick();
  assert.equal(instantanes, 1, 'une annulation de l\'application, à la validation');
  assert.ok(R.hauteurDuRelief(panel.relief, 0, 0) > 0, 'validé : le relief reste');
});

test('câblage du rendu : le relief dans la signature de la Case, posé avec la matière du Sol, le Sol percé dessous', () => {
  const sc = lire('scene3d.js');
  assert.match(sc, /relief: signatureDuRelief\(panel\.relief\),/);
  assert.match(sc, /poserRelief3D\(panel, !!groundMesh3D && !_camBelowGround, _relief\);/);
  assert.match(sc, /stencilWrite: true, stencilRef: MARQUE_SOL_PERCE, stencilFunc: THREE\.AlwaysStencilFunc,/);
  assert.match(sc, /uv\[k \* 2\] = 0\.5 \+ \(x - gx\) \/ taille; uv\[k \* 2 \+ 1\] = 0\.5 - \(z - gz\) \/ taille;/);
  assert.match(sc, /libererReliefs3D\(\);/);
});

// Signalé : « Creuser », « Aplanir », « Adoucir » ne faisaient rien (les boutons, refaits à chaque dessin
// de la page, étaient remplacés entre l'appui et le relâcher) ; et le relief changeait la couleur du Sol.
test('les boutons de mode survivent au rafraîchissement, et choisissent ; le relief prend la matière même du Sol', () => {
  globalThis.requestAnimationFrame = (f) => { f(); return 0; };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  const panel = { id: 'p', type: 'panel', x: 0, y: 0, w: 480, h: 360, camRotX: Math.PI / 2, pts: [] };
  S.scenes = [{ id: 's1', name: 'Scène 1', w: 480, h: 360, pages: [{ objects: [panel] }] }];
  S.editingSceneId = 's1';
  U.setTerrainEditeurCallbacks({ instantane: () => {}, ouvrirLaScene: () => {}, apresModification: () => {}, confirmer: async () => true });
  U.initEditeurDeTerrain();
  U.ouvrirEditeurDeTerrain('s1');
  document.getElementById('terrainOutilRelief').onclick();
  const conteneur = document.getElementById('terrainModesRelief');
  const creuser = conteneur.children.find(b => b.dataset.valeur === 'creuser');
  U.rafraichirEditeurDeTerrain();   // un dessin de la page entre l'appui et le relâcher
  assert.ok(conteneur.children.includes(creuser), 'le bouton a été remplacé');
  creuser.onclick();
  assert.ok(creuser.classList.contains('actif'));
  const plan = document.getElementById('terrainPlan');
  const jouer = (type, ev) => (plan._ecouteurs[type] || []).forEach(f => f({ preventDefault(){}, stopPropagation(){}, pointerId: 1, detail: 1, ...ev, type }));
  jouer('pointerdown', { button: 0, clientX: 400, clientY: 300 });
  jouer('pointerup', { clientX: 400, clientY: 300 });
  assert.ok(R.hauteurDuRelief(panel.relief, 0, 0) < 0, 'le pinceau creuse');
  document.getElementById('terrainValiderBtn').onclick();
  const sc = lire('scene3d.js');
  assert.match(sc, /const maillage = new THREE\.Mesh\(geo, groundMesh3D\.material\);\n\s*maillage\.renderOrder = -2000;/);
});

// Demandé : « Retirer tout le relief », après une confirmation masquable.
test('« Retirer tout le relief » : demandé, puis la Scène redevient plate ; refusé, rien ne change', async () => {
  globalThis.requestAnimationFrame = (f) => { f(); return 0; };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  const panel = { id: 'p', type: 'panel', x: 0, y: 0, w: 480, h: 360, camRotX: Math.PI / 2, pts: [] };
  panel.relief = R.peindreLeRelief(null, { x: 0, z: 0 }, { mode: 'monter', rayon: 4, force: 1 });
  S.scenes = [{ id: 's1', name: 'Scène 1', w: 480, h: 360, pages: [{ objects: [panel] }] }];
  S.editingSceneId = 's1';
  let reponse = false, demandes = [], instantanes = 0;
  U.setTerrainEditeurCallbacks({ instantane: () => { instantanes++; }, ouvrirLaScene: () => {}, apresModification: () => {},
    confirmer: async (m, t, o) => { demandes.push(o.masquable); return reponse; } });
  U.initEditeurDeTerrain();
  U.ouvrirEditeurDeTerrain('s1');
  document.getElementById('terrainOutilRelief').onclick();
  const btn = document.getElementById('terrainReliefRetirerBtn');
  assert.equal(btn.disabled, false);
  await btn.onclick();
  assert.ok(panel.relief, 'refusé : le relief reste');
  reponse = true;
  await btn.onclick();
  assert.equal(panel.relief, undefined);
  assert.deepEqual(demandes, ['retirer-relief', 'retirer-relief']);
  assert.equal(btn.disabled, true, 'plus rien à retirer');
  document.getElementById('terrainValiderBtn').onclick();
  assert.equal(instantanes, 1);
  assert.equal(panel.relief, undefined, 'validé : plat');
});

// Signalé : l'aperçu 3D ne suivait le pinceau qu'au relâcher.
test('l\'aperçu suit le coup de pinceau ; la grille 3D se met à jour sur place', () => {
  const ui = lire('terrain-editeur-ui.js');
  assert.doesNotMatch(ui, /if \(T\.coup\) return;/);
  const sc = lire('scene3d.js');
  assert.match(sc, /if \(e && e\.sig !== sig && e\.dims === dims\) \{/);
});

// ── #462c-2 : ce qui est posé suit le relief ──────────────────────────────────────────────────
test('une ligne redécoupée au mètre garde ses points ; aplanir sous une emprise prend la base', () => {
  const l = R.densifierLaLigne([{ x: 0, z: 0 }, { x: 5, z: 0 }], 1);
  assert.equal(l.length, 6);
  assert.deepEqual(l[0], { x: 0, z: 0 }); assert.deepEqual(l[5], { x: 5, z: 0 });
  let r = null;
  for (let k = 0; k < 6; k++) r = R.peindreLeRelief(r, { x: 0, z: 0 }, { mode: 'monter', rayon: 8, force: 1 });
  const base = 0.5;
  const a = R.aplanirSousLesEmprises(r, [{ polys: [[{ x: -1, z: -1 }, { x: 1, z: -1 }, { x: 1, z: 1 }, { x: -1, z: 1 }]], base }]);
  assert.equal(R.hauteurDuRelief(a, 0, 0), base);
  assert.equal(R.hauteurDuRelief(a, 1, 0.5), base, 'le bord de l\'emprise');
  assert.equal(R.hauteurDuRelief(a, 5, 0), R.hauteurDuRelief(r, 5, 0), 'loin : inchangé');
  assert.notEqual(r, a);
  assert.equal(R.aplanirSousLesEmprises(r, []), r);
});

test('rendu : un Élément monte de la hauteur du relief sous lui ; une route s\'y drape', async () => {
  const SC = await import('../src/scene3d.js');
  const RIG = await import('../src/rig3d.js');
  const panel = { id: 'pr', type: 'panel', x: 0, y: 0, w: 480, h: 360, camRotX: 0.6, camDist: 30, pts: [] };
  let r = null;
  for (let k = 0; k < 8; k++) r = R.peindreLeRelief(r, { x: 0, z: 0 }, { mode: 'monter', rayon: 10, force: 1 });
  const route = { id: 'rr', type: 'tracé', tracéType: 'route', panelId: 'pr', world: { pts: [{ x: -8, z: 0 }, { x: 8, z: 0 }], width: 3 } };
  const page = { w: 480, h: 360, objects: [panel, route] };
  const hauteurRoute = () => { let y = -Infinity; RIG.personaScene3D.updateMatrixWorld(true);
    RIG.personaScene3D.traverse(o => { if (o.isMesh && o.parent && o.parent.visible && o.material && o.geometry && !o.userData.relief) {
      o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox;
      if (!(b.min.x >= -9 && b.max.x <= 9 && b.max.y - b.min.y < 20)) return;   // la route seule (ni Sol, ni ciel)
      const p = o.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < 0.6) y = Math.max(y, p.getY(i)); } }); return y; };
  const plat = -3 + 0.007;   // la route à plat : le Sol (GROUND_Y_DEFAULT_3D), et son léger décalage
  panel.relief = r;
  SC.rendreSceneVueLibre3D(panel, page, { rotX: 0.6, rotY: 0, dist: 30, x: 0, y: 0, z: 0 }, 0.5);
  const drape = hauteurRoute();
  assert.ok(Math.abs(drape - plat - R.hauteurDuRelief(r, 0, 0)) < 0.3, `la route au sommet : ${plat} → ${drape}`);
  const sc = lire('scene3d.js');
  assert.match(sc, /wy \+= hauteurDuRelief\(_relief, wx, z\);/);
  assert.match(sc, /draperSurLeRelief3D\(group, _relief\);/);
});

test('une Scène chargée dans une Case apporte son relief, décalé comme son contenu', () => {
  const sc = lire('scenes.js');
  assert.match(sc, /panel\.relief = JSON\.parse\(JSON\.stringify\(scenePanel\.relief\)\);\n\s*panel\.relief\.x0 -= worldBboxCx;/);
  assert.match(sc, /\} else delete panel\.relief;/);
});

// Signalé (deux fois) : le sol changeait de couleur sur le relief. La seconde cause : il se projetait
// une ombre à lui-même (acné d'ombre).
test('le relief reçoit les ombres sans en projeter, comme le Sol', () => {
  assert.match(lire('scene3d.js'), /maillage\.receiveShadow = true; maillage\.castShadow = false;/);
});

// Signalé : des anneaux de moiré sur le relief en zoomant (le masque, testé en profondeur, luttait
// avec le relief presque plat, et le Sol plat se dessinait au travers).
test('le masque du relief perce le Sol sans test de profondeur', () => {
  assert.match(lire('scene3d.js'), /_masqueRelief3D = new THREE\.MeshBasicMaterial\(\{ colorWrite: false, depthWrite: false, depthTest: false,/);
});
