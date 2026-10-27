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
import { niveauxTries, niveauDessus, niveauDessous, hauteurDesMursDuNiveau } from './batiment-niveaux.js';
import { formesDesPieces, dansLaFace, pointDansPolygone } from './batiment-pieces.js';
import { TOLERANCE_SOMMET } from './batiment-geometrie.js';
import { squeletteDroit, trianguler } from './batiment-squelette.js';
import { meublesDuNiveau, empreinteDuMeuble, hauteurAuSol, basDuMeuble, sommetDuMeuble } from './batiment-mobilier.js';

export const TYPES_TOIT = ['plat', 'un-pan', 'deux-pans', 'quatre-pans'];
export const BORDURES_TOIT = ['aucune', 'acrotere', 'garde-corps'];
export const TOIT_DEFAUT = { type: 'plat', pente: 35, debord: 0.4, sens: 0, bordure: 'aucune', revetement: null };
/** Bornes des réglages. */
export const BORNES_TOIT = { pente: [5, 60], debord: [0, 1.5] };
/** L'acrotère d'un toit plat : épaisseur et hauteur ; le garde-corps : sa hauteur. */
export const ACROTERE = { epaisseur: 0.15, hauteur: 0.4 };
export const GARDE_CORPS = { hauteur: 1, retrait: 0.05 };
/** L'épaisseur d'un toit en pente (couverture et charpente), visible à sa rive. */
export const EPAISSEUR_TOIT = 0.12;

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

/**
 * Une cour (un vide) a-t-elle un SOL (#458c, décidé avec Valentin) ? Au-dessus d'une PIÈCE, oui :
 * c'est une terrasse (sa dalle, sans plafond ni toit). Au-dessus d'une autre cour, ou au
 * rez-de-chaussée, non : le puits continue (jusqu'au Sol de la Scène). PURE.
 */
export function estUneTerrasse(b, piece){
  if (!piece || !piece.vide || !piece.repere) return false;
  const dessous = niveauDessous(b, piece.niveauId);
  if (!dessous) return false;
  for (const [id, f] of formesDesPieces(b, dessous.id)) {
    const p = (b.pieces || []).find(x => x.id === id);
    if (dansLaFace(piece.repere, f)) return !(p && p.vide);
  }
  return false;   // rien dessous (l'étage déborde) : pas de sol, la cour est ouverte
}

/** Les pièces du niveau qui n'ont pas d'étage au-dessus (leur repère hors des pièces du dessus). PURE. */
export function piecesDecouvertes(b, niveauId){
  const dessus = niveauDessus(b, niveauId);
  const formesDessus = dessus ? [...formesDesPieces(b, dessus.id).values()] : [];
  return [...formesDesPieces(b, niveauId).entries()]
    .filter(([id]) => {
      const p = (b.pieces || []).find(x => x.id === id);
      return p && p.repere && !p.vide && !formesDessus.some(f => dansLaFace(p.repere, f));
    })
    .map(([id, f]) => ({ id, forme: f }));
}

/**
 * Retire les sommets alignés (un mur coupé par une jonction en T laisse un point au milieu d'un côté),
 * seulement entre deux côtés de même nature (adossés ou libres). `adosses[i]` : le côté i → i+1.
 */
function sansAlignes(pts, adosses){
  const r = pts.slice(), f = adosses.slice();
  let change = true;
  while (change && r.length > 3) {
    change = false;
    for (let i = 0; i < r.length; i++) {
      const ip = (i + r.length - 1) % r.length;
      const a = r[ip], p = r[i], c = r[(i + 1) % r.length];
      const croix = (p.x - a.x) * (c.z - p.z) - (p.z - a.z) * (c.x - p.x);
      const l = Math.hypot(p.x - a.x, p.z - a.z) * Math.hypot(c.x - p.x, c.z - p.z);
      if ((l < 1e-12 || Math.abs(croix) / l < 1e-6) && f[ip] === f[i]) { r.splice(i, 1); f.splice(i, 1); change = true; break; }
    }
  }
  return { points: r, adosses: f };
}

