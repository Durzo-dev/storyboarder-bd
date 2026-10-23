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
