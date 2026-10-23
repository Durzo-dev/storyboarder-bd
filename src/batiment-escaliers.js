/**
 * @file batiment-escaliers.js
 * LES ESCALIERS de l'éditeur de bâtiment (#454c). Fonctions PURES : la forme d'un escalier (ses
 * marches et ses paliers), la trémie qu'il perce dans le plancher du dessus, sa validité.
 *
 * Un escalier relie SON niveau (`niveauId`) au niveau du dessus. Il est décrit par :
 *   { id, niveauId, type: 'droit' | 'L' | 'U', depart: {x, z}, angle, largeur, sens: 1 | -1,
 *     contremarches: bool, rampe: 'aucune' | 'gauche' | 'droite' | 'deux' }
 * `depart` est le MILIEU DU BAS de la première marche, `angle` la direction où il monte (radians,
 * dans le repère de la vue de dessus), `sens` le côté où tourne un escalier en L ou en U (1 : à
 * gauche en montant… dans le repère z vers le bas, la normale (−uz, ux)).
 *
 * LES MARCHES se calculent : la hauteur à franchir (du sol de son niveau à celui du dessus) divisée en
 * marches d'environ 17 cm, d'une profondeur (giron) donnée par la règle de Blondel, 2h + g = 63 cm,
 * bornée entre 24 et 30 cm. Le colimaçon viendra plus tard (décidé le 23 octobre 2026).
 */
import { niveauDessus } from './batiment-niveaux.js';

export const TYPES_D_ESCALIER = ['droit', 'L', 'U'];
export const RAMPES = ['aucune', 'gauche', 'droite', 'deux'];
export const DEFAUTS_ESCALIER = { type: 'droit', largeur: 0.9, sens: 1, contremarches: true, rampe: 'droite' };
/** La hauteur de marche visée, et la marge de la trémie autour de l'escalier (m). */
const HAUTEUR_VISEE = 0.17, MARGE_TREMIE = 0.05;

const fini = (v) => typeof v === 'number' && Number.isFinite(v);

/** Un escalier relu : les valeurs illisibles prennent leur valeur par défaut. */
export function normaliserEscalier(e){
  return {
    ...e,
    type: TYPES_D_ESCALIER.includes(e.type) ? e.type : DEFAUTS_ESCALIER.type,
    depart: e.depart && fini(e.depart.x) && fini(e.depart.z) ? { x: e.depart.x, z: e.depart.z } : { x: 0, z: 0 },
    angle: fini(e.angle) ? e.angle : -Math.PI / 2,
    largeur: fini(e.largeur) ? Math.min(3, Math.max(0.5, e.largeur)) : DEFAUTS_ESCALIER.largeur,
    sens: e.sens === -1 ? -1 : 1,
    contremarches: typeof e.contremarches === 'boolean' ? e.contremarches : DEFAUTS_ESCALIER.contremarches,
    rampe: RAMPES.includes(e.rampe) ? e.rampe : DEFAUTS_ESCALIER.rampe,
  };
}

/** La hauteur à franchir : du sol de son niveau à celui du dessus (null sans niveau au-dessus). */
export function hauteurAFranchir(b, niveauId){
  const n = (b.niveaux || []).find(x => x.id === niveauId), d = niveauDessus(b, niveauId);
  return n && d ? d.elevation - n.elevation : null;
}

/** Le nombre de marches, leur hauteur et leur giron pour une hauteur `H`. */
export function decoupage(H){
  const nombre = Math.max(2, Math.ceil(H / HAUTEUR_VISEE));
  const hauteur = H / nombre;
  const giron = Math.min(0.30, Math.max(0.24, 0.63 - 2 * hauteur));
  return { nombre, hauteur, giron };
}

/**
 * La forme de l'escalier : ses morceaux, en plan, chacun `{ points: [4 coins], dessus, hauteur }`
 * (`dessus` : la hauteur de sa face supérieure au-dessus du sol du niveau ; `hauteur` : celle d'une
 * marche, pour l'épaisseur d'une marche ouverte), avec `palier: true` pour un palier. Et ses volées,
 * `{ de, vers, y0, y1 }` (en plan, le long de l'axe, et la hauteur au pied et en haut), pour la flèche
 * du plan et la rampe.
 * Rend null sans niveau au-dessus.
 */
