/**
 * #454d avec #446e : les REVÊTEMENTS d'un bâtiment (src/batiment-revetements.js) et le constructeur
 * 3D qui les pose face par face (src/batiment-3d.js), construit pour de vrai avec three.
 */
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../node_modules/three/build/three.module.js';
import { readFileSync } from 'node:fs';
import { creerBatiment } from '../src/batiment.js';
import { ajouterMur, couperMur } from '../src/batiment-trace.js';
import { actualiserPieces } from '../src/batiment-pieces.js';
import { construireBatiment3D, materiauxBatiment3D } from '../src/batiment-3d.js';
import * as R from '../src/batiment-revetements.js';
import { COULEURS_BATIMENT, texturesIntegrees, valeurChoisie, textureDeLaValeur } from '../src/textures-integrees.js';

/** Une pièce de 4 × 3 m, fermée, au rez-de-chaussée. */
function unePiece(){
  const b = creerBatiment('Essai');
  const pts = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }];
  for (let i = 0; i < 4; i++) ajouterMur(b, 'n0', pts[i], pts[(i + 1) % 4], 0.2);
  actualiserPieces(b, 'n0', (en, fr) => fr);
  return b;
}

/** Les couleurs des matières posées sur les faces verticales tournées vers l'intérieur et l'extérieur. */
function couleursDesFaces(b){
  const g = construireBatiment3D(THREE, b, materiauxBatiment3D(THREE));
  const parCote = { dedans: new Set(), dehors: new Set() };
  g.traverse(o => {
    // Les faces des MURS seulement : le collecteur fait des BufferGeometry nues ; la dalle (une
    // extrusion) a aussi des bords verticaux, cachés dans les murs, à la matière du mur.
    if (!o.isMesh || o.geometry.type !== 'BufferGeometry') return;
    const pos = o.geometry.getAttribute('position'), nor = o.geometry.getAttribute('normal');
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(nor.getY(i)) > 0.5) continue;
      // Une face verticale : tournée vers le centre de la pièce (2 ; 1,5) ou vers l'extérieur ?
      const vx = 2 - pos.getX(i), vz = 1.5 - pos.getZ(i);
      const cote = nor.getX(i) * vx + nor.getZ(i) * vz > 0 ? 'dedans' : 'dehors';
      parCote[cote].add('#' + o.material.color.getHexString());
    }
  });
  return parCote;
}

