/**
 * @file batiment-ouvertures.js
 * LES OUVERTURES de l'éditeur de bâtiment (#454a-3c) : portes, fenêtres, baies vitrées, passages.
 * Fonctions PURES : où une ouverture peut aller, la poser, la déplacer, la retoucher.
 *
 * Une ouverture appartient à UN mur (`murId`) ; `le` est la fraction de la longueur du mur où se
 * trouve son CENTRE. Elle doit tenir dans le mur, à `MARGE_OUVERTURE` de ses bouts (un angle a besoin
 * de maçonnerie), sans chevaucher une autre ouverture du même mur, et sous le plafond du niveau.
 * Couper un mur (jonction en T) répartit ses ouvertures sur les deux moitiés (cf. couperMur).
 */
import { DEFAUTS_OUVERTURE, TYPES_D_OUVERTURE } from './batiment.js';

/** La maçonnerie gardée entre une ouverture et le bout de son mur, et entre deux ouvertures (m). */
export const MARGE_OUVERTURE = 0.1;
/** Le jour gardé sous le plafond (m). */
const SOUS_PLAFOND = 0.05;

const dist = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);

/** La hauteur d'un mur : la sienne propre, sinon celle de son niveau. */
export function hauteurDuMur(batiment, mur){
  if (mur.hauteurPropre) return mur.hauteurPropre;
  const n = (batiment.niveaux || []).find(x => x.id === mur.niveauId);
  return n ? n.hauteur : 2.8;
}

/** L'intervalle [s0, s1] qu'occupe l'ouverture le long de son mur, en mètres depuis `a`. */
export function intervalleDe(o, mur){
  const L = dist(mur.a, mur.b), c = o.le * L;
  return { s0: c - o.largeur / 2, s1: c + o.largeur / 2 };
}

/**
 * Où mettre une ouverture de largeur `largeur` dont le centre est demandé à la fraction `le` du mur :
 * le centre est ramené dans le mur (marges comprises). Rend `{ ok: true, le }`, ou `{ ok: false, le,
 * raison: 'large' | 'chevauche' }` (le `le` rendu reste celui où la dessiner, en rouge).
 */
export function placement(batiment, mur, le, largeur, sauf = null){
  const L = dist(mur.a, mur.b);
  const min = MARGE_OUVERTURE + largeur / 2, max = L - MARGE_OUVERTURE - largeur / 2;
  if (max < min) return { ok: false, le: 0.5, raison: 'large' };
  const c = Math.min(max, Math.max(min, le * L));
  const s0 = c - largeur / 2, s1 = c + largeur / 2;
  const autre = (batiment.ouvertures || []).some(o => o.murId === mur.id && o.id !== sauf && (() => {
    const iv = intervalleDe(o, mur);
    return s0 < iv.s1 + MARGE_OUVERTURE && s1 > iv.s0 - MARGE_OUVERTURE;
  })());
  return autre ? { ok: false, le: c / L, raison: 'chevauche' } : { ok: true, le: c / L };
}

/** Les réglages d'une ouverture neuve du type `type`. */
export function reglagesParDefaut(type){
  return { type, ...DEFAUTS_OUVERTURE[TYPES_D_OUVERTURE.includes(type) ? type : 'porte'], sens: 1, charniere: 'debut' };
}

/** La hauteur ramenée sous le plafond du mur ; null si même l'allège n'y tient pas. */
function ajusterHauteur(batiment, mur, y, hauteur){
  const H = hauteurDuMur(batiment, mur);
  if (y > H - SOUS_PLAFOND - 0.2) return null;
  return Math.min(hauteur, H - SOUS_PLAFOND - y);
}

function nouvelId(liste){
  const pris = new Set(liste.map(o => o.id));
  let n = liste.length;
  while (pris.has('o' + n)) n++;
  return 'o' + n;
}

/**
 * Pose une ouverture sur le mur `murId`, centrée à la fraction `le`, avec les réglages `r` (type,
 * dimensions, options). Rend `{ ouverture }` ou `{ erreur: 'mur' | 'large' | 'chevauche' | 'haute' }`.
 */
export function ajouterOuverture(batiment, murId, le, r){
  const mur = (batiment.murs || []).find(m => m.id === murId);
  if (!mur) return { erreur: 'mur' };
  const p = placement(batiment, mur, le, r.largeur);
  if (!p.ok) return { erreur: p.raison };
  const hauteur = ajusterHauteur(batiment, mur, r.y, r.hauteur);
  if (hauteur == null) return { erreur: 'haute' };
  if (!batiment.ouvertures) batiment.ouvertures = [];
  const ouverture = { id: nouvelId(batiment.ouvertures), murId, ...reglagesParDefaut(r.type), ...r, le: p.le, hauteur };
  if (ouverture.type === 'passage') ouverture.battants = 0;
  batiment.ouvertures.push(ouverture);
  return { ouverture };
}

