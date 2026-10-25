/**
 * Le sélecteur de couleur de l'application (src/selecteur-couleur.js), à la place de celui du système.
 */
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hexNormalise, hexVersTsv, tsvVersHex, ancreDuSelecteur } from '../src/selecteur-couleur.js';

describe('le sélecteur de couleur (demandé : placé à côté, aux couleurs de l\'application, avec ses boutons)', () => {
  test('les codes se lisent avec ou sans dièse, en trois ou six chiffres ; le reste est refusé', () => {
    assert.equal(hexNormalise('#A0B0C0'), '#a0b0c0');
    assert.equal(hexNormalise('fa3'), '#ffaa33');
    assert.equal(hexNormalise('#12345'), null);
    assert.equal(hexNormalise('vert'), null);
  });

  test('aller-retour TSV : toute couleur revient à elle-même', () => {
    for (const c of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#4a9c52', '#b39872', '#7b5230', '#123456', '#fedcba']) {
      assert.equal(tsvVersHex(hexVersTsv(c)), c, c);
    }
    assert.deepEqual(hexVersTsv('#ff0000'), { h: 0, s: 1, v: 1 });
    assert.equal(tsvVersHex({ h: 360, s: 1, v: 1 }), '#ff0000');   // la teinte boucle
  });

  test('il s\'ouvre à GAUCHE du conteneur (menu de droite, fenêtre), sinon à droite, sinon sous le champ : jamais dessus', () => {
    const taille = { w: 250, h: 300 }, fenetre = { w: 1600, h: 900 };
    const champ = { left: 1320, right: 1580, top: 400, bottom: 436, height: 36 };
    const gauche = ancreDuSelecteur({ champ, conteneur: { left: 1300, right: 1600 }, taille, fenetre });
    assert.ok(gauche.x + taille.w <= 1300, 'à gauche du menu de droite');
    const droite = ancreDuSelecteur({ champ: { ...champ, left: 20 }, conteneur: { left: 0, right: 300 }, taille, fenetre });
    assert.ok(droite.x >= 300, 'à droite d\'un conteneur collé à gauche');
    const dessous = ancreDuSelecteur({ champ, conteneur: { left: 100, right: 1500 }, taille, fenetre });
    assert.equal(dessous.y, champ.bottom + 10);
  });

  test('câblage : un clic sur un champ couleur ouvre ce sélecteur au lieu de celui du système, pour tous les champs', () => {
    const src = readFileSync(new URL('../src/selecteur-couleur.js', import.meta.url), 'utf8');
    assert.match(src, /champ\.tagName !== 'INPUT' \|\| champ\.type !== 'color'/);
    assert.match(src, /e\.preventDefault\(\);\s*if \(ouvert && ouvert\.champ === champ\)/);
    // Il émet ce qu'émettait le système : le code qui écoute les dix champs n'a pas changé.
    assert.match(src, /emettre\('input'\)/);
    assert.match(src, /emettre\('change'\)/);
    // Échap ferme le sélecteur, pas la fenêtre en dessous.
    assert.match(src, /e\.stopImmediatePropagation\(\);\s*fermer\(true\);/);
    assert.match(readFileSync(new URL('../src/events.js', import.meta.url), 'utf8'), /installerSelecteurCouleur\(\);/);
  });

  test('RÉGRESSION : Annuler ferme le sélecteur, pas le menu (le clic ne remonte pas, le panneau part après lui)', () => {
    const src = readFileSync(new URL('../src/selecteur-couleur.js', import.meta.url), 'utf8');
    assert.match(src, /panneau\.addEventListener\(type, \(e\) => e\.stopPropagation\(\)\);/);
    assert.match(src, /setTimeout\(\(\) => panneau\.remove\(\), 0\);/);
  });

  test('« Origine » est une icône à droite de la pipette, présente seulement si le champ a une couleur d\'origine', () => {
    const src = readFileSync(new URL('../src/selecteur-couleur.js', import.meta.url), 'utf8');
    assert.match(src, /reinit\.innerHTML = icone\('reinitialiser'\);\s*if \(origine\) ligne\.appendChild\(reinit\);/);
    assert.match(src, /actions\.append\(annuler, valider\);/);
  });

  test('Annuler n\'émet rien si la couleur n\'a pas bougé (sinon une étape d\'annulation vide)', () => {
    const src = readFileSync(new URL('../src/selecteur-couleur.js', import.meta.url), 'utf8');
    assert.match(src, /if \(!touche\) return;/);
  });
});
