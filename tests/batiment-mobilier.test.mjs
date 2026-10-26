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
    assert.ok(Math.abs(meuble.rotation.y - 3 * Math.PI / 2) < 1e-9);   // un quart de tour horaire
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
    assert.match(ui, /retoucherMeuble\(meubleClic, tournerMeuble\);/);
    assert.match(ui, /echelonnerMeuble\(x, e\.deltaY < 0 \? 1 : -1\);/);
    assert.match(ui, /modifier\(b => supprimerMeuble\(b, id\)\);/);
  });
});

describe('les réglages de l\'élément choisi (demandé)', () => {
  test('« Tourner de 90° » part de l\'angle actuel, même quelconque', () => {
    const { m } = unePieceMeublee();
    m.rotY = 0.3;
    M.tournerMeuble(m);
    assert.ok(Math.abs(m.rotY - (0.3 - Math.PI / 2 + 2 * Math.PI)) < 1e-6);   // horaire : −90°
  });

  test('le clic droit maintenu tourne d\'un angle quelconque, sur tout le tour', () => {
    const { m } = unePieceMeublee();
    M.tournerDe(m, -Math.PI / 4);
    assert.ok(Math.abs(m.rotY - 7 * Math.PI / 4) < 1e-9, 'ramené dans [0 ; 2π[');
    M.tournerDe(m, Math.PI / 4);
    assert.equal(m.rotY, 0);
  });

  test('le curseur de taille est logarithmique : ×1 au milieu, les bornes aux extrémités, aller-retour fidèle', () => {
    assert.equal(M.curseurDeLEchelle(1), 50);
    assert.equal(M.echelleDuCurseur(0), M.ECHELLE_MEUBLE.min);
    assert.equal(M.echelleDuCurseur(100), M.ECHELLE_MEUBLE.max);
    assert.ok(Math.abs(M.echelleDuCurseur(M.curseurDeLEchelle(1.7)) - 1.7) < 0.02);
  });

  test('ses dimensions suivent son échelle', () => {
    const { m } = unePieceMeublee();
    m.echelle = 2;
    assert.deepEqual(M.tailleDuMeuble(m), { largeur: 2, longueur: 1, hauteur: 1.6 });
  });

  test('« Collé au sol » : par défaut ; décoché, sa hauteur au-dessus du sol, en 3D aussi ; recoché, le champ disparaît', () => {
    const { b, m } = unePieceMeublee();
    assert.equal(M.hauteurAuSol(m), 0);
    M.collerAuSol(m, false, 0.75);
    assert.deepEqual([m.colle, m.y, M.hauteurAuSol(m)], [false, 0.75, 0.75]);
    const g = construireBatiment3D(THREE, b, materiauxBatiment3D(THREE));
    assert.equal(g.children.find(o => o.userData.meubleId === m.id).position.y, 0.75);
    M.collerAuSol(m, true);
    assert.ok(!('colle' in m) && !('y' in m));
  });
});

describe('orienter dans tous les sens, et ne pas traverser les murs (demandé)', () => {
  test('incliné, il reste POSÉ sur son point le plus bas (collé au sol), en 3D aussi', () => {
    const { b, m } = unePieceMeublee();
    M.pencherMeuble(m, 'x', Math.PI / 6);
    assert.ok(M.basDuMeuble(m) < 0, 'un coin passe sous son origine');
    const g = construireBatiment3D(THREE, b, materiauxBatiment3D(THREE));
    g.updateMatrixWorld(true);
    const boite = new THREE.Box3().setFromObject(g.children.find(o => o.userData.meubleId === m.id));
    assert.ok(Math.abs(boite.min.y) < 1e-6, `posé au sol : ${boite.min.y}`);
  });

  test('incliner et basculer sont bornés à ±90° ; « Remettre droit » les efface', () => {
    const { m } = unePieceMeublee();
    M.pencherMeuble(m, 'x', 5); M.pencherMeuble(m, 'z', -5);
    assert.deepEqual([m.rotX, m.rotZ].map(v => Math.round(v * 1e6) / 1e6), [Math.round(Math.PI / 2 * 1e6) / 1e6, -Math.round(Math.PI / 2 * 1e6) / 1e6]);
    M.redresserMeuble(m);
    assert.ok(!('rotX' in m) && !('rotZ' in m));
  });

  test('son empreinte suit l\'inclinaison : couché, il prend sa hauteur au sol', () => {
    const { m } = unePieceMeublee();
    M.pencherMeuble(m, 'x', Math.PI / 2);   // couché sur le dos : profondeur 0,8 (sa hauteur)
    const e = M.empreinteDuMeuble(m);
    const zs = e.map(p => p.z);
    assert.ok(Math.abs((Math.max(...zs) - Math.min(...zs)) - 0.8) < 1e-6);
  });

  test('LA COLLISION : contre une face (aimanté), non ; dans le mur, oui ; « Peut traverser les murs », jamais', () => {
    const { b, m } = unePieceMeublee();
    const colle = M.aimanterMeuble(b, m, { x: 2, z: 0.4 });
    m.x = colle.x; m.z = colle.z;
    assert.equal(M.meubleEnCollision(b, m), false, 'collé contre la face');
    m.z = 0.2;   // dans le mur du haut
    assert.equal(M.meubleEnCollision(b, m), true);
    m.traverse = true;
    assert.equal(M.meubleEnCollision(b, m), false);
  });

  test('décollé, il ne descend sous le sol que s\'il peut traverser', () => {
    const { m } = unePieceMeublee();
    M.collerAuSol(m, false, -0.5);
    assert.equal(m.y, 0);
    m.traverse = true;
    M.collerAuSol(m, false, -0.5);
    assert.equal(M.hauteurAuSol(m), -0.5);
  });

  test('le repère : ses axes tournés suivent l\'orientation', () => {
    const { m } = unePieceMeublee();
    M.tournerMeuble(m);   // un quart de tour horaire vu de dessus : son devant (vers le bas de l'écran) regarde à gauche, −x
    const a = M.axesDuMeuble(m);
    assert.ok(Math.abs(a.z.x + 1) < 1e-9 && Math.abs(a.y.y - 1) < 1e-9);
  });

  test('câblage : un geste qui finit dans un mur est défait, l\'élément est rouge pendant', () => {
    const ui = readFileSync(new URL('../src/batiment-editeur-ui.js', import.meta.url), 'utf8');
    assert.match(ui, /if \(E\.collisionMeuble === id\) remettreMeuble\(id, avant\);/);
    assert.match(ui, /if \(E\.collisionMeuble === meuble\) \{ E\.historique\.pop\(\); remettreMeuble\(meuble, avant\); \}/);
    assert.match(ui, /rouge: E \? E\.collisionMeuble : null/);
    // RÉGRESSION : un bouton rotatif, l'angle parcouru AUTOUR de l'élément, cumulé sans saut à ±180°
    // (au mouvement horizontal, le sens s'inversait passé de l'autre côté).
    assert.match(ui, /if \(d > Math\.PI\) d -= 2 \* Math\.PI; else if \(d < -Math\.PI\) d \+= 2 \* Math\.PI;/);
    assert.match(ui, /: meuble \? meuble\.nom : tr\('Selection', 'Sélection'\)/);   // la section au nom de l'élément
  });
});

