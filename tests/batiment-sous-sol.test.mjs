/**
 * #454g, les SOUS-SOLS et le Sol percé : des niveaux sous le rez-de-chaussée, qui reste au Sol ; pas
 * de toit en sous-sol ; un masque invisible perce le Sol de la Case sur leur emprise.
 */
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerBatiment } from '../src/batiment.js';
import { ajouterRectangle } from '../src/batiment-trace.js';
import { actualiserPieces, supprimerPiece } from '../src/batiment-pieces.js';
import { supprimerMur } from '../src/batiment-trace.js';
import * as N from '../src/batiment-niveaux.js';
import { toitsDuNiveau, empriseDesSousSols, estUneTerrasse } from '../src/batiment-toits.js';
import { encombrementDuBatiment } from '../src/batiment-element.js';
import { construireBatiment3D, materiauxBatiment3D, MARQUE_SOL_PERCE } from '../src/batiment-3d.js';

const fr = (en, f) => f;
const resume = (b) => N.niveauxTries(b).map(n => `${n.nom}@${n.elevation}`);

describe('les niveaux : le rez-de-chaussée reste au Sol', () => {
  test('ajouter un sous-sol le pose sous le plus bas, nommé ; le rez-de-chaussée reste à 0', () => {
    const b = creerBatiment('M', fr);
    N.ajouterEtage(b, fr);
    N.ajouterSousSol(b, fr);
    N.ajouterSousSol(b, fr);
    assert.deepEqual(resume(b), ['Sous-sol 2@-6', 'Sous-sol@-3', 'Rez-de-chaussée@0', 'Étage 1@3']);
    assert.equal(N.nbSousSols(b), 2);
    // Le plafond d'un sous-sol est le plancher du niveau d'au-dessus : une seule dalle entre les deux.
    const [s2, s1] = N.niveauxTries(b);
    assert.ok(Math.abs(s1.elevation + s1.hauteur + N.niveauxTries(b)[2].dalle) < 1e-9);
    assert.ok(Math.abs(s2.elevation + s2.hauteur + s1.dalle - s1.elevation) < 1e-9);
  });
  test('un étage de plus, un sous-sol plus haut, un étage supprimé : le rez-de-chaussée ne bouge pas', () => {
    const b = creerBatiment('M', fr);
    const s = N.ajouterSousSol(b, fr);
    N.ajouterEtage(b, fr);
    N.modifierNiveau(b, s.id, { hauteur: 3.5 });
    assert.deepEqual(resume(b), ['Sous-sol@-3.7', 'Rez-de-chaussée@0', 'Étage 1@3']);
    N.supprimerNiveau(b, N.niveauxTries(b)[2].id, fr);
    assert.deepEqual(resume(b), ['Sous-sol@-3.7', 'Rez-de-chaussée@0']);
  });
  test('supprimer le rez-de-chaussée : l\'étage le devient ; supprimer le sous-sol : rien ne descend', () => {
    const b = creerBatiment('M', fr);
    N.ajouterSousSol(b, fr); N.ajouterEtage(b, fr);
    N.supprimerNiveau(b, N.niveauxTries(b)[1].id, fr);
    assert.deepEqual(resume(b), ['Sous-sol@-3', 'Rez-de-chaussée@0']);
    N.supprimerNiveau(b, N.niveauxTries(b)[0].id, fr);
    assert.deepEqual(resume(b), ['Rez-de-chaussée@0']);
  });
  test('dupliquer un sous-sol en fait un de plus ; réordonner garde le nombre de sous-sols', () => {
    const b = creerBatiment('M', fr);
    const s = N.ajouterSousSol(b, fr);
    N.dupliquerNiveau(b, s.id, fr);
    assert.equal(N.nbSousSols(b), 2);
    assert.equal(N.niveauxTries(b)[2].elevation, 0);
    N.deplacerNiveau(b, N.niveauxTries(b)[0].id, 2, fr);
    assert.equal(N.nbSousSols(b), 2);
    assert.equal(N.niveauxTries(b)[2].elevation, 0);
  });
});

function avecSousSol(){
  const b = creerBatiment('M', fr);
  ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: 6, z: 4 }, 0.2);
  actualiserPieces(b, 'n0', fr);
  const s = N.ajouterSousSol(b, fr);
  // Le sous-sol déborde du rez-de-chaussée (une partie sous le jardin).
  ajouterRectangle(b, s.id, { x: 0, z: 0 }, { x: 9, z: 4 }, 0.2);
  actualiserPieces(b, s.id, fr);
  return { b, s };
}

