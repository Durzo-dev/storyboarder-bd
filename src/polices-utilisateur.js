/**
 * @file polices-utilisateur.js
 * #423 : les polices de l'UTILISATEUR, côté interface. Ce module tient la liste lue par le pont
 * (`fonts:list`), charge chaque fichier dans le navigateur (FontFace) pour que les Bulles puissent
 * s'en servir, et répond aux deux questions que le reste de l'application se pose sur une police,
 * qu'elle soit intégrée ou importée :
 *
 *   policeADessiner(nom)     le nom à dessiner pour un nom lu dans une Bulle (renommages suivis,
 *                            puis remplaçantes des polices intégrées retirées) ;
 *   variantesDeLaPolice(nom) son gras et son italique, 'vrai' ou 'simule'.
 *
 * Les décisions pures (descripteurs FontFace, renommages, jeux de caractères) sont exportées et
 * testées sous Node ; le chargement touche `document.fonts`, hors de portée des tests.
 */

import { POLICES_BULLES, USAGES_POLICES, policeDeBulle, variantesDePolice } from './constants.js';

/** Les familles importées : { nom, fichiers: [{ fichier, graisse, italique, graisses }], gras, italique, licence, url, copyright, auteur, droits }. */
let familles = [];
let renommages = {};
/** Les usages (comme les tags du store) : null tant que l'utilisateur n'y a jamais touché. */
let usages = null;
let usagesDesPolices = {};
/** Les FontFace ajoutées, pour pouvoir les retirer au rechargement. */
let chargees = [];

/** Les noms des polices intégrées, qu'une police importée ne peut pas prendre. */
export const NOMS_INTEGRES = POLICES_BULLES.map(p => p.nom);

/** Les familles importées, telles que lues au dernier chargement. */
export function policesImportees(){
  return familles.slice();
}

/** Remplace la liste (sans rien charger) : ce que `chargerPolicesUtilisateur` fait après lecture. PURE vis-à-vis du DOM. */
export function definirPolicesImportees(etat){
  familles = Array.isArray(etat && etat.familles) ? etat.familles.filter(f => f && typeof f.nom === 'string') : [];
  renommages = (etat && etat.renommages && typeof etat.renommages === 'object') ? { ...etat.renommages } : {};
  definirUsages(etat);
}

function definirUsages(etat){
  usages = Array.isArray(etat && etat.usages) ? etat.usages.filter(u => u && u.id && u.nom) : null;
  usagesDesPolices = (etat && etat.usagesDesPolices && typeof etat.usagesDesPolices === 'object') ? { ...etat.usagesDesPolices } : {};
}

/**
 * Les usages D'ORIGINE (USAGES_POLICES, constants.js) et ceux de chaque police intégrée, dans la
 * langue donnée. Montrés tant que l'utilisateur n'a jamais touché aux usages, puis envoyés pour
 * AMORCER l'index au premier changement (cf. electron/bibliotheque/polices.js). PURE.
 */
export function usagesDOrigine(lang){
  const ids = Object.fromEntries(USAGES_POLICES.map((u, i) => [u.cle, `u${i + 1}`]));
  return {
    usages: USAGES_POLICES.map(u => ({ id: ids[u.cle], nom: lang === 'en' ? u.en : u.fr })),
    usagesDesPolices: Object.fromEntries(POLICES_BULLES.map(p => [p.nom, p.usages.map(c => ids[c])])),
  };
}

/** Les usages et leurs attributions en vigueur : ceux de l'utilisateur, sinon ceux d'origine. */
export function classementDesUsages(lang){
  return usages ? { usages: usages.slice(), usagesDesPolices: { ...usagesDesPolices } } : usagesDOrigine(lang);
}

/** Les usages triés par nom, pour une liste. */
export function tousLesUsages(lang){
  return classementDesUsages(lang).usages.slice().sort((a, b) => a.nom.localeCompare(b.nom, lang === 'en' ? 'en' : 'fr'));
}

/** Les NOMS des usages d'une police, dans l'ordre alphabétique (la fenêtre, l'infobulle des Bulles). */
export function nomsDesUsagesDeLaPolice(nom, lang){
  const ids = usagesDeLaPolice(nom, lang);
  return tousLesUsages(lang).filter(u => ids.includes(u.id)).map(u => u.nom);
}

/** Les ids des usages d'une police. */
export function usagesDeLaPolice(nom, lang){
  return classementDesUsages(lang).usagesDesPolices[nom] || [];
}

/**
 * Les polices qui portent AU MOINS UN des usages du filtre (une police a d'ordinaire un seul usage :
 * en exiger plusieurs à la fois ne laisserait rien). Filtre vide : toutes. PURE.
 */
