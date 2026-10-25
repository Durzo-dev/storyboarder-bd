/**
 * @file textures-store-ui.js
 * LE STORE DE TEXTURES (#446c) : une fenêtre À PART du store de modèles (demandé : « un autre store,
 * avec son propre bouton à côté de celui des modèles »). Trois onglets : « Mes textures » (ce qui a
 * été téléchargé), Poly Haven, ambientCG ; des filtres par matière et par usage (table validée le
 * 25 octobre 2026, electron/bibliotheque/texture-matieres.js).
 *
 * Rien n'est téléchargé d'office : seulement la texture choisie sur sa fiche, à la résolution
 * choisie (1k par défaut, 2k, et 4k pour les seules textures qui servent aux bâtiments). Le
 * processus principal télécharge, cuit le grain et range (store-textures.js) ; ici, l'interface.
 *
 * Reprend la présentation du store de modèles (grille, cartes, fiche qui remplace la grille, pied
 * collé en bas) avec ses classes : une seule apparence pour les deux fenêtres.
 */
import { tr } from './state.js';
import { enregistrerFermeture } from './modal-stack.js';
import { icone } from './icones.js';
import { ouvrirApercu3D } from './store-apercu-3d.js';

const $ = (id) => document.getElementById(id);
const api = () => globalThis.window && window.storyboarderAPI;
const LOCAL = 'local';

let infos = null;           // matières, usages, sources (textures:infos)
let onglet = LOCAL;
let page = { resultats: [], suivant: null };
let mes = [];               // « Mes textures » (textures:mes)
let generation = 0;         // une réponse arrivée après un changement d'onglet est ignorée
const enCours = new Map();  // cle → { recus, total } pendant un téléchargement
const urlsLocales = new Map();

function el(tag, { texte, classe, attrs } = {}, enfants = []){
  const n = document.createElement(tag);
  if (texte != null) n.textContent = texte;
  if (classe) n.className = classe;
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) n.setAttribute(k, v);
  for (const c of enfants) if (c) n.appendChild(c);
  return n;
}

const langue = () => tr('en', 'fr');
const nomDe = (liste, slug) => { const x = (liste || []).find(m => m.slug === slug); return x ? x[langue()] : slug; };
const nomSource = (s) => ({ polyhaven: 'Poly Haven', ambientcg: 'ambientCG' }[s] || s);
const poids = (o) => (o >= 1048576 ? `${(o / 1048576).toLocaleString(langue(), { maximumFractionDigits: 1 })} ${tr('MB', 'Mo')}`
  : `${Math.max(1, Math.round(o / 1024))} ${tr('KB', 'Ko')}`);
const cle = (r) => `${r.source}:${r.id}`;
const possedee = (r) => mes.find(t => t.cle === cle(r)) || null;
const message = (t) => { $('texturesMessage').textContent = t || ''; };

function erreurLisible(e){
  return {
    reseau: tr('No connection: check your network.', 'Pas de connexion : vérifiez le réseau.'),
    quota: tr('The source is limiting requests: try again in a minute.', 'La source limite les demandes : réessayez dans une minute.'),
    tropLourd: tr('This texture is too heavy to download.', 'Cette texture est trop lourde pour être téléchargée.'),
    corrompu: tr('A file arrived damaged: try again.', 'Un fichier est arrivé abîmé : réessayez.'),
    simulation: tr('Simulation: nothing is downloaded.', 'Simulation : rien n\'est téléchargé.'),
  }[e] || tr('The source did not answer as expected.', 'La source n\'a pas répondu comme prévu.');
}

// ── Les filtres ────────────────────────────────────────────────────────────────────────────────

function options(select, liste){
  const avant = select.value;
  select.replaceChildren(...liste.map(([v, t]) => el('option', { texte: t, attrs: { value: v } })));
  if ([...select.options].some(o => o.value === avant)) select.value = avant;
}

function rendreFiltres(){
  if (!infos) return;
  options($('texturesMatiere'), [['', tr('All materials', 'Toutes les matières')], ...infos.matieres.map(m => [m.slug, m[langue()]])]);
  options($('texturesUsage'), [['', tr('All uses', 'Tous les usages')], ...infos.usages.map(u => [u.slug, u[langue()]])]);
  options($('texturesTri'), [['populaires', tr('Most downloaded', 'Les plus téléchargées')], ['recents', tr('Newest', 'Les plus récentes')]]);
  $('texturesTri').hidden = onglet === LOCAL;
  $('texturesTexte').placeholder = tr('Search (brick, oak, grass…)', 'Chercher (brick, oak, grass…)');
}

