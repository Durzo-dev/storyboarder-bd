/**
 * @file batiment-toits.js
 * LES TOITS d'un bâtiment (#458, décidé avec Valentin le 27 octobre 2026). Fonctions PURES : la
 * géométrie (des points, des hauteurs), sans three ; le rendu est dans batiment-3d.js.
 *
 * UN TOIT PAR NIVEAU (`niveau.toit`, champ AJOUTÉ, absent = plat comme avant) : il couvre les pièces
 * du niveau qui n'ont PAS d'étage au-dessus (un rez-de-chaussée plus large qu'un étage reçoit le sien
 * sur sa partie débordante ; le dernier niveau porte le toit principal).
 *
 *   `{ type, pente, debord, sens, bordure, revetement }`
 *   - type : 'plat' | 'un-pan' | 'deux-pans' | 'quatre-pans' ;
 *   - pente : en degrés ; debord : en mètres, au-delà de la face extérieure des murs ;
 *   - sens : quarts de tour depuis le grand côté (deux pans : faîtage le long du grand côté, ou en
 *     travers ; un pan : le côté bas) ;
 *   - bordure (toit plat) : 'aucune' | 'acrotere' | 'garde-corps' (toit-terrasse) ;
 *   - revetement : `{ texture, couleur }`, comme ceux des pièces (batiment-revetements.js).
 *
 * LA FORME COUVERTE : l'union des pièces découvertes du niveau (leurs faces dans le réseau des AXES
 * des murs, cf. batiment-pieces.js : des faces voisines partagent exactement leurs arêtes, qui
 * s'annulent), poussée jusqu'à la face extérieure des murs.
 *
 * LES PANS : chaque pan est un PLAN qui monte depuis une ligne d'égout ; le toit est, en tout point,
 * le plus bas des plans (h = min). Sur une forme CONVEXE c'est exact : le pan d'un plan est la forme
 * découpée par les demi-plans où il est le plus bas. Une forme à angle rentrant (en L, en T, en U)
 * demande le squelette droit (#458b) : en attendant, elle reste plate, et `enAttente` le dit.
 */
import { niveauxTries, niveauDessus, hauteurDesMursDuNiveau } from './batiment-niveaux.js';
import { formesDesPieces, dansLaFace } from './batiment-pieces.js';
import { TOLERANCE_SOMMET } from './batiment-geometrie.js';

export const TYPES_TOIT = ['plat', 'un-pan', 'deux-pans', 'quatre-pans'];
export const BORDURES_TOIT = ['aucune', 'acrotere', 'garde-corps'];
export const TOIT_DEFAUT = { type: 'plat', pente: 35, debord: 0.4, sens: 0, bordure: 'aucune', revetement: null };
/** Bornes des réglages. */
export const BORNES_TOIT = { pente: [5, 60], debord: [0, 1.5] };
/** L'acrotère d'un toit plat : épaisseur et hauteur ; le garde-corps : sa hauteur. */
export const ACROTERE = { epaisseur: 0.15, hauteur: 0.4 };
export const GARDE_CORPS = { hauteur: 1, retrait: 0.05 };

const fini = (v) => typeof v === 'number' && Number.isFinite(v);
const borne = (v, [a, b], d) => (fini(v) ? Math.min(b, Math.max(a, v)) : d);

/** Les réglages du toit d'un niveau, complets et bornés. PURE. */
export function toitDuNiveau(n){
  const t = (n && n.toit && typeof n.toit === 'object') ? n.toit : {};
  return {
    type: TYPES_TOIT.includes(t.type) ? t.type : TOIT_DEFAUT.type,
    pente: borne(t.pente, BORNES_TOIT.pente, TOIT_DEFAUT.pente),
    debord: borne(t.debord, BORNES_TOIT.debord, TOIT_DEFAUT.debord),
    sens: Number.isInteger(t.sens) ? ((t.sens % 4) + 4) % 4 : 0,
    bordure: BORDURES_TOIT.includes(t.bordure) ? t.bordure : TOIT_DEFAUT.bordure,
    revetement: t.revetement || null,
  };
}

/** Change le toit d'un niveau (seulement les champs donnés). Rend le niveau, ou null. PURE. */
export function fixerToit(b, niveauId, changements){
  const n = ((b && b.niveaux) || []).find(x => x.id === niveauId);
  if (!n) return null;
  n.toit = { ...toitDuNiveau(n), ...changements };
  n.toit = toitDuNiveau(n);
  if (!n.toit.revetement) delete n.toit.revetement;
  return n;
}

