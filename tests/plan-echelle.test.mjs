/**
 * tests/plan-echelle.test.mjs : #456d, l'échelle d'un plan : les unités (dont la toise et le pied du
 * roi), l'estimation par les portes ou par les murs, la saisie en deux points, le contrôle.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { UNITES_DE_LONGUEUR, estimerLEchelle, echelleDeuxPoints, longueurEntre, controlerLEchelle } from '../src/plan-echelle.js';

const seg = (x0, y0, x1, y1, epaisseur, ouvertures = []) => ({ a: { x: x0, y: y0 }, b: { x: x1, y: y1 }, epaisseur, ouvertures });

describe('#456d, l\'échelle', () => {
  test('les unités : la toise vaut 6 pieds du roi, 1,949 m ; le pied du roi 12 pouces', () => {
    const u = Object.fromEntries(UNITES_DE_LONGUEUR.map(x => [x.id, x.metres]));
    assert.ok(Math.abs(u.toise - 1.949036) < 1e-6);
    assert.ok(Math.abs(u.toise / u['pied-du-roi'] - 6) < 1e-12);
    assert.ok(Math.abs(u['pied-du-roi'] / u['pouce-du-roi'] - 12) < 1e-12);
    assert.ok(Math.abs(u['pied-du-roi'] - 0.3248) < 1e-4);
    assert.equal(u.pied, 0.3048);
    assert.deepEqual(UNITES_DE_LONGUEUR.map(x => x.id), ['m', 'cm', 'toise', 'pied-du-roi', 'pouce-du-roi', 'pied', 'pouce']);
  });

  test('estimée par la largeur médiane des portes à un battant (les portes doubles ne comptent pas)', () => {
    const segs = [
      seg(0, 0, 400, 0, 12, [{ s0: 10, s1: 50, type: 'porte', battants: 1 }, { s0: 100, s1: 220, type: 'porte', battants: 2 }]),
      seg(0, 0, 0, 300, 12, [{ s0: 10, s1: 52, type: 'porte', battants: 1 }, { s0: 80, s1: 118, type: 'porte' }]),
      seg(400, 0, 400, 300, 12, [{ s0: 50, s1: 110, type: 'fenetre' }]),
    ];
    const e = estimerLEchelle(segs);
    assert.equal(e.source, 'portes');
    assert.ok(Math.abs(e.metresParPixel - 0.83 / 40) < 1e-12);
  });

  test('sans porte, estimée (moins sûrement) par les murs les plus épais', () => {
    const segs = [seg(0, 0, 100, 0, 30), seg(0, 0, 0, 100, 30), seg(50, 0, 50, 100, 10), seg(0, 50, 50, 50, 10)];
    const e = estimerLEchelle(segs);
    assert.equal(e.source, 'murs');
    assert.ok(Math.abs(e.metresParPixel - 0.01) < 1e-12);
  });

  test('sans rien, pas d\'estimation', () => {
    assert.deepEqual(estimerLEchelle([]), { metresParPixel: null, source: null });
  });

  test('saisie en deux points, dans l\'unité choisie, sur l\'image originale réduite d\'un facteur', () => {
    // 200 px de l'image originale = 10 toises ; l'image de travail est deux fois plus petite.
    const mpp = echelleDeuxPoints({ x: 0, y: 0 }, { x: 120, y: 160 }, 10, 'toise', 2);
    assert.ok(Math.abs(mpp - 19.49036 / 100) < 1e-6);
    assert.ok(Math.abs(longueurEntre({ x: 0, y: 0 }, { x: 120, y: 160 }, mpp, 'toise', 2) - 10) < 1e-9);
    assert.ok(Math.abs(longueurEntre({ x: 0, y: 0 }, { x: 120, y: 160 }, mpp, 'm', 2) - 19.49036) < 1e-4);
    assert.equal(echelleDeuxPoints({ x: 0, y: 0 }, { x: 0, y: 0 }, 4), null);
    assert.equal(echelleDeuxPoints({ x: 0, y: 0 }, { x: 10, y: 0 }, 0), null);
  });

  test('le contrôle : murs minces ou épais, bâtiment trop petit ou trop grand', () => {
    const segs = [seg(0, 0, 400, 0, 12), seg(0, 0, 0, 300, 12)];
    assert.deepEqual(controlerLEchelle(segs, 0.02), []);
    assert.deepEqual(controlerLEchelle(segs, 0.002), ['murs-minces', 'trop-petit']);
    assert.deepEqual(controlerLEchelle(segs, 2), ['murs-epais', 'trop-grand']);
    assert.deepEqual(controlerLEchelle([], 1), []);
  });
});