function rendreOnglets(){
  const noms = [[LOCAL, tr('My textures', 'Mes textures')], ...(infos ? infos.sources : []).map(s => [s, nomSource(s)])];
  $('texturesOnglets').replaceChildren(...noms.map(([id, nom]) => {
    const b = el('button', { texte: nom, classe: 'onglet' + (id === onglet ? ' actif' : ''), attrs: { type: 'button', role: 'tab', 'aria-selected': String(id === onglet) } });
    b.onclick = () => { if (onglet !== id) { onglet = id; fermerFiche(); rendreFiltres(); rendreOnglets(); chercher(); } };
    return b;
  }));
  $('texturesCredit').textContent = onglet === LOCAL ? ''
    : tr(`Textures provided by ${nomSource(onglet)} (CC0, free for any use).`, `Textures fournies par ${nomSource(onglet)} (CC0, libres de tout usage).`);
}

export function rafraichirTextesTextures(){
  const btn = $('texturesOuvrirBtn');
  if (btn) { btn.title = tr('Texture library', 'Bibliothèque de textures'); btn.setAttribute('aria-label', btn.title); }
  if (!$('texturesModal') || $('texturesModal').classList.contains('hidden')) return;
  $('texturesTitre').textContent = tr('Texture library', 'Bibliothèque de textures');
  rendreFiltres();
  rendreOnglets();
  rendreGrille();
}

// ── La grille ──────────────────────────────────────────────────────────────────────────────────

function parametres(curseur){
  return { texte: $('texturesTexte').value, matiere: $('texturesMatiere').value, usage: $('texturesUsage').value,
    tri: $('texturesTri').value, curseur };
}

/** « Mes textures », filtré ici (la liste est courte) : texte, matière, usage. */
function mesFiltrees(){
  const p = parametres();
  const texte = p.texte.trim().toLowerCase();
  return mes.filter(t => (!texte || t.nom.toLowerCase().includes(texte))
    && (!p.matiere || t.matieres.includes(p.matiere)) && (!p.usage || t.usages.includes(p.usage)));
}

async function chercher(curseur = null){
  const gen = ++generation;
  message('');
  if (onglet === LOCAL) { await relireMes(); if (gen === generation) rendreGrille(); return; }
  if (!curseur) { page = { resultats: [], suivant: null }; rendreGrille(); message(tr('Searching…', 'Recherche…')); }
  const r = await api().texturesChercher(onglet, parametres(curseur));
  if (gen !== generation) return;
  message(r.erreur ? erreurLisible(r.erreur) : '');
  if (r.erreur) return;
  page = { resultats: curseur ? [...page.resultats, ...r.resultats] : r.resultats, suivant: r.suivant };
  rendreGrille();
}

async function relireMes(){
  mes = await api().texturesMes() || [];
}

async function urlLocale(t){
  if (urlsLocales.has(t.cle)) return urlsLocales.get(t.cle);
  const r = await api().texturesImage(t.cle, 'couleur');
  const url = r && r.ok ? URL.createObjectURL(new Blob([r.data], { type: r.type })) : null;
  urlsLocales.set(t.cle, url);
  return url;
}