// ── La forme couverte ────────────────────────────────────────────────────────────────────────────

const cle = (p) => `${Math.round(p.x / TOLERANCE_SOMMET)},${Math.round(p.z / TOLERANCE_SOMMET)}`;

/** L'aire signée d'un contour (positive : sens trigonométrique dans le plan x, z). PURE. */
export function aireSignee(pts){
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.z - q.x * p.z; }
  return a / 2;
}

/** Les pièces du niveau qui n'ont pas d'étage au-dessus (leur repère hors des pièces du dessus). PURE. */
export function piecesDecouvertes(b, niveauId){
  const dessus = niveauDessus(b, niveauId);
  const formesDessus = dessus ? [...formesDesPieces(b, dessus.id).values()] : [];
  return [...formesDesPieces(b, niveauId).entries()]
    .filter(([id]) => {
      const p = (b.pieces || []).find(x => x.id === id);
      return p && p.repere && !formesDessus.some(f => dansLaFace(p.repere, f));
    })
    .map(([id, f]) => ({ id, forme: f }));
}

/** Retire les sommets alignés (un mur coupé par une jonction en T laisse un point au milieu d'un côté). */
function sansAlignes(pts){
  const r = pts.slice();
  let change = true;
  while (change && r.length > 3) {
    change = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i + r.length - 1) % r.length], p = r[i], c = r[(i + 1) % r.length];
      const croix = (p.x - a.x) * (c.z - p.z) - (p.z - a.z) * (c.x - p.x);
      const l = Math.hypot(p.x - a.x, p.z - a.z) * Math.hypot(c.x - p.x, c.z - p.z);
      if (l < 1e-12 || Math.abs(croix) / l < 1e-6) { r.splice(i, 1); change = true; break; }
    }
  }
  return r;
}

/**
 * Les contours à couvrir sur un niveau : l'union des pièces découvertes, en AXES de murs, sens
 * trigonométrique, sans sommet aligné. Une arête partagée par deux pièces de l'union s'annule ; ce qui
 * reste se chaîne en boucles ; les boucles extérieures sont gardées (une cour fermée par des pièces
 * n'en est pas une : c'est une pièce, couverte aussi). PURE.
 */
export function contoursDuToit(b, niveauId){
  const aretes = new Map();   // "ka>kb" → { a, b }
  for (const { forme } of piecesDecouvertes(b, niveauId)) {
    const pts = forme.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length];
      const k = `${cle(a)}>${cle(c)}`, inverse = `${cle(c)}>${cle(a)}`;
      if (aretes.has(inverse)) aretes.delete(inverse); else aretes.set(k, { a, b: c });
    }
  }
  const depuis = new Map();
  for (const [k, e] of aretes) { const ka = k.split('>')[0]; if (!depuis.has(ka)) depuis.set(ka, []); depuis.get(ka).push(e); }
  const vues = new Set(), boucles = [];
  for (const [k0, e0] of aretes) {
    if (vues.has(k0)) continue;
    const pts = [];
    let k = k0, e = e0, garde = 0;
    while (e && !vues.has(k) && garde++ < 10000) {
      vues.add(k);
      pts.push(e.a);
      const kb = cle(e.b);
      const suivantes = (depuis.get(kb) || []).filter(x => !vues.has(`${kb}>${cle(x.b)}`));
      e = suivantes[0];
      k = e ? `${kb}>${cle(e.b)}` : null;
    }
    if (pts.length >= 3) boucles.push(pts);
  }
  // Les faces des pièces tournent dans le sens NÉGATIF (cf. facesDesMurs) : l'union aussi ; une boucle
  // positive est un trou (un îlot non couvert).
  return boucles.filter(p => aireSignee(p) < -1e-6).map(p => sansAlignes(p.slice().reverse()));
}

/** Le contour décalé de `d` vers l'extérieur (négatif : vers l'intérieur), angles en onglet. PURE. */
export function decaler(pts, d){
  const n = pts.length;
  const lignes = pts.map((a, i) => {
    const c = pts[(i + 1) % n];
    const L = Math.hypot(c.x - a.x, c.z - a.z) || 1;
    const t = { x: (c.x - a.x) / L, z: (c.z - a.z) / L };
    const ext = { x: t.z, z: -t.x };   // sens trigonométrique : l'extérieur est à droite
    return { p: { x: a.x + ext.x * d, z: a.z + ext.z * d }, t };
  });
  return lignes.map((l, i) => {
    const prec = lignes[(i + n - 1) % n];
    const det = prec.t.x * l.t.z - prec.t.z * l.t.x;
    if (Math.abs(det) < 1e-9) return l.p;
    const s = ((l.p.x - prec.p.x) * l.t.z - (l.p.z - prec.p.z) * l.t.x) / det;
    return { x: prec.p.x + prec.t.x * s, z: prec.p.z + prec.t.z * s };
  });
}

