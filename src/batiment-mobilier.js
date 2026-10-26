/**
 * @file batiment-mobilier.js
 * LE MOBILIER D'UN BÂTIMENT (#454e, demandé le 26 octobre 2026) : des Éléments posés DANS l'éditeur,
 * fixes (décision 8 de #454 : le mobilier fixe dans l'éditeur, la mise en scène dans la Scène).
 *
 * « Ajouter un Élément » dans la section de la pièce ouvre le store de modèles ; le modèle choisi est
 * posé au centre de la pièce, au sol. À l'outil Sélection : glisser le déplace (et l'AIMANTE aux
 * murs), le clic droit le tourne d'un quart de tour, la molette le grandit ou le rétrécit, Suppr
 * l'enlève.
 *
 * Un meuble : `{ id, niveauId, modelFile, nom, x, z, rotY, echelle, dims: [l, p, h], base }`
 *   - x, z : le CENTRE de son empreinte, en mètres dans le repère du bâtiment ;
 *   - rotY : en radians, par quarts de tour ;
 *   - dims : largeur (x), profondeur (z), hauteur (y) À L'ÉCHELLE 1, en mètres ;
 *   - base : le facteur qui ramène le fichier à ces dimensions (un modèle fait en centimètres) ;
 *   - echelle : ce que la molette a changé, 1 au départ.
 * Il est AU SOL de son niveau par défaut (demandé). `colle: false` le décolle : `y`, sa hauteur
 * au-dessus du sol, en mètres (posé sur un meuble, accroché au mur).
 *
 * Fonctions PURES ; le rendu est dans batiment-3d.js, les gestes dans batiment-editeur-ui.js.
 */
import { polygonesDesMurs } from './batiment-geometrie.js';

/** Bornes de la taille (molette) et le pas d'un cran. */
export const ECHELLE_MEUBLE = { min: 0.2, max: 5, pas: 1.1 };
/** La distance à laquelle un meuble se colle à la face d'un mur, en mètres. */
export const AIMANT_MEUBLE = 0.25;
/** La hauteur prise pour un modèle sans dimensions plausibles (illisible, ou fait en centimètres). */
const HAUTEUR_REPLI = 1;

const arrondi = (v) => Math.round(v * 1000) / 1000;
const nouvelId = (liste) => { let i = (liste || []).length + 1; while ((liste || []).some(e => e.id === 'e' + i)) i++; return 'e' + i; };

/**
 * Les dimensions de départ d'un modèle `[l, p, h]` et le facteur `base` qui y ramène le fichier.
 * `mesurees` : ce que le modèle mesure ([x, z, y] comme les vignettes les relèvent), ou null. Un
 * modèle de plus de 6 m ou de moins de 5 cm de haut est sans doute dans une autre unité : ramené à
 * 1 m de haut, proportions gardées (la molette corrige ensuite).
 */
export function dimensionsDeDepart(mesurees){
  const [x, z, y] = Array.isArray(mesurees) ? mesurees.map(Number) : [];
  if (![x, z, y].every(v => Number.isFinite(v) && v > 0)) return { dims: [1, 1, HAUTEUR_REPLI], base: 1 };
  const base = y > 6 || y < 0.05 ? HAUTEUR_REPLI / y : 1;
  return { dims: [arrondi(x * base), arrondi(z * base), arrondi(y * base)], base };
}

/** Pose un meuble au point `centre` du niveau. Rend le meuble créé. */
export function ajouterMeuble(b, niveauId, { modelFile, nom, centre, mesurees }){
  if (!Array.isArray(b.elements)) b.elements = [];
  const { dims, base } = dimensionsDeDepart(mesurees);
  const m = {
    id: nouvelId(b.elements), niveauId, modelFile, nom: nom || String(modelFile || '').replace(/\.glb$/i, ''),
    x: arrondi(centre.x), z: arrondi(centre.z), rotY: 0, echelle: 1, dims, base,
  };
  b.elements.push(m);
  return m;
}

/** Les meubles d'un niveau. */
export const meublesDuNiveau = (b, niveauId) => (b.elements || []).filter(e => e && e.niveauId === niveauId && e.modelFile);

