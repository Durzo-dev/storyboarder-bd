/**
 * @file plan-feuille.js
 * #456e3, LA FEUILLE D'UNE PHOTO DE PLAN, trouvée et redressée SANS ACTION de l'utilisateur
 * (décision de Valentin : le plus automatique possible). Fonctions PURES, vérifiées sous Node
 * (tests/plan-feuille.test.mjs).
 *
 * Une photo de plan, c'est une feuille claire posée sur un fond (une table, un bureau), vue de biais :
 * un quadrilatère au lieu d'un rectangle, un éclairage inégal, un fond sombre qui faussait tout le
 * reste (le papier estimé, la masse la plus grande, les directions ; banc d'essai, plans n° 8, 15, 16).
 *
 *   1. la FEUILLE est la grande zone claire et peu colorée (seuil d'Otsu sur la luminosité, image
 *      réduite) : ce qu'on n'atteint pas depuis le bord de l'image sans traverser de papier, trous
 *      d'encre compris, puis sa plus grande masse ;
 *   2. ses QUATRE COINS sont les extrêmes de x + y et de x - y sur cette masse (tient pour une prise
 *      de vue de biais ordinaire ; pas pour une feuille tournée de 45°) ;
 *   3. le REDRESSEMENT est l'homographie qui envoie ces coins sur un rectangle, aux longueurs des
 *      côtés de la feuille ; l'image est rééchantillonnée (bilinéaire).
 *
 * Un SCAN, ou une capture d'écran, n'a pas de fond : la feuille touche presque tout le bord de
 * l'image, et rien n'est redressé.
 */

/** Le plus grand côté de l'image d'analyse (la recherche de la feuille). */
const COTE_ANALYSE = 600;
/** Le plus grand côté de l'image redressée. */
const COTE_MAX = 4000;

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** L'image réduite (moyenne par blocs) : luminosité et saturation, et le facteur. */
function reduite(rgba, w, h){
  const f = Math.max(1, Math.ceil(Math.max(w, h) / COTE_ANALYSE));
  const W = Math.floor(w / f), H = Math.floor(h / f);
  const L = new Float32Array(W * H), S = new Float32Array(W * H);
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    let r = 0, g = 0, b = 0;
    for (let y = Y * f; y < Y * f + f; y++) for (let x = X * f; x < X * f + f; x++) {
      const i = (y * w + x) * 4; r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2];
    }
    const n = f * f; r /= n; g /= n; b /= n;
    L[Y * W + X] = lum(r, g, b); S[Y * W + X] = Math.max(r, g, b) - Math.min(r, g, b);
  }
  return { L, S, W, H, f };
}

/** Le seuil d'Otsu d'un tableau de valeurs 0..255. */
function otsu(v){
  const hist = new Float64Array(256);
  for (const x of v) hist[Math.min(255, Math.max(0, Math.round(x)))]++;
  const total = v.length;
  let somme = 0;
  for (let k = 0; k < 256; k++) somme += k * hist[k];
  let wB = 0, sB = 0, meilleur = 128, max = -1;
  for (let k = 0; k < 256; k++) {
    wB += hist[k]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sB += k * hist[k];
    const d = wB * wF * (sB / wB - (somme - sB) / wF) ** 2;
    if (d > max) { max = d; meilleur = k; }
  }
  return meilleur;
}

/**
 * La FEUILLE : `{ coins: [hg, hd, bd, bg] }` en pixels de l'image d'origine, ou null s'il n'y a rien
 * à redresser (un scan, une capture : pas de fond ; ou rien qui ressemble à une feuille).
 */
