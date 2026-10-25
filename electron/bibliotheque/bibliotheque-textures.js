/**
 * bibliotheque-textures.js, « MES TEXTURES » (#446b) : ce qui décide, sans disque ni réseau.
 *
 * Une texture téléchargée vit dans `Textures/<dossier>/`, à côté du dossier Modeles (dans le dossier
 * de Projets, pour suivre ses sauvegardes) :
 *
 *   couleur.jpg, normal.jpg, rugosite.jpg   les cartes d'origine (obligatoires)
 *   ao.jpg, deplacement.jpg                 si la source les fournit
 *   grain.png | grain.couleur.png           le grain cuit pour le Sol et les Tracés (cf. le cuiseur)
 *
 * Et une entrée dans `bibliotheque-textures.json` : d'où elle vient (son crédit), ses matières et
 * usages, sa taille réelle, la résolution choisie, et ce que la cuisson a mesuré (teinte, nature,
 * raccord). Rien n'est téléchargé d'office : seulement ce que l'utilisateur choisit dans le store.
 */
'use strict';

const FICHIER = 'bibliotheque-textures.json';
const DOSSIER = 'Textures';

/** Le nom du dossier d'une texture : la source et l'identifiant, sans rien qui sorte du dossier. */
function dossierDe(source, id){
  const propre = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
  const s = propre(source), i = propre(id);
  return s && i ? `${s}-${i}` : null;
}

/** La taille de cuisson : celle du Sol (1024) dès que la texture sert au Sol ou à un Tracé, sinon 512. */
function tailleDeCuisson(usages, grandFormat = 1024, petitFormat = 512){
  const cibles = new Set(['sol', 'route', 'chemin', 'muret', 'cloture', 'haie']);
  return (usages || []).some(u => cibles.has(u)) ? grandFormat : petitFormat;
}

/**
 * L'entrée de la bibliothèque pour une texture téléchargée. `cuisson` : ce qu'a rendu le cuiseur
 * (null si la texture n'a pas pu être cuite : elle reste utilisable en revêtement, avec ses cartes).
 */
function entreeTexture(r, { resolution, cartes, cuisson = null, date = new Date() }){
  return {
    cle: `${r.source}:${r.id}`,
    dossier: dossierDe(r.source, r.id),
    source: r.source,
    id: r.id,
    nom: r.nom,
    auteur: r.auteur ? { nom: r.auteur.nom || null, url: r.auteur.url || null } : null,
    url: r.url || null,
    licence: r.licence ? r.licence.code : null,
    matieres: Array.isArray(r.matieres) ? r.matieres.slice() : [],
    usages: Array.isArray(r.usages) ? r.usages.slice() : [],
    dimensions: r.details && Array.isArray(r.details.dimensions) ? r.details.dimensions.slice(0, 2) : null,
    resolution,
    cartes: (cartes || []).slice(),
    grain: cuisson ? cuisson.fichier : null,
    teinte: cuisson ? cuisson.teinte : null,
    nature: cuisson ? cuisson.nature : null,
    raccordVisible: cuisson ? !!cuisson.raccordVisible : false,
    date: date.toISOString(),
  };
}

const vide = () => ({ version: 1, textures: [] });
const liste = (b) => (b && Array.isArray(b.textures) ? b.textures.filter(t => t && t.cle && t.dossier) : []);

/** Ajoute (ou REMPLACE : un second téléchargement de la même texture met l'entrée à jour). */
function ajouter(biblio, entree){
  return { version: 1, textures: [...liste(biblio).filter(t => t.cle !== entree.cle), entree] };
}

function retirer(biblio, cle){
  return { version: 1, textures: liste(biblio).filter(t => t.cle !== cle) };
}

/** Les entrées dont le dossier est encore sur le disque (un dossier effacé à la main ne ment pas). */
function presentes(biblio, dossiersPresents){
  const la = new Set(dossiersPresents || []);
  return liste(biblio).filter(t => la.has(t.dossier));
}

