/**
 * @file batiment-niveaux.js
 * LES NIVEAUX d'un bâtiment (#454b). Fonctions PURES.
 *
 * LA CONVENTION, en mètres : un niveau commence à son `elevation` (le dessus de son plancher) et a
 * `hauteur` de hauteur sous plafond ; son plancher a `dalle` d'épaisseur, SOUS son élévation. Le
 * niveau du dessus commence donc à `elevation + hauteur + dalle(du dessus)` : le plancher d'un étage
 * est le plafond du niveau d'en dessous, une seule dalle entre les deux. Le plus bas des niveaux n'a
 * pas de dalle dessinée : il est posé sur le Sol.
 *
 * Les élévations ne se règlent pas à la main : elles se DÉDUISENT des hauteurs et des dalles
 * (`recalerNiveaux`), si bien que changer la hauteur d'un niveau monte ou descend tous ceux du
 * dessus. Les sous-sols (élévation négative) viendront avec #454g.
 */
import { BORNES_BATIMENT, DEFAUTS_BATIMENT, nomDuNiveauParDefaut } from './batiment.js';

const borne = (v, [min, max]) => Math.min(max, Math.max(min, v));
const arrondi = (v) => Math.round(v * 1000) / 1000;

/** Les niveaux, du plus bas au plus haut. */
export function niveauxTries(b){
  return (b.niveaux || []).slice().sort((x, y) => x.elevation - y.elevation);
}

/** Le niveau juste en dessous de `id`, ou null. */
export function niveauDessous(b, id){
  const t = niveauxTries(b), i = t.findIndex(n => n.id === id);
  return i > 0 ? t[i - 1] : null;
}

/** Le niveau juste au-dessus de `id`, ou null. */
export function niveauDessus(b, id){
  const t = niveauxTries(b), i = t.findIndex(n => n.id === id);
  return i >= 0 && i < t.length - 1 ? t[i + 1] : null;
}

/** Recalcule les élévations à partir du plus bas (dont l'élévation est gardée). Rend le bâtiment. */
export function recalerNiveaux(b){
  const t = niveauxTries(b);
  for (let i = 1; i < t.length; i++) t[i].elevation = arrondi(t[i - 1].elevation + t[i - 1].hauteur + t[i].dalle);
  b.niveaux = t;
  return b;
}

function nouvelId(liste, prefixe){
  const pris = new Set(liste.map(e => e.id));
  let n = liste.length;
  while (pris.has(prefixe + n)) n++;
  return prefixe + n;
}

/** Le rang d'un niveau (0 = le rez-de-chaussée, celui d'élévation 0 ou le plus bas au-dessus). */
function rang(b, id){
  const t = niveauxTries(b);
  const base = Math.max(0, t.findIndex(n => n.elevation >= 0));
  return t.findIndex(n => n.id === id) - base;
}

/** Ajoute un étage VIDE au-dessus du plus haut, aux mêmes hauteur et dalle que lui. Rend le niveau. */
export function ajouterEtage(b, traduire){
  const t = niveauxTries(b), haut = t[t.length - 1];
  const n = { id: nouvelId(b.niveaux, 'n'), nom: '', elevation: (haut ? haut.elevation : 0) + 1e6, hauteur: haut ? haut.hauteur : DEFAUTS_BATIMENT.hauteur, dalle: haut ? haut.dalle : DEFAUTS_BATIMENT.dalle };
  b.niveaux.push(n);
  recalerNiveaux(b);
  n.nom = nomDuNiveauParDefaut(rang(b, n.id), traduire);
  return n;
}

/**
 * Duplique le niveau `id` JUSTE AU-DESSUS de lui (les niveaux du dessus montent d'autant) : ses murs,
 * leurs ouvertures, ses pièces (mêmes noms, mêmes repères), avec de nouveaux identifiants. Rend le
 * nouveau niveau, ou null.
 */