export function formeDeLEscalier(b, esc){
  const e = normaliserEscalier(esc);
  const H = hauteurAFranchir(b, e.niveauId);
  if (!(H > 0)) return null;
  const { nombre, hauteur, giron } = decoupage(H);
  const u = { x: Math.cos(e.angle), z: Math.sin(e.angle) };
  const n = { x: -u.z * e.sens, z: u.x * e.sens };   // le côté où il tourne
  const w = e.largeur;
  // Un point local (s le long de la montée, t vers le côté où il tourne) → le plan.
  const P = (s, t) => ({ x: e.depart.x + u.x * s + n.x * t, z: e.depart.z + u.z * s + n.z * t });
  const rect = (s0, s1, t0, t1) => [P(s0, t0), P(s1, t0), P(s1, t1), P(s0, t1)];
  const morceaux = [], volees = [];
  if (e.type === 'droit') {
    for (let i = 0; i < nombre; i++) morceaux.push({ points: rect(i * giron, (i + 1) * giron, -w / 2, w / 2), dessus: (i + 1) * hauteur, hauteur });
    volees.push({ de: P(0, 0), vers: P(nombre * giron, 0), y0: 0, y1: H });
    return { morceaux, volees, nombre, hauteur, giron, emprise: rect(0, nombre * giron, -w / 2, w / 2), e, P };
  }
  // L et U : une première volée, un palier, une seconde volée (le palier compte pour une marche).
  const n1 = Math.max(1, Math.floor((nombre - 1) / 2)), n2 = nombre - 1 - n1;
  const a = n1 * giron;
  for (let i = 0; i < n1; i++) morceaux.push({ points: rect(i * giron, (i + 1) * giron, -w / 2, w / 2), dessus: (i + 1) * hauteur, hauteur });
  volees.push({ de: P(0, 0), vers: P(a, 0), y0: 0, y1: n1 * hauteur });
  if (e.type === 'L') {
    morceaux.push({ points: rect(a, a + w, -w / 2, w / 2), dessus: (n1 + 1) * hauteur, hauteur, palier: true });
    for (let j = 0; j < n2; j++) {
      morceaux.push({ points: rect(a, a + w, w / 2 + j * giron, w / 2 + (j + 1) * giron), dessus: (n1 + 2 + j) * hauteur, hauteur });
    }
    volees.push({ de: P(a + w / 2, w / 2), vers: P(a + w / 2, w / 2 + n2 * giron), y0: (n1 + 1) * hauteur, y1: H });
    const emprise = [P(0, -w / 2), P(a + w, -w / 2), P(a + w, w / 2 + n2 * giron), P(a, w / 2 + n2 * giron), P(a, w / 2), P(0, w / 2)];
    return { morceaux, volees, nombre, hauteur, giron, emprise, e, P };
  }
  // U : le palier traverse les deux volées, la seconde redescend le long de la première, côte à côte.
  morceaux.push({ points: rect(a, a + w, -w / 2, w / 2 + w), dessus: (n1 + 1) * hauteur, hauteur, palier: true });
  for (let j = 0; j < n2; j++) {
    morceaux.push({ points: rect(a - (j + 1) * giron, a - j * giron, w / 2, w / 2 + w), dessus: (n1 + 2 + j) * hauteur, hauteur });
  }
  volees.push({ de: P(a, w), vers: P(a - n2 * giron, w), y0: (n1 + 1) * hauteur, y1: H });
  const fond = Math.min(0, a - n2 * giron);
  return { morceaux, volees, nombre, hauteur, giron, emprise: rect(fond, a + w, -w / 2, w / 2 + w), e, P };
}

/**
 * La TRÉMIE : l'ouverture qu'il faut dans le plancher du dessus, l'emprise de l'escalier élargie d'une
 * petite marge (en plan). Null sans niveau au-dessus.
 */