describe('le sous-sol dans le bâtiment', () => {
  test('pas de toit en sous-sol ; l\'encombrement hors Sol ne change pas', () => {
    const { b, s } = avecSousSol();
    assert.deepEqual(toitsDuNiveau(b, s.id), []);
    assert.ok(toitsDuNiveau(b, 'n0').length, 'le rez-de-chaussée garde le sien');
    // Mesurée depuis le Sol (0) : le sous-sol n'y ajoute rien.
    const sans = creerBatiment('M', fr);
    ajouterRectangle(sans, 'n0', { x: 0, z: 0 }, { x: 6, z: 4 }, 0.2);
    actualiserPieces(sans, 'n0', fr);
    assert.equal(encombrementDuBatiment(b).hauteur, encombrementDuBatiment(sans).hauteur);
  });
  test('son emprise, à la face extérieure des murs, perce le Sol', () => {
    const { b } = avecSousSol();
    const e = empriseDesSousSols(b);
    assert.ok(e.length >= 1);
    const xs = e.flat().map(p => p.x);
    assert.ok(Math.abs(Math.min(...xs) + 0.1) < 1e-6 && Math.abs(Math.max(...xs) - 9.1) < 1e-6, JSON.stringify([Math.min(...xs), Math.max(...xs)]));
    assert.deepEqual(empriseDesSousSols(creerBatiment('M', fr)), [], 'sans sous-sol, rien');
  });
  test('le masque : seulement coupé au sous-sol ; invisible, marque le pochoir, avant le Sol, hors sélection ; seulement placé', () => {
    const T = globalThis.THREE;
    const { b } = avecSousSol();
    const masques = (g) => { const r = []; g.traverse(o => { if (o.userData && o.userData.masqueDuSol) r.push(o); }); return r; };
    // Entier (non coupé) : le Sol n'est pas percé, il couvre le sous-sol (demandé).
    assert.equal(masques(construireBatiment3D(T, b, materiauxBatiment3D(T), { percerLeSol: true })).length, 0);
    const g = construireBatiment3D(T, b, materiauxBatiment3D(T), { percerLeSol: true, jusquA: N.niveauxTries(b)[0].id });
    const m = masques(g);
    assert.ok(m.length >= 1);
    assert.equal(m[0].material.colorWrite, false);
    assert.equal(m[0].material.stencilWrite, true);
    assert.equal(m[0].material.stencilRef, MARQUE_SOL_PERCE);
    assert.ok(m[0].renderOrder < 0);
    assert.equal(masques(construireBatiment3D(T, b, materiauxBatiment3D(T))).length, 0, 'l\'éditeur n\'en a pas');
    // Sa boîte descend sous le Sol : le sous-sol est dessiné.
    assert.ok(new T.Box3().setFromObject(g).min.y < -2.5);
  });
  test('une cour de sous-sol a un sol (le fond de la fosse)', () => {
    const b = creerBatiment('M', fr);
    const s = N.ajouterSousSol(b, fr);
    ajouterRectangle(b, s.id, { x: 0, z: 0 }, { x: 10, z: 10 }, 0.2);
    ajouterRectangle(b, s.id, { x: 3, z: 3 }, { x: 7, z: 6 }, 0.2);
    actualiserPieces(b, s.id, fr);
    const ilot = b.pieces.find(p => p.niveauId === s.id && Math.abs(p.repere.x - 5) < 2 && Math.abs(p.repere.z - 4.5) < 2);
    supprimerPiece(b, s.id, ilot.id, supprimerMur);
    assert.equal(estUneTerrasse(b, b.pieces.find(p => p.id === ilot.id)), true);
  });
});

test('câblage : le Sol ne se dessine pas où le pochoir est marqué ; le bâtiment se pose par sa partie hors Sol', () => {
  const rig = readFileSync(new URL('../src/rig3d.js', import.meta.url), 'utf8');
  assert.match(rig, /stencilRef: MARQUE_SOL_PERCE, stencilFunc: THREE\.NotEqualStencilFunc/);
  assert.match(rig, /\{ jusquA, masques, percerLeSol: true \}/);
  const sc = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(sc, /o\.objType === 'batiment' \? boiteDuBatimentHorsSol3D/);
  assert.match(sc, /const box = boiteDuBatimentHorsSol3D\(fg\);/);
  const ui = readFileSync(new URL('../src/batiment-editeur-ui.js', import.meta.url), 'utf8');
  assert.match(ui, /ICONES_NIVEAUX\.ajouterSousSol, tr\([^)]*\), ajouterUnSousSol\)/);
  // Pour un sous-sol, le niveau de référence (transparence, aimant) est celui du DESSUS (demandé).
  assert.match(ui, /return estUnSousSol\(n\) \? niveauDessus\(E\.batiment, E\.niveauId\) : niveauDessous\(E\.batiment, E\.niveauId\);/);
});

test('dupliquer EN DESSOUS : sous le rez-de-chaussée, un sous-sol de plus ; sous un étage, un étage de plus', () => {
  const b = creerBatiment('M', fr);
  ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: 6, z: 4 }, 0.2);
  actualiserPieces(b, 'n0', fr);
  const copie = N.dupliquerNiveau(b, 'n0', fr, { dessous: true });
  assert.equal(N.nbSousSols(b), 1);
  assert.ok(copie.elevation < 0 && N.niveauxTries(b)[1].id === 'n0' && N.niveauxTries(b)[1].elevation === 0);
  assert.equal(b.murs.filter(m => m.niveauId === copie.id).length, 4, 'ses murs sont copiés');
  const e = N.ajouterEtage(b, fr);
  N.dupliquerNiveau(b, e.id, fr, { dessous: true });
  assert.equal(N.nbSousSols(b), 1);
  assert.equal(N.niveauxTries(b).at(-1).id, e.id, 'l\'étage monte d\'un cran');
});

test('dans une Case, le Sol couvre ce que le sous-sol a hors du rez-de-chaussée : pas de dalle là', () => {
  const T = globalThis.THREE;
  const { b } = avecSousSol();
  // La dalle du dessus du sous-sol (jusqu'à x = 9, au ras du Sol) : là où il dépasse du rez-de-chaussée.
  const dallesDehors = (g) => { let n = 0; g.traverse(o => { if (!o.isMesh || !o.geometry) return; const bb = new T.Box3().setFromObject(o);
    if (bb.max.x > 8.5 && bb.max.x - bb.min.x > 5 && bb.max.y <= 1e-6 && bb.max.y > -0.05 && bb.min.y > -0.5) n++; }); return n; };
  assert.ok(dallesDehors(construireBatiment3D(T, b, materiauxBatiment3D(T))) >= 1, 'l\'éditeur la montre');
  assert.equal(dallesDehors(construireBatiment3D(T, b, materiauxBatiment3D(T), { percerLeSol: true })), 0);
});
