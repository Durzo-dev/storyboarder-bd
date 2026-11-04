/**
 * tests/plan-murs.test.mjs : #456a, la détection des murs d'un plan d'architecte, sur des plans
 * SYNTHÉTIQUES qui reprennent les conventions relevées dans docs/en/plan-sources.md : poché noir,
 * lavis carmin sur papier jauni, hachures, éclairage inégal d'une photo, traits fins (mobilier, arcs
 * de portes, texte) à effacer, échelle graphique posée à côté du plan.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { detecterLesMurs, COTE_DE_TRAVAIL } from '../src/plan-murs.js';

/** Une feuille w × h de couleur `papier` ; `eclairage(x, y)` multiplie la couleur (photo mal éclairée). */
function feuille(w, h, papier = [250, 248, 240]){
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { px[i * 4] = papier[0]; px[i * 4 + 1] = papier[1]; px[i * 4 + 2] = papier[2]; px[i * 4 + 3] = 255; }
  return { w, h, px };
}
function pixel(f, x, y, c){
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= f.w || y >= f.h) return;
  const i = (y * f.w + x) * 4; f.px[i] = c[0]; f.px[i + 1] = c[1]; f.px[i + 2] = c[2];
}
function rect(f, x0, y0, x1, y1, c){ for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) pixel(f, x, y, c); }
/** Un trait fin (1 px) de a à b. */
function trait(f, ax, ay, bx, by, c = [20, 20, 20]){
  const n = Math.ceil(Math.hypot(bx - ax, by - ay)) * 2;
  for (let k = 0; k <= n; k++) pixel(f, ax + (bx - ax) * k / n, ay + (by - ay) * k / n, c);
}
/** Un arc de porte (quart de cercle fin) de centre (cx, cy) et de rayon r. */
function arc(f, cx, cy, r){
  for (let k = 0; k <= 200; k++) { const a = (k / 200) * Math.PI / 2; pixel(f, cx + r * Math.cos(a), cy - r * Math.sin(a), [20, 20, 20]); }
}

/**
 * Le plan de référence : un rectangle de murs de 12 px (x 100-500, y 80-380), une cloison de 8 px à
 * x = 300, et la liste des rectangles de murs (pour mesurer).
 */
function mursDeReference(){
  return [
    [100, 80, 500, 92], [100, 368, 500, 380], [100, 80, 112, 380], [488, 80, 500, 380],
    [296, 92, 304, 368],
  ];
}
/** Le décor fin : mobilier, arc de porte, « texte », cotes. Rend la liste des pixels fins posés. */
function decorFin(f){
  trait(f, 140, 130, 260, 130); trait(f, 140, 130, 140, 200); trait(f, 260, 130, 260, 200); trait(f, 140, 200, 260, 200);
  arc(f, 304, 300, 40);
  for (let k = 0; k < 8; k++) rect(f, 340 + k * 9, 150, 340 + k * 9 + 2, 162, [30, 30, 30]); // lettres
  trait(f, 100, 60, 500, 60); trait(f, 100, 55, 100, 65); trait(f, 500, 55, 500, 65);        // cote
}

/** La part des pixels de `rects` que le masque couvre, et la part du reste qu'il couvre à tort. */
function mesure(res, rects){
  const { largeur: W, hauteur: H, murs } = res, dedans = new Uint8Array(W * H);
  for (const [x0, y0, x1, y1] of rects) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) dedans[y * W + x] = 1;
  let vrais = 0, total = 0, faux = 0, reste = 0;
  for (let p = 0; p < W * H; p++) {
    if (dedans[p]) { total++; vrais += murs[p]; } else { reste++; faux += murs[p]; }
  }
  return { rappel: vrais / total, fausses: faux / reste, faux };
}