export function tremieDeLEscalier(b, esc){
  const f = formeDeLEscalier(b, esc);
  if (!f) return null;
  // L'emprise grossie : chaque coin éloigné du centre de gravité de la marge (assez pour une forme
  // rectangulaire ou en L, dont les coins rentrants restent proches).
  const cx = f.emprise.reduce((s, p) => s + p.x, 0) / f.emprise.length, cz = f.emprise.reduce((s, p) => s + p.z, 0) / f.emprise.length;
  return f.emprise.map(p => {
    const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz) || 1;
    return { x: p.x + dx / d * MARGE_TREMIE, z: p.z + dz / d * MARGE_TREMIE };
  });
}

const dedans = (p, pts) => {
  let r = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], c = pts[j];
    if ((a.z > p.z) !== (c.z > p.z) && p.x < (c.x - a.x) * (p.z - a.z) / (c.z - a.z) + a.x) r = !r;
  }
  return r;
};
const seCoupent = (a, b2, c, d) => {
  const o = (p, q, r) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  return o(c, d, a) * o(c, d, b2) < 0 && o(a, b2, c) * o(a, b2, d) < 0;
};

/** p est-il sur l'escalier (dans son emprise) ? */
export function surLEscalier(b, esc, p){
  const f = formeDeLEscalier(b, esc);
  return !!f && dedans(p, f.emprise);
}

/** L'escalier du niveau sous p, ou null. */
export function escalierSous(b, niveauId, p){
  const e = (b.escaliers || []).filter(x => x.niveauId === niveauId).reverse().find(x => surLEscalier(b, x, p));
  return e ? e.id : null;
}

/**
 * Peut-on poser cet escalier ? `{ ok: true }`, ou `{ erreur: 'sansEtage' }` (rien au-dessus), ou
 * `{ erreur: 'mur' }` (un mur du niveau le traverse). Un escalier peut longer un mur, pas le traverser.
 */
export function validiteDeLEscalier(b, esc){
  const f = formeDeLEscalier(b, esc);
  if (!f) return { erreur: 'sansEtage' };
  const pts = f.emprise;
  for (const m of (b.murs || []).filter(x => x.niveauId === esc.niveauId)) {
    // Le mur réduit de sa demi-épaisseur aux bouts : longer un mur ou s'arrêter contre ne compte pas.
    const milieu = { x: (m.a.x + m.b.x) / 2, z: (m.a.z + m.b.z) / 2 };
    if (dedans(milieu, pts)) return { erreur: 'mur' };
    for (let i = 0; i < pts.length; i++) {
      if (seCoupent(m.a, m.b, pts[i], pts[(i + 1) % pts.length])) return { erreur: 'mur' };
    }
  }
  return { ok: true };
}

function nouvelId(liste){
  const pris = new Set(liste.map(e => e.id));
  let n = liste.length;
  while (pris.has('e' + n)) n++;
  return 'e' + n;
}

/** Pose un escalier ; rend `{ escalier }` ou `{ erreur }` (cf. validiteDeLEscalier). */
export function ajouterEscalier(b, niveauId, reglages){
  const e = normaliserEscalier({ ...DEFAUTS_ESCALIER, ...reglages, niveauId });
  const v = validiteDeLEscalier(b, e);
  if (v.erreur) return v;
  if (!b.escaliers) b.escaliers = [];
  e.id = nouvelId(b.escaliers);
  b.escaliers.push(e);
  return { escalier: e };
}

/** Retouche un escalier (position, angle, type, options) ; refusé s'il ne tient plus. */
export function modifierEscalier(b, id, changements){
  const e = (b.escaliers || []).find(x => x.id === id);
  if (!e) return { erreur: 'inconnu' };
  const neuf = normaliserEscalier({ ...e, ...changements });
  const v = validiteDeLEscalier(b, neuf);
  if (v.erreur) return v;
  Object.assign(e, neuf);
  return { ok: true };
}

/** Supprime un escalier. */
export function supprimerEscalier(b, id){
  b.escaliers = (b.escaliers || []).filter(e => e.id !== id);
}

/** Le rayon et le pas de la recherche d'une place pour un escalier (m). */
const RAYON_RECHERCHE = 1.5, PAS_RECHERCHE = 0.1;
/** La distance sous laquelle un côté d'escalier TOUCHE la face d'un mur (m). */
const CONTACT = 0.03;

