/**
 * #462a, l'Éditeur de terrain : le plan de la Scène (terrain-plan.js), la caméra de l'aperçu, et le
 * câblage (bouton du bandeau inerte sans Scène, choix de la Scène, « Modifier le terrain » au clic
 * droit dans une Scène seulement, un seul écran au centre).
 */
import './helpers/dom-stub.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as P from '../src/terrain-plan.js';
import { bougerCameraApercu, zoomerCameraApercu, commandesDuTerrain } from '../src/terrain-editeur-ui.js';

const lire = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('le contenu du plan : zones, tracés, bâtiments, éléments, dans cet ordre ; ce qui est illisible est écarté', () => {
  const panel = { id: 'c', type: 'panel' };
  const page = { objects: [
    panel,
    { id: 'e1', type: 'perso', name: 'Alice' },
    { id: 'z1', type: 'tracé', tracéType: 'terrain', panelId: 'c', color: '#6B8E23', world: { corners: [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 }] } },
    { id: 'r1', type: 'tracé', tracéType: 'route', panelId: 'c', world: { pts: [{ x: -5, z: 0 }, { x: 5, z: 0 }], width: 3 } },
    { id: 'm1', type: 'tracé', tracéType: 'haie', panelId: 'c', world: { pts: [{ x: 0, z: 2 }, { x: 0, z: 6 }], width: 0.4 } },
    { id: 'x1', type: 'tracé', tracéType: 'route', panelId: 'autre', world: { pts: [{ x: 0, z: 0 }, { x: 1, z: 0 }] } },
    { id: 'z2', type: 'tracé', tracéType: 'terrain', panelId: 'c', world: { corners: [{ x: NaN, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }] } },
    { id: 'b1', type: 'objet3d', objType: 'batiment', name: 'Maison' },
    { id: 'o1', type: 'objet3d', objType: 'caisse', name: 'Caisse' },
  ] };
  const outils = {
    placeDe: (o) => (o.id === 'e1' ? { x: 1, z: 2 } : o.id === 'o1' ? { x: 3, z: -1 } : null),
    empreinteDuBatiment: () => [[{ x: 10, z: 10 }, { x: 16, z: 10 }, { x: 16, z: 14 }, { x: 10, z: 14 }]],
  };
  const f = P.contenuDuPlan(page, panel, outils);
  assert.deepEqual(f.map(x => x.id), ['z1', 'r1', 'm1', 'b1', 'e1', 'o1']);
  assert.equal(f.find(x => x.id === 'r1').largeur, 3);
  assert.equal(f.find(x => x.id === 'm1').muret, true);
  assert.equal(f.find(x => x.id === 'r1').muret, false);
  assert.equal(f.find(x => x.id === 'e1').perso, true);
});

test('le cadrage montre tout, 20 m au moins ; le zoom garde le point sous la souris ; la grille suit le zoom', () => {
  const vide = P.cadrageDuPlan([], 800, 600);
  assert.deepEqual([vide.cx, vide.cz], [0, 0]);
  assert.ok(Math.abs(vide.ppm - 600 * 0.76 / 20) < 1e-9);
  const formes = [{ type: 'element', x: -40, z: 0 }, { type: 'element', x: 60, z: 10 }];
  const v = P.cadrageDuPlan(formes, 800, 600);
  for (const p of formes) {
    const s = P.versLePlan(v, p, 800, 600);
    assert.ok(s.x >= 0 && s.x <= 800 && s.y >= 0 && s.y <= 600, JSON.stringify(s));
  }
  const s = { x: 123, y: 456 };
  const avant = P.versLeMonde(v, s, 800, 600);
  const z = P.zoomerLePlan(v, s, 800, 600, 1.5);
  const apres = P.versLeMonde(z, s, 800, 600);
  assert.ok(Math.abs(avant.x - apres.x) < 1e-9 && Math.abs(avant.z - apres.z) < 1e-9);
  assert.equal(P.zoomerLePlan({ cx: 0, cz: 0, ppm: 390 }, s, 800, 600, 2).ppm, 400);
  assert.equal(P.pasDeLaGrille(30), 1);
  assert.equal(P.pasDeLaGrille(5), 5);
  assert.equal(P.pasDeLaGrille(0.5), 50);
});

