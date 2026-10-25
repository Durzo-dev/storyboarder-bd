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
import { tr, S } from './state.js';
import { utilisationsDe, PREFIXE, chargerTexturesUtilisateur } from './textures-utilisateur.js';
import { texturesIntegrees, valeurChoisie, textureDeLaValeur, SOURCE as INTEGREE } from './textures-integrees.js';
import { appliquerTeinteAuMotif3D, rvbDeCouleur3D, natureDuNom3D } from './bubble-texture.js';
import { GROUND_PLANE_SIZE_3D } from './constants.js';
import { enregistrerFermeture } from './modal-stack.js';
import { avalerLaSuiteDuGeste } from './avaler-geste.js';
import { icone } from './icones.js';
import { ouvrirApercu3D } from './store-apercu-3d.js';
import { menuFlottant } from './store-ui.js';
import { remplirListeEtiquettes } from './liste-etiquettes.js';
import { textesStore, phrasesLicence } from './store-texts.js';

const $ = (id) => document.getElementById(id);
const api = () => globalThis.window && window.storyboarderAPI;
const LOCAL = 'local';

let infos = null;           // matières, usages, sources (textures:infos)
let onglet = LOCAL;
let page = { resultats: [], suivant: null };
let mes = [];               // « Mes textures » (textures:mes)
let tags = [];              // les tags de l'utilisateur (textures:tags)
let tagsFiltre = [];        // les tags cochés dans le filtre de « Mes textures »
let generation = 0;         // une réponse arrivée après un changement d'onglet est ignorée
const enCours = new Map();  // cle → { recus, total } pendant un téléchargement
const urlsLocales = new Map();
let integrees = [];         // les textures livrées avec l'application, montrées dans « Mes textures »
let mesCharges = false;     // « Mes textures » a été lue au moins une fois (les carrés du Sol et des Tracés)
let infosIntegrees = { noms: {}, poids: {} };   // textures:integrees : les noms donnés, le poids des grains

/** Les textures livrées, avec le nom que l'utilisateur leur a donné et le poids de leur grain. */
function lesIntegrees(){
  return texturesIntegrees().map(t => {
    const nom = infosIntegrees.noms[t.cle];
    return { ...t, nom: nom || t.nom, nomEn: nom || t.nomEn, renommee: !!nom, poids: t.grain ? infosIntegrees.poids[t.grain] || null : null };
  });
}

async function relireIntegrees(){
  try { infosIntegrees = (api().texturesIntegrees && await api().texturesIntegrees()) || infosIntegrees; } catch (e) { /* sans noms ni poids */ }
  integrees = lesIntegrees();
}

/**
 * LE MODE « CHOISIR » (demandé) : le store s'ouvre depuis le carré de texture de la section Sol ou
 * de la fenêtre d'un Tracé, sur « Mes textures », filtré sur cet usage (verrouillé). Un clic sur une
 * carte l'APPLIQUE et referme ; une texture en ligne est d'abord téléchargée (en 1k), puis appliquée.
 * `{ usage, actuelle, appliquer(valeur), titre }`, ou null hors de ce mode.
 */
let choix = null;

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
const nomSource = (s) => ({ polyhaven: 'Poly Haven', ambientcg: 'ambientCG', import: tr('Imported folder', 'Dossier importé'), [INTEGREE]: tr('Built in', 'Intégrée') }[s] || s);
/** Le nom d'une texture dans la langue : une texture livrée a les deux, les autres celui de leur source. */
const nomTexture = (t) => (t.integree && langue() === 'en' ? t.nomEn : t.nom);
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

/** Le filtre par tags de « Mes textures », à côté des matières (comme « Mes modèles »). */
function rendreFiltreTags(){
  const zone = $('texturesTagsZone'), bouton = $('texturesTagsBtn');
  if (!zone || !bouton) return;
  zone.hidden = onglet !== LOCAL;
  bouton.textContent = tagsFiltre.length ? tr(`${tagsFiltre.length} tag(s)`, `${tagsFiltre.length} tag(s)`) : tr('All tags', 'Tous les tags');
  bouton.classList.toggle('actif', tagsFiltre.length > 0);
  const remplir = (menu) => remplirListeTags(menu, {
    estCoche: (e) => tagsFiltre.includes(e.id),
    cocher: (e, actif) => { tagsFiltre = actif ? [...tagsFiltre, e.id] : tagsFiltre.filter(x => x !== e.id); },
    refaire: () => { rendreFiltreTags(); rendreGrille(); const m = zone.querySelector('.store-menu-flottant'); if (m) { m.replaceChildren(); remplir(m); } },
  });
  bouton.onclick = () => menuFlottant(zone, remplir, 'store-menu-tags', null, bouton);
}

function rendreFiltres(){
  if (!infos) return;
  rendreFiltreTags();
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
  // Un LIEN vers le site, comme la mention du store de modèles (demandé) ; sans la licence, déjà dite
  // sur chaque fiche (demandé : elle alourdissait la phrase).
  const SITES = { polyhaven: 'https://polyhaven.com/textures', ambientcg: 'https://ambientcg.com' };
  $('texturesCredit').replaceChildren(...(onglet === LOCAL ? []
    : [lien(tr(`Textures provided by ${nomSource(onglet)}`, `Textures fournies par ${nomSource(onglet)}`), SITES[onglet])]));
}

