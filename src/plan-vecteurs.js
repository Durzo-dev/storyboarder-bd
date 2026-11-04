/**
 * @file plan-vecteurs.js
 * #456b, DES PIXELS DE MUR AUX MURS DU BÂTIMENT. Fonctions PURES, vérifiées sous Node
 * (tests/plan-vecteurs.test.mjs). Elles prennent le masque rendu par `detecterLesMurs`
 * (plan-murs.js) et rendent des segments, puis un bâtiment de l'éditeur (batiment.js).
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * LA MÉTHODE, ET POURQUOI PAS UN SQUELETTE
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Amincir le masque en un squelette d'un pixel est la voie classique ; elle laisse des escaliers
 * sur les traits, des moustaches aux angles des murs épais et des carrefours flous, qu'il faut
 * ensuite raboter. Or un plan est, très majoritairement, fait de murs PARALLÈLES À DEUX DIRECTIONS
 * perpendiculaires (docs/en/plan-sources.md : Durand et sa grille, les relevés, la CAO). D'où :
 *
 *   1. la DIRECTION DOMINANTE du plan, lue sur l'orientation des bords du masque (modulo 90°) ;
 *   2. le masque REDRESSÉ dans cette direction ; chaque pixel appartient au mur HORIZONTAL ou
 *      VERTICAL selon que son passage (la suite de pixels pleins) est plus long en ligne ou en
 *      colonne ;
 *   3. chaque masse d'une classe est un mur : son axe, sa longueur, son épaisseur (la médiane des
 *      passages transverses). Une masse qui n'est pas une bande (un mur en biais) est écartée ;
 *   4. ce qui reste et qui est allongé (un mur en biais, une tour) est ajusté par une droite
 *      (analyse en composantes principales) et garde son angle ;
 *   5. les JONCTIONS : un bout de mur proche de l'axe d'un autre mur, non parallèle, est porté à
 *      l'intersection des deux axes (prolongé ou raccourci). Tombé au milieu de l'autre mur, il le
 *      coupe (jonction en T, comme le tracé de l'éditeur) ; près de son bout, il le rejoint (angle).
 *
 * Les segments sont en pixels de l'image de travail ; `batimentDuPlan` les passe en mètres, avec
 * l'échelle, et les pose par `ajouterMur`, exactement comme si on les avait tracés.
 */

import { creerBatiment, BORNES_BATIMENT } from './batiment.js';
import { ajouterMur } from './batiment-trace.js';
import { actualiserPieces } from './batiment-pieces.js';
import { ajouterOuverture, reglagesParDefaut } from './batiment-ouvertures.js';

const DEG = Math.PI / 180;

/** La direction dominante des bords du masque, en radians, dans ]-45°, 45°]. */
function directionDominante(m, w, h){
  // Un flou en boîte (deux passes de rayon 2) rend aux bords d'un masque binaire des orientations
  // continues ; sans lui, le gradient ne connaît que les multiples de 45°.
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
  // Les bords : leur orientation modulo 90° (degrés), et leur poids.
  const angles = [], poids = [], hist = new Float64Array(90);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = flou[i + 1] - flou[i - 1], gy = flou[i + w] - flou[i - w], g2 = gx * gx + gy * gy;
    if (g2 < 1e-4) continue;
    const a = (((Math.atan2(gy, gx) / DEG) % 90) + 90) % 90;
    angles.push(a); poids.push(g2);
    hist[Math.floor(a) % 90] += g2;
  }
  let meilleur = 0, score = -1;
  for (let b = 0; b < 90; b++) {
    let s = 0;
    for (let k = -2; k <= 2; k++) s += hist[(b + k + 90) % 90];
    if (s > score) { score = s; meilleur = b; }
  }
  // Affinage sur les angles EXACTS proches du pic (moyenne circulaire de période 90°) : le centre
  // des cases de l'histogramme décalerait d'un demi-degré un plan parfaitement droit.
  let sx = 0, sy = 0;
  for (let k = 0; k < angles.length; k++) {
    let d = angles[k] - (meilleur + 0.5);
    d = ((d + 45) % 90 + 90) % 90 - 45;
    if (Math.abs(d) > 4) continue;
    sx += poids[k] * Math.cos(angles[k] * 4 * DEG); sy += poids[k] * Math.sin(angles[k] * 4 * DEG);
  }
  let angle = Math.atan2(sy, sx) / 4;
  if (angle > Math.PI / 4) angle -= Math.PI / 2;
  if (angle <= -Math.PI / 4) angle += Math.PI / 2;
  return Math.abs(angle) < 0.3 * DEG ? 0 : angle;
}

