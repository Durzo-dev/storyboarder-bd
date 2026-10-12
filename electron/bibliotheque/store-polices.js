/**
 * @file electron/bibliotheque/store-polices.js
 * #423 : les ENTRÉES-SORTIES du store de polices (source Fontsource), dans le processus principal.
 * Tout ce qui décide est dans store-fontsource.js ; ici les requêtes, avec un délai, et les caches.
 *
 * La SIMULATION (STORYBOARD_SIMULER_STORE, en développement seulement, comme le store de modèles)
 * rend un extrait enregistré du catalogue (tests/fixtures/fontsource-catalogue.json), et les
 * fichiers des polices INTÉGRÉES (assets/fonts) quand une police du catalogue en est une : de quoi
 * travailler l'interface hors ligne.
 */
'use strict';
const { net } = require('electron');
const path = require('path');
const fs = require('fs');
const fontsource = require('./store-fontsource');

const DELAI_MS = 15000;

async function lire(url, json){
  const abandon = new AbortController();
  const minuterie = setTimeout(() => abandon.abort(), DELAI_MS);
  try {
    const rep = await net.fetch(url, { signal: abandon.signal });
    if (!rep.ok) return { erreur: rep.status === 429 ? 'quota' : 'reponse', statut: rep.status };
    return json ? { json: await rep.json() } : { data: Buffer.from(await rep.arrayBuffer()) };
  } catch (e) {
    return { erreur: 'reseau' };
  } finally {
    clearTimeout(minuterie);
  }
}

/**
 * Le catalogue, gardé UNE HEURE en mémoire : un millier et demi de polices, qui ne changent qu'à la
 * publication d'une nouvelle. Le relire à chaque frappe serait du gâchis. Une erreur n'est pas
 * gardée : la recherche suivante réessaie.
 */
const DUREE_CATALOGUE_MS = 60 * 60 * 1000;
let _catalogue = null;
async function catalogue(simulation){
  if (simulation) {
    try { return { liste: fontsource.catalogueNormalise(JSON.parse(fs.readFileSync(path.join(simulation, 'tests', 'fixtures', 'fontsource-catalogue.json'), 'utf8'))) }; }
    catch (e) { return { erreur: 'reseau' }; }
  }
  if (_catalogue && Date.now() - _catalogue.lu < DUREE_CATALOGUE_MS) return { liste: _catalogue.liste };
  const r = await lire(fontsource.urlCatalogue(), true);
  if (r.erreur) return r;
  const liste = fontsource.catalogueNormalise(r.json);
  _catalogue = { liste, lu: Date.now() };
  return { liste };
}

/** Une recherche : `{ resultats, suivant, total, simulation }` ou `{ erreur }`. */
async function chercher(params, simulation){
  const c = await catalogue(simulation);
  if (c.erreur) return c;
  return { ...fontsource.pageLocale(c.liste, params || {}), simulation: !!simulation };
}

/** Les catégories, pour le filtre. */
function infos(){
  return { categories: fontsource.CATEGORIES };
}

async function policeDuCatalogue(id, simulation){
  const c = await catalogue(simulation);
  if (c.erreur) return c;
  const p = c.liste.find(x => x.id === id);
  return p ? { police: p } : { erreur: 'inconnue' };
}

/** En simulation : le fichier d'une police intégrée, s'il y en a un pour cette graisse et ce style. */
function fichierSimule(simulation, p, graisse, italique){
  const slug = p.nom.replace(/[^A-Za-z0-9]/g, '');
  const candidats = [`${slug}-${graisse}${italique ? '-italic' : ''}-latin.woff2`, `${slug}${italique ? '-italic' : ''}-latin.woff2`];
  for (const c of candidats) {
    try { return fs.readFileSync(path.join(simulation, 'assets', 'fonts', c)); } catch (e) { /* suivant */ }
  }
  return null;
}

/**
 * L'aperçu d'une police : sa graisse normale. Gardé en mémoire (deux cents au plus) : faire défiler
 * la grille d'avant en arrière ne retélécharge rien.
 */
const _apercus = new Map();
async function apercu(id, simulation, graisse = null, italique = false){
  const cle = `${id}|${graisse}|${!!italique}`;
  if (_apercus.has(cle)) return { data: _apercus.get(cle) };
  const r = await policeDuCatalogue(id, simulation);
  if (r.erreur) return r;
  let data;
  if (simulation) {
    data = fichierSimule(simulation, r.police, graisse || r.police.graisseNormale, !!italique);
    if (!data) return { erreur: 'simulation' };
  } else {
    const f = await lire(fontsource.fichierApercu(r.police, graisse, italique), false);
    if (f.erreur) return f;
    data = f.data;
  }
  if (_apercus.size >= 200) _apercus.delete(_apercus.keys().next().value);
  _apercus.set(cle, data);
  return { data };
}

/**
 * Les fichiers d'une police, prêts à importer : `{ police, fichiers: [{ fichier, data }] }` ou
 * `{ erreur }`. Un fichier qui manque fait échouer le tout : une police à moitié téléchargée
 * serait pire que pas de police.
 */
async function telecharger(id, simulation){
  const r = await policeDuCatalogue(id, simulation);
  if (r.erreur) return r;
  const fichiers = [];
  for (const f of fontsource.fichiersATelecharger(r.police)) {
    let data;
    if (simulation) {
      data = fichierSimule(simulation, r.police, f.graisse, f.italique);
      if (!data) continue;   // la simulation n'a pas toutes les variantes : celles qui manquent seront simulées
    } else {
      const t = await lire(f.url, false);
      if (t.erreur) return t;
      data = t.data;
    }
    fichiers.push({ fichier: f.fichier, data });
  }
  if (!fichiers.length) return { erreur: simulation ? 'simulation' : 'reponse' };
  return { police: r.police, fichiers };
}

/** Le code d'une réponse inattendue (son texte : texteErreur, src/polices-store-ui.js). */
const ERREUR_REPONSE = 'reponse';

module.exports = { chercher, infos, apercu, telecharger, ERREUR_REPONSE };