export function rafraichirTextesTextures(){
  const btn = $('texturesOuvrirBtn');
  if (btn) { btn.title = tr('Texture library', 'Bibliothèque de textures'); btn.setAttribute('aria-label', btn.title); }
  if (!$('texturesModal') || $('texturesModal').classList.contains('hidden')) return;
  $('texturesTitre').textContent = choix ? choix.titre : tr('Texture library', 'Bibliothèque de textures');
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
  // En mode « choisir », seulement ce qui peut servir ici : une texture sans grain (bâtiments
  // seulement) ne s'applique ni au Sol ni à un Tracé.
  const utile = (t) => !choix || (t.usages.includes(choix.usage) && (t.integree || !!t.grain));
  return [...mes, ...integrees].filter(t => utile(t) && (!texte || nomTexture(t).toLowerCase().includes(texte))
    && (!p.matiere || t.matieres.includes(p.matiere)) && (!p.usage || t.usages.includes(p.usage))
    && tagsFiltre.every(id => (t.tags || []).includes(id)));
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

/**
 * Où une texture sert dans le Projet ouvert (#446d) : Sol, Zone de terrain ou Tracé, compté par Case
 * et par Scène. Les autres Projets ne sont pas lus, et la phrase le dit.
 */
function phraseUtilisation(t){
  const { tomes, scenes } = utilisationsDe(PREFIXE + t.dossier, { tomes: S.tomes || [], scenes: S.scenes || [] });
  if (!tomes && !scenes) return tr('Used nowhere in this Project. Other Projects are not checked.', 'Utilisée nulle part dans ce Projet. Les autres Projets ne sont pas vérifiés.');
  const fois = (n) => tr(n > 1 ? `${n} times` : 'once', n > 1 ? `${n} fois` : 'une fois');
  const morceaux = [];
  if (tomes) morceaux.push(tr(`${fois(tomes)} in the Volumes`, `${fois(tomes)} dans les Tomes`));
  if (scenes) morceaux.push(tr(`${fois(scenes)} in the Scenes`, `${fois(scenes)} dans les Scènes`));
  return tr(`Used ${morceaux.join(' and ')} (Ground, terrain zones, paths). Other Projects are not checked.`,
    `Utilisée ${morceaux.join(' et ')} (Sol, zones de terrain, tracés). Les autres Projets ne sont pas vérifiés.`);
}

async function relireMes(){
  [mes, tags] = await Promise.all([api().texturesMes(), api().texturesTags ? api().texturesTags() : []]);
  mes = mes || []; tags = (tags || []).slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  await relireIntegrees();
  mesCharges = true;
  tagsFiltre = tagsFiltre.filter(id => tags.some(t => t.id === id));
  // #446d : le Sol et les Tracés proposent « Mes textures » ; une texture téléchargée, importée,
  // supprimée ou reclassée doit y paraître (ou en partir) sans redémarrer.
  window.dispatchEvent(new window.CustomEvent('textures-utilisateur'));
}

/**
 * L'image d'une texture livrée : son grain (assets/textures), teint de sa teinte comme le fait le
 * rendu, réduit à 256 px. Une matière DESSINÉE (Neutre, Eau) n'a pas de photo : un aplat de sa couleur.
 */
function urlIntegree(t, taille = 256){
  return toileIntegree(t, taille).then(r => (r ? r.toile.toDataURL('image/jpeg', 0.9) : null));
}

/**
 * La toile d'une texture livrée, teinte comme dans le rendu : `{ toile, largeurNaturelle, grain }`.
 * `taille` null : la taille du grain (la fiche et l'aperçu 3D, pour une image nette). Une matière
 * DESSINÉE (Neutre, Eau) n'a pas de photo : un aplat de sa couleur.
 */
function toileIntegree(t, taille){
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') { resolve(null); return; }
    const toile = document.createElement('canvas');
    const aplat = () => {
      toile.width = toile.height = taille || 256;
      const c = toile.getContext('2d');
      c.fillStyle = t.teinte || '#888';
      c.fillRect(0, 0, toile.width, toile.height);
      resolve({ toile, largeurNaturelle: null, grain: null });
    };
    if (!t.grain) { aplat(); return; }
    const img = new Image();
    img.onload = () => {
      const L = taille || img.naturalWidth, H = taille || img.naturalHeight;
      toile.width = L; toile.height = H;
      const c = toile.getContext('2d', { willReadFrequently: true });
      c.drawImage(img, 0, 0, L, H);
      const d = c.getImageData(0, 0, L, H);
      const rvb = rvbDeCouleur3D(t.teinte);
      if (rvb) appliquerTeinteAuMotif3D(d.data, rvb, natureDuNom3D(t.grain));
      c.putImageData(d, 0, 0);
      resolve({ toile, largeurNaturelle: img.naturalWidth, grain: img });
    };
    img.onerror = aplat;
    img.src = `../assets/textures/${t.grain}.png`;
  });
}

/**
 * Les cartes d'une texture livrée pour l'aperçu 3D (demandé : « comme les autres »), au format de
 * textures:cartes. Seul le grain cuit est livré : la COULEUR est le grain teint, le RELIEF une normale
 * tirée de ses nuances (un gradient de Sobel, qui se répète comme la tuile). Une matière dessinée n'a
 * que sa couleur.
 */
async function cartesIntegrees(t){
  const r = await toileIntegree(t, null);
  if (!r) return { erreur: 'reponse' };
  const octets = (toile) => new Promise(ok => toile.toBlob(b => (b ? b.arrayBuffer().then(a => ok({ data: new Uint8Array(a), type: 'image/png' })) : ok(null)), 'image/png'));
  const cartes = { couleur: await octets(r.toile) };
  if (r.grain) {
    const L = r.toile.width, H = r.toile.height;
    const g = document.createElement('canvas');
    g.width = L; g.height = H;
    const gc = g.getContext('2d', { willReadFrequently: true });
    gc.drawImage(r.grain, 0, 0, L, H);
    const src = gc.getImageData(0, 0, L, H).data;
    const n = gc.createImageData(L, H);
    const lum = (x, y) => { const i = (((y + H) % H) * L + ((x + L) % L)) * 4; return (src[i] + src[i + 1] + src[i + 2]) / 765; };
    const FORCE = 3;
    for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
      const dx = (lum(x + 1, y - 1) + 2 * lum(x + 1, y) + lum(x + 1, y + 1)) - (lum(x - 1, y - 1) + 2 * lum(x - 1, y) + lum(x - 1, y + 1));
      const dy = (lum(x - 1, y + 1) + 2 * lum(x, y + 1) + lum(x + 1, y + 1)) - (lum(x - 1, y - 1) + 2 * lum(x, y - 1) + lum(x + 1, y - 1));
      let nx = -dx * FORCE, ny = dy * FORCE, nz = 1;
      const k = 1 / Math.hypot(nx, ny, nz);
      nx *= k; ny *= k; nz *= k;
      const i = (y * L + x) * 4;
      n.data[i] = (nx * 0.5 + 0.5) * 255; n.data[i + 1] = (ny * 0.5 + 0.5) * 255; n.data[i + 2] = (nz * 0.5 + 0.5) * 255; n.data[i + 3] = 255;
    }
    gc.putImageData(n, 0, 0);
    cartes.normal = await octets(g);
  }
  return { cartes };
}

