/**
 * tests/vignette-recadrage.test.mjs, le recadrage automatique des vignettes des stores (demandé :
 * sujet trop petit, ou collé au bord). Les fonctions pures : boîte du sujet et cadrage.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boiteDuSujet, cadrageDuSujet, fondDesCoins, couleursDesBords, bordsUnis, MARGE, AGRANDISSEMENT_MAX } from '../src/vignette-recadrage.js';

/** Une image RGBA `w × h` : un fond (fonction de x, y) et un rectangle plein. */
function image(w, h, fond, rect, couleur = [40, 160, 90]){
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const dedans = rect && x >= rect.x0 && x < rect.x1 && y >= rect.y0 && y < rect.y1;
    const c = dedans ? couleur : fond(x, y);
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return d;
}
const uni = () => [230, 230, 230];
/** Le fond radial de Sketchfab : clair au centre, sombre aux coins. */
const radial = (w, h) => (x, y) => { const r = Math.hypot(x - w / 2, y - h / 2) / Math.hypot(w / 2, h / 2); const v = 236 - 100 * r; return [v, v, v]; };

describe('boiteDuSujet : par les contours', () => {
  test('un petit objet sur un fond uni', () => {
    const b = boiteDuSujet(image(128, 72, uni, { x0: 54, y0: 30, x1: 74, y1: 42 }), 128, 72);
    assert.ok(Math.abs(b.x0 - 54) <= 1 && Math.abs(b.x1 - 74) <= 1 && Math.abs(b.y0 - 30) <= 1 && Math.abs(b.y1 - 42) <= 1, JSON.stringify(b));
  });
  test('RÉGRESSION : un dégradé radial n\'est pas pris pour le sujet (mesuré : la boîte prenait toute l\'image)', () => {
    const b = boiteDuSujet(image(128, 72, radial(128, 72), { x0: 58, y0: 32, x1: 70, y1: 40 }), 128, 72);
    assert.ok(b.x1 - b.x0 < 20 && b.y1 - b.y0 < 14, JSON.stringify(b));
  });
  test('rien qui se distingue : null', () => {
    assert.equal(boiteDuSujet(image(64, 36, uni, null), 64, 36), null);
  });
  test('les coins donnent le fond', () => {
    assert.deepEqual(fondDesCoins(image(64, 36, uni, null), 64, 36), [[230, 230, 230], [230, 230, 230], [230, 230, 230], [230, 230, 230]]);
  });
});

describe('cadrageDuSujet : le sujet remplit la carte, moins la marge, centré', () => {
  test('un petit sujet est agrandi, plafonné, et centré', () => {
    const p = cadrageDuSujet({ x0: 216, y0: 120, x1: 296, y1: 168 }, 512, 288, 600, 400);
    const e = p.l / 512;
    assert.ok(e <= Math.min(600 / 512, 400 / 288) * AGRANDISSEMENT_MAX + 1e-9);
    assert.ok(Math.abs(p.x + 256 * e - 300) < 1 && Math.abs(p.y + 144 * e - 200) < 1, 'centré');
  });
  test('un sujet qui touche le bord de son image est réduit pour garder la marge (signalé : collé au bord)', () => {
    const p = cadrageDuSujet({ x0: 26, y0: 0, x1: 486, y1: 512 }, 512, 512, 600, 400);
    const e = p.l / 512;
    assert.ok(p.y >= 400 * MARGE - 1, 'la marge du haut est tenue');
    assert.ok(p.y + 512 * e <= 400 * (1 - MARGE) + 1, 'et celle du bas');
  });
  test('Sketchfab : couvrir la carte dès que le sujet y tient (signalé : bords mal raccordés)', () => {
    const p = cadrageDuSujet({ x0: 362, y0: 53, x1: 662, y1: 523 }, 1024, 576, 600, 400);
    assert.ok(p.l >= 600 - 1e-6 && p.h >= 400 - 1e-6, 'l\'image couvre la carte');
    assert.ok(p.x <= 1e-6 && p.y <= 1e-6 && p.x + p.l >= 600 - 1e-6 && p.y + p.h >= 400 - 1e-6, 'sans découvrir de bord');
  });
  test('une image qui couvre ne découvre aucun bord, même si le sujet est sur le côté', () => {
    const p = cadrageDuSujet({ x0: 0, y0: 200, x1: 100, y1: 300 }, 1024, 576, 600, 400);
    assert.equal(p.x, 0);
    assert.ok(p.y <= 0 && p.y + p.h >= 400);
  });
  test('un sujet trop haut pour couvrir garde sa marge (on ne le rogne pas)', () => {
    const p = cadrageDuSujet({ x0: 400, y0: 5, x1: 624, y1: 571 }, 1024, 576, 600, 400);
    assert.ok(p.h < 400, 'contenue');
  });
  test('sans sujet : l\'image entière, contenue', () => {
    const p = cadrageDuSujet(null, 512, 512, 600, 400);
    assert.equal(p.h, 400);
    assert.equal(p.x, 100);
  });
});

