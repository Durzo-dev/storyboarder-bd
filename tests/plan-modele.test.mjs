/**
 * tests/plan-modele.test.mjs : #456g, le modèle entraîné qui lit un plan (src/plan-modele.js,
 * docs/en/plan-modele.md). Sa préparation et son décodage (purs), la chaîne des masques jusqu'au
 * bâtiment (plan-ouvertures.js, `ouverturesDesMasques`), et LA GARDE DE SORTIE : le modèle est un
 * greffon, retirable en trois gestes ; aucun autre fichier ne doit le connaître.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { entreeDuModele, classesDuModele, masquesDesClasses, SEUIL_PORTE } from '../src/plan-modele.js';
import { vectoriserLesMurs, batimentDuPlan } from '../src/plan-vecteurs.js';
import { ouverturesDesMasques } from '../src/plan-ouvertures.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

describe('#456g, la préparation de l\'image', () => {
  test('une image en largeur est centrée dans le carré blanc, réduite par moyenne de surface', () => {
    const w = 1024, h = 512, px = new Uint8ClampedArray(w * h * 4).fill(255);
    // La moitié gauche noire.
    for (let y = 0; y < h; y++) for (let x = 0; x < w / 2; x++) px.set([0, 0, 0], (y * w + x) * 4);
    const { donnees, boite } = entreeDuModele(px, w, h);
    assert.deepEqual(boite, { gauche: 0, haut: 128, largeur: 512, hauteur: 256 });
    const blanc = (1 - 0.485) / 0.229, noir = -0.485 / 0.229;
    assert.ok(Math.abs(donnees[10 * 512 + 100] - blanc) < 1e-5, 'la bande du haut est blanche');
    assert.ok(Math.abs(donnees[200 * 512 + 100] - noir) < 1e-5, 'la moitié gauche est noire');
    assert.ok(Math.abs(donnees[200 * 512 + 400] - blanc) < 1e-5, 'la moitié droite est blanche');
  });

  test('un pixel coupé par la réduction compte au prorata (pas de décalage d\'un demi-pixel)', () => {
    // 3 pixels → 2 cases : la case 0 prend le pixel 0 et la moitié du pixel 1.
    const w = 768, h = 768, px = new Uint8ClampedArray(w * h * 4).fill(255);
    for (let y = 0; y < h; y++) px.set([0, 0, 0], (y * w + 1) * 4);
    const { donnees } = entreeDuModele(px, w, h);
    const attendu = ((255 * (1 / 1.5) + 0 * (0.5 / 1.5)) / 255 - 0.485) / 0.229;
    assert.ok(Math.abs(donnees[100 * 512] - attendu) < 1e-4);
  });
});

describe('#456g, le décodage', () => {
  /** Des logits [5, 128, 128] : la classe `c` à 5 partout, sauf `f(i, j)` qui peut en changer. */
  const logits = (f) => {
    const L = new Float32Array(5 * 128 * 128);
    for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) for (const [c, v] of f(i, j)) L[c * 128 * 128 + j * 128 + i] = v;
    return L;
  };
  const boite = { gauche: 0, haut: 0, largeur: 512, hauteur: 512 };

  test('la classe la plus probable, à la taille de travail', () => {
    const c = classesDuModele(logits((i) => (i < 64 ? [[2, 5]] : [[1, 5]])), boite, 200, 100);
    assert.equal(c.length, 200 * 100);
    assert.equal(c[50 * 200 + 10], 2);
    assert.equal(c[50 * 200 + 190], 1);
  });

  test(`une porte retenue dès ${SEUIL_PORTE * 100} %, même quand le mur l'emporte`, () => {
    // Mur 5, porte 4.5 : p(porte) ≈ 0,37.
    const c = classesDuModele(logits(() => [[2, 5], [3, 4.5]]), boite, 64, 64);
    assert.ok(c.every(v => v === 3));
    // Porte 2 : p(porte) ≈ 0,05, le mur reste.
    const d = classesDuModele(logits(() => [[2, 5], [3, 2]]), boite, 64, 64);
    assert.ok(d.every(v => v === 2));
  });

  test('les murs du masque englobent portes et fenêtres', () => {
    const m = masquesDesClasses(Uint8Array.from([0, 1, 2, 3, 4]));
    assert.deepEqual([...m.murs], [0, 0, 1, 1, 1]);
    assert.deepEqual([...m.portes], [0, 0, 0, 1, 0]);
    assert.deepEqual([...m.fenetres], [0, 0, 0, 0, 1]);
  });
});