/** Le contour est-il convexe (aucun angle rentrant) ? Sens trigonométrique attendu. PURE. */
export function estConvexe(pts){
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], p = pts[(i + 1) % pts.length], c = pts[(i + 2) % pts.length];
    if ((p.x - a.x) * (c.z - p.z) - (p.z - a.z) * (c.x - p.x) < -1e-9) return false;
  }
  return true;
}

/** La demi-épaisseur des murs d'un niveau (la moyenne) : de l'axe à la face extérieure. */
function demiEpaisseur(b, niveauId){
  const murs = (b.murs || []).filter(m => m.niveauId === niveauId);
  return murs.length ? murs.reduce((s, m) => s + (m.epaisseur || 0.2), 0) / murs.length / 2 : 0.1;
}

// ── Les pans ─────────────────────────────────────────────────────────────────────────────────────

/** Les plans du toit sur un contour convexe : h(p) = k · (n·p − c), n vers le haut de la pente. */
function plansDuToit(ext, t){
  const k = Math.tan(t.pente * Math.PI / 180);
  // Le GRAND CÔTÉ donne l'orientation : le faîtage d'un deux-pans le suit (sens pair).
  let g = null;
  ext.forEach((a, i) => { const c = ext[(i + 1) % ext.length]; const L = Math.hypot(c.x - a.x, c.z - a.z); if (!g || L > g.L) g = { L, t: { x: (c.x - a.x) / L, z: (c.z - a.z) / L } }; });
  const tourne = (v, q) => { let r = v; for (let i = 0; i < q; i++) r = { x: -r.z, z: r.x }; return r; };
  const projMin = (n) => Math.min(...ext.map(p => n.x * p.x + n.z * p.z));
  if (t.type === 'quatre-pans') {
    return ext.map((a, i) => {
      const c = ext[(i + 1) % ext.length];
      const L = Math.hypot(c.x - a.x, c.z - a.z) || 1;
      const n = { x: -(c.z - a.z) / L, z: (c.x - a.x) / L };   // vers l'intérieur (à gauche)
      return { n, c: n.x * a.x + n.z * a.z, k };
    });
  }
  if (t.type === 'deux-pans') {
    const faitage = tourne(g.t, t.sens % 2);
    const u = { x: -faitage.z, z: faitage.x };
    const v = { x: -u.x, z: -u.z };
    return [{ n: u, c: projMin(u), k }, { n: v, c: projMin(v), k }];
  }
  if (t.type === 'un-pan') {
    const n = tourne({ x: -g.t.z, z: g.t.x }, t.sens);
    return [{ n, c: projMin(n), k }];
  }
  return [];
}

const hauteur = (pl, p) => pl.k * (pl.n.x * p.x + pl.n.z * p.z - pl.c);

/** Garde la partie du polygone convexe où f(p) ≤ 0 (Sutherland–Hodgman, une droite). */
function couper(poly, f){
  const r = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length];
    const fa = f(a), fc = f(c);
    if (fa <= 1e-9) r.push(a);
    if ((fa < -1e-9 && fc > 1e-9) || (fa > 1e-9 && fc < -1e-9)) {
      const s = fa / (fa - fc);
      r.push({ x: a.x + (c.x - a.x) * s, z: a.z + (c.z - a.z) * s });
    }
  }
  return r;
}

/**
 * La géométrie d'un toit sur un contour CONVEXE `ext` (face extérieure des murs), posé à la hauteur
 * `base` (le dessus des murs) :
 *   - `pans` : `[{ points: [{x, y, z}], uv: [[u, v]] }]`, chacun un polygone convexe (en éventail) ;
 *     les UV en mètres (u le long de l'égout, v en montant la pente) ;
 *   - `pignons` : les murs à fermer sous le toit, `[{ points: [{x, y, z}] }]`, verticaux, posés sur
 *     chaque côté de `ext` (un triangle de pignon, un trapèze sous un pan unique) ;
 *   - `bord` : le contour débordant et ses hauteurs (la rive, épaissie au rendu) ;
 *   - `haut` : le plus haut point.
 * PURE.
 */