/** Le repère redressé : l'échantillonnage du masque tourné de `angle`, et le retour aux pixels. */
function redresser(m, w, h, angle){
  const c = Math.cos(angle), s = Math.sin(angle);
  const W = angle ? Math.ceil(Math.abs(w * c) + Math.abs(h * s)) : w;
  const H = angle ? Math.ceil(Math.abs(w * s) + Math.abs(h * c)) : h;
  const versImage = (U, V) => {
    const u = U - W / 2, v = V - H / 2;
    return { x: w / 2 + u * c - v * s, y: h / 2 + u * s + v * c };
  };
  const r = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const p = versImage(i + 0.5, j + 0.5), x = Math.floor(p.x), y = Math.floor(p.y);
    if (x >= 0 && y >= 0 && x < w && y < h) r[j * W + i] = m[y * w + x];
  }
  return { r, W, H, versImage };
}

/** La longueur du passage (suite de pixels pleins) qui contient chaque pixel, en ligne et en colonne. */
function passages(r, W, H){
  const hor = new Int32Array(W * H), ver = new Int32Array(W * H);
  for (let j = 0; j < H; j++) {
    let x = 0;
    while (x < W) {
      if (!r[j * W + x]) { x++; continue; }
      let e = x; while (e < W && r[j * W + e]) e++;
      for (let k = x; k < e; k++) hor[j * W + k] = e - x;
      x = e;
    }
  }
  for (let i = 0; i < W; i++) {
    let y = 0;
    while (y < H) {
      if (!r[y * W + i]) { y++; continue; }
      let e = y; while (e < H && r[e * W + i]) e++;
      for (let k = y; k < e; k++) ver[k * W + i] = e - y;
      y = e;
    }
  }
  return { hor, ver };
}

/** Les masses (4-connexité) des pixels `p` tels que `garder(p)`, en listes d'indices. */
function massesDe(W, H, garder){
  const vu = new Uint8Array(W * H), pile = new Int32Array(W * H), res = [];
  for (let s = 0; s < W * H; s++) {
    if (vu[s] || !garder(s)) continue;
    const pts = []; let haut = 0; pile[haut++] = s; vu[s] = 1;
    while (haut) {
      const p = pile[--haut], x = p % W; pts.push(p);
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (q >= 0 && q < W * H && !vu[q] && garder(q)) { vu[q] = 1; pile[haut++] = q; }
      }
    }
    res.push(pts);
  }
  return res;
}

const mediane = (t) => { const s = t.slice().sort((a, b) => a - b); return s[s.length >> 1]; };

/** Les murs parallèles aux axes du repère redressé, et les pixels qu'ils ont pris. */
function mursDroits(r, W, H){
  const { hor, ver } = passages(r, W, H);
  const pris = new Uint8Array(W * H), murs = [];
  for (const horizontal of [true, false]) {
    const classe = (p) => r[p] && (horizontal ? hor[p] >= ver[p] : ver[p] > hor[p]);
    for (const pts of massesDe(W, H, classe)) {
      let l0 = Infinity, l1 = -Infinity, t0 = Infinity, t1 = -Infinity, somme = 0;
      const transverses = [];
      for (const p of pts) {
        const x = p % W, y = (p - x) / W, l = horizontal ? x : y, t = horizontal ? y : x;
        if (l < l0) l0 = l; if (l > l1) l1 = l; if (t < t0) t0 = t; if (t > t1) t1 = t;
        somme += t; transverses.push(horizontal ? ver[p] : hor[p]);
      }
      const longueur = l1 - l0 + 1, largeur = t1 - t0 + 1;
      const epaisseur = Math.min(mediane(transverses), largeur);
      // Une BANDE : nettement plus longue qu'épaisse, et pas plus large que son épaisseur. Un mur en
      // biais classé « horizontal » rangée par rangée est large ; le bout d'un mur en biais collé à
      // un mur droit est court. Les deux partent dans le reste, où la droite ajustée les reprend.
      if (longueur < 1.5 * epaisseur + 2 || largeur > 1.5 * epaisseur + 2 || epaisseur < 2) continue;
      const axe = somme / pts.length + 0.5;
      murs.push(horizontal
        ? { a: { x: l0, y: axe }, b: { x: l1 + 1, y: axe }, epaisseur }
        : { a: { x: axe, y: l0 }, b: { x: axe, y: l1 + 1 }, epaisseur });
      for (const p of pts) pris[p] = 1;
    }
  }
  return { murs, pris };
}

