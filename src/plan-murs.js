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
 * remplissage noir (poché), un lavis carmin ou rose (XVIIe-XIXe siècles), un gris, des hachures, ou,
 * sur la plupart des plans de CAO, DEUX TRAITS FINS PARALLÈLES. Ce qui les réunit tous : un mur est
 * une BANDE LONGUE ET DROITE, orientée selon les directions du plan.
 *
 *   1. le PAPIER est estimé localement (un plan photographié est mal éclairé, un parchemin jauni) ;
 *   2. l'ENCRE est l'écart de chaque pixel à son papier, en couleur et pas seulement en luminosité :
 *      un mur rose sur papier crème est de l'encre, SANS pipette (décision de Valentin : le plus
 *      automatique possible, une action de l'utilisateur seulement en dernier recours) ;
 *   3. les DIRECTIONS du plan sont lues sur l'orientation des bords : la dominante, et les
 *      secondaires (une façade en biais) ;
 *   4. pour chacune, dans le repère tourné : COMBLER dans l'épaisseur les vides courts (le double
 *      trait, le contour hachuré deviennent pleins), ÉCARTER ce qui reste mince (une cote seule),
 *      puis GARDER ce qui est long le long de la direction (le texte, aux lettres séparées, et le
 *      mobilier court tombent). Les réglages suivent la feuille, la minceur suit les traits fins ;
 *   5. on garde la plus grande masse, et celles qui touchent sa boîte, qui grandit de chaque masse
 *      gardée (les portes coupent un bâtiment en morceaux) : l'échelle graphique, les cotes et le
 *      cartouche, posés plus loin, partent.
 *
 * ⚠️ CETTE MÉTHODE REMPLACE UNE PREMIÈRE, essayée par Valentin sur trois vrais plans le 4 novembre
 * 2026 (plans-test/, hors du dépôt) : une fermeture puis une ouverture ISOTROPES, qui gardaient
 * « ce qui est épais ». Elles effaçaient les murs en double trait (traits fins) et gardaient le
 * texte, les arbres, le mobilier dessiné serré.
 *
 * ⚠️ L'ENCRE D'ORIGINE EST RENDUE AVEC LES MURS. Le comblement remplit aussi les deux ou trois traits
 * fins d'une fenêtre dessinée dans l'épaisseur d'un mur : c'est voulu (le mur reste continu), et
 * c'est l'encre d'origine, rendue à part, qui permet à #456c d'y retrouver la fenêtre.
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

/** Le centile `q` (0 à 1) des valeurs d'encre au-dessus de `seuil`. */
function centile(valeurs, seuil, q){
  const hist = new Uint32Array(256);
  let total = 0;
  for (let p = 0; p < valeurs.length; p++) if (valeurs[p] >= seuil) { hist[valeurs[p]]++; total++; }
  let cumul = 0;
  for (let v = 0; v < 256; v++) { cumul += hist[v]; if (cumul >= q * total) return v; }
  return 255;
}

/** Le seuil d'Otsu des valeurs d'encre au-dessus de `seuil` : ce qui sépare l'encre claire de la foncée. */
function seuilDOtsu(valeurs, seuil){
  const hist = new Float64Array(256);
  let total = 0, somme = 0;
  for (let p = 0; p < valeurs.length; p++) { const v = valeurs[p]; if (v >= seuil) { hist[v]++; total++; somme += v; } }
  if (!total) return seuil;
  let wB = 0, sB = 0, meilleur = seuil, max = -1;
  for (let v = 0; v < 256; v++) {
    wB += hist[v]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sB += v * hist[v];
    const mB = sB / wB, mF = (somme - sB) / wF, entre = wB * wF * (mB - mF) * (mB - mF);
    if (entre > max) { max = entre; meilleur = v; }
  }
  return Math.max(seuil, meilleur);
}

/** Le part d'encre foncée en masses épaisses au-delà de laquelle un plan est dit POCHÉ. */
export const PART_POCHE = 0.15;

