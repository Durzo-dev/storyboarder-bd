/**
 * tests/vignette-recadrage.test.mjs, le recadrage automatique des vignettes des stores (demandé :
 * sujet trop petit, ou collé au bord). Les fonctions pures : boîte du sujet et cadrage.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boiteDuSujet, cadrageDuSujet, fondDesCoins, MARGE, AGRANDISSEMENT_MAX } from '../src/vignette-recadrage.js';

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