/** Les murs EN BIAIS : ce qui reste, s'il est allongé, ajusté par une droite. */
function mursEnBiais(r, W, H, pris){
  const murs = [];
  for (const pts of massesDe(W, H, (p) => r[p] && !pris[p])) {
    if (pts.length < 20) continue;
    let mx = 0, my = 0;
    for (const p of pts) { mx += p % W; my += Math.floor(p / W); }
    mx /= pts.length; my /= pts.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of pts) { const dx = p % W - mx, dy = Math.floor(p / W) - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const a = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(a), uy = Math.sin(a);
    let t0 = Infinity, t1 = -Infinity;
    for (const p of pts) { const t = (p % W - mx) * ux + (Math.floor(p / W) - my) * uy; if (t < t0) t0 = t; if (t > t1) t1 = t; }
    const longueur = t1 - t0 + 1, epaisseur = pts.length / longueur;
    if (longueur < 3 * epaisseur || epaisseur < 2) continue;
    mx += 0.5; my += 0.5;
    murs.push({ a: { x: mx + ux * (t0 - 0.5), y: my + uy * (t0 - 0.5) }, b: { x: mx + ux * (t1 + 0.5), y: my + uy * (t1 + 0.5) }, epaisseur });
  }
  return murs;
}

const sous = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const norme = (v) => Math.hypot(v.x, v.y);

/** L'intersection des droites (a1, b1) et (a2, b2), ou null si elles sont presque parallèles. */
function intersection(a1, b1, a2, b2){
  const d1 = sous(b1, a1), d2 = sous(b2, a2), det = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(det) < Math.sin(30 * DEG) * norme(d1) * norme(d2)) return null;
  const t = ((a2.x - a1.x) * d2.y - (a2.y - a1.y) * d2.x) / det;
  return { x: a1.x + d1.x * t, y: a1.y + d1.y * t };
}

/** Le paramètre de `p` le long de (a, b), en pixels depuis `a`. */
const le = (p, a, b) => { const d = sous(b, a), L = norme(d); return ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / L; };

/** Les jonctions : bouts portés aux intersections, murs coupés en T, sommets fusionnés. */
function joindre(segments){
  const coupes = segments.map(() => []);
  for (let i = 0; i < segments.length; i++) for (const bout of ['a', 'b']) {
    const s = segments[i], E = s[bout];
    let meilleur = null;
    for (let j = 0; j < segments.length; j++) {
      if (j === i) continue;
      const o = segments[j], X = intersection(s.a, s.b, o.a, o.b);
      if (!X) continue;
      const d = norme(sous(X, E)), marge = (s.epaisseur + o.epaisseur) / 2 + 3;
      const t = le(X, o.a, o.b), L = norme(sous(o.b, o.a));
      if (d > marge || t < -(o.epaisseur / 2 + 3) || t > L + o.epaisseur / 2 + 3) continue;
      // Le bout doit rester du bon côté : prolonger ou raccourcir, pas retourner le mur.
      if (le(X, s.a, s.b) <= 0 && bout === 'b') continue;
      if (le(X, s.a, s.b) >= norme(sous(s.b, s.a)) && bout === 'a') continue;
      if (!meilleur || d < meilleur.d) meilleur = { d, j, X };
    }
    if (meilleur) { s[bout] = meilleur.X; coupes[meilleur.j].push(meilleur.X); }
  }
  // Un point de jonction près d'un bout du mur hôte EST ce bout (un angle) ; ailleurs, il le coupe.
  const resultat = [];
  segments.forEach((s, i) => {
    const L = () => norme(sous(s.b, s.a)), pts = [];
    for (const X of coupes[i]) {
      const t = le(X, s.a, s.b);
      if (t < s.epaisseur) s.a = X; else if (t > L() - s.epaisseur) s.b = X; else pts.push(X);
    }
    const tri = pts.map(X => ({ X, t: le(X, s.a, s.b) })).sort((p, q) => p.t - q.t);
    let depart = s.a;
    for (const { X } of tri) { resultat.push({ a: depart, b: X, epaisseur: s.epaisseur }); depart = X; }
    resultat.push({ a: depart, b: s.b, epaisseur: s.epaisseur });
  });
  // Les sommets à moins de 1,5 px se confondent (deux arrondis du même carrefour).
  const sommets = [];
  const commun = (p) => {
    const v = sommets.find(q => norme(sous(p, q)) < 1.5);
    if (v) return v;
    sommets.push(p); return p;
  };
  return resultat
    .map(s => ({ a: commun(s.a), b: commun(s.b), epaisseur: s.epaisseur }))
    .filter(s => norme(sous(s.b, s.a)) >= 1);
}