describe('#456g, des masques au bâtiment', () => {
  // Deux pièces : un rectangle de murs de 12 px et une cloison ; une porte dans la cloison, une
  // fenêtre dans le mur du haut, comme le modèle les rend (DANS le mur).
  const W = 600, H = 450, classes = new Uint8Array(W * H);
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) classes[y * W + x] = c; };
  rect(100, 80, 500, 92, 2); rect(100, 368, 500, 380, 2); rect(100, 80, 112, 380, 2); rect(488, 80, 500, 380, 2);
  rect(296, 92, 304, 368, 2);
  rect(296, 200, 304, 240, 3);
  rect(160, 80, 220, 92, 4);
  // Une encre où la porte a son arc : charnière en (304, 200), ouverte vers l'est.
  const encre = new Uint8Array(W * H);
  for (let k = 0; k <= 300; k++) { const a = k / 300 * Math.PI / 2; encre[Math.round(200 + 40 * Math.cos(a)) * W + Math.round(304 + 40 * Math.sin(a))] = 1; }

  const m = masquesDesClasses(classes);
  const { segments } = vectoriserLesMurs(m.murs, W, H);
  const segs = ouverturesDesMasques(segments, m, W, H, encre);
  const ouv = segs.flatMap(s => s.ouvertures.map(o => ({ s, o })));

  test('une porte et une fenêtre, posées sur leur mur, à leur largeur', () => {
    assert.deepEqual(ouv.map(x => x.o.type).sort(), ['fenetre', 'porte']);
    const f = ouv.find(x => x.o.type === 'fenetre');
    assert.ok(Math.abs(f.o.s1 - f.o.s0 - 60) <= 4, `fenêtre ${f.o.s1 - f.o.s0}`);
    const p = ouv.find(x => x.o.type === 'porte');
    assert.ok(Math.abs(p.o.s1 - p.o.s0 - 40) <= 4, `porte ${p.o.s1 - p.o.s0}`);
  });

  test('le côté de la porte se lit sur son arc', () => {
    const { s, o } = ouv.find(x => x.o.type === 'porte');
    const L = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y), u = { x: (s.b.x - s.a.x) / L, y: (s.b.y - s.a.y) / L };
    const t = (o.s0 + o.s1) / 2, k = 10 * o.sens;
    assert.ok(s.a.x + u.x * t - u.y * k > 305, 'ouverte vers l\'est');
  });

  test('de bout en bout : deux pièces fermées, rien de refusé', () => {
    const { batiment, refuses, ouverturesRefusees } = batimentDuPlan(segs, { metresParPixel: 0.0225 });
    assert.equal(refuses, 0);
    assert.equal(ouverturesRefusees, 0);
    assert.equal(batiment.pieces.length, 2);
  });
});

describe('#456g, la garde de sortie : le modèle reste un greffon', () => {
  const fichiers = [];
  const parcourir = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) parcourir(p);
      else if (/\.(m?js|html|json)$/.test(n)) fichiers.push(p);
    }
  };
  for (const d of ['src', 'electron', 'tools']) parcourir(join(RACINE, d));
  const nom = (p) => relative(RACINE, p).replace(/\\/g, '/');

  test('seul src/plan-modele.js connaît le moteur et le dossier du modèle', () => {
    const fautifs = fichiers.filter(p => nom(p) !== 'src/plan-modele.js' && /onnxruntime|assets\/modeles/.test(readFileSync(p, 'utf8'))).map(nom);
    assert.deepEqual(fautifs, []);
  });

  test('il n\'est chargé que par un import DYNAMIQUE, depuis l\'import de plan', () => {
    const appelants = fichiers.filter(p => nom(p) !== 'src/plan-modele.js' && /plan-modele\.js/.test(readFileSync(p, 'utf8'))).map(nom);
    assert.deepEqual(appelants, ['src/plan-import-ui.js']);
    const ui = readFileSync(join(RACINE, 'src/plan-import-ui.js'), 'utf8');
    assert.ok(!/^\s*import\s[^(]*plan-modele\.js/m.test(ui), 'pas d\'import statique');
    assert.ok(/await import\('\.\/plan-modele\.js'\)/.test(ui));
  });
});
