/**
 * @file plan-murs.js
 * #456a, LES MURS D'UN PLAN D'ARCHITECTE photographié ou scanné. Fonctions PURES : aucune ne touche
 * au DOM, tout se vérifie sous Node (tests/plan-murs.test.mjs). La recherche qui fonde ces choix est
 * dans docs/en/plan-sources.md.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * CE QUI EST CHERCHÉ
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * À toutes les époques, le mur COUPÉ est ce qu'il y a de plus LOURD sur un plan : un trait épais, un
 * remplissage noir (poché), un lavis carmin ou rose (XVIIe-XIXe siècles), un gris, des hachures. On
 * ne cherche donc pas une couleur, on cherche une MASSE D'ENCRE ÉPAISSE :
 *
 *   1. le PAPIER est estimé localement (un plan photographié est mal éclairé, un parchemin jauni) ;
 *   2. l'ENCRE est l'écart de chaque pixel à son papier, en couleur et pas seulement en luminosité :
 *      un mur rose sur papier crème est de l'encre, SANS pipette (décision de Valentin : le plus
 *      automatique possible, une action de l'utilisateur seulement en dernier recours) ;
 *   3. une FERMETURE (dilater puis éroder) fait une masse des hachures serrées ;
 *   4. une OUVERTURE (éroder puis dilater) efface tout trait plus fin qu'un mur : texte, cotes,
 *      arcs de portes, mobilier. Le rayon se déduit de l'épaisseur des traits FINS du plan ;
 *   5. on garde la plus grande masse, et celles dont le centre tombe dans sa boîte, qui grandit de
 *      chaque masse gardée (les portes coupent un bâtiment en morceaux) : les poteaux et les murs
 *      isolés restent, l'échelle graphique et le cartouche, posés à côté, partent.
 *
 * Les morphologies passent par la TRANSFORMÉE DE DISTANCE euclidienne exacte (Felzenszwalb et
 * Huttenlocher), en temps linéaire : dilater de r, c'est garder ce qui est à moins de r de l'encre.
 *
 * ⚠️ L'ENCRE D'ORIGINE EST RENDUE AVEC LES MURS. La fermeture remplit aussi les deux ou trois traits
 * fins d'une fenêtre dessinée dans l'épaisseur d'un mur : c'est voulu (le mur reste continu), et
 * c'est l'encre d'origine, rendue à part, qui permettra à #456c d'y retrouver la fenêtre.
 */

/** Le plus grand côté de l'image de travail, en pixels : au-delà, elle est réduite. */
export const COTE_DE_TRAVAIL = 2000;

const luminance = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** L'image réduite d'un facteur entier `f` (moyenne par blocs), en RGB. */
function reduire(rgba, w, h, f){
  const W = Math.floor(w / f), H = Math.floor(h / f), out = new Uint8ClampedArray(W * H * 3);
  const n = f * f;
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    let r = 0, g = 0, b = 0;
    for (let y = Y * f; y < Y * f + f; y++) for (let x = X * f; x < X * f + f; x++) {
      const i = (y * w + x) * 4; r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2];
    }
    const o = (Y * W + X) * 3; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
  }
  return { rgb: out, w: W, h: H };
}

/** La couleur la plus fréquente d'une zone (4 bits par canal), et la moyenne de ses pixels. */
function couleurDominante(rgb, w, x0, y0, x1, y1, hist, somme){
  hist.fill(0); somme.fill(0);
  let meilleur = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * w + x) * 3, r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    hist[k]++; somme[k * 3] += r; somme[k * 3 + 1] += g; somme[k * 3 + 2] += b;
    if (hist[k] > hist[meilleur]) meilleur = k;
  }
  const n = hist[meilleur] || 1;
  return [somme[meilleur * 3] / n, somme[meilleur * 3 + 1] / n, somme[meilleur * 3 + 2] / n];
}

/**
 * Le papier, par blocs, interpolé : un tableau RGB de la taille de l'image. Un bloc dont la couleur
 * dominante est franchement plus sombre que le papier de toute la feuille est PLEIN D'ENCRE (un grand
 * poché), et prend le papier global plutôt que la couleur du mur.
 */
