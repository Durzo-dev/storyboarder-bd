/**
 * @file electron/bibliotheque/store-fontsource.js
 * #423 : le STORE DE POLICES, source Fontsource (https://fontsource.org). Fonctions PURES : les
 * adresses, la traduction du catalogue, la recherche locale, le choix des fichiers à télécharger.
 * Les requêtes sont dans store-polices.js.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * POURQUOI FONTSOURCE (vérifié le 12 octobre 2026, en appelant l'API)
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 *   - une API publique SANS CLÉ : `GET api.fontsource.org/v1/fonts` rend tout le catalogue (Google
 *     Fonts et d'autres polices libres), `GET /v1/fonts/{id}` le détail d'une police ;
 *   - pour chaque police, AVANT tout téléchargement : sa catégorie, sa LICENCE, ses graisses et ses
 *     styles. On sait donc si elle est COMPLÈTE (demandé : vérifier la complétude et la licence) ;
 *   - les fichiers sont sur jsDelivr, par graisse, style et sous-ensemble Unicode, en woff2.
 *
 * Écartées : l'API Google Fonts (clé obligatoire, même catalogue) ; DaFont et 1001 Fonts (aucune
 * API, licences variables d'une police à l'autre, souvent « usage personnel »).
 *
 * ⚠️ ON NE TÉLÉCHARGE QUE LE SOUS-ENSEMBLE `latin` : il couvre le français et l'anglais (accents,
 * œ, €, guillemets). Un fichier par graisse et par style : normal, gras, italique, gras italique,
 * quand ils existent.
 */

'use strict';

const API = 'https://api.fontsource.org/v1/fonts';
const CDN = 'https://cdn.jsdelivr.net/fontsource/fonts';

/** Les catégories de Fontsource, dans l'ordre du filtre. */
const CATEGORIES = ['handwriting', 'display', 'sans-serif', 'serif', 'monospace'];

/** Les licences connues, leur libellé et leur texte. Une inconnue s'affiche telle quelle. */
const LICENCES = {
  'OFL-1.1': { libelle: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org' },
  'Apache-2.0': { libelle: 'Apache License 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
  'MIT': { libelle: 'MIT License', url: 'https://opensource.org/license/mit' },
  'UFL-1.0': { libelle: 'Ubuntu Font Licence 1.0', url: 'https://ubuntu.com/legal/font-licence' },
  'CC0-1.0': { libelle: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
};

/** Une page de résultats : assez pour remplir l'écran, pas au point de charger cent aperçus d'un coup. */
const PAR_PAGE = 48;

const urlCatalogue = () => API;
const urlDetail = (id) => `${API}/${encodeURIComponent(id)}`;
/** Un fichier : graisse, style, sous-ensemble latin, en woff2. */
const urlFichier = (id, graisse, italique) => `${CDN}/${encodeURIComponent(id)}@latest/latin-${graisse}-${italique ? 'italic' : 'normal'}.woff2`;

/** La graisse « normale » d'une police : 400, sinon la plus proche. */
function graisseNormale(graisses){
  return [...graisses].sort((a, b) => Math.abs(a - 400) - Math.abs(b - 400) || a - b)[0];
}

/** Le vrai gras : 700, sinon la plus proche à partir de 600 ; null s'il n'y en a pas. */
function graisseGrasse(graisses){
  const lourdes = graisses.filter(g => g >= 600);
  return lourdes.length ? lourdes.sort((a, b) => Math.abs(a - 700) - Math.abs(b - 700) || a - b)[0] : null;
}

/** Une entrée du catalogue, dans la forme de l'application ; null si elle n'a pas de latin. PURE. */
function policeNormalisee(f){
  if (!f || typeof f.id !== 'string' || typeof f.family !== 'string') return null;
  if (!Array.isArray(f.subsets) || !f.subsets.includes('latin')) return null;
  const graisses = (Array.isArray(f.weights) ? f.weights : []).filter(Number.isFinite);
  if (!graisses.length) return null;
  const styles = Array.isArray(f.styles) ? f.styles : ['normal'];
  const gras = graisseGrasse(graisses) ? 'vrai' : 'simule';
  const italique = styles.includes('italic') ? 'vrai' : 'simule';
  const l = LICENCES[f.license];
  return {
    id: f.id,
    nom: f.family,
    categorie: CATEGORIES.includes(f.category) ? f.category : 'display',
    licence: l ? l.libelle : (f.license || null),
    url: l ? l.url : null,
    graisses,
    graisseNormale: graisseNormale(graisses),
    graisseGrasse: graisseGrasse(graisses),
    gras,
    italique,
    complete: gras === 'vrai' && italique === 'vrai',
    modifie: f.lastModified || '',
  };
}

/** Le catalogue entier, normalisé et trié par nom. PURE. */
function catalogueNormalise(json){
  return (Array.isArray(json) ? json : []).map(policeNormalisee).filter(Boolean)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'en'));
}

const sansAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Une page de recherche dans le catalogue. `recherche` : { texte, categorie, completes, tri, curseur }.
 * `tri` : 'nom' (défaut) ou 'recent'. Rend `{ resultats, suivant, total }`. PURE.
 */
function pageLocale(catalogue, recherche = {}){
  const mots = sansAccents(recherche.texte).split(/\s+/).filter(Boolean);
  let liste = catalogue.filter(p => (!recherche.categorie || p.categorie === recherche.categorie)
    && (!recherche.completes || p.complete)
    && mots.every(m => sansAccents(p.nom).includes(m)));
  if (recherche.tri === 'recent') liste = liste.slice().sort((a, b) => b.modifie.localeCompare(a.modifie) || a.nom.localeCompare(b.nom, 'en'));
  const debut = Math.max(0, Number(recherche.curseur) || 0);
  const resultats = liste.slice(debut, debut + PAR_PAGE);
  const suivant = debut + PAR_PAGE < liste.length ? debut + PAR_PAGE : null;
  return { resultats, suivant, total: liste.length };
}

/**
 * Le fichier d'aperçu d'une police : la variante demandée si elle EXISTE, sinon sa graisse normale,
 * droite. PURE.
 */
function fichierApercu(p, graisse = null, italique = false){
  const g = p.graisses.includes(graisse) ? graisse : graisseNormale(p.graisses);
  return urlFichier(p.id, g, !!italique && p.italique === 'vrai');
}

/**
 * Les fichiers à télécharger : normal, gras, italique, gras italique, ceux qui EXISTENT. Ce qui
 * manque sera simulé par l'application, et signalé. PURE.
 */
function fichiersATelecharger(p){
  const normale = graisseNormale(p.graisses);
  const grasse = graisseGrasse(p.graisses);
  const italique = p.italique === 'vrai';
  const out = [{ graisse: normale, italique: false }];
  if (grasse) out.push({ graisse: grasse, italique: false });
  if (italique) out.push({ graisse: normale, italique: true });
  if (grasse && italique) out.push({ graisse: grasse, italique: true });
  return out.map(f => ({ ...f, url: urlFichier(p.id, f.graisse, f.italique), fichier: `${p.id}-latin-${f.graisse}-${f.italique ? 'italic' : 'normal'}.woff2` }));
}

module.exports = {
  CATEGORIES, LICENCES, PAR_PAGE, urlCatalogue, urlDetail, urlFichier,
  policeNormalisee, catalogueNormalise, pageLocale, fichierApercu, fichiersATelecharger,
  graisseNormale, graisseGrasse,
};
