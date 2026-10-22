/**
 * @file formats.js
 * Les FORMATS d'un Projet (#453, décidé avec Valentin le 22 octobre 2026). Fonctions PURES : elles
 * lisent et modifient la liste et les Tomes passés en argument, rien d'autre.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * LES RÈGLES
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * - Les formats appartiennent au PROJET (champ ajouté `formats`) : tous ses Tomes y puisent, et un
 *   Projet envoyé à quelqu'un emporte les siens.
 * - Un format se CRÉE (nom, largeur, hauteur, en mm ou en px), se RENOMME, et c'est tout : ses
 *   dimensions ne se modifient pas (les Cases des Tomes qui l'utilisent se déplaceraient).
 * - Un format UTILISÉ par un Tome ne se supprime pas ; le dernier format non plus.
 * - Les quatre formats intégrés (FORMATS, constants.js) ne sont que la liste de départ : renommables
 *   et supprimables comme les autres.
 *
 * Chaque Tome garde sa COPIE des dimensions (`w`, `h`, `scale`) à côté de la clé `format` : c'est ce
 * que lisent le dessin et les versions antérieures de l'application. Comme un format ne change pas de
 * dimensions, la copie ne peut pas se désaccorder, sauf dans un fichier d'avant #453 (un Tome passé
 * en « Format personnalisé » à d'autres dimensions par l'import d'une planche) : `normaliserFormats`
 * lui crée alors le format qui lui manque.
 *
 * Une entrée : `{ key, nom?, unite: 'mm'|'px', largeur, hauteur, w, h, scale, mmW }`. `nom` est
 * absent tant qu'un format intégré n'a pas été renommé : il s'affiche alors dans la langue courante.
 * `w`/`h` : la taille de la Planche à l'écran ; `scale` : le multiplicateur de l'export ; `mmW` : la
 * largeur imprimée, d'où les mm de la section Dimensions d'une Case.
 */
import { FORMATS } from './constants.js';
import { libelleTable3D } from './utils.js';

/** La hauteur à l'écran d'un format en mm (celle du Franco-Belge : 2,5 px par mm). */
const COTE_MM = 725;
/** Au-delà, un format en px se dessine réduit, et l'export le rend à sa taille par `scale`. */
const COTE_PX_MAX = 1000;
/** Les bornes d'une saisie, et l'allongement maximal (un bandeau de webtoon reste possible). */
export const BORNES_FORMAT = { mm: [10, 2000], px: [50, 20000], allongement: 20 };

const champsDimensions = f => ({ unite: f.unite, largeur: f.largeur, hauteur: f.hauteur, w: f.w, h: f.h, scale: f.scale, mmW: f.mmW });

/** La liste de départ d'un Projet : une copie des formats intégrés. */
export function formatsParDefaut(){
  return FORMATS.map(f => ({ key: f.key, ...champsDimensions(f) }));
}

/** Le format de clé `key`, ou undefined. */
export function trouverFormat(formats, key){
  return (formats || []).find(f => f && f.key === key);
}

/** Le nom d'un format, sans ses dimensions. */
export function nomDuFormat(f, traduire){
  if (!f) return '';
  if (typeof f.nom === 'string' && f.nom.trim()) return f.nom.trim();
  const integre = FORMATS.find(x => x.key === f.key);
  return integre ? libelleTable3D(integre, traduire).split(' (')[0] : String(f.key);
}

const nombre = v => String(Math.round(Number(v) * 10) / 10);

/** « Nom (220×290mm) », comme les libellés d'avant #453. */
export function libelleDuFormat(f, traduire){
  if (!f) return '';
  return `${nomDuFormat(f, traduire)} (${nombre(f.largeur)}×${nombre(f.hauteur)}${f.unite === 'mm' ? 'mm' : 'px'})`;
}

/** Combien de px de Planche pour un mm imprimé. Sans format : l'équivalence écran, 96 dpi. */
export function pxParMm(f){
  return f && f.w > 0 && f.mmW > 0 ? f.w / f.mmW : 96 / 25.4;
}

/**
 * Les dimensions d'un format saisi. En mm : 725 px pour le plus grand côté, export ×4. En px : la
 * taille saisie, réduite à l'écran au besoin (`scale`) pour que l'export la rende telle quelle.
 * Rend `{ w, h, scale, mmW }`, ou `{ erreur }` ('dimensions' ou 'allongement').
 */
export function dimensionsDuFormat(largeur, hauteur, unite){
  const l = Number(largeur), ht = Number(hauteur);
  const [min, max] = BORNES_FORMAT[unite === 'mm' ? 'mm' : 'px'];
  if (![l, ht].every(v => Number.isFinite(v) && v >= min && v <= max)) return { erreur: 'dimensions' };
  if (Math.max(l, ht) / Math.min(l, ht) > BORNES_FORMAT.allongement) return { erreur: 'allongement' };
  if (unite === 'mm') {
    const w = l >= ht ? COTE_MM : Math.round(COTE_MM * l / ht);
    const h = l >= ht ? Math.round(COTE_MM * ht / l) : COTE_MM;
    return { w, h, scale: 4, mmW: l };
  }
  const scale = Math.max(1, Math.ceil(Math.max(l, ht) / COTE_PX_MAX));
  const w = Math.max(1, Math.round(l / scale)), h = Math.max(1, Math.round(ht / scale));
  return { w, h, scale, mmW: w * 25.4 / 96 };
}

function nouvelleCle(formats){
  const prises = new Set((formats || []).map(f => f.key));
  let n = 1;
  while (prises.has('f' + n)) n++;
  return 'f' + n;
}