/**
 * Les côtés de l'emprise d'un escalier, dans son repère (s le long de la montée, t vers le côté où il
 * tourne) : bas, haut, et les deux flancs. Chacun : la droite qui le porte (un point, sa direction) et
 * la normale vers l'EXTÉRIEUR, en plan.
 */
function cotesDeLEmprise(f){
  const { e } = f;
  const u = { x: Math.cos(e.angle), z: Math.sin(e.angle) };
  const n = { x: -u.z * e.sens, z: u.x * e.sens };
  const loc = f.emprise.map(p => ({ s: (p.x - e.depart.x) * u.x + (p.z - e.depart.z) * u.z, t: (p.x - e.depart.x) * n.x + (p.z - e.depart.z) * n.z }));
  const s0 = Math.min(...loc.map(q => q.s)), s1 = Math.max(...loc.map(q => q.s));
  const t0 = Math.min(...loc.map(q => q.t)), t1 = Math.max(...loc.map(q => q.t));
  return [
    { cote: 'bas', ext: { x: -u.x, z: -u.z }, d: s0, de: [t0, t1], axe: 's' },
    { cote: 'haut', ext: u, d: s1, de: [t0, t1], axe: 's' },
    { cote: 'flanc0', ext: { x: -n.x, z: -n.z }, d: t0, de: [s0, s1], axe: 't' },
    { cote: 'flanc1', ext: n, d: t1, de: [s0, s1], axe: 't' },
  ].map(c => ({ ...c, u, n }));
}

/**
 * Pour chaque côté de l'escalier, la face de mur parallèle la plus proche devant lui (dans la
 * direction de sa normale extérieure), et la distance qui les sépare (négative si le côté est déjà
 * dans le mur). Seules comptent les faces qui le recouvrent sur une partie de sa longueur.
 */
function facesEnFace(b, f){
  const cotes = cotesDeLEmprise(f);
  const { e } = f;
  const murs = (b.murs || []).filter(m => m.niveauId === e.niveauId);
  return cotes.map(c => {
    let meilleur = null;
    for (const m of murs) {
      const L = Math.hypot(m.b.x - m.a.x, m.b.z - m.a.z) || 1;
      const w = { x: (m.b.x - m.a.x) / L, z: (m.b.z - m.a.z) / L };
      // Parallèle au côté : le mur est perpendiculaire à sa normale extérieure.
      if (Math.abs(w.x * c.ext.x + w.z * c.ext.z) > 0.02) continue;
      // La position du mur (son axe) le long de la normale du côté, depuis le départ de l'escalier.
      const proj = (p) => (p.x - e.depart.x) * c.ext.x + (p.z - e.depart.z) * c.ext.z;
      const signe = c.cote === 'bas' || c.cote === 'flanc0' ? -1 : 1;   // d est compté le long de u ou n
      const face = proj(m.a) - m.epaisseur / 2;                          // la face tournée vers l'escalier
      const ecart = face - signe * c.d;
      // Le recouvrement : l'étendue du mur le long du côté.
      const axe = c.axe === 's' ? c.n : c.u;
      const ta = (m.a.x - e.depart.x) * axe.x + (m.a.z - e.depart.z) * axe.z, tb = (m.b.x - e.depart.x) * axe.x + (m.b.z - e.depart.z) * axe.z;
      if (Math.min(ta, tb) > c.de[1] - 0.01 || Math.max(ta, tb) < c.de[0] + 0.01) continue;
      if (ecart < -m.epaisseur) continue;   // le mur est derrière le côté, pas devant
      if (!meilleur || Math.abs(ecart) < Math.abs(meilleur.ecart)) meilleur = { ecart, ext: c.ext, murId: m.id };
    }
    return { cote: c.cote, face: meilleur };
  });
}

/**
 * Les MURS que l'escalier touche (#454c, demandé : ses « aimants ») : les ids des murs dont la face
 * est contre un de ses côtés. Ce sont les murs qui comptent, pas les côtés : tourné, l'escalier peut
 * garder le même mur contre un autre de ses côtés.
 */
export function contactsDeLEscalier(b, esc){
  const f = formeDeLEscalier(b, esc);
  if (!f) return [];
  return [...new Set(facesEnFace(b, f).filter(x => x.face && Math.abs(x.face.ecart) <= CONTACT).map(x => x.face.murId))];
}

