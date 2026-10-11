/**
 * @file polices-ui.js
 * #423 : la fenêtre des POLICES (demandé), ouverte par le bouton « Aa » du bandeau.
 *
 *   - les polices intégrées (lecture seule) puis « Mes polices », en GRILLE de vignettes ou en
 *     LISTE (le choix est retenu) ;
 *   - un clic sur une police ouvre son DÉTAIL, à la place de la liste comme une fiche du store :
 *     ses caractères, une phrase d'essai qu'on peut modifier, ses variantes (vraies ou simulées), sa
 *     licence et ce qu'elle se permet ;
 *   - un clic droit sur une police importée la renomme ou la supprime (le menu est celui de
 *     l'application, injecté : cf. cablerPolices) ;
 *   - « Ajouter une police » : depuis un fichier (.ttf, .otf, .woff, .woff2), ou en ligne plus tard.
 *
 * Le DOM et le pont seulement ; ce qu'on lit dans un fichier et les décisions d'index vivent dans
 * electron/bibliotheque/, les décisions d'affichage dans polices-utilisateur.js.
 */

import { S, tr } from './state.js';
import { POLICES_BULLES, BUBBLE_FONT_FALLBACK } from './constants.js';
import {
  policesImportees, chargerPolicesUtilisateur, NOMS_INTEGRES, JEUX_DE_CARACTERES, PHRASE_D_ESSAI,
  classementDesUsages, tousLesUsages, usagesDeLaPolice, filtrerParUsages, operationUsage, nomsDesUsagesDeLaPolice,
} from './polices-utilisateur.js';
import { remplirListeEtiquettes } from './liste-etiquettes.js';
import { menuFlottant } from './store-ui.js';

const $ = (id) => document.getElementById(id);
const CLE_VUE = 'polices:vue';
let _rappels = {};
let phrase = null;   // la phrase d'essai tapée, gardée d'une fiche à l'autre pendant la session
let usagesFiltre = [];   // les usages du filtre (ids) : une police en porte au moins un

function el(tag, { texte, classe, attrs } = {}, enfants = []){
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (texte != null) n.textContent = texte;
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  enfants.filter(Boolean).forEach(c => n.appendChild(c));
  return n;
}

function vue(){
  try { return globalThis.localStorage.getItem(CLE_VUE) === 'liste' ? 'liste' : 'grille'; } catch (e) { return 'grille'; }
}
function memoriserVue(v){
  try { globalThis.localStorage.setItem(CLE_VUE, v); } catch (e) { /* une préférence perdue */ }
}

const langue = () => (S.appLang === 'en' ? 'en' : 'fr');
/** La phrase d'exemple : celle tapée (liste ou détail), sinon le pangramme de la langue. */
const phraseDExemple = () => phrase || (langue() === 'en' ? PHRASE_D_ESSAI.en : PHRASE_D_ESSAI.fr);

const nomsDesUsages = (nom) => nomsDesUsagesDeLaPolice(nom, langue());

/** Une police à montrer : intégrée ou importée, sous une seule forme. */
function toutesLesPolices(){
  const integrees = POLICES_BULLES.map(p => ({
    nom: p.nom, integree: true, gras: p.gras, italique: p.italique,
    licence: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org', droits: 'installable',
  }));
  const importees = policesImportees().map(f => ({ ...f, integree: false }));
  return { integrees, importees };
}

/** Les textes de la liste des usages (src/liste-etiquettes.js), dans la langue affichée. */
function textesUsages(){
  return {
    nouvelle: tr('New use… (Enter)', 'Nouvel usage… (Entrée)'),
    aucune: tr('No use yet: type one below.', 'Aucun usage pour l\'instant : tapez-en un ci-dessous.'),
    renommer: tr('Rename this use', 'Renommer cet usage'),
    supprimer: tr('Delete this use', 'Supprimer cet usage'),
    erreurs: {
      vide: tr('A use needs a name.', 'Un usage a besoin d\'un nom.'),
      pris: tr('Another use already has that name.', 'Un autre usage porte déjà ce nom.'),
      inconnu: tr('This use no longer exists.', 'Cet usage n\'existe plus.'),
    },
  };
}

