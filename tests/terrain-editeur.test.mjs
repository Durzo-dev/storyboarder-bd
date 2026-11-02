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
  assert.match(t, /il ne se modifie pas ici/);
  assert.match(t, /Échap ou Quitter : retour à la Scène\./);
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