export function trouverLaFeuille(rgba, w, h){
  const { L, S, W, H, f } = reduite(rgba, w, h);
  const seuil = otsu(L);
  const papier = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) papier[i] = L[i] > seuil && S[i] < 60 ? 1 : 0;
  // Pas de fond : le bord de l'image est presque tout papier.
  let bord = 0, surBord = 0;
  for (let x = 0; x < W; x++) { bord += 2; surBord += papier[x] + papier[(H - 1) * W + x]; }
  for (let y = 1; y < H - 1; y++) { bord += 2; surBord += papier[y * W] + papier[y * W + W - 1]; }
  if (surBord / bord > 0.6) return null;
  // Le fond : ce qu'on atteint depuis le bord sans traverser de papier. Le reste est la feuille,
  // les traits du plan compris.
  const fond = new Uint8Array(W * H), pile = [];
  const pousser = (i) => { if (!fond[i] && !papier[i]) { fond[i] = 1; pile.push(i); } };
  for (let x = 0; x < W; x++) { pousser(x); pousser((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { pousser(y * W); pousser(y * W + W - 1); }
  while (pile.length) {
    const i = pile.pop(), x = i % W;
    if (x > 0) pousser(i - 1); if (x < W - 1) pousser(i + 1);
    if (i >= W) pousser(i - W); if (i < W * (H - 1)) pousser(i + W);
  }
  // La plus grande masse de la feuille.
  const etiq = new Int32Array(W * H);
  let meilleure = 0, aireMax = 0;
  for (let s = 0, id = 0; s < W * H; s++) {
    if (fond[s] || etiq[s]) continue;
    id++; let aire = 0; const p = [s]; etiq[s] = id;
    while (p.length) {
      const i = p.pop(), x = i % W; aire++;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j >= 0 && j < W * H && !fond[j] && !etiq[j]) { etiq[j] = id; p.push(j); }
      }
    }
    if (aire > aireMax) { aireMax = aire; meilleure = id; }
  }
  if (aireMax < 0.2 * W * H) return null;
  // Les coins : extrêmes de x + y et de x - y.
  let hg = null, hd = null, bd = null, bg = null;
  for (let i = 0; i < W * H; i++) {
    if (etiq[i] !== meilleure) continue;
    const x = i % W, y = (i - x) / W, s = x + y, d = x - y;
    if (!hg || s < hg.s) hg = { x, y, s };
    if (!bd || s > bd.s) bd = { x, y, s };
    if (!hd || d > hd.d) hd = { x, y, d };
    if (!bg || d < bg.d) bg = { x, y, d };
  }
  // Au centre du pixel réduit, en pixels d'origine ; le coin extérieur du pixel pour les extrêmes.
  const vers = (p, dx, dy) => ({ x: (p.x + 0.5 + dx * 0.5) * f, y: (p.y + 0.5 + dy * 0.5) * f });
  const coins = [vers(hg, -1, -1), vers(hd, 1, -1), vers(bd, 1, 1), vers(bg, -1, 1)];
  // Une feuille qui EST l'image (ses coins à moins de 4 % de ceux de l'image) : rien à redresser.
  // Un plan dont les murs touchent le bord (plan n° 4) passait pour une photo.
  const coinsImage = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], tol = 0.04 * Math.max(w, h);
  if (coins.every((c, k) => Math.hypot(c.x - coinsImage[k].x, c.y - coinsImage[k].y) < tol)) return null;
  return { coins };
}

/** L'homographie qui envoie les 4 points `de` sur les 4 points `vers` : 9 coefficients (h8 = 1). */
function homographie(de, vers){
  const A = [], B = [];
  for (let k = 0; k < 4; k++) {
    const { x, y } = de[k], { x: u, y: v } = vers[k];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
  }
  // Élimination de Gauss avec pivot partiel.
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const k = A[r][c] / A[c][c];
      for (let j = c; j < 8; j++) A[r][j] -= k * A[c][j];
      B[r] -= k * B[c];
    }
  }
  return [...B.map((b, i) => b / A[i][i]), 1];
}

/**
 * L'image REDRESSÉE : le quadrilatère `coins` (hg, hd, bd, bg) devient un rectangle aux longueurs
 * des côtés de la feuille. Rend `{ rgba, largeur, hauteur }`.
 */
export function redresser(rgba, w, h, coins){
  const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  let W = Math.round(Math.max(d(coins[0], coins[1]), d(coins[3], coins[2])));
  let H = Math.round(Math.max(d(coins[0], coins[3]), d(coins[1], coins[2])));
  const k = Math.min(1, COTE_MAX / Math.max(W, H));
  W = Math.max(1, Math.round(W * k)); H = Math.max(1, Math.round(H * k));
  // De l'image redressée vers la photo : chaque pixel d'arrivée lit la photo.
  const M = homographie([{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }], coins);
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const X = x + 0.5, Y = y + 0.5, z = M[6] * X + M[7] * Y + M[8];
    const sx = (M[0] * X + M[1] * Y + M[2]) / z - 0.5, sy = (M[3] * X + M[4] * Y + M[5]) / z - 0.5;
    const x0 = Math.max(0, Math.min(w - 1, Math.floor(sx))), y0 = Math.max(0, Math.min(h - 1, Math.floor(sy)));
    const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
    const tx = Math.max(0, Math.min(1, sx - x0)), ty = Math.max(0, Math.min(1, sy - y0));
    const o = (y * W + x) * 4;
    for (let c = 0; c < 3; c++) {
      const a = rgba[(y0 * w + x0) * 4 + c] * (1 - tx) + rgba[(y0 * w + x1) * 4 + c] * tx;
      const b = rgba[(y1 * w + x0) * 4 + c] * (1 - tx) + rgba[(y1 * w + x1) * 4 + c] * tx;
      out[o + c] = a * (1 - ty) + b * ty;
    }
    out[o + 3] = 255;
  }
  return { rgba: out, largeur: W, hauteur: H };
}

/**
 * La photo prête à lire : la feuille trouvée et redressée, ou l'image telle quelle s'il n'y avait
 * rien à redresser. Rend `{ rgba, largeur, hauteur, coins }` (`coins` null si rien n'a bougé).
 */
export function redresserLaFeuille(rgba, w, h){
  const feuille = trouverLaFeuille(rgba, w, h);
  if (!feuille) return { rgba, largeur: w, hauteur: h, coins: null };
  return { ...redresser(rgba, w, h, feuille.coins), coins: feuille.coins };
}