/**
 * La liste des usages dans un menu : la gestion commune (créer, renommer, supprimer) et ce que
 * cocher veut dire, selon l'appelant (le filtre, ou les usages d'une police).
 */
function remplirUsages(menu, { estCoche, cocher, apresCreation, refaire }){
  remplirListeEtiquettes(menu, {
    etiquettes: () => tousLesUsages(langue()),
    estCoche, cocher, apresCreation, refaire,
    creer: (nom) => operationUsage('creer', { nom }, langue()),
    renommer: (u, nom) => operationUsage('renommer', { id: u.id, nom }, langue()),
    supprimer: async (u) => {
      const n = Object.values(classementDesUsages(langue()).usagesDesPolices).filter(ids => ids.includes(u.id)).length;
      const ok = await _rappels.confirmer(tr(
        `Delete the use "${u.nom}"? ${n ? `It will be removed from ${n} font(s).` : 'No font has it.'} The fonts themselves are not touched.`,
        `Supprimer l'usage « ${u.nom} » ? ${n ? `Il sera retiré de ${n} police(s).` : 'Aucune police ne le porte.'} Les polices elles-mêmes ne sont pas touchées.`));
      if (!ok) return false;
      await operationUsage('supprimer', { id: u.id }, langue());
      usagesFiltre = usagesFiltre.filter(x => x !== u.id);
      return true;
    },
    textes: textesUsages(),
  });
}

/** Le filtre par usage, à côté des boutons d'affichage (demandé), comme le filtre par tags du store. */
function rendreFiltreUsages(){
  const bouton = $('policesUsagesBtn');
  if (!bouton) return;
  bouton.textContent = usagesFiltre.length ? tr(`Uses (${usagesFiltre.length})`, `Usages (${usagesFiltre.length})`) : tr('All uses', 'Tous les usages');
  bouton.classList.toggle('actif', usagesFiltre.length > 0);
  let ouvert = null;
  const remplir = (menu) => remplirUsages(menu, {
    estCoche: (u) => usagesFiltre.includes(u.id),
    cocher: (u, actif) => { usagesFiltre = actif ? [...usagesFiltre, u.id] : usagesFiltre.filter(x => x !== u.id); },
    refaire: () => { rendreListe(); rendreFiltreUsages(); if (ouvert && ouvert.menu.isConnected) remplir(ouvert.menu); },
  });
  bouton.onclick = () => { ouvert = menuFlottant($('policesFiltreZone'), remplir, 'store-menu-tags', null, bouton); };
}

function pileDePolices(nom){
  return `"${nom}", "${BUBBLE_FONT_FALLBACK[nom] || 'Comic Sans MS'}", sans-serif`;
}

/** Les pastilles des variantes : G et I, marquées « ~ » quand elles sont simulées. */
function pastillesVariantes(p){
  const une = (lettre, etat, nom) => el('span', {
    texte: lettre,
    classe: 'police-variante' + (etat === 'vrai' ? '' : ' simulee'),
    attrs: { title: etat === 'vrai' ? nom : tr(`${nom}: simulated`, `${nom} : simulé`) },
  });
  return el('span', { classe: 'police-variantes' }, [
    une(tr('B', 'G'), p.gras, tr('Bold', 'Gras')),
    une('I', p.italique, tr('Italic', 'Italique')),
  ]);
}