test('la caméra de l\'aperçu : tourner (tangage borné), déplacer sur le Sol, zoomer (borné)', () => {
  const cam = { rotX: 0.5, rotY: 0, dist: 40, x: 0, y: 0, z: 0 };
  const t = bougerCameraApercu(cam, 'tourner', 100, 0);
  assert.ok(t.rotY < 0 && t.rotX === 0.5);
  assert.ok(bougerCameraApercu(cam, 'tourner', 0, 10000).rotX < Math.PI / 2);
  assert.ok(bougerCameraApercu(cam, 'tourner', 0, -10000).rotX > 0);
  // Caméra au sud regardant le nord : glisser vers la droite fait glisser le centre vers la gauche (-x).
  const d = bougerCameraApercu(cam, 'deplacer', 100, 0);
  assert.ok(d.x < 0 && Math.abs(d.z) < 1e-9 && d.y === 0);
  assert.ok(zoomerCameraApercu(cam, 1).dist > 40 && zoomerCameraApercu(cam, -1).dist < 40);
  assert.equal(zoomerCameraApercu({ ...cam, dist: 2 }, -1).dist, 2);
});

test('les commandes disent ce qu\'on peut faire, et que les Éléments ne se modifient pas ici', () => {
  const t = commandesDuTerrain((en, fr) => fr).join('\n');
  assert.match(t, /Les Éléments ne sont que désignés ici\./);
  assert.match(t, /Suppr : le supprimer/);
  assert.match(commandesDuTerrain((en, fr) => fr, 'zone').join('\n'), /Glisser : tracer une Zone de terrain/);
  assert.match(commandesDuTerrain((en, fr) => fr, 'trace').join('\n'), /double-clic, Entrée ou clic droit : terminer/);
});

test('câblage : bouton à droite de l\'Éditeur de bâtiment, inerte sans Scène ; choix de la Scène ; clic droit en Scène seulement', () => {
  const html = lire('index.html');
  assert.ok(html.indexOf('id="openBatimentEditorBtn"') < html.indexOf('id="openTerrainEditorBtn"'));
  assert.ok(html.indexOf('id="openTerrainEditorBtn"') < html.indexOf('id="openPoseEditorBtn"'));
  assert.ok(html.indexOf('id="ctxImportModel"') < html.indexOf('id="ctxModifierTerrain"'), 'sous « Importer un modèle »');
  assert.match(html, /<div class="modal-overlay hidden" id="terrainSceneModal">/);
  const ui = lire('terrain-editeur-ui.js');
  assert.match(ui, /b\.disabled = aucune;/);
  const ev = lire('events.js');
  assert.match(ev, /if \(editeurDeTerrainOuvert\(\)\) fermerEditeurDeTerrain\(\); else ouvrirChoixDeScene\(\);/);
  assert.match(ev, /document\.getElementById\('ctxModifierTerrain'\)\.style\.display = isSceneCanvas \? '' : 'none';/);
  assert.match(ev, /if \(S\.editingSceneId\) ouvrirEditeurDeTerrain\(S\.editingSceneId\);/);
  // Un seul écran au centre : l'éditeur de bâtiment ferme celui de terrain, et réciproquement par les clics.
  assert.match(ev, /if \(editeurDeTerrainOuvert\(\)\) fermerEditeurDeTerrain\(\); \},/);
  assert.match(ev, /renderSceneList: renderSceneListEtTerrain/);
  // L'aperçu rend la Scène sous une autre caméra, puis remet tout.
  const sc = lire('scene3d.js');
  assert.match(sc, /export function rendreSceneVueLibre3D\(panel, page, cam, scale = 0\.5\)\{/);
  assert.match(sc, /for \(const \[k, avait, v\] of avant\) \{ if \(avait\) panel\[k\] = v; else delete panel\[k\]; \}/);
});