export function filtrerParUsages(polices, ids, attributions){
  if (!ids || !ids.length) return polices.slice();
  return polices.filter(p => (attributions[p.nom] || []).some(id => ids.includes(id)));
}

/** Une opération sur les usages, par le pont ; l'état suit la réponse. Rend la réponse. */
export async function operationUsage(op, args, lang){
  const pont = globalThis.window && window.storyboarderAPI;
  if (!pont || !pont.fontUsageOperation) return { erreur: 'indisponible' };
  const r = await pont.fontUsageOperation(op, args, usagesDOrigine(lang));
  if (r && Array.isArray(r.usages)) definirUsages(r);
  return r || { erreur: 'reponse' };
}

/** Un nom lu dans une Bulle, renommages suivis jusqu'au bout (sans boucle). PURE. */
export function nomApresRenommages(nom, table = renommages){
  let n = nom;
  const vus = new Set();
  while (n && table[n] && !vus.has(n)) { vus.add(n); n = table[n]; }
  return n;
}

/** Le nom à DESSINER pour une Bulle : renommages des polices importées, puis remplaçantes des intégrées retirées. */
export function policeADessiner(nom){
  return policeDeBulle(nomApresRenommages(nom));
}

/** Le gras et l'italique d'une police, importée ou intégrée : 'vrai' ou 'simule'. */
export function variantesDeLaPolice(nom){
  const n = policeADessiner(nom);
  const f = familles.find(x => x.nom === n);
  if (f) return { gras: f.gras === 'vrai' ? 'vrai' : 'simule', italique: f.italique === 'vrai' ? 'vrai' : 'simule' };
  return variantesDePolice(n);
}

/**
 * Les descripteurs FontFace d'un fichier : une police VARIABLE déclare sa plage de graisses (« 200
 * 1000 »), une statique la sienne ; l'italique se déclare, sinon le navigateur le simulerait par
 * dessus le vrai. PURE.
 */
export function descripteursFontFace(f){
  const weight = Array.isArray(f.graisses) && f.graisses.length === 2 ? `${f.graisses[0]} ${f.graisses[1]}` : String(f.graisse || 400);
  return { weight, style: f.italique ? 'italic' : 'normal', display: 'block' };
}

/**
 * Lit la liste par le pont, puis charge chaque fichier dans le navigateur. Rend la liste. Un
 * fichier illisible n'empêche pas les autres ; une police déjà chargée est d'abord retirée (après
 * un renommage, l'ancienne famille ne doit plus répondre).
 */
export async function chargerPolicesUtilisateur(){
  const pont = globalThis.window && window.storyboarderAPI;
  if (!pont || !pont.listFonts) return [];
  definirPolicesImportees(await pont.listFonts());
  const doc = globalThis.document;
  if (!doc || !doc.fonts || typeof globalThis.FontFace !== 'function') return policesImportees();
  for (const face of chargees) { try { doc.fonts.delete(face); } catch (e) { /* déjà retirée */ } }
  chargees = [];
  for (const f of familles) {
    for (const v of f.fichiers || []) {
      try {
        const r = await pont.readFontFile(v.fichier);
        if (!r || !r.ok) continue;
        const face = new globalThis.FontFace(f.nom, r.data, descripteursFontFace(v));
        await face.load();
        doc.fonts.add(face);
        chargees.push(face);
      } catch (e) { /* un fichier illisible : les autres variantes restent */ }
    }
  }
  return policesImportees();
}

/**
 * Les caractères montrés dans le détail d'une police (demandé : « toutes les lettres ») : les deux
 * alphabets, les chiffres, la ponctuation d'une Bulle et les lettres accentuées du français.
 */
export const JEUX_DE_CARACTERES = Object.freeze([
  { cle: 'majuscules', fr: 'Majuscules', en: 'Uppercase', texte: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { cle: 'minuscules', fr: 'Minuscules', en: 'Lowercase', texte: 'abcdefghijklmnopqrstuvwxyz' },
  { cle: 'chiffres', fr: 'Chiffres', en: 'Figures', texte: '0123456789' },
  { cle: 'ponctuation', fr: 'Ponctuation', en: 'Punctuation', texte: '.,;:!?¡¿\'"«»‹›()[]-–—…&@#%€$£/*+=' },
  { cle: 'accents', fr: 'Accents', en: 'Accented', texte: 'ÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆàâäçéèêëîïôöùûüÿœæ' },
]);

/** La phrase d'essai par défaut : un pangramme français, toutes les lettres en une réplique. */
export const PHRASE_D_ESSAI = { fr: 'Portez ce vieux whisky au juge blond qui fume !', en: 'The quick brown fox jumps over the lazy dog!' };