function carte(p){
  const liste = vue() === 'liste';
  const apercu = el('span', { texte: liste ? phraseDExemple() : 'Aa', classe: 'police-apercu' });
  apercu.style.fontFamily = pileDePolices(p.nom);
  const c = el('button', { classe: 'police-carte' + (liste ? ' en-liste' : ''), attrs: { type: 'button', title: p.nom } }, [
    apercu,
    el('span', { classe: 'police-pied' }, [
      el('span', { texte: p.nom, classe: 'police-nom' }),
      p.introuvable ? el('span', { texte: tr('files missing', 'fichiers introuvables'), classe: 'police-usage police-alerte' })
        : el('span', { texte: nomsDesUsages(p.nom).join(', ') || '—', classe: 'police-usage' }),
      pastillesVariantes(p),
    ]),
  ]);
  c.onclick = () => ouvrirFiche(p);
  if (!p.integree) {
    c.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      if (_rappels.menuPolice) _rappels.menuPolice(ev, p.nom);
    });
  }
  return c;
}

function rendreListe(){
  const { integrees: toutesIntegrees, importees: toutesImportees } = toutesLesPolices();
  const attributions = classementDesUsages(langue()).usagesDesPolices;
  const integrees = filtrerParUsages(toutesIntegrees, usagesFiltre, attributions);
  const importees = filtrerParUsages(toutesImportees, usagesFiltre, attributions);
  const zone = $('policesListe');
  const grille = (polices) => el('div', { classe: vue() === 'liste' ? 'polices-lignes' : 'polices-grille' }, polices.map(carte));
  // Les deux groupes ne sont nommés que s'il y a des polices ajoutées (demandé : pas de groupe vide
  // ni de message quand il n'y en a pas).
  const groupes = toutesImportees.length;
  zone.replaceChildren(...[
    groupes && integrees.length ? el('h4', { texte: tr('Built-in', 'Intégrées'), classe: 'polices-groupe' }) : null,
    integrees.length ? grille(integrees) : null,
    groupes && importees.length ? el('h4', { texte: tr('Added', 'Ajoutées'), classe: 'polices-groupe' }) : null,
    importees.length ? grille(importees) : null,
    !integrees.length && !importees.length ? el('p', { texte: tr('No font has these uses.', 'Aucune police n\'a ces usages.'), classe: 'polices-vide' }) : null,
  ].filter(Boolean));
  $('policesVueGrille').setAttribute('aria-pressed', String(vue() === 'grille'));
  $('policesVueListe').setAttribute('aria-pressed', String(vue() === 'liste'));
  // Le champ de la phrase d'exemple, en liste seulement (demandé). Réécrit seulement s'il n'a pas le
  // focus : sinon on déplacerait le curseur sous les doigts de l'utilisateur.
  const champ = $('policesPhrase');
  if (champ) {
    champ.hidden = vue() !== 'liste';
    if (globalThis.document.activeElement !== champ) champ.value = phraseDExemple();
  }
}

/** La phrase d'exemple tapée en liste : les aperçus suivent sans refaire la liste (le focus reste). */
function majPhraseDExemple(){
  phrase = $('policesPhrase').value;
  for (const a of document.querySelectorAll('#policesListe .police-carte.en-liste .police-apercu')) a.textContent = phraseDExemple();
}

/** Ce que la police dit de ses droits, en clair ; un avertissement quand elle se déclare restreinte. */
function texteDesDroits(droits){
  switch (droits) {
    case 'restreinte': return tr('The font declares itself RESTRICTED: check its licence before using it.', 'La police se déclare RESTREINTE : vérifiez sa licence avant de vous en servir.');
    case 'apercu': return tr('The font only allows preview and printing.', 'La police n\'autorise que l\'aperçu et l\'impression.');
    case 'modifiable': return tr('The font allows editing.', 'La police autorise la modification.');
    default: return tr('The font declares itself installable.', 'La police se déclare installable.');
  }
}