/**
 * Les contours à couvrir sur un niveau : l'union des pièces découvertes, en AXES de murs, sens
 * trigonométrique, sans sommet aligné. Une arête partagée par deux pièces de l'union s'annule ; ce qui
 * reste se chaîne en boucles ; les boucles extérieures sont gardées (une cour fermée par des pièces
 * n'en est pas une : c'est une pièce, couverte aussi).
 *
 * Chaque côté dit s'il est ADOSSÉ (signalé : les raccords) : partagé avec une pièce du même niveau
 * qui, elle, a un étage au-dessus. Là, le toit ne déborde pas et ne fait pas d'égout : il vient buter
 * contre le mur de l'étage, comme un appentis contre une maison (les Sims, Chief Architect).
 * Rend `[{ points, adosses }]`. PURE.
 */
export function contoursDuToit(b, niveauId){
  const decouvertes = piecesDecouvertes(b, niveauId);
  const ids = new Set(decouvertes.map(d => d.id));
  // Les côtés des pièces COUVERTES du niveau : un côté de l'union qui en est un est adossé.
  const couverts = new Set();
  for (const [id, f] of formesDesPieces(b, niveauId)) {
    if (ids.has(id)) continue;
    f.points.forEach((a, i) => { const c = f.points[(i + 1) % f.points.length]; couverts.add(`${cle(a)}>${cle(c)}`); });
  }
  const aretes = new Map();   // "ka>kb" → { a, b }
  // Le contour de chaque pièce, et ses îlots (un groupe de murs posé dedans, une cour au milieu
  // d'une pièce : #458c), qui tournent dans l'autre sens.
  for (const { forme } of decouvertes) {
    for (const pts of [forme.points, ...(forme.trous || [])]) {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], c = pts[(i + 1) % pts.length];
        const k = `${cle(a)}>${cle(c)}`, inverse = `${cle(c)}>${cle(a)}`;
        if (aretes.has(inverse)) aretes.delete(inverse); else aretes.set(k, { a, b: c, adosse: couverts.has(inverse) });
      }
    }
  }
  const depuis = new Map();
  for (const [k, e] of aretes) { const ka = k.split('>')[0]; if (!depuis.has(ka)) depuis.set(ka, []); depuis.get(ka).push(e); }
  const vues = new Set(), boucles = [];
  for (const [k0, e0] of aretes) {
    if (vues.has(k0)) continue;
    const pts = [], adosses = [];
    let k = k0, e = e0, garde = 0;
    while (e && !vues.has(k) && garde++ < 10000) {
      vues.add(k);
      pts.push(e.a); adosses.push(e.adosse);
      const kb = cle(e.b);
      const suivantes = (depuis.get(kb) || []).filter(x => !vues.has(`${kb}>${cle(x.b)}`));
      e = suivantes[0];
      k = e ? `${kb}>${cle(e.b)}` : null;
    }
    if (pts.length >= 3) boucles.push({ pts, adosses });
  }
  // Les faces des pièces tournent dans le sens NÉGATIF (cf. facesDesMurs) : l'union aussi ; une boucle
  // positive est un trou (un îlot non couvert). Retournée, le côté j relie les anciens n-1-j et n-2-j.
  const retourner = ({ pts, adosses }) => {
    const n = pts.length;
    return sansAlignes(pts.slice().reverse(), pts.map((_, j) => adosses[(n - 2 - j + n) % n]));
  };
  // #458c : les boucles positives sont des COURS (des vides) : des trous du contour qui les entoure,
  // retournés eux aussi (sens inverse : l'intérieur du toit reste à leur gauche).
  const trous = boucles.filter(x => aireSignee(x.pts) > 1e-6).map(retourner);
  return boucles.filter(x => aireSignee(x.pts) < -1e-6).map(retourner).map(c => ({
    ...c, trous: trous.filter(t => pointDansPolygone(t.points[0], c.points)),
  }));
}

/**
 * Le contour décalé vers l'extérieur (négatif : vers l'intérieur), angles en onglet. `d` : une
 * distance, ou une par côté (le côté i → i+1). PURE.
 */