const cleDeNom = s => String(s || '').trim().toLocaleLowerCase('fr');

/** Le nom est-il libre (aucun autre format ne s'affiche ainsi) ? */
function nomLibre(formats, nom, traduire, saufCle){
  const c = cleDeNom(nom);
  return !(formats || []).some(f => f.key !== saufCle && cleDeNom(nomDuFormat(f, traduire)) === c);
}

/** « Base », sinon « Base 2 », « Base 3 »… le premier libre. */
function nomDisponible(formats, base, traduire){
  if (nomLibre(formats, base, traduire)) return base;
  let n = 2;
  while (!nomLibre(formats, `${base} ${n}`, traduire)) n++;
  return `${base} ${n}`;
}

/**
 * Ajoute un format à la liste. Rend `{ format }` ou `{ erreur }` : 'nom' (vide), 'doublon' (déjà
 * pris), 'dimensions', 'allongement'.
 */
export function creerFormat(formats, { nom, largeur, hauteur, unite }, traduire){
  const n = String(nom || '').trim();
  if (!n) return { erreur: 'nom' };
  if (!nomLibre(formats, n, traduire)) return { erreur: 'doublon' };
  const u = unite === 'mm' ? 'mm' : 'px';
  const d = dimensionsDuFormat(largeur, hauteur, u);
  if (d.erreur) return d;
  const format = { key: nouvelleCle(formats), nom: n, unite: u, largeur: Number(largeur), hauteur: Number(hauteur), ...d };
  formats.push(format);
  return { format };
}

/** Renomme un format. Rend `{ ok: true }` ou `{ erreur }` : 'inconnu', 'nom', 'doublon'. */
export function renommerFormat(formats, key, nom, traduire){
  const f = trouverFormat(formats, key);
  if (!f) return { erreur: 'inconnu' };
  const n = String(nom || '').trim();
  if (!n) return { erreur: 'nom' };
  if (!nomLibre(formats, n, traduire, key)) return { erreur: 'doublon' };
  f.nom = n;
  return { ok: true };
}

/** Les Tomes qui utilisent le format `key`. */
export function tomesDuFormat(tomes, key){
  return (tomes || []).filter(t => t && t.format === key);
}

/**
 * Peut-on supprimer ce format ? `{ ok: true }`, ou `{ erreur: 'utilise', tomes }` (les Tomes qui
 * l'utilisent), ou `{ erreur: 'dernier' }`, ou `{ erreur: 'inconnu' }`.
 */
export function suppressionPossible(formats, key, tomes){
  if (!trouverFormat(formats, key)) return { erreur: 'inconnu' };
  const utilisateurs = tomesDuFormat(tomes, key);
  if (utilisateurs.length) return { erreur: 'utilise', tomes: utilisateurs };
  if (formats.length <= 1) return { erreur: 'dernier' };
  return { ok: true };
}

/** Supprime le format si c'est possible ; rend la même réponse que `suppressionPossible`. */
export function supprimerFormat(formats, key, tomes){
  const r = suppressionPossible(formats, key, tomes);
  if (r.ok) formats.splice(formats.findIndex(f => f.key === key), 1);
  return r;
}

/** Donne au Tome le format `f` : sa clé, et la copie de ses dimensions. */
export function appliquerFormat(tome, f){
  tome.format = f.key; tome.w = f.w; tome.h = f.h; tome.scale = f.scale;
  return tome;
}

/**
 * Le format de la liste aux dimensions `w`×`h` (à l'écran), sinon un NOUVEAU, en px, nommé d'après
 * `base` (« Format personnalisé », « Format personnalisé 2 »…). Rend le format.
 */
export function formatAuxDimensions(formats, w, h, scale, base, traduire){
  const existant = (formats || []).find(f => f.w === w && f.h === h);
  if (existant) return existant;
  const s = Number(scale) > 0 ? Number(scale) : 3;
  const format = {
    key: nouvelleCle(formats), nom: nomDisponible(formats, base, traduire), unite: 'px',
    largeur: Math.round(w * s), hauteur: Math.round(h * s), w, h, scale: s, mmW: w * 25.4 / 96,
  };
  formats.push(format);
  return format;
}

function formatLisible(f){
  return f && typeof f.key === 'string' && f.key && [f.w, f.h, f.scale, f.mmW, f.largeur, f.hauteur].every(v => Number.isFinite(Number(v)) && Number(v) > 0);
}

/**
 * La liste des formats d'un Projet lu : la sienne si elle existe (les entrées illisibles écartées),
 * sinon celle de départ (un Projet d'avant #453). Puis chaque Tome dont la clé est inconnue, ou dont
 * les dimensions ne sont pas celles de son format, reçoit le format qui lui correspond (un existant
 * aux mêmes dimensions, sinon un nouveau) : seule sa CLÉ change, jamais ses dimensions.
 */
export function normaliserFormats(lus, tomes, traduire){
  const formats = Array.isArray(lus)
    ? lus.filter(formatLisible).map(f => ({ ...f, unite: f.unite === 'mm' ? 'mm' : 'px' }))
    : formatsParDefaut();
  if (!formats.length) formats.push(...formatsParDefaut());
  const base = traduire ? traduire('Custom format', 'Format personnalisé') : 'Format personnalisé';
  (tomes || []).forEach(t => {
    if (!t) return;
    const f = trouverFormat(formats, t.format);
    if (f && f.w === t.w && f.h === t.h) return;
    if (!(Number(t.w) > 0 && Number(t.h) > 0)) { if (!f) appliquerFormat(t, formats[0]); return; }
    t.format = formatAuxDimensions(formats, t.w, t.h, t.scale, base, traduire).key;
  });
  return formats;
}