describe('le câblage', () => {
  const lire = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  test('toute vignette chargée dans une carte est recomposée ; une image étrangère passe par le processus principal', () => {
    const ui = lire('src/store-ui.js');
    assert.match(ui, /const toile = recomposer\(source, L, H\);/);
    assert.match(ui, /window\.storyboarderAPI\.storeVignette\(/);
    assert.match(lire('electron/bibliotheque/store.js'), /const HOTES_RECADRAGE = /);
  });
});

describe('the record image (asked: no black bars, a margin around the subject)', () => {
  const lire = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  test('recomposed to its frame with the record margin, the original kept on failure', () => {
    const ui = lire('src/store-ui.js');
    assert.match(ui, /requestAnimationFrame\(\(\) => recadrerVisuel\(img, visuel\)\)/);
    assert.match(ui, /recomposer\(await createImageBitmap\(new Blob\(\[rep\.data\]\)\), L, H, MARGE_FICHE\)/);
    assert.match(ui, /catch \(e\) \{ montrer\(null\); \}/);
  });
  test('a Sketchfab model keeps no source thumbnail in My models (light background)', () => {
    assert.match(lire('electron/main.js'), /!vignettes\.SOURCES_SANS_VIGNETTE\.has\(resultat && resultat\.source\)/);
  });
});

describe('filling the uncovered space (seen: a blurred copy of the model, then streaks)', () => {
  const src = readFileSync(new URL('../src/vignette-recadrage.js', import.meta.url), 'utf8');
  test('the fill is made of colours only: the image is never drawn as a background', () => {
    const r = src.slice(src.indexOf('export function recomposer'));
    // The source is drawn twice: once small for the analysis (ac), once as the image (pc); never on the card.
    assert.deepEqual(r.match(/\b\w+\.drawImage\(source/g), ['ac.drawImage(source', 'pc.drawImage(source']);
    assert.doesNotMatch(src, /prolongerLesBords|blur\(/);
  });
  test('each side\'s colour is the mean of its outer band', () => {
    const w = 10, h = 10, rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; rgba[i] = x < 5 ? 200 : 20; rgba[i + 3] = 255; }
    const c = couleursDesBords(rgba, w, h);
    assert.equal(Math.round(c.g[0]), 200);
    assert.equal(Math.round(c.d[0]), 20);
    assert.equal(Math.round(c.h[0]), 110);
  });
});

describe('a varied background is never framed smaller (checked on real Sketchfab thumbnails, 10 Nov. 2026)', () => {
  const image = (w, h, px) => { const a = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b, al] = px(x, y); const i = (y * w + x) * 4; a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = al; } return a; };
  test('uniform edges, a vignetted or photo background, a transparent one', () => {
    assert.equal(bordsUnis(image(64, 36, () => [40, 40, 40, 255]), 64, 36), true);
    assert.equal(bordsUnis(image(64, 36, (x) => [x * 4, x * 4, x * 4, 255]), 64, 36), false, 'a strong gradient along the edge');
    assert.equal(bordsUnis(image(64, 64, (x) => (x > 20 && x < 44 ? [230, 230, 230, 255] : [0, 0, 0, 0])), 64, 64), true, 'mostly transparent: uniform');
  });
  test('varied: the subject filling its image, never shrunk to add a margin; covers when 80 % stays', () => {
    const p = cadrageDuSujet({ x0: 10, y0: 10, x1: 710, y1: 395 }, 720, 405, 600, 400, MARGE, AGRANDISSEMENT_MAX, false);
    assert.ok(p.l >= 600 - 1e-6 && p.h >= 400 - 1e-6, 'covers a 3:2 card (84 % of a 16:9 image)');
    const f = cadrageDuSujet({ x0: 10, y0: 10, x1: 1014, y1: 566 }, 1024, 576, 1280, 1445, 0.08, AGRANDISSEMENT_MAX, false);
    assert.ok(Math.abs(f.l - 1280) < 1e-6 && f.x === 0, 'a tall record: the full width, the gap only above and below');
  });
  test('uniform: the margin is kept (Poly Haven, asked)', () => {
    const p = cadrageDuSujet({ x0: 0, y0: 0, x1: 274, y1: 512 }, 274, 512, 1280, 1445, 0.08, AGRANDISSEMENT_MAX, true);
    assert.ok(p.y >= 1445 * 0.08 - 1, 'margin above the subject');
  });
});
