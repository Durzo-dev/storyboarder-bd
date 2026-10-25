/**
 * store-textures-ambientcg.js, la source ambientCG du store de textures (#446a).
 *
 * AUCUNE requête ici : les adresses et la traduction des réponses. Relevé en appelant l'API le
 * 25 octobre 2026 (https://ambientcg.com/api/v2/full_json) :
 *
 *   - ni clé ni compte ; tout est en CC0 ;
 *   - pages CÔTÉ SERVEUR : `limit`, `offset`, `sort` (Popular, Latest), `q` (texte), `category`
 *     (des catégories séparées par des virgules), `type=Material` (les seules matières PBR : ni
 *     HDRI, ni décalques, ni « Substance ») ; `numberOfResults` donne le total ;
 *   - chaque matière : `assetId`, `displayName`, `displayCategory` (« Bricks », « WoodFloor »…),
 *     `tags`, `dimensionX` / `dimensionY` (la taille réelle en CENTIMÈTRES, 0 si inconnue),
 *     `previewImage` (vignettes de 64 à 2048 px), et les zip téléchargeables par résolution
 *     (`1K-JPG` ≈ 7 à 10 Mo : couleur, normal GL et DX, rugosité, AO, déplacement).
 */
'use strict';
const { licence, PAR_PAGE } = require('./store-sources');
const M = require('./texture-matieres');

const API = 'https://ambientcg.com/api/v2/full_json';
const SITE = 'https://ambientcg.com';
const INCLURE = 'downloadData,tagData,displayData,imageData,dimensionsData';

/** Les identifiants ambientCG : lettres et chiffres (« Bricks113A »). */
function idValide(id){
  return typeof id === 'string' && /^[A-Za-z0-9_]{1,60}$/.test(id);
}

/**
 * L'adresse d'une page. `recherche` : `{ texte, matiere, usage, tri, curseur }`. La matière et
 * l'usage deviennent des catégories ambientCG (filtrées par le serveur) : une matière qui ne sert
 * pas l'usage demandé ne laisse rien, et c'est la vérité (`null` : inutile d'appeler).
 */
function urlRecherche(recherche = {}){
  let matieres = null;
  if (recherche.matiere) matieres = [recherche.matiere];
  if (recherche.usage) {
    const pourLUsage = M.matieresDeLUsage(recherche.usage);
    matieres = matieres ? matieres.filter(m => pourLUsage.includes(m)) : pourLUsage;
  }
  const p = new URLSearchParams({
    type: 'Material', include: INCLURE, limit: String(PAR_PAGE),
    offset: /^\d+$/.test(recherche.curseur || '') ? recherche.curseur : '0',
    sort: recherche.tri === 'recents' ? 'Latest' : 'Popular',
  });
  if (matieres) {
    const cats = M.categoriesAmbientcg(matieres);
    if (!cats.length) return null;
    p.set('category', cats.join(','));
  }
  const texte = String(recherche.texte || '').trim().slice(0, 100);
  if (texte) p.set('q', texte);
  return `${API}?${p.toString()}`;
}

/** La taille réelle en mètres (ambientCG la donne en centimètres), ou null si elle vaut 0. */
function dimensionsEnMetres(a){
  const x = Number(a && a.dimensionX), y = Number(a && a.dimensionY);
  return x > 0 && y > 0 ? [x / 100, y / 100] : x > 0 ? [x / 100, x / 100] : null;
}

const vignette = (a, taille) => {
  const u = a && a.previewImage && a.previewImage[`${taille}-JPG-242424`];
  return typeof u === 'string' && /^https:\/\//.test(u) ? u : null;
};