/**
 * L'ORIENTATION COMPLÈTE (demandé : tourner, incliner, basculer) : `rotY` autour de la verticale,
 * puis `rotX` (incliner, autour de sa largeur) et `rotZ` (basculer, autour de sa profondeur), dans
 * l'ordre 'YXZ' de three. Un point du meuble (repère local, en mètres) dans le repère du bâtiment,
 * relatif à son centre au sol.
 */
function tourner3D(m, p){
  const [x0, y0, z0] = [p.x, p.y, p.z];
  const cz = Math.cos(m.rotZ || 0), sz = Math.sin(m.rotZ || 0);
  const x1 = x0 * cz - y0 * sz, y1 = x0 * sz + y0 * cz, z1 = z0;                 // Rz
  const cx = Math.cos(m.rotX || 0), sx = Math.sin(m.rotX || 0);
  const y2 = y1 * cx - z1 * sx, z2 = y1 * sx + z1 * cx, x2 = x1;                 // Rx
  const cy = Math.cos(m.rotY || 0), sy = Math.sin(m.rotY || 0);
  return { x: x2 * cy + z2 * sy, y: y2, z: -x2 * sy + z2 * cy };                  // Ry
}

/** Les huit coins de sa boîte (largeur × hauteur × profondeur, posée sur y = 0), tournés. */
function coins3D(m){
  const k = m.echelle || 1, [l, p, h] = (m.dims || [1, 1, 1]).map(v => v * k);
  const sortie = [];
  for (const x of [-l / 2, l / 2]) for (const y of [0, h]) for (const z of [-p / 2, p / 2]) sortie.push(tourner3D(m, { x, y, z }));
  return sortie;
}

/** Ses trois axes une fois tourné (largeur x, hauteur y, devant z), pour le repère de la section. */
export function axesDuMeuble(m){
  return { x: tourner3D(m, { x: 1, y: 0, z: 0 }), y: tourner3D(m, { x: 0, y: 1, z: 0 }), z: tourner3D(m, { x: 0, y: 0, z: 1 }) };
}

/** Le plus bas de ses coins une fois tourné (0 s'il est droit) : ce qu'on remonte pour le poser au sol. */
export const basDuMeuble = (m) => Math.min(...coins3D(m).map(c => c.y));

/** L'enveloppe convexe de points (x, z), dans le sens trigonométrique (Andrew). */
function enveloppe(pts){
  const p = pts.slice().sort((a, b) => a.x - b.x || a.z - b.z);
  const croix = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const bas = [], haut = [];
  for (const q of p) { while (bas.length >= 2 && croix(bas[bas.length - 2], bas[bas.length - 1], q) <= 1e-12) bas.pop(); bas.push(q); }
  for (const q of p.slice().reverse()) { while (haut.length >= 2 && croix(haut[haut.length - 2], haut[haut.length - 1], q) <= 1e-12) haut.pop(); haut.push(q); }
  return [...bas.slice(0, -1), ...haut.slice(0, -1)];
}

/** Son EMPREINTE au sol : l'ombre de sa boîte tournée, vue de dessus (4 coins s'il est droit). */
export function empreinteDuMeuble(m){
  return enveloppe(coins3D(m).map(c => ({ x: m.x + c.x, z: m.z + c.z })));
}

/** Le point de son devant (le côté +z), au sol, pour le repère du plan. */
export function devantDuMeuble(m){
  const k = m.echelle || 1;
  const c = tourner3D(m, { x: 0, y: 0, z: (m.dims[1] * k) / 2 });
  return { x: m.x + c.x, z: m.z + c.z };
}

/** p est-il dans le polygone convexe `poly` (sens quelconque) ? */
function dansConvexe(p, poly){
  let signe = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
    if (Math.abs(c) < 1e-12) continue;
    if (signe === 0) signe = Math.sign(c); else if (Math.sign(c) !== signe) return false;
  }
  return true;
}

/** Le meuble du niveau sous le point p (le plus petit, s'ils se chevauchent), ou null. */
export function meubleSous(b, niveauId, p){
  let meilleur = null;
  for (const m of meublesDuNiveau(b, niveauId)) {
    const e = empreinteDuMeuble(m);
    if (!dansConvexe(p, e)) continue;
    const aire = Math.abs(e.reduce((t, q, i) => { const r = e[(i + 1) % e.length]; return t + q.x * r.z - r.x * q.z; }, 0)) / 2;
    if (!meilleur || aire < meilleur.aire) meilleur = { id: m.id, aire };
  }
  return meilleur ? meilleur.id : null;
}