describe('les revêtements d\'un bâtiment (#454d, #446e)', () => {
  test('sans revêtement, rien ne change : l\'uni d\'avant, partout', () => {
    const c = couleursDesFaces(unePiece());
    assert.deepEqual([...c.dedans], [COULEURS_BATIMENT['mur-int']]);
    assert.deepEqual([...c.dehors], [COULEURS_BATIMENT['mur-ext']]);
  });

  test('les murs d\'une pièce habillent les faces tournées vers elle, la façade celles du dehors', () => {
    const b = unePiece();
    b.pieces[0].murs = { texture: null, couleur: '#aa0000' };
    b.facade = { texture: null, couleur: '#0000aa' };
    const c = couleursDesFaces(b);
    assert.deepEqual([...c.dedans], ['#aa0000']);
    assert.deepEqual([...c.dehors], ['#0000aa']);
  });

  test('le sol et le plafond de la pièce prennent les leurs', () => {
    const b = unePiece();
    b.pieces[0].sol = { texture: null, couleur: '#00aa00' };
    b.pieces[0].plafond = { texture: null, couleur: '#aaaa00' };
    const g = construireBatiment3D(THREE, b, materiauxBatiment3D(THREE));
    const couleurs = [];
    g.traverse(o => { if (o.isMesh) couleurs.push('#' + o.material.color.getHexString()); });
    assert.ok(couleurs.includes('#00aa00'), 'sol');
    assert.ok(couleurs.includes('#aaaa00'), 'plafond');
  });

  test('les UV des murs sont en MÈTRES : la texture garde sa taille, quelle que soit la longueur du mur', () => {
    const b = unePiece();
    b.facade = { texture: null, couleur: '#0000aa' };
    const g = construireBatiment3D(THREE, b, materiauxBatiment3D(THREE));
    let ecartU = 0, ecartV = 0;
    g.traverse(o => {
      if (!o.isMesh || o.material.color.getHexString() !== '0000aa') return;
      const uv = o.geometry.getAttribute('uv');
      // La première face (4 sommets) : la façade le long du mur de 4 m (4,2 m avec les angles).
      ecartU = Math.abs(uv.getX(1) - uv.getX(0));
      ecartV = Math.abs(uv.getY(2) - uv.getY(1));
    });
    assert.ok(Math.abs(ecartU - 4.2) < 1e-6, `largeur en UV : ${ecartU}`);
    assert.ok(Math.abs(ecartV - b.niveaux[0].hauteur - b.niveaux[0].dalle) < 0.05 || ecartV > 2, `hauteur en UV : ${ecartV}`);
  });

  test('la façade propre d\'un mur l\'emporte sur celle du bâtiment', () => {
    const b = unePiece();
    b.facade = { texture: null, couleur: '#0000aa' };
    b.murs[0].revetement.exterieur = { texture: null, couleur: '#00aaaa' };
    assert.deepEqual(R.revetementDeLaFace(b, 'n0', b.murs[0], null), { texture: null, couleur: '#00aaaa' });
    assert.deepEqual(R.revetementDeLaFace(b, 'n0', b.murs[1], null), { texture: null, couleur: '#0000aa' });
  });

  test('normaliser : une référence inconnue ou une couleur illisible ne passent pas ; vide = rien', () => {
    assert.equal(R.normaliserRevetement({ texture: 'http://x', couleur: 'rouge' }), null);
    assert.equal(R.normaliserRevetement({}), null);
    assert.deepEqual(R.normaliserRevetement({ texture: 'int:sol:plancher', couleur: '#ABCDEF' }), { texture: 'int:sol:plancher', couleur: '#abcdef' });
  });

  test('une texture livrée se peint avec son grain, sa teinte (ou la couleur choisie) et sa tuile', () => {
    const p = R.peintureDuRevetement({ texture: 'int:trace:muret' }, 'mur-ext');
    assert.equal(p.grain, 'muret.couleur');
    assert.deepEqual(p.tuile, [2.4, 1.2]);
    assert.equal(R.peintureDuRevetement({ texture: 'int:trace:muret', couleur: '#123456' }, 'mur-ext').teinte, '#123456');
    // Une texture de « Mes textures » absente sur cette machine : l'uni, sans erreur.
    assert.deepEqual(R.peintureDuRevetement({ texture: 'tex:absente' }, 'sol-int'), { couleur: COULEURS_BATIMENT['sol-int'] });
  });

  test('le store en mode « choisir » : le jeu fourni pour les bâtiments, et « Sans texture »', () => {
    const t = texturesIntegrees();
    const pour = (u) => t.filter(x => x.usages.includes(u)).map(x => x.id);
    assert.ok(pour('sol-int').includes('sol:plancher') && pour('sol-int').includes('uni'));
    assert.ok(pour('mur-ext').includes('trace:muret'));
    assert.equal(valeurChoisie(t.find(x => x.id === 'sol:plancher'), 'sol-int'), 'int:sol:plancher');
    assert.equal(valeurChoisie(t.find(x => x.uni), 'mur-int'), null);
    assert.equal(valeurChoisie({ dossier: 'polyhaven-x', usages: ['mur-int'] }, 'mur-int'), 'tex:polyhaven-x');
    assert.equal(textureDeLaValeur(null, 'plafond').id, 'uni');
    assert.equal(textureDeLaValeur('int:trace:muret', 'mur-ext').id, 'trace:muret');
    // Le Sol et les Tracés ne changent pas : le plancher reste « plancher » pour le Sol.
    assert.equal(valeurChoisie(t.find(x => x.id === 'sol:plancher'), 'sol'), 'plancher');
  });
});

