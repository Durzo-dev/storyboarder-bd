/**
 * @file polices-store-ui.js
 * #423 : l'onglet « En ligne » de « Mes polices », le STORE DE POLICES (source Fontsource, cf.
 * electron/bibliotheque/store-fontsource.js). Il partage avec polices-ui.js la grille, la liste et
 * le détail ; ce module ne tient que ce qui lui est propre : la recherche, ses filtres, les aperçus
 * chargés à la demande, et l'ajout d'une police à « Mes polices ».
 *
 * ⚠️ LES APERÇUS SONT CHARGÉS QUAND LA VIGNETTE DEVIENT VISIBLE (IntersectionObserver) : une page
 * compte des dizaines de polices, les télécharger toutes d'un coup ferait attendre pour rien. Chaque
 * aperçu est une FontFace à part, nommée « SB apercu <id> », pour ne jamais se confondre avec une
 * police installée du même nom.
 */

import { tr } from './state.js';
import { suiteADemander } from './store-ui.js';

const $ = (id) => document.getElementById(id);

/** Le nom de famille d'un aperçu : propre au store, pour ne jamais masquer une police installée. */
export const familleDApercu = (id) => `SB apercu ${id}`;

/** Les catégories de Fontsource, en clair. */
export function libelleCategorie(cle){
  switch (cle) {
    case 'handwriting': return tr('Handwriting', 'Manuscrite');
    case 'display': return tr('Display', 'Fantaisie');
    case 'sans-serif': return tr('Sans serif', 'Sans empattement');
    case 'serif': return tr('Serif', 'Avec empattement');
    case 'monospace': return tr('Monospace', 'Chasse fixe');
    default: return cle;
  }
}

/** Ce que veut dire chaque catégorie, en une phrase (infobulles). */
export function explicationCategorie(cle){
  switch (cle) {
    case 'handwriting': return tr('Looks written by hand or with a brush.', 'Imite l\'écriture à la main ou au pinceau.');
    case 'display': return tr('Decorative, made for titles and short words rather than long text.', 'Décorative, faite pour les titres et les mots courts plutôt que pour un long texte.');
    case 'sans-serif': return tr('Plain letters, without the small strokes at the ends (like Arial).', 'Lettres simples, sans les petits traits au bout des lettres (comme Arial).');
    case 'serif': return tr('Letters with small strokes at the ends, as in books (like Times).', 'Lettres avec de petits traits au bout, comme dans les livres (comme Times).');
    case 'monospace': return tr('Every letter takes the same width, as on a typewriter.', 'Toutes les lettres ont la même largeur, comme sur une machine à écrire.');
    default: return '';
  }
}

/** Les textes des erreurs du store de polices. */
export function texteErreur(code){
  switch (code) {
    case 'reseau': return tr('No connection to the font store. Check the network, then try again.', 'Pas de connexion au store de polices. Vérifiez le réseau, puis réessayez.');
    case 'quota': return tr('The font store asks to wait a moment. Try again shortly.', 'Le store de polices demande de patienter. Réessayez dans un instant.');
    case 'simulation': return tr('Simulation: this font is not available offline.', 'Simulation : cette police n\'est pas disponible hors ligne.');
    default: return tr('The font store sent an unexpected answer.', 'Le store de polices a rendu une réponse inattendue.');
  }
}

let resultats = [];
let suivant = null;
let generation = 0;
let enCours = false;
let _actif = () => false;   // l'onglet « En ligne » est-il affiché, liste visible ?
const chargees = new Map();   // clé `id|graisse|italique` → promesse
let observateur = null;
let _rendre = () => {};

/** Ce que l'onglet cherche, lu dans ses champs. */
function recherche(curseur){
  return {
    texte: $('policesEnLigneTexte').value,
    categorie: $('policesEnLigneCategorie').value,
    completes: $('policesEnLigneCompletes').checked,
    tri: $('policesEnLigneTri').value,
    curseur,
  };
}

/** Une recherche, ou la page suivante. Une réponse arrivée après une recherche plus récente est ignorée. */
export async function chercherEnLigne(suite = false, message = () => {}){
  const pont = window.storyboarderAPI;
  if (!pont || !pont.fontStoreChercher) return;
  if (suite && (enCours || suivant == null)) return;
  const moi = ++generation;
  enCours = true;
  if (!suite) { resultats = []; suivant = null; message(tr('Loading…', 'Chargement…')); _rendre(); }
  const r = await pont.fontStoreChercher(recherche(suite ? suivant : 0));
  if (moi !== generation) return;
  enCours = false;
  if (!r || r.erreur) { message(texteErreur(r && r.erreur), true); return; }
  resultats = suite ? [...resultats, ...r.resultats] : r.resultats;
  suivant = r.suivant;
  message(r.simulation
    ? tr('Simulation (STORYBOARD_SIMULER_STORE): a recorded extract of the catalogue. To go back to normal, close this terminal or type Remove-Item Env:STORYBOARD_SIMULER_STORE.',
      'Simulation (STORYBOARD_SIMULER_STORE) : un extrait enregistré du catalogue. Pour revenir à la normale, fermez ce terminal ou tapez Remove-Item Env:STORYBOARD_SIMULER_STORE.')
    : (resultats.length ? tr(`${r.total} font(s).`, `${r.total} police(s).`) : tr('No font matches.', 'Aucune police ne correspond.')));
  _rendre();
  // La page ne remplit pas la fenêtre : la suite vient aussitôt.
  chargerLaSuiteSiBesoin(message);
}