/**
 * L'AIMANT (demandé) : le centre où poser le meuble `m` voulu en `centre`, collé à la face des murs
 * dont son empreinte passe à moins de `tol`. Au plus un mur par direction (deux murs qui se croisent :
 * un coin). Un mur ne compte que s'il est en face du meuble (leurs étendues se recouvrent le long du
 * mur). L'empreinte est celle du meuble TOURNÉ, inclinaison comprise.
 */
export function aimanterMeuble(b, m, centre, tol = AIMANT_MEUBLE){
  const murs = (b.murs || []).filter(w => w.niveauId === m.niveauId);
  const rel = empreinteDuMeuble({ ...m, x: 0, z: 0 });
  const retenus = [];
  for (const w of murs) {
    const L = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z);
    if (L < 1e-6) continue;
    const t = { x: (w.b.x - w.a.x) / L, z: (w.b.z - w.a.z) / L };
    let n = { x: -t.z, z: t.x };
    // La distance (signée) du centre à l'axe du mur ; la normale est tournée vers le meuble.
    let dist = (centre.x - w.a.x) * n.x + (centre.z - w.a.z) * n.z;
    if (dist < 0) { n = { x: -n.x, z: -n.z }; dist = -dist; }
    // L'étendue de l'empreinte vers le mur (contre n), et le long du mur.
    const enTravers = Math.max(...rel.map(c => -(c.x * n.x + c.z * n.z)));
    const leLong = Math.max(...rel.map(c => Math.abs(c.x * t.x + c.z * t.z)));
    const ecart = dist - (w.epaisseur || 0.2) / 2 - enTravers;
    if (Math.abs(ecart) > tol) continue;
    const s = (centre.x - w.a.x) * t.x + (centre.z - w.a.z) * t.z;
    if (s + leLong < 0.01 || s - leLong > L - 0.01) continue;   // pas en face du mur
    retenus.push({ n, ecart });
  }
  // Le plus proche d'abord ; un second seulement s'il n'est pas parallèle au premier (un coin).
  retenus.sort((a, c) => Math.abs(a.ecart) - Math.abs(c.ecart));
  const pris = [];
  for (const r of retenus) {
    if (pris.length === 2) break;
    if (pris.some(q => Math.abs(q.n.x * r.n.x + q.n.z * r.n.z) > 0.9)) continue;
    pris.push(r);
  }
  const p = { x: centre.x, z: centre.z };
  for (const r of pris) { p.x -= r.n.x * r.ecart; p.z -= r.n.z * r.ecart; }
  return { x: arrondi(p.x), z: arrondi(p.z), colle: pris.length > 0 };
}

/** Deux polygones convexes se recouvrent-ils de plus de `eps` (axes séparateurs) ? */
function serecouvrent(A, B, eps){
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const a = P[i], c = P[(i + 1) % P.length];
      const n = { x: -(c.z - a.z), z: c.x - a.x };
      const L = Math.hypot(n.x, n.z); if (L < 1e-12) continue;
      n.x /= L; n.z /= L;
      const proj = (Q) => Q.map(q => q.x * n.x + q.z * n.z);
      const pa = proj(A), pb = proj(B);
      const recouvrement = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
      if (recouvrement <= eps) return false;
    }
  }
  return true;
}

/**
 * LA COLLISION (demandé) : un meuble qui ne peut pas traverser les murs (par défaut) en traverse-t-il
 * un ? Son empreinte tournée contre le polygone de chaque mur du niveau (jonctions comprises), avec
 * une tolérance de 5 mm : collé contre une face par l'aimant, il ne traverse pas. Toujours faux
 * quand `traverse` est coché.
 */
export function meubleEnCollision(b, m, eps = 0.005){
  if (m.traverse) return false;
  const e = empreinteDuMeuble(m);
  for (const poly of polygonesDesMurs((b.murs || []).filter(w => w.niveauId === m.niveauId)).values()) {
    if (serecouvrent(e, poly, eps)) return true;
  }
  return false;
}

const TOUR = Math.PI * 2;
/** Un angle ramené dans [0 ; 2π[, calé exactement sur un quart de tour quand il en est à un cheveu
 *  (quatre quarts de tour doivent revenir pile au départ). */
