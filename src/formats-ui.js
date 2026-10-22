/**
 * @file formats-ui.js
 * La modale « Formats du projet » (#453), ouverte par l'entrée « Gérer les formats… » de la liste
 * des formats d'un Tome. Les décisions sont dans src/formats.js ; ici, l'affichage et le câblage.
 *
 * Chaque format : son nom, ses dimensions, les Tomes qui l'utilisent, « Renommer » et « Supprimer »
 * (éteint, avec la raison en infobulle, tant qu'un Tome l'utilise ou que c'est le dernier). Dessous,
 * la création : nom, largeur, hauteur, unité. Chaque opération prend un point d'annulation.
 */
import { S, tr } from './state.js';
import { renderAll } from './draw.js';
import { confirmAction, openRenameEntityModal } from './io.js';
import { enregistrerFermeture } from './modal-stack.js';
import {
  libelleDuFormat, nomDuFormat, tomesDuFormat, suppressionPossible, supprimerFormat, renommerFormat,
  creerFormat, trouverFormat,
} from './formats.js';

let _rappels = { snapshot: () => {} };
/** Les rappels de events.js (règle n°2 : pas d'import circulaire). */
export function setFormatsCallbacks(r){ _rappels = { ..._rappels, ...r }; }

const formatsModal = document.getElementById('formatsModal');
const liste = document.getElementById('formatsListe');
const champNom = document.getElementById('formatsNom');
const champLargeur = document.getElementById('formatsLargeur');
const champHauteur = document.getElementById('formatsHauteur');
const champUnite = document.getElementById('formatsUnite');
const erreur = document.getElementById('formatsErreur');

const MESSAGES = {
  nom: () => tr('Give the format a name.', 'Donnez un nom au format.'),
  doublon: () => tr('A format already has that name.', 'Un format porte déjà ce nom.'),
  dimensions: () => champUnite.value === 'mm'
    ? tr('Width and height: between 10 and 2000 mm.', 'Largeur et hauteur : entre 10 et 2000 mm.')
    : tr('Width and height: between 50 and 20000 px.', 'Largeur et hauteur : entre 50 et 20000 px.'),
  allongement: () => tr('One side cannot be more than 20 times the other.', 'Un côté ne peut pas dépasser 20 fois l\'autre.'),
};

function raisonDuRefus(r){
  if (r.erreur === 'utilise') {
    const noms = r.tomes.map(t => t.name).join(', ');
    return tr(`Used by: ${noms}. Change their format first.`, `Utilisé par : ${noms}. Changez d'abord leur format.`);
  }
  if (r.erreur === 'dernier') return tr('A project keeps at least one format.', 'Un projet garde au moins un format.');
  return '';
}

function rafraichir(){
  renderAll();
  afficherListe();
}

function renommer(f){
  const actuel = nomDuFormat(f, tr);
  openRenameEntityModal('format', actuel, actuel, {
    pris: S.formats.map(x => nomDuFormat(x, tr)),
    appliquer: (nom) => {
      _rappels.snapshot();
      renommerFormat(S.formats, f.key, nom, tr);
      rafraichir();
    },
  });
}

async function supprimer(f){
  if (!suppressionPossible(S.formats, f.key, S.tomes).ok) return;
  const ok = await confirmAction(
    tr(`Delete the format "${nomDuFormat(f, tr)}"?`, `Supprimer le format « ${nomDuFormat(f, tr)} » ?`),
    tr('Delete a format', 'Supprimer un format'));
  if (!ok || !trouverFormat(S.formats, f.key)) return;
  _rappels.snapshot();
  supprimerFormat(S.formats, f.key, S.tomes);
  rafraichir();
}

function afficherListe(){
  liste.innerHTML = '';
  S.formats.forEach(f => {
    const ligne = document.createElement('div');
    ligne.className = 'format-ligne';
    const texte = document.createElement('div');
    texte.className = 'format-texte';
    const nom = document.createElement('b');
    nom.textContent = libelleDuFormat(f, tr);
    const usage = document.createElement('small');
    const n = tomesDuFormat(S.tomes, f.key).length;
    usage.textContent = n ? tr(`${n} volume${n > 1 ? 's' : ''}`, `${n} tome${n > 1 ? 's' : ''}`) : tr('Unused', 'Inutilisé');
    texte.append(nom, usage);

    const btnRenommer = document.createElement('button');
    btnRenommer.type = 'button';
    btnRenommer.className = 'full-btn edit-btn format-btn';
    btnRenommer.textContent = tr('Rename', 'Renommer');
    btnRenommer.onclick = () => renommer(f);

    const btnSupprimer = document.createElement('button');
    btnSupprimer.type = 'button';
    btnSupprimer.className = 'full-btn delete-btn format-btn';
    btnSupprimer.textContent = tr('Delete', 'Supprimer');
    const r = suppressionPossible(S.formats, f.key, S.tomes);
    btnSupprimer.disabled = !r.ok;
    btnSupprimer.title = raisonDuRefus(r);
    btnSupprimer.onclick = () => supprimer(f);

    ligne.append(texte, btnRenommer, btnSupprimer);
    liste.appendChild(ligne);
  });
}

function creer(){
  const essai = creerFormat(S.formats.slice(), {
    nom: champNom.value, largeur: champLargeur.value, hauteur: champHauteur.value, unite: champUnite.value,
  }, tr);
  if (essai.erreur) { erreur.textContent = MESSAGES[essai.erreur](); return; }
  _rappels.snapshot();
  creerFormat(S.formats, {
    nom: champNom.value, largeur: champLargeur.value, hauteur: champHauteur.value, unite: champUnite.value,
  }, tr);
  erreur.textContent = '';
  champNom.value = ''; champLargeur.value = ''; champHauteur.value = '';
  rafraichir();
}

/** Ouvre la modale. */
export function ouvrirFormats(){
  erreur.textContent = '';
  afficherListe();
  formatsModal.classList.remove('hidden');
  setTimeout(() => champNom.focus(), 0);
}

function fermerFormats(){
  formatsModal.classList.add('hidden');
}

if (formatsModal) {
  document.getElementById('formatsCreer').onclick = creer;
  document.getElementById('formatsFermer').onclick = fermerFormats;
  [champNom, champLargeur, champHauteur].forEach(c => c.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); creer(); }
  }));
  [champNom, champLargeur, champHauteur, champUnite].forEach(c => c.addEventListener('input', () => { erreur.textContent = ''; }));
  formatsModal.addEventListener('mousedown', (e) => { if (e.target === formatsModal) fermerFormats(); });
  enregistrerFermeture('formatsModal', fermerFormats);
}