/** Fait glisser l'ouverture `id` le long de son mur, vers le point p (projeté). Rend vrai si elle a bougé. */
export function deplacerOuverture(batiment, id, p){
  const o = (batiment.ouvertures || []).find(x => x.id === id);
  const mur = o && batiment.murs.find(m => m.id === o.murId);
  if (!mur) return false;
  const L = dist(mur.a, mur.b) || 1;
  const t = ((p.x - mur.a.x) * (mur.b.x - mur.a.x) + (p.z - mur.a.z) * (mur.b.z - mur.a.z)) / (L * L);
  const r = placement(batiment, mur, t, o.largeur, id);
  if (!r.ok || Math.abs(r.le - o.le) < 1e-9) return false;
  o.le = r.le;
  return true;
}

/**
 * Retouche l'ouverture `id` (type, dimensions, options). Changer de TYPE reprend les dimensions et
 * les options de ce type ; la position, le sens et la charnière restent. Refusé si elle ne tient plus :
 * rien n'est changé. Rend `{ ok: true }` ou `{ erreur }`.
 */
export function modifierOuverture(batiment, id, changements){
  const o = (batiment.ouvertures || []).find(x => x.id === id);
  const mur = o && batiment.murs.find(m => m.id === o.murId);
  if (!mur) return { erreur: 'mur' };
  const neuf = changements.type && changements.type !== o.type
    ? { ...o, ...reglagesParDefaut(changements.type), ...changements, le: o.le, sens: o.sens, charniere: o.charniere }
    : { ...o, ...changements };
  if (neuf.type === 'passage') neuf.battants = 0;
  else if (!neuf.battants) neuf.battants = 1;
  const p = placement(batiment, mur, neuf.le, neuf.largeur, id);
  if (!p.ok) return { erreur: p.raison };
  const hauteur = ajusterHauteur(batiment, mur, neuf.y, neuf.hauteur);
  if (hauteur == null) return { erreur: 'haute' };
  Object.assign(o, neuf, { le: p.le, hauteur });
  return { ok: true };
}

/** L'ouverture du niveau sous p (dans l'épaisseur de son mur, sur sa largeur), ou null. */
export function ouvertureSous(batiment, niveauId, p, tol){
  for (const o of batiment.ouvertures || []) {
    const mur = batiment.murs.find(m => m.id === o.murId && m.niveauId === niveauId);
    if (!mur) continue;
    const L = dist(mur.a, mur.b) || 1;
    const u = { x: (mur.b.x - mur.a.x) / L, z: (mur.b.z - mur.a.z) / L };
    const s = (p.x - mur.a.x) * u.x + (p.z - mur.a.z) * u.z;
    const d = Math.abs((p.x - mur.a.x) * -u.z + (p.z - mur.a.z) * u.x);
    const iv = intervalleDe(o, mur);
    if (s >= iv.s0 - tol && s <= iv.s1 + tol && d <= mur.epaisseur / 2 + tol) return o.id;
  }
  return null;
}

/** Supprime une ouverture. */
export function supprimerOuverture(batiment, id){
  batiment.ouvertures = (batiment.ouvertures || []).filter(o => o.id !== id);
}

/** Le pas de la molette sur une ouverture choisie, en mètres (5 cm ; 1 cm avec Maj). */
export const PAS_ALLEGE = 0.05;

/**
 * Monte ou descend l'ouverture `id` de `delta` mètres (la molette, demandé) : son allège reste entre
 * le sol et ce que le plafond laisse au-dessus d'elle, sa hauteur ne change pas. Rend vrai si elle a
 * bougé.
 */
export function monterOuverture(batiment, id, delta){
  const o = (batiment.ouvertures || []).find(x => x.id === id);
  const mur = o && batiment.murs.find(m => m.id === o.murId);
  if (!mur) return false;
  const max = Math.max(0, hauteurDuMur(batiment, mur) - SOUS_PLAFOND - o.hauteur);
  const y = Math.round(Math.min(max, Math.max(0, o.y + delta)) * 1000) / 1000;
  if (Math.abs(y - o.y) < 1e-9) return false;
  o.y = y;
  return true;
}