function ouvrirFiche(p){
  const fiche = $('policesFiche');
  const pile = pileDePolices(p.nom);
  const ligne = (etiquette, valeur) => (valeur ? el('div', { classe: 'police-info' }, [el('span', { texte: etiquette, classe: 'police-info-cle' }), valeur]) : null);
  const lien = (url) => el('a', { texte: url, attrs: { href: url, target: '_blank', rel: 'noopener' } });
  const essai = el('input', { classe: 'modal-input police-essai-champ', attrs: { type: 'text', spellcheck: 'false' } });
  essai.value = phraseDExemple();
  const STYLES = [
    { nom: tr('Regular', 'Normal'), gras: false, italique: false },
    { nom: tr('Bold', 'Gras'), gras: true, italique: false },
    { nom: tr('Italic', 'Italique'), gras: false, italique: true },
    { nom: tr('Bold italic', 'Gras italique'), gras: true, italique: true },
  ];
  const textesEssai = [];
  const lignesEssai = el('div', { classe: 'police-essais' }, STYLES.map(s => {
    const simule = (s.gras && p.gras !== 'vrai') || (s.italique && p.italique !== 'vrai');
    const t = el('span', { classe: 'police-essai-texte' });
    t.style.fontFamily = pile;
    t.style.fontWeight = s.gras ? '700' : '400';
    t.style.fontStyle = s.italique ? 'italic' : 'normal';
    textesEssai.push(t);
    return el('div', { classe: 'police-essai' }, [
      el('span', { texte: s.nom + (simule ? ' ~' : ''), classe: 'police-essai-style', attrs: simule ? { title: tr('Simulated: the font does not have this style', 'Simulé : la police n\'a pas ce style') } : {} }),
      t,
    ]);
  }));
  const majEssai = () => {
    phrase = essai.value;
    textesEssai.forEach(t => { t.textContent = essai.value; });
  };
  essai.addEventListener('input', majEssai);
  const caracteres = el('div', { classe: 'police-caracteres' }, JEUX_DE_CARACTERES.map(j => {
    const t = el('div', { texte: j.texte, classe: 'police-caracteres-texte' });
    t.style.fontFamily = pile;
    return el('div', { classe: 'police-jeu' }, [el('span', { texte: S.appLang === 'en' ? j.en : j.fr, classe: 'police-info-cle' }), t]);
  }));
  const titre = el('h4', { texte: p.nom, classe: 'police-fiche-titre' });
  titre.style.fontFamily = pile;
  fiche.replaceChildren(
    titre,
    el('div', { classe: 'police-infos' }, [
      ligne(tr('Uses', 'Usages'), blocUsages(p.nom)),
      ligne(tr('Origin', 'Origine'), document.createTextNode(p.integree ? tr('Built into the application', 'Intégrée à l\'application') : tr('Added by you', 'Ajoutée par vous'))),
      ligne(tr('Designer', 'Créateur'), p.auteur ? document.createTextNode(p.auteur) : null),
      ligne(tr('Licence', 'Licence'), document.createTextNode(p.licence || tr('not stated in the file', 'non indiquée dans le fichier'))),
      ligne(tr('Licence link', 'Lien de la licence'), p.url ? lien(p.url) : null),
      ligne(tr('Copyright', 'Copyright'), p.copyright ? document.createTextNode(p.copyright) : null),
      ligne(tr('Rights', 'Droits'), el('span', { texte: texteDesDroits(p.droits), classe: p.droits === 'restreinte' || p.droits === 'apercu' ? 'police-alerte' : '' })),
      ligne(tr('Styles', 'Styles'), pastillesVariantes(p)),
    ]),
    el('h5', { texte: tr('Try it', 'Essai'), classe: 'police-sous-titre' }),
    essai,
    lignesEssai,
    el('h5', { texte: tr('Characters', 'Caractères'), classe: 'police-sous-titre' }),
    caracteres,
  );
  majEssai();
  // Le détail remplace la liste ; la barre (affichage, filtre, ajout) n'a rien à y faire, et
  // « Retour » reste en bas, toujours visible, hors de la zone qui défile (demandé).
  $('policesListe').hidden = true;
  $('policesBarre').hidden = true;
  $('policesPied').hidden = false;
  fiche.hidden = false;
  $('policesDefilement').scrollTop = 0;
}

function fermerFiche(){
  $('policesFiche').hidden = true;
  $('policesFiche').replaceChildren();
  $('policesListe').hidden = false;
  $('policesBarre').hidden = false;
  $('policesPied').hidden = true;
  rendreListe();
}