/**
 * L'IMAGE D'UNE TEXTURE SUR SA FICHE : elle se RÉPÈTE pour remplir le cadre (signalé : floue et
 * entre deux bandes noires). Une texture est faite pour ça ; deux tuiles dans la largeur.
 */
function tuileDeFiche(url){
  const d = el('div', { classe: 'texture-fiche-tuile' });
  d.style.backgroundImage = `url("${url}")`;
  return d;
}

async function urlLocale(t){
  if (urlsLocales.has(t.cle)) return urlsLocales.get(t.cle);
  if (t.integree) { const u = await urlIntegree(t); urlsLocales.set(t.cle, u); return u; }
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
  const valeur = choix && t ? valeurChoisie(t, choix.usage) : undefined;
  const actuelle = choix && valeur !== undefined && valeur === choix.actuelle;
  const c = el('button', { classe: 'store-carte' + (t && !local ? ' store-carte-possedee' : '') + (actuelle ? ' store-carte-actuelle' : ''), attrs: { type: 'button', title: nomTexture(r) } }, [
    local ? el('div', { classe: 'store-sans-vignette' }) : vignette(r.vignettes.petite),
    t && !local ? pastille() : null,
    el('span', { texte: nomTexture(r), classe: 'store-carte-nom' }),
    el('span', { texte: avancement ? (avancement.total ? `${tr('Downloading', 'Téléchargement')} ${Math.round(avancement.recus / avancement.total * 100)} %` : tr('Downloading…', 'Téléchargement…'))
      : (local ? nomSource(r.source) : `${tr('by', 'par')} ${r.auteur.nom}`), classe: 'store-carte-auteur' }),
    // Pas de badges de matières sur la vignette (demandé : trop nombreux, illisibles) ; ils sont sur la fiche.
    // Le poids sous la provenance, comme sur une carte de « Mes modèles » (demandé).
    local && r.poids ? el('span', { classe: 'store-carte-infos' }, [el('span', { texte: poids(r.poids) })]) : null,
  ]);
  // Une texture À PLAT remplit sa carte (style.css, .texture-a-plat) : elle se répète, la couper ne perd rien.
  if (local) urlLocale(r).then(url => { if (url) { const v = vignette(url); v.classList.add('texture-a-plat'); c.firstChild.replaceWith(v); } });
  c.onclick = () => (choix ? choisirCarte(r, local) : ouvrirFiche(r, local));
  // Clic droit : renommer, supprimer (demandé ; une texture livrée ne se supprime pas). Le menu est
  // celui du reste de l'application (events.js), comme pour les modèles et les polices.
  if (local) c.addEventListener('contextmenu', (ev) => { ev.preventDefault(); if (_rappels.menuTexture) _rappels.menuTexture(ev, r); });
  return c;
}

/**
 * Le clic d'une carte en mode « choisir » : appliquer, en téléchargeant d'abord si besoin (en 1k, la
 * résolution par défaut d'une fiche). Les textures de l'utilisateur sont réinscrites AVANT
 * d'appliquer : la matière doit exister quand le Sol la cherche.
 */
async function choisirCarte(r, local){
  if (!choix) return;
  const appliquer = async (t) => {
    const v = valeurChoisie(t, choix.usage);
    if (v === undefined) return;
    if (!t.integree) await chargerTexturesUtilisateur(api(), null);
    const rappel = choix.appliquer;
    fermerTextures();
    rappel(v);
  };
  if (local) { await appliquer(r); return; }
  const deja = possedee(r);
  if (deja) { await appliquer(deja); return; }
  if (enCours.has(cle(r))) return;
  message('');
  enCours.set(cle(r), { recus: 0, total: 0 });
  rendreGrille();
  const o = await api().texturesOptions(r.source, r.id).catch(() => ({ erreur: 'reseau' }));
  const res = o && !o.erreur && o.options && o.options.length
    ? await api().texturesTelecharger(r.source, r.id, o.options[0].resolution) : { erreur: (o && o.erreur) || 'reponse' };
  enCours.delete(cle(r));
  if (res.erreur) { message(erreurLisible(res.erreur)); rendreGrille(); return; }
  await relireMes();
  const t = possedee(r);
  if (!t || !t.grain) {
    message(tr(`“${r.nom}” is in My textures, but has no relief image: it can only be used for buildings.`,
      `« ${r.nom} » est dans Mes textures, mais sans image de relief : elle ne sert qu'aux bâtiments.`));
    rendreGrille();
    return;
  }
  await appliquer(t);
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
    g.replaceChildren(...(choix ? [] : [carteImport()]), ...liste.map(t => carte(t, true)));
    if (!liste.length) message(tr('No texture matches these filters.', 'Aucune texture ne correspond à ces filtres.'));
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
  $('texturesCredit').hidden = false;
  // La grille est refaite : une texture téléchargée depuis la fiche y porte désormais sa coche.
  if (ouverte) { rendreGrille(); $('texturesDefilement').scrollTop = positionListe; }
}
let positionListe = 0;

const section = (titre, enfants) => el('section', { classe: 'store-fiche-section' }, [el('h5', { texte: titre }), ...enfants]);

const tailleReelle = (d) => (d ? `${d[0].toLocaleString(langue())} × ${d[1].toLocaleString(langue())} m` : null);