// ── L'import d'un dossier (#446c, demandé : « sélectionner le dossier, l'application récupère ce
//    qu'il lui faut ») ─────────────────────────────────────────────────────────────────────────

/**
 * Les rôles reconnus au nom des fichiers, dans l'ordre où on les cherche. La convention est celle
 * des banques (Poly Haven, ambientCG, et la plupart des autres) : un suffixe par carte. Une normale
 * DirectX n'est jamais prise pour une OpenGL (elle inverserait le relief) ; une normale au nom
 * ambigu (« _Normal » seul) est lue comme OpenGL, la convention la plus courante.
 */
const ROLES = [
  ['couleur', /(^|[_\-. ])(color|colour|col|diff|diffuse|albedo|basecolor|base_color)([_\-. ]|$)/i],
  ['normal', /(normalgl|nor_gl|normal_gl|normal-ogl|normal_ogl)/i],
  ['normalAmbigue', /(^|[_\-. ])(normal|nor|nrm)([_\-. ]|$)/i],
  ['rugosite', /(^|[_\-. ])(rough|roughness|rgh)([_\-. ]|$)/i],
  ['ao', /(^|[_\-. ])(ao|ambientocclusion|occlusion)([_\-. ]|$)/i],
  ['deplacement', /(^|[_\-. ])(displacement|disp|height|bump)([_\-. ]|$)/i],
];
const DX = /(normaldx|nor_dx|normal_dx|normal-dx)/i;

/**
 * Les cartes d'un dossier, d'après le nom de ses images : `{ cartes: { couleur, normal, … },
 * ignores, refus }`. Refus (avec la raison, lisible) si la couleur manque, ou si un rôle a
 * plusieurs candidats (deux résolutions dans le même dossier : on ne choisit pas à la place).
 */
function cartesDuDossier(noms){
  const images = (noms || []).filter(n => typeof n === 'string' && /\.(jpe?g|png)$/i.test(n) && !n.startsWith('.'));
  const cartes = {}, doublons = [];
  for (const nom of images) {
    if (DX.test(nom)) continue;
    const role = ROLES.find(([, re]) => re.test(nom.replace(/\.(jpe?g|png)$/i, '')));
    if (!role) continue;
    const r = role[0] === 'normalAmbigue' ? 'normal' : role[0];
    if (r === 'normal' && cartes.normal && role[0] === 'normalAmbigue') continue;   // GL explicite d'abord
    if (cartes[r] && !(r === 'normal' && role[0] === 'normal')) { doublons.push(r); continue; }
    cartes[r] = nom;
  }
  const pris = new Set(Object.values(cartes));
  const ignores = images.filter(n => !pris.has(n));
  if (!cartes.couleur) {
    return { cartes, ignores, refus: 'couleur' };
  }
  if (doublons.length) return { cartes, ignores, refus: 'doublons', doublons: [...new Set(doublons)] };
  return { cartes, ignores, refus: null };
}

/** L'identifiant d'une texture importée : le nom du dossier, nettoyé (et unique grâce à `pris`). */
function idImport(nomDossier, pris = []){
  const base = String(nomDossier || 'texture').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) || 'texture';
  let id = base, n = 2;
  while (pris.includes(id)) id = `${base}_${n++}`;
  return id;
}

/** La taille réelle d'une texture importée, inconnue : 2 m de côté, comme une dalle moyenne. */
const TAILLE_IMPORT = [2, 2];

/** Change les matières d'une texture (cochées sur sa fiche) ; ses usages en découlent. */
function avecMatieres(biblio, cle, matieres, usagesDe){
  return { version: 1, textures: liste(biblio).map(t => (t.cle === cle ? { ...t, matieres: matieres.slice(), usages: usagesDe(matieres) } : t)) };
}

module.exports = {
  FICHIER, DOSSIER, dossierDe, tailleDeCuisson, entreeTexture, vide, ajouter, retirer, presentes,
  cartesDuDossier, idImport, TAILLE_IMPORT, avecMatieres,
};
