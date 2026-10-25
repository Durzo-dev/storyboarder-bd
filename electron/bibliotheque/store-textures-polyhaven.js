/**
 * store-textures-polyhaven.js, les TEXTURES de Poly Haven (#446a).
 *
 * Comme store-polyhaven.js (les modèles), AUCUNE requête ici : les adresses et la traduction des
 * réponses dans le format commun. Relevé en appelant l'API le 25 octobre 2026 :
 *
 *   - `/assets?type=textures` rend tout le catalogue (869 textures) d'un coup, indexé par
 *     identifiant : nom, `categories` (un TABLEAU : « brick », « wall », « outdoor »…), `tags`,
 *     auteurs, `dimensions` en millimètres (la taille réelle de la photo, ex. [3000, 3000]),
 *     `attributes.surface_use` (« wall », « floor », « ground »), téléchargements, date, vignette ;
 *   - `/files/{id}` détaille chaque carte (Diffuse, nor_gl, Rough, AO…) par résolution et format.
 *
 * Tout est en CC0. Pas de pages côté serveur : filtre, tri et pages se font ici (pageLocale).
 */
'use strict';
const { licence, PAR_PAGE } = require('./store-sources');
const { idValide, vignetteDeTaille } = require('./store-polyhaven');
const M = require('./texture-matieres');

const API = 'https://api.polyhaven.com';
const SITE = 'https://polyhaven.com';

function urlCatalogue(){
  return `${API}/assets?type=textures`;
}

/** La taille réelle en mètres `[largeur, hauteur]`, ou null si la source ne la donne pas. */
function dimensionsEnMetres(d){
  return Array.isArray(d) && d.length >= 2 && d.slice(0, 2).every(v => Number.isFinite(v) && v > 0)
    ? d.slice(0, 2).map(v => Math.round(v) / 1000) : null;
}

/**
 * Une texture du catalogue dans le format commun, ou null : identifiant douteux, accès anticipé
 * (publication à venir), ou AUCUNE matière reconnue (texture sans usage chez nous).
 */
function textureNormalisee(id, t, maintenant = Date.now()){
  if (!idValide(id) || !t || typeof t !== 'object') return null;
  if (t.type !== undefined && t.type !== 1) return null;
  if (Number.isFinite(t.date_published) && t.date_published * 1000 > maintenant) return null;
  const nom = typeof t.name === 'string' && t.name.trim() ? t.name.trim() : id;
  const matieres = M.matieresPolyhaven({ categories: t.categories, tags: t.tags, nom });
  if (!matieres.length) return null;
  const auteurs = t.authors && typeof t.authors === 'object' ? Object.keys(t.authors) : [];
  return {
    source: 'polyhaven',
    id,
    type: 'texture',
    nom,
    auteur: {
      nom: auteurs.length ? auteurs.join(', ') : 'Poly Haven',
      url: auteurs.length === 1 ? `${SITE}/all?a=${encodeURIComponent(auteurs[0])}` : null,
    },
    url: `${SITE}/a/${id}`,
    vignettes: {
      petite: vignetteDeTaille(t.thumbnail_url, 256),
      grande: vignetteDeTaille(t.thumbnail_url, 1024),
    },
    licence: licence('cc0'),
    poids: null,   // dépend de la résolution : lu au téléchargement
    details: { dimensions: dimensionsEnMetres(t.dimensions) },
    matieres,
    usages: M.usagesDe(matieres),
    mots: [nom, ...(Array.isArray(t.tags) ? t.tags : [])].map(s => String(s).toLowerCase()),
  };
}

/** Le catalogue normalisé : `[{ r, telechargements, date }]`, dans l'ordre du catalogue. */
function catalogueNormalise(json, maintenant = Date.now()){
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [];
  const sortie = [];
  for (const [id, t] of Object.entries(json)) {
    const r = textureNormalisee(id, t, maintenant);
    if (!r) continue;
    sortie.push({
      r,
      telechargements: Number.isFinite(t.download_count) ? t.download_count : 0,
      date: Number.isFinite(t.date_published) ? t.date_published : 0,
    });
  }
  return sortie;
}

/**
 * Une page, filtrée chez nous. `recherche` : `{ texte, matiere, usage, tri, curseur }`.
 *   - le texte cherche dans le nom et les tags (le catalogue est en anglais ; « brick » trouve) ;
 *   - la matière et l'usage se combinent (ET) ;
 *   - sans texte ni tri, les plus téléchargées d'abord.
 */