/**
 * Les usages d'une police dans son détail : leurs pastilles, et « Modifier les usages », qui ouvre
 * la même liste que le filtre (cocher = poser l'usage sur cette police). Se refait seul.
 */
function blocUsages(nom){
  const bloc = el('div', { classe: 'store-classement police-usages' });
  let ouvert = null;
  const maj = () => {
    const noms = nomsDesUsages(nom);
    const bouton = el('button', { texte: noms.length ? tr('Edit uses', 'Modifier les usages') : tr('Add a use', 'Ajouter un usage'),
      classe: 'store-chip store-chip-action', attrs: { type: 'button', 'aria-haspopup': 'menu' } });
    const remplir = (menu) => remplirUsages(menu, {
      estCoche: (u) => usagesDeLaPolice(nom, langue()).includes(u.id),
      cocher: (u, actif) => operationUsage('poser', { police: nom, id: u.id, actif }, langue()),
      apresCreation: (id) => operationUsage('poser', { police: nom, id, actif: true }, langue()),
      refaire: () => { const rouvrir = ouvert && ouvert.menu.isConnected; maj(); if (rouvrir) ouvrir(bouton); },
    });
    const ouvrir = (b) => { ouvert = menuFlottant(bloc, remplir, 'store-menu-tags', null, b); };
    bouton.onclick = () => ouvrir(bouton);
    if (ouvert && ouvert.menu.isConnected) ouvert.fermer();
    bloc.replaceChildren(el('div', { classe: 'store-classement-ligne' }, [
      ...noms.map(n => el('span', { texte: n, classe: 'store-chip store-chip-tag' })),
      bouton,
    ]));
  };
  maj();
  return bloc;
}

function message(texte, erreur = false){
  const m = $('policesMessage');
  m.textContent = texte || '';
  m.classList.toggle('erreur', !!erreur);
}

/**
 * Ajouter des polices depuis des fichiers : le pont lit et regroupe, on tranche ici les conflits de
 * nom (une police importée du même nom : remplacer ou garder les deux ; une intégrée : garder les
 * deux sous un autre nom, ou passer), puis le pont écrit.
 */
async function ajouterDepuisFichiers(){
  fermerMenuAjout();
  const pont = window.storyboarderAPI;
  if (!pont || !pont.pickFonts) return;
  const r = await pont.pickFonts(NOMS_INTEGRES);
  if (!r || r.canceled) return;
  const choix = {};
  for (const f of r.familles || []) {
    if (!f.conflit) continue;
    if (f.conflit === 'importee') {
      const remplacer = await _rappels.confirmer(
        tr(`You already have a font named "${f.famille}". Replace it with this one? (Cancel keeps both.)`,
          `Vous avez déjà une police nommée « ${f.famille} ». La remplacer par celle-ci ? (Annuler garde les deux.)`));
      choix[f.famille] = remplacer ? 'remplacer' : 'garder';
    } else {
      const garder = await _rappels.confirmer(
        tr(`"${f.famille}" is a built-in font. Add yours under another name?`,
          `« ${f.famille} » est une police intégrée. Ajouter la vôtre sous un autre nom ?`));
      choix[f.famille] = garder ? 'garder' : 'passer';
    }
  }
  const c = await pont.commitFonts(r.jeton, choix, NOMS_INTEGRES);
  if (!c || !c.ok) { message(tr('The fonts could not be added: ', 'Les polices n\'ont pas pu être ajoutées : ') + ((c && c.error) || '?'), true); return; }
  await chargerPolicesUtilisateur();
  rendreListe();
  if (_rappels.apresChangement) _rappels.apresChangement();
  const n = (r.familles || []).filter(f => choix[f.famille] !== 'passer').length;
  const illisibles = (r.illisibles || []).length;
  message([
    n ? tr(`${n} font(s) added.`, `${n} police(s) ajoutée(s).`) : '',
    illisibles ? tr(`${illisibles} file(s) could not be read as fonts: ${r.illisibles.join(', ')}.`, `${illisibles} fichier(s) illisible(s) comme police : ${r.illisibles.join(', ')}.`) : '',
  ].filter(Boolean).join(' '), illisibles > 0 && !n);
}