/** Le STYLE du plan ('poche' ou 'trait'), et son encre foncée (masque). */
function styleDuPlan(valeurs, seuil, W, H, rgb){
  // Le seuil de l'encre foncée est plafonné à la MOITIÉ DE L'ENCRE LA PLUS NOIRE (son 95e centile) :
  // quand toute l'encre est foncée (rien que des murs noirs), Otsu coupe À L'INTÉRIEUR des murs, entre
  // ceux du côté clair et ceux du côté sombre d'une photo mal éclairée, et en perd la moitié.
  const otsu = seuilDOtsu(valeurs, seuil), foncee = new Uint8Array(W * H);
  const hist = new Uint32Array(256);
  let total = 0;
  for (let p = 0; p < valeurs.length; p++) if (valeurs[p] >= seuil) { hist[valeurs[p]]++; total++; }
  let cumul = 0, p95 = 255;
  for (; p95 > 0; p95--) { cumul += hist[p95]; if (cumul >= 0.05 * total) break; }
  const coupe = Math.min(otsu, Math.max(seuil, 0.5 * p95));
  let n = 0;
  for (let p = 0; p < foncee.length; p++) if (valeurs[p] > coupe) { foncee[p] = 1; n++; }
  if (!n) return { style: 'trait', foncee, otsu };
  // ⚠️ L'ENCRE FONCÉE D'UN PLAN GRIS NE GARDE QUE SON GRIS. Un meuble coloré (lit bleu, armoire
  // magenta d'une annonce, plan n° 5) est loin du papier par sa COULEUR, et passait pour un mur. Si
  // l'encre foncée est au moins à moitié peu saturée (murs noirs ou gris ; 57 % sur le plan n° 5, aux
  // grands aplats de couleur), ses pixels saturés partent ; si
  // elle est surtout colorée (un lavis rose ancien), elle reste entière.
  if (rgb) {
    const sat = (p) => { const r = rgb[p * 3], g = rgb[p * 3 + 1], b = rgb[p * 3 + 2]; return Math.max(r, g, b) - Math.min(r, g, b); };
    let gris = 0;
    for (let p = 0; p < foncee.length; p++) if (foncee[p] && sat(p) < 50) gris++;
    if (gris >= 0.5 * n) for (let p = 0; p < foncee.length; p++) if (foncee[p] && sat(p) >= 50) { foncee[p] = 0; n--; }
  }
  const d = distanceCarree(inverse(foncee), W, H);
  let epaisse = 0;
  for (let p = 0; p < foncee.length; p++) if (foncee[p] && d[p] >= 9) epaisse++;
  return { style: epaisse / n >= PART_POCHE ? 'poche' : 'trait', foncee, otsu };
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

/** Le flou en boîte (deux passes de rayon 2) d'un masque : des orientations de bord continues. */
function flouter(m, w, h){
  const flou = new Float32Array(w * h), tmp = new Float32Array(w * h), R = 2;
  for (let i = 0; i < w * h; i++) flou[i] = m[i];
  for (let passe = 0; passe < 2; passe++) {
    for (let y = 0; y < h; y++) {
      let s = 0;
      for (let x = -R; x <= R; x++) s += flou[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = s / (2 * R + 1);
        s += flou[y * w + Math.min(w - 1, x + R + 1)] - flou[y * w + Math.max(0, x - R)];
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = -R; y <= R; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        flou[y * w + x] = s / (2 * R + 1);
        s += tmp[Math.min(h - 1, y + R + 1) * w + x] - tmp[Math.max(0, y - R) * w + x];
      }
    }
  }
  return flou;
}

const DEG = Math.PI / 180;

/**
 * Les DIRECTIONS des murs, en radians dans ]-45°, 45°] (chacune vaut aussi pour sa perpendiculaire) :
 * la dominante d'abord, lue sur l'orientation des bords (modulo 90°), puis les secondaires, des pics
 * d'au moins 15 % du premier et à plus de 8° de tout pic retenu (une façade en biais, une aile).
 */
export function directionsDuPlan(m, w, h){
  const flou = flouter(m, w, h), angles = [], poids = [], hist = new Float64Array(90);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = flou[i + 1] - flou[i - 1], gy = flou[i + w] - flou[i - w], g2 = gx * gx + gy * gy;
    if (g2 < 1e-4) continue;
    const a = (((Math.atan2(gy, gx) / DEG) % 90) + 90) % 90;
    angles.push(a); poids.push(g2);
    hist[Math.floor(a) % 90] += g2;
  }
  const lisse = new Float64Array(90);
  for (let b = 0; b < 90; b++) for (let k = -2; k <= 2; k++) lisse[b] += hist[(b + k + 90) % 90];
  const ecart = (a, b) => { const d = Math.abs(a - b) % 90; return Math.min(d, 90 - d); };
  const pics = [];
  for (let b = 0; b < 90; b++) {
    if (lisse[b] < lisse[(b + 89) % 90] || lisse[b] < lisse[(b + 1) % 90]) continue;
    pics.push({ b, v: lisse[b] });
  }
  pics.sort((p, q) => q.v - p.v);
  const retenus = [];
  for (const p of pics) {
    if (retenus.length && p.v < 0.15 * retenus[0].v) break;
    if (retenus.some(r => ecart(r.b, p.b) <= 8)) continue;
    retenus.push(p);
    if (retenus.length === 3) break;
  }
  // Affinage sur les angles EXACTS proches de chaque pic (moyenne circulaire de période 90°).
  return retenus.map(({ b }) => {
    let sx = 0, sy = 0;
    for (let k = 0; k < angles.length; k++) {
      if (ecart(angles[k], b + 0.5) > 4) continue;
      sx += poids[k] * Math.cos(angles[k] * 4 * DEG); sy += poids[k] * Math.sin(angles[k] * 4 * DEG);
    }
    let a = Math.atan2(sy, sx) / 4;
    if (a > Math.PI / 4) a -= Math.PI / 2;
    if (a <= -Math.PI / 4) a += Math.PI / 2;
    return Math.abs(a) < 0.3 * DEG ? 0 : a;
  });
}

