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

// Demandé : une Zone relève ou creuse le terrain sous elle ; le niveau de l'eau se voit tout de suite
// dans l'aperçu ; l'étiquette (sans effet dans une Scène) n'est plus proposée.
test('la hauteur d\'une Zone relève ou creuse le relief rendu ; l\'aperçu suit niveau et hauteur ; plus d\'étiquette', async () => {
  const R = await import('../src/terrain-relief.js');
  const carre = (p) => Math.abs(p.x) <= 2 && Math.abs(p.z) <= 2;
  const r = R.releverLesZones(null, [{ x0: -2, z0: -2, x1: 2, z1: 2, dedans: carre, delta: -1.5 }]);
  assert.ok(Math.abs(R.hauteurDuRelief(r, 0, 0) + 1.5) < 1e-9);
  assert.equal(R.hauteurDuRelief(r, 6, 0), 0);
  assert.equal(R.releverLesZones(null, [{ x0: 0, z0: 0, x1: 1, z1: 1, dedans: carre, delta: 0 }]), null);
  const SC = await import('../src/scene3d.js');
  const RIG = await import('../src/rig3d.js');
  const panel = { id: 'ph', type: 'panel', x: 0, y: 0, w: 480, h: 360, camRotX: 0.6, camDist: 30, pts: [] };
  const zone = { id: 'zh', type: 'tracé', tracéType: 'terrain', terrainType: 'herbe', panelId: 'ph', hauteurZone: 2,
    world: { cx: 0, cz: 0, w: 6, h: 6, rotY: 0, corners: [{ x: -3, z: -3 }, { x: 3, z: -3 }, { x: 3, z: 3 }, { x: -3, z: 3 }] } };
  SC.rendreSceneVueLibre3D(panel, { w: 480, h: 360, objects: [panel, zone] }, { rotX: 0.6, rotY: 0, dist: 30, x: 0, y: 0, z: 0 }, 0.5);
  let haut = -Infinity;
  RIG.personaScene3D.traverseVisible(o => { if (o.userData && o.userData.relief) { o.geometry.computeBoundingBox(); haut = Math.max(haut, o.geometry.boundingBox.max.y); } });
  assert.ok(Math.abs(haut - (-3 + 2)) < 1e-6, `le relief monte sous la Zone : ${haut}`);
  const ui = lire('terrain-editeur-ui.js');
  assert.match(ui, /o\.niveauEau, o\.profondeur, o\.hauteurZone, o\.penteZone, o\.sensPente\]\)\]\);/);
  assert.doesNotMatch(ui, /champ\('label'/);
});