/**
 * L'APERÇU 3D (demandé, comme le store de modèles) : une sphère habillée de la matière, éclairée
 * comme une Case. Les cartes arrivent en mémoire (textures:cartes) : celles du disque pour une
 * texture de « Mes textures », celles de la source en 1k sinon (rien n'est rangé).
 */
async function sphereDeLaMatiere(cartes, forme = 'rond'){
  const T = globalThis.THREE;
  const charger = (octets, type) => new Promise((resolve) => {
    if (!octets) { resolve(null); return; }
    const url = URL.createObjectURL(new Blob([octets], { type }));
    new T.TextureLoader().load(url, (tex) => { URL.revokeObjectURL(url); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(2, 1); resolve(tex); },
      undefined, () => { URL.revokeObjectURL(url); resolve(null); });
  });
  const [map, normalMap, roughnessMap, aoMap] = await Promise.all(['couleur', 'normal', 'rugosite', 'ao']
    .map(c => charger(cartes[c] && cartes[c].data, cartes[c] && cartes[c].type)));
  // « Rond » : une sphère ; « à plat » : un pan carré de deux tuiles de côté, où la répétition et
  // ses éventuelles coutures se voient comme sur un mur (demandé).
  if (forme === 'plat') [map, normalMap, roughnessMap, aoMap].forEach(t => t && t.repeat.set(2, 2));
  const geo = forme === 'plat' ? new T.PlaneGeometry(2, 2, 1, 1) : new T.SphereGeometry(1, 96, 64);
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
    const rep = r.integree ? await cartesIntegrees(r) : await api().texturesCartes(r.source, r.id).catch(() => ({ erreur: 'reseau' }));
    if (moi !== apercuGeneration) return;
    if (!rep || rep.erreur || !rep.cartes || !rep.cartes.couleur) { etiquette.textContent = erreurLisible(rep && rep.erreur); etiquette.classList.add('erreur'); return; }
    // La forme : RONDE d'abord ; le bouton en haut à droite de l'aperçu bascule à plat et retour
    // (demandé), en montrant l'icône de la forme où l'on PASSERA au clic.
    const montrer = async (forme) => {
      const objet = await sphereDeLaMatiere(rep.cartes, forme);
      if (moi !== apercuGeneration) return;
      if (apercu) { apercu.fermer(); apercu = null; }
      visuel.replaceChildren();
      try { apercu = await ouvrirApercu3D(visuel, null, { objet }); } catch (e) { etiquette.textContent = erreurLisible(); visuel.replaceChildren(etiquette); return; }
      if (moi !== apercuGeneration) { apercu.fermer(); apercu = null; return; }
      const autre = forme === 'rond' ? 'plat' : 'rond';
      const nom = autre === 'plat' ? tr('Show flat', 'Voir à plat') : tr('Show on a sphere', 'Voir en rond');
      const bascule = el('button', { classe: 'preview-corner-btn texture-forme-btn', attrs: { type: 'button', title: nom, 'aria-label': nom } });
      bascule.innerHTML = ICONE_FORME[autre];
      bascule.onclick = () => montrer(autre);
      visuel.appendChild(bascule);
    };
    await montrer('rond');
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
    const li = $('texturesFiche').querySelector('.texture-poids');
    if (li && x) { li.hidden = false; li.textContent = `${tr('Weight', 'Poids')} : ${poids(x.octets)} (${choisie.toLowerCase()})`; }
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

// ── Le classement d'une texture de « Mes textures » : matières (choix multiple), usages, tags ──

/** La liste commune des tags (comme « Mes modèles ») : créer, renommer, supprimer, cocher. */
function remplirListeTags(menu, { estCoche, cocher, apresCreation, refaire }){
  const t = textesStore(langue());
  const operer = async (op, args) => { const r = await api().texturesOperationTags(op, args); await relireMes(); return r; };
  remplirListeEtiquettes(menu, {
    etiquettes: () => tags,
    estCoche, cocher: async (e, actif) => { await cocher(e, actif); await relireMes(); }, apresCreation, refaire,
    creer: (nom) => operer('creerTag', { nom }),
    renommer: (e, nom) => operer('renommerTag', { id: e.id, nom }),
    supprimer: async (e) => {
      const n = mes.filter(x => (x.tags || []).includes(e.id)).length;
      const ok = _rappels.confirmer ? await _rappels.confirmer(tr(`Delete the tag “${e.nom}”? ${n ? `It will be removed from ${n} texture(s).` : 'No texture has it.'}`,
        `Supprimer le tag « ${e.nom} » ? ${n ? `Il sera retiré de ${n} texture(s).` : 'Aucune texture ne le porte.'}`)) : true;
      if (!ok) return false;
      await operer('supprimerTag', { id: e.id });
      tagsFiltre = tagsFiltre.filter(x => x !== e.id);
      return true;
    },
    textes: { nouvelle: t.nouveauTag, aucune: t.aucunTag, renommer: t.renommerTag, supprimer: t.supprimerTag, erreurs: t.erreursTag },
  });
}

/**
 * Le bloc « matières + usages + tags » d'une fiche de « Mes textures » (demandé : comme la catégorie
 * et les tags d'un modèle). Les matières se choisissent dans un menu à CHOIX MULTIPLE ; les usages
 * en découlent et s'affichent dessous ; puis les tags de l'utilisateur et « + Tags ». Se refait
 * lui-même : l'image ou l'aperçu 3D restent en place.
 */
function blocClassement(cleTexture){
  const bloc = el('div', { classe: 'store-classement' });
  let menuTags = false, menuMatieres = false;
  const maj = () => {
    const t = mes.find(x => x.cle === cleTexture);
    if (!t) return;
    const noms = t.matieres.map(m => nomDe(infos.matieres, m));
    const chip = el('button', { texte: noms.length ? noms.join(', ') : tr('Unclassified', 'Non classée'),
      classe: 'store-chip store-chip-categorie' + (noms.length ? '' : ' store-chip-vide'),
      attrs: { type: 'button', title: tr('Choose its materials', 'Choisir ses matières'), 'aria-haspopup': 'menu' } });
    const ouvrirMatieres = () => menuFlottant(bloc, (menu) => {
      for (const m of infos.matieres) {
        const actif = t.matieres.includes(m.slug);
        const b = el('button', { texte: (actif ? '✓ ' : '') + m[langue()], classe: 'store-menu-resolution' + (actif ? ' actif' : ''), attrs: { type: 'button', role: 'menuitemcheckbox', 'aria-checked': String(actif) } });
        b.onclick = async () => {
          const choisies = actif ? t.matieres.filter(x => x !== m.slug) : [...t.matieres, m.slug];
          await api().texturesMatieres(cleTexture, infos.matieres.map(x => x.slug).filter(x => choisies.includes(x)));
          await relireMes();
          menuMatieres = true;   // un choix MULTIPLE : le menu reste ouvert
          maj();
        };
        menu.appendChild(b);
      }
    }, 'store-menu-categories', () => { menuMatieres = false; }, chip);
    chip.onclick = () => { menuTags = false; ouvrirMatieres(); menuMatieres = !!document.querySelector('.store-menu-categories'); };
    const usages = t.usages.map(u => el('span', { texte: nomDe(infos.usages, u), classe: 'store-chip texture-chip-usage', attrs: { title: tr('Use, from its materials', 'Usage, d\'après ses matières') } }));
    const lesTags = (t.tags || []).map(id => tags.find(x => x.id === id)).filter(Boolean).map(x => el('span', { texte: x.nom, classe: 'store-chip store-chip-tag' }));
    const ajouter = el('button', { texte: '+ Tags', classe: 'store-chip store-chip-action', attrs: { type: 'button', 'aria-haspopup': 'menu' } });
    const ouvrirTags = () => menuFlottant(bloc, (menu) => remplirListeTags(menu, {
      estCoche: (e) => (t.tags || []).includes(e.id),
      cocher: (e, actif) => api().texturesOperationTags('tagTexture', { cle: cleTexture, id: e.id, actif }),
      apresCreation: async (id) => { await api().texturesOperationTags('tagTexture', { cle: cleTexture, id, actif: true }); await relireMes(); },
      refaire: () => { menuTags = true; maj(); },
    }), 'store-menu-tags', () => { menuTags = false; }, ajouter);
    ajouter.onclick = () => { menuMatieres = false; ouvrirTags(); menuTags = true; };
    const rouvrirMatieres = menuMatieres, rouvrirTags = menuTags;
    document.querySelectorAll('#texturesFiche .store-menu-flottant').forEach(m => m.remove());
    bloc.replaceChildren(
      el('div', { classe: 'store-classement-ligne' }, [chip]),
      usages.length ? el('div', { classe: 'store-classement-ligne' }, usages) : el('p', { classe: 'store-fiche-texte', texte: tr('Tick its materials to choose where it is offered.', 'Choisissez ses matières : elles disent où elle est proposée.') }),
      el('div', { classe: 'store-classement-ligne' }, [...lesTags, ajouter]),
    );
    if (rouvrirMatieres) ouvrirMatieres();
    else if (rouvrirTags) ouvrirTags();
  };
  maj();
  return bloc;
}

/** Les matières et usages d'une texture EN LIGNE : des étiquettes, pas de choix (elle n'est pas à nous). */
function blocLecture(r){
  return el('div', { classe: 'store-classement' }, [
    el('div', { classe: 'store-classement-ligne' }, r.matieres.map(m => el('span', { texte: nomDe(infos.matieres, m), classe: 'store-chip store-chip-categorie texture-chip-fixe' }))),
    el('div', { classe: 'store-classement-ligne' }, r.usages.map(u => el('span', { texte: nomDe(infos.usages, u), classe: 'store-chip texture-chip-usage' }))),
  ]);
}

/** Les icônes du bouton de forme : celle de la forme où l'on passera. */
const ICONE_FORME = {
  plat: '<svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 16 9 6h12l-6 10z"/><path d="M6 11h12M12 6l-3 10"/></svg>',
  rond: '<svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12c3 3 15 3 18 0M12 3c-3 3-3 15 0 18"/></svg>',
};

/** Le rendu d'une texture, en mots d'usage : complet, ou ce qui lui manque. */
function renduLisible(cartes){
  const manque = [];
  if (!cartes.includes('normal')) manque.push(tr('relief', 'relief'));
  if (!cartes.includes('rugosite')) manque.push(tr('shine', 'brillance'));
  return manque.length
    ? `${tr('Rendering: simplified, without', 'Rendu : simplifié, sans')} ${manque.join(tr(' or ', ' ni '))}`
    : `${tr('Rendering: complete (colour, relief, shine', 'Rendu : complet (couleur, relief, brillance')}${cartes.includes('ao') ? tr(', shadows in the hollows', ', ombres des creux') : ''})`;
}

const CC0 = { libelle: 'CC0 Public Domain', url: 'https://creativecommons.org/publicdomain/zero/1.0/', attribution: false, commercial: true, modification: true };

/** Un lien vers l'extérieur, comme dans le store de modèles (le processus principal l'ouvre dans le navigateur). */
const lien = (texte, url, classe) => el('a', { texte, classe, attrs: { href: url, target: '_blank', rel: 'noopener' } });

async function ouvrirFiche(r, local){
  if (r.integree) { ficheIntegree(r); return; }
  fermerApercu();
  ficheCourante = { r, local };
  const fiche = $('texturesFiche');
  const t = local ? r : possedee(r);
  const visuel = el('div', { classe: 'store-fiche-visuel' });
  let urlImage = local ? null : r.vignettes.grande;
  // Une texture de « Mes textures » se répète dans le cadre ; l'image d'une source est un rendu (une
  // sphère, une scène) qui ne se répète pas : contenue.
  const image = () => (urlImage ? [local ? tuileDeFiche(urlImage) : vignette(urlImage)] : []);
  if (local) urlLocale(r).then(url => { urlImage = url; if (url && ficheCourante && ficheCourante.r === r && !apercu) visuel.replaceChildren(...image()); });
  else visuel.replaceChildren(...image());
  // « Voir sur … » à côté de « Voir en 3D », quand la texture a une page (demandé, comme les modèles).
  const boutons = el('div', { classe: 'store-fiche-boutons' }, [boutonApercu(r, visuel, image),
    r.url ? lien(tr(`View on ${nomSource(r.source)}`, `Voir sur ${nomSource(r.source)}`), r.url, 'nav-btn store-lien-bouton') : null].filter(Boolean));
  const gauche = el('div', { classe: 'store-fiche-gauche' }, [visuel, boutons]);
  const dims = local ? r.dimensions : r.details.dimensions;
  const liste = (lignes) => el('ul', {}, lignes.filter(Boolean).map(p => el('li', { texte: p })));
  const importee = r.source === 'import';
  const auteur = r.auteur && r.auteur.nom;
  // Dans L'ORDRE de la fiche d'un modèle (demandé) : fichier (ici le dossier), taille, poids, ce qui
  // la compose, la résolution, et d'où elle vient.
  const caracteristiques = [
    t ? `${tr('Folder', 'Dossier')} : Textures/${t.dossier}` : null,
    tailleReelle(dims) ? `${tr('Real size of one tile', 'Taille réelle d\'une tuile')} : ${tailleReelle(dims)}${importee ? tr(' (unknown: by default)', ' (inconnue : par défaut)') : ''}` : null,
    t && t.poids ? `${tr('Weight', 'Poids')} : ${poids(t.poids)}` : null,
    // Le RENDU plutôt que la liste des images (signalé : pas clair). Complet = couleur, relief et
    // brillance ; sinon on dit ce qui manque, en mots d'usage.
    t && t.cartes ? renduLisible(t.cartes) : null,
    // Le grain et le raccord ne se disent QUE s'ils posent problème (signalé : « prêt » l'est toujours).
    t && !t.grain ? tr('Not usable on the Ground or Paths (no relief image): building finishes only', 'Inutilisable pour le Sol et les Tracés (pas d\'image de relief) : revêtements de bâtiment seulement') : null,
    t && t.raccordVisible ? tr('Seam: repeated over a large surface, its edges show as lines', 'Couture : répétée sur une grande surface, ses bords se voient en lignes') : null,
    t && t.resolution ? `${tr('Resolution', 'Résolution')} : ${t.resolution.toLowerCase()}` : null,
    t ? (importee ? tr('Imported from a folder', 'Importée d\'un dossier') : tr(`Downloaded from ${nomSource(r.source)}`, `Téléchargée depuis ${nomSource(r.source)}`)) : null,
  ];
  // En ligne : le poids de la résolution choisie, posé quand la source l'a donné (boutonTelecharger).
  const lignePoids = !t ? el('li', { classe: 'texture-poids', attrs: { hidden: '' } }) : null;
  const droite = el('div', { classe: 'store-fiche-droite' }, [
    el('h4', { texte: r.nom }),
    importee ? el('p', { texte: tr('Imported from a folder', 'Importée d\'un dossier') })
      : el('p', {}, [el('span', { texte: tr('by', 'par') + ' ' }), r.auteur && r.auteur.url ? lien(auteur, r.auteur.url) : el('span', { texte: auteur || nomSource(r.source) })]),
    t ? blocClassement(t.cle) : blocLecture(r),
    // Comme la fiche d'un modèle de « Mes modèles » : où elle sert, sa licence, ses caractéristiques.
    t ? section(tr('Used in this project', 'Utilisée dans ce projet'), [el('p', { classe: 'store-fiche-texte', texte: phraseUtilisation(t) })]) : null,
    section(tr('Licence', 'Licence'), importee
      ? [el('p', { classe: 'store-fiche-texte', texte: tr('Unknown: imported from a folder. Check the conditions where it comes from.', 'Inconnue : importée d\'un dossier. Vérifiez les conditions de sa provenance.') })]
      : [el('p', {}, [lien(CC0.libelle, CC0.url)]), liste(phrasesLicence(CC0, langue()))]),
    section(tr('Characteristics', 'Caractéristiques'), [(() => { const ul = liste(caracteristiques); if (lignePoids) ul.appendChild(lignePoids); return ul; })()]),
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
  // Rien sous les boutons d'une fiche (demandé) : la licence et la source y sont déjà dites.
  $('texturesCredit').hidden = true;
  fiche.hidden = false;
  $('texturesDefilement').scrollTop = 0;
}

/**
 * La fiche d'une texture LIVRÉE, comme les autres (demandé) : son image répétée à la définition du
 * grain, l'aperçu 3D, d'où elle vient, où elle sert, ses caractéristiques. Pas de suppression : elle
 * fait partie de l'application.
 */
function ficheIntegree(t){
  fermerApercu();
  ficheCourante = { r: t, local: true };
  const fiche = $('texturesFiche');
  const visuel = el('div', { classe: 'store-fiche-visuel' });
  let urlImage = null;
  const image = () => (urlImage ? [tuileDeFiche(urlImage)] : []);
  // À la définition du grain (1024), pas celle de la carte : l'image de la fiche était floue.
  toileIntegree(t, null).then(r => {
    if (!r || !ficheCourante || ficheCourante.r !== t) return;
    urlImage = r.toile.toDataURL('image/jpeg', 0.92);
    if (!apercu) visuel.replaceChildren(...image());
    const li = fiche.querySelector('.texture-resolution');
    if (li && r.largeurNaturelle) { li.hidden = false; li.textContent = `${tr('Resolution', 'Résolution')} : ${Math.max(1, Math.round(r.largeurNaturelle / 1024))}k (${r.largeurNaturelle} px)`; }
  });
  const p = t.provenance;
  const boutons = el('div', { classe: 'store-fiche-boutons' }, [boutonApercu(t, visuel, image),
    p ? lien(tr(`View on ${p.banque}`, `Voir sur ${p.banque}`), p.url, 'nav-btn store-lien-bouton') : null].filter(Boolean));
  const liste = (lignes) => el('ul', {}, lignes.filter(Boolean).map(x => (typeof x === 'string' ? el('li', { texte: x }) : x)));
  const id = t.choix.sol;
  const usages = id ? utilisationsDe(id, { tomes: S.tomes || [], scenes: S.scenes || [] }) : null;
  const phrase = !usages ? tr('The original texture of this path type, used by every path that has not been given another.', 'La texture d\'origine de ce type de Tracé, portée par chaque Tracé qui n\'en a pas reçu une autre.')
    : (!usages.tomes && !usages.scenes ? tr('Used nowhere in this Project.', 'Utilisée nulle part dans ce Projet.')
      : tr(`Used ${usages.tomes + usages.scenes} time(s) in this Project.`, `Utilisée ${usages.tomes + usages.scenes} fois dans ce Projet.`));
  // La taille réelle d'une tuile : celle du Tracé, ou pour le Sol le plan divisé par sa répétition
  // (une unité monde est un mètre).
  const cote = id && t.repeat ? GROUND_PLANE_SIZE_3D / t.repeat : null;
  const tuile = t.dimensions || (cote ? [cote, cote] : null);
  // Dans L'ORDRE des autres fiches : fichier, taille, poids, rendu, résolution, provenance.
  const caracteristiques = [
    t.grain ? `${tr('File', 'Fichier')} : assets/textures/${t.grain}.png` : null,
    tuile && !t.dessinee ? `${tr('Real size of one tile', 'Taille réelle d\'une tuile')} : ${tailleReelle(tuile)}` : null,
    t.poids ? `${tr('Weight', 'Poids')} : ${poids(t.poids)}` : null,
    t.dessinee ? tr('Rendering: drawn in colour, without photograph', 'Rendu : dessiné en couleur, sans photographie')
      : tr('Rendering: baked grain (colour and relief in one image)', 'Rendu : grain cuit (couleur et relief dans une image)'),
    t.grain ? el('li', { classe: 'texture-resolution', attrs: { hidden: '' } }) : null,
    p ? `${tr('Source', 'Source')} : ${p.ressource} (${p.banque})` : null,
    tr('Shipped with the application', 'Livrée avec l\'application'),
  ];
  const droite = el('div', { classe: 'store-fiche-droite' }, [
    el('h4', { texte: nomTexture(t) }),
    el('p', { texte: t.dessinee ? tr('Drawn by the application', 'Dessinée par l\'application') : tr('Built into the application', 'Intégrée à l\'application') }),
    blocLecture(t),
    section(tr('Used in this project', 'Utilisée dans ce projet'), [el('p', { classe: 'store-fiche-texte', texte: phrase })]),
    section(tr('Licence', 'Licence'), t.dessinee
      ? [el('p', { classe: 'store-fiche-texte', texte: tr('None needed: drawn by the application, from no photograph.', 'Aucune : dessinée par l\'application, sans photographie.') })]
      : [el('p', {}, [lien(CC0.libelle, CC0.url)]), liste(phrasesLicence(CC0, langue()))]),
    section(tr('Characteristics', 'Caractéristiques'), [liste(caracteristiques)]),
  ]);
  const retour = el('button', { texte: tr('Back', 'Retour'), classe: 'nav-btn', attrs: { type: 'button' } });
  retour.onclick = fermerFiche;
  fiche.replaceChildren(el('div', { classe: 'store-fiche-corps' }, [el('div', { classe: 'store-fiche-gauche' }, [visuel, boutons]), droite]),
    el('div', { classe: 'store-fiche-pied' }, [el('div', { classe: 'store-fiche-actions' }, [retour])]));
  if ($('texturesFiche').hidden) positionListe = $('texturesDefilement').scrollTop;
  $('texturesGrille').hidden = true;
  $('texturesFormulaire').hidden = true;
  $('texturesCredit').hidden = true;
  fiche.hidden = false;
  $('texturesDefilement').scrollTop = 0;
}

/** Renomme une texture (clic droit) : de « Mes textures » ou livrée ; un nom vide rend à une livrée le sien. */
export async function renommerTexture(cleTexture, nom){
  const r = await api().texturesRenommer(cleTexture, nom);
  if (r && r.erreur) return r;
  await relireMes();
  rendreGrille();
  if (ficheCourante && ficheCourante.r && ficheCourante.r.cle === cleTexture) {
    const t = [...mes, ...integrees].find(x => x.cle === cleTexture);
    if (t) ouvrirFiche(t, true);
  }
  return { ok: true };
}

/** Supprime une texture de « Mes textures » (clic droit), après confirmation. Une livrée ne se supprime pas. */
export async function supprimerTexture(t){
  if (!t || t.integree) return;
  if (_rappels.confirmer && !(await _rappels.confirmer(tr(`Delete the texture “${t.nom}” from the disk?`, `Supprimer la texture « ${t.nom} » du disque ?`)))) return;
  await api().texturesSupprimer(t.cle);
  urlsLocales.delete(t.cle);
  await relireMes();
  if (ficheCourante && ficheCourante.r && ficheCourante.r.cle === t.cle) fermerFiche();
  else rendreGrille();
}

/** Le nom d'une texture tel qu'affiché (la saisie du renommage part de lui). */
export const nomAffiche = (t) => nomTexture(t);

function suivreProgression(sourceId, id, recus, total){
  const k = `${sourceId}:${id}`;
  if (!enCours.has(k)) return;
  enCours.set(k, { recus, total });
  if (choix && $('texturesFiche').hidden) { rendreGrille(); return; }
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
  if (choix) {
    // L'usage est imposé par l'endroit d'où l'on choisit, et ne se change pas ici.
    $('texturesUsage').value = choix.usage;
    $('texturesUsage').disabled = true;
    rendreOnglets();
  }
  chercher();
}

export function fermerTextures(){
  fermerFiche();
  $('texturesModal').classList.add('hidden');
  if (choix) {
    choix = null;
    $('texturesUsage').disabled = false;
    $('texturesUsage').value = '';
    $('texturesModal').classList.remove('textures-mode-choix');
  }
}

/**
 * Ouvre le store pour CHOISIR une texture (voir `choix`) : sur « Mes textures », l'usage verrouillé.
 * `actuelle` : la valeur posée aujourd'hui (pour marquer sa carte) ; `appliquer(valeur)` : rappelé
 * avec la valeur choisie, après fermeture.
 */
export async function choisirTexture({ usage, actuelle = null, appliquer, titre }){
  if (!api()) return;
  if (!$('texturesModal').classList.contains('hidden')) fermerTextures();
  choix = { usage, actuelle: usage === 'sol' ? (actuelle || 'herbe') : (actuelle || null), appliquer, titre };
  onglet = LOCAL;
  // Par-dessus la fenêtre d'un Tracé, d'où il peut s'ouvrir (style.css).
  $('texturesModal').classList.add('textures-mode-choix');
  await ouvrirTextures();
}

/**
 * LE CARRÉ DE TEXTURE (demandé, à la place d'une liste à rallonge) : l'image de la texture posée,
 * son nom centré dessous ; un clic ouvre le store pour en choisir une autre.
 * `{ valeur, usage, titre, appliquer(valeur) }`. Rend le bouton ; l'image arrive ensuite.
 */
export function carreDeTexture({ valeur, usage, titre, appliquer, teinte = null }){
  const image = el('span', { classe: 'texture-carre-image' });
  const nom = el('span', { texte: '…' });
  const b = el('button', { classe: 'texture-carre', attrs: { type: 'button', title: tr('Choose another texture', 'Choisir une autre texture') } },
    [image, el('span', { classe: 'texture-carre-nom' }, [nom])]);   // le nom seul, centré (demandé : plus de « Changer »)
  let texture = null, voulue = teinte, demande = 0;
  // L'image suit la COULEUR choisie, comme le rendu (demandé : en direct au glissé du sélecteur).
  // Une demande plus récente l'emporte sur une plus lente.
  const peindre = async () => {
    if (!texture) return;
    const moi = ++demande;
    const url = voulue ? await urlTeintee(texture, voulue) : await urlLocale(texture);
    if (moi === demande && url) image.style.backgroundImage = `url("${url}")`;
  };
  textureActuelle(valeur, usage).then((t) => {
    if (!t) { nom.textContent = tr('Unknown texture', 'Texture introuvable'); return; }
    nom.textContent = t.nom;
    texture = t.texture;
    peindre();
  });
  /** Repeint l'image d'une autre couleur (null : la naturelle). */
  b.teinter = (t) => { voulue = t || null; peindre(); };
  // mousedown plutôt que click, comme les boutons du Sol : le menu de droite se refait au mouseup.
  b.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); choisirTexture({ usage, actuelle: valeur, appliquer, titre }); });
  return b;
}