const normaliserAngle = (a) => {
  let r = ((a % TOUR) + TOUR) % TOUR;
  const q = Math.round(r / (Math.PI / 2));
  if (Math.abs(r - q * Math.PI / 2) < 1e-9) r = (q % 4) * Math.PI / 2;
  return r;
};

/** Un quart de tour de plus (le clic droit, le bouton « Tourner », demandé), depuis son angle actuel. */
export function tournerMeuble(m){
  m.rotY = normaliserAngle((m.rotY || 0) + Math.PI / 2);
  return m;
}

/** Grandir (cran > 0) ou rétrécir (cran < 0) d'un pas de molette, dans les bornes. */
export function echelonnerMeuble(m, cran){
  const k = (m.echelle || 1) * (cran > 0 ? ECHELLE_MEUBLE.pas : 1 / ECHELLE_MEUBLE.pas);
  m.echelle = Math.round(Math.min(ECHELLE_MEUBLE.max, Math.max(ECHELLE_MEUBLE.min, k)) * 1000) / 1000;
  return m;
}

/**
 * Le CURSEUR de taille (demandé) : 0 à 100, sur une échelle LOGARITHMIQUE entre les bornes, pour
 * qu'il soit aussi fin pour rétrécir que pour grandir (×1 tombe au milieu, à 50).
 */
const LOG_MIN = Math.log(ECHELLE_MEUBLE.min), LOG_MAX = Math.log(ECHELLE_MEUBLE.max);
export const curseurDeLEchelle = (k) => Math.round(((Math.log(Math.min(ECHELLE_MEUBLE.max, Math.max(ECHELLE_MEUBLE.min, k || 1))) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 1000) / 10;
export const echelleDuCurseur = (v) => Math.round(Math.exp(LOG_MIN + (Math.min(100, Math.max(0, Number(v) || 0)) / 100) * (LOG_MAX - LOG_MIN)) * 1000) / 1000;

/** Ses dimensions à son échelle, en mètres : `{ largeur, longueur, hauteur }` (demandé, affichées). */
export function tailleDuMeuble(m){
  const k = m.echelle || 1, [l, p, h] = m.dims || [1, 1, 1];
  return { largeur: l * k, longueur: p * k, hauteur: h * k };
}

/** Sa hauteur au-dessus du sol de son niveau : 0 s'il y est collé (par défaut). */
export const hauteurAuSol = (m) => (m.colle === false ? (m.traverse ? Number(m.y) || 0 : Math.max(0, Number(m.y) || 0)) : 0);

/** Le coller au sol, ou l'en décoller à la hauteur `y` (en mètres, bornée à 0–20 m). */
export function collerAuSol(m, colle, y = null){
  if (colle) { delete m.colle; delete m.y; return m; }
  m.colle = false;
  // Sous le sol seulement s'il peut traverser (le sol compte comme un mur, demandé).
  m.y = Math.round(Math.min(20, Math.max(m.traverse ? -20 : 0, Number(y != null ? y : m.y) || 0)) * 1000) / 1000;
  return m;
}

/**
 * Incliner ou basculer de `delta` radians (le clic droit maintenu, demandé), borné à ±90°.
 * `axe` : 'x' (incliner) ou 'z' (basculer).
 */
export function pencherMeuble(m, axe, delta){
  const k = axe === 'x' ? 'rotX' : 'rotZ';
  const v = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, (m[k] || 0) + delta));
  if (Math.abs(v) < 1e-9) delete m[k]; else m[k] = Math.round(v * 1e6) / 1e6;
  return m;
}

/** Tourner de `delta` radians autour de la verticale. */
export function tournerDe(m, delta){
  m.rotY = normaliserAngle((m.rotY || 0) + delta);
  return m;
}

/**
 * Remettre droit (demandé) : EXACTEMENT l'orientation qu'il avait en arrivant dans la pièce, celle de
 * son modèle (ni rotation, ni inclinaison, ni bascule).
 */
export function redresserMeuble(m){
  m.rotY = 0;
  delete m.rotX; delete m.rotZ;
  return m;
}

/** Retire un meuble. */
export function supprimerMeuble(b, id){
  b.elements = (b.elements || []).filter(e => e.id !== id);
}

/** Les fichiers de modèle que porte un bâtiment (pour les précharger, et la signature du rendu). */
export function fichiersDesMeubles(b){
  return [...new Set((b && b.elements || []).map(e => e && e.modelFile).filter(f => typeof f === 'string' && f))];
}