function papierLocal(rgb, w, h){
  const hist = new Uint32Array(4096), somme = new Float64Array(4096 * 3);
  const global = couleurDominante(rgb, w, 0, 0, w, h, hist, somme);
  const lg = luminance(...global);
  const B = Math.max(16, Math.round(Math.max(w, h) / 12));
  const nx = Math.ceil(w / B), ny = Math.ceil(h / B), blocs = new Float32Array(nx * ny * 3);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let c = couleurDominante(rgb, w, i * B, j * B, Math.min(w, (i + 1) * B), Math.min(h, (j + 1) * B), hist, somme);
    const ecart = Math.hypot(c[0] - global[0], c[1] - global[1], c[2] - global[2]);
    if (luminance(...c) < lg - 90 || ecart > 120) c = global;
    blocs.set(c, (j * nx + i) * 3);
  }
  const papier = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(ny - 1, Math.max(0, (y + 0.5) / B - 0.5)), j0 = Math.floor(fy), j1 = Math.min(ny - 1, j0 + 1), ty = fy - j0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(nx - 1, Math.max(0, (x + 0.5) / B - 0.5)), i0 = Math.floor(fx), i1 = Math.min(nx - 1, i0 + 1), tx = fx - i0;
      for (let c = 0; c < 3; c++) {
        const a = blocs[(j0 * nx + i0) * 3 + c] * (1 - tx) + blocs[(j0 * nx + i1) * 3 + c] * tx;
        const b = blocs[(j1 * nx + i0) * 3 + c] * (1 - tx) + blocs[(j1 * nx + i1) * 3 + c] * tx;
        papier[(y * w + x) * 3 + c] = a * (1 - ty) + b * ty;
      }
    }
  }
  return { papier, global };
}

/** L'encre : l'écart de couleur de chaque pixel à son papier (0 à 255). Plus clair que le papier : 0. */
function carteDEncre(rgb, papier, n){
  const encre = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 3, r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
    const pr = papier[i], pg = papier[i + 1], pb = papier[i + 2];
    if (luminance(r, g, b) > luminance(pr, pg, pb) + 8) continue;
    encre[p] = Math.min(255, Math.hypot(r - pr, g - pg, b - pb));
  }
  return encre;
}

/** Le seuil d'encre : au-dessus du bruit du papier (sa médiane), jamais sous 30. */
function seuilDEncre(encre){
  const hist = new Uint32Array(256);
  for (let p = 0; p < encre.length; p++) hist[encre[p]]++;
  let cumul = 0, mediane = 0;
  for (; mediane < 256; mediane++) { cumul += hist[mediane]; if (cumul >= encre.length / 2) break; }
  return Math.max(30, 4 * mediane + 10);
}

/** Transformée de distance 1D au carré (Felzenszwalb et Huttenlocher), en place dans `d`. */
function edt1D(f, d, v, z, n){
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  const inter = (q, p) => ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
  for (let q = 1; q < n; q++) {
    let s = inter(q, v[k]);
    while (s <= z[k]) { k--; s = inter(q, v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const p = v[k];
    d[q] = (q - p) * (q - p) + f[p];
  }
}

/** Le carré de la distance de chaque pixel au plus proche pixel `cible` (cible[p] = 1). */
function distanceCarree(cible, w, h){
  const INF = 1e12, out = new Float64Array(w * h), m = Math.max(w, h);
  const f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = cible[y * w + x] ? 0 : INF;
    edt1D(f, d, v, z, h);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = out[y * w + x];
    edt1D(f, d, v, z, w);
    for (let x = 0; x < w; x++) out[y * w + x] = d[x];
  }
  return out;
}

const inverse = (m) => { const o = new Uint8Array(m.length); for (let i = 0; i < m.length; i++) o[i] = m[i] ? 0 : 1; return o; };

/** Dilater de r : ce qui est à moins de r de l'encre. */
function dilater(m, w, h, r){
  const d = distanceCarree(m, w, h), r2 = r * r, o = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) o[i] = d[i] <= r2 ? 1 : 0;
  return o;
}

/** Éroder de r : ce qui est à plus de r du fond. Les bords de l'image comptent comme du fond. */
function eroder(m, w, h, r){
  const W = w + 2, H = h + 2, cadre = new Uint8Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cadre[(y + 1) * W + x + 1] = m[y * w + x] ? 0 : 1;
  for (let x = 0; x < W; x++) { cadre[x] = 1; cadre[(H - 1) * W + x] = 1; }
  for (let y = 0; y < H; y++) { cadre[y * W] = 1; cadre[y * W + W - 1] = 1; }
  const d = distanceCarree(cadre, W, H), r2 = r * r, o = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + x] = d[(y + 1) * W + x + 1] > r2 ? 1 : 0;
  return o;
}

/**
 * La demi-épaisseur des traits FINS, en pixels : la valeur la plus fréquente de la distance au fond
 * sur les crêtes (maxima locaux) de l'encre, parmi les crêtes d'au plus 3 px. Un plan sans trait
 * fin (rien que des murs) rend 1.
 */
function demiEpaisseurFine(m, w, h){
  const d = distanceCarree(inverse(m), w, h), compte = [0, 0, 0, 0];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (!m[i]) continue;
    const v = d[i];
    if (v > 9) continue;
    if (v < d[i - 1] || v < d[i + 1] || v < d[i - w] || v < d[i + w]) continue;
    compte[Math.max(1, Math.round(Math.sqrt(v)))]++;
  }
  let t = 1;
  for (let k = 2; k <= 3; k++) if (compte[k] > compte[t]) t = k;
  return t;
}