/** Les grains des textures de « Mes textures », chargés une fois par l'IPC (pour les teindre). */
const grainsLocaux = new Map();
function grainLocal(t){
  if (!grainsLocaux.has(t.cle)) {
    grainsLocaux.set(t.cle, api().texturesImage(t.cle, 'grain').then(r => new Promise((ok) => {
      if (!r || !r.ok) { ok(null); return; }
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => ok(null);
      img.src = URL.createObjectURL(new Blob([r.data], { type: r.type }));
    })).catch(() => null));
  }
  return grainsLocaux.get(t.cle);
}

/**
 * L'image d'une texture TEINTE d'une couleur, comme le rendu la teint : son grain, habillé de la
 * couleur selon sa nature (appliquerTeinteAuMotif3D). 256 px : c'est une vignette.
 */
async function urlTeintee(t, teinte){
  if (t.integree) return urlIntegree({ ...t, teinte });
  const img = t.grain ? await grainLocal(t) : null;
  if (!img) return urlLocale(t);
  const toile = document.createElement('canvas');
  toile.width = toile.height = 256;
  const c = toile.getContext('2d', { willReadFrequently: true });
  c.drawImage(img, 0, 0, 256, 256);
  const d = c.getImageData(0, 0, 256, 256);
  const rvb = rvbDeCouleur3D(teinte);
  if (rvb) appliquerTeinteAuMotif3D(d.data, rvb, t.nature === 'couleur' ? 'couleur' : 'gris');
  c.putImageData(d, 0, 0);
  return toile.toDataURL('image/jpeg', 0.9);
}

