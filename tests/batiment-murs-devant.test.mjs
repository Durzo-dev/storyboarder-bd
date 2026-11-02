/**
 * #459b : les murs de devant (entre la caméra et l'intérieur), masqués selon la caméra (le mode abaissé retiré).
 */
import './helpers/dom-stub.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerBatiment } from '../src/batiment.js';
import { ajouterRectangle } from '../src/batiment-trace.js';
import { actualiserPieces } from '../src/batiment-pieces.js';
import * as D from '../src/batiment-murs-devant.js';
import { construireBatiment3D, materiauxBatiment3D } from '../src/batiment-3d.js';

const fr = (en, f) => f;
function maison(){
  const b = creerBatiment('M', fr);
  ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: 6, z: 4 }, 0.2);
  actualiserPieces(b, 'n0', fr);
  return b;
}
const murEn = (b, z) => b.murs.find(m => Math.abs(m.a.z - z) < 1e-6 && Math.abs(m.b.z - z) < 1e-6).id;

test('la caméra au sud (+z) : seul le mur sud est devant ; à l\'ouest, le mur ouest ; à la verticale, aucun', () => {
  const b = maison();
  assert.deepEqual(D.mursDeDevant(b, { x: 0, z: 1 }), [murEn(b, 4)]);
  const ouest = D.mursDeDevant(b, { x: -1, z: 0 });
  assert.equal(ouest.length, 1);
  assert.ok(b.murs.find(m => m.id === ouest[0]).a.x === 0);
  // En diagonale (45°), les deux murs qui la regardent.
  assert.equal(D.mursDeDevant(b, { x: 1, z: 1 }).length, 2);
  assert.deepEqual(D.mursDeDevant(b, { x: 0, z: 0 }), []);
});

test('la direction monde ramenée dans le repère du bâtiment tourné', () => {
  const v = D.versLaCameraDansLeBatiment({ x: 1, z: 0 }, Math.PI / 2);
  assert.ok(Math.abs(v.x) < 1e-9 && Math.abs(v.z - 1) < 1e-9, JSON.stringify(v));
});

test('le réglage : visibles par défaut (rien d\'enregistré), ou masqués ; « abaisses » (1.15.3) compte pour masqués', () => {
  const o = {};
  assert.equal(D.mursDevantMasques(o), false);
  D.fixerMursDevantMasques(o, true);
  assert.deepEqual(o.affichage, { mursDevant: 'masques' });
  assert.equal(D.mursDevantMasques(o), true);
  D.fixerMursDevantMasques(o, false);
  assert.equal(o.affichage, undefined);
  assert.equal(D.mursDevantMasques({ affichage: { mursDevant: 'abaisses' } }), true);
  assert.equal('HAUTEUR_MUR_ABAISSE' in D, false);
});

test('le rendu : masqué, le mur sud disparaît', () => {
  const T = globalThis.THREE;
  const b = maison();
  const sud = murEn(b, 4);
  // Les murs sont fusionnés en un seul maillage : on lance un rayon vertical au milieu du mur sud,
  // dans son épaisseur mais hors de la dalle (z = 4,07), et on garde le premier point touché.
  const hautSud = (g) => { g.updateMatrixWorld(true);
    const r = new T.Raycaster(new T.Vector3(3, 50, 4.07), new T.Vector3(0, -1, 0));
    const h = r.intersectObject(g, true); return h.length ? h[0].point.y : -Infinity; };
  assert.ok(hautSud(construireBatiment3D(T, b, materiauxBatiment3D(T))) > 2);
  assert.equal(hautSud(construireBatiment3D(T, b, materiauxBatiment3D(T), { devant: [sud] })), -Infinity);
});

test('câblage : calculé par Case selon sa caméra, dans la signature du rig ; réglage et bouton de l\'aperçu', () => {
  const lire = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  assert.match(lire('scene3d.js'), /retenirMursDevant\(o, mursDeDevant\(o\.batiment, versLaCameraDansLeBatiment\(\{ x: bk\.x, z: bk\.z \}, o\.rotY \|\| 0\)\)\);/);
  assert.match(lire('rig3d.js'), /JSON\.stringify\(mursDevantRetenus\(o\)\)/);
  assert.match(lire('index.html'), /<input type="checkbox" id="sideBatimentDevant"> Masquer les murs de devant/);
  assert.match(lire('batiment-editeur-ui.js'), /devantMasqueApercu = !devantMasqueApercu;/);
  assert.match(lire('index.html'), /id="batimentApercuDevant"/);
  assert.match(lire('batiment-editeur-ui.js'), /if \(sig !== signatureDevant && E\) \{/);
});