function pageLocale(catalogue, recherche = {}){
  let liste = Array.isArray(catalogue) ? catalogue.slice() : [];
  const texte = String(recherche.texte || '').trim().toLowerCase();
  if (texte) liste = liste.filter(e => e.r.mots.some(m => m.includes(texte)));
  if (recherche.matiere) liste = liste.filter(e => e.r.matieres.includes(recherche.matiere));
  if (recherche.usage) liste = liste.filter(e => e.r.usages.includes(recherche.usage));
  if (recherche.tri === 'recents') liste.sort((a, b) => b.date - a.date);
  else liste.sort((a, b) => b.telechargements - a.telechargements);
  const debut = /^\d+$/.test(recherche.curseur || '') ? Number(recherche.curseur) : 0;
  const fin = debut + PAR_PAGE;
  return { resultats: liste.slice(debut, fin).map(e => e.r), suivant: fin < liste.length ? String(fin) : null };
}

// ── Le téléchargement ──────────────────────────────────────────────────────────────────────────

/**
 * 1k par défaut (demandé : matière complète en 1024 px). 2k au choix ; 4k SEULEMENT pour une
 * texture qui sert aux bâtiments (un mur vu de près dans une Case exportée en grand). Jamais 8k.
 * Le Sol et les Tracés n'en profitent pas : le cuiseur ramène leur grain à 1024.
 */
const RESOLUTION = '1k';
const RESOLUTIONS = ['1k', '2k', '4k'];
const HOTE_FICHIERS = /^https:\/\/dl\.polyhaven\.org\//;

/**
 * Les cartes gardées, et leur nom chez Poly Haven. La couleur, le relief (normal au format OpenGL,
 * celui de three.js) et la rugosité sont obligatoires ; l'ombrage des creux (AO) quand il existe.
 */
const CARTES = [
  ['couleur', 'Diffuse', true],
  ['normal', 'nor_gl', true],
  ['rugosite', 'Rough', true],
  ['ao', 'AO', false],
  // Le déplacement : le cuiseur en tire le relief du grain (à défaut, l'AO).
  ['deplacement', 'Displacement', false],
];

function urlFichiers(id){
  return idValide(id) ? `${API}/files/${id}` : null;
}

function fichierValide(f){
  return !!f && typeof f.url === 'string' && HOTE_FICHIERS.test(f.url) && Number.isFinite(f.size) && f.size >= 0
    && (f.md5 === undefined || /^[0-9a-f]{32}$/.test(f.md5));
}

/**
 * Ce qu'il faut télécharger, d'après /files/{id} : une image JPG par carte, à la résolution
 * demandée (sinon la plus petite proposée). null si une carte obligatoire manque ou si une adresse
 * n'est pas celle de Poly Haven.
 */
function planTelechargement(fichiers, resolution = RESOLUTION){
  if (!fichiers || typeof fichiers !== 'object') return null;
  const diffuse = fichiers.Diffuse;
  if (!diffuse || typeof diffuse !== 'object') return null;
  const dispo = Object.keys(diffuse).filter(k => /^\d+k$/.test(k)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const res = dispo.includes(resolution) ? resolution : dispo[0];
  if (!res) return null;
  const cartes = [];
  for (const [carte, cle, obligatoire] of CARTES) {
    const f = fichiers[cle] && fichiers[cle][res] && fichiers[cle][res].jpg;
    if (!fichierValide(f)) { if (obligatoire) return null; continue; }
    cartes.push({ carte, url: f.url, taille: f.size, md5: f.md5 || null });
  }
  return { resolution: res, cartes, total: cartes.reduce((n, c) => n + c.taille, 0) };
}

/** Les résolutions proposées, avec leur poids : `[{ resolution, octets }]`, seulement les vraies. */
function optionsTelechargement(fichiers, usages = []){
  return resolutionsPermises(usages, RESOLUTIONS).map(res => {
    const p = planTelechargement(fichiers, res);
    return p && p.resolution === res ? { resolution: res, octets: p.total } : null;
  }).filter(Boolean);
}

/** Les résolutions permises pour des usages : la plus haute seulement si un bâtiment s'en sert. */
function resolutionsPermises(usages, toutes){
  return (usages || []).some(u => (M.usage(u) || {}).cible === 'batiment') ? toutes : toutes.slice(0, 2);
}

module.exports = {
  API, SITE, RESOLUTION, RESOLUTIONS, CARTES, resolutionsPermises,
  urlCatalogue, dimensionsEnMetres, textureNormalisee, catalogueNormalise, pageLocale,
  urlFichiers, planTelechargement, optionsTelechargement,
};