/**
 * Les murs du masque `murs` (w × h, 1 = mur) en SEGMENTS : `{ angle, segments: [{ a: {x, y},
 * b: {x, y}, epaisseur }] }`, en pixels de la même image ; `angle` est la direction dominante.
 */
export function vectoriserLesMurs(murs, w, h){
  const angle = directionDominante(murs, w, h);
  const { r, W, H, versImage } = redresser(murs, w, h, angle);
  const { murs: droits, pris } = mursDroits(r, W, H);
  // Un « mur en biais » bien plus mince que les murs droits est un reste : le congé qu'a laissé la
  // fermeture là où un arc de porte touche un mur, par exemple.
  const epaisseurType = droits.length ? mediane(droits.map(s => s.epaisseur)) : 0;
  const biais = mursEnBiais(r, W, H, pris).filter(s => s.epaisseur >= 0.5 * epaisseurType);
  const dansLImage = (s) => ({ a: versImage(s.a.x, s.a.y), b: versImage(s.b.x, s.b.y), epaisseur: s.epaisseur });
  return { angle, segments: joindre([...droits, ...biais].map(dansLImage)) };
}

/**
 * Un BÂTIMENT de l'éditeur à partir des segments : `metresParPixel` donne l'échelle (l'image de
 * travail, pas l'originale). Le bâtiment est centré sur l'origine ; les épaisseurs sont ramenées
 * dans les bornes de l'éditeur ; les pièces sont déduites comme après un tracé. Un segment peut
 * porter des `ouvertures` (#456c, `ouverturesDuPlan`) : `{ s0, s1, type, sens?, charniere?,
 * battants? }`, en pixels depuis a ; elles sont posées avec les réglages par défaut de leur type,
 * à leur largeur. Rend `{ batiment, refuses, ouverturesRefusees }` : ce que l'éditeur a refusé
 * (mur trop court ou croisé ; ouverture qui ne tient pas).
 */
export function batimentDuPlan(segments, { metresParPixel, nom, traduire } = {}){
  const b = creerBatiment(nom, traduire), niveauId = b.niveaux[0].id;
  if (!segments.length || !(metresParPixel > 0)) return { batiment: b, refuses: segments.length };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const s of segments) for (const p of [s.a, s.b]) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const enMetres = (p) => ({ x: (p.x - cx) * metresParPixel, z: (p.y - cy) * metresParPixel });
  const [eMin, eMax] = BORNES_BATIMENT.epaisseur;
  let refuses = 0, ouverturesRefusees = 0;
  for (const s of segments) {
    const e = Math.min(eMax, Math.max(eMin, Math.round(s.epaisseur * metresParPixel * 100) / 100));
    const { mur } = ajouterMur(b, niveauId, enMetres(s.a), enMetres(s.b), e);
    if (!mur) { refuses++; ouverturesRefusees += (s.ouvertures || []).length; continue; }
    const L = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
    for (const o of s.ouvertures || []) {
      const r = { ...reglagesParDefaut(o.type), largeur: Math.round((o.s1 - o.s0) * metresParPixel * 100) / 100 };
      for (const k of ['sens', 'charniere', 'battants']) if (o[k] !== undefined) r[k] = o[k];
      if (ajouterOuverture(b, mur.id, (o.s0 + o.s1) / 2 / L, r).erreur) ouverturesRefusees++;
    }
  }
  actualiserPieces(b, niveauId, traduire);
  return { batiment: b, refuses, ouverturesRefusees };
}
