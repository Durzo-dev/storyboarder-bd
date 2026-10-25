/**
 * store-textures.js, LE STORE DE TEXTURES côté processus principal (#446b) : les requêtes, le
 * téléchargement, la cuisson et le rangement. Les décisions vivent dans des modules purs et testés
 * (texture-matieres.js, store-textures-polyhaven.js, store-textures-ambientcg.js,
 * bibliotheque-textures.js, zip-lecture.js) ; ici, seulement le réseau et le disque.
 *
 * Un fenêtre à part (demandé : « un autre store, avec son propre bouton »), d'où ses canaux IPC à
 * part (`textures:*`). Rien n'est téléchargé d'office : seulement la texture choisie, à la
 * résolution choisie sur sa fiche.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { lireJson, lireOctets, md5, fixture, POIDS_MAX } = require('./store');
const M = require('./texture-matieres');
const PH = require('./store-textures-polyhaven');
const ACG = require('./store-textures-ambientcg');
const B = require('./bibliotheque-textures');
const zip = require('./zip-lecture');

const SOURCES = ['polyhaven', 'ambientcg'];

/** Ce que la fenêtre doit savoir pour ses filtres : sources, matières, usages. */
function infos(){
  return {
    sources: SOURCES,
    matieres: M.MATIERES.map(({ slug, fr, en, usages }) => ({ slug, fr, en, usages })),
    usages: M.USAGES.map(({ slug, fr, en, cible }) => ({ slug, fr, en, cible })),
  };
}

// ── La recherche ───────────────────────────────────────────────────────────────────────────────

const DUREE_CATALOGUE_MS = 60 * 60 * 1000;
let _catalogue = null;
async function cataloguePolyhaven(simulation){
  if (simulation) return { liste: PH.catalogueNormalise(fixture(simulation, 'polyhaven-textures.json') || {}) };
  if (_catalogue && Date.now() - _catalogue.lu < DUREE_CATALOGUE_MS) return { liste: _catalogue.liste };
  const r = await lireJson(PH.urlCatalogue());
  if (r.erreur) return r;
  _catalogue = { liste: PH.catalogueNormalise(r.json), lu: Date.now() };
  return { liste: _catalogue.liste };
}

/** Une page : `{ resultats, suivant }` ou `{ erreur }`. `params` : texte, matiere, usage, tri, curseur. */
async function chercher(sourceId, params = {}, simulation){
  const recherche = {
    texte: String(params.texte || '').slice(0, 100),
    matiere: M.matiere(params.matiere) ? params.matiere : null,
    usage: M.usage(params.usage) ? params.usage : null,
    tri: params.tri === 'recents' ? 'recents' : 'populaires',
    curseur: /^\d{1,6}$/.test(params.curseur || '') ? params.curseur : null,
  };
  if (sourceId === 'polyhaven') {
    const c = await cataloguePolyhaven(simulation);
    return c.erreur ? c : PH.pageLocale(c.liste, recherche);
  }
  if (sourceId === 'ambientcg') {
    if (simulation) return ACG.pageDepuis(fixture(simulation, 'ambientcg-textures.json') || {}, recherche);
    const url = ACG.urlRecherche(recherche);
    if (!url) return { resultats: [], suivant: null };
    const r = await lireJson(url);
    return r.erreur ? r : ACG.pageDepuis(r.json, recherche);
  }
  return { erreur: 'source' };
}

/**
 * La fiche d'une matière, relue À LA SOURCE par son identifiant : le renderer ne fournit jamais
 * une adresse à télécharger, seulement un identifiant.
 */
async function ficheSource(sourceId, id){
  if (sourceId === 'polyhaven') {
    const c = await cataloguePolyhaven(null);
    if (c.erreur) return c;
    const e = c.liste.find(x => x.r.id === id);
    return e ? { r: e.r } : { erreur: 'reponse' };
  }
  if (sourceId === 'ambientcg' && ACG.idValide(id)) {
    const r = await lireJson(`${ACG.API}?id=${encodeURIComponent(id)}&include=downloadData,tagData,displayData,imageData,dimensionsData`);
    if (r.erreur) return r;
    const t = r.json && Array.isArray(r.json.foundAssets) ? ACG.textureNormalisee(r.json.foundAssets[0]) : null;
    return t ? { r: t } : { erreur: 'reponse' };
  }
  return { erreur: 'source' };
}