export function decaler(pts, d){
  const n = pts.length;
  const lignes = pts.map((a, i) => {
    const c = pts[(i + 1) % n];
    const L = Math.hypot(c.x - a.x, c.z - a.z) || 1;
    const t = { x: (c.x - a.x) / L, z: (c.z - a.z) / L };
    const ext = { x: t.z, z: -t.x };   // sens trigonométrique : l'extérieur est à droite
    const di = Array.isArray(d) ? d[i] : d;
    return { p: { x: a.x + ext.x * di, z: a.z + ext.z * di }, t };
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

/**
 * Les plans du toit sur un contour convexe : h(p) = k · (n·p − c), n vers le haut de la pente.
 * `adosses[i]` : le côté i bute contre l'étage du dessus. Un côté adossé ne fait pas d'égout (pas de
 * pan qui en monte) ; et quand il y en a, l'orientation part de lui (le plus long) : un appentis
 * MONTE vers le mur, un deux-pans y amène son faîtage de face (le pignon contre la maison), comme
 * une aile ou un appentis réels. `sens` tourne ensuite d'un quart de tour par pas.
 */
function plansDuToit(ext, t, adosses = [], k = Math.tan(t.pente * Math.PI / 180)){
  const cote = (i) => { const a = ext[i], c = ext[(i + 1) % ext.length]; const L = Math.hypot(c.x - a.x, c.z - a.z) || 1; return { L, t: { x: (c.x - a.x) / L, z: (c.z - a.z) / L } }; };
  let g = null, gAdosse = null;
  ext.forEach((_, i) => {
    const c = cote(i);
    if (!g || c.L > g.L) g = c;
    if (adosses[i] && (!gAdosse || c.L > gAdosse.L)) gAdosse = c;
  });
  const tourne = (v, q) => { let r = v; for (let i = 0; i < q; i++) r = { x: -r.z, z: r.x }; return r; };
  const projMin = (n) => Math.min(...ext.map(p => n.x * p.x + n.z * p.z));
  if (t.type === 'quatre-pans') {
    return ext.map((a, i) => {
      if (adosses[i]) return null;
      const { t: d } = cote(i);
      const n = { x: -d.z, z: d.x };   // vers l'intérieur (à gauche)
      return { n, c: n.x * a.x + n.z * a.z, k };
    }).filter(Boolean);
  }
  if (t.type === 'deux-pans') {
    // Sans mur adossé, le faîtage suit le grand côté ; adossé, il arrive de face sur le mur.
    const faitage = tourne(gAdosse ? tourne(gAdosse.t, 1) : g.t, t.sens % 2);
    const u = { x: -faitage.z, z: faitage.x };
    const v = { x: -u.x, z: -u.z };
    return [{ n: u, c: projMin(u), k }, { n: v, c: projMin(v), k }];
  }
  if (t.type === 'un-pan') {
    // Adossé : il monte VERS le mur (sa normale extérieure) ; sinon depuis le grand côté.
    const depart = gAdosse ? { x: gAdosse.t.z, z: -gAdosse.t.x } : { x: -g.t.z, z: g.t.x };
    const n = tourne(depart, t.sens);
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

/** Les abscisses (0 à 1) le long du côté a → c où le toit change de pan, bouts compris, triées. */
function coupuresDuCote(plans, a, c){
  const H = (p) => Math.min(...plans.map(pl => hauteur(pl, p)));
  const ts = new Set([0, 1]);
  for (let x = 0; x < plans.length; x++) for (let y = x + 1; y < plans.length; y++) {
    const fa = hauteur(plans[x], a) - hauteur(plans[y], a), fc = hauteur(plans[x], c) - hauteur(plans[y], c);
    if (Math.abs(fa - fc) > 1e-12) {
      const s = fa / (fa - fc);
      if (s > 1e-6 && s < 1 - 1e-6) {
        // Seulement si ces deux plans sont bien ceux du toit en ce point (le plus bas des plans).
        const p = { x: a.x + (c.x - a.x) * s, z: a.z + (c.z - a.z) * s };
        if (Math.abs(hauteur(plans[x], p) - H(p)) < 1e-6) ts.add(s);
      }
    }
  }
  return [...ts].sort((u, v) => u - v);
}

/**
 * La géométrie d'un toit sur un contour CONVEXE `ext` (face extérieure des murs), posé à la hauteur
 * `base` (le dessus des murs) :
 *   - `pans` : `[{ points: [{x, y, z}], uv: [[u, v]] }]`, chacun un polygone convexe (en éventail) ;
 *     les UV en mètres (u le long de l'égout, v en montant la pente) ;
 *   - `pignons` : les murs à fermer sous le toit, `[{ points: [{x, y, z}] }]`, verticaux, posés sur
 *     chaque côté LIBRE de `ext` (un triangle de pignon, un trapèze sous un pan unique) ;
 *   - `bord` et `bordAdosses` : le contour débordant, ses hauteurs (la rive, épaissie au rendu), et
 *     les côtés qui butent contre un mur (sans rive : elle traverserait le mur ou l'autre toit) ;
 *   - `haut` : le plus haut point.
 * `options.adosses` : les côtés adossés à l'étage du dessus (ni débord, ni égout, ni pignon) ;
 * `options.hautMax` : la hauteur à ne pas dépasser au-dessus de `base` (un toit adossé reste SOUS
 * l'égout de l'étage contre lequel il bute : la pente est réduite au besoin). PURE.
 */
export function geometrieDuToit(ext, reglages, base, { adosses = [], hautMax = Infinity, trous = [] } = {}){
  const t = toitDuNiveau({ toit: reglages });
  let plans = plansDuToit(ext, t, adosses);
  if (!plans.length) return null;
  const sommetsDe = (pls) => {
    // Le plus haut du toit sur la face des murs : aux sommets et aux croisements des plans.
    const H = (p) => Math.min(...pls.map(pl => hauteur(pl, p)));
    let m = Math.max(...ext.map(H));
    pls.forEach((pl, i) => { let poly = ext; pls.forEach((q, j) => { if (j !== i) poly = couper(poly, (p) => hauteur(pl, p) - hauteur(q, p)); }); poly.forEach(p => { m = Math.max(m, H(p)); }); });
    return m;
  };
  const hautTrouve = sommetsDe(plans);
  if (hautTrouve > hautMax && hautMax > 0.1) {
    const k = Math.tan(t.pente * Math.PI / 180) * hautMax / hautTrouve;
    plans = plansDuToit(ext, t, adosses, k);
  }
  const H = (p) => Math.min(...plans.map(pl => hauteur(pl, p)));
  const deborde = t.debord > 0 ? decaler(ext, ext.map((_, i) => (adosses[i] ? 0 : t.debord))) : ext;
  // #458c : les cours (un pan unique seulement ici), débordées vers la cour.
  const debordeTrous = trous.map(tr => (t.debord > 0 ? decaler(tr, t.debord) : tr));
  const pans = [];
  if (trous.length && plans.length === 1) {
    const pl = plans[0];
    const tous = [...deborde, ...debordeTrous.flat()];
    const le = { x: -pl.n.z, z: pl.n.x };
    const cos = Math.cos(Math.atan(pl.k));
    pans.push({
      points: tous.map(p => ({ x: p.x, y: base + hauteur(pl, p), z: p.z })),
      uv: tous.map(p => [le.x * p.x + le.z * p.z, (pl.n.x * p.x + pl.n.z * p.z - pl.c) / cos]),
      triangles: trianguler(deborde, debordeTrous),
    });
  } else plans.forEach((pl, i) => {
    let poly = deborde;
    plans.forEach((q, j) => { if (j !== i) poly = couper(poly, (p) => hauteur(pl, p) - hauteur(q, p)); });
    if (poly.length < 3) return;
    const le = { x: -pl.n.z, z: pl.n.x };
    const cos = Math.cos(Math.atan(pl.k));
    pans.push({
      points: poly.map(p => ({ x: p.x, y: base + hauteur(pl, p), z: p.z })),
      uv: poly.map(p => [le.x * p.x + le.z * p.z, (pl.n.x * p.x + pl.n.z * p.z - pl.c) / cos]),
      // Un pan unique sur une forme à angle rentrant n'est pas convexe : triangulé, pas en éventail.
      triangles: trianguler(poly),
    });
  });
  // Les pignons : sur chaque côté LIBRE des murs, ce qui sépare le dessus des murs du dessous du toit
  // (contre un côté adossé, c'est le mur de l'étage qui ferme). Ceux des cours aussi.
  const pignons = [];
  [{ boucle: ext, ad: adosses }, ...trous.map(tr => ({ boucle: tr, ad: [] }))].forEach(({ boucle, ad }) => boucle.forEach((a, i) => {
    if (ad[i]) return;
    const c = boucle[(i + 1) % boucle.length];
    const le = coupuresDuCote(plans, a, c).map(s => { const p = { x: a.x + (c.x - a.x) * s, z: a.z + (c.z - a.z) * s }; return { ...p, h: Math.max(0, H(p)) }; });
    if (le.every(p => p.h < 1e-3)) return;
    // Les points du haut à hauteur nulle tombent sur ceux du bas : retirés (un triangle reste un triangle).
    pignons.push({ points: [{ x: a.x, y: base, z: a.z }, { x: c.x, y: base, z: c.z },
      ...le.slice().reverse().filter(p => p.h > 1e-6).map(p => ({ x: p.x, y: base + p.h, z: p.z }))] });
  }));
  const bord = deborde.map(p => ({ x: p.x, y: base + H(p), z: p.z }));
  // LES RIVES, côté par côté, en suivant le toit (signalé : sur un pignon, la rive filait droit d'un
  // coin d'égout à l'autre et traversait le pignon) : coupées là où le toit change de pan, au faîtage.
  const rivesDe = (boucle, ad) => boucle.map((a, i) => {
    const c = boucle[(i + 1) % boucle.length];
    return { adosse: !!ad[i], points: coupuresDuCote(plans, a, c).map(s => {
      const p = { x: a.x + (c.x - a.x) * s, z: a.z + (c.z - a.z) * s };
      return { ...p, y: base + H(p) };
    }) };
  });
  const rives = [...rivesDe(deborde, adosses), ...debordeTrous.flatMap(tr => rivesDe(tr, []))];
  const haut = Math.max(base, ...pans.flatMap(p => p.points.map(q => q.y)));
  return { pans, pignons, bord, rives, bordAdosses: ext.map((_, i) => !!adosses[i]), haut };
}

/** Deux polygones se recouvrent-ils (un sommet de l'un dans l'autre, ou deux côtés qui se croisent) ? */
function serecouvrent(A, B){
  if (A.some(p => pointDansPolygone(p, B)) || B.some(p => pointDansPolygone(p, A))) return true;
  const croise = (a, b, c, d) => {
    const o = (p, q, r) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
    return o(a, b, c) * o(a, b, d) < -1e-12 && o(c, d, a) * o(c, d, b) < -1e-12;
  };
  return A.some((a, i) => B.some((c, j) => croise(a, A[(i + 1) % A.length], c, B[(j + 1) % B.length])));
}

/**
 * Les PIGNONS d'un deux-pans sur une forme quelconque (#458b) : les bouts des ailes. Un côté est un
 * bout d'aile quand ses deux angles sont saillants et que ses deux voisins partent en sens opposés
 * (un « U » vu de dessus). Parmi eux, les plus courts (le faîtage suit la longueur des ailes) ; `sens`
 * impair prend les autres. PURE.
 */
export function pignonsDeLAile(ext, sens = 0, adosses = []){
  const n = ext.length;
  const dir = (i) => { const a = ext[i], c = ext[(i + 1) % n]; const L = Math.hypot(c.x - a.x, c.z - a.z) || 1; return { L, x: (c.x - a.x) / L, z: (c.z - a.z) / L }; };
  const saillant = (i) => { const d0 = dir((i + n - 1) % n), d1 = dir(i); return d0.x * d1.z - d0.z * d1.x > 1e-9; };
  const bouts = [];
  for (let i = 0; i < n; i++) {
    if (adosses[i]) continue;
    const p = dir((i + n - 1) % n), q = dir((i + 1) % n);
    if (saillant(i) && saillant((i + 1) % n) && p.x * q.x + p.z * q.z < -0.99) bouts.push({ i, L: dir(i).L });
  }
  if (!bouts.length) return new Set();
  const min = Math.min(...bouts.map(b => b.L));
  const courts = bouts.filter(b => b.L <= min * 1.25 + 1e-6), longs = bouts.filter(b => b.L > min * 1.25 + 1e-6);
  const choisis = (sens % 2 && longs.length) ? longs : courts;
  return new Set(choisis.map(b => b.i));
}

/**
 * Le toit d'une forme À ANGLE RENTRANT (#458b), en L, en T, en U… : le squelette droit pondéré du
 * contour débordant. Quatre pans : tous les côtés libres montent (poids 1). Deux pans : les bouts
 * des ailes restent droits (poids 0) et deviennent des pignons. Un côté adossé à l'étage ne bouge pas
 * non plus. Même sortie que geometrieDuToit ; null si le squelette n'aboutit pas. PURE.
 */
export function geometrieSquelette(ext, reglages, base, { adosses = [], hautMax = Infinity, trous = [] } = {}){
  const t = toitDuNiveau({ toit: reglages });
  // Autour d'une COUR (#458c), pas de pignon (signalé : le rendu) : un côté en pignon couperait l'aile
  // qui longe la cour ; chaque aile s'égoutte des deux côtés, comme un quatre-pans.
  const gables = t.type === 'deux-pans' && !trous.length ? pignonsDeLAile(ext, t.sens, adosses) : new Set();
  const poids = ext.map((_, i) => (adosses[i] || gables.has(i) ? 0 : 1));
  if (!poids.some(Boolean) && !trous.length) return null;
  const d = t.debord;
  const deborde = d > 0 ? decaler(ext, ext.map((_, i) => (adosses[i] ? 0 : d))) : ext;
  // #458c : les cours, débordées vers la cour ; leurs côtés sont des égouts (poids 1).
  const debordeTrous = trous.map(tr => (d > 0 ? decaler(tr, d) : tr));
  const sq = squeletteDroit(deborde, poids, debordeTrous.map(tr => ({ pts: tr, poids: tr.map(() => 1) })));
  if (!sq) return null;
  // Tous les côtés, contour puis cours, dans la numérotation du squelette.
  const tousCotes = [deborde, ...debordeTrous].flatMap(bcl => bcl.map((a, i) => ({ a, c: bcl[(i + 1) % bcl.length] })));
  let k = Math.tan(t.pente * Math.PI / 180);
  const tMax = Math.max(...sq.faces.flatMap(f => f.points.map(p => p.t)));
  // Le plus haut au-dessus de `base` : (tMax − débord) · k ; réduit sous l'égout de l'étage au besoin.
  if ((tMax - d) * k > hautMax && hautMax > 0.1 && tMax - d > 1e-6) k = hautMax / (tMax - d);
  const y = (p) => base + (p.t - d) * k;
  const cos = Math.cos(Math.atan(k));
  const pans = [], pignons = [], rives = [];
  sq.faces.forEach(f => {
    const i = f.cote;
    const { a, c } = tousCotes[i];
    const L = Math.hypot(c.x - a.x, c.z - a.z) || 1, dx = (c.x - a.x) / L, dz = (c.z - a.z) / L;
    if (i >= deborde.length || poids[i] > 0) {
      pans.push({
        points: f.points.map(p => ({ x: p.x, y: y(p), z: p.z })),
        uv: f.points.map(p => [p.x * dx + p.z * dz, p.t / cos]),
        triangles: trianguler(f.points),
      });
      rives.push({ adosse: false, points: [{ x: a.x, y: y({ t: 0 }), z: a.z }, { x: c.x, y: y({ t: 0 }), z: c.z }] });
      return;
    }
    if (adosses[i]) { rives.push({ adosse: true, points: [] }); return; }
    // Un pignon : le profil du toit au-dessus du bout de l'aile, ramené du débord sur la face du mur,
    // et coupé au dessus des murs.
    const chaine = [f.points[1], ...f.points.slice(2), f.points[0]];
    rives.push({ adosse: false, points: chaine.map(p => ({ x: p.x, y: y(p), z: p.z })) });
    const ext0 = ext[i];
    const nx = -dz, nz = dx;   // vers l'intérieur
    const decal = (ext0.x - a.x) * nx + (ext0.z - a.z) * nz;
    const profil = f.points.map(p => ({ u: (p.x - a.x) * dx + (p.z - a.z) * dz, h: y(p) }));
    // Le polygone du pignon dans le plan vertical (u le long du mur, h la hauteur), coupé à h ≥ base.
    const coupe = [];
    for (let j = 0; j < profil.length; j++) {
      const P = profil[j], Q = profil[(j + 1) % profil.length];
      if (P.h >= base - 1e-9) coupe.push(P);
      if ((P.h - base) * (Q.h - base) < -1e-12) { const s = (base - P.h) / (Q.h - P.h); coupe.push({ u: P.u + (Q.u - P.u) * s, h: base }); }
    }
    if (coupe.length < 3) return;
    const vers3D = (q) => ({ x: a.x + dx * q.u + nx * decal, y: q.h, z: a.z + dz * q.u + nz * decal });
    pignons.push({ points: coupe.map(vers3D), triangles: trianguler(coupe.map(q => ({ x: q.u, z: q.h }))) });
  });
  const bord = deborde.map(p => ({ x: p.x, y: y({ t: 0 }), z: p.z }));
  const haut = Math.max(base, ...pans.flatMap(p => p.points.map(q => q.y)));
  // Les rives dans l'ordre des côtés, comme geometrieDuToit.
  const parCote = new Map(sq.faces.map((f, j) => [f.cote, rives[j]]));
  // Sous les égouts des cours, les murs de la cour se ferment comme ailleurs : rien à ajouter (le toit
  // part du dessus des murs).
  return { pans, pignons, bord, rives: tousCotes.map((_, i) => parCote.get(i) || { adosse: true, points: [] }), bordAdosses: ext.map((_, i) => !!adosses[i]), haut };
}

/**
 * Les toits d'un niveau, prêts à dessiner : `[{ contour, adosses, ext, reglages, base, convexe,
 * enAttente, geometrie }]`. `ext` : le contour poussé à la face extérieure des murs, sauf contre
 * l'étage du dessus, où il s'arrête à la face du mur de l'étage (`adosses`). `geometrie` : celle d'un
 * toit en pente (null s'il est plat, ou en attente du squelette droit sur une forme à angle
 * rentrant). Un toit adossé reste 30 cm sous l'égout de l'étage contre lequel il bute. PURE.
 */
export function toitsDuNiveau(b, niveauId){
  const n = ((b && b.niveaux) || []).find(x => x.id === niveauId);
  if (!n) return [];
  const reglages = toitDuNiveau(n);
  const base = (n.elevation || 0) + hauteurDesMursDuNiveau(b, niveauId);
  const e = demiEpaisseur(b, niveauId);
  const dessus = niveauDessus(b, niveauId);
  // Sous l'égout de l'étage : son toit déborde et descend (débord × pente, plus son épaisseur) ; on
  // garde 10 cm de plus, et au moins 30 cm.
  let sousLEgout = Infinity;
  if (dessus) {
    const td = toitDuNiveau(dessus);
    const descente = td.type === 'plat' ? 0 : td.debord * Math.tan(td.pente * Math.PI / 180) + EPAISSEUR_TOIT;
    sousLEgout = Math.max(0.3, hauteurDesMursDuNiveau(b, dessus.id) - Math.max(0.3, descente + 0.1));
  }
  // Les pièces de l'étage, un peu rentrées (une pièce posée juste à côté ne compte pas).
  const formesDessus = dessus ? [...formesDesPieces(b, dessus.id).values()].map(f => decaler(f.points.slice().reverse(), -0.05)) : [];
  return contoursDuToit(b, niveauId).map(({ points: contour, adosses, trous }) => {
    const ext = decaler(contour, adosses.map(a => (a ? -e : e)));
    // Les cours, poussées à la face de leurs murs (côté cour).
    const extTrous = trous.map(t => decaler(t.points, e));
    const convexe = estConvexe(ext);
    const enPente = reglages.type !== 'plat';
    // Un étage posé EN PARTIE sur la forme (sans suivre ses murs) : un toit en pente le traverserait.
    // Elle reste plate (signalé : les raccords), et `sousUnEtage` le dit.
    const sousUnEtage = enPente && formesDessus.some(f => serecouvrent(contour, f));
    // Convexe sans cour, ou un pan unique : les plans (exacts) ; sinon le squelette droit (#458b), qui
    // fait aussi le tour des cours (#458c : le toit s'y égoutte, comme autour d'un atrium). S'il
    // n'aboutit pas, le toit reste plat plutôt que faux, et `enAttente` le dit.
    const options = { adosses, trous: extTrous, hautMax: adosses.some(Boolean) ? sousLEgout : Infinity };
    let geometrie = null;
    if (enPente && !sousUnEtage) {
      geometrie = ((convexe && !extTrous.length) || reglages.type === 'un-pan')
        ? geometrieDuToit(ext, reglages, base, options)
        : geometrieSquelette(ext, reglages, base, options);
    }
    return { contour, adosses, trous, ext, extTrous, reglages, base, convexe, enAttente: enPente && !sousUnEtage && !geometrie, sousUnEtage, geometrie };
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
    // #458c : ce qui dépasse du toit (une cheminée) compte aussi, comme le rendu le pose.
    for (const m of meublesDuNiveau(b, n.id).filter(x => x.surLeToit)) {
      h = Math.max(h, baseSurLeToit(b, n.id, empreinteDuMeuble(m)) + hauteurAuSol(m) - basDuMeuble(m) + sommetDuMeuble(m));
    }
  }
  return h;
}

// ── Les éléments posés sur le toit (#458c) ─────────────────────────────────────────────────────

/**
 * La hauteur du dessus du toit d'un niveau au point p (vu de dessus) : sur un pan, le plan du pan ;
 * sur un toit plat, le dessus de sa dalle. Null hors du toit (hors de la forme, dans une cour). PURE.
 */
export function hauteurDuToitEn(b, niveauId, p){
  for (const t of toitsDuNiveau(b, niveauId)) {
    const dedans = (poly) => pointDansPolygone(p, poly);
    const forme = t.geometrie ? decaler(t.ext, t.adosses.map(a => (a ? 0 : t.reglages.debord))) : t.ext;
    if (!dedans(forme) || (t.extTrous || []).some(dedans)) continue;
    if (!t.geometrie) return t.base;
    for (const pan of t.geometrie.pans) {
      const tris = pan.triangles || pan.points.slice(2).map((_, i) => [0, i + 1, i + 2]);
      for (const [i, j, k] of tris) {
        const A = pan.points[i], B = pan.points[j], C = pan.points[k];
        const det = (B.x - A.x) * (C.z - A.z) - (C.x - A.x) * (B.z - A.z);
        if (Math.abs(det) < 1e-12) continue;
        const u = ((p.x - A.x) * (C.z - A.z) - (C.x - A.x) * (p.z - A.z)) / det;
        const v = ((B.x - A.x) * (p.z - A.z) - (p.x - A.x) * (B.z - A.z)) / det;
        if (u >= -1e-9 && v >= -1e-9 && u + v <= 1 + 1e-9) return A.y + u * (B.y - A.y) + v * (C.y - A.y);
      }
    }
    return t.base;
  }
  return null;
}

/**
 * Où poser un élément sur le toit (une cheminée, une antenne) : le plus BAS du toit sous son empreinte,
 * pour qu'il s'y plante sans flotter (il traverse la pente du côté qui monte, comme une vraie
 * cheminée). Hors du toit : le dessus des murs. PURE.
 */
export function baseSurLeToit(b, niveauId, empreinte){
  const ys = empreinte.map(p => hauteurDuToitEn(b, niveauId, p)).filter(y => y != null);
  if (ys.length) return Math.min(...ys);
  const n = ((b && b.niveaux) || []).find(x => x.id === niveauId);
  return n ? (n.elevation || 0) + hauteurDesMursDuNiveau(b, niveauId) : 0;
}

/**
 * Un élément SUR LE TOIT ne le quitte pas (demandé) : `p` s'il est sur un toit du niveau (dans sa
 * forme, à la face des murs, hors des cours), sinon le point le plus proche de son bord. Sans toit,
 * `p`. PURE.
 */
export function ramenerSurLeToit(b, niveauId, p){
  const toits = toitsDuNiveau(b, niveauId);
  if (!toits.length) return p;
  if (toits.some(t => pointDansPolygone(p, t.ext) && !t.extTrous.some(h => pointDansPolygone(p, h)))) return p;
  let meilleur = null, d2 = Infinity;
  for (const poly of toits.flatMap(t => [t.ext, ...t.extTrous])) {
    poly.forEach((a, i) => {
      const c = poly[(i + 1) % poly.length];
      const dx = c.x - a.x, dz = c.z - a.z, L2 = dx * dx + dz * dz || 1;
      const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2));
      const q = { x: a.x + dx * k, z: a.z + dz * k }, d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
      if (d < d2) { d2 = d; meilleur = q; }
    });
  }
  return meilleur || p;
}

/** Un point où poser un élément sur le toit d'un niveau : le milieu de sa première forme couverte. */
export function centreDuToit(b, niveauId){
  const t = toitsDuNiveau(b, niveauId)[0];
  if (!t) return null;
  const c = t.contour;
  const p = { x: c.reduce((s, q) => s + q.x, 0) / c.length, z: c.reduce((s, q) => s + q.z, 0) / c.length };
  return pointDansPolygone(p, c) ? p : c[0];
}