function basculerMenuAjout(){
  const menu = $('policesAjoutMenu');
  menu.hidden = !menu.hidden;
}
function fermerMenuAjout(){
  const menu = $('policesAjoutMenu');
  if (menu) menu.hidden = true;
}

/** Renommer une police importée (appelé par le menu du clic droit). */
export async function renommerPolice(ancien, nouveau){
  const r = await window.storyboarderAPI.renameFont(ancien, nouveau, NOMS_INTEGRES);
  if (!r || !r.ok) { message(tr('Renaming failed.', 'Le renommage a échoué.'), true); return; }
  await chargerPolicesUtilisateur();
  rendreListe();
  if (_rappels.apresChangement) _rappels.apresChangement();
}

/** Supprimer une police importée, après confirmation (appelé par le menu du clic droit). */
export async function supprimerPolice(nom){
  const ok = await _rappels.confirmer(tr(`Delete the font "${nom}" from your fonts? Bubbles that use it will fall back to a default font.`,
    `Supprimer la police « ${nom} » de vos polices ? Les Bulles qui l'utilisent passeront à une police de secours.`));
  if (!ok) return;
  const r = await window.storyboarderAPI.deleteFont(nom);
  if (!r || !r.ok) { message(tr('Deletion failed.', 'La suppression a échoué.'), true); return; }
  await chargerPolicesUtilisateur();
  fermerFiche();
  rendreListe();
  if (_rappels.apresChangement) _rappels.apresChangement();
}

export function rafraichirTextesPolices(){
  const btn = $('policesOuvrirBtn');
  if (btn) { btn.title = tr('My fonts', 'Mes polices'); btn.setAttribute('aria-label', tr('My fonts', 'Mes polices')); }
  if (!$('policesModal') || $('policesModal').classList.contains('hidden')) return;
  rendreListe();
  rendreFiltreUsages();
}

export async function ouvrirPolices(){
  message('');
  fermerFiche();
  rendreListe();
  rendreFiltreUsages();
  $('policesModal').classList.remove('hidden');
  // Relu à chaque ouverture : une police a pu être ajoutée ou retirée du dossier entre-temps.
  await chargerPolicesUtilisateur();
  rendreListe();
  rendreFiltreUsages();
}

export function fermerPolices(){
  fermerMenuAjout();
  fermerFiche();
  $('policesModal').classList.add('hidden');
}

/**
 * Le câblage, une fois. Rappels (injectés par events.js, cf. architecture) : `confirmer(message)`,
 * `menuPolice(ev, nom)` (le menu du clic droit), `apresChangement()` (redessiner les Bulles).
 */
export function cablerPolices(rappels = {}){
  _rappels = rappels || {};
  const policesModal = document.getElementById('policesModal');
  if (!policesModal) return;
  const modale = policesModal;
  $('policesOuvrirBtn').onclick = () => {
    if (modale.classList.contains('hidden')) ouvrirPolices(); else fermerPolices();
  };
  $('policesFermer').onclick = fermerPolices;
  $('policesRetour').onclick = fermerFiche;
  $('policesPhrase').addEventListener('input', majPhraseDExemple);
  $('policesVueGrille').onclick = () => { memoriserVue('grille'); rendreListe(); };
  $('policesVueListe').onclick = () => { memoriserVue('liste'); rendreListe(); };
  $('policesAjouter').onclick = basculerMenuAjout;
  $('policesAjoutFichier').onclick = ajouterDepuisFichiers;
  policesModal.addEventListener('mousedown', (e) => {
    if (e.target === policesModal) fermerPolices();
    else if (!e.target.closest || !e.target.closest('.polices-ajout')) fermerMenuAjout();
  });
  rafraichirTextesPolices();
}