/** Les résolutions proposées sur la fiche, avec leur poids : `{ options }` ou `{ erreur }`. */
async function options(sourceId, id, simulation){
  if (simulation) return { options: [{ resolution: sourceId === 'ambientcg' ? '1K' : '1k', octets: 1500000 }] };
  const f = await ficheSource(sourceId, id);
  if (f.erreur) return f;
  if (sourceId === 'ambientcg') return { options: ACG.optionsTelechargement(f.r) };
  const fichiers = await lireJson(PH.urlFichiers(id));
  return fichiers.erreur ? fichiers : { options: PH.optionsTelechargement(fichiers.json, f.r.usages) };
}

// ── Le téléchargement, la cuisson, le rangement ───────────────────────────────────────────────

/** Les cartes d'une texture, en octets : `{ cartes: Map(carte → Buffer), resolution, r }` ou `{ erreur }`. */
async function recupererCartes(sourceId, id, resolution, progression){
  const f = await ficheSource(sourceId, id);
  if (f.erreur) return f;
  let recus = 0;
  if (sourceId === 'polyhaven') {
    const fichiers = await lireJson(PH.urlFichiers(id));
    if (fichiers.erreur) return fichiers;
    const permises = PH.resolutionsPermises(f.r.usages, PH.RESOLUTIONS);
    const plan = PH.planTelechargement(fichiers.json, permises.includes(resolution) ? resolution : PH.RESOLUTION);
    if (!plan) return { erreur: 'reponse' };
    if (plan.total > POIDS_MAX) return { erreur: 'tropLourd' };
    const cartes = new Map();
    for (const c of plan.cartes) {
      const r = await lireOctets(c.url, (n) => { recus += n; if (progression) progression(Math.min(recus, plan.total), plan.total); });
      if (r.erreur) return r;
      if (c.md5 && md5(r.octets) !== c.md5) return { erreur: 'corrompu' };
      cartes.set(c.carte, r.octets);
    }
    return { cartes, resolution: plan.resolution, r: f.r };
  }
  const permises = PH.resolutionsPermises(f.r.usages, ACG.RESOLUTIONS);
  const plan = ACG.planTelechargement(f.r, permises.includes(resolution) ? resolution : ACG.RESOLUTION);
  if (!plan || !ACG.HOTE_ZIP.test(plan.zip.url)) return { erreur: 'reponse' };
  if (plan.total > POIDS_MAX) return { erreur: 'tropLourd' };
  const r = await lireOctets(plan.zip.url, (n) => { recus += n; if (progression) progression(Math.min(recus, plan.total), plan.total); });
  if (r.erreur) return r;
  try {
    const noms = zip.nomsDuZip(r.octets);
    const choix = noms && ACG.cartesDuZip(noms);
    if (!choix) return { erreur: 'reponse' };
    const lus = zip.extraire(r.octets, Object.values(choix).filter(Boolean));
    const cartes = new Map();
    for (const [carte, nom] of Object.entries(choix)) if (nom && lus.has(nom)) cartes.set(carte, lus.get(nom));
    return { cartes, resolution: plan.resolution, r: f.r };
  } catch (e) {
    return { erreur: 'reponse' };
  }
}

/**
 * Le grain, cuit À PARTIR DES CARTES DÉJÀ ÉCRITES. Le cuiseur classe les cartes par leur nom : on
 * lui prépare un dossier temporaire où chacune porte le nom qu'il reconnaît, avec UNE seule source
 * de relief (le déplacement, sinon l'AO ; deux le feraient refuser, à raison). Rend ce que l'entrée
 * de bibliothèque retient, ou null si la cuisson n'a pas pu se faire honnêtement (la texture reste
 * alors utilisable en revêtement, avec ses cartes).
 */
/** Le fichier d'une carte dans le dossier d'une texture : `couleur.jpg` ou `couleur.png` (import). */
function fichierCarte(dossierTexture, carte){
  for (const ext of ['jpg', 'png']) if (fs.existsSync(path.join(dossierTexture, `${carte}.${ext}`))) return `${carte}.${ext}`;
  return null;
}