describe('les retours du 26 octobre (#454d)', () => {
  test('une pièce NÉE dans une autre en hérite les revêtements (murs, sol, plafond)', () => {
    const b = unePiece();
    b.pieces[0].sol = { texture: 'int:sol:plancher', couleur: null };
    b.pieces[0].murs = { texture: null, couleur: '#aa0000' };
    const avant = JSON.parse(JSON.stringify(b));
    // Une cloison qui coupe la pièce en deux, de (2 ; 0) à (2 ; 3) : comme le tracé, on coupe d'abord
    // les deux murs touchés à la jonction (un T), puis on pose la cloison.
    couperMur(b, b.murs[0].id, { x: 2, z: 0 });
    couperMur(b, b.murs.find(m => m.a.z === 3 && m.b.z === 3).id, { x: 2, z: 3 });
    ajouterMur(b, 'n0', { x: 2, z: 0 }, { x: 2, z: 3 }, 0.1);
    actualiserPieces(b, 'n0', (en, fr) => fr, avant);
    assert.equal(b.pieces.length, 2);
    for (const p of b.pieces) {
      assert.deepEqual(p.sol, { texture: 'int:sol:plancher', couleur: null }, p.nom);
      assert.deepEqual(p.murs, { texture: null, couleur: '#aa0000' }, p.nom);
    }
    // Une copie, pas la même référence : changer l'une ne change pas l'autre.
    assert.notEqual(b.pieces[0].sol, b.pieces[1].sol);
  });

  test('la façade est celle du BÂTIMENT, pour tous les étages', () => {
    const lire = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
    assert.match(lire('batiment-revetements.js'), /return normaliserRevetement\(b && b\.facade\);/);
    assert.match(lire('batiment-editeur-ui.js'), /cible: \{ batiment: true \}, champ: 'facade'/);
    assert.ok(lire('index.html').indexOf('id="batimentFacade"') < lire('index.html').indexOf('id="batimentSectionNiveaux"'), 'dans la section Bâtiment');
  });

  test('la section de la pièce porte son nom, et se cache sans pièce', () => {
    const ui = readFileSync(new URL('../src/batiment-editeur-ui.js', import.meta.url), 'utf8');
    assert.match(ui, /\$\('batimentSectionPiece'\)\.hidden = !piece;/);
    assert.match(ui, /\$\('batimentSectionRevetements'\)\.textContent = piece\.nom;/);
  });

  test('Suppr supprime la pièce choisie, même après un réglage de couleur (le champ couleur ne retient pas les touches)', () => {
    const ui = readFileSync(new URL('../src/batiment-editeur-ui.js', import.meta.url), 'utf8');
    assert.match(ui, /&& pieceSelectionnee\(\)\) \{\s*supprimerPieceDeLEditeur\(E\.selection\.pieceId\);/);
    assert.match(ui, /typeDuChamp !== 'color' && typeDuChamp !== 'checkbox'/);
  });

  test('RÉGRESSION : fermer l\'aperçu ne plante plus sur la fabrique des revêtements ; un grain arrivé refait l\'aperçu', () => {
    const ui = readFileSync(new URL('../src/batiment-editeur-ui.js', import.meta.url), 'utf8');
    assert.match(ui, /if \(m && typeof m\.dispose === 'function'\) m\.dispose\(\);/);
    assert.match(ui, /window\.addEventListener\('grains-batiment'/);
    assert.match(readFileSync(new URL('../src/batiment-revetements.js', import.meta.url), 'utf8'), /if \(p\.grain && !img\) demanderLeGrain\(p\.grain\);/);
  });
});

describe('le quadrillage de l\'aperçu sous le sol des pièces (signalé)', () => {
  test('il est sous le sol (qui est à +5 mm), assez pour que la profondeur les départage', () => {
    const ui = readFileSync(new URL('../src/batiment-editeur-ui.js', import.meta.url), 'utf8');
    assert.match(ui, /grille\.position\.y = -0\.03;/);
  });
});
