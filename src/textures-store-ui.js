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
    el('span', { classe: 'store-carte-infos' }, (r.matieres || []).slice(0, 2).map(m => el('span', { texte: nomDe(infos.matieres, m), classe: 'store-badge' }))),
  ]);
  if (local) urlLocale(r).then(url => { if (url) c.firstChild.replaceWith(vignette(url)); });
  c.onclick = () => ouvrirFiche(r, local);
  return c;
}

function rendreGrille(){
  const g = $('texturesGrille');
  if (!infos) return;
  if (onglet === LOCAL) {
    const liste = mesFiltrees();
    g.replaceChildren(...liste.map(t => carte(t, true)));
    if (!liste.length) {
      g.appendChild(el('p', { classe: 'empty-hint', texte: mes.length
        ? tr('No texture matches these filters.', 'Aucune texture ne correspond à ces filtres.')
        : tr('No texture yet: choose one in the Poly Haven or ambientCG tab.', 'Aucune texture pour l\'instant : choisissez-en une dans l\'onglet Poly Haven ou ambientCG.') }));
    }
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

function fermerFiche(){
  ficheCourante = null;
  $('texturesFiche').hidden = true;
  $('texturesFiche').replaceChildren();
  $('texturesGrille').hidden = false;
}

const section = (titre, enfants) => el('section', { classe: 'store-fiche-section' }, [el('h5', { texte: titre }), ...enfants]);
const badges = (liste, slugs) => el('div', { classe: 'store-carte-infos texture-badges' },
  slugs.map(s => el('span', { texte: nomDe(liste, s), classe: 'store-badge' })));
const tailleReelle = (d) => (d ? `${d[0].toLocaleString(langue())} × ${d[1].toLocaleString(langue())} m` : null);

async function ouvrirFiche(r, local){
  ficheCourante = { r, local };
  const fiche = $('texturesFiche');
  const visuel = el('div', { classe: 'store-fiche-visuel' });
  if (local) urlLocale(r).then(url => { if (url && ficheCourante && ficheCourante.r === r) visuel.appendChild(vignette(url)); });
  else if (r.vignettes.grande) visuel.appendChild(vignette(r.vignettes.grande));
  const gauche = el('div', { classe: 'store-fiche-gauche' }, [visuel]);
  const t = local ? r : possedee(r);
  const droite = el('div', { classe: 'store-fiche-droite' }, [
    el('h4', { texte: r.nom }),
    el('p', { classe: 'store-fiche-texte', texte: `${nomSource(r.source)} · ${tr('by', 'par')} ${(r.auteur && r.auteur.nom) || nomSource(r.source)} · CC0` }),
    section(tr('Materials', 'Matières'), [badges(infos.matieres, r.matieres)]),
    section(tr('Uses', 'Usages'), [badges(infos.usages, r.usages)]),
    tailleReelle(local ? r.dimensions : r.details.dimensions)
      ? section(tr('Real size of one tile', 'Taille réelle d\'une tuile'), [el('p', { classe: 'store-fiche-texte', texte: tailleReelle(local ? r.dimensions : r.details.dimensions) })]) : null,
    t ? section(tr('In My textures', 'Dans Mes textures'), [el('p', { classe: 'store-fiche-texte', texte: [
      `${tr('Resolution', 'Résolution')} ${t.resolution}`,
      t.grain ? tr('ground and path grain ready', 'grain du Sol et des Tracés prêt') : tr('no grain: building finishes only', 'pas de grain : revêtements de bâtiment seulement'),
    ].join(' · ') }), t.raccordVisible ? el('p', { classe: 'store-fiche-texte texture-raccord', texte: tr('Visible seam: this texture does not tile perfectly.', 'Raccord visible : cette texture ne se répète pas parfaitement.') }) : null]) : null,
  ]);
  const actions = el('div', { classe: 'store-fiche-actions' });
  const retour = el('button', { texte: tr('Back', 'Retour'), classe: 'nav-btn', attrs: { type: 'button' } });
  retour.onclick = fermerFiche;
  actions.appendChild(retour);
  const pied = el('div', { classe: 'store-fiche-pied' }, [actions]);
  fiche.replaceChildren(el('div', { classe: 'store-fiche-corps' }, [gauche, droite]), pied);
  $('texturesGrille').hidden = true;
  fiche.hidden = false;
  if (local) {
    const suppr = el('button', { texte: tr('Delete', 'Supprimer'), classe: 'full-btn delete-btn', attrs: { type: 'button' } });
    suppr.onclick = async () => {
      if (_rappels.confirmer && !(await _rappels.confirmer(tr(`Delete the texture “${r.nom}” from the disk?`, `Supprimer la texture « ${r.nom} » du disque ?`)))) return;
      await api().texturesSupprimer(r.cle);
      urlsLocales.delete(r.cle);
      await relireMes();
      fermerFiche();
      rendreGrille();
    };
    actions.appendChild(suppr);
    return;
  }
  // Le choix de la résolution, avec le poids de chacune, lu à la source (1k coché par défaut).
  const choixRes = el('div', { classe: 'choix choix-options texture-resolutions' });
  const telecharger = el('button', { texte: t ? tr('Download again', 'Télécharger à nouveau') : tr('Download', 'Télécharger'), classe: 'full-btn', attrs: { type: 'button' } });
  telecharger.disabled = true;
  actions.append(choixRes, telecharger);
  const note = el('p', { classe: 'store-note', texte: tr('Reading the sizes…', 'Lecture des poids…') });
  pied.appendChild(note);
  const o = await api().texturesOptions(r.source, r.id);
  if (!ficheCourante || ficheCourante.r !== r) return;
  if (o.erreur || !o.options || !o.options.length) { note.textContent = erreurLisible(o.erreur); return; }
  let choisie = o.options[0].resolution;
  const rendreChoix = () => choixRes.replaceChildren(...o.options.map(x => {
    const b = el('button', { texte: x.resolution.toLowerCase(), classe: x.resolution === choisie ? 'actif' : '', attrs: { type: 'button', title: poids(x.octets) } });
    b.onclick = () => { choisie = x.resolution; rendreChoix(); majNote(); };
    return b;
  }));
  const majNote = () => {
    const x = o.options.find(y => y.resolution === choisie);
    note.textContent = `${poids(x.octets)} · ${o.options.length > 2
      ? tr('4k is offered because this texture serves buildings (close-ups).', 'La 4k est proposée parce que cette texture sert aux bâtiments (gros plans).')
      : tr('1k is enough for almost everything; 2k for close-ups.', 'La 1k suffit presque toujours ; la 2k pour les gros plans.')}`;
  };
  rendreChoix(); majNote();
  telecharger.disabled = false;
  telecharger.onclick = async () => {
    telecharger.disabled = true;
    enCours.set(cle(r), { recus: 0, total: 0 });
    telecharger.textContent = tr('Downloading…', 'Téléchargement…');
    const res = await api().texturesTelecharger(r.source, r.id, choisie);
    enCours.delete(cle(r));
    if (res.erreur) { message(erreurLisible(res.erreur)); telecharger.disabled = false; telecharger.textContent = tr('Download', 'Télécharger'); return; }
    await relireMes();
    message(res.entree && res.entree.raccordVisible
      ? tr(`“${r.nom}” is in My textures (visible seam: it does not tile perfectly).`, `« ${r.nom} » est dans Mes textures (raccord visible : elle ne se répète pas parfaitement).`)
      : tr(`“${r.nom}” is in My textures.`, `« ${r.nom} » est dans Mes textures.`));
    if (ficheCourante && ficheCourante.r === r) ouvrirFiche(r, false);
  };
}

function suivreProgression(sourceId, id, recus, total){
  const k = `${sourceId}:${id}`;
  if (!enCours.has(k)) return;
  enCours.set(k, { recus, total });
  if (!ficheCourante || ficheCourante.local || cle(ficheCourante.r) !== k) return;
  const b = $('texturesFiche').querySelector('.store-fiche-actions .full-btn');
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
  if (api().surProgressionTexture) api().surProgressionTexture(suivreProgression);
  enregistrerFermeture('texturesModal', fermerTextures);
  rafraichirTextesTextures();
}