/** Le défilement infini : la suite quand on approche du bas (règle commune, store-ui.js). */
function chargerLaSuiteSiBesoin(message){
  const zone = $('policesDefilement');
  if (!zone || !_actif()) return;
  if (suiteADemander({ zone, suivant, enCours, ficheOuverte: false })) chercherEnLigne(true, message);
}

/** Les résultats affichés, et s'il y a une suite. */
export function resultatsEnLigne(){
  return { resultats: resultats.slice(), suite: suivant != null };
}

/** Charge une variante d'une police du store dans le navigateur (une seule fois). */
export function chargerApercu(p, graisse = null, italique = false){
  const cle = `${p.id}|${graisse}|${italique}`;
  if (chargees.has(cle)) return chargees.get(cle);
  const pont = window.storyboarderAPI;
  const promesse = (async () => {
    if (!pont || !pont.fontStoreApercu || typeof globalThis.FontFace !== 'function') return false;
    const r = await pont.fontStoreApercu(p.id, graisse, italique);
    if (!r || !r.data) return false;
    const face = new globalThis.FontFace(familleDApercu(p.id), r.data, { weight: String(graisse || 400), style: italique ? 'italic' : 'normal' });
    await face.load();
    document.fonts.add(face);
    return true;
  })().catch(() => false);
  chargees.set(cle, promesse);
  return promesse;
}

/** Les variantes VRAIES d'une police du store, pour son détail : le reste sera simulé, et marqué. */
export function chargerVariantes(p){
  const normale = p.graisseNormale, grasse = p.graisseGrasse;
  const v = [chargerApercu(p, normale, false)];
  if (grasse) v.push(chargerApercu(p, grasse, false));
  if (p.italique === 'vrai') v.push(chargerApercu(p, normale, true));
  if (grasse && p.italique === 'vrai') v.push(chargerApercu(p, grasse, true));
  return Promise.all(v);
}

/** Observe une vignette : son aperçu se charge quand elle entre à l'écran. */
export function observerVignette(carteEl, p){
  if (typeof globalThis.IntersectionObserver !== 'function') { chargerApercu(p, p.graisseNormale); return; }
  if (!observateur) {
    observateur = new globalThis.IntersectionObserver((entrees) => {
      for (const e of entrees) {
        if (!e.isIntersecting) continue;
        observateur.unobserve(e.target);
        const q = e.target._police;
        if (q) chargerApercu(q, q.graisseNormale);
      }
    }, { root: $('policesDefilement'), rootMargin: '200px' });
  }
  carteEl._police = p;
  observateur.observe(carteEl);
}

/** Le câblage, une fois : les champs relancent la recherche ; `rendre` refait l'affichage. */
export function cablerStorePolices(rendre, message, actif){
  _rendre = rendre;
  _actif = actif || (() => false);
  let minuterie = null;
  $('policesEnLigneTexte').addEventListener('input', () => {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => chercherEnLigne(false, message), 400);
  });
  for (const id of ['policesEnLigneCategorie', 'policesEnLigneCompletes', 'policesEnLigneTri']) {
    $(id).addEventListener('change', () => chercherEnLigne(false, message));
  }
  // Plus de « Charger plus » (demandé) : la suite se charge au fil du défilement, comme les stores
  // de modèles (suiteADemander, store-ui.js).
  $('policesDefilement').addEventListener('scroll', () => chargerLaSuiteSiBesoin(message), { passive: true });
}

/** Les libellés des filtres, dans la langue affichée. */
export function rafraichirFiltresEnLigne(categories){
  const cat = $('policesEnLigneCategorie');
  const v = cat.value;
  cat.replaceChildren(...[['', tr('All categories', 'Toutes les catégories')], ...(categories || []).map(c => [c, libelleCategorie(c)])].map(([val, txt]) => {
    const o = document.createElement('option'); o.value = val; o.textContent = txt; o.title = explicationCategorie(val); return o;
  }));
  cat.value = v;
}