export function geometrieDuToit(ext, reglages, base){
  const t = toitDuNiveau({ toit: reglages });
  const plans = plansDuToit(ext, t);
  const H = (p) => Math.min(...plans.map(pl => hauteur(pl, p)));
  const deborde = t.debord > 0 ? decaler(ext, t.debord) : ext;
  const pans = [];
  plans.forEach((pl, i) => {
    let poly = deborde;
    plans.forEach((q, j) => { if (j !== i) poly = couper(poly, (p) => hauteur(pl, p) - hauteur(q, p)); });
    if (poly.length < 3) return;
    const le = { x: -pl.n.z, z: pl.n.x };
    const cos = Math.cos(Math.atan(pl.k));
    pans.push({
      points: poly.map(p => ({ x: p.x, y: base + hauteur(pl, p), z: p.z })),
      uv: poly.map(p => [le.x * p.x + le.z * p.z, (pl.n.x * p.x + pl.n.z * p.z - pl.c) / cos]),
    });
  });
  // Les pignons : sur chaque côté des murs, ce qui sépare le dessus des murs du dessous du toit.
  const pignons = [];
  ext.forEach((a, i) => {
    const c = ext[(i + 1) % ext.length];
    const ts = new Set([0, 1]);
    for (let x = 0; x < plans.length; x++) for (let y = x + 1; y < plans.length; y++) {
      const fa = hauteur(plans[x], a) - hauteur(plans[y], a), fc = hauteur(plans[x], c) - hauteur(plans[y], c);
      if (Math.abs(fa - fc) > 1e-12) { const s = fa / (fa - fc); if (s > 1e-6 && s < 1 - 1e-6) ts.add(s); }
    }
    const le = [...ts].sort((u, v) => u - v).map(s => { const p = { x: a.x + (c.x - a.x) * s, z: a.z + (c.z - a.z) * s }; return { ...p, h: Math.max(0, H(p)) }; });
    if (le.every(p => p.h < 1e-3)) return;
    // Les points du haut à hauteur nulle tombent sur ceux du bas : retirés (un triangle reste un triangle).
    pignons.push({ points: [{ x: a.x, y: base, z: a.z }, { x: c.x, y: base, z: c.z },
      ...le.slice().reverse().filter(p => p.h > 1e-6).map(p => ({ x: p.x, y: base + p.h, z: p.z }))] });
  });
  const bord = deborde.map(p => ({ x: p.x, y: base + H(p), z: p.z }));
  const haut = Math.max(base, ...pans.flatMap(p => p.points.map(q => q.y)));
  return { pans, pignons, bord, haut };
}

/**
 * Les toits d'un niveau, prêts à dessiner : `[{ contour, ext, reglages, base, convexe, enAttente,
 * geometrie }]`. `geometrie` : celle d'un toit en pente (null s'il est plat, ou en attente du
 * squelette droit sur une forme à angle rentrant). PURE.
 */
export function toitsDuNiveau(b, niveauId){
  const n = ((b && b.niveaux) || []).find(x => x.id === niveauId);
  if (!n) return [];
  const reglages = toitDuNiveau(n);
  const base = (n.elevation || 0) + hauteurDesMursDuNiveau(b, niveauId);
  const e = demiEpaisseur(b, niveauId);
  return contoursDuToit(b, niveauId).map(contour => {
    const ext = decaler(contour, e);
    const convexe = estConvexe(ext);
    const enPente = reglages.type !== 'plat';
    return {
      contour, ext, reglages, base, convexe,
      enAttente: enPente && !convexe,
      geometrie: enPente && convexe ? geometrieDuToit(ext, reglages, base) : null,
    };
  });
}

/** Le plus haut point des toits d'un bâtiment (bordures des toits plats comprises), ou 0. PURE. */
export function hauteurDesToits(b){
  let h = 0;
  for (const n of niveauxTries(b || {})) {
    for (const t of toitsDuNiveau(b, n.id)) {
      if (t.geometrie) h = Math.max(h, t.geometrie.haut);
      else if (t.reglages.bordure === 'acrotere') h = Math.max(h, t.base + ACROTERE.hauteur);
      else if (t.reglages.bordure === 'garde-corps') h = Math.max(h, t.base + GARDE_CORPS.hauteur);
    }
  }
  return h;
}