/** Les masses (4-connexité) : étiquettes, et pour chacune son aire et sa boîte. */
function masses(m, w, h){
  const etiquette = new Int32Array(w * h), pile = new Int32Array(w * h), infos = [];
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || etiquette[s]) continue;
    const id = infos.length + 1, info = { id, aire: 0, x0: w, y0: h, x1: -1, y1: -1 };
    let haut = 0; pile[haut++] = s; etiquette[s] = id;
    while (haut) {
      const p = pile[--haut], x = p % w, y = (p - x) / w;
      info.aire++;
      if (x < info.x0) info.x0 = x; if (x > info.x1) info.x1 = x;
      if (y < info.y0) info.y0 = y; if (y > info.y1) info.y1 = y;
      if (x > 0 && m[p - 1] && !etiquette[p - 1]) { etiquette[p - 1] = id; pile[haut++] = p - 1; }
      if (x < w - 1 && m[p + 1] && !etiquette[p + 1]) { etiquette[p + 1] = id; pile[haut++] = p + 1; }
      if (y > 0 && m[p - w] && !etiquette[p - w]) { etiquette[p - w] = id; pile[haut++] = p - w; }
      if (y < h - 1 && m[p + w] && !etiquette[p + w]) { etiquette[p + w] = id; pile[haut++] = p + w; }
    }
    infos.push(info);
  }
  return { etiquette, infos };
}

/**
 * Les MURS d'un plan. `rgba` : les pixels (comme un ImageData), `w` × `h`.
 * Options : `rayonFermeture`, `rayonOuverture` (pixels de l'image de travail) pour forcer ce qui est
 * sinon déduit.
 *
 * Rend `{ largeur, hauteur, facteur, murs, encre, papier, demiEpaisseurFine, rayonOuverture,
 * rayonFermeture, seuil }` : `murs` et `encre` sont des masques (Uint8Array, 1 = oui) de l'image de
 * TRAVAIL, `facteur` fois plus petite que l'originale (1 si elle n'a pas été réduite).
 */
export function detecterLesMurs(rgba, w, h, options = {}){
  const facteur = Math.max(1, Math.ceil(Math.max(w, h) / COTE_DE_TRAVAIL));
  const { rgb, w: W, h: H } = reduire(rgba, w, h, facteur);
  const n = W * H;
  const { papier, global } = papierLocal(rgb, W, H);
  const valeurs = carteDEncre(rgb, papier, n);
  const seuil = seuilDEncre(valeurs);
  const encre = new Uint8Array(n);
  for (let p = 0; p < n; p++) encre[p] = valeurs[p] >= seuil ? 1 : 0;

  const t = demiEpaisseurFine(encre, W, H);
  const rayonFermeture = options.rayonFermeture ?? Math.max(2, Math.round(2.5 * t));
  const rayonOuverture = options.rayonOuverture ?? 2 * t + 1;

  const ferme = eroder(dilater(encre, W, H, rayonFermeture), W, H, rayonFermeture);
  const coeur = eroder(ferme, W, H, rayonOuverture);
  const ouvert = dilater(coeur, W, H, rayonOuverture);
  for (let p = 0; p < n; p++) ouvert[p] &= ferme[p];

  const { etiquette, infos } = masses(ouvert, W, H);
  const murs = new Uint8Array(n);
  if (infos.length) {
    // La boîte GRANDIT : les portes coupent un bâtiment en plusieurs masses, et une masse gardée
    // peut faire entrer la suivante. Jusqu'à ce que plus rien n'entre.
    const grande = infos.reduce((a, b) => (b.aire > a.aire ? b : a));
    const boite = { x0: grande.x0, y0: grande.y0, x1: grande.x1, y1: grande.y1 };
    const garde = new Set([grande.id]);
    for (let ajout = true; ajout;) {
      ajout = false;
      for (const m of infos) {
        if (garde.has(m.id)) continue;
        const cx = (m.x0 + m.x1) / 2, cy = (m.y0 + m.y1) / 2;
        if (cx < boite.x0 || cx > boite.x1 || cy < boite.y0 || cy > boite.y1) continue;
        garde.add(m.id); ajout = true;
        boite.x0 = Math.min(boite.x0, m.x0); boite.y0 = Math.min(boite.y0, m.y0);
        boite.x1 = Math.max(boite.x1, m.x1); boite.y1 = Math.max(boite.y1, m.y1);
      }
    }
    for (let p = 0; p < n; p++) if (garde.has(etiquette[p])) murs[p] = 1;
  }
  return {
    largeur: W, hauteur: H, facteur, murs, encre, papier: global.map(Math.round),
    demiEpaisseurFine: t, rayonOuverture, rayonFermeture, seuil,
  };
}