describe('#456a, les murs d\'un plan', () => {
  test('poché noir : les murs sont trouvés, le mobilier, l\'arc, le texte et la cote sont effacés', () => {
    const f = feuille(600, 450);
    for (const r of murRefs()) rect(f, ...r, [15, 15, 15]);
    decorFin(f);
    const res = detecterLesMurs(f.px, f.w, f.h);
    const m = mesure(res, murRefs());
    assert.ok(m.rappel > 0.95, `rappel ${m.rappel}`);
    assert.ok(m.faux < 60, `${m.faux} pixels faussement pris pour du mur`);
    assert.equal(res.facteur, 1);
  });

  test('lavis carmin sur papier jauni, sans trait noir : les murs sont trouvés sans pipette', () => {
    const f = feuille(600, 450, [238, 226, 196]);
    for (const r of murRefs()) rect(f, ...r, [214, 120, 130]);
    decorFin(f);
    const m = mesure(detecterLesMurs(f.px, f.w, f.h), murRefs());
    assert.ok(m.rappel > 0.95, `rappel ${m.rappel}`);
    assert.ok(m.faux < 60, `${m.faux} pixels faussement pris pour du mur`);
  });

  test('rose pâle (lavis du XVIIIe) : encore de l\'encre', () => {
    const f = feuille(600, 450, [245, 240, 228]);
    for (const r of murRefs()) rect(f, ...r, [236, 190, 190]);
    const m = mesure(detecterLesMurs(f.px, f.w, f.h), murRefs());
    assert.ok(m.rappel > 0.95, `rappel ${m.rappel}`);
  });

  test('hachures serrées : le mur hachuré devient une masse', () => {
    const f = feuille(600, 450);
    for (const [x0, y0, x1, y1] of murRefs()) {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if ((x + y) % 4 === 0) pixel(f, x, y, [20, 20, 20]);
      trait(f, x0, y0, x1 - 1, y0); trait(f, x0, y1 - 1, x1 - 1, y1 - 1); trait(f, x0, y0, x0, y1 - 1); trait(f, x1 - 1, y0, x1 - 1, y1 - 1);
    }
    decorFin(f);
    const m = mesure(detecterLesMurs(f.px, f.w, f.h), murRefs());
    assert.ok(m.rappel > 0.85, `rappel ${m.rappel}`);
    assert.ok(m.fausses < 0.01, `fausses ${m.fausses}`);
  });

  test('photo mal éclairée (papier de 250 à 150 d\'un bord à l\'autre) : ni mur perdu, ni papier pris pour du mur', () => {
    const f = feuille(600, 450);
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const k = 1 - 0.4 * (x / f.w), i = (y * f.w + x) * 4;
      f.px[i] *= k; f.px[i + 1] *= k; f.px[i + 2] *= k;
    }
    for (const r of murRefs()) rect(f, ...r, [15, 15, 15]);
    decorFin(f);
    const m = mesure(detecterLesMurs(f.px, f.w, f.h), murRefs());
    assert.ok(m.rappel > 0.95, `rappel ${m.rappel}`);
    assert.ok(m.fausses < 0.002, `fausses ${m.fausses}`);
  });

  test('l\'échelle graphique et le cartouche posés à côté du plan ne sont pas des murs', () => {
    const f = feuille(600, 450);
    for (const r of murRefs()) rect(f, ...r, [15, 15, 15]);
    rect(f, 120, 405, 280, 413, [15, 15, 15]);   // barre d'échelle épaisse
    rect(f, 520, 380, 590, 440, [15, 15, 15]);   // cartouche plein
    const res = detecterLesMurs(f.px, f.w, f.h);
    assert.ok(mesure(res, murRefs()).rappel > 0.95);
    // Les angles rentrants s'arrondissent de quelques pixels (la fermeture) ; la barre et le
    // cartouche, eux, ne laissent RIEN.
    assert.equal(res.murs[409 * res.largeur + 200], 0);
    assert.equal(res.murs[410 * res.largeur + 555], 0);
    const restes = mesure(res, [...murRefs(), [0, 0, 600, 395]]).faux;
    assert.equal(restes, 0);
  });

  test('un poteau isolé dans le bâtiment est gardé', () => {
    const f = feuille(600, 450);
    for (const r of murRefs()) rect(f, ...r, [15, 15, 15]);
    rect(f, 190, 220, 204, 234, [15, 15, 15]);
    const m = mesure(detecterLesMurs(f.px, f.w, f.h), [...murRefs(), [190, 220, 204, 234]]);
    assert.ok(m.rappel > 0.95, `rappel ${m.rappel}`);
  });

  test('une feuille blanche n\'a pas de murs', () => {
    const f = feuille(300, 200);
    const res = detecterLesMurs(f.px, f.w, f.h);
    assert.equal(res.murs.reduce((a, b) => a + b, 0), 0);
  });

  test('un plan sans aucun trait fin (rien que des murs) est quand même lu', () => {
    const f = feuille(600, 450);
    for (const r of murRefs()) rect(f, ...r, [15, 15, 15]);
    const res = detecterLesMurs(f.px, f.w, f.h);
    assert.ok(mesure(res, murRefs()).rappel > 0.95);
  });

  test('une grande image est réduite à l\'image de travail, et le facteur est rendu', () => {
    const W = COTE_DE_TRAVAIL * 2, H = 1200;
    const f = feuille(W, H);
    for (const [x0, y0, x1, y1] of murRefs()) rect(f, x0 * 4, y0 * 2, x1 * 4, y1 * 2, [15, 15, 15]);
    const res = detecterLesMurs(f.px, f.w, f.h);
    assert.equal(res.facteur, 2);
    assert.equal(res.largeur, COTE_DE_TRAVAIL);
    assert.equal(res.hauteur, 600);
  });

  test('l\'encre d\'origine est rendue à part (pour retrouver les fenêtres, #456c)', () => {
    const f = feuille(600, 450);
    for (const r of murRefs()) rect(f, ...r, [15, 15, 15]);
    decorFin(f);
    const res = detecterLesMurs(f.px, f.w, f.h);
    assert.equal(res.encre[130 * res.largeur + 200], 1);   // le mobilier est de l'encre…
    assert.equal(res.murs[130 * res.largeur + 200], 0);    // … mais pas un mur
  });
});

function murRefs(){ return mursDeReference(); }