// Signalé : l'aperçu 3D restait uni. La page brute d'une Scène n'a ni w ni h (ils sont sur la Scène) :
// le rendu recevait NaN. L'éditeur reconstruit la page comme currentPage().
test('la page de la Scène porte ses dimensions et son style (comme currentPage)', () => {
  const ui = lire('terrain-editeur-ui.js');
  assert.match(ui, /const page = donnees && \{ w: scene\.w, h: scene\.h, scale: scene\.scale, format: scene\.format, style3d: scene\.style3d,/);
});

// Signalé : au clic droit dans une Scène, le menu disait « Vider la case ».
test('dans une Scène, « Vider la scène » (et ses messages parlent de la Scène)', () => {
  const ev = lire('events.js');
  assert.match(ev, /isSceneCanvas \? 'Vider la scène' : 'Vider la case', S\.appLang\);/);
  assert.match(ev, /'Cette Scène est déjà vide\.'/);
  assert.match(ev, /`Vider cette Scène \? Ses \$\{count\} élément\(s\) seront définitivement supprimés\.`/);
});

// ── #462b-1 : tracer et retoucher les Zones et les Tracés dans l'éditeur ─────────────────────
test('une Zone entre deux coins (dans l\'ordre tl, tr, br, bl) ; trop petite, rien', () => {
  const z = P.zoneEntre({ x: 4, z: 3 }, { x: 0, z: 0 });
  assert.deepEqual(z.corners, [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }]);
  assert.deepEqual([z.cx, z.cz, z.w, z.h, z.rotY], [2, 1.5, 4, 3, 0]);
  assert.equal(P.zoneEntre({ x: 0, z: 0 }, { x: 0.2, z: 5 }), null);
});

test('un Tracé par ses points, sa largeur selon le genre ; déplacer copie et décale tout', () => {
  assert.equal(P.traceDePoints('route', [{ x: 0, z: 0 }]), null);
  assert.equal(P.traceDePoints('route', [{ x: 0, z: 0 }, { x: 5, z: 0 }]).width, 5);
  assert.equal(P.traceDePoints('chemin', [{ x: 0, z: 0 }, { x: 5, z: 0 }]).width, 1.5);
  const z = P.zoneEntre({ x: 0, z: 0 }, { x: 2, z: 2 });
  const d = P.deplacerLeMonde(z, 1, -1);
  assert.deepEqual([d.cx, d.cz], [2, 0]);
  assert.deepEqual(d.corners[0], { x: 1, z: -1 });
  assert.deepEqual(z.corners[0], { x: 0, z: 0 }, 'l\'original ne bouge pas');
  const t = P.deplacerLeMonde({ pts: [{ x: 0, z: 0 }, { x: 1, z: 0 }], width: 3 }, 2, 2);
  assert.deepEqual(t.pts, [{ x: 2, z: 2 }, { x: 3, z: 2 }]);
  assert.equal(t.width, 3);
});

test('sous le point : un Élément d\'abord, puis un Tracé (sa largeur), puis une Zone, puis un bâtiment', () => {
  const formes = [
    { type: 'zone', id: 'z', pts: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }] },
    { type: 'trace', id: 't', pts: [{ x: 0, z: 5 }, { x: 10, z: 5 }], largeur: 2 },
    { type: 'batiment', id: 'b', polys: [[{ x: 20, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 10 }, { x: 20, z: 10 }]] },
    { type: 'element', id: 'e', x: 5, z: 5.5 },
  ];
  assert.equal(P.sousLePoint(formes, { x: 5, z: 5.4 }, 0.3).id, 'e');
  assert.equal(P.sousLePoint(formes, { x: 2, z: 5.9 }, 0.3).id, 't');
  assert.equal(P.sousLePoint(formes, { x: 2, z: 8 }, 0.3).id, 'z');
  assert.equal(P.sousLePoint(formes, { x: 25, z: 5 }, 0.3).id, 'b');
  assert.equal(P.sousLePoint(formes, { x: 50, z: 50 }, 0.3), null);
});