function vignette(src){
  if (!src) return el('div', { classe: 'store-sans-vignette' });
  const img = el('img', { attrs: { src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' } });
  img.addEventListener('error', () => img.replaceWith(el('div', { classe: 'store-sans-vignette' })), { once: true });
  return img;
}

/** La coche « déjà dans Mes textures », comme celle du store de modèles. */
function pastille(){
  const p = el('span', { classe: 'store-possede', attrs: { title: tr('Already in My textures', 'Déjà dans Mes textures'), role: 'img', 'aria-label': tr('Already in My textures', 'Déjà dans Mes textures') } });
  p.innerHTML = icone('coche');
  return p;
}

function carte(r, local){
  const t = local ? r : possedee(r);
  const avancement = enCours.get(local ? r.cle : cle(r));
  const c = el('button', { classe: 'store-carte' + (t && !local ? ' store-carte-possedee' : ''), attrs: { type: 'button', title: r.nom } }, [
    local ? el('div', { classe: 'store-sans-vignette' }) : vignette(r.vignettes.petite),
    t && !local ? pastille() : null,
    el('span', { texte: r.nom, classe: 'store-carte-nom' }),
    el('span', { texte: avancement ? tr('Downloading…', 'Téléchargement…') : (local ? nomSource(r.source) : `${tr('by', 'par')} ${r.auteur.nom}`), classe: 'store-carte-auteur' }),
    // Pas de badges de matières sur la vignette (demandé : trop nombreux, illisibles) ; ils sont sur la fiche.
  ]);
  if (local) urlLocale(r).then(url => { if (url) c.firstChild.replaceWith(vignette(url)); });
  c.onclick = () => ouvrirFiche(r, local);
  return c;
}

/** La tuile « Importer un dossier », toujours en tête de « Mes textures » (demandé). */
function carteImport(){
  const c = el('button', { classe: 'store-carte store-carte-ajout', attrs: { type: 'button',
    title: tr('Choose a folder holding a texture\'s maps (colour, normal, roughness…): the application takes what it needs.',
      'Choisir le dossier qui contient les cartes d\'une texture (couleur, normale, rugosité…) : l\'application prend ce qu\'il lui faut.') } }, [
    el('span', { classe: 'store-ajout-icone' }),
    el('span', { texte: tr('Import a folder', 'Importer un dossier'), classe: 'store-carte-nom' }),
  ]);
  c.firstChild.innerHTML = icone('importer');
  c.onclick = importerUnDossier;
  return c;
}

async function importerUnDossier(){
  message('');
  const r = await api().texturesImporter();
  if (!r || r.annule) return;
  if (r.refus) {
    const trouves = (r.trouves || []).join(', ') || tr('no image', 'aucune image');
    message(r.refus === 'doublons'
      ? tr(`Several files for the same map (${r.doublons.join(', ')}): keep only one resolution in the folder. Found: ${trouves}.`,
        `Plusieurs fichiers pour une même carte (${r.doublons.join(', ')}) : ne gardez qu'une résolution dans le dossier. Trouvés : ${trouves}.`)
      : r.refus === 'couleur'
        ? tr(`No colour map recognised (a name ending in _Color, _Diffuse, _Albedo or _BaseColor). Found: ${trouves}.`,
          `Aucune carte de couleur reconnue (un nom finissant par _Color, _Diffuse, _Albedo ou _BaseColor). Trouvés : ${trouves}.`)
        : tr('This folder could not be read.', 'Ce dossier n\'a pas pu être lu.'));
    return;
  }
  await relireMes();
  rendreGrille();
  const e = r.entree;
  message(!e.matieres.length
    ? tr(`“${e.nom}” is in My textures, unclassified: tick its materials on its page so it is offered where it fits.`,
      `« ${e.nom} » est dans Mes textures, non classée : cochez ses matières sur sa fiche pour qu'elle soit proposée là où elle convient.`)
    : tr(`“${e.nom}” is in My textures.`, `« ${e.nom} » est dans Mes textures.`) + (e.grain ? '' : ' ' + tr('No grain (no displacement nor normal map): building finishes only.', 'Pas de grain (ni déplacement ni normale) : revêtements de bâtiment seulement.')));
}

function rendreGrille(){
  const g = $('texturesGrille');
  if (!infos) return;
  if (onglet === LOCAL) {
    const liste = mesFiltrees();
    g.replaceChildren(carteImport(), ...liste.map(t => carte(t, true)));
    if (mes.length && !liste.length) message(tr('No texture matches these filters.', 'Aucune texture ne correspond à ces filtres.'));
    return;
  }
  g.replaceChildren(...page.resultats.map(r => carte(r, false)));
}

/** La page suivante arrive d'elle-même en approchant du bas, comme dans le store de modèles. */
let chargementSuite = false;
async function suiteSiBesoin(){
  const z = $('texturesDefilement');
  if (onglet === LOCAL || !page.suivant || chargementSuite || !$('texturesFiche').hidden) return;
  if (z.scrollTop + z.clientHeight < z.scrollHeight - 400) return;
  chargementSuite = true;
  try { await chercher(page.suivant); } finally { chargementSuite = false; }
}

// ── La fiche ───────────────────────────────────────────────────────────────────────────────────

let ficheCourante = null;

let apercu = null;          // l'aperçu 3D ouvert ({ fermer })
let apercuGeneration = 0;

function fermerApercu(){
  apercuGeneration++;
  if (apercu) { apercu.fermer(); apercu = null; }
}

function fermerFiche(){
  const ouverte = !$('texturesFiche').hidden;
  ficheCourante = null;
  fermerApercu();
  $('texturesFiche').hidden = true;
  $('texturesFiche').replaceChildren();
  $('texturesGrille').hidden = false;
  // Ni recherche ni filtres sur une fiche (comme le store de modèles) : ils reviennent avec la liste.
  $('texturesFormulaire').hidden = false;
  // La grille est refaite : une texture téléchargée depuis la fiche y porte désormais sa coche.
  if (ouverte) { rendreGrille(); $('texturesDefilement').scrollTop = positionListe; }
}
let positionListe = 0;

const section = (titre, enfants) => el('section', { classe: 'store-fiche-section' }, [el('h5', { texte: titre }), ...enfants]);
const badges = (liste, slugs) => el('div', { classe: 'texture-badges' },
  slugs.map(s => el('span', { texte: nomDe(liste, s), classe: 'store-badge' })));

/**
 * Les matières d'une texture de « Mes textures », à cocher (pour un dossier importé, qui n'a pas de
 * catégorie, ou pour corriger celles de la source). Les changements restent EN ATTENTE jusqu'au
 * bouton « Valider », qui n'apparaît que s'il y a un changement (demandé).
 */
function matieresACocher(t){
  const boite = el('div', { classe: 'texture-matieres-boite' });
  const g = el('div', { classe: 'texture-matieres' });
  const choisies = new Set(t.matieres);
  const valider = el('button', { texte: tr('Confirm', 'Valider'), classe: 'full-btn texture-valider', attrs: { type: 'button' } });
  const change = () => {
    const avant = new Set(t.matieres);
    valider.hidden = avant.size === choisies.size && [...avant].every(m => choisies.has(m));
  };
  for (const m of infos.matieres) {
    const b = el('button', { texte: m[langue()], classe: choisies.has(m.slug) ? 'actif' : '', attrs: { type: 'button', 'aria-pressed': String(choisies.has(m.slug)) } });
    b.onclick = () => {
      if (choisies.has(m.slug)) choisies.delete(m.slug); else choisies.add(m.slug);
      b.classList.toggle('actif', choisies.has(m.slug));
      b.setAttribute('aria-pressed', String(choisies.has(m.slug)));
      change();
    };
    g.appendChild(b);
  }
  valider.onclick = async () => {
    valider.disabled = true;
    await api().texturesMatieres(t.cle, infos.matieres.map(x => x.slug).filter(s => choisies.has(s)));
    await relireMes();
    const neuve = mes.find(x => x.cle === t.cle);
    if (neuve) ouvrirFiche(neuve, true);
  };
  change();
  boite.append(g, valider);
  return boite;
}

const tailleReelle = (d) => (d ? `${d[0].toLocaleString(langue())} × ${d[1].toLocaleString(langue())} m` : null);

/**
 * L'APERÇU 3D (demandé, comme le store de modèles) : une sphère habillée de la matière, éclairée
 * comme une Case. Les cartes arrivent en mémoire (textures:cartes) : celles du disque pour une
 * texture de « Mes textures », celles de la source en 1k sinon (rien n'est rangé).
 */
async function sphereDeLaMatiere(cartes){
  const T = globalThis.THREE;
  const charger = (octets, type) => new Promise((resolve) => {
    if (!octets) { resolve(null); return; }
    const url = URL.createObjectURL(new Blob([octets], { type }));
    new T.TextureLoader().load(url, (tex) => { URL.revokeObjectURL(url); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(2, 1); resolve(tex); },
      undefined, () => { URL.revokeObjectURL(url); resolve(null); });
  });
  const [map, normalMap, roughnessMap, aoMap] = await Promise.all(['couleur', 'normal', 'rugosite', 'ao']
    .map(c => charger(cartes[c] && cartes[c].data, cartes[c] && cartes[c].type)));
  const geo = new T.SphereGeometry(1, 96, 64);
  geo.setAttribute('uv2', geo.getAttribute('uv'));   // l'AO lit le second jeu d'UV (three r128)
  const mat = new T.MeshStandardMaterial({ map, normalMap, roughnessMap, aoMap, roughness: roughnessMap ? 1 : 0.8, metalness: 0 });
  return new T.Mesh(geo, mat);
}

function boutonApercu(r, visuel, image){
  const b = el('button', { texte: tr('View in 3D', 'Voir en 3D'), classe: 'nav-btn', attrs: { type: 'button' } });
  let en3D = false;
  b.onclick = async () => {
    en3D = !en3D;
    b.textContent = en3D ? tr('View the image', 'Voir l\'image') : tr('View in 3D', 'Voir en 3D');
    fermerApercu();
    if (!en3D) { visuel.replaceChildren(...image()); return; }
    const moi = apercuGeneration;
    const etiquette = el('p', { texte: tr('Loading the material…', 'Chargement de la matière…'), classe: 'store-apercu-chargement' });
    visuel.replaceChildren(etiquette);
    const rep = await api().texturesCartes(r.source, r.id).catch(() => ({ erreur: 'reseau' }));
    if (moi !== apercuGeneration) return;
    if (!rep || rep.erreur || !rep.cartes || !rep.cartes.couleur) { etiquette.textContent = erreurLisible(rep && rep.erreur); etiquette.classList.add('erreur'); return; }
    const objet = await sphereDeLaMatiere(rep.cartes);
    if (moi !== apercuGeneration) return;
    visuel.replaceChildren();
    try { apercu = await ouvrirApercu3D(visuel, null, { objet }); } catch (e) { etiquette.textContent = erreurLisible(); visuel.replaceChildren(etiquette); }
    if (moi !== apercuGeneration && apercu) { apercu.fermer(); apercu = null; }
  };
  return b;
}

/**
 * Le bouton « Télécharger » et, collée à sa droite, la flèche du choix de la résolution (comme le
 * store de modèles) : 1k par défaut ; 2k ; 4k pour les seules textures qui servent aux bâtiments.
 */
function boutonTelecharger(r, note){
  const telecharger = el('button', { texte: tr('Download', 'Télécharger'), classe: 'full-btn', attrs: { type: 'button' } });
  const fleche = el('button', { texte: '▾', classe: 'full-btn store-bouton-fleche', attrs: { type: 'button', title: tr('Texture quality', 'Qualité de la texture'), 'aria-haspopup': 'menu' } });
  const menu = el('div', { classe: 'store-menu-resolutions', attrs: { role: 'menu', hidden: '' } });
  const scinde = el('div', { classe: 'store-bouton-scinde' }, [telecharger, fleche, menu]);
  telecharger.disabled = true;
  fleche.hidden = true;
  let options = [], choisie = null;
  const majTexte = () => {
    const x = options.find(y => y.resolution === choisie);
    telecharger.textContent = x ? `${tr('Download', 'Télécharger')} ${choisie.toLowerCase()} (${poids(x.octets)})` : tr('Download', 'Télécharger');
  };
  const rendreMenu = () => menu.replaceChildren(...options.map(x => {
    const b = el('button', { texte: `${x.resolution.toLowerCase()} · ${poids(x.octets)}`, classe: 'store-menu-resolution' + (x.resolution === choisie ? ' actif' : ''), attrs: { type: 'button', role: 'menuitem' } });
    b.onclick = () => { choisie = x.resolution; menu.hidden = true; rendreMenu(); majTexte(); };
    return b;
  }));
  fleche.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  api().texturesOptions(r.source, r.id).then(o => {
    if (!ficheCourante || ficheCourante.r !== r) return;
    if (o.erreur || !o.options || !o.options.length) { note.textContent = erreurLisible(o.erreur); return; }
    options = o.options;
    choisie = options[0].resolution;
    note.textContent = options.length > 2
      ? tr('1k by default; 4k is offered because this texture serves buildings (close-ups).', '1k par défaut ; la 4k est proposée parce que cette texture sert aux bâtiments (gros plans).')
      : tr('1k is enough for almost everything; 2k for close-ups.', 'La 1k suffit presque toujours ; la 2k pour les gros plans.');
    fleche.hidden = options.length < 2;
    scinde.classList.toggle('avec-fleche', options.length > 1);
    rendreMenu(); majTexte();
    telecharger.disabled = false;
  });
  telecharger.onclick = async () => {
    telecharger.disabled = true; fleche.disabled = true;
    enCours.set(cle(r), { recus: 0, total: 0 });
    telecharger.textContent = tr('Downloading…', 'Téléchargement…');
    const res = await api().texturesTelecharger(r.source, r.id, choisie);
    enCours.delete(cle(r));
    if (res.erreur) { message(erreurLisible(res.erreur)); telecharger.disabled = false; fleche.disabled = false; majTexte(); return; }
    await relireMes();
    message(res.entree && res.entree.raccordVisible
      ? tr(`“${r.nom}” is in My textures (visible seam: it does not tile perfectly).`, `« ${r.nom} » est dans Mes textures (raccord visible : elle ne se répète pas parfaitement).`)
      : tr(`“${r.nom}” is in My textures.`, `« ${r.nom} » est dans Mes textures.`));
    if (ficheCourante && ficheCourante.r === r) ouvrirFiche(r, false);
  };
  return scinde;
}

/** « Supprimer » : depuis Mes textures, ou depuis la fiche d'une source quand on l'a déjà (demandé). */
function boutonSupprimer(t, apres){
  const b = el('button', { texte: tr('Delete', 'Supprimer'), classe: 'full-btn delete-btn', attrs: { type: 'button' } });
  b.onclick = async () => {
    if (_rappels.confirmer && !(await _rappels.confirmer(tr(`Delete the texture “${t.nom}” from the disk?`, `Supprimer la texture « ${t.nom} » du disque ?`)))) return;
    await api().texturesSupprimer(t.cle);
    urlsLocales.delete(t.cle);
    await relireMes();
    apres();
  };
  return b;
}

async function ouvrirFiche(r, local){
  fermerApercu();
  ficheCourante = { r, local };
  const fiche = $('texturesFiche');
  const t = local ? r : possedee(r);
  const visuel = el('div', { classe: 'store-fiche-visuel' });
  let urlImage = local ? null : r.vignettes.grande;
  const image = () => (urlImage ? [vignette(urlImage)] : []);
  if (local) urlLocale(r).then(url => { urlImage = url; if (url && ficheCourante && ficheCourante.r === r && !apercu) visuel.replaceChildren(...image()); });
  else visuel.replaceChildren(...image());
  const boutons = el('div', { classe: 'store-fiche-boutons' }, [boutonApercu(r, visuel, image)]);
  const gauche = el('div', { classe: 'store-fiche-gauche' }, [visuel, boutons]);
  const dims = local ? r.dimensions : r.details.dimensions;
  const droite = el('div', { classe: 'store-fiche-droite' }, [
    el('h4', { texte: r.nom }),
    el('p', { classe: 'store-fiche-texte', texte: r.source === 'import' ? tr('Imported from a folder', 'Importée d\'un dossier')
      : `${nomSource(r.source)} · ${tr('by', 'par')} ${(r.auteur && r.auteur.nom) || nomSource(r.source)} · CC0` }),
    section(tr('Materials', 'Matières'), [local ? matieresACocher(r) : badges(infos.matieres, r.matieres)]),
    section(tr('Uses', 'Usages'), [r.usages.length ? badges(infos.usages, r.usages)
      : el('p', { classe: 'store-fiche-texte', texte: tr('Unclassified: tick its materials above.', 'Non classée : cochez ses matières ci-dessus.') })]),
    tailleReelle(dims) ? section(tr('Real size of one tile', 'Taille réelle d\'une tuile'), [el('p', { classe: 'store-fiche-texte', texte: tailleReelle(dims) })]) : null,
    t ? section(tr('In My textures', 'Dans Mes textures'), [el('p', { classe: 'store-fiche-texte', texte: [
      t.resolution ? `${tr('Resolution', 'Résolution')} ${t.resolution.toLowerCase()}` : null,
      t.grain ? tr('ground and path grain ready', 'grain du Sol et des Tracés prêt') : tr('no grain: building finishes only', 'pas de grain : revêtements de bâtiment seulement'),
    ].filter(Boolean).join(' · ') }), t.raccordVisible ? el('p', { classe: 'store-fiche-texte texture-raccord', texte: tr('Visible seam: this texture does not tile perfectly.', 'Raccord visible : cette texture ne se répète pas parfaitement.') }) : null]) : null,
  ]);
  const retour = el('button', { texte: tr('Back', 'Retour'), classe: 'nav-btn', attrs: { type: 'button' } });
  retour.onclick = fermerFiche;
  const note = el('p', { classe: 'store-note' });
  // Déjà dans Mes textures : on propose de la SUPPRIMER, pas de la retélécharger (demandé).
  const action = t ? boutonSupprimer(t, () => (local ? fermerFiche() : ouvrirFiche(r, false))) : boutonTelecharger(r, note);
  fiche.replaceChildren(el('div', { classe: 'store-fiche-corps' }, [gauche, droite]),
    el('div', { classe: 'store-fiche-pied' }, [el('div', { classe: 'store-fiche-actions' }, [retour, action]), note]));
  if ($('texturesFiche').hidden) positionListe = $('texturesDefilement').scrollTop;
  $('texturesGrille').hidden = true;
  $('texturesFormulaire').hidden = true;
  fiche.hidden = false;
  $('texturesDefilement').scrollTop = 0;
}

function suivreProgression(sourceId, id, recus, total){
  const k = `${sourceId}:${id}`;
  if (!enCours.has(k)) return;
  enCours.set(k, { recus, total });
  if (!ficheCourante || ficheCourante.local || cle(ficheCourante.r) !== k) return;
  const b = $('texturesFiche').querySelector('.store-bouton-scinde > .full-btn');
  if (!b) return;
  b.textContent = recus == null ? tr('Preparing the grain…', 'Préparation du grain…')
    : `${tr('Downloading', 'Téléchargement')} ${total ? Math.round(recus / total * 100) : 0} %`;
}

// ── Ouvrir, fermer, câbler ─────────────────────────────────────────────────────────────────────

export async function ouvrirTextures(){
  $('texturesModal').classList.remove('hidden');
  if (!infos) infos = await api().texturesInfos();
  $('texturesSimulation').hidden = !infos.simulation;
  $('texturesSimulation').textContent = infos.simulation ? tr('Simulation: recorded answers, nothing is downloaded.', 'Simulation : réponses enregistrées, rien n\'est téléchargé.') : '';
  rafraichirTextesTextures();
  await relireMes();
  chercher();
}

export function fermerTextures(){
  fermerFiche();
  $('texturesModal').classList.add('hidden');
}

let _rappels = {};
/** Le câblage, une fois. Rappel injecté par events.js : `confirmer(message)` (la modale commune). */
export function cablerTextures(rappels = {}){
  _rappels = rappels || {};
  const texturesModal = document.getElementById('texturesModal');
  const modale = texturesModal;
  if (!modale || !api()) return;
  $('texturesOuvrirBtn').onclick = () => { if (modale.classList.contains('hidden')) ouvrirTextures(); else fermerTextures(); };
  $('texturesFermer').onclick = fermerTextures;
  texturesModal.addEventListener('mousedown', (e) => { if (e.target === texturesModal) fermerTextures(); });
  let minuterie = null;
  $('texturesTexte').addEventListener('input', () => { clearTimeout(minuterie); minuterie = setTimeout(() => chercher(), 300); });
  for (const id of ['texturesMatiere', 'texturesUsage', 'texturesTri']) $(id).addEventListener('change', () => { fermerFiche(); chercher(); });
  $('texturesFormulaire').addEventListener('submit', (e) => { e.preventDefault(); chercher(); });
  $('texturesDefilement').addEventListener('scroll', suiteSiBesoin);
  // Le menu des résolutions se referme au premier clic ailleurs, comme celui du store de modèles.
  texturesModal.addEventListener('click', (e) => {
    if (!e.target.closest('.store-bouton-scinde')) texturesModal.querySelectorAll('.store-menu-resolutions').forEach(m => { m.hidden = true; });
  });
  if (api().surProgressionTexture) api().surProgressionTexture(suivreProgression);
  enregistrerFermeture('texturesModal', fermerTextures);
  rafraichirTextesTextures();
}