/** Le masque tourné de `angle` dans une grille qui le contient, et le chemin du retour. */
function tourner(m, w, h, angle){
  if (!angle) return { r: m, W: w, H: h, retour: (b) => b };
  const c = Math.cos(angle), s = Math.sin(angle);
  const W = Math.ceil(Math.abs(w * c) + Math.abs(h * s)), H = Math.ceil(Math.abs(w * s) + Math.abs(h * c));
  // Grille (i, j) → image (x, y) : rotation de `angle` autour des deux centres.
  const r = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const u = i + 0.5 - W / 2, v = j + 0.5 - H / 2;
    const x = Math.floor(w / 2 + u * c - v * s), y = Math.floor(h / 2 + u * s + v * c);
    if (x >= 0 && y >= 0 && x < w && y < h) r[j * W + i] = m[y * w + x];
  }
  const retour = (b) => {
    const o = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - w / 2, dy = y + 0.5 - h / 2;
      const i = Math.floor(W / 2 + dx * c + dy * s), j = Math.floor(H / 2 - dx * s + dy * c);
      if (i >= 0 && j >= 0 && i < W && j < H) o[y * w + x] = b[j * W + i];
    }
    return o;
  };
  return { r, W, H, retour };
}

/**
 * Les BANDES d'une direction, dans le repère tourné (W × H), le long de l'axe x (`horizontal`) ou
 * de l'axe y. Trois temps, dans CET ordre :
 *   1. combler dans l'épaisseur les vides de `g` pixels au plus : un double trait, un contour hachuré
 *      deviennent pleins ;
 *   2. écarter ce qui reste plus mince que `tmin` : une cote, un trait seul ;
 *   3. ne garder que les passages d'au moins `L` pixels le long de l'axe : le texte (lettres
 *      séparées) et le mobilier court tombent.
 * ⚠️ La minceur AVANT la longueur : un mur est épais TOUT DU LONG. Dans l'ordre inverse, une ligne
 * de cote longue, épaissie sur quelques pixels par le chiffre posé contre elle, passait pour un mur
 * (plan de test n° 3). Rend le masque, et la somme et le nombre des épaisseurs gardées.
 */
function bandes(r, W, H, g, L, tmin, horizontal){
  const n = W * H, m = Uint8Array.from(r);
  // (a, b) : a le long de la bande, b dans son épaisseur.
  const nA = horizontal ? W : H, nB = horizontal ? H : W;
  const idx = horizontal ? (a, b) => b * W + a : (a, b) => a * W + b;
  for (let a = 0; a < nA; a++) {
    let dernier = -1;
    for (let b = 0; b < nB; b++) {
      if (!r[idx(a, b)]) continue;
      if (dernier >= 0 && b - dernier > 1 && b - dernier - 1 <= g) for (let k = dernier + 1; k < b; k++) m[idx(a, k)] = 1;
      dernier = b;
    }
  }
  const epais = new Uint8Array(n);
  for (let a = 0; a < nA; a++) {
    let b = 0;
    while (b < nB) {
      if (!m[idx(a, b)]) { b++; continue; }
      let e = b; while (e < nB && m[idx(a, e)]) e++;
      if (e - b >= tmin) for (let k = b; k < e; k++) epais[idx(a, k)] = 1;
      b = e;
    }
  }
  const out = new Uint8Array(n);
  for (let b = 0; b < nB; b++) {
    let a = 0;
    while (a < nA) {
      if (!epais[idx(a, b)]) { a++; continue; }
      let e = a; while (e < nA && epais[idx(e, b)]) e++;
      if (e - a >= L) for (let k = a; k < e; k++) out[idx(k, b)] = 1;
      a = e;
    }
  }
  let somme = 0, nombre = 0;
  for (let a = 0; a < nA; a++) {
    let b = 0;
    while (b < nB) {
      if (!out[idx(a, b)]) { b++; continue; }
      let e = b; while (e < nB && out[idx(a, e)]) e++;
      somme += e - b; nombre++; b = e;
    }
  }
  return { masque: out, somme, nombre };
}