test('câblage : Tracer et Zone ne sont plus au clic droit d\'une Scène ; la page redessinée rafraîchit l\'éditeur', () => {
  const ev = lire('events.js');
  assert.match(ev, /document\.getElementById\('ctxTracerTrigger'\)\.style\.display = 'none';/);
  assert.match(ev, /document\.getElementById\('ctxZoneTrigger'\)\.style\.display   = 'none';/);
  assert.match(ev, /const updateSidePanelEtTerrain = \(\) => \{ updateSidePanel\(\); rafraichirEditeurDeTerrain\(\); \};/);
  assert.match(ev, /regler: \(obj\) => \{ if \(obj\.tracéType === 'terrain'\) openTerrainModal\(obj\); else openTracéModal\(obj\); \},/);
  const html = lire('index.html');
  for (const id of ['terrainOutilSelection', 'terrainOutilZone', 'terrainOutilTrace', 'terrainSecTrace', 'terrainSecChoisi']) assert.match(html, new RegExp(`id="${id}"`));
});

// Signalé : la rotation et le déplacement de l'aperçu étaient bien plus rapides que dans l'éditeur de bâtiment.
test('l\'aperçu tourne et se déplace aux vitesses communes (comme l\'éditeur de bâtiment)', async () => {
  const { vitesseRotation3D, vitesseDeplacement3D, facteurDeZoom3D } = await import('../src/utils.js');
  const cam = { rotX: Math.PI / 2 - 0.01, rotY: 0, dist: 40, x: 0, y: 0, z: 0 };
  assert.ok(Math.abs(bougerCameraApercu(cam, 'tourner', 100, 0).rotY - -100 * vitesseRotation3D()) < 1e-12);
  // Vu de dessus, glisser de 100 px déplace de 100 px d'aperçu à la distance de la caméra, à la vitesse commune.
  const d = bougerCameraApercu(cam, 'deplacer', 100, 0, 0.001);
  assert.ok(Math.abs(d.x - -100 * 0.001 * 40 * vitesseDeplacement3D()) < 1e-9);
  assert.ok(Math.abs(zoomerCameraApercu(cam, 100).dist - 40 * facteurDeZoom3D(100)) < 1e-9);
});

// ── #462b-2 : la sous-catégorie « Terrain », et ce qui ne se modifie plus que dans l'éditeur ────
test('câblage : sous-catégories Terrain et Non visible repliables ; clic droit « Modifier » ; plus de retouche sur la Scène', () => {
  const sb = lire('sidebar.js');
  assert.match(sb, /sousCategorie\('sous-categorie:terrain', tr\(`Terrain \(\$\{panelTracés\.length\}\)`/);
  assert.match(sb, /sousCategorie\('sous-categorie:non-visible',/);
  assert.match(sb, /if \(_openTerrainMenu\) _openTerrainMenu\(e, \{ element: t, panel \}\);/);
  const ev = lire('events.js');
  assert.match(ev, /if \(c && S\.editingSceneId && isLockedScenePanel\(c\.panel\)\) ouvrirEditeurDeTerrain\(S\.editingSceneId, \{ choisi: c\.element\.id \}\);/);
  assert.match(ev, /b\.disabled = !enScene;/);
  assert.match(ev, /if \(deleted && deleted\.type === 'tracé'\) return;/);
  assert.match(ev, /if \(hit && hit\.type === 'tracé'\) \{\n\s*exitCameraModeOnDeselect\(hit\.id, page\);\n\s*S\.selectedId = hit\.id;[^\n]*\n\s*drawCurrentPage\(\);\n\s*return;/);
  assert.doesNotMatch(ev, /S\.dragMode = 'terrainResize'/);
  assert.match(lire('index.html'), /<div class="context-menu hidden" id="terrainElementMenu">/);
});

// Demandé : les modifications de l'Éditeur de terrain ne vont sur la Scène qu'à « Valider ».
test('câblage : l\'annulation de l\'application attend « Valider », la sauvegarde automatique aussi', () => {
  const ev = lire('events.js');
  assert.match(ev, /function snapshot\(\)\{\n(?:\s*\/\/[^\n]*\n)*\s*if \(editeurDeTerrainOuvert\(\)\) \{ noterModificationDuTerrain\(\); return; \}/);
  assert.match(ev, /fermerEditeurDeTerrain\(\)\.then\(ferme => \{ if \(ferme && typeof cible\.click === 'function'\) cible\.click\(\); \}\);/);
  assert.match(lire('io.js'), /if \(S\.terrainEnEdition\) return;/);
  assert.match(lire('index.html'), /<button id="terrainValiderBtn" type="button" class="full-btn" disabled>Valider<\/button>/);
});
