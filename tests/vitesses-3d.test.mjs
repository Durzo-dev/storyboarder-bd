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

const { VITESSE_ROTATION_3D, VITESSE_DEPLACEMENT_3D, deplacement3D } = await import('../src/utils.js');
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
    assert.match(src, /lacet - dx \* VITESSE_ROTATION_3D/);
    assert.doesNotMatch(src, /dx \* 0\.0\d/, 'une vitesse en dur est revenue');
  });

  test('l\'Éditeur de modèle : plus de vitesse propre', () => {
    const src = sansCommentaires(lire('src/persona-editor.js'));
    assert.match(src, /const k = VITESSE_ROTATION_3D;/);
    assert.match(src, /deplacement3D\(/);
    assert.doesNotMatch(src, /PERSONA_EDITOR_ORBIT_RAD_PER_PX|PERSONA_EDITOR_PAN_FACTEUR/);
  });

  test('les Scènes et les Cases en mode Caméra : rotation, déplacement, gizmo', () => {
    const src = sansCommentaires(lire('src/events.js'));
    const rot = src.slice(src.indexOf("} else if (S.dragMode === 'panelCamRotate') {"), src.indexOf("} else if (S.dragMode === 'panelCamPan') {"));
    assert.match(rot, /const _k9 = VITESSE_ROTATION_3D \* camRotSens \* pixelsEcranParUnitePage\(\);/);
    assert.match(rot, /S\.dragOrig\.camRotY \+ dx \* _k9/);
    assert.match(rot, /S\.dragOrig\.camRotX - dy \* _k9/);
    assert.doesNotMatch(rot, /\* 0\.01|_distF9|_cosP10/, 'la distance ou une vitesse en dur modifie encore la rotation');
    const pan = src.slice(src.indexOf("} else if (S.dragMode === 'panelCamPan') {"), src.indexOf("} else if (S.dragMode === 'moveRoom') {"));
    assert.match(pan, /const _pScale = VITESSE_DEPLACEMENT_3D \* /);
    assert.match(src, /S\.camGizmoDrag\.camRotY \+ dx \* VITESSE_ROTATION_3D \* camRotSens/);
  });
});