describe('les retouches de la section (demandé)', () => {
  test('« Remettre droit » rend EXACTEMENT l\'orientation d\'arrivée, rotation comprise', () => {
    const { m } = unePieceMeublee();
    M.tournerDe(m, 0.7); M.pencherMeuble(m, 'x', 0.3); M.pencherMeuble(m, 'z', -0.2);
    M.redresserMeuble(m);
    assert.deepEqual([m.rotY, m.rotX, m.rotZ], [0, undefined, undefined]);
  });
  test('boutons icônes côte à côte ; l\'élévation, toujours là, au-dessus de « Collé au sol »', () => {
    const ui = readFileSync(new URL('../src/batiment-editeur-ui.js', import.meta.url), 'utf8');
    assert.match(ui, /bouton\('quartDeTour',/);
    assert.match(ui, /bouton\('reinitialiser',/);
    assert.match(ui, /hauteur,\s*coche\(tr\('Stuck to the floor', 'Collé au sol'\)/);
    assert.match(ui, /ht\.textContent = tr\('Elevation', 'Élévation'\);/);
    assert.match(readFileSync(new URL('../src/style.css', import.meta.url), 'utf8'), /\.batiment-meuble-boutons\{ display:flex; justify-content:center;/);
  });
});

describe('tourner sur UN axe, choisi dans le repère (demandé)', () => {
  test('fixer un angle : la rotation sur tout le tour, l\'inclinaison et la bascule bornées à ±90°', () => {
    const { m } = unePieceMeublee();
    M.fixerAngle(m, 'y', -Math.PI / 2);
    assert.ok(Math.abs(m.rotY - 3 * Math.PI / 2) < 1e-9);
    M.fixerAngle(m, 'x', Math.PI);
    assert.ok(Math.abs(m.rotX - Math.PI / 2) < 1e-6);
    M.fixerAngle(m, 'z', 0);
    assert.ok(!('rotZ' in m));
  });
  test('câblage : les axes du repère se cliquent ; le clic droit maintenu ne tourne que l\'axe actif ; les angles se saisissent', () => {
    const ui = readFileSync(new URL('../src/batiment-editeur-ui.js', import.meta.url), 'utf8');
    assert.match(ui, /g\.addEventListener\('click', \(\) => \{ axeActif = g\.dataset\.axe; remplirPanneau\(\); \}\)/);
    assert.match(ui, /if \(axeActif === 'y'\) tournerDe\(x, q\(-g\.parcouru\)\);/);
    assert.match(ui, /pencherMeuble\(x, axeActif, q\(delta\)\);/);
    assert.match(ui, /retoucherMeuble\(id, \(x\) => fixerAngle\(x, axe, deg \* Math\.PI \/ 180\)\)/);
  });
});

describe('les retours sur les gestes (demandé)', () => {
  test('le quart de tour suit la FLÈCHE du bouton : le sens horaire vu de dessus (rotY diminue)', () => {
    const { m } = unePieceMeublee();
    M.tournerMeuble(m);
    assert.ok(Math.abs(m.rotY - 3 * Math.PI / 2) < 1e-9);
  });
  test('câblage : décollé, la molette règle l\'élévation ; incliner et basculer au mouvement linéaire', () => {
    const ui = readFileSync(new URL('../src/batiment-editeur-ui.js', import.meta.url), 'utf8');
    assert.match(ui, /if \(x\.colle === false\) \{[\s\S]{0,300}collerAuSol\(x, false, \(x\.y \|\| 0\) \+ pas\);/);
    assert.match(ui, /const delta = axeActif === 'x' \? \(e\.clientY - g\.y0\) \* VITESSE : \(e\.clientX - g\.x0\) \* VITESSE;/);
  });
});
