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

module.exports = { FICHIER, DOSSIER, dossierDe, tailleDeCuisson, entreeTexture, vide, ajouter, retirer, presentes };
