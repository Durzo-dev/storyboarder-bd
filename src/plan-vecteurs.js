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
import { directionsDuPlan } from './plan-murs.js';

const DEG = Math.PI / 180;

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

/**
 * Les murs parallèles aux axes du repère redressé, et les pixels qu'ils ont pris.
 *
 * ⚠️ UNE MASSE N'EST PAS UN MUR : c'est la BANDE DOMINANTE qui en est un. Deux murs parallèles
 * reliés par un bloc (un couloir et sa cage d'escalier, plan de test n° 2) font une seule masse, trop
 * large pour être un mur ; la refuser l'envoyait aux murs en biais, qui en tiraient une énorme
 * oblique. On prend donc la bande la plus pleine (le pic des positions transverses), on en fait un
 * mur, et ce qui reste repart en masses à examiner de même.
 */
function mursDroits(r, W, H, longueurMin = 0){
  const { hor, ver } = passages(r, W, H);
  const pris = new Uint8Array(W * H), murs = [];
  for (const horizontal of [true, false]) {
    const classe = (p) => r[p] && (horizontal ? hor[p] >= ver[p] : ver[p] > hor[p]);
    const pos = (p) => { const x = p % W, y = (p - x) / W; return horizontal ? { l: x, t: y } : { l: y, t: x }; };
    const file = massesDe(W, H, classe).map(pts => ({ pts, profondeur: 0 }));
    while (file.length) {
      const { pts, profondeur } = file.pop();
      if (pts.length < 12) continue;
      // Le profil transverse : combien de pixels à chaque position t.
      let t0 = Infinity, t1 = -Infinity;
      for (const p of pts) { const { t } = pos(p); if (t < t0) t0 = t; if (t > t1) t1 = t; }
      const profil = new Int32Array(t1 - t0 + 1);
      for (const p of pts) profil[pos(p).t - t0]++;
      let pic = 0;
      for (let k = 1; k < profil.length; k++) if (profil[k] > profil[pic]) pic = k;
      let b0 = pic, b1 = pic;
      // 30 % du pic, et non la moitié : une façade dont les fenêtres ne gardent que le châssis (un
      // trait sur la face intérieure, plan n° 3) n'est pleine que sur la moitié de sa longueur ; à 50 %,
      // le mur devenait ce seul trait, et les morceaux hachurés partaient à côté.
      while (b0 > 0 && profil[b0 - 1] >= 0.3 * profil[pic]) b0--;
      while (b1 < profil.length - 1 && profil[b1 + 1] >= 0.3 * profil[pic]) b1++;
      const dans = [], reste = [];
      for (const p of pts) { const k = pos(p).t - t0; (k >= b0 && k <= b1 ? dans : reste).push(p); }
      let l0 = Infinity, l1 = -Infinity, somme = 0;
      for (const p of dans) { const { l, t } = pos(p); if (l < l0) l0 = l; if (l > l1) l1 = l; somme += t; }
      const epaisseur = b1 - b0 + 1, longueur = l1 - l0 + 1;
      // Une bande PLEINE : un mur en biais vu dans ce repère a un profil large et creux (plan de
      // test n° 1, la façade à 13,5°) ; il est laissé à la direction qui est la sienne.
      if (longueur >= 1.5 * epaisseur + 2 && longueur >= longueurMin && epaisseur >= 2 && dans.length >= 0.5 * longueur * epaisseur) {
        const axe = somme / dans.length + 0.5;
        murs.push(horizontal
          ? { a: { x: l0, y: axe }, b: { x: l1 + 1, y: axe }, epaisseur }
          : { a: { x: axe, y: l0 }, b: { x: axe, y: l1 + 1 }, epaisseur });
        for (const p of dans) pris[p] = 1;
      }
      if (reste.length >= 12 && profondeur < 6) {
        const ensemble = new Set(reste);
        for (const sous of massesDe(W, H, (p) => ensemble.has(p))) file.push({ pts: sous, profondeur: profondeur + 1 });
      }
    }
  }
  return { murs, pris };
}

/**
 * Les murs EN BIAIS : ce qui reste, s'il est allongé, ajusté par une droite. Il doit être MINCE (pas
 * plus de deux fois l'épaisseur type des murs droits) et PLEIN (sa boîte orientée remplie au moins
 * à moitié) : une masse informe n'est pas un mur, quelle que soit la droite qu'on y ajuste.
 */
