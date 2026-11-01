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
 * dessus.
 *
 * #454g, LES SOUS-SOLS : des niveaux d'élévation NÉGATIVE, sous le rez-de-chaussée. Le REZ-DE-CHAUSSÉE
 * est l'ancre : avec des sous-sols, il reste à l'élévation 0 (le Sol de la Scène) ; les niveaux du
 * dessus montent depuis lui, les sous-sols descendent (le plafond d'un sous-sol est le plancher du
 * niveau d'au-dessus). Leur NOMBRE se garde d'une opération à l'autre (`nbSousSols`) : ajouter un
 * étage, en retirer un, réordonner ne transforme pas un sous-sol en étage, ni l'inverse.
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

/** Combien de sous-sols (niveaux d'élévation négative). */
export function nbSousSols(b){
  return (b.niveaux || []).filter(n => n.elevation < -1e-9).length;
}

/** Ce niveau est-il un sous-sol ? */
export function estUnSousSol(n){
  return !!n && n.elevation < -1e-9;
}

/**
 * Recalcule les élévations. Sans sous-sol, à partir du plus bas (dont l'élévation est gardée) ; avec
 * `sousSols` sous-sols (par défaut, ceux d'aujourd'hui), à partir du rez-de-chaussée, le niveau de
 * rang `sousSols`, posé à 0 : les suivants montent, les sous-sols descendent. Rend le bâtiment.
 */
export function recalerNiveaux(b, sousSols = nbSousSols(b)){
  const t = niveauxTries(b);
  const k = Math.max(0, Math.min(sousSols, t.length - 1));
  if (k > 0) t[k].elevation = 0;
  for (let i = k + 1; i < t.length; i++) t[i].elevation = arrondi(t[i - 1].elevation + t[i - 1].hauteur + t[i].dalle);
  for (let i = k - 1; i >= 0; i--) t[i].elevation = arrondi(t[i + 1].elevation - t[i + 1].dalle - t[i].hauteur);
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
  const t = niveauxTries(b), haut = t[t.length - 1], sousSols = nbSousSols(b);
  const n = { id: nouvelId(b.niveaux, 'n'), nom: '', elevation: (haut ? haut.elevation : 0) + 1e6, hauteur: haut ? haut.hauteur : DEFAUTS_BATIMENT.hauteur, dalle: haut ? haut.dalle : DEFAUTS_BATIMENT.dalle };
  b.niveaux.push(n);
  recalerNiveaux(b, sousSols);
  n.nom = nomDuNiveauParDefaut(rang(b, n.id), traduire);
  return n;
}

/**
 * #454g : ajoute un SOUS-SOL VIDE sous le plus bas des niveaux, aux mêmes hauteur et dalle que lui.
 * Le rez-de-chaussée reste au Sol ; les niveaux qui portaient le nom par défaut de leur place le
 * gardent (un sous-sol de plus ne change pas les étages, mais « Sous-sol » devient « Sous-sol 2 »).
 * Rend le niveau.
 */
export function ajouterSousSol(b, traduire){
  const t = niveauxTries(b), bas = t[0], sousSols = nbSousSols(b);
  const zero0 = Math.max(0, t.findIndex(x => x.elevation >= 0));
  const defauts = new Set(t.map((x, k) => nomDuNiveauParDefaut(k - zero0, traduire)));
  const n = { id: nouvelId(b.niveaux, 'n'), nom: '', elevation: (bas ? bas.elevation : 0) - 1e6,
    hauteur: bas ? bas.hauteur : DEFAUTS_BATIMENT.hauteur, dalle: bas ? bas.dalle : DEFAUTS_BATIMENT.dalle };
  b.niveaux.push(n);
  recalerNiveaux(b, sousSols + 1);
  const t2 = niveauxTries(b), zero = Math.max(0, t2.findIndex(x => x.elevation >= 0));
  t2.forEach((x, k) => { if (x === n || (k < zero && defauts.has(x.nom))) x.nom = nomDuNiveauParDefaut(k - zero, traduire); });
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
  // Les noms par défaut de chaque place, AVANT l'insertion (signalé : deux « Étage 1 » après deux
  // duplications ; les niveaux qui montent d'une place gardaient l'ancien nom de leur place).
  const t0 = niveauxTries(b), zero0 = Math.max(0, t0.findIndex(x => x.elevation >= 0));
  const defauts = new Set(t0.map((n, k) => nomDuNiveauParDefaut(k - zero0, traduire)));
  // #454g : un sous-sol dupliqué en fait un de plus (la copie est entre lui et le rez-de-chaussée).
  const sousSols = nbSousSols(b) + (estUnSousSol(source) ? 1 : 0);
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
  recalerNiveaux(b, sousSols);
  // La copie, et chaque niveau qui portait le nom par défaut de sa place, prennent celui de leur
  // nouvelle place ; un nom choisi reste.
  const t = niveauxTries(b), zero = Math.max(0, t.findIndex(x => x.elevation >= 0));
  t.forEach((x, k) => { if (x === copie || defauts.has(x.nom)) x.nom = nomDuNiveauParDefaut(k - zero, traduire); });
  return copie;
}

/**
 * Supprime le niveau `id` et tout ce qu'il porte (murs, ouvertures, pièces, escaliers) ; les niveaux
 * du dessus descendent. Refusé pour le dernier niveau. Rend `{ ok: true }` ou `{ erreur: 'dernier' }`.
 */
export function supprimerNiveau(b, id, traduire = null){
  if ((b.niveaux || []).length <= 1) return { erreur: 'dernier' };
  // Les noms par défaut de chaque place, avant : un niveau qui change de place prend celui de la nouvelle.
  const t0 = niveauxTries(b), zero0 = Math.max(0, t0.findIndex(x => x.elevation >= 0));
  const defauts = traduire ? new Set(t0.map((x, k) => nomDuNiveauParDefaut(k - zero0, traduire))) : null;
  const murs = new Set(b.murs.filter(m => m.niveauId === id).map(m => m.id));
  b.murs = b.murs.filter(m => !murs.has(m.id));
  b.ouvertures = (b.ouvertures || []).filter(o => !murs.has(o.murId));
  b.pieces = (b.pieces || []).filter(p => p.niveauId !== id);
  b.escaliers = (b.escaliers || []).filter(e => e.niveauId !== id);
  const t = niveauxTries(b);
  const etaitLePlusBas = t[0] && t[0].id === id;
  // #454g : un sous-sol de moins s'il en était un ; le rez-de-chaussée supprimé, le suivant le devient.
  const sousSols = nbSousSols(b) - (estUnSousSol(t.find(n => n.id === id)) ? 1 : 0);
  b.niveaux = b.niveaux.filter(n => n.id !== id);
  // Le plus bas supprimé (sans sous-sol) : le suivant prend sa place au sol.
  if (etaitLePlusBas && !sousSols) niveauxTries(b)[0].elevation = Math.max(0, t[0].elevation);
  recalerNiveaux(b, sousSols);
  if (defauts) {
    const t2 = niveauxTries(b), zero = Math.max(0, t2.findIndex(x => x.elevation >= 0));
    t2.forEach((x, k) => { if (defauts.has(x.nom)) x.nom = nomDuNiveauParDefaut(k - zero, traduire); });
  }
  return { ok: true };
}

/** Change le nom, la hauteur sous plafond ou l'épaisseur du plancher d'un niveau ; les suivants suivent. */
export function modifierNiveau(b, id, { nom, hauteur, dalle } = {}){
  const n = (b.niveaux || []).find(x => x.id === id);
  if (!n) return false;
  if (typeof nom === 'string' && nom.trim()) n.nom = nom.trim();
  if (Number.isFinite(hauteur)) n.hauteur = arrondi(borne(hauteur, BORNES_BATIMENT.hauteur));
  if (Number.isFinite(dalle)) n.dalle = arrondi(borne(dalle, BORNES_BATIMENT.dalle));
  recalerNiveaux(b);   // un sous-sol plus haut descend d'autant ; le rez-de-chaussée ne bouge pas
  return true;
}

/**
 * L'épaisseur de la dalle qui COUVRE un niveau : le plancher du niveau du dessus s'il y en a un, sinon
 * le toit plat du dernier niveau (en attendant les toits de #458), de l'épaisseur de son propre
 * plancher.
 */
export function epaisseurDuDessus(b, id){
  const n = (b.niveaux || []).find(x => x.id === id);
  const dessus = niveauDessus(b, id);
  return dessus ? dessus.dalle : (n ? n.dalle : DEFAUTS_BATIMENT.dalle);
}

/**
 * La hauteur à donner aux murs d'un niveau : jusqu'au DESSUS de la dalle qui le couvre (le plancher
 * du niveau du dessus, ou le toit plat du dernier) : la façade est continue, sans joint entre deux
 * étages, et un toit plat ne déborde pas des murs.
 */
export function hauteurDesMursDuNiveau(b, id){
  const n = (b.niveaux || []).find(x => x.id === id);
  if (!n) return DEFAUTS_BATIMENT.hauteur;
  return arrondi(n.hauteur + epaisseurDuDessus(b, id));
}

/**
 * Change la place d'un niveau dans la pile (demandé : glisser-déposer dans la liste des niveaux).
 * `rang` : sa nouvelle place, 0 = le plus bas. Les élévations sont refaites depuis le bas (le plus bas
 * garde l'élévation qu'avait le plus bas) ; un niveau qui portait un nom par défaut (« Étage 2 »…)
 * prend celui de sa nouvelle place, un nom choisi reste. Rend vrai si l'ordre a changé.
 */
export function deplacerNiveau(b, id, rang, traduire){
  const t = niveauxTries(b);
  const i = t.findIndex(n => n.id === id);
  const cible = Math.max(0, Math.min(t.length - 1, rang));
  if (i < 0 || i === cible) return false;
  const base = t[0].elevation, sousSols = nbSousSols(b);
  const defauts = new Set(t.map((n, k) => nomDuNiveauParDefaut(k - Math.max(0, t.findIndex(x => x.elevation >= 0)), traduire)));
  const [n] = t.splice(i, 1);
  t.splice(cible, 0, n);
  // Le nouvel ordre se fige en élévations factices (croissantes), puis se recale : le nombre de
  // sous-sols ne change pas (#454g), seul ce qui est à chaque place.
  t.forEach((x, k) => { x.elevation = base + k; });
  b.niveaux = t;
  recalerNiveaux(b, sousSols);
  if (!sousSols) { const t1 = niveauxTries(b); t1[0].elevation = base; recalerNiveaux(b, 0); }
  const t2 = niveauxTries(b), zero = Math.max(0, t2.findIndex(x => x.elevation >= 0));
  t2.forEach((x, k) => { if (defauts.has(x.nom)) x.nom = nomDuNiveauParDefaut(k - zero, traduire); });
  return true;
}