/**
 * L'AIMANT (demandé) : rapproche l'escalier des murs à moins de `tol` de ses côtés, jusqu'à toucher
 * leur face. Au plus un aimant par direction (le long de la montée, et en travers). Rend le nouveau
 * `depart` (inchangé s'il n'y a rien à moins de `tol`).
 */
export function aimanterEscalier(b, esc, tol = 0.15){
  const f = formeDeLEscalier(b, esc);
  if (!f) return esc.depart;
  let ds = null, dt = null;
  for (const x of facesEnFace(b, f)) {
    if (!x.face || Math.abs(x.face.ecart) > tol) continue;
    const v = { x: x.face.ext.x * x.face.ecart, z: x.face.ext.z * x.face.ecart };
    if (x.cote === 'bas' || x.cote === 'haut') { if (!ds || Math.abs(x.face.ecart) < ds.n) ds = { v, n: Math.abs(x.face.ecart) }; }
    else if (!dt || Math.abs(x.face.ecart) < dt.n) dt = { v, n: Math.abs(x.face.ecart) };
  }
  const d = { x: (ds ? ds.v.x : 0) + (dt ? dt.v.x : 0), z: (ds ? ds.v.z : 0) + (dt ? dt.v.z : 0) };
  return { x: Math.round((esc.depart.x + d.x) * 1000) / 1000, z: Math.round((esc.depart.z + d.z) * 1000) / 1000 };
}

/** La pièce du niveau qui contient TOUTE l'emprise de l'escalier, ou null. */
function pieceDeLEscalier(b, esc, faces){
  const f = formeDeLEscalier(b, esc);
  if (!f) return null;
  // Un rien vers l'intérieur : un escalier posé contre un mur a ses coins sur la face, pas dans le mur.
  const cx = f.emprise.reduce((t, p) => t + p.x, 0) / f.emprise.length, cz = f.emprise.reduce((t, p) => t + p.z, 0) / f.emprise.length;
  const pts = f.emprise.map(p => ({ x: p.x + (cx - p.x) * 0.002, z: p.z + (cz - p.z) * 0.002 }));
  return faces.find(face => pts.every(p => dedansFace(p, face))) || null;
}
const dedansFace = (p, face) => dedans(p, face.points) && !(face.trous || []).some(t => dedans(p, t));

/**
 * Essaie une retouche de l'escalier `id` (un changement de type, d'angle, de largeur…). Ne modifie
 * rien. Rend `{ changements, deplacement }` (ce qu'il faut appliquer, sa nouvelle position comprise
 * s'il doit bouger, et la distance parcourue) ou `{ erreur }` ('mur', 'sansEtage', 'hors').
 *
 * LES CONTRAINTES, dans cet ordre (demandé par Valentin le 23 octobre 2026) :
 *   1. un escalier qui est dans une pièce y RESTE : toute place essayée est dans CETTE pièce, et c'est
 *      toute la pièce qui est explorée (pas seulement les environs) ;
 *   2. les murs qu'il touche (ses « aimants »), il les touche encore si c'est possible ; sinon on en
 *      lâche un, puis deux, et ainsi de suite : la place retenue est la plus PROCHE parmi celles qui
 *      gardent le plus de contacts ;
 *   3. si même sans aucun contact rien ne tient dans la pièce, c'est refusé ('hors') : le bouton qui
 *      le proposerait reste éteint.
 * Un escalier posé hors de toute pièce n'a que la contrainte 2, et cherche à 1,5 m autour de lui.
 * Chaque place essayée passe aussi par l'aimant, pour retomber collée aux murs. `faces` : les formes
 * des pièces du niveau (formesDesPieces), fournies par l'appelant.
 */
