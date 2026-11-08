/**
 * tests/plan-feuille.test.mjs : #456e3, la feuille d'une photo de plan, trouvée et redressée sans
 * action de l'utilisateur. Une feuille synthétique (un plan droit) photographiée de biais sur un fond
 * sombre : ses coins sont retrouvés, et le plan redressé a de nouveau des murs droits. Un scan (pas
 * de fond) n'est pas touché.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { trouverLaFeuille, redresser, redresserLaFeuille } from '../src/plan-feuille.js';
import { detecterLesMurs } from '../src/plan-murs.js';
import { vectoriserLesMurs } from '../src/plan-vecteurs.js';

const FW = 500, FH = 360;   // la feuille
/** La feuille : un plan droit (murs noirs de 12 px) sur papier blanc. */
function feuille(){
  const px = new Uint8ClampedArray(FW * FH * 4);
  for (let i = 0; i < FW * FH; i++) px.set([246, 244, 238, 255], i * 4);
  const rect = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.set([20, 20, 20], (y * FW + x) * 4); };
  rect(60, 50, 440, 62); rect(60, 298, 440, 310); rect(60, 50, 72, 310); rect(428, 50, 440, 310); rect(246, 62, 254, 298);
  return px;
}
/** La photo : la feuille posée de biais (coins donnés) sur un fond sombre de W × H. */
function photo(coins, W = 800, H = 640){
  const f = feuille(), px = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) px.set([60, 72, 80, 255], i * 4);
  // Rééchantillonnage inverse par interpolation bilinéaire des coins (une homographie suffit
  // largement à l'œil ; ici une application bilinéaire du carré unité, assez proche pour le test).
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // Recherche (u, v) par quelques itérations de Newton sur la carte bilinéaire.
    let u = 0.5, v = 0.5;
    for (let k = 0; k < 8; k++) {
      const P = (a, b) => ({ x: (1 - a) * (1 - b) * coins[0].x + a * (1 - b) * coins[1].x + a * b * coins[2].x + (1 - a) * b * coins[3].x,
        y: (1 - a) * (1 - b) * coins[0].y + a * (1 - b) * coins[1].y + a * b * coins[2].y + (1 - a) * b * coins[3].y });
      const p = P(u, v), pu = P(u + 1e-3, v), pv = P(u, v + 1e-3);
      const a11 = (pu.x - p.x) / 1e-3, a12 = (pv.x - p.x) / 1e-3, a21 = (pu.y - p.y) / 1e-3, a22 = (pv.y - p.y) / 1e-3;
      const det = a11 * a22 - a12 * a21, ex = x + 0.5 - p.x, ey = y + 0.5 - p.y;
      u += (a22 * ex - a12 * ey) / det; v += (-a21 * ex + a11 * ey) / det;
    }
    if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
    const sx = Math.floor(u * FW), sy = Math.floor(v * FH), i = (sy * FW + sx) * 4;
    px.set([f[i], f[i + 1], f[i + 2]], (y * W + x) * 4);
  }
  return { px, W, H };
}
const COINS = [{ x: 150, y: 110 }, { x: 690, y: 150 }, { x: 650, y: 560 }, { x: 110, y: 500 }];

describe('#456e3, la feuille d\'une photo', () => {
  test('les quatre coins de la feuille sont retrouvés (à 2 % près)', () => {
    const { px, W, H } = photo(COINS);
    const f = trouverLaFeuille(px, W, H);
    assert.ok(f);
    f.coins.forEach((c, k) => assert.ok(Math.hypot(c.x - COINS[k].x, c.y - COINS[k].y) < 0.02 * W, `coin ${k} : ${JSON.stringify(c)}`));
  });

  test('redressée, la feuille retrouve ses proportions et des murs droits', () => {
    const { px, W, H } = photo(COINS);
    const r = redresserLaFeuille(px, W, H);
    assert.ok(r.coins);
    assert.ok(Math.abs(r.largeur / r.hauteur - FW / FH) < 0.12, `proportions ${r.largeur}×${r.hauteur}`);
    const d = detecterLesMurs(r.rgba, r.largeur, r.hauteur);
    const { angle, segments } = vectoriserLesMurs(d.murs, d.largeur, d.hauteur);
    assert.ok(Math.abs(angle) < 1.5 * Math.PI / 180, `angle ${angle * 180 / Math.PI}°`);
    assert.ok(segments.length >= 5, `${segments.length} murs`);
  });

  test('un scan (pas de fond) n\'est pas touché', () => {
    const r = redresserLaFeuille(feuille(), FW, FH);
    assert.equal(r.coins, null);
    assert.equal(r.largeur, FW);
  });

  test('redresser un rectangle déjà droit rend la même image', () => {
    const f = feuille();
    const r = redresser(f, FW, FH, [{ x: 0, y: 0 }, { x: FW, y: 0 }, { x: FW, y: FH }, { x: 0, y: FH }]);
    assert.equal(r.largeur, FW); assert.equal(r.hauteur, FH);
    let ecart = 0;
    for (let i = 0; i < f.length; i += 4) ecart = Math.max(ecart, Math.abs(f[i] - r.rgba[i]));
    assert.ok(ecart <= 1, `écart ${ecart}`);
  });
});