/** Les murs de toutes les directions, avec les réglages (g, L, tmin) ; et l'épaisseur moyenne trouvée. */
function mursParBandes(encre, W, H, directions, g, L, tmin){
  const murs = new Uint8Array(W * H);
  let somme = 0, nombre = 0;
  for (const angle of directions) {
    const { r, W: W2, H: H2, retour } = tourner(encre, W, H, angle);
    const union = new Uint8Array(W2 * H2);
    for (const horizontal of [true, false]) {
      const b = bandes(r, W2, H2, g, L, tmin, horizontal);
      for (let i = 0; i < union.length; i++) union[i] |= b.masque[i];
      somme += b.somme; nombre += b.nombre;
    }
    const dansLImage = retour(union);
    for (let i = 0; i < murs.length; i++) murs[i] |= dansLImage[i];
  }
  return { murs, epaisseur: nombre ? somme / nombre : 0 };
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

  // Les réglages, proportionnés à la FEUILLE plutôt qu'à une épaisseur mesurée : une première version
  // mesurait l'épaisseur des murs pour s'y régler, et les paquets de lignes de cote parallèles,
  // comblés, la gonflaient au point d'effacer les cloisons (plan de test n° 3). Ce qu'on comble et
  // la longueur exigée suivent la feuille ; la minceur refusée suit les traits FINS : une cote seule
  // (un trait) part, une cloison en double trait (deux traits et leur vide) reste.
  //
  // LE STYLE DU PLAN décide de l'encre et du comblement. Un plan POCHÉ (murs en masses foncées)
  // se lit sur son encre FONCÉE seule, presque sans combler : comblée, la grille gris clair d'un sol
  // carrelé et les meubles gris devenaient des murs (plan de test n° 2). Un plan AU TRAIT (double
  // trait, contours hachurés) a besoin de toute son encre et du comblement : l'encre foncée seule y
  // effaçait les traits gris d'un JPEG (plans n° 1 et 3). Le critère, mesuré sur les trois plans :
  // la part de l'encre foncée qui forme des masses de 5 px et plus (33 % contre moins de 1 %).
  const D = Math.max(W, H);
  const { style, foncee } = styleDuPlan(valeurs, seuil, W, H, rgb);
  // Au trait, l'encre LUE commence à la MÉDIANE de l'encre : les lignes de cote, plus grises que les
  // traits des murs, tombent (plan n° 1 : leurs paquets comblés faisaient des murs), et les traits des
  // murs restent. Mesuré : le bon seuil tombe sur la médiane, aux bureaux (122), à la maison (106) et
  // sur sa photo floue (79). La règle d'avant, 0,8 × Otsu, ne suivait pas la NETTETÉ : sur une photo,
  // aux traits plus pâles, elle effaçait les cloisons (plan n° 16, 2 pièces au lieu de 9).
  const seuilLu = options.seuilLu ?? (style === 'poche' ? null : Math.max(seuil, centile(valeurs, seuil, 0.5)));
  let lue = foncee;
  if (seuilLu != null) { lue = new Uint8Array(n); for (let p = 0; p < n; p++) lue[p] = valeurs[p] >= seuilLu ? 1 : 0; }
  const directions = directionsDuPlan(lue, W, H), t = demiEpaisseurFine(lue, W, H);
  const comble = options.comble ?? (style === 'poche' ? Math.max(2, Math.round(0.002 * D)) : Math.max(4, Math.round(0.015 * D)));
  const longueur = options.longueur ?? Math.max(10, Math.round(0.03 * D));
  const minceur = options.minceur ?? 2 * t + 2;
  const { murs: ouvert, epaisseur: T } = mursParBandes(lue, W, H, directions, comble, longueur, minceur);

  const { etiquette, infos } = masses(ouvert, W, H);
  const murs = new Uint8Array(n);
  if (infos.length) {
    // La boîte GRANDIT : les portes coupent un bâtiment en plusieurs masses, et une masse gardée
    // peut faire entrer la suivante. Jusqu'à ce que plus rien n'entre. (Exiger que son CENTRE y
    // tombe écartait la moitié d'un plan de test : une aile entière n'a pas son centre dedans.)
    //
    // ⚠️ UNE BANDE DE BORD N'EST PAS UN BÂTIMENT : une masse qui touche le bord de l'image et qui est
    // une bande mince (le bord d'un scan, une marge) est écartée d'emblée. Sur trois
    // plans de CubiCasa5K, la bande grise du bas de l'image était la plus grande masse, et le plan
    // lui-même partait.
    const D0 = Math.max(W, H);
    const cadre = (m) => {
      const touche = m.x0 <= 1 || m.y0 <= 1 || m.x1 >= W - 2 || m.y1 >= H - 2;
      const bw = m.x1 - m.x0 + 1, bh = m.y1 - m.y0 + 1;
      // (Pas de critère de remplissage : un bâtiment dessiné en contours est lui aussi « vide » dans sa
      // boîte, et un plan coupé par le bord de l'image partait.)
      return touche && Math.min(bw, bh) < 0.04 * D0;
    };
    const candidates = infos.filter(m => !cadre(m));
    if (!candidates.length) candidates.push(...infos);
    const grande = candidates.reduce((a, b) => (b.aire > a.aire ? b : a));
    // Un SECOND PLAN sur la feuille (un autre étage, posé à côté) : une masse au moins 30 % aussi
    // grande que la plus grande est gardée, même séparée, et a SA boîte, qui grandit comme l'autre.
    // Elle doit avoir DEUX dimensions (un paquet de lignes de cote, long et étroit, n'est pas un étage).
    const plan2D = (m) => { const bw = m.x1 - m.x0 + 1, bh = m.y1 - m.y0 + 1; return Math.min(bw, bh) >= 0.35 * Math.max(bw, bh); };
    const graines = candidates.filter(m => m === grande || (m.aire >= 0.3 * grande.aire && plan2D(m)));
    let boites = graines.map(m => ({ x0: m.x0, y0: m.y0, x1: m.x1, y1: m.y1 }));
    const garde = new Set(graines.map(m => m.id));
    // Les boîtes qui se CHEVAUCHENT n'en font qu'une : les morceaux d'un même bâtiment, coupé par ses
    // portes, se chevauchent ; deux étages posés côte à côte, non.
    const fusionner = () => {
      for (let i = 0; i < boites.length; i++) for (let j = i + 1; j < boites.length; j++) {
        const a = boites[i], b = boites[j];
        if (a.x1 < b.x0 - comble || b.x1 < a.x0 - comble || a.y1 < b.y0 - comble || b.y1 < a.y0 - comble) continue;
        boites[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
        boites = boites.filter((_, k) => k !== j);
        return true;
      }
      return false;
    };
    while (fusionner()) { /* jusqu'à la dernière */ }
    for (let ajout = true; ajout;) {
      ajout = false;
      while (fusionner()) { /* les boîtes grandies se rejoignent */ }
      for (const m of candidates) {
        if (garde.has(m.id)) continue;
        // Elle entre si elle TOUCHE une boîte, à la distance de comblement près : une aile séparée
        // du reste par une porte touche ; les cotes et le cartouche, posés plus loin, non.
        const boite = boites.find(b => !(m.x1 < b.x0 - comble || m.x0 > b.x1 + comble || m.y1 < b.y0 - comble || m.y0 > b.y1 + comble));
        if (!boite) continue;
        garde.add(m.id); ajout = true;
        boite.x0 = Math.min(boite.x0, m.x0); boite.y0 = Math.min(boite.y0, m.y0);
        boite.x1 = Math.max(boite.x1, m.x1); boite.y1 = Math.max(boite.y1, m.y1);
      }
    }
    for (let p = 0; p < n; p++) if (garde.has(etiquette[p])) murs[p] = 1;
  }
  return {
    largeur: W, hauteur: H, facteur, murs, encre, papier: global.map(Math.round),
    directions, epaisseurDesMurs: T, seuil, style,
  };
}