export function dupliquerNiveau(b, id, traduire){
  const source = (b.niveaux || []).find(n => n.id === id);
  if (!source) return null;
  const copie = { ...source, id: nouvelId(b.niveaux, 'n'), nom: '' };
  // Placé entre la source et celui du dessus ; recalerNiveaux remonte les suivants.
  const dessus = niveauDessus(b, id);
  copie.elevation = dessus ? (source.elevation + dessus.elevation) / 2 : source.elevation + source.hauteur + source.dalle;
  b.niveaux.push(copie);
  const ids = new Map();
  for (const m of b.murs.filter(x => x.niveauId === id)) {
    const nid = nouvelId(b.murs, 'm');
    ids.set(m.id, nid);
    b.murs.push({ ...m, id: nid, niveauId: copie.id, a: { ...m.a }, b: { ...m.b }, revetement: { ...m.revetement } });
  }
  for (const o of (b.ouvertures || []).filter(x => ids.has(x.murId))) {
    b.ouvertures.push({ ...o, id: nouvelId(b.ouvertures, 'o'), murId: ids.get(o.murId) });
  }
  for (const p of (b.pieces || []).filter(x => x.niveauId === id)) {
    b.pieces.push({ ...p, id: nouvelId(b.pieces, 'p'), niveauId: copie.id, repere: p.repere ? { ...p.repere } : p.repere });
  }
  recalerNiveaux(b);
  copie.nom = nomDuNiveauParDefaut(rang(b, copie.id), traduire);
  return copie;
}

/**
 * Supprime le niveau `id` et tout ce qu'il porte (murs, ouvertures, pièces, escaliers) ; les niveaux
 * du dessus descendent. Refusé pour le dernier niveau. Rend `{ ok: true }` ou `{ erreur: 'dernier' }`.
 */
export function supprimerNiveau(b, id){
  if ((b.niveaux || []).length <= 1) return { erreur: 'dernier' };
  const murs = new Set(b.murs.filter(m => m.niveauId === id).map(m => m.id));
  b.murs = b.murs.filter(m => !murs.has(m.id));
  b.ouvertures = (b.ouvertures || []).filter(o => !murs.has(o.murId));
  b.pieces = (b.pieces || []).filter(p => p.niveauId !== id);
  b.escaliers = (b.escaliers || []).filter(e => e.niveauId !== id);
  const t = niveauxTries(b);
  const etaitLePlusBas = t[0] && t[0].id === id;
  b.niveaux = b.niveaux.filter(n => n.id !== id);
  // Le plus bas supprimé : le suivant prend sa place au sol.
  if (etaitLePlusBas) niveauxTries(b)[0].elevation = t[0].elevation;
  recalerNiveaux(b);
  return { ok: true };
}

/** Change le nom, la hauteur sous plafond ou l'épaisseur du plancher d'un niveau ; les suivants suivent. */
export function modifierNiveau(b, id, { nom, hauteur, dalle } = {}){
  const n = (b.niveaux || []).find(x => x.id === id);
  if (!n) return false;
  if (typeof nom === 'string' && nom.trim()) n.nom = nom.trim();
  if (Number.isFinite(hauteur)) n.hauteur = arrondi(borne(hauteur, BORNES_BATIMENT.hauteur));
  if (Number.isFinite(dalle)) n.dalle = arrondi(borne(dalle, BORNES_BATIMENT.dalle));
  recalerNiveaux(b);
  return true;
}

/**
 * La hauteur à donner aux murs d'un niveau : jusqu'au DESSOUS du plancher du dessus (s'il y en a
 * un, ses murs traversent son épaisseur pour que la façade soit continue), sinon sa hauteur.
 */
export function hauteurDesMursDuNiveau(b, id){
  const n = (b.niveaux || []).find(x => x.id === id);
  if (!n) return DEFAUTS_BATIMENT.hauteur;
  const dessus = niveauDessus(b, id);
  return dessus ? arrondi(dessus.elevation - n.elevation) : n.hauteur;
}
