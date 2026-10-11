/**
 * @file chapitres.js
 * Les CHAPITRES d'un Tome, entre le Tome et ses Planches (demandé). Fonctions PURES : elles lisent
 * et modifient un Tome passé en argument, rien d'autre.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * LE MODÈLE, ET POURQUOI IL NE TOUCHE PAS À `tome.pages`
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Décisions de Valentin : les chapitres sont FACULTATIFS, et la numérotation des Planches reste
 * CONTINUE dans le Tome. D'où deux champs ajoutés, rien de renommé (cf. docs/en/persisted-data.md) :
 *
 *   tome.chapitres = [{ id, nom }]   l'ordre des chapitres
 *   page.chapitreId                  le chapitre d'une Planche ; absent = directement sous le Tome
 *
 * `tome.pages` reste la liste à plat qu'il a toujours été : son ordre EST la numérotation, et tout le
 * reste de l'application (navigation, exports, index courant) continue de le lire sans rien savoir
 * des chapitres. Un fichier écrit ici reste lisible par une version qui les ignore : elle verra les
 * mêmes Planches, dans le même ordre.
 *
 * L'INVARIANT : les Planches d'un même chapitre sont CONTIGUËS, les chapitres dans l'ordre de
 * `tome.chapitres`, et les Planches sans chapitre EN TÊTE (comme un prologue). `normaliserChapitres`
 * le rétablit après chaque opération ; sans lui, une Planche « du chapitre 2 » numérotée entre deux
 * Planches du chapitre 1 ferait mentir l'arbre ou la numérotation.
 */

/** Un identifiant de chapitre, unique dans le Tome. */
function nouvelId(tome){
  const pris = new Set((tome.chapitres || []).map(c => c.id));
  let n = (tome.chapitres || []).length + 1;
  while (pris.has('ch' + n)) n++;
  return 'ch' + n;
}

