/**
 * #454e : le mobilier posé dans l'éditeur de bâtiment (src/batiment-mobilier.js), et son rendu 3D.
 */
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../node_modules/three/build/three.module.js';
import { creerBatiment } from '../src/batiment.js';
import { ajouterMur } from '../src/batiment-trace.js';
import { actualiserPieces } from '../src/batiment-pieces.js';
import { construireBatiment3D, materiauxBatiment3D } from '../src/batiment-3d.js';
import * as M from '../src/batiment-mobilier.js';
import { collectModelFiles } from '../src/model-cache.js';

/** Une pièce de 4 × 3 m (murs de 20 cm, axes sur le contour), avec un meuble de 1 × 0,5 × 0,8 m au centre. */
function unePieceMeublee(){
  const b = creerBatiment('Essai');
  const pts = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }];
  for (let i = 0; i < 4; i++) ajouterMur(b, 'n0', pts[i], pts[(i + 1) % 4], 0.2);
  actualiserPieces(b, 'n0', (en, fr) => fr);
  const m = M.ajouterMeuble(b, 'n0', { modelFile: 'commode.glb', centre: { x: 2, z: 1.5 }, mesurees: [1, 0.5, 0.8] });
  return { b, m };
}

describe('le mobilier d\'un bâtiment (#454e)', () => {
  test('posé au centre voulu, à ses dimensions ; son nom est celui du fichier', () => {
    const { b, m } = unePieceMeublee();
    assert.deepEqual([m.x, m.z, m.rotY, m.echelle], [2, 1.5, 0, 1]);
    assert.deepEqual(m.dims, [1, 0.5, 0.8]);
    assert.equal(m.nom, 'commode');
    assert.equal(b.elements.length, 1);
  });

  test('un modèle fait dans une autre unité (180 m de haut) est ramené à 1 m, proportions gardées', () => {
    const r = M.dimensionsDeDepart([90, 45, 180]);
    assert.deepEqual(r.dims, [0.5, 0.25, 1]);
    assert.ok(Math.abs(r.base - 1 / 180) < 1e-12);
    assert.deepEqual(M.dimensionsDeDepart(null).dims, [1, 1, 1]);
  });

  test('on le trouve sous la souris, même tourné', () => {
    const { b, m } = unePieceMeublee();
    assert.equal(M.meubleSous(b, 'n0', { x: 2.45, z: 1.5 }), m.id);   // au bord de sa largeur
    assert.equal(M.meubleSous(b, 'n0', { x: 2, z: 1.9 }), null);       // hors de sa profondeur
    M.tournerMeuble(m);                                                   // un quart de tour : 0,5 × 1
    assert.equal(M.meubleSous(b, 'n0', { x: 2, z: 1.9 }), m.id);
    assert.equal(M.meubleSous(b, 'n0', { x: 2.45, z: 1.5 }), null);
  });

  test('le clic droit fait un quart de tour, et le quatrième revient au départ', () => {
    const { m } = unePieceMeublee();
    for (let i = 0; i < 4; i++) M.tournerMeuble(m);
    assert.equal(m.rotY, 0);
  });

  test('la molette grandit et rétrécit, dans les bornes', () => {
    const { m } = unePieceMeublee();
    M.echelonnerMeuble(m, 1);
    assert.equal(m.echelle, 1.1);
    for (let i = 0; i < 100; i++) M.echelonnerMeuble(m, -1);
    assert.equal(m.echelle, M.ECHELLE_MEUBLE.min);
  });

  test('L\'AIMANT : près d\'un mur, il se colle à sa face ; dans un coin, aux deux', () => {
    const { b, m } = unePieceMeublee();
    // Le mur du haut (z = 0) a sa face intérieure à z = 0,1 ; le meuble fait 0,5 de profondeur.
    const pres = M.aimanterMeuble(b, m, { x: 2, z: 0.45 });
    assert.equal(pres.z, 0.35);   // 0,1 + 0,25
    assert.equal(pres.x, 2);
    // Loin des murs : rien ne bouge.
    assert.deepEqual(M.aimanterMeuble(b, m, { x: 2, z: 1.5 }), { x: 2, z: 1.5, colle: false });
    // Dans le coin (0 ; 0) : collé aux deux faces.
    const coin = M.aimanterMeuble(b, m, { x: 0.7, z: 0.4 });
    assert.deepEqual([coin.x, coin.z], [0.6, 0.35]);
  });

  test('l\'aimant tient compte du quart de tour (la profondeur devient la largeur)', () => {
    const { b, m } = unePieceMeublee();
    M.tournerMeuble(m);   // 0,5 de large, 1 de profondeur
    const pres = M.aimanterMeuble(b, m, { x: 2, z: 0.7 });
    assert.equal(pres.z, 0.6);   // 0,1 + 0,5
  });

  test('en 3D : posé au sol de son niveau, à sa place, tourné (une boîte tant que le modèle n\'est pas là)', () => {
    const { b, m } = unePieceMeublee();
    M.tournerMeuble(m);
    const g = construireBatiment3D(THREE, b, materiauxBatiment3D(THREE));
    const meuble = g.children.find(o => o.userData.meubleId === m.id);
    assert.ok(meuble, 'le meuble est dans le groupe');
    assert.deepEqual([meuble.position.x, meuble.position.y, meuble.position.z], [2, 0, 1.5]);
    assert.ok(Math.abs(meuble.rotation.y - Math.PI / 2) < 1e-9);
    const boite = new THREE.Box3().setFromObject(meuble);
    assert.ok(Math.abs(boite.min.y) < 1e-6, 'au sol');
    assert.ok(Math.abs(boite.max.y - 0.8) < 1e-6, 'à sa hauteur');
  });

  test('les Cases préchargent ses modèles avec la page, et les signalent s\'ils manquent', () => {
    const { b } = unePieceMeublee();
    assert.deepEqual(collectModelFiles([{ type: 'objet3d', objType: 'batiment', batiment: b }]), ['commode.glb']);
    assert.deepEqual(M.fichiersDesMeubles(b), ['commode.glb']);
    assert.match(readFileSync(new URL('../src/rig3d.js', import.meta.url), 'utf8'), /signatureDuBatiment\(b\) \+ '\|' \+ modelCacheSignature\(fichiersDesMeubles\(b\)\)/);
  });

  test('câblage : le bouton de la pièce ouvre le store en mode « choisir » ; clic droit, molette, Suppr', () => {
    const ui = readFileSync(new URL('../src/batiment-editeur-ui.js', import.meta.url), 'utf8');
    assert.match(ui, /\$\('batimentAjouterElement'\)\.onclick = \(\) => \{ if \(E\) ajouterUnElement\(\); \};/);
    assert.match(ui, /ouvrirStore\(\{\s*accepter: \(e\) => !e\.introuvable && !e\.batiment,/);
    assert.match(ui, /if \(x\) tournerMeuble\(x\);/);
    assert.match(ui, /echelonnerMeuble\(x, e\.deltaY < 0 \? 1 : -1\);/);
    assert.match(ui, /modifier\(b => supprimerMeuble\(b, id\)\);/);
  });
});