async function cuire(dossierTexture, cartes, usages, tailleForcee = null){
  const relief = cartes.includes('deplacement') ? 'deplacement' : cartes.includes('ao') ? 'ao' : null;
  if (!relief) return null;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-cuisson-'));
  try {
    const nomCuiseur = { couleur: 'm_color', normal: 'm_normalgl', deplacement: 'm_displacement', ao: 'm_ao' };
    for (const carte of ['couleur', 'normal', relief]) {
      const f = fichierCarte(dossierTexture, carte);
      if (!f) return null;
      fs.copyFileSync(path.join(dossierTexture, f), path.join(tmp, nomCuiseur[carte] + path.extname(f)));
    }
    const cuiseur = await import(pathToFileURL(path.join(__dirname, '..', '..', 'tools', 'bake-textures.mjs')).href);
    const res = await cuiseur.cuireMatiere3D({
      dossier: tmp, id: path.basename(dossierTexture), SORTIE: dossierTexture, nomDeSortie: 'grain',
      taille: tailleForcee || B.tailleDeCuisson(usages, cuiseur.TAILLE_GRAIN_SOL, cuiseur.TAILLE_GRAIN),
    });
    return { fichier: path.basename(res.sortie), teinte: res.teinte, nature: res.nature, raccordVisible: res.raccordVisible };
  } catch (e) {
    return null;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const cheminBiblio = (dossierProjets) => path.join(dossierProjets, B.DOSSIER, B.FICHIER);

function lireBiblio(dossierProjets){
  try { return JSON.parse(fs.readFileSync(cheminBiblio(dossierProjets), 'utf8')); } catch (e) { return B.vide(); }
}
function ecrireBiblio(dossierProjets, biblio){
  fs.mkdirSync(path.join(dossierProjets, B.DOSSIER), { recursive: true });
  const cible = cheminBiblio(dossierProjets);
  fs.writeFileSync(`${cible}.tmp`, JSON.stringify(biblio, null, 1));
  fs.renameSync(`${cible}.tmp`, cible);
}

/** « Mes textures » : les entrées dont le dossier existe encore. */
function mesTextures(dossierProjets){
  const racine = path.join(dossierProjets, B.DOSSIER);
  let dossiers = [];
  try { dossiers = fs.readdirSync(racine, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch (e) { /* aucun */ }
  return B.presentes(lireBiblio(dossierProjets), dossiers);
}

/**
 * Télécharge, range et cuit une texture : `{ entree }` ou `{ erreur }`. `progression(recus, total)`
 * au fil du téléchargement, puis `progression(null, null)` pendant la cuisson (quelques secondes).
 */
async function telecharger(dossierProjets, sourceId, id, resolution, progression, simulation){
  if (simulation) return { erreur: 'simulation' };
  if (!SOURCES.includes(sourceId)) return { erreur: 'source' };
  const lu = await recupererCartes(sourceId, id, resolution, progression);
  if (lu.erreur) return lu;
  const nomDossier = B.dossierDe(sourceId, id);
  if (!nomDossier) return { erreur: 'reponse' };
  const dossierTexture = path.join(dossierProjets, B.DOSSIER, nomDossier);
  fs.rmSync(dossierTexture, { recursive: true, force: true });
  fs.mkdirSync(dossierTexture, { recursive: true });
  for (const [carte, octets] of lu.cartes) fs.writeFileSync(path.join(dossierTexture, `${carte}.jpg`), octets);
  if (progression) progression(null, null);
  const cartes = [...lu.cartes.keys()];
  const cuisson = await cuire(dossierTexture, cartes, lu.r.usages);
  const entree = B.entreeTexture(lu.r, { resolution: lu.resolution, cartes, cuisson });
  ecrireBiblio(dossierProjets, B.ajouter(lireBiblio(dossierProjets), entree));
  return { entree };
}

/**
 * IMPORTE UN DOSSIER de cartes (demandé : « sélectionner le dossier, l'application récupère ce qu'il
 * lui faut ») : reconnaît les cartes à leur nom (B.cartesDuDossier), les copie, cuit le grain (en
 * grand format : on ne sait pas encore à quoi la texture servira), range. Les matières sont
 * devinées d'après les noms ; à défaut, la texture est « non classée » et sa fiche permet de les
 * cocher. `{ entree, ignores }`, ou `{ refus, trouves, doublons }` à montrer tel quel.
 */
async function importer(dossierProjets, cheminDossier){
  let noms;
  try { noms = fs.readdirSync(cheminDossier, { withFileTypes: true }).filter(d => d.isFile()).map(d => d.name); }
  catch (e) { return { refus: 'illisible', trouves: [] }; }
  const lu = B.cartesDuDossier(noms);
  if (lu.refus) return { refus: lu.refus, trouves: noms.filter(n => /\.(jpe?g|png)$/i.test(n)), doublons: lu.doublons || [] };
  const nomDossier = path.basename(cheminDossier);
  const id = B.idImport(nomDossier, mesTextures(dossierProjets).filter(t => t.source === 'import').map(t => t.id));
  const dossierTexture = path.join(dossierProjets, B.DOSSIER, B.dossierDe('import', id));
  fs.mkdirSync(dossierTexture, { recursive: true });
  for (const [carte, nom] of Object.entries(lu.cartes)) {
    const ext = /\.png$/i.test(nom) ? 'png' : 'jpg';
    fs.copyFileSync(path.join(cheminDossier, nom), path.join(dossierTexture, `${carte}.${ext}`));
  }
  const matieres = M.matieresParMots([nomDossier.replace(/[_-]+/g, ' '), ...noms.map(n => n.replace(/[_-]+/g, ' '))]);
  const r = { source: 'import', id, nom: nomDossier, auteur: null, url: null, licence: null,
    matieres, usages: M.usagesDe(matieres), details: { dimensions: B.TAILLE_IMPORT } };
  const cartes = Object.keys(lu.cartes);
  const cuiseur = await import(pathToFileURL(path.join(__dirname, '..', '..', 'tools', 'bake-textures.mjs')).href).catch(() => null);
  const cuisson = await cuire(dossierTexture, cartes, r.usages, cuiseur ? cuiseur.TAILLE_GRAIN_SOL : null);
  const entree = B.entreeTexture(r, { resolution: null, cartes, cuisson });
  ecrireBiblio(dossierProjets, B.ajouter(lireBiblio(dossierProjets), entree));
  return { entree, ignores: lu.ignores };
}

/** Coche les matières d'une texture (sa fiche) : ses usages en découlent. */
function changerMatieres(dossierProjets, cle, matieres){
  const propres = (Array.isArray(matieres) ? matieres : []).filter(m => M.matiere(m));
  ecrireBiblio(dossierProjets, B.avecMatieres(lireBiblio(dossierProjets), cle, propres, M.usagesDe));
  return { ok: true };
}

/** Supprime une texture de « Mes textures » : son dossier et son entrée. */
function supprimer(dossierProjets, cle){
  const biblio = lireBiblio(dossierProjets);
  const t = (biblio.textures || []).find(x => x && x.cle === cle);
  if (t && B.dossierDe(t.source, t.id) === t.dossier) {
    fs.rmSync(path.join(dossierProjets, B.DOSSIER, t.dossier), { recursive: true, force: true });
  }
  ecrireBiblio(dossierProjets, B.retirer(biblio, cle));
  return { ok: true };
}

/** Une image d'une texture de « Mes textures » (la couleur pour la vignette, le grain pour la fiche). */
function image(dossierProjets, cle, quoi){
  const t = mesTextures(dossierProjets).find(x => x.cle === cle);
  if (!t) return { ok: false };
  const nom = quoi === 'grain' ? t.grain : fichierCarte(path.join(dossierProjets, B.DOSSIER, t.dossier), 'couleur');
  if (!nom || !/^[a-z.]+\.(jpg|png)$/.test(nom)) return { ok: false };
  try {
    return { ok: true, data: new Uint8Array(fs.readFileSync(path.join(dossierProjets, B.DOSSIER, t.dossier, nom))),
      type: nom.endsWith('.png') ? 'image/png' : 'image/jpeg' };
  } catch (e) { return { ok: false }; }
}

module.exports = { infos, chercher, options, telecharger, mesTextures, supprimer, image, importer, changerMatieres };