/** Le nom par défaut du prochain chapitre : « Chapitre N », N jamais repris tant qu'il existe. */
export function nomParDefautDuChapitre(tome, mot = 'Chapitre'){
  let max = 0;
  for (const c of tome.chapitres || []) {
    const m = new RegExp('^' + mot + '\\s+(\\d+)$', 'i').exec(String(c.nom || '').trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${mot} ${max + 1}`;
}

/**
 * Rétablit l'invariant : chapitres inconnus oubliés, Planches sans chapitre en tête, puis chaque
 * chapitre dans son ordre. Le tri est STABLE : l'ordre relatif des Planches d'un même groupe ne
 * bouge pas. Rend le Tome.
 */
export function normaliserChapitres(tome){
  if (!tome) return tome;
  const chapitres = Array.isArray(tome.chapitres) ? tome.chapitres.filter(c => c && c.id) : [];
  if (!chapitres.length) {
    // Aucun chapitre : on n'ajoute aucun champ (un Tome sans chapitre reste tel qu'il était).
    if (tome.chapitres !== undefined) tome.chapitres = [];
    (tome.pages || []).forEach(p => { if (p && p.chapitreId !== undefined) delete p.chapitreId; });
    return tome;
  }
  tome.chapitres = chapitres;
  const rang = new Map(chapitres.map((c, i) => [c.id, i + 1]));
  (tome.pages || []).forEach(p => { if (p && p.chapitreId !== undefined && !rang.has(p.chapitreId)) delete p.chapitreId; });
  const pages = (tome.pages || []).map((p, i) => ({ p, i, r: (p && rang.get(p.chapitreId)) || 0 }));
  pages.sort((a, b) => a.r - b.r || a.i - b.i);
  tome.pages = pages.map(x => x.p);
  return tome;
}

/**
 * Ce que l'arbre affiche : un groupe pour les Planches sans chapitre (s'il y en a), puis un par
 * chapitre, VIDE compris. Chaque Planche y garde son index dans `tome.pages` (sa numérotation).
 */
export function segmentsDuTome(tome){
  const pages = (tome && tome.pages) || [];
  const chapitres = (tome && tome.chapitres) || [];
  const sans = [];
  const parChapitre = new Map(chapitres.map(c => [c.id, []]));
  pages.forEach((page, index) => {
    const liste = page && page.chapitreId && parChapitre.get(page.chapitreId);
    (liste || sans).push({ page, index });
  });
  const segments = [];
  if (sans.length || !chapitres.length) segments.push({ chapitre: null, pages: sans });
  chapitres.forEach(c => segments.push({ chapitre: c, pages: parChapitre.get(c.id) }));
  return segments;
}

/** Crée un chapitre à la fin, vide. Rend le chapitre. */
export function creerChapitre(tome, nom){
  if (!Array.isArray(tome.chapitres)) tome.chapitres = [];
  const ch = { id: nouvelId(tome), nom: String(nom || '').trim() || nomParDefautDuChapitre(tome) };
  tome.chapitres.push(ch);
  return ch;
}

/** Renomme un chapitre. Rend false si le nom est vide ou le chapitre inconnu. */
export function renommerChapitre(tome, id, nom){
  const ch = (tome.chapitres || []).find(c => c.id === id);
  const propre = String(nom || '').trim();
  if (!ch || !propre) return false;
  ch.nom = propre;
  return true;
}

/**
 * Supprime un chapitre. SES PLANCHES NE SONT PAS SUPPRIMÉES : elles remontent directement sous le
 * Tome (demandé). Rend le nombre de Planches concernées.
 */
export function supprimerChapitre(tome, id){
  const avant = (tome.chapitres || []).length;
  tome.chapitres = (tome.chapitres || []).filter(c => c.id !== id);
  if (tome.chapitres.length === avant) return 0;
  let n = 0;
  (tome.pages || []).forEach(p => { if (p && p.chapitreId === id) { delete p.chapitreId; n++; } });
  normaliserChapitres(tome);
  return n;
}

/** Place un chapitre à la position `versIndex` parmi les chapitres (ses Planches le suivent). */
export function deplacerChapitre(tome, id, versIndex){
  const liste = tome.chapitres || [];
  const de = liste.findIndex(c => c.id === id);
  if (de < 0) return false;
  const [ch] = liste.splice(de, 1);
  liste.splice(Math.max(0, Math.min(liste.length, versIndex)), 0, ch);
  normaliserChapitres(tome);
  return true;
}

/**
 * Déplace une Planche : dans le chapitre `chapitreId` (null = sous le Tome), juste avant la Planche
 * `avantPageId` si elle est donnée (et dans ce même groupe), sinon à la fin du groupe.
 */
export function deplacerPlanche(tome, pageId, { chapitreId = null, avantPageId = null } = {}){
  const pages = tome.pages || [];
  const de = pages.findIndex(p => p && p.id === pageId);
  if (de < 0) return false;
  if (chapitreId && !(tome.chapitres || []).some(c => c.id === chapitreId)) return false;
  const [page] = pages.splice(de, 1);
  if (chapitreId) page.chapitreId = chapitreId; else delete page.chapitreId;
  const memeGroupe = (p) => (p.chapitreId || null) === (chapitreId || null);
  let ou = avantPageId ? pages.findIndex(p => p && p.id === avantPageId && memeGroupe(p)) : -1;
  if (ou < 0) {
    // À la fin du groupe : après sa dernière Planche ; groupe vide, la normalisation le placera.
    let dernier = -1;
    pages.forEach((p, i) => { if (memeGroupe(p)) dernier = i; });
    ou = dernier >= 0 ? dernier + 1 : pages.length;
  }
  pages.splice(ou, 0, page);
  normaliserChapitres(tome);
  return true;
}

/** Les index (dans `tome.pages`) des Planches d'un chapitre, dans l'ordre. */
export function indexDuChapitre(tome, id){
  const out = [];
  ((tome && tome.pages) || []).forEach((p, i) => { if (p && p.chapitreId === id) out.push(i); });
  return out;
}

/** Le chapitre où ranger une Planche AJOUTÉE à la fin du Tome : le dernier, s'il y en a. */
export function chapitrePourNouvellePlanche(tome){
  const liste = (tome && tome.chapitres) || [];
  return liste.length ? liste[liste.length - 1].id : null;
}
