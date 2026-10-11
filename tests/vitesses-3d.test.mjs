/**
 * tests/vitesses-3d.test.mjs : les vitesses des gestes 3D (clic gauche pour tourner, clic droit pour
 * déplacer) viennent d'UNE seule source, réglée sur l'aperçu du store (demandé). L'aperçu du store,
 * l'Éditeur de modèle et les Scènes (et les Cases en mode Caméra, même code) doivent tous la lire :
 * en changer la valeur doit changer la sensation partout à la fois.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './helpers/dom-stub.mjs';

const { VITESSE_ROTATION_3D, VITESSE_DEPLACEMENT_3D, deplacement3D, reglerVitessesGestes3D, vitesseRotation3D,
  vitesseDeplacement3D, pourcentGeste3D, POURCENT_GESTES_3D } = await import('../src/utils.js');
const { orbite3D } = await import('../src/store-apercu-3d.js');

const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

describe('une seule source', () => {
  test('les deux valeurs, réglées à l\'usage (rotation au quart de Sketchfab, déplacement à la moitié du pointeur)', () => {
    assert.equal(VITESSE_ROTATION_3D, 0.0025);
    assert.equal(VITESSE_DEPLACEMENT_3D, 0.5);
  });

  test('l\'aperçu du store tourne à VITESSE_ROTATION_3D par pixel', () => {
    const a = orbite3D({ lacet: 0, tangage: 0 }, 100, 50);
    assert.ok(Math.abs(a.lacet + 100 * VITESSE_ROTATION_3D) < 1e-12);
    assert.ok(Math.abs(a.tangage - 50 * VITESSE_ROTATION_3D) < 1e-12);
  });

  test('deplacement3D (store et Éditeur) : le point visé suit le pointeur, fois VITESSE_DEPLACEMENT_3D', () => {
    // De face (lacet = tangage = 0), 100 px vers la droite sur une vue de 500 px de haut, champ 36°.
    const parPixel = 2 * 10 * Math.tan(18 * Math.PI / 180) / 500;
    const [x] = deplacement3D([0, 0, 0], { lacet: 0, tangage: 0 }, 100, 0, 10, 500, 36);
    assert.ok(Math.abs(x + 100 * parPixel * VITESSE_DEPLACEMENT_3D) < 1e-9);
  });
});

describe('chaque endroit lit la source commune', () => {
  test('l\'aperçu du store', () => {
    const src = sansCommentaires(lire('src/store-apercu-3d.js'));
    assert.match(src, /lacet - dx \* vitesseRotation3D\(\)/);
    assert.doesNotMatch(src, /dx \* 0\.0\d/, 'une vitesse en dur est revenue');
  });

  test('l\'Éditeur de modèle : plus de vitesse propre', () => {
    const src = sansCommentaires(lire('src/persona-editor.js'));
    assert.match(src, /const k = vitesseRotation3D\(\);/);
    assert.match(src, /deplacement3D\(/);
    assert.doesNotMatch(src, /PERSONA_EDITOR_ORBIT_RAD_PER_PX|PERSONA_EDITOR_PAN_FACTEUR/);
  });

  test('les Scènes et les Cases en mode Caméra : rotation, déplacement, gizmo', () => {
    const src = sansCommentaires(lire('src/events.js'));
    const rot = src.slice(src.indexOf("} else if (S.dragMode === 'panelCamRotate') {"), src.indexOf("} else if (S.dragMode === 'panelCamPan') {"));
    assert.match(rot, /const _k9 = vitesseRotation3D\(\) \* camRotSens \* pixelsEcranParUnitePage\(\);/);
    assert.match(rot, /S\.dragOrig\.camRotY \+ dx \* _k9/);
    assert.match(rot, /S\.dragOrig\.camRotX - dy \* _k9/);
    assert.doesNotMatch(rot, /\* 0\.01|_distF9|_cosP10/, 'la distance ou une vitesse en dur modifie encore la rotation');
    const pan = src.slice(src.indexOf("} else if (S.dragMode === 'panelCamPan') {"), src.indexOf("} else if (S.dragMode === 'moveRoom') {"));
    assert.match(pan, /const _pScale = vitesseDeplacement3D\(\) \* /);
    assert.match(src, /S\.camGizmoDrag\.camRotY \+ dx \* vitesseRotation3D\(\) \* camRotSens/);
  });
});

describe('la préférence de la Configuration (pourcentage des vitesses de base)', () => {
  test('pourcentGeste3D borne, arrondit au pas, et retombe sur 100', () => {
    assert.equal(pourcentGeste3D(100), 100);
    assert.equal(pourcentGeste3D(10), POURCENT_GESTES_3D.min);
    assert.equal(pourcentGeste3D(999), POURCENT_GESTES_3D.max);
    assert.equal(pourcentGeste3D(60), 50);
    assert.equal(pourcentGeste3D('abc'), 100);
    assert.equal(pourcentGeste3D(null), 100);
  });

  test('la préférence multiplie les deux vitesses, et TOUS les gestes la suivent', () => {
    try {
      reglerVitessesGestes3D({ rotation: 50, deplacement: 200 });
      assert.equal(vitesseRotation3D(), VITESSE_ROTATION_3D * 0.5);
      assert.equal(vitesseDeplacement3D(), VITESSE_DEPLACEMENT_3D * 2);
      // Le store (orbite3D) et deplacement3D (store et Éditeur) la lisent sans qu'on les touche.
      assert.ok(Math.abs(orbite3D({ lacet: 0, tangage: 0 }, 100, 0).lacet + 100 * VITESSE_ROTATION_3D * 0.5) < 1e-12);
      const parPixel = 2 * 10 * Math.tan(18 * Math.PI / 180) / 500;
      const [x] = deplacement3D([0, 0, 0], { lacet: 0, tangage: 0 }, 100, 0, 10, 500, 36);
      assert.ok(Math.abs(x + 100 * parPixel * VITESSE_DEPLACEMENT_3D * 2) < 1e-9);
    } finally {
      reglerVitessesGestes3D({ rotation: 100, deplacement: 100 });
    }
    assert.equal(vitesseRotation3D(), VITESSE_ROTATION_3D);
  });

  test('le câblage : lue au démarrage, appliquée et enregistrée au curseur, 100 % par le bouton', () => {
    const ev = sansCommentaires(lire('src/events.js'));
    assert.match(ev, /S\.appVitesseRotation3D = pourcentGeste3D\(settings\.vitesseRotation3D\)/);
    assert.match(ev, /S\.appVitesseDeplacement3D = pourcentGeste3D\(settings\.vitesseDeplacement3D\)/);
    assert.match(ev, /reglerVitessesGestes3D\(\{ rotation: S\.appVitesseRotation3D, deplacement: S\.appVitesseDeplacement3D \}\)/);
    assert.match(ev, /setSetting\('vitesseRotation3D', S\.appVitesseRotation3D\)/);
    assert.match(ev, /setSetting\('vitesseDeplacement3D', S\.appVitesseDeplacement3D\)/);
    const html = lire('src/index.html');
    for (const id of ['gestesRotationRange', 'gestesDeplacementRange']) {
      const balise = html.slice(html.lastIndexOf('<', html.indexOf(`id="${id}"`)), html.indexOf('>', html.indexOf(`id="${id}"`)));
      assert.match(balise, new RegExp(`min="${POURCENT_GESTES_3D.min}" max="${POURCENT_GESTES_3D.max}" step="${POURCENT_GESTES_3D.pas}" value="${POURCENT_GESTES_3D.defaut}"`), id);
    }
  });
});
