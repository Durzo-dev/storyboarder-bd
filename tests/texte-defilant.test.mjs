/**
 * tests/texte-defilant.test.mjs, le texte coupé qui défile au survol (src/texte-defilant.js).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { positionDuDefilement, DEFILEMENT } from '../src/texte-defilant.js';

const lire = (c) => readFileSync(new URL(`../${c}`, import.meta.url), 'utf8');
const R = { vitesse: 100, attente: 500, pause: 1000 };   // 200 px de débordement = 2 s de trajet

describe('positionDuDefilement : aller, pause, retour, pause, en boucle', () => {
  test('immobile pendant l\'attente, et quand rien ne déborde', () => {
    assert.equal(positionDuDefilement(300, 200, R), 0);
    assert.equal(positionDuDefilement(5000, 0, R), 0);
  });
  test('l\'aller à vitesse constante, puis la pause au bout', () => {
    assert.equal(positionDuDefilement(1500, 200, R), 100);
    assert.equal(positionDuDefilement(2500, 200, R), 200);
    assert.equal(positionDuDefilement(3000, 200, R), 200);
  });
  test('le retour, puis la pause au début, puis ça recommence', () => {
    assert.equal(positionDuDefilement(4500, 200, R), 100);
    assert.equal(positionDuDefilement(5800, 200, R), 0);
    assert.equal(positionDuDefilement(7500, 200, R), 100);
  });
  test('une vitesse lisible', () => {
    assert.ok(DEFILEMENT.vitesse >= 30 && DEFILEMENT.vitesse <= 60);
  });
});

describe('le câblage', () => {
  test('installé au démarrage, pour toute l\'application', () => {
    assert.match(lire('src/app.js'), /installerTexteDefilant\(\);/);
  });
  test('RÉGRESSION : le nom d\'un Tome et son format tiennent sur une ligne, coupés par « … »', () => {
    const css = lire('src/style.css');
    assert.match(css, /\.tome-row > span:first-child\{[^}]*white-space:nowrap;[^}]*text-overflow:ellipsis;/);
    assert.match(css, /\.texte-defile\{ text-overflow:clip !important; \}/);
  });
});

describe('RÉGRESSION : une liste déroulante défile aussi (le format d\'un Tome dépassait sans défiler)', () => {
  const src = lire('src/texte-defilant.js');
  const css = lire('src/style.css');
  test('le survol d\'un <select> passe par un calque mesuré, puisque son texte n\'est pas dans le DOM', () => {
    assert.match(src, /closest\('select'\)/);
    assert.match(src, /measureText\(texte\)/);
  });
  test('le calque laisse passer le clic, et le select se voile le temps du survol', () => {
    assert.match(css, /\.texte-defile-calque\{[^}]*pointer-events:none;/);
    assert.match(css, /select\.texte-defile-voile\{ color:transparent !important; \}/);
  });
  test('ouvrir la liste ou changer de choix retire le calque', () => {
    assert.match(src, /addEventListener\('mousedown', arreter, true\)/);
    assert.match(src, /addEventListener\('change', arreter, true\)/);
  });
});

describe('RÉGRESSION : le défilement ne s\'arrête pas sur son propre « scroll »', () => {
  test('l\'écoute du défilement des panneaux ignore celui du texte qui défile', () => {
    const src = lire('src/texte-defilant.js');
    assert.match(src, /t !== defile && typeof t\.contains === 'function' && t\.contains\(actif\)/, 'seul le défilement d\'un panneau qui contient le texte l\'arrête');
  });
});