function mursEnBiais(r, W, H, pris, epaisseurType){
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
    if (epaisseurType && epaisseur > 2 * epaisseurType) continue;
    let n0 = Infinity, n1 = -Infinity;
    for (const p of pts) { const n = -(p % W - mx) * uy + (Math.floor(p / W) - my) * ux; if (n < n0) n0 = n; if (n > n1) n1 = n; }
    if (pts.length < 0.5 * longueur * (n1 - n0 + 1)) continue;
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
 * Sans les DOUBLONS : un mur mince parallèle à un mur au moins deux fois plus épais, collé à sa bande
 * ou dedans, et couvert par lui sur 70 % de sa longueur. C'est un trait de la même façade (sa face
 * extérieure, continue devant les fenêtres, plan n° 3) qu'il ne faut pas compter deux fois : il
 * portait de fausses ouvertures.
 */
function sansDoublons(segments){
  const L = (s) => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
  return segments.filter(s => !segments.some(t => {
    if (t === s || t.epaisseur < 2 * s.epaisseur) return false;
    const Lt = L(t), ux = (t.b.x - t.a.x) / Lt, uy = (t.b.y - t.a.y) / Lt;
    const Ls = L(s), vx = (s.b.x - s.a.x) / Ls, vy = (s.b.y - s.a.y) / Ls;
    if (Math.abs(ux * vy - uy * vx) > Math.sin(3 * Math.PI / 180)) return false;
    const n = (p) => -(p.x - t.a.x) * uy + (p.y - t.a.y) * ux, l = (p) => (p.x - t.a.x) * ux + (p.y - t.a.y) * uy;
    const marge = t.epaisseur / 2 + s.epaisseur / 2 + 2;
    if (Math.abs(n(s.a)) > marge || Math.abs(n(s.b)) > marge) return false;
    const l0 = Math.max(0, Math.min(l(s.a), l(s.b))), l1 = Math.min(Lt, Math.max(l(s.a), l(s.b)));
    return l1 - l0 >= 0.7 * Ls;
  }));
}

/**
 * Les murs du masque `murs` (w × h, 1 = mur) en SEGMENTS : `{ angle, segments: [{ a: {x, y},
 * b: {x, y}, epaisseur }] }`, en pixels de la même image ; `angle` est la direction dominante.
 */
export function vectoriserLesMurs(murs, w, h){
  // CHAQUE DIRECTION du plan, la dominante d'abord : la façade en biais du plan de test n° 1,
  // traitée dans la seule direction dominante, devenait une suite de barres verticales. Ce qu'une
  // direction a pris sort du masque avant la suivante.
  const directions = directionsDuPlan(murs, w, h);
  const angle = directions.length ? directions[0] : 0;
  const reste = Uint8Array.from(murs), droits = [];
  // Une direction SECONDAIRE ne porte que de grands pans (une façade, une aile) : y exiger 5 % de la
  // feuille écarte les bouts de texte et de mobilier qui s'y trouvaient alignés par hasard.
  for (const [k, a] of (directions.length ? directions : [0]).entries()) {
    const { r, W, H, versImage } = redresser(reste, w, h, a);
    const { murs: trouves, pris } = mursDroits(r, W, H, k ? 0.05 * Math.max(w, h) : 0);
    for (const s of trouves) droits.push({ a: versImage(s.a.x, s.a.y), b: versImage(s.b.x, s.b.y), epaisseur: s.epaisseur });
    const c = Math.cos(a), sn = Math.sin(a);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!reste[y * w + x]) continue;
      const dx = x + 0.5 - w / 2, dy = y + 0.5 - h / 2;
      const i = Math.floor(W / 2 + dx * c + dy * sn), j = Math.floor(H / 2 - dx * sn + dy * c);
      if (i >= 0 && j >= 0 && i < W && j < H && pris[j * W + i]) reste[y * w + x] = 0;
    }
  }
  // Un « mur en biais » bien plus mince que les murs droits est un reste : le congé qu'a laissé la
  // fermeture là où un arc de porte touche un mur, par exemple.
  const epaisseurType = droits.length ? mediane(droits.map(s => s.epaisseur)) : 0;
  // Un mur droit à la fois COURT et MINCE devant les autres est un reste de découpage (le coin d'une
  // jonction) ; une cloison, mince mais longue, reste.
  const longueurDe = (s) => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
  const gardes = droits.filter(s => !(s.epaisseur < 0.5 * epaisseurType && longueurDe(s) < 4 * epaisseurType));
  const biais = mursEnBiais(reste, w, h, new Uint8Array(w * h), epaisseurType).filter(s => s.epaisseur >= 0.5 * epaisseurType);
  return { angle, segments: joindre(sansDoublons([...gardes, ...biais])) };
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