export function essayerEscalier(b, id, changements, faces = []){
  const e = (b.escaliers || []).find(x => x.id === id);
  if (!e) return { erreur: 'inconnu' };
  const piece = faces.length ? pieceDeLEscalier(b, e, faces) : null;
  const contacts = contactsDeLEscalier(b, e);
  const neuf = normaliserEscalier({ ...e, ...changements });
  if (!formeDeLEscalier(b, neuf)) return { erreur: 'sansEtage' };
  // Les places à essayer : toute la pièce (sa boîte, par pas de 20 cm, l'aimant affine), sinon les
  // environs ; de la plus proche à la plus lointaine.
  const essais = [{ dx: 0, dz: 0, d: 0 }];
  if (piece) {
    const xs = piece.points.map(p => p.x), zs = piece.points.map(p => p.z), PAS = 0.2;
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += PAS) for (let z = Math.min(...zs); z <= Math.max(...zs); z += PAS) {
      const dx = x - neuf.depart.x, dz = z - neuf.depart.z;
      essais.push({ dx, dz, d: Math.hypot(dx, dz) });
    }
  } else {
    const n = Math.round(RAYON_RECHERCHE / PAS_RECHERCHE);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const d = Math.hypot(i, j) * PAS_RECHERCHE;
      if (d > 0 && d <= RAYON_RECHERCHE + 1e-9) essais.push({ dx: i * PAS_RECHERCHE, dz: j * PAS_RECHERCHE, d });
    }
  }
  essais.sort((x, y) => x.d - y.d);
  // La meilleure place par nombre de contacts gardés.
  const meilleures = new Map();
  for (const t of essais) {
    const brut = { x: neuf.depart.x + t.dx, z: neuf.depart.z + t.dz };
    const aimante = aimanterEscalier(b, { ...neuf, depart: brut });
    for (const depart of (t.d === 0 ? [brut, aimante] : [aimante, brut])) {
      const essai = { ...neuf, depart };
      if (!validiteDeLEscalier(b, essai).ok) continue;
      if (piece && pieceDeLEscalier(b, essai, [piece]) !== piece) continue;
      const garde = contacts.length ? contactsDeLEscalier(b, essai).filter(c => contacts.includes(c)).length : 0;
      const deplacement = Math.hypot(depart.x - e.depart.x, depart.z - e.depart.z);
      const actuel = meilleures.get(garde);
      if (!actuel || deplacement < actuel.deplacement - 1e-9) meilleures.set(garde, { depart, deplacement });
      break;
    }
    // Tous les contacts gardés : les places suivantes sont plus loin, inutile de continuer.
    if (meilleures.has(contacts.length)) break;
  }
  if (!meilleures.size) return { erreur: piece ? 'hors' : 'mur' };
  const garde = Math.max(...meilleures.keys());
  const { depart, deplacement } = meilleures.get(garde);
  const memePlace = Math.hypot(depart.x - neuf.depart.x, depart.z - neuf.depart.z) < 1e-9;
  return memePlace ? { changements, deplacement: 0 } : { changements: { ...changements, depart }, deplacement };
}

/**
 * Ce qu'un changement de la pile des niveaux casserait pour les escaliers (#454b, demandé : réordonner
 * les niveaux est refusé s'il bloque un escalier, avec la liste des escaliers gênants et la raison de
 * chacun). Compare le bâtiment `avant` et le bâtiment `apres` : un escalier qui tenait et ne tient
 * plus (plus de niveau au-dessus, plus long au point de traverser un mur, ou de sortir de sa pièce).
 * `facesAvant(niveauId)` / `facesApres(niveauId)` : les formes des pièces (formesDesPieces), fournies
 * par l'appelant. Rend `[{ escalier, niveau, raison: 'sansEtage' | 'mur' | 'hors' }]`.
 */
export function escaliersBloques(avant, apres, facesAvant, facesApres){
  const problemes = [];
  for (const e of apres.escaliers || []) {
    const ancien = (avant.escaliers || []).find(x => x.id === e.id);
    if (!ancien || !validiteDeLEscalier(avant, ancien).ok) continue;   // il ne tenait déjà pas : pas notre affaire
    const niveau = (apres.niveaux || []).find(n => n.id === e.niveauId);
    const v = validiteDeLEscalier(apres, e);
    if (v.erreur) { problemes.push({ escalier: e, niveau, raison: v.erreur }); continue; }
    const avantFaces = facesAvant(e.niveauId), apresFaces = facesApres(e.niveauId);
    if (avantFaces.length && pieceDeLEscalier(avant, ancien, avantFaces) && !pieceDeLEscalier(apres, e, apresFaces)) {
      problemes.push({ escalier: e, niveau, raison: 'hors' });
    }
  }
  return problemes;
}