// Demandé : clic droit sur la Zone choisie = un quart de tour ; maintenu = elle suit la souris.
test('tourner une Zone : les coins d\'un rectangle (et son rotY), le masque d\'une Zone peinte', async () => {
  const P = await import('../src/terrain-plan.js');
  const w = { cx: 0, cz: 0, w: 4, h: 2, rotY: 0, corners: [{ x: -2, z: -1 }, { x: 2, z: -1 }, { x: 2, z: 1 }, { x: -2, z: 1 }] };
  const q = P.tournerLaZone(w, Math.PI / 2);
  assert.ok(Math.abs(q.rotY - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(q.corners[0].x - 1) < 1e-9 && Math.abs(q.corners[0].z + 2) < 1e-9, JSON.stringify(q.corners[0]));
  // Une bande peinte le long de x devient une bande le long de z.
  let m = null;
  for (let x = -3; x <= 3; x += 0.5) m = Z.peindreLeMasque(m, { x, z: 0 }, 0.5);
  const wm = Z.mondeDuMasque(m);
  const t = P.tournerLaZone(wm, Math.PI / 2);
  assert.ok(t.h > t.w, `la bande tourne : ${t.w} × ${t.h}`);
  assert.ok(Z.dansLeMasque(t.masque, { x: wm.cx + 0.1, z: wm.cz + 2.5 }));
  assert.ok(!Z.dansLeMasque(t.masque, { x: wm.cx + 2.5, z: wm.cz + 0.1 }));
});

test('l\'éditeur : clic droit sur la Zone choisie la tourne d\'un quart ; « Taille du pinceau » cachée en Rectangle ; recherche des Scènes', () => {
  globalThis.requestAnimationFrame = (f) => { f(); return 0; };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  const panel = { id: 'p', type: 'panel', x: 0, y: 0, w: 480, h: 360, camRotX: Math.PI / 2, pts: [] };
  const zone = { id: 'z1', type: 'tracé', tracéType: 'terrain', terrainType: 'herbe', panelId: 'p',
    world: { cx: 0, cz: 0, w: 8, h: 2, rotY: 0, corners: [{ x: -4, z: -1 }, { x: 4, z: -1 }, { x: 4, z: 1 }, { x: -4, z: 1 }] } };
  S.scenes = [{ id: 's1', name: 'Scène 1', w: 480, h: 360, pages: [{ objects: [panel, zone] }] }];
  S.editingSceneId = 's1';
  U.setTerrainEditeurCallbacks({ instantane: () => {}, ouvrirLaScene: () => {}, apresModification: () => {}, confirmer: async () => true });
  U.initEditeurDeTerrain();
  U.ouvrirEditeurDeTerrain('s1', { choisi: 'z1' });
  const plan = document.getElementById('terrainPlan');
  const jouer = (type, ev) => (plan._ecouteurs[type] || []).forEach(f => f({ preventDefault(){}, stopPropagation(){}, pointerId: 1, detail: 1, ...ev, type }));
  jouer('pointerdown', { button: 2, clientX: 400, clientY: 300 });
  jouer('pointerup', { clientX: 400, clientY: 300 });
  assert.ok(Math.abs(zone.world.rotY - Math.PI / 2) < 1e-9, 'un quart de tour');
  document.getElementById('terrainOutilZone').onclick();
  document.getElementById('terrainSortesZone').children.find(b => b.dataset.valeur === 'rectangle').onclick();
  assert.equal(document.getElementById('terrainZoneTaille').style.display, 'none');
  document.getElementById('terrainSortesZone').children.find(b => b.dataset.valeur === 'pinceau').onclick();
  assert.equal(document.getElementById('terrainZoneTaille').style.display, '');
  document.getElementById('terrainValiderBtn').onclick();
  // Le choix de la Scène : au-delà de huit (sans mise en page), la recherche ; elle filtre sans accents.
  S.scenes = Array.from({ length: 12 }, (_, i) => ({ id: 'x' + i, name: i === 5 ? 'Église' : 'Rue ' + i, w: 480, h: 360, pages: [{ objects: [] }] }));
  U.ouvrirChoixDeScene();
  const recherche = document.getElementById('terrainSceneRecherche');
  assert.equal(recherche.style.display, '');
  recherche.value = 'egl'; recherche.oninput();
  const visibles = document.getElementById('terrainSceneListe').children.filter(b => b.style.display !== 'none');
  assert.deepEqual(visibles.map(b => b.textContent), ['Église']);
  U.fermerChoixDeScene();
});

// Demandé : faire des pentes ; retenu : la PENTE d'une Zone (degrés) et son sens, dans « Sélection ».
test('la pente d\'une Zone : un plan incliné autour de son centre, orienté par le sens et la rotation', async () => {
  const R = await import('../src/terrain-relief.js');
  const z = { hauteur: 1, penteDeg: 45, sensDeg: 0, rotY: 0, cx: 0, cz: 0 };
  assert.equal(R.hauteurDeLaZone(z, { x: 0, z: 5 }), 1, 'le centre (et l\'axe perpendiculaire) garde sa hauteur');
  assert.ok(Math.abs(R.hauteurDeLaZone(z, { x: 2, z: 0 }) - 3) < 1e-9, 'à 45°, +2 m vers la droite');
  assert.ok(Math.abs(R.hauteurDeLaZone({ ...z, sensDeg: 90 }, { x: 0, z: 2 }) - 3) < 1e-9, 'sens 90° : vers le bas du plan');
  assert.ok(Math.abs(R.hauteurDeLaZone({ ...z, rotY: Math.PI / 2 }, { x: 0, z: 2 }) - 3) < 1e-9, 'la Zone tournée tourne sa pente');
  assert.equal(R.hauteurDeLaZone({ hauteur: 2 }, { x: 9, z: 9 }), 2, 'sans pente : la hauteur');
  // Le relief rendu : un rectangle de 6 m en pente de 20° vers la droite.
  const carre = (p) => Math.abs(p.x) <= 3 && Math.abs(p.z) <= 3;
  const r = R.releverLesZones(null, [{ x0: -3, z0: -3, x1: 3, z1: 3, dedans: carre, deltaEn: (p) => R.hauteurDeLaZone({ penteDeg: 20, cx: 0, cz: 0 }, p) }]);
  assert.ok(R.hauteurDuRelief(r, 2, 0) > 0.5 && R.hauteurDuRelief(r, -2, 0) < -0.5);
  // L'éditeur : les curseurs Pente et Sens dans « Sélection ».
  globalThis.requestAnimationFrame = (f) => { f(); return 0; };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  const panel = { id: 'p', type: 'panel', x: 0, y: 0, w: 480, h: 360, camRotX: Math.PI / 2, pts: [] };
  const zone = { id: 'z1', type: 'tracé', tracéType: 'terrain', terrainType: 'herbe', panelId: 'p',
    world: { cx: 0, cz: 0, w: 6, h: 6, rotY: 0, corners: [{ x: -3, z: -3 }, { x: 3, z: -3 }, { x: 3, z: 3 }, { x: -3, z: 3 }] } };
  S.scenes = [{ id: 's1', name: 'Scène 1', w: 480, h: 360, pages: [{ objects: [panel, zone] }] }];
  S.editingSceneId = 's1';
  U.setTerrainEditeurCallbacks({ instantane: () => {}, ouvrirLaScene: () => {}, apresModification: () => {}, confirmer: async () => true });
  U.initEditeurDeTerrain();
  U.ouvrirEditeurDeTerrain('s1', { choisi: 'z1' });
  U.rafraichirEditeurDeTerrain();
  const enfants = document.getElementById('terrainChoisiReglages').children;
  const curseurs = enfants.filter(c => c.type === 'range');
  assert.deepEqual(curseurs.map(c => c.dataset.cle), ['hauteur', 'pente']);
  curseurs[1].value = '15'; curseurs[1].oninput();
  assert.equal(zone.penteZone, 15);
  // Demandé : le sens se choisit dans un CADRAN (clic en bas du disque : ça monte vers le bas du plan).
  const cadran = enfants.find(c => c.className === 'terrain-cadran');
  assert.ok(cadran, 'le cadran');
  cadran.getBoundingClientRect = () => ({ left: 0, top: 0, width: 76, height: 76 });
  (cadran._ecouteurs.pointerdown || []).forEach(f => f({ clientX: 38, clientY: 76, pointerId: 1 }));
  (cadran._ecouteurs.pointerup || []).forEach(f => f({}));
  assert.equal(zone.sensPente, 90);
  // Zone tournée d'un quart : le cadran montre la direction SUR LE PLAN (sens + rotation).
  zone.world = { ...zone.world, rotY: Math.PI / 2 };
  U.rafraichirEditeurDeTerrain();
  assert.match(cadran.children[0].style.transform, /rotate\(180deg\)/);
  document.getElementById('terrainValiderBtn').onclick();
  assert.match(lire('scene3d.js'), /deltaEn: \(p\) => hauteurDeLaZone\(reglage, p\),/);
});

// Demandé : des bords DOUX pour une Zone relevée ou en pente.
test('autour d\'une Zone relevée, le terrain rejoint le sol en douceur', async () => {
  const R = await import('../src/terrain-relief.js');
  const carre = (p) => Math.abs(p.x) <= 2 && Math.abs(p.z) <= 2;
  const proche = (p) => ({ x: Math.max(-2, Math.min(2, p.x)), z: Math.max(-2, Math.min(2, p.z)) });
  const r = R.releverLesZones(null, [{ x0: -2, z0: -2, x1: 2, z1: 2, dedans: carre, delta: 3, fondu: 4, plusProche: proche }]);
  const h = [2, 3, 4, 5, 6, 7].map(x => R.hauteurDuRelief(r, x, 0));
  assert.equal(h[0], 3, 'le bord de la Zone');
  assert.ok(h[1] < 3 && h[1] > h[2] && h[2] > h[3] && h[3] > 0, `décroît : ${h}`);
  assert.equal(h[4], 0, 'au-delà de la bande : le sol');
  assert.ok(Z.caseLaPlusProche(Z.peindreLeMasque(null, { x: 0, z: 0 }, 1), { x: 3, z: 0.1 }, 3), 'la case peinte la plus proche');
});
