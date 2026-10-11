/**
 * tests/brume-lointain.test.mjs : le Sol s'efface dans l'horizon avant d'être coupé (signalé : en
 * dézoomant, l'horizon se déformait et clignotait). Fonctions pures, exécutées ; le branchement, lu.
 */
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { brumeDuLointain3D, distanceAuBordDuSol3D } = await import('../src/scene3d.js');

describe('La brume du lointain', () => {
  test('elle finit juste avant la coupe du Sol, et commence assez tôt pour s\'étaler', () => {
    const b = brumeDuLointain3D(1000);
    assert.ok(b.loin < 1000 && b.loin > 900);
    assert.ok(b.pres < b.loin && b.pres >= 500);
  });
  test('elle ne voile JAMAIS le contenu : elle commence au-delà', () => {
    assert.equal(brumeDuLointain3D(1000, 800).pres, 800);
    assert.equal(brumeDuLointain3D(1000, 990), null, 'pas la place de l\'étaler : pas de brume');
    assert.equal(brumeDuLointain3D(0), null);
  });
});

describe('Le bord du Sol dans la direction visée', () => {
  test('au centre, regardant vers +x : le demi-côté', () => {
    assert.equal(distanceAuBordDuSol3D(0, 0, 1, 0, 0, 0, 6000), 6000);
  });
  test('en diagonale, le premier bord rencontré', () => {
    assert.ok(Math.abs(distanceAuBordDuSol3D(0, 0, 1, 1, 0, 0, 6000) - 6000 * Math.SQRT2) < 1e-6);
    assert.equal(distanceAuBordDuSol3D(5000, 0, 1, 0, 0, 0, 6000), 1000);
  });
  test('à la verticale, aucun bord', () => {
    assert.equal(distanceAuBordDuSol3D(0, 0, 0, 0, 0, 0, 6000), Infinity);
  });
});

describe('Le branchement', () => {
  const SC = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  test('posée au rendu de la Case, à la couleur de l\'horizon, et retirée après', () => {
    assert.match(SC, /personaScene3D\.fog = new THREE\.Fog\(_ciel\.material\.uniforms\.uHorizon\.value\.clone\(\), _brume\.pres, _brume\.loin\);/);
    assert.match(SC, /retirerCiel3D\(personaScene3D\);\n  personaScene3D\.fog = null;/);
    assert.match(SC, /personaCamera3D\.userData\.lointainDuContenu = 0;/);
  });
  test('le plan lointain recule au-delà du coin le plus lointain du Sol : il ne le coupe plus', () => {
    assert.match(SC, /if \(_coin \* 1\.01 > personaCamera3D\.far\) \{ personaCamera3D\.far = _coin \* 1\.01;/);
    assert.match(SC, /_brume = brumeDuLointain3D\(_bordDuSol, personaCamera3D\.userData\.lointainDuContenu \|\| 0\);/);
    // Jusqu'au bord du Sol, et le plus proche dans le champ (pas la bande pâle de la 1re version).
    assert.doesNotMatch(SC, /_lointainAvant/);
    assert.match(SC, /for \(const _da of \[-_demiChamp, 0, _demiChamp\]\)/);
  });
});