/** Une matière dans le format commun, ou null (autre type que Material, aucune matière chez nous). */
function textureNormalisee(a){
  if (!a || typeof a !== 'object' || !idValide(a.assetId)) return null;
  if (a.dataType && a.dataType !== 'Material') return null;
  const nom = String(a.displayName || a.assetId).trim();
  const matieres = M.matieresAmbientcg({ categorie: a.displayCategory, tags: a.tags, nom });
  if (!matieres.length) return null;
  return {
    source: 'ambientcg',
    id: a.assetId,
    type: 'texture',
    nom,
    auteur: { nom: 'ambientCG', url: SITE },
    url: `${SITE}/a/${a.assetId}`,
    vignettes: { petite: vignette(a, 256), grande: vignette(a, 1024) },
    licence: licence('cc0'),
    poids: null,
    details: { dimensions: dimensionsEnMetres(a) },
    matieres,
    usages: M.usagesDe(matieres),
    mots: [nom, ...(Array.isArray(a.tags) ? a.tags : [])].map(s => String(s).toLowerCase()),
    zips: zipsDe(a),
  };
}

/** Les zip JPG proposés, par résolution : `{ '1K': { url, taille }, … }` (adresses ambientCG seules). */
function zipsDe(a){
  const liste = a && a.downloadFolders && a.downloadFolders.default && a.downloadFolders.default.downloadFiletypeCategories
    && a.downloadFolders.default.downloadFiletypeCategories.zip && a.downloadFolders.default.downloadFiletypeCategories.zip.downloads;
  const sortie = {};
  for (const d of Array.isArray(liste) ? liste : []) {
    const m = /^(\d+K)-JPG$/.exec(d && d.attribute || '');
    if (m && typeof d.downloadLink === 'string' && HOTE_ZIP.test(d.downloadLink) && Number.isFinite(d.size)) {
      sortie[m[1]] = { url: d.downloadLink, taille: d.size };
    }
  }
  return sortie;
}

/** Une page de réponse : `{ resultats, suivant }` (le curseur est l'offset suivant). */
function pageDepuis(json, recherche = {}){
  const trouves = json && Array.isArray(json.foundAssets) ? json.foundAssets : [];
  const debut = /^\d+$/.test(recherche.curseur || '') ? Number(recherche.curseur) : 0;
  const total = json && Number.isFinite(json.numberOfResults) ? json.numberOfResults : 0;
  const fin = debut + trouves.length;
  return { resultats: trouves.map(textureNormalisee).filter(Boolean), suivant: trouves.length && fin < total ? String(fin) : null };
}

// ── Le téléchargement ──────────────────────────────────────────────────────────────────────────

const RESOLUTION = '1K';
const RESOLUTIONS = ['1K', '2K'];
const HOTE_ZIP = /^https:\/\/ambientcg\.com\/get\?file=[A-Za-z0-9_]+_\d+K-JPG\.zip$/;

/** Le zip à télécharger, à la résolution demandée (sinon la plus petite) ; null s'il n'y en a pas. */
function planTelechargement(r, resolution = RESOLUTION){
  const zips = r && r.zips ? r.zips : {};
  const dispo = Object.keys(zips).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const res = dispo.includes(resolution) ? resolution : dispo[0];
  return res ? { resolution: res, zip: zips[res], total: zips[res].taille } : null;
}

/**
 * Les cartes à garder dans le zip, d'après le nom des fichiers (« Bricks113A_1K-JPG_Color.jpg »).
 * Rend `{ couleur, normal, rugosite, ao }` (des noms de fichiers du zip), ou null s'il manque la
 * couleur, le relief OpenGL ou la rugosité. Le relief DirectX et le déplacement sont ignorés.
 */
function cartesDuZip(noms){
  const trouve = (suffixe) => (noms || []).find(n => typeof n === 'string' && !n.includes('/') && !n.includes('..')
    && new RegExp(`_${suffixe}\\.jpg$`, 'i').test(n)) || null;
  const c = { couleur: trouve('Color'), normal: trouve('NormalGL'), rugosite: trouve('Roughness'), ao: trouve('AmbientOcclusion') };
  return c.couleur && c.normal && c.rugosite ? c : null;
}

module.exports = {
  API, SITE, RESOLUTION, RESOLUTIONS,
  idValide, urlRecherche, dimensionsEnMetres, textureNormalisee, zipsDe, pageDepuis,
  planTelechargement, cartesDuZip,
};