/**
 * La texture posée aujourd'hui pour un usage (le carré de la section Sol, de la fenêtre d'un Tracé) :
 * `{ nom, url }` (url en promesse), livrée ou de « Mes textures ». « Mes textures » est lue une fois.
 */
export async function textureActuelle(valeur, usage){
  if (!mesCharges && api()) {
    try { mes = (await api().texturesMes()) || []; } catch (e) { mes = []; }
    await relireIntegrees();
    mesCharges = true;
  }
  if (!integrees.length) integrees = lesIntegrees();
  const t0 = textureDeLaValeur(valeur, usage, mes);
  // Le nom donné par l'utilisateur à une texture livrée.
  const t = t0 && t0.integree ? integrees.find(x => x.cle === t0.cle) || t0 : t0;
  if (!t) return null;
  return { nom: nomTexture(t), url: urlLocale(t), texture: t };
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
  // Un clic à côté ferme le store, et rien d'autre (signalé : ouvert depuis le menu d'une Case, il
  // fermait aussi ce menu) : la suite du geste ne tombe pas sur la Planche.
  texturesModal.addEventListener('mousedown', (e) => {
    if (e.target !== texturesModal) return;
    e.stopPropagation();
    avalerLaSuiteDuGeste();
    fermerTextures();
  });
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
