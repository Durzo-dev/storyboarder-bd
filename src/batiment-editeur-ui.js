/**
 * @file batiment-editeur-ui.js
 * L'ÉDITEUR DE BÂTIMENT (#454a-2) : l'écran. La vue de dessus (src/batiment-plan.js), l'aperçu 3D,
 * le menu. Le fichier et sa relecture sont dans src/batiment.js, le rangement dans
 * src/batiment-store.js.
 *
 * TROIS ENTRÉES (demandé) : le bouton du bandeau, « Créer un bâtiment » au clic droit d'une Scène, et
 * « Modifier » au clic droit sur un Bâtiment ou une Pièce du menu de droite. Cette dernière travaille
 * sur une COPIE des murs de la Scène (batimentDesPieces) : la Scène n'est pas touchée, et
 * « Enregistrer dans la bibliothèque » en fait un Modèle.
 *
 * UN SEUL ÉCRAN AU CENTRE, comme le Lecteur : l'ouvrir ferme l'Éditeur de modèle et le Lecteur (les
 * rappels d'events.js), et ce qui mène ailleurs dans le menu de gauche ou le bandeau le ferme. Un
 * bâtiment modifié et pas enregistré demande confirmation avant d'être abandonné.
 *
 * L'APERÇU 3D a son propre renderer, comme celui du store (store-apercu-3d.js, dont il reprend les
 * gestes et le cadrage) : il ne touche pas à la scène partagée des Cases (cf. rendreApercu3D), il
 * dessine à la demande et libère tout à la fermeture.
 */
import { tr } from './state.js';
import { creerBatiment, nomAfficheDuFichier, DEFAUTS_BATIMENT, TYPES_D_OUVERTURE } from './batiment.js';
import {
  ICONES_TYPE_ESCALIER, ICONES_SENS_ESCALIER, ICONES_RAMPE, ICONES_MARCHES, ICONES_OUVERTURE, ICONES_MANOEUVRE,
  ICONES_REMPLISSAGE, ICONES_DESSUS, iconeSensPorte,
} from './batiment-icones.js';
import { actionDEnregistrement } from './batiment-bibliotheque.js';
import { signatureDuBatiment, signatureDeStructure } from './batiment-element.js';
import { enregistrerBatiment, listerBatiments, lireBatimentDuDisque } from './batiment-store.js';
import {
  versEcran, versBatiment, pasDeGrille, zoomerAutour, glisserVue, boiteDesMurs, cadrerSur,
  affichageApercuLu, coinLePlusProche,
} from './batiment-plan.js';
import { polygonesDesMurs, morceauxDuMur } from './batiment-geometrie.js';
import {
  placement, reglagesParDefaut, ajouterOuverture, deplacerOuverture, modifierOuverture, ouvertureSous,
  supprimerOuverture, intervalleDe, hauteurDuMur, monterOuverture, PAS_ALLEGE, essayerOuverture,
} from './batiment-ouvertures.js';
import {
  aimanter, ajouterMur, ajouterRectangle, croiseUnMur, deplacerSommet, supprimerMur, sommetSous, murSous,
  sommetsDuNiveau,
} from './batiment-trace.js';
import { actualiserPieces, formesDesPieces, pieceSous, supprimerPiece } from './batiment-pieces.js';
import {
  formeDeLEscalier, tremieDeLEscalier, validiteDeLEscalier, ajouterEscalier, modifierEscalier, supprimerEscalier,
  escalierSous, hauteurAFranchir, DEFAUTS_ESCALIER, TYPES_D_ESCALIER, essayerEscalier, aimanterEscalier, escaliersBloques,
} from './batiment-escaliers.js';
import {
  niveauxTries, niveauDessous, niveauDessus, ajouterEtage, dupliquerNiveau, supprimerNiveau, modifierNiveau,
  deplacerNiveau,
} from './batiment-niveaux.js';
import { cadrage3D, orbite3D, zoom3D, positionCamera3D, deplacement3D } from './store-apercu-3d.js';
import { construireBatiment3D, materiauxBatiment3D } from './batiment-3d.js';
import { carreDeTexture } from './textures-store-ui.js';
import { normaliserRevetement, peintureDuRevetement } from './batiment-revetements.js';
import { sectionDroitePliee, memoriserSectionDroite } from './section-memory.js';
import { ajouterMeuble, meubleSous, aimanterMeuble, tournerMeuble, echelonnerMeuble, supprimerMeuble, empreinteDuMeuble, fichiersDesMeubles,
  curseurDeLEchelle, echelleDuCurseur, tailleDuMeuble, collerAuSol, tournerDe, pencherMeuble, redresserMeuble, meubleEnCollision, devantDuMeuble,
  axesDuMeuble } from './batiment-mobilier.js';
import { ouvrirStore } from './store-ui.js';
import { getLoadedModel, preloadModels } from './model-cache.js';
import { metasLocales } from './model-thumbnails.js';
import { cloneSkinned } from './vendor/SkeletonUtils.js';

const $ = (id) => document.getElementById(id);

let _rappels = { confirmer: async () => true, alerter: async () => {}, avantOuverture: () => {}, apresFermeture: () => {} };
/** Les rappels d'events.js (règle n°2 : pas d'import circulaire). */
export function setBatimentEditeurCallbacks(r){ _rappels = { ..._rappels, ...r }; }

/** L'édition en cours : { batiment, fichier, refBiblio, refScene, vue, niveauId, apercu, geste, … }, ou null. */
let E = null;

export function editeurDeBatimentOuvert(){ return !!E; }

// ── Les pièces, par le clic droit de leur liste (#454b, demandé) : les gestes appelés par events.js ──

/** Le nom de la pièce `id`, et ceux de toutes les pièces du niveau courant (pour refuser un doublon). */
export function nomsDesPiecesDuNiveau(id){
  if (!E) return { nom: '', pris: [] };
  const siennes = E.batiment.pieces.filter(p => p.niveauId === E.niveauId);
  return { nom: (siennes.find(p => p.id === id) || {}).nom || '', pris: siennes.map(p => p.nom) };
}
/** Renomme une pièce (un point d'annulation). */
export function renommerPieceDeLEditeur(id, nom){
  if (!E || !nom) return;
  modifier(b => { const p = b.pieces.find(q => q.id === id); if (p) p.nom = nom; });
}
/** Supprime une pièce : ses murs, sauf ceux qu'elle partage avec une voisine (un point d'annulation). */
export function supprimerPieceDeLEditeur(id){
  if (!E) return;
  modifier(b => supprimerPiece(b, E.niveauId, id, supprimerMur));
}

/**
 * Ouvre l'éditeur. `batiment` : celui à modifier (une copie est faite) ; absent, un bâtiment neuf.
 * `fichier` : son fichier dans la bibliothèque, s'il en vient (l'enregistrer le réécrit).
 */
export function ouvrirEditeurDeBatiment({ batiment = null, fichier = null, destination = null } = {}){
  if (E) fermerSansDemander();
  _rappels.avantOuverture();
  const b = batiment ? JSON.parse(JSON.stringify(batiment)) : creerBatiment('', tr);
  // Les pièces se déduisent des murs (#454a-3b) : un bâtiment repris d'une Scène reçoit les siennes.
  b.niveaux.forEach(n => actualiserPieces(b, n.id, tr));
  E = {
    batiment: b, fichier, vue: null,
    // CE QUI A CHANGÉ se mesure, il ne se coche pas (signalé : après un Ctrl+Z, « Appliquer » restait
    // allumé) : la signature du bâtiment comparée à celle qu'il avait à l'ouverture (pour la Scène) et
    // au dernier enregistrement (pour la bibliothèque). Revenir en arrière rend les boutons éteints.
    refScene: signatureDuBatiment(b), refBiblio: signatureDuBatiment(b),
    // LA BIBLIOTHÈQUE, PAR STRUCTURE (demandé) : la structure de chaque bâtiment qui y est (nom mis à
    // part) → son fichier. Lue à l'ouverture ; tant qu'elle ne l'est pas, on s'en tient à refBiblio.
    structuresBiblio: null, niveauId: b.niveaux[0].id, apercu: null, geste: null,
    // #454a-3 : le tracé.
    // Aucun outil à l'ouverture : le menu de base (demandé).
    outil: null, chaine: null, survol: null, selection: null,
    glisserSommet: null, historique: [], refaire: [],
    appui: null, rectangle: null,   // #454a-3b : un glisser de l'outil Mur trace une pièce rectangulaire
    // #454a-3c : les réglages de l'ouverture à poser, et l'ouverture qu'on fait glisser.
    reglagesOuverture: reglagesParDefaut('porte'), glisserOuverture: null,
    coupe: true,   // #454b : l'aperçu 3D coupé au niveau courant ; coché par défaut (demandé)
    // #454c : les réglages de l'escalier à poser (et sa dernière direction), le geste de pose, le
    // fantôme sous la souris, l'escalier qu'on fait glisser.
    reglagesEscalier: { ...DEFAUTS_ESCALIER, angle: -Math.PI / 2 }, poseEscalier: null, fantomeEscalier: null, glisserEscalier: null,
    // #454a-4 : où va le bâtiment en sortant. { mode: 'placer' | 'appliquer', valider(batiment) },
    // ou null (ouvert par le bandeau : il ne va que dans la bibliothèque).
    destination,
  };
  $('batimentEditeur').classList.remove('hidden');
  $('batimentApercuCoupe').classList.toggle('actif', E.coupe);
  $('batimentNom').value = b.nom;
  // Un bâtiment vide s'ouvre sur l'outil Mur (demandé) : il n'y a rien d'autre à faire.
  choisirOutil(b.murs.length ? null : 'mur');
  recadrer();
  appliquerAffichage();
  E.apercu = ouvrirApercu($('batimentApercu'), b);
  lireStructuresDeLaBibliotheque(E);
  window.addEventListener('keydown', clavier, true);
  window.addEventListener('resize', dessinerPlan);
}

/** Ferme sans rien demander (les modifications non enregistrées sont perdues). */
function fermerSansDemander(){
  if (!E) return;
  if (E.apercu) E.apercu.fermer();
  E = null;
  $('batimentEditeur').classList.add('hidden');
  window.removeEventListener('keydown', clavier, true);
  window.removeEventListener('resize', dessinerPlan);
  _rappels.apresFermeture();
}

/**
 * Ferme l'éditeur ; s'il y a des modifications non enregistrées, demande d'abord. Rend une promesse :
 * vrai si l'éditeur est fermé.
 */
export async function fermerEditeurDeBatiment(){
  if (!E) return true;
  if (nonSauve()) {
    const ok = await _rappels.confirmer(
      tr('This building has unsaved changes. Close the editor without saving them?',
        'Ce bâtiment a des modifications non enregistrées. Fermer l\'éditeur sans les enregistrer ?'),
      tr('Building editor', 'Éditeur de bâtiment'));
    if (!ok || !E) return !E;
  }
  fermerSansDemander();
  return true;
}

/**
 * Les boutons qui font sortir le bâtiment (demandé) :
 *   - « Placer dans la scène » (orange, on ajoute) : éteint tant qu'il n'a aucun mur ;
 *   - « Appliquer les modifications » (jaune, on modifie) : éteint sans modification, ou sans mur ;
 *   - « Enregistrer dans la bibliothèque » : éteint sans modification (demandé, même pour un bâtiment
 *     qui n'y est pas encore), et sans mur.
 */
/** Lit la structure de chaque bâtiment de la bibliothèque, puis rafraîchit les boutons. */
async function lireStructuresDeLaBibliotheque(ed){
  const structures = new Map();
  for (const fichier of await listerBatiments()) {
    const r = await lireBatimentDuDisque(fichier, tr);
    if (r.ok) structures.set(signatureDeStructure(r.batiment), fichier);
  }
  if (E !== ed) return;
  ed.structuresBiblio = structures;
  majBoutonsDeSortie();
}

/** Le fichier de la bibliothèque qui a déjà EXACTEMENT cette structure, ou null. */
function dejaDansLaBibliotheque(){
  return E.structuresBiblio ? (E.structuresBiblio.get(signatureDeStructure(E.batiment)) || null) : null;
}

/**
 * Le bâtiment diffère-t-il de ce qui est dans la bibliothèque ? Par STRUCTURE quand elle est lue
 * (demandé) : une copie placée identique à un modèle n'a rien à y enregistrer, quel que soit son nom.
 */
function differeBiblio(){
  if (E.structuresBiblio) return !dejaDansLaBibliotheque();
  return signatureDuBatiment(E.batiment) !== E.refBiblio;
}
/** … de la copie placée dans la Scène ? */
function differeScene(){ return signatureDuBatiment(E.batiment) !== E.refScene; }
/**
 * Des modifications seraient-elles perdues en fermant ? Seulement si le bâtiment a CHANGÉ depuis
 * l'ouverture et n'a pas été enregistré depuis. ⚠️ Pas `differeBiblio()` : celle-ci répond « oui »
 * pour tout bâtiment absent de la bibliothèque (un neuf, une copie placée), même intact, et quitter
 * sans rien toucher demandait confirmation (signalé).
 */
function nonSauve(){
  const sig = signatureDuBatiment(E.batiment);
  return sig !== E.refScene && sig !== E.refBiblio;
}

function majBoutonsDeSortie(){
  const b = E.batiment, sansMur = !b.murs.length;
  const dest = $('batimentPlacerBtn');
  dest.hidden = !E.destination;
  if (E.destination) {
    const appliquer = E.destination.mode === 'appliquer';
    dest.textContent = appliquer ? tr('Apply the changes', 'Appliquer les modifications') : tr('Place in the scene', 'Placer dans la scène');
    dest.classList.toggle('edit-btn', appliquer);
    dest.disabled = sansMur || (appliquer && !differeScene());
    dest.title = sansMur ? tr('Draw at least one wall first.', 'Tracez d\'abord au moins un mur.')
      : dest.disabled ? tr('Nothing has changed yet.', 'Rien n\'a encore changé.') : '';
  }
  const enr = $('batimentEnregistrerBtn');
  enr.disabled = sansMur || !differeBiblio();
  const present = dejaDansLaBibliotheque();
  enr.title = sansMur ? tr('Draw at least one wall first.', 'Tracez d\'abord au moins un mur.')
    : !enr.disabled ? ''
    : present ? tr(`Already in the library, as "${nomAfficheDuFichier(present)}".`, `Déjà dans la bibliothèque, sous « ${nomAfficheDuFichier(present)} ».`)
    : tr('Nothing has changed since it was saved.', 'Rien n\'a changé depuis l\'enregistrement.');
}


function ligne(nom, detail){
  const d = document.createElement('div');
  d.className = 'batiment-ligne';
  const n = document.createElement('span'); n.textContent = nom;
  const s = document.createElement('small'); s.textContent = detail || '';
  d.append(n, s);
  return d;
}
function vide(texte){
  const d = document.createElement('div');
  d.className = 'empty-hint';   // #460h : l'état vide commun
  d.textContent = texte;
  return d;
}
const metres = (v) => `${(Math.round(v * 100) / 100).toLocaleString(tr('en', 'fr'))} m`;
const surface = (v) => `${(Math.round(v * 10) / 10).toLocaleString(tr('en', 'fr'))} m²`;

function remplirPanneau(){
  const b = E.batiment;
  majOutilEscalier();
  majBoutonsDeSortie();
  remplirNiveaux();
  construireColonneDesNiveaux();
  // Les pièces du niveau, avec leur surface ; un clic en choisit une (outil Sélection).
  const formes = formesDesPieces(b, E.niveauId);
  const pieces = $('batimentPieces');
  const siennes = b.pieces.filter(p => p.niveauId === E.niveauId);
  pieces.replaceChildren(...(siennes.length ? siennes.map(p => {
    const l = ligne(p.nom, formes.has(p.id) ? surface(formes.get(p.id).aire) : '');
    l.classList.add('cliquable');
    l.onclick = () => { choisirOutil('selection'); E.selection = { pieceId: p.id }; remplirPanneau(); dessinerPlan(); };
    // Le clic droit : renommer ou supprimer la pièce (demandé ; le menu est posé par events.js).
    l.addEventListener('contextmenu', (e) => { e.preventDefault(); if (_rappels.menuPiece) _rappels.menuPiece(e, p.id); });
    return l;
  }) : [vide(tr('No room yet: close a contour of walls.', 'Aucune pièce : fermez un contour de murs.'))]));
  remplirRevetements();
  const m = murSelectionne(), piece = pieceSelectionnee(), ouv = ouvertureSelectionnee(), esc = escalierSelectionne(), meuble = meubleSelectionne();
  $('batimentSelectionOuverture').hidden = !ouv;
  $('batimentSelectionEscalier').hidden = !esc;
  $('batimentSelectionMeuble').hidden = !meuble;
  // Le nom de l'élément est le TITRE de la section (demandé) ; il n'est pas répété dessous.
  $('batimentMeubleNom').hidden = true;
  if (meuble) reglagesDuMeuble(meuble);
  // Un seul menu (demandé) : la section contextuelle s'ajoute au besoin, les commandes suivent.
  $('batimentSectionSelection').hidden = !(ouv || esc || meuble);
  $('batimentContexteOuverture').hidden = E.outil !== 'ouverture';
  $('batimentContexteEscalier').hidden = E.outil !== 'escalier';
  $('batimentAide').textContent = commandes({ m, piece, ouv, esc, meuble });
  $('batimentSelectionTitre').textContent = ouv ? tr('Selected opening', 'Ouverture sélectionnée') : esc ? tr('Selected staircase', 'Escalier sélectionné')
    : meuble ? meuble.nom : tr('Selection', 'Sélection');
  if (E.outil === 'escalier') formulaireEscalier($('batimentReglagesEscalier'), E.reglagesEscalier, (c) => {
    E.reglagesEscalier = { ...E.reglagesEscalier, ...c }; remplirPanneau(); dessinerPlan();
  });
  if (esc) {
    // Pendant qu'on le fait glisser, pas de recherche de place : elle serait refaite à chaque mouvement.
    formulaireEscalier($('batimentFormEscalier'), esc, (c) => retoucherEscalier(esc.id, c), E.glisserEscalier ? null : (c) => essaiEscalier(esc.id, c));
    // Tourner : décalé au besoin pour tenir, éteint seulement si aucune place proche ne convient.
    const t = essaiEscalier(esc.id, { angle: esc.angle + Math.PI / 2 });
    $('batimentEscalierTourner').disabled = !!t.erreur;
    $('batimentEscalierTourner').title = t.erreur || '';   // la raison d'un refus, pas le déplacement (demandé)
  }
  // Les deux formulaires d'ouverture : celle qu'on va poser (outil Ouverture), celle qu'on a choisie.
  if (E.outil === 'ouverture') formulaireOuverture($('batimentReglagesOuverture'), E.reglagesOuverture, (c) => {
    E.reglagesOuverture = c.type && c.type !== E.reglagesOuverture.type ? { ...reglagesParDefaut(c.type), sens: E.reglagesOuverture.sens, charniere: E.reglagesOuverture.charniere } : { ...E.reglagesOuverture, ...c };
    remplirPanneau(); dessinerPlan();
  });
  if (ouv) formulaireOuverture($('batimentFormOuverture'), ouv, (c) => retoucherOuverture(ouv.id, c), (c) => {
    const r = essayerOuverture(E.batiment, ouv.id, c);
    return r.erreur ? { erreur: refusOuverture(r.erreur) } : { ...r, note: noteDeDeplacement(r.deplacement, tr('the opening', 'l\'ouverture')) };
  });
}

// ── Les revêtements (#454d avec #446e) ───────────────────────────────────────────────────────────

/**
 * Les carrés gardés d'un remplissage à l'autre (le panneau est refait à chaque modification) : un
 * carré neuf repartait d'une image vide, le temps de charger la sienne (signalé sur le Sol d'une
 * Case). Clé : ce qu'il habille et la texture qu'il montre ; seule sa teinte change en place.
 */
const carresRevetement = new Map();

/** Où vit un revêtement, retrouvé PAR SON ID à chaque lecture : une annulation refait le bâtiment. */
function porteurDuRevetement(b, cible){
  if (cible.batiment) return b;
  return (b.pieces || []).find(p => p.id === cible.pieceId) || null;
}

/**
 * Un revêtement dans le menu : le carré de texture (le store en mode « choisir », sur l'usage) et sa
 * couleur dessous, appliquée en direct à l'aperçu 3D, une étape d'annulation par geste.
 */
function blocRevetement(l, gardes){
  const porteur = porteurDuRevetement(E.batiment, l.cible);
  const rev = normaliserRevetement(porteur && porteur[l.champ]);
  const texture = rev ? rev.texture : null;
  const cle = `${l.cible.batiment ? 'batiment' : l.cible.pieceId}|${l.champ}|${texture}`;
  gardes.add(cle);
  // Écrire le revêtement (null efface le champ : rien ne change pour un bâtiment sans revêtement).
  const ecrire = (b, valeur) => {
    const p = porteurDuRevetement(b, l.cible);
    if (!p) return;
    const v = normaliserRevetement(valeur);
    if (v) p[l.champ] = v; else delete p[l.champ];
  };
  let carre = carresRevetement.get(cle);
  if (carre) carre.teinter(rev && rev.couleur);
  else {
    carre = carreDeTexture({
      valeur: texture, usage: l.usage, titre: l.choisir, teinte: rev && rev.couleur,
      // Une autre texture repart de sa couleur naturelle, comme le Sol d'une Case.
      appliquer: (v) => modifier(b => ecrire(b, { texture: v, couleur: null })),
    });
    carresRevetement.set(cle, carre);
  }
  // La couleur : la naturelle de la texture tant qu'on n'en a pas choisi ; « Origine » y revient.
  const naturelle = () => { const p = peintureDuRevetement({ texture }, l.usage); return p.teinte || p.couleur; };
  const saisie = document.createElement('input');
  saisie.type = 'color';
  saisie.className = 'batiment-revetement-couleur';
  saisie.value = (rev && rev.couleur) || naturelle();
  saisie.couleurOrigine = naturelle;
  let geste = false;
  const poser = () => {
    const c = saisie.value.toLowerCase() === naturelle().toLowerCase() ? null : saisie.value;
    ecrire(E.batiment, { texture, couleur: c });
    carre.teinter(c);
    if (E.apercu) E.apercu.reconstruire(E.batiment);
  };
  saisie.addEventListener('input', () => {
    // Une seule étape d'annulation par geste : la première nuance la prend.
    if (!geste) { E.historique.push(JSON.stringify(E.batiment)); E.refaire = []; geste = true; }
    poser();
  });
  saisie.addEventListener('change', () => { if (!geste) { E.historique.push(JSON.stringify(E.batiment)); E.refaire = []; } geste = false; poser(); majBoutonsDeSortie(); });
  return sousSection(l.titre, carre, saisie);
}

/**
 * Les revêtements (demandé) : la FAÇADE dans la section Bâtiment, pour tous les étages ; la section
 * de la PIÈCE choisie, titrée de son nom : ses murs, son sol, son plafond. Sans pièce, elle se cache.
 */
function remplirRevetements(){
  const facade = $('batimentFacade'), zone = $('batimentRevetements');
  if (!facade || !zone) return;
  const gardes = new Set();
  facade.replaceChildren(blocRevetement({ titre: tr('Facade', 'Façade'), usage: 'mur-ext', cible: { batiment: true }, champ: 'facade',
    choisir: tr('Choose the facade', 'Choisir la façade') }, gardes));
  const piece = pieceSelectionnee();
  $('batimentSectionPiece').hidden = !piece;
  if (piece) {
    $('batimentSectionRevetements').textContent = piece.nom;
    const cible = { pieceId: piece.id };
    zone.replaceChildren(
      blocRevetement({ titre: tr('Walls', 'Murs'), usage: 'mur-int', cible, champ: 'murs', choisir: tr('Choose the walls', 'Choisir les murs') }, gardes),
      blocRevetement({ titre: tr('Floor', 'Sol'), usage: 'sol-int', cible, champ: 'sol', choisir: tr('Choose the floor', 'Choisir le sol') }, gardes),
      blocRevetement({ titre: tr('Ceiling', 'Plafond'), usage: 'plafond', cible, champ: 'plafond', choisir: tr('Choose the ceiling', 'Choisir le plafond') }, gardes));
  } else zone.replaceChildren();
  for (const k of [...carresRevetement.keys()]) if (!gardes.has(k)) carresRevetement.delete(k);
}

// ── Les niveaux (#454b) ────────────────────────────────────────────────────────────────────────

/** Le libellé court d'un niveau, pour sa pastille : « RDC », « 1 », « 2 »… (« -1 » pour un sous-sol). */
function libelleCourt(n){
  const t = niveauxTries(E.batiment);
  const base = Math.max(0, t.findIndex(x => x.elevation >= 0));
  const r = t.findIndex(x => x.id === n.id) - base;
  return r === 0 ? tr('GF', 'RDC') : String(r);
}

/** L'id du niveau du dessous (ses murs aimantent le tracé, demandé), ou null. */
function idDessous(){ const d = niveauDessous(E.batiment, E.niveauId); return d ? d.id : null; }

/** Change le niveau courant : ce qu'on trace, ce qu'on voit, ce que coupe l'aperçu. */
function choisirNiveau(id){
  if (!E || !E.batiment.niveaux.some(n => n.id === id) || id === E.niveauId) return;
  E.niveauId = id; E.chaine = null; E.selection = null; E.survol = null; E.rectangle = null; E.appui = null;
  remplirPanneau();
  dessinerPlan();
  if (E.apercu) E.apercu.reconstruire(E.batiment);
}
/** Page haut / Page bas, et les flèches de la colonne. */
/** Ajoute un étage vide en haut, y passe, et prend l'outil Mur (demandé : il est vide). Raccourci N. */
function ajouterUnEtage(){
  let n = null; modifier(b => { n = ajouterEtage(b, tr); });
  if (n) { choisirNiveau(n.id); choisirOutil('mur'); }
}
/** Copie le niveau courant juste au-dessus, et y passe. Raccourci D. */
/** Le niveau courant a-t-il au moins une pièce ? Sans pièce, il n'y a rien à dupliquer (demandé). */
function niveauAvecPieces(){
  return !!E && E.batiment.pieces.some(p => p.niveauId === E.niveauId);
}

function dupliquerLEtage(){
  if (!niveauAvecPieces()) return;   // le raccourci D aussi : le bouton éteint ne suffit pas
  let n = null; const src = E.niveauId; modifier(b => { n = dupliquerNiveau(b, src, tr); });
  if (n) choisirNiveau(n.id);
}

function changerDeNiveau(sens){
  const v = sens > 0 ? niveauDessus(E.batiment, E.niveauId) : niveauDessous(E.batiment, E.niveauId);
  if (v) choisirNiveau(v.id);
}

/**
 * La colonne des niveaux, à gauche de la vue de dessus (demandé) : une pastille ronde par niveau, du
 * plus haut au plus bas, entre ▲ et ▼ ; le niveau courant en orange.
 */
function construireColonneDesNiveaux(){
  const col = $('batimentNiveauxPlan');
  if (!col) return;
  const bouton = (texte, titre, classe, faire, actif = false, inactif = false) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'batiment-outil batiment-niveau ' + classe; b.textContent = texte; b.title = titre;
    b.classList.toggle('actif', actif); b.disabled = inactif;
    b.onclick = faire;
    return b;
  };
  // Une FENÊTRE de cinq niveaux au plus, le courant au MILIEU (demandé : la colonne débordait de
  // l'application). Les places sans niveau (en haut ou en bas du bâtiment) restent vides, pour que le
  // niveau courant ne bouge pas.
  const t = niveauxTries(E.batiment).reverse();
  const i = t.findIndex(n => n.id === E.niveauId);
  const DEMI = 2;
  const places = [];
  for (let k = i - DEMI; k <= i + DEMI; k++) {
    const n = t[k];
    if (n) places.push(bouton(libelleCourt(n), n.nom, '', () => choisirNiveau(n.id), n.id === E.niveauId));
    else { const vide = document.createElement('span'); vide.className = 'batiment-niveau-vide'; places.push(vide); }
  }
  col.replaceChildren(
    bouton('▲', tr('Level above (↑ or Page Up)', 'Niveau du dessus (↑ ou Page haut)'), 'batiment-niveau-fleche', () => changerDeNiveau(1), false, !niveauDessus(E.batiment, E.niveauId)),
    ...places,
    bouton('▼', tr('Level below (↓ or Page Down)', 'Niveau du dessous (↓ ou Page bas)'), 'batiment-niveau-fleche', () => changerDeNiveau(-1), false, !niveauDessous(E.batiment, E.niveauId)),
  );
}

/**
 * La section « Niveaux » du menu de base, éditable (demandé) : par niveau, du plus haut au plus bas,
 * son nom, sa hauteur sous plafond et l'épaisseur de son plancher (sauf le plus bas, posé sur le
 * Sol), et sa suppression ; un clic sur la ligne en fait le niveau courant. Dessous : ajouter un
 * étage, dupliquer l'étage courant.
 */
function remplirNiveaux(){
  const zone = $('batimentNiveaux');
  // Un champ de la liste a le focus (on tape un nom, une hauteur) : la reconstruire le lui ôterait. On
  // ne fait que suivre le niveau courant ; la liste sera refaite à la validation (« change »).
  if (zone.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') {
    zone.querySelectorAll('.batiment-ligne-niveau').forEach(l => l.classList.toggle('actif', l.dataset.id === E.niveauId));
    return;
  }
  const tries = niveauxTries(E.batiment);
  const lignes = tries.slice().reverse().map(n => {
    const d = document.createElement('div');
    d.className = 'batiment-ligne batiment-ligne-niveau cliquable' + (n.id === E.niveauId ? ' actif' : '');
    d.dataset.id = n.id;
    // Un clic N'IMPORTE OÙ dans la ligne choisit le niveau (demandé), sauf sur sa suppression.
    d.onclick = (e) => { if (!e.target.closest('.batiment-niveau-suppr')) choisirNiveau(n.id); };
    const pastille = document.createElement('span');
    pastille.className = 'batiment-niveau-pastille'; pastille.textContent = libelleCourt(n);
    const nom = document.createElement('input');
    nom.type = 'text'; nom.className = 'batiment-niveau-nom'; nom.value = n.nom; nom.spellcheck = false;
    // Le champ rend le focus avant la modification : la liste peut alors se refaire (signalé : une
    // modification ou une suppression ne s'y voyait pas).
    nom.addEventListener('change', () => { nom.blur(); const v = nom.value.trim(); if (v && v !== n.nom) modifier(b => modifierNiveau(b, n.id, { nom: v })); else remplirNiveaux(); });
    nom.addEventListener('keydown', (e) => { if (e.key === 'Enter') nom.blur(); });
    nom.addEventListener('focus', () => choisirNiveau(n.id));
    const champ = (titre, valeur, quoi) => {
      const i = document.createElement('input');
      i.type = 'number'; i.min = '5'; i.step = '1'; i.value = Math.round(valeur * 100); i.title = titre;
      i.addEventListener('focus', () => choisirNiveau(n.id));
      i.addEventListener('change', async () => {
        i.blur();
        const v = Number(i.value);
        if (!Number.isFinite(v) || !await appliquerSansCasserLesEscaliers(b => modifierNiveau(b, n.id, { [quoi]: v / 100 }), tr('Change the height', 'Changer la hauteur'))) remplirNiveaux();
      });
      const w = document.createElement('span'); w.className = 'batiment-champ-valeur'; w.title = titre;
      w.append(i, document.createTextNode(' cm'));
      return w;
    };
    const suppr = document.createElement('button');
    suppr.type = 'button'; suppr.className = 'batiment-niveau-suppr'; suppr.textContent = '×';
    suppr.title = tries.length > 1 ? tr('Delete this level and what it holds', 'Supprimer ce niveau et ce qu\'il porte') : tr('A building keeps at least one level', 'Un bâtiment garde au moins un niveau');
    suppr.disabled = tries.length <= 1;
    suppr.onclick = () => supprimerUnNiveau(n);
    // Deux colonnes (demandé) : à gauche le numéro et, juste dessous, la suppression ; à droite le
    // nom et la hauteur sous plafond. L'épaisseur du plancher n'est plus réglable ici (demandé) :
    // elle garde sa valeur par défaut, 20 cm.
    const gauche = document.createElement('div');
    gauche.className = 'batiment-niveau-gauche';
    gauche.append(pastille, suppr);
    const droite = document.createElement('div');
    droite.className = 'batiment-niveau-droite';
    droite.append(nom, champ(tr('Ceiling height', 'Hauteur sous plafond'), n.hauteur, 'hauteur'));
    d.append(gauche, droite);
    // LE GLISSER-DÉPOSER (demandé) : la ligne se tire, sauf depuis un champ (on y sélectionne du texte).
    d.addEventListener('mousedown', (e) => { d.draggable = e.target.tagName !== 'INPUT'; });
    d.addEventListener('dragstart', (e) => { E.niveauTire = n.id; d.classList.add('tiree'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', n.id); });
    d.addEventListener('dragend', () => { E.niveauTire = null; zone.querySelectorAll('.batiment-ligne-niveau').forEach(l => l.classList.remove('tiree', 'cible-dessus', 'cible-dessous')); });
    d.addEventListener('dragover', (e) => {
      if (!E.niveauTire || E.niveauTire === n.id) return;
      e.preventDefault();
      const r = d.getBoundingClientRect(), dessus = e.clientY < r.top + r.height / 2;
      d.classList.toggle('cible-dessus', dessus); d.classList.toggle('cible-dessous', !dessus);
    });
    d.addEventListener('dragleave', () => d.classList.remove('cible-dessus', 'cible-dessous'));
    d.addEventListener('drop', (e) => {
      e.preventDefault();
      const tire = E.niveauTire;
      if (!tire || tire === n.id) return;
      // La liste est affichée du plus haut au plus bas : déposé AU-DESSUS d'une ligne, le niveau tiré
      // passe juste au-dessus de ce niveau dans la pile.
      const r = d.getBoundingClientRect(), dessus = e.clientY < r.top + r.height / 2;
      const pile = niveauxTries(E.batiment).filter(x => x.id !== tire);
      const k = pile.findIndex(x => x.id === n.id);
      const rang = dessus ? k + 1 : k;
      // Sans casser d'escalier (demandé) : sinon une fenêtre dit lesquels, et propose de les supprimer.
      appliquerSansCasserLesEscaliers(b => deplacerNiveau(b, tire, rang, tr), tr('Reorder the levels', 'Changer l\'ordre des niveaux'));
    });
    return d;
  });
  // Côte à côte, libellés courts, « Ajouter » à gauche (demandé) ; le nom complet en infobulle.
  const actions = document.createElement('div');
  actions.className = 'batiment-boutons-ligne';
  const ajouter = document.createElement('button');
  // Orange (demandé) : ces deux boutons CRÉENT un niveau.
  ajouter.type = 'button'; ajouter.className = 'full-btn'; ajouter.textContent = tr('Add', 'Ajouter');
  ajouter.title = tr('Add a floor: an empty level on top (N)', 'Ajouter un étage : un niveau vide en haut (N)');
  ajouter.onclick = ajouterUnEtage;
  const dupliquer = document.createElement('button');
  dupliquer.type = 'button'; dupliquer.className = 'full-btn'; dupliquer.textContent = tr('Duplicate', 'Dupliquer');
  dupliquer.title = tr('Duplicate the floor: copy the current level (walls, openings, rooms) just above it (D)', 'Dupliquer l\'étage : copier le niveau courant (murs, ouvertures, pièces) juste au-dessus (D)');
  dupliquer.onclick = dupliquerLEtage;
  // Un étage sans pièce ne se duplique pas (demandé) : bouton éteint, la raison en infobulle.
  if (!niveauAvecPieces()) {
    dupliquer.disabled = true;
    dupliquer.title = tr('Duplicate the floor: impossible, this level has no room yet (close a contour of walls)',
      'Dupliquer l\'étage : impossible, ce niveau n\'a encore aucune pièce (fermez un contour de murs)');
  }
  actions.append(ajouter, dupliquer);
  zone.replaceChildren(...lignes, actions);
}

/**
 * Applique un changement de la PILE DES NIVEAUX (réordonner, supprimer, changer une hauteur) sans
 * casser d'escalier (demandé) : il est d'abord essayé sur une copie. Si des escaliers ne tiendraient
 * plus, une fenêtre les cite, chacun avec sa raison, et propose de les SUPPRIMER pour faire le
 * changement quand même ; refuser ne change rien. `transformer(b)` fait le changement ; `titre` nomme
 * la fenêtre. Rend une promesse : vrai si le changement a été fait.
 */
async function appliquerSansCasserLesEscaliers(transformer, titre){
  const bloques = escaliersBloquesPar(transformer);
  if (!bloques.length) { modifier(transformer); return true; }
  const n = bloques.length;
  const ok = await _rappels.confirmer(
    tr(`This change would block ${n > 1 ? 'these staircases' : 'this staircase'}:`, `Ce changement bloquerait ${n > 1 ? 'ces escaliers' : 'cet escalier'} :`) + '\n\n' + lignesDesEscaliers(bloques)
      + '\n\n' + tr(`You can delete ${n > 1 ? 'them' : 'it'} to make the change anyway, or cancel and move ${n > 1 ? 'them' : 'it'} first.`,
        `Vous pouvez ${n > 1 ? 'les' : 'le'} supprimer pour faire le changement quand même, ou annuler pour ${n > 1 ? 'les' : 'le'} déplacer d'abord.`),
    titre,
    { ok: n > 1 ? tr(`Delete the ${n} staircases and continue`, `Supprimer les ${n} escaliers et continuer`) : tr('Delete the staircase and continue', 'Supprimer l\'escalier et continuer'), danger: true });
  if (!ok || !E) return false;
  appliquerEtSupprimer(transformer, bloques);
  return true;
}

/** Les escaliers que `transformer` bloquerait, essayé sur une copie. */
function escaliersBloquesPar(transformer){
  const apres = JSON.parse(JSON.stringify(E.batiment));
  transformer(apres);
  return escaliersBloques(E.batiment, apres, (id) => [...formesDesPieces(E.batiment, id).values()], (id) => [...formesDesPieces(apres, id).values()]);
}

/** Fait le changement, et supprime les escaliers bloqués : un seul point d'annulation. */
function appliquerEtSupprimer(transformer, bloques){
  const ids = new Set(bloques.map(x => x.escalier.id));
  modifier(bat => { transformer(bat); bat.escaliers = (bat.escaliers || []).filter(x => !ids.has(x.id)); });
}

/** Une ligne par escalier bloqué : lequel (son rang dans son niveau, son type, sa largeur), et pourquoi. */
function lignesDesEscaliers(bloques){
  const types = { droit: tr('straight', 'droit'), L: tr('L-shaped', 'en L'), U: tr('U-shaped', 'en U') };
  const raisons = {
    sansEtage: tr('it would have no level above to lead to', 'il n\'aurait plus de niveau au-dessus où mener'),
    mur: tr('with the new height, it would cross a wall', 'avec la nouvelle hauteur, il traverserait un mur'),
    hors: tr('with the new height, it would no longer fit in its room', 'avec la nouvelle hauteur, il ne tiendrait plus dans sa pièce'),
  };
  return bloques.map(({ escalier, niveau, raison }) => {
    const rang = E.batiment.escaliers.filter(x => x.niveauId === escalier.niveauId).findIndex(x => x.id === escalier.id) + 1;
    const nom = tr(`Staircase ${rang} (${types[escalier.type]}, ${Math.round(escalier.largeur * 100)} cm), on "${niveau ? niveau.nom : '?'}"`,
      `Escalier ${rang} (${types[escalier.type]}, ${Math.round(escalier.largeur * 100)} cm), au niveau « ${niveau ? niveau.nom : '?'} »`);
    return `• ${nom} : ${raisons[raison] || raison}.`;
  }).join('\n');
}

/** Supprime un niveau qui porte quelque chose après confirmation ; un niveau vide, directement. */
async function supprimerUnNiveau(n){
  const transformer = (b) => supprimerNiveau(b, n.id);
  const plein = E.batiment.murs.some(m => m.niveauId === n.id);
  const bloques = escaliersBloquesPar(transformer);
  // UNE SEULE FENÊTRE (demandé) : ce que le niveau emporte, et les escaliers d'autres niveaux qu'il
  // bloquerait, qui partiraient avec lui. Un niveau vide qui ne bloque rien part sans question.
  if (plein || bloques.length) {
    const k = bloques.length;
    const morceaux = [plein
      ? tr(`Delete the level "${n.nom}" and everything on it? The levels above come down.`, `Supprimer le niveau « ${n.nom} » et tout ce qu'il porte ? Les niveaux du dessus redescendent.`)
      : tr(`Delete the level "${n.nom}"? The levels above come down.`, `Supprimer le niveau « ${n.nom} » ? Les niveaux du dessus redescendent.`)];
    if (k) {
      morceaux.push(tr(`${k > 1 ? 'These staircases' : 'This staircase'} of another level would also be deleted, as ${k > 1 ? 'they' : 'it'} would no longer fit:`,
        `${k > 1 ? 'Ces escaliers' : 'Cet escalier'} d'un autre niveau ${k > 1 ? 'seraient' : 'serait'} aussi ${k > 1 ? 'supprimés' : 'supprimé'}, car ${k > 1 ? 'ils ne tiendraient' : 'il ne tiendrait'} plus :`)
        + '\n' + lignesDesEscaliers(bloques));
    }
    const ok = await _rappels.confirmer(morceaux.join('\n\n'), tr('Delete a level', 'Supprimer un niveau'), {
      ok: tr('Delete', 'Supprimer'),
      danger: true,
    });
    if (!ok || !E) return;
  }
  // Le niveau courant supprimé : le plus bas des autres devient courant (choisi avant, pour que le menu
  // refait après la suppression ne vise pas un niveau disparu).
  if (E.niveauId === n.id) E.niveauId = niveauxTries(E.batiment).find(x => x.id !== n.id).id;
  appliquerEtSupprimer(transformer, bloques);
  remplirPanneau(); dessinerPlan(); if (E.apercu) E.apercu.reconstruire(E.batiment);
}

// ── Le tracé (#454a-3) : outils, historique, modifications ───────────────────────────────────────

/** La pièce sélectionnée, si elle existe encore. */
function pieceSelectionnee(){
  if (!E || !E.selection || !E.selection.pieceId) return null;
  return E.batiment.pieces.find(p => p.id === E.selection.pieceId) || null;
}

/** Le meuble (Élément) sélectionné, s'il existe encore (#454e). */
function meubleSelectionne(){
  if (!E || !E.selection || !E.selection.meubleId) return null;
  return (E.batiment.elements || []).find(x => x.id === E.selection.meubleId) || null;
}

/**
 * « Ajouter un Élément » (#454e, demandé) : le store de modèles en mode « choisir » ; le modèle
 * choisi est posé au centre de la pièce, au sol, puis choisi (outil Sélection). Ses dimensions : ce
 * que les vignettes ont relevé, sinon mesurées sur le modèle décodé.
 */
function ajouterUnElement(){
  const piece = pieceSelectionnee();
  if (!piece) return;
  const pieceId = piece.id, niveauId = E.niveauId;
  ouvrirStore({
    accepter: (e) => !e.introuvable && !e.batiment,
    choisir: async (fichier) => {
      if (!E) return;
      let mesurees = (metasLocales()[fichier] || {}).dimensions || null;
      if (!mesurees) {
        await preloadModels([fichier]);
        const c = getLoadedModel(fichier);
        const T = globalThis.THREE;
        if (c && c.scene && T) { const t = new T.Box3().setFromObject(c.scene).getSize(new T.Vector3()); mesurees = [t.x, t.z, t.y]; }
      }
      if (!E) return;
      const p = (E.batiment.pieces || []).find(x => x.id === pieceId);
      if (!p || !p.repere) return;
      let id = null;
      modifier(b => { id = ajouterMeuble(b, niveauId, { modelFile: fichier, centre: p.repere, mesurees }).id; });
      choisirOutil('selection');
      E.selection = { meubleId: id };
      remplirPanneau(); dessinerPlan();
      // Le modèle dans l'aperçu dès qu'il est décodé (une boîte en attendant).
      preloadModels([fichier]).then(() => { if (E && E.apercu) E.apercu.reconstruire(E.batiment); });
    },
  });
}

/** Rend à un meuble l'état `avant` (JSON) : un geste qui finissait dans un mur est défait. */
function remettreMeuble(id, avant){
  const i = (E.batiment.elements || []).findIndex(q => q.id === id);
  if (i >= 0 && avant) E.batiment.elements[i] = JSON.parse(avant);
}

/**
 * Une retouche d'un meuble d'un seul coup (quart de tour, « Remettre droit », hauteur, molette) :
 * refusée si elle le met dans un mur qu'il ne peut pas traverser (rien ne change).
 */
function retoucherMeuble(id, faire){
  const essai = JSON.parse(JSON.stringify(E.batiment));
  const x = (essai.elements || []).find(q => q.id === id);
  if (!x) return false;
  faire(x);
  if (meubleEnCollision(essai, x)) return false;
  modifier(b => { const y = (b.elements || []).find(q => q.id === id); if (y) faire(y); });
  return true;
}

/** Une longueur en mètres, lisible (« 1,02 m »). */
const enMetres = (v) => `${(Math.round(v * 100) / 100).toLocaleString(tr('en', 'fr'), { minimumFractionDigits: 2 })} m`;

/** Un angle en degrés, lisible (« 30° »). */
const enDegres = (r) => `${Math.round((r || 0) * 180 / Math.PI)}°`;

/**
 * LE REPÈRE D'AXES (demandé) : les trois axes de l'élément TOURNÉ, vus de trois quarts — x, sa
 * largeur (rouge) ; y, sa hauteur (vert) ; z, son devant (bleu). Un SVG, refait à chaque retouche.
 */
function repereDAxes(m){
  const A = axesDuMeuble(m);
  // Vue de trois quarts : un quart de tour de 45° et 30° de plongée.
  const vers = (v) => ({ x: 70 + (v.x - v.z) * 0.707 * 48, y: 62 - (v.y * 0.866 - (v.x + v.z) * 0.707 * 0.5) * 48 });
  const o = vers({ x: 0, y: 0, z: 0 });
  const axe = (v, coul, nom) => {
    const p = vers(v);
    return `<line x1="${o.x}" y1="${o.y}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="${coul}" stroke-width="2.5" stroke-linecap="round"/>`
      + `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${coul}"/>`
      + `<text x="${(p.x + (p.x - o.x) * 0.18).toFixed(1)}" y="${(p.y + (p.y - o.y) * 0.18 + 4).toFixed(1)}" fill="${coul}" font-size="11" font-weight="700" text-anchor="middle">${nom}</text>`;
  };
  // Dessinés du plus loin au plus proche (profondeur de la vue), pour que l'avant passe devant.
  const prof = (v) => v.x + v.z;
  const axes = [[A.x, '#e5534b', 'X'], [A.y, '#57ab5a', 'Y'], [A.z, '#539bf5', 'Z']].sort((a, b) => prof(a[0]) - prof(b[0]));
  const d = document.createElement('div');
  d.className = 'batiment-meuble-repere';
  d.innerHTML = `<svg viewBox="0 0 140 124" aria-hidden="true">${axes.map(([v, c, n]) => axe(v, c, n)).join('')}<circle cx="${o.x}" cy="${o.y}" r="3" fill="currentColor"/></svg>`;
  return d;
}

/**
 * Les RÉGLAGES de l'élément choisi (demandé) : ses dimensions (sur une ligne), son orientation (le
 * repère d'axes, ses angles, « Tourner de 90° », « Remettre droit »), sa taille (curseur, en direct,
 * une étape d'annulation par geste), « Collé au sol » et sa hauteur, « Peut traverser les murs ».
 */
function reglagesDuMeuble(meuble){
  const zone = $('batimentMeubleReglages');
  // Le curseur est tenu : le refaire le lâcherait sous la souris.
  if (zone.contains(document.activeElement) && document.activeElement.type === 'range') return;
  const id = meuble.id;
  const courant = () => (E.batiment.elements || []).find(x => x.id === id);
  const bouton = (texte, faire) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'nav-btn'; b.textContent = texte; b.onclick = faire; return b;
  };
  const coche = (texte, coche_, changer) => {
    const l = document.createElement('label'); l.className = 'modal-checkbox-line';
    const c = document.createElement('input'); c.type = 'checkbox'; c.checked = coche_;
    c.addEventListener('change', () => changer(c.checked));
    l.append(c, document.createTextNode(' ' + texte));
    return l;
  };
  // Dimensions, sur une ligne (demandé) : trois colonnes, le nom au-dessus de la valeur.
  const taille = document.createElement('div');
  taille.className = 'batiment-meuble-dimensions';
  const ecrireTaille = (x) => {
    const d = tailleDuMeuble(x);
    taille.replaceChildren(...[[tr('Width', 'Largeur'), d.largeur], [tr('Length', 'Longueur'), d.longueur], [tr('Height', 'Hauteur'), d.hauteur]].map(([n, v]) => {
      const c = document.createElement('div');
      const a = document.createElement('span'); a.textContent = n;
      const b = document.createElement('span'); b.textContent = enMetres(v);
      c.append(a, b);
      return c;
    }));
  };
  ecrireTaille(meuble);
  // Orientation : le repère, les angles, et deux boutons.
  // Les trois angles, en colonnes comme les dimensions.
  const angles = document.createElement('div');
  angles.className = 'batiment-meuble-dimensions';
  angles.replaceChildren(...[[tr('Turn', 'Rotation'), meuble.rotY], [tr('Tilt', 'Inclinaison'), meuble.rotX], [tr('Lean', 'Bascule'), meuble.rotZ]].map(([n, v]) => {
    const c = document.createElement('div');
    const a = document.createElement('span'); a.textContent = n;
    const b = document.createElement('span'); b.textContent = enDegres(v);
    c.append(a, b);
    return c;
  }));
  const boutons = document.createElement('div'); boutons.className = 'batiment-meuble-boutons';
  boutons.append(bouton(tr('Turn by 90°', 'Tourner de 90°'), () => retoucherMeuble(id, tournerMeuble)),
    bouton(tr('Straighten', 'Remettre droit'), () => retoucherMeuble(id, redresserMeuble)));
  // Taille : le curseur, logarithmique (×1 au milieu).
  const valeur = document.createElement('span'); valeur.className = 'batiment-meuble-echelle';
  const ecrireEchelle = (k) => { valeur.textContent = `×${k.toLocaleString(tr('en', 'fr'), { maximumFractionDigits: 2 })}`; };
  ecrireEchelle(meuble.echelle || 1);
  const curseur = document.createElement('input');
  curseur.type = 'range'; curseur.min = '0'; curseur.max = '100'; curseur.step = '0.5';
  curseur.value = String(curseurDeLEchelle(meuble.echelle || 1));
  curseur.className = 'batiment-meuble-curseur';
  let geste = null;
  curseur.addEventListener('input', () => {
    const x = courant(); if (!x) return;
    if (!geste) { E.historique.push(JSON.stringify(E.batiment)); E.refaire = []; geste = { avant: JSON.stringify(x) }; }
    x.echelle = echelleDuCurseur(curseur.value);
    E.collisionMeuble = meubleEnCollision(E.batiment, x) ? id : null;
    ecrireEchelle(x.echelle); ecrireTaille(x);
    dessinerPlan();
    if (E.apercu) E.apercu.reconstruire(E.batiment);
  });
  curseur.addEventListener('change', () => {
    // Relâché dans un mur : défait (demandé), comme un glissé.
    if (geste && E.collisionMeuble === id) { E.historique.pop(); remettreMeuble(id, geste.avant); }
    geste = null; E.collisionMeuble = null; curseur.blur(); apresModification();
  });
  const ligneTaille = document.createElement('div'); ligneTaille.className = 'batiment-meuble-ligne';
  ligneTaille.append(curseur, valeur);
  // Position : collé au sol (par défaut) ; décoché, sa hauteur. Traverser les murs (et le sol).
  const hauteur = document.createElement('label'); hauteur.className = 'batiment-champ';
  hauteur.hidden = meuble.colle !== false;
  const ht = document.createElement('span'); ht.textContent = tr('Height above the floor', 'Hauteur au-dessus du sol');
  const hw = document.createElement('span'); hw.className = 'batiment-champ-valeur';
  const hi = document.createElement('input'); hi.type = 'number'; hi.step = '1'; hi.value = String(Math.round((meuble.y || 0) * 100));
  if (!meuble.traverse) hi.min = '0';
  hi.addEventListener('change', () => {
    const n = Number(hi.value);
    if (!Number.isFinite(n)) { hi.value = String(Math.round((meuble.y || 0) * 100)); return; }
    modifier(b => { const x = (b.elements || []).find(q => q.id === id); if (x) collerAuSol(x, false, n / 100); });
  });
  hw.append(hi, document.createTextNode(' cm'));
  hauteur.append(ht, hw);
  zone.replaceChildren(
    sousSection(tr('Dimensions', 'Dimensions'), taille),
    sousSection(tr('Orientation', 'Orientation'), repereDAxes(meuble), angles, boutons),
    sousSection(tr('Size', 'Taille'), ligneTaille),
    sousSection(tr('Position', 'Position'),
      coche(tr('Stuck to the floor', 'Collé au sol'), meuble.colle !== false,
        (v) => modifier(b => { const x = (b.elements || []).find(q => q.id === id); if (x) collerAuSol(x, v); })),
      hauteur,
      // Décoché (par défaut), il ne traverse ni les murs ni, décollé, le sol (demandé).
      coche(tr('Can pass through walls', 'Peut traverser les murs'), !!meuble.traverse,
        (v) => modifier(b => { const x = (b.elements || []).find(q => q.id === id); if (!x) return; if (v) x.traverse = true; else { delete x.traverse; if (x.colle === false) collerAuSol(x, false); } }))));
}

/** L'escalier sélectionné, s'il existe encore. */
function escalierSelectionne(){
  if (!E || !E.selection || !E.selection.escalierId) return null;
  return (E.batiment.escaliers || []).find(x => x.id === E.selection.escalierId) || null;
}

/** Le message d'un refus d'escalier. */
function refusEscalier(erreur){
  if (erreur === 'hors') return tr('It would leave the building: no place nearby in its room fits.', 'Il sortirait du bâtiment : aucune place proche ne convient dans sa pièce.');
  return erreur === 'sansEtage' ? tr('A staircase needs a level above: add a floor first.', 'Un escalier a besoin d\'un niveau au-dessus : ajoutez d\'abord un étage.')
    : tr('This staircase would cross a wall.', 'Cet escalier traverserait un mur.');
}

/** « Déplacera l'escalier de 40 cm » (vide s'il ne bouge pas). */
function noteDeDeplacement(d, quoi){
  if (!(d > 0)) return '';
  const cm = Math.round(d * 100);
  return tr(`Moves ${quoi} by ${cm} cm so that it fits`, `Déplacera ${quoi} de ${cm} cm pour que ça tienne`);
}

/** Cette retouche de l'escalier : `{ erreur }` (raison lisible) ou `{ changements, deplacement, note }`. */
function essaiEscalier(id, changements){
  const r = essayerEscalier(E.batiment, id, changements, [...formesDesPieces(E.batiment, E.niveauId).values()]);
  return r.erreur ? { erreur: refusEscalier(r.erreur) } : { ...r, note: noteDeDeplacement(r.deplacement, tr('the staircase', 'l\'escalier')) };
}

/** Retouche l'escalier choisi, essayé d'abord sur une copie (cf. retoucherOuverture). */
function retoucherEscalier(id, changements){
  const essai = JSON.parse(JSON.stringify(E.batiment));
  const r = modifierEscalier(essai, id, changements);
  if (r.erreur) { remplirPanneau(); return; }
  modifier(b => modifierEscalier(b, id, changements));
}

/**
 * Le formulaire d'un escalier (#454c), dans `conteneur` : le type, la largeur, le côté où il tourne
 * (L et U), les contremarches, la rampe, et le nombre de marches qui en résulte.
 */
function formulaireEscalier(conteneur, v, changer, essayer = null){
  // `essayer(changements)` (un escalier posé) rend `{ erreur }` (la raison d'un refus : le choix est
  // ÉTEINT, la raison en infobulle) ou `{ changements, note }` : ce qu'il faut appliquer, position
  // comprise si l'escalier doit se décaler pour que le choix tienne (demandé), et l'infobulle qui le dit.
  const choix = (valeurs, actuelle, quoi, genre = 'type') => {
    const d = document.createElement('div'); d.className = 'choix ' + (genre === 'option' ? 'choix-options' : 'choix-types');
    valeurs.forEach(([val, lib, icone, bulle]) => {
      const b = document.createElement('button'); b.type = 'button';
      // Avec un pictogramme (demandé) : l'icône SEULE, le libellé passe dans l'infobulle.
      if (icone) { b.classList.add('icone'); b.innerHTML = icone; b.setAttribute('aria-label', bulle || lib); }
      else b.textContent = lib;
      b.classList.toggle('actif', actuelle === val);
      const essai = essayer && actuelle !== val ? essayer({ [quoi]: val }) : null;
      b.disabled = !!(essai && essai.erreur);
      // L'infobulle nomme le choix, sans le déplacement éventuel (demandé) ; un choix IMPOSSIBLE
      // (grisé) donne sa raison.
      b.title = essai && essai.erreur ? `${icone ? (bulle || lib) + ' : ' : ''}${essai.erreur}` : icone ? (bulle || lib) : (bulle || '');
      b.onclick = () => changer(essai && essai.changements ? essai.changements : { [quoi]: val });
      d.appendChild(b);
    });
    return d;
  };
  // La largeur : le champ prend toute la place restante (demandé), avec l'écart d'une sous-section dessous.
  const l = document.createElement('label'); l.className = 'batiment-champ batiment-champ-large';
  const lt = document.createElement('span'); lt.textContent = tr('Width', 'Largeur');
  const lw = document.createElement('span'); lw.className = 'batiment-champ-valeur';
  const li = document.createElement('input'); li.type = 'number'; li.min = '50'; li.max = '300'; li.step = '1'; li.value = Math.round(v.largeur * 100);
  // Une largeur qui ne tiendrait pas : le champ revient à la sienne, et dit pourquoi en infobulle.
  li.addEventListener('change', () => {
    const n = Number(li.value);
    if (!Number.isFinite(n)) { li.value = Math.round(v.largeur * 100); return; }
    const essai = essayer ? essayer({ largeur: n / 100 }) : null;
    if (essai && essai.erreur) { li.value = Math.round(v.largeur * 100); li.title = essai.erreur; li.classList.add('refuse'); return; }
    changer(essai ? essai.changements : { largeur: n / 100 });
  });
  lw.append(li, document.createTextNode(' cm')); l.append(lt, lw);
  // Deux sous-sections (demandé) : Type (la forme et le côté où il tourne), Marches (la rampe et
  // les contremarches) ; la largeur dessous (demandé). Le détail des marches n'est plus affiché.
  const I = ICONES_TYPE_ESCALIER, S = ICONES_SENS_ESCALIER, R = ICONES_RAMPE, M = ICONES_MARCHES;
  const type = [choix([
    ['droit', tr('Straight', 'Droit'), I.droit, tr('Straight staircase', 'Escalier droit')],
    ['L', tr('L', 'En L'), I.L, tr('L-shaped staircase (quarter turn)', 'Escalier en L (quart tournant)')],
    ['U', tr('U', 'En U'), I.U, tr('U-shaped staircase (half turn)', 'Escalier en U (demi-tour)')],
  ], v.type, 'type')];
  if (v.type !== 'droit') type.push(groupeOptions(choix([
    [1, tr('Left', 'Gauche'), S[1], tr('Turns left', 'Tourne à gauche')],
    [-1, tr('Right', 'Droite'), S[-1], tr('Turns right', 'Tourne à droite')],
  ], v.sens, 'sens', 'option')));
  const elements = [
    sousSection(tr('Type', 'Type'), ...type),
    sousSection(tr('Steps', 'Marches'),
      choix([
        ['aucune', tr('None', 'Aucune'), R.aucune, tr('No rail', 'Sans rampe')],
        ['gauche', tr('Left', 'Gauche'), R.gauche, tr('Rail on the left', 'Rampe à gauche')],
        ['droite', tr('Right', 'Droite'), R.droite, tr('Rail on the right', 'Rampe à droite')],
        ['deux', tr('Both', 'Les deux'), R.deux, tr('Rails on both sides', 'Rampe des deux côtés')],
      ], v.rampe, 'rampe'),
      // Pleines ou ouvertes, de profil (demandé : à la place de la case à cocher).
      choix([
        [true, tr('Solid', 'Pleines'), M.true, tr('Solid steps (with risers)', 'Marches pleines (avec contremarches)')],
        [false, tr('Open', 'Ouvertes'), M.false, tr('Open steps (no risers)', 'Marches ouvertes (sans contremarches)')],
      ], !!v.contremarches, 'contremarches')),
    l,
  ];
  // Seul reste l'avertissement utile : sans niveau au-dessus, l'escalier ne peut pas se poser.
  if (!(hauteurAFranchir(E.batiment, v.niveauId || E.niveauId) > 0)) {
    const info = document.createElement('p'); info.className = 'batiment-info';
    info.textContent = tr('No level above: add a floor first.', 'Pas de niveau au-dessus : ajoutez d\'abord un étage.');
    elements.push(info);
  }
  conteneur.replaceChildren(...elements);
}

/**
 * Les OPTIONS d'un type (demandé) : sous un filet, en sélecteurs segmentés compacts, pour qu'on
 * les distingue des types (grandes tuiles) par la forme et pas seulement par la taille.
 */
function groupeOptions(...rangees){
  const d = document.createElement('div'); d.className = 'choix-options-groupe';
  d.append(...rangees.filter(Boolean));
  return d;
}

/** Une sous-section de formulaire (Type, Marches, Dimensions…) : un creux titré. */
function sousSection(titre, ...contenu){
  const d = document.createElement('div'); d.className = 'batiment-sous-section';
  const h = document.createElement('h3'); h.textContent = titre;
  d.append(h, ...contenu);
  return d;
}

/** L'ouverture sélectionnée, si elle existe encore. */
function ouvertureSelectionnee(){
  if (!E || !E.selection || !E.selection.ouvertureId) return null;
  return (E.batiment.ouvertures || []).find(o => o.id === E.selection.ouvertureId) || null;
}

/** Le message d'un refus de pose ou de retouche d'une ouverture. */
function refusOuverture(erreur){
  return erreur === 'large' ? tr('This opening is too wide for the wall.', 'Cette ouverture est trop large pour le mur.')
    : erreur === 'chevauche' ? tr('It would overlap another opening.', 'Elle chevaucherait une autre ouverture.')
    : erreur === 'haute' ? tr('It would go through the ceiling.', 'Elle traverserait le plafond.')
    : tr('This opening does not fit here.', 'Cette ouverture ne tient pas ici.');
}

/** Retouche l'ouverture choisie ; essayée d'abord sur une copie, pour ne pas laisser de point d'annulation vide. */
function retoucherOuverture(id, changements){
  const essai = JSON.parse(JSON.stringify(E.batiment));
  const r = modifierOuverture(essai, id, changements);
  if (r.erreur) { remplirPanneau(); return; }
  modifier(b => modifierOuverture(b, id, changements));
}

/**
 * Le formulaire d'une ouverture (#454a-3c), construit dans `conteneur` : le type, les dimensions en
 * centimètres, les battants, coulissante, vitrée. `changer(partiel)` reçoit chaque modification.
 */
function formulaireOuverture(conteneur, v, changer, essayer = null){
  // `essayer(changements)` (une ouverture posée) : comme pour les escaliers, `{ erreur }` (éteint, la
  // raison en infobulle ; une valeur refusée revient et le dit) ou `{ changements, note }` (l'ouverture
  // glisse sur son mur à la place libre la plus proche si le choix l'exige, l'infobulle le dit).
  const O = ICONES_OUVERTURE;
  const types = [['porte', tr('Door', 'Porte'), O.porte], ['fenetre', tr('Window', 'Fenêtre'), O.fenetre],
    ['baie', tr('Bay', 'Baie'), O.baie, tr('Bay window', 'Baie vitrée')], ['passage', tr('Passage', 'Passage'), O.passage, tr('Passage (no door)', 'Passage (sans porte)')]];
  const choix = (valeurs, actuelle, quoi, genre = 'type') => {
    const d = document.createElement('div'); d.className = 'choix ' + (genre === 'option' ? 'choix-options' : 'choix-types');
    // La « manœuvre » n'est pas un champ : un battant, deux, ou coulissante (demandé, un seul choix).
    const champs = (val) => quoi !== 'manoeuvre' ? { [quoi]: val } : val === 'coulissant' ? { coulissant: true } : { coulissant: false, battants: val };
    valeurs.forEach(([val, lib, icone, bulle]) => {
      const b = document.createElement('button'); b.type = 'button';
      // Avec un pictogramme (demandé) : l'icône SEULE, le libellé passe dans l'infobulle.
      if (icone) { b.classList.add('icone'); b.innerHTML = icone; b.setAttribute('aria-label', bulle || lib); }
      else b.textContent = lib;
      b.classList.toggle('actif', actuelle === val);
      const essai = essayer && actuelle !== val ? essayer(champs(val)) : null;
      b.disabled = !!(essai && essai.erreur);
      // L'infobulle nomme le choix, sans le déplacement éventuel (demandé) ; un choix IMPOSSIBLE
      // (grisé) donne sa raison.
      b.title = essai && essai.erreur ? `${icone ? (bulle || lib) + ' : ' : ''}${essai.erreur}` : icone ? (bulle || lib) : (bulle || '');
      b.onclick = () => changer(essai && essai.changements ? essai.changements : champs(val));
      d.appendChild(b);
    });
    return d;
  };
  const champ = (libelle, valeur, quoi) => {
    const l = document.createElement('label'); l.className = 'batiment-champ';
    const t = document.createElement('span'); t.textContent = libelle;
    const w = document.createElement('span'); w.className = 'batiment-champ-valeur';
    const i = document.createElement('input'); i.type = 'number'; i.min = '0'; i.step = '1'; i.value = Math.round(valeur * 100);
    i.addEventListener('change', () => {
      const n = Number(i.value);
      if (!Number.isFinite(n) || n < 0) { i.value = Math.round(valeur * 100); return; }
      const essai = essayer ? essayer({ [quoi]: n / 100 }) : null;
      if (essai && essai.erreur) { i.value = Math.round(valeur * 100); i.title = essai.erreur; i.classList.add('refuse'); return; }
      changer(essai ? essai.changements : { [quoi]: n / 100 });
    });
    w.append(i, document.createTextNode(' cm'));
    l.append(t, w);
    return l;
  };
  // Deux sous-sections (demandé) : Type (des pictogrammes seulement), Dimensions.
  const type = [choix(types, v.type, 'type')];
  let sens = null;
  if (v.type === 'passage') {
    // Le dessus d'un passage : droit ou en arche (demandé).
    type.push(groupeOptions(choix([
      ['droit', tr('Straight', 'Droit'), ICONES_DESSUS.droit, tr('Straight top', 'Dessus droit')],
      ['arche', tr('Arch', 'Arche'), ICONES_DESSUS.arche, tr('Arched top', 'Dessus en arche')],
    ], v.dessus === 'arche' ? 'arche' : 'droit', 'dessus', 'option')));
  } else {
    // Un battant, deux, ou coulissante : un seul choix (la baie coulissante ignorait ses battants).
    const manoeuvre = v.coulissant ? 'coulissant' : (v.battants === 2 ? 2 : 1);
    const m = choix([
      [1, tr('1 leaf', '1 battant'), ICONES_MANOEUVRE[1], tr('One leaf', 'Un battant')],
      [2, tr('2 leaves', '2 battants'), ICONES_MANOEUVRE[2], tr('Two leaves', 'Deux battants')],
      ['coulissant', tr('Sliding', 'Coulissante'), ICONES_MANOEUVRE.coulissant, tr('Sliding', 'Coulissante')],
    ], manoeuvre, 'manoeuvre', 'option');
    // Le remplissage n'a de sens que pour une porte : fenêtres et baies sont toujours vitrées.
    const remplissage = v.type === 'porte' ? choix([
      [false, tr('Solid', 'Pleine'), ICONES_REMPLISSAGE.pleine, tr('Solid door', 'Porte pleine')],
      [true, tr('Glazed', 'Vitrée'), ICONES_REMPLISSAGE.vitree, tr('Glazed door', 'Porte vitrée')],
    ], !!v.vitre, 'vitre', 'option') : null;
    type.push(groupeOptions(m, remplissage));
    // Le sens d'une porte battante (demandé : visuel plutôt que « Inverser le côté / la charnière ») :
    // deux gestes, le côté où elle s'ouvre, et la charnière (un seul battant).
    if (v.type === 'porte' && !v.coulissant) {
      // Deux BASCULES séparées et centrées (demandé), chacune dessinant la porte telle qu'elle sera
      // après le clic : l'autre côté du mur, ou l'autre charnière.
      const gestes = document.createElement('div'); gestes.className = 'choix choix-bascules';
      const geste = (icone, bulle, faire) => {
        const g = document.createElement('button'); g.type = 'button'; g.className = 'icone';
        g.innerHTML = icone; g.title = bulle; g.setAttribute('aria-label', bulle); g.onclick = faire;
        gestes.appendChild(g);
      };
      const autreSens = v.sens === -1 ? 1 : -1, autreCharniere = v.charniere === 'fin' ? 'debut' : 'fin';
      geste(iconeSensPorte(autreSens, v.charniere, 'cote'), tr('Open to the other side of the wall', 'Ouvrir de l\'autre côté du mur'), () => changer({ sens: autreSens }));
      if (v.battants !== 2) geste(iconeSensPorte(v.sens, autreCharniere, 'charniere'), tr('Move the hinge to the other edge', 'Passer la charnière de l\'autre bord'), () => changer({ charniere: autreCharniere }));
      // Leur propre sous-section (demandé), « Sens d'ouverture ».
      sens = sousSection(tr('Opening direction', 'Sens d\'ouverture'), gestes);
    }
  }
  // « Hauteur d'allège », puis « Hauteur depuis le sol », trop long (demandé) : « Élévation », expliquée en infobulle.
  const bas = champ(tr('Elevation', 'Élévation'), v.y, 'y');
  bas.title = tr('Distance between the floor and the bottom of the opening', 'Distance entre le sol et le bas de l\'ouverture');
  conteneur.replaceChildren(...[
    sousSection(tr('Type', 'Type'), ...type),
    sens,
    sousSection(tr('Dimensions', 'Dimensions'),
      champ(tr('Width', 'Largeur'), v.largeur, 'largeur'), champ(tr('Height', 'Hauteur'), v.hauteur, 'hauteur'), bas),
  ].filter(Boolean));
}

/** Le mur sélectionné, s'il existe encore. */
function murSelectionne(){
  if (!E || !E.selection || !E.selection.murId) return null;
  return E.batiment.murs.find(m => m.id === E.selection.murId) || null;
}

/**
 * Choisit l'outil (null : aucun). Le menu de droite suit (demandé) : le panneau porte `data-outil`,
 * et chaque section dit pour quel outil elle s'affiche. Quitter la Sélection désélectionne.
 */
/**
 * L'outil Escalier n'a de sens qu'avec un niveau au-dessus (demandé) : sans lui, son bouton est
 * éteint et son infobulle dit pourquoi, au lieu d'un message d'erreur dans le menu. Pris alors qu'on
 * passe au dernier niveau, il est quitté.
 */
function majOutilEscalier(){
  const bouton = $('batimentOutilEscalier');
  const possible = !!niveauDessus(E.batiment, E.niveauId);
  if (bouton) {
    bouton.disabled = !possible;
    bouton.title = possible ? tr('Stairs (S)', 'Escaliers (S)')
      : tr('Stairs: a staircase needs a level above. Add a floor first (N).', 'Escaliers : un escalier a besoin d\'un niveau au-dessus. Ajoutez d\'abord un étage (N).');
  }
  if (!possible && E.outil === 'escalier') { E.outil = null; E.fantomeEscalier = null; E.poseEscalier = null;
    if (bouton) bouton.classList.remove('actif');
    $('batimentPlan').classList.remove('outil-mur'); }
}

function choisirOutil(outil){
  if (!E) return;
  if (outil === 'escalier' && !niveauDessus(E.batiment, E.niveauId)) return;
  E.outil = outil || null; E.chaine = null; E.survol = null;
  if (E.outil !== 'selection') E.selection = null;
  document.querySelectorAll('.batiment-outil').forEach(b => b.classList.toggle('actif', b.dataset.outil === E.outil));
  $('batimentPlan').classList.toggle('outil-mur', E.outil === 'mur' || E.outil === 'ouverture' || E.outil === 'escalier');
  E.fantomeEscalier = null;
  remplirPanneau();
  dessinerPlan();
}
/**
 * Le texte de « Commandes », selon l'outil et ce qui est choisi (demandé : il est contextuel).
 * Une action par ligne (le style garde les retours à la ligne).
 */
function commandes({ m, piece, ouv, esc, meuble }){
  // Une action par ligne, sans ligne vide (demandé).
  const lignes = (...l) => l.join('\n');
  const vue = [tr('Wheel: zoom.', 'Molette : zoomer.'), tr('Hold right button: move the view.', 'Clic droit maintenu : déplacer la vue.')];
  const sortir = tr('Esc: leave the tool.', 'Échap : quitter l\'outil.');
  const deselect = tr('Esc: deselect.', 'Échap : désélectionner.');
  if (E.outil === 'mur') return lignes(
    tr('Click: place a corner.', 'Clic : poser un angle.'),
    tr('Click on a wall: T junction.', 'Clic sur un mur : jonction en T.'),
    tr('Drag: rectangular room.', 'Glisser : pièce rectangulaire.'),
    tr('Double-click or right-click: end the line.', 'Double-clic ou clic droit : finir le tracé.'),
    tr('Alt: draw without snapping.', 'Alt : tracer sans aimant.'),
    tr('In red: crosses another wall.', 'En rouge : traverse un autre mur.'), sortir);
  if (E.outil === 'ouverture') return lignes(
    tr('Hover a wall: preview the opening.', 'Survol d\'un mur : aperçu de l\'ouverture.'),
    tr('Click: place and select it.', 'Clic : la poser et la choisir.'),
    tr('Right-click: change how a door opens.', 'Clic droit : changer le sens d\'une porte.'),
    tr('Wheel: change the type.', 'Molette : changer de type.'),
    tr('Ctrl + wheel: zoom.', 'Ctrl + molette : zoomer.'),
    tr('In red: does not fit.', 'En rouge : ne tient pas.'), sortir);
  if (E.outil === 'escalier') return lignes(
    tr('Click: place and select it.', 'Clic : le poser et le choisir.'),
    tr('Drag: orient it.', 'Tirer : l\'orienter.'),
    tr('Right-click: turn it.', 'Clic droit : le tourner.'),
    tr('Wheel: change the type.', 'Molette : changer de type.'),
    tr('Ctrl + wheel: zoom.', 'Ctrl + molette : zoomer.'),
    tr('Alt: place without snapping.', 'Alt : poser sans aimant.'),
    tr('In red: no level above, or crosses a wall.', 'En rouge : pas d\'étage au-dessus, ou traverse un mur.'), sortir);
  if (E.outil === 'selection') {
    if (meuble) return lignes(
      tr('Drag: move it (it snaps to the walls).', 'Tirer : le déplacer (il s\'aimante aux murs).'),
      tr('Right-click: turn it by 90°.', 'Clic droit : le tourner de 90°.'),
      tr('Hold right button: left / right turns it, up / down tilts it.', 'Clic droit maintenu : gauche / droite le tourne, haut / bas l\'incline.'),
      tr('Shift + hold right button: lean it sideways. Ctrl: by 15°.', 'Maj + clic droit maintenu : le basculer. Ctrl : par 15°.'),
      tr('In red: inside a wall, it will go back on release.', 'En rouge : dans un mur, il reviendra au relâcher.'),
      tr('Wheel: make it bigger or smaller.', 'Molette : l\'agrandir ou le rétrécir.'),
      tr('Alt: move without snapping.', 'Alt : déplacer sans aimant.'),
      tr('Del: delete it.', 'Suppr : le supprimer.'), deselect);
    if (ouv) return lignes(
      tr('Drag: slide it along its wall.', 'Tirer : la faire glisser sur son mur.'),
      tr('Wheel: raise or lower it.', 'Molette : la monter ou la descendre.'),
      tr('Shift + wheel: by 1 cm.', 'Maj + molette : au centimètre.'),
      tr('Del: delete it.', 'Suppr : la supprimer.'), deselect);
    if (esc) return lignes(
      tr('Drag: move it.', 'Tirer : le déplacer.'),
      tr('R: turn it by 90°.', 'R : le tourner de 90°.'),
      tr('Del: delete it.', 'Suppr : le supprimer.'), deselect);
    if (m) return lignes(
      tr('Drag a corner: move it with its walls.', 'Tirer un angle : le déplacer avec ses murs.'),
      tr('Del: delete the wall.', 'Suppr : supprimer le mur.'), deselect);
    if (piece) return lignes(
      tr('Right-click in the Rooms list: rename or delete.', 'Clic droit dans la liste Pièces : renommer ou supprimer.'), deselect);
    return lignes(
      tr('Click: pick a wall, room, opening or staircase.', 'Clic : choisir un mur, une pièce, une ouverture ou un escalier.'),
      tr('Drag a corner: move it with its walls.', 'Tirer un angle : le déplacer avec ses murs.'),
      tr('Drag an opening or a staircase: move it.', 'Tirer une ouverture ou un escalier : le déplacer.'),
      ...vue, sortir);
  }
  return lignes(
    tr('Buttons at the bottom of the view: pick a tool.', 'Boutons en bas de la vue : choisir un outil.'),
    tr('Round buttons on the left: change level.', 'Pastilles à gauche : changer de niveau.'),
    ...vue,
    tr('3D preview: left drag turns, right drag moves.', 'Aperçu 3D : clic gauche tourne, clic droit déplace.'));
}

/** Un clic sur un outil : le prend, ou le quitte s'il était déjà pris. */
function basculerOutil(outil){ if (E) choisirOutil(E.outil === outil ? null : outil); }

/** L'épaisseur des nouveaux murs, en mètres : fixe (demandé, elle ne se règle plus). */
function epaisseurDesNouveaux(){ return DEFAUTS_BATIMENT.epaisseur; }

/** Un point d'annulation, puis la modification, puis tout se redessine. */
function modifier(faire){
  E.historique.push(JSON.stringify(E.batiment));
  if (E.historique.length > 200) E.historique.shift();
  E.refaire = [];
  faire(E.batiment);
  // L'état d'avant : une pièce NÉE dans une autre en hérite les revêtements (actualiserPieces).
  actualiserPieces(E.batiment, E.niveauId, tr, JSON.parse(E.historique[E.historique.length - 1]));
  apresModification();
}

function apresModification(){
  if (E.selection && ((E.selection.murId && !murSelectionne()) || (E.selection.pieceId && !pieceSelectionnee())
    || (E.selection.ouvertureId && !ouvertureSelectionnee()) || (E.selection.escalierId && !escalierSelectionne())
    || (E.selection.meubleId && !meubleSelectionne()))) E.selection = null;
  remplirPanneau();
  dessinerPlan();
  if (E.apercu) E.apercu.reconstruire(E.batiment);
}

function annuler(){
  if (!E || !E.historique.length) return;
  E.refaire.push(JSON.stringify(E.batiment));
  E.batiment = JSON.parse(E.historique.pop());
  E.chaine = null;
  apresModification();
}
function retablir(){
  if (!E || !E.refaire.length) return;
  E.historique.push(JSON.stringify(E.batiment));
  E.batiment = JSON.parse(E.refaire.pop());
  E.chaine = null;
  apresModification();
}

function finirLaChaine(){
  if (!E || !E.chaine) return false;
  E.chaine = null;
  dessinerPlan();
  return true;
}

/** Un clic de l'outil Mur au point aimanté `s` (le résultat d'aimanter). */
function poserUnPoint(s){
  if (!E.chaine) { E.chaine = { depuis: s.point, accroche: s.accroche }; dessinerPlan(); return; }
  const { depuis, accroche } = E.chaine;
  if (Math.hypot(s.point.x - depuis.x, s.point.z - depuis.z) < 0.05) return;
  if (croiseUnMur(E.batiment, E.niveauId, depuis, s.point)) {
    return;   // refusé sans message (demandé) : le tracé était rouge
  }
  // Un point posé sur un sommet déjà présent ferme la forme : la chaîne s'arrête là.
  const ferme = s.accroche.type === 'sommet';
  let r = null;
  modifier(b => { r = ajouterMur(b, E.niveauId, depuis, s.point, epaisseurDesNouveaux(), { accrocheA: accroche, accrocheB: s.accroche }); });
  if (r && r.erreur) { annuler(); E.refaire = []; return; }
  E.chaine = ferme ? null : { depuis: s.point, accroche: { type: 'sommet' } };
  dessinerPlan();
}

/** Le glisser de l'outil Mur, relâché : la pièce rectangulaire (#454a-3b). */
function poserLeRectangle(){
  const { de, vers } = E.rectangle;
  E.rectangle = null;
  const essai = ajouterRectangle(JSON.parse(JSON.stringify(E.batiment)), E.niveauId, de, vers, epaisseurDesNouveaux());
  if (essai.erreur) {
    dessinerPlan();   // refusée sans message (demandé) : le rectangle était rouge
    return;
  }
  modifier(b => ajouterRectangle(b, E.niveauId, de, vers, epaisseurDesNouveaux()));
}

// ── La vue de dessus ─────────────────────────────────────────────────────────────────────────────

function taillePlan(){
  const c = $('batimentPlan');
  return { c, l: c.clientWidth || 1, h: c.clientHeight || 1 };
}

function recadrer(){
  if (!E) return;
  const { l, h } = taillePlan();
  E.vue = cadrerSur(boiteDesMurs(E.batiment, E.niveauId), l, h);
  dessinerPlan();
  if (E.apercu) E.apercu.recadrer();
}

function couleur(nom, repli){
  const v = getComputedStyle(document.body).getPropertyValue(nom).trim();
  return v || repli;
}

/**
 * Le symbole d'une ouverture dans la vue de dessus, dans la découpe `tranche` de son mur : les deux
 * tableaux (les bords du mur coupé), puis selon le type le vitrage (deux traits fins), le battant et
 * son arc d'ouverture (une porte), deux vantaux décalés (coulissante), ou les deux faces en pointillés
 * (un passage). `pleine` : la découpe est teintée (ouverture choisie, ou à poser).
 */
function dessinerOuverture(g, versE, echelle, mur, o, tranche, teinte, pleine){
  const L = Math.hypot(mur.b.x - mur.a.x, mur.b.z - mur.a.z) || 1;
  const u = { x: (mur.b.x - mur.a.x) / L, z: (mur.b.z - mur.a.z) / L }, n = { x: -u.z, z: u.x };
  const { s0, s1 } = intervalleDe(o, mur), e = mur.epaisseur / 2;
  const P = (s, d) => versE({ x: mur.a.x + u.x * s + n.x * d, z: mur.a.z + u.z * s + n.z * d });
  const trait = (p, q) => { g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); };
  if (pleine && tranche) {
    g.beginPath(); tranche.forEach((p, i) => { const q = versE(p); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.closePath();
    g.globalAlpha = 0.25; g.fillStyle = teinte; g.fill(); g.globalAlpha = 1;
  }
  g.strokeStyle = teinte; g.lineWidth = 1.5;
  trait(P(s0, -e), P(s0, e)); trait(P(s1, -e), P(s1, e));
  const milieu = (s0 + s1) / 2;
  if (o.type === 'passage') {
    g.save(); g.setLineDash([4, 3]); trait(P(s0, e), P(s1, e)); trait(P(s0, -e), P(s1, -e)); g.restore();
    return;
  }
  if (o.type !== 'porte' || o.coulissant) {
    // Vitrage, ou vantaux coulissants : deux traits parallèles à l'axe, décalés s'ils coulissent.
    const d = e * 0.35;
    if (o.coulissant) { trait(P(s0, d), P(milieu + 0.05, d)); trait(P(milieu - 0.05, -d), P(s1, -d)); }
    else { trait(P(s0, d), P(s1, d)); trait(P(s0, -d), P(s1, -d)); if (o.battants === 2) trait(P(milieu, -d), P(milieu, d)); }
    return;
  }
  // Une porte battante : le battant ouvert à 90° du côté `sens`, et l'arc qu'il décrit.
  const cote = (o.sens === -1 ? -1 : 1);
  const vantaux = o.battants === 2
    ? [{ s: s0, dir: 1, l: (s1 - s0) / 2 }, { s: s1, dir: -1, l: (s1 - s0) / 2 }]
    : [o.charniere === 'fin' ? { s: s1, dir: -1, l: s1 - s0 } : { s: s0, dir: 1, l: s1 - s0 }];
  for (const v of vantaux) {
    const H = P(v.s, cote * e), ouvert = P(v.s, cote * (e + v.l)), ferme = P(v.s + v.dir * v.l, cote * e);
    trait(H, ouvert);
    const a0 = Math.atan2(ferme.y - H.y, ferme.x - H.x), a1 = Math.atan2(ouvert.y - H.y, ouvert.x - H.x);
    let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    g.save(); g.setLineDash([3, 3]); g.lineWidth = 1;
    g.beginPath(); g.arc(H.x, H.y, v.l * echelle, a0, a0 + d, d < 0); g.stroke();
    g.restore();
  }
}

/**
 * Un escalier dans la vue de dessus, comme sur un plan : chaque marche en trait (un palier sans trait
 * intérieur), et la flèche de la montée qui suit ses volées, d'un rond au pied à une pointe en haut.
 */
function dessinerEscalier(g, versE, f, teinte, poly, fantome = false){
  g.save();
  f.morceaux.forEach(m => {
    poly(m.points);
    g.globalAlpha = fantome ? 0.35 : 0.18; g.fillStyle = teinte; g.fill();
    g.globalAlpha = 1; g.strokeStyle = teinte; g.lineWidth = 1; g.stroke();
  });
  g.lineWidth = 1.5; g.strokeStyle = teinte; g.fillStyle = teinte;
  const pts = f.volees.flatMap(v => [v.de, v.vers]).map(versE);
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
  const a = pts[0], z = pts[pts.length - 1], y = pts[pts.length - 2] || a;
  g.beginPath(); g.arc(a.x, a.y, 3, 0, Math.PI * 2); g.fill();
  const ang = Math.atan2(z.y - y.y, z.x - y.x);
  g.beginPath(); g.moveTo(z.x, z.y);
  g.lineTo(z.x - 9 * Math.cos(ang - 0.4), z.y - 9 * Math.sin(ang - 0.4));
  g.lineTo(z.x - 9 * Math.cos(ang + 0.4), z.y - 9 * Math.sin(ang + 0.4));
  g.closePath(); g.fill();
  g.restore();
}

function dessinerPlan(){
  if (!E || !E.vue) return;
  const { c, l, h } = taillePlan();
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  if (c.width !== Math.round(l * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(l * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = couleur('--paper', '#1b1c1f');
  g.fillRect(0, 0, l, h);

  // La grille : fine, puis forte, puis les deux axes de l'origine.
  const vue = E.vue;
  const { fin, fort } = pasDeGrille(vue.echelle);
  const trace = (pas, style, largeur) => {
    g.strokeStyle = style; g.lineWidth = largeur; g.beginPath();
    const x0 = vue.cx - l / 2 / vue.echelle, x1 = vue.cx + l / 2 / vue.echelle;
    const z0 = vue.cz - h / 2 / vue.echelle, z1 = vue.cz + h / 2 / vue.echelle;
    for (let x = Math.ceil(x0 / pas) * pas; x <= x1; x += pas) { const e = versEcran(vue, l, h, { x, z: 0 }).x; g.moveTo(Math.round(e) + 0.5, 0); g.lineTo(Math.round(e) + 0.5, h); }
    for (let z = Math.ceil(z0 / pas) * pas; z <= z1; z += pas) { const e = versEcran(vue, l, h, { x: 0, z }).y; g.moveTo(0, Math.round(e) + 0.5); g.lineTo(l, Math.round(e) + 0.5); }
    g.stroke();
  };
  g.globalAlpha = 0.5; trace(fin, couleur('--line', '#34353a'), 1);
  g.globalAlpha = 1; trace(fort, couleur('--line', '#34353a'), 1);
  const o = versEcran(vue, l, h, { x: 0, z: 0 });
  g.strokeStyle = couleur('--sepia', '#83838c'); g.lineWidth = 1; g.beginPath();
  g.moveTo(Math.round(o.x) + 0.5, 0); g.lineTo(Math.round(o.x) + 0.5, h);
  g.moveTo(0, Math.round(o.y) + 0.5); g.lineTo(l, Math.round(o.y) + 0.5);
  g.stroke();

  // Les murs du niveau courant, pleins, jonctions résolues (batiment-geometrie.js).
  const poly = (pts) => { g.beginPath(); pts.forEach((p, i) => { const e = versEcran(vue, l, h, p); if (i) g.lineTo(e.x, e.y); else g.moveTo(e.x, e.y); }); g.closePath(); };
  const murs = E.batiment.murs.filter(m => m.niveauId === E.niveauId);
  const formes = polygonesDesMurs(murs);
  const accent = couleur('--accent', '#ff7a45'), encre = couleur('--ink', '#ededef');

  // #454b : le niveau du DESSOUS, en transparence, pour tracer l'étage par-dessus ses murs.
  const dessous = niveauDessous(E.batiment, E.niveauId);
  if (dessous) {
    const mursDessous = E.batiment.murs.filter(m => m.niveauId === dessous.id);
    const fd = polygonesDesMurs(mursDessous);
    g.globalAlpha = 0.22; g.fillStyle = encre;
    mursDessous.forEach(m => { const f = fd.get(m.id); if (f) { poly(f); g.fill(); } });
    g.globalAlpha = 1;
  }

  // Les pièces (#454a-3b) : un fond léger sous les murs, plus soutenu pour la pièce choisie.
  const pieces = formesDesPieces(E.batiment, E.niveauId);
  const pieceSurvolee = E.outil === 'selection' && E.survol && E.survol.pieceId;
  for (const [id, f] of pieces) {
    // Le contour, puis ses trous (les îlots) dans le même tracé : la règle pair-impair les évide.
    g.beginPath();
    [f.points, ...(f.trous || [])].forEach(anneau => anneau.forEach((p, i) => {
      const e = versEcran(vue, l, h, p);
      if (i) g.lineTo(e.x, e.y); else { g.closePath(); g.moveTo(e.x, e.y); }
    }));
    g.closePath();
    g.fillStyle = accent;
    g.globalAlpha = (E.selection && E.selection.pieceId === id) ? 0.22 : pieceSurvolee === id ? 0.13 : 0.06;
    g.fill('evenodd');
    g.globalAlpha = 1;
  }
  const survole = E.outil === 'selection' && E.survol && E.survol.murId;
  // #454c : les escaliers du niveau (sous les murs), et la trémie de ceux du niveau du dessous.
  const versEsc = (p) => versEcran(vue, l, h, p);
  if (dessous) {
    g.save(); g.setLineDash([6, 4]); g.strokeStyle = couleur('--ink-soft', '#9a9aa2'); g.lineWidth = 1.5;
    (E.batiment.escaliers || []).filter(x => x.niveauId === dessous.id).forEach(x => {
      const t = tremieDeLEscalier(E.batiment, x);
      if (t) { poly(t); g.stroke(); }
    });
    g.restore();
  }
  (E.batiment.escaliers || []).filter(x => x.niveauId === E.niveauId).forEach(x => {
    const f = formeDeLEscalier(E.batiment, x);
    const choisi = (E.selection && E.selection.escalierId === x.id) || (E.outil === 'selection' && E.survol && E.survol.escalierId === x.id);
    if (f) dessinerEscalier(g, versEsc, f, choisi ? accent : couleur('--ink-soft', '#9a9aa2'), poly);
  });

  // #454e : le mobilier du niveau, en EMPREINTE : un rectangle tourné, son nom au milieu. Choisi ou
  // survolé (outil Sélection) : en couleur d'accent.
  (E.batiment.elements || []).filter(x => x && x.niveauId === E.niveauId && x.modelFile).forEach(x => {
    const choisi = (E.selection && E.selection.meubleId === x.id) || (E.outil === 'selection' && E.survol && E.survol.meubleId === x.id);
    // Forcé dans un mur qu'il ne peut pas traverser : en rouge (demandé).
    const teinte = E.collisionMeuble === x.id ? couleur('--danger', '#c0392b') : choisi ? accent : couleur('--ink-soft', '#9a9aa2');
    const coins = empreinteDuMeuble(x);
    g.save();
    poly(coins);
    g.globalAlpha = 0.18; g.fillStyle = teinte; g.fill();
    g.globalAlpha = 1; g.strokeStyle = teinte; g.lineWidth = choisi ? 2 : 1.5; g.stroke();
    // Le devant (le côté +z du modèle) : un trait du centre vers lui, pour voir où il regarde.
    const centre = versEsc({ x: x.x, z: x.z }), devant = versEsc(devantDuMeuble(x));
    g.lineWidth = choisi ? 3 : 2; g.beginPath(); g.moveTo(centre.x, centre.y); g.lineTo(devant.x, devant.y); g.stroke();
    g.beginPath(); g.arc(devant.x, devant.y, choisi ? 4 : 3, 0, Math.PI * 2); g.fillStyle = teinte; g.fill();
    g.fillStyle = teinte; g.font = '600 11px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(x.nom, centre.x, centre.y);
    g.restore();
  });

  // Chaque mur est coupé à ses ouvertures (#454a-3c), comme sur un plan d'architecte ; chaque
  // ouverture y dessine son symbole.
  const ouvertures = E.batiment.ouvertures || [];
  const versE = (p) => versEcran(vue, l, h, p);
  murs.forEach(m => {
    const f = formes.get(m.id); if (!f) return;
    const siennes = ouvertures.filter(o => o.murId === m.id);
    const { pleins, percees } = morceauxDuMur(f, m, siennes.map(o => intervalleDe(o, m)));
    pleins.forEach(q => {
      poly(q);
      g.fillStyle = (E.selection && E.selection.murId === m.id) ? accent : encre;
      g.fill();
      if (survole === m.id) { g.strokeStyle = accent; g.lineWidth = 2; g.stroke(); }
    });
    siennes.forEach((o, i) => {
      const choisie = E.selection && E.selection.ouvertureId === o.id;
      const survolee = E.outil === 'selection' && E.survol && E.survol.ouvertureId === o.id;
      dessinerOuverture(g, versE, vue.echelle, m, o, percees[i], (choisie || survolee) ? accent : couleur('--ink-soft', '#9a9aa2'), choisie);
    });
  });
  // L'ouverture à poser, sous la souris (outil Ouverture) : en accent, ou en rouge si elle ne tient pas.
  if (E.outil === 'ouverture' && E.survol && E.survol.murId) {
    const m = murs.find(x => x.id === E.survol.murId), f = m && formes.get(m.id);
    if (f) {
      const o = { ...E.reglagesOuverture, id: '_', murId: m.id, le: E.survol.le };
      const { percees } = morceauxDuMur(f, m, [intervalleDe(o, m)]);
      dessinerOuverture(g, versE, vue.echelle, m, o, percees[0], E.survol.ok ? accent : couleur('--danger', '#c0392b'), true);
    }
  }

  // Les sommets, en Sélection : des poignées.
  if (E.outil === 'selection') {
    sommetsDuNiveau(E.batiment, E.niveauId).forEach(q => {
      const e = versEcran(vue, l, h, q);
      const actif = E.survol && E.survol.sommet && Math.hypot(E.survol.sommet.x - q.x, E.survol.sommet.z - q.z) < 1e-6;
      g.beginPath(); g.arc(e.x, e.y, actif ? 6 : 4, 0, Math.PI * 2);
      g.fillStyle = actif ? accent : couleur('--paper-dark', '#212226'); g.fill();
      g.strokeStyle = accent; g.lineWidth = 1.5; g.stroke();
    });
  }

  // #454c : l'escalier à poser (outil Escalier), en accent, ou en rouge s'il ne tient pas.
  if (E.outil === 'escalier' && E.fantomeEscalier) {
    const f = formeDeLEscalier(E.batiment, E.fantomeEscalier);
    if (f) dessinerEscalier(g, versEsc, f, E.fantomeEscalier.ok ? accent : couleur('--danger', '#c0392b'), poly, true);
  }

  // Le nom et la surface de chaque pièce, à son repère.
  g.textAlign = 'center';
  for (const p of E.batiment.pieces.filter(q => q.niveauId === E.niveauId && pieces.has(q.id) && q.repere)) {
    const e = versEcran(vue, l, h, p.repere);
    g.font = '600 12.5px Inter, sans-serif'; g.fillStyle = encre; g.fillText(p.nom, e.x, e.y);
    g.font = '11px Inter, sans-serif'; g.fillStyle = couleur('--ink-soft', '#9a9aa2'); g.fillText(surface(pieces.get(p.id).aire), e.x, e.y + 14);
  }
  g.textAlign = 'start';

  // Le glisser de l'outil Mur : la pièce rectangulaire fantôme, ses dimensions.
  if (E.rectangle) {
    const { de, vers, erreur } = E.rectangle;
    const coins = [de, { x: vers.x, z: de.z }, vers, { x: de.x, z: vers.z }];
    const fantomes = coins.map((q, i) => ({ id: 'r' + i, a: q, b: coins[(i + 1) % 4], epaisseur: epaisseurDesNouveaux() }));
    const fp = polygonesDesMurs(fantomes);
    g.globalAlpha = 0.55; g.fillStyle = erreur ? couleur('--danger', '#c0392b') : accent;
    fantomes.forEach(f => { const q = fp.get(f.id); if (q) { poly(q); g.fill(); } });
    g.globalAlpha = 1;
    const centre = versEcran(vue, l, h, { x: (de.x + vers.x) / 2, z: (de.z + vers.z) / 2 });
    const texte = `${metres(Math.abs(vers.x - de.x))} × ${metres(Math.abs(vers.z - de.z))}`;
    g.font = '600 12px Inter, sans-serif';
    const lt = g.measureText(texte).width;
    g.fillStyle = couleur('--paper-dark', '#212226'); g.fillRect(centre.x - lt / 2 - 5, centre.y - 13, lt + 10, 18);
    g.fillStyle = erreur ? couleur('--danger', '#c0392b') : accent; g.fillText(texte, centre.x - lt / 2, centre.y);
  }

  // Le tracé en cours : le mur fantôme (rouge s'il en traverse un autre), sa longueur, les guides.
  if (E.outil === 'mur' && E.survol && E.survol.point && !E.rectangle) {
    const s = E.survol;
    g.save(); g.setLineDash([5, 4]); g.strokeStyle = accent; g.lineWidth = 1;
    (s.guides || []).forEach(gd => {
      const a = versEcran(vue, l, h, gd.de), b = versEcran(vue, l, h, gd.vers);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    });
    g.restore();
    if (E.chaine) {
      const fantome = { id: '_', a: E.chaine.depuis, b: s.point, epaisseur: epaisseurDesNouveaux() };
      const f = polygonesDesMurs([fantome]).get('_');
      if (f) {
        poly(f);
        g.globalAlpha = 0.55; g.fillStyle = s.croise ? couleur('--danger', '#c0392b') : accent; g.fill(); g.globalAlpha = 1;
        const L = Math.hypot(s.point.x - E.chaine.depuis.x, s.point.z - E.chaine.depuis.z);
        const milieu = versEcran(vue, l, h, { x: (s.point.x + E.chaine.depuis.x) / 2, z: (s.point.z + E.chaine.depuis.z) / 2 });
        const texte = metres(L);
        g.font = '600 12px Inter, sans-serif';
        const lt = g.measureText(texte).width;
        g.fillStyle = couleur('--paper-dark', '#212226'); g.fillRect(milieu.x - lt / 2 - 5, milieu.y - 22, lt + 10, 18);
        g.fillStyle = s.croise ? couleur('--danger', '#c0392b') : accent; g.fillText(texte, milieu.x - lt / 2, milieu.y - 9);
      }
    }
    const e = versEcran(vue, l, h, s.point);
    g.strokeStyle = accent; g.lineWidth = 2; g.beginPath();
    if (s.accroche.type === 'sommet') g.arc(e.x, e.y, 7, 0, Math.PI * 2);
    else if (s.accroche.type === 'mur') g.rect(e.x - 5, e.y - 5, 10, 10);
    else if (s.accroche.type === 'repere') { g.moveTo(e.x, e.y - 7); g.lineTo(e.x + 7, e.y); g.lineTo(e.x, e.y + 7); g.lineTo(e.x - 7, e.y); g.closePath(); }
    else { g.moveTo(e.x - 6, e.y); g.lineTo(e.x + 6, e.y); g.moveTo(e.x, e.y - 6); g.lineTo(e.x, e.y + 6); }
    g.stroke();
  }

  // L'échelle, en bas à gauche : la longueur du pas fort.
  const px = fort * vue.echelle;
  g.strokeStyle = couleur('--ink-soft', '#9a9aa2'); g.fillStyle = g.strokeStyle; g.lineWidth = 2;
  g.beginPath(); g.moveTo(16, h - 16); g.lineTo(16 + px, h - 16); g.stroke();
  g.font = '11px Inter, sans-serif'; g.fillText(metres(fort), 16, h - 22);
}

/** La souris sur le plan → un point du bâtiment, et la tolérance d'aimantation (10 px) en mètres. */
function souris(e){
  const r = $('batimentPlan').getBoundingClientRect();
  return { p: versBatiment(E.vue, r.width, r.height, { x: e.clientX - r.left, y: e.clientY - r.top }), tol: 10 / E.vue.echelle };
}

function survoler(e){
  const { p, tol } = souris(e);
  if (E.glisserSommet) {
    const s = aimanter(E.batiment, E.niveauId, p, { tol, libre: e.altKey, sauf: E.glisserSommet.actuel, dessous: idDessous() });
    deplacerSommet(E.batiment, E.niveauId, E.glisserSommet.actuel, s.point);
    actualiserPieces(E.batiment, E.niveauId, tr);
    E.glisserSommet.actuel = s.point;
    E.survol = { sommet: s.point };
    apresModification();
    return;
  }
  if (E.outil === 'mur') {
    // Un appui gauche qui glisse de plus de 6 px, hors d'une chaîne : une pièce rectangulaire.
    if (E.appui && !E.chaine && !E.rectangle && Math.hypot(e.clientX - E.appui.x, e.clientY - E.appui.y) > 6) {
      E.rectangle = { de: E.appui.s.point };
    }
    if (E.rectangle) {
      const vers = aimanter(E.batiment, E.niveauId, p, { tol, libre: e.altKey, dessous: idDessous() }).point;
      const essai = ajouterRectangle(JSON.parse(JSON.stringify(E.batiment)), E.niveauId, E.rectangle.de, vers, epaisseurDesNouveaux());
      E.rectangle = { de: E.rectangle.de, vers, erreur: essai.erreur || null };
      dessinerPlan();
      return;
    }
    const s = aimanter(E.batiment, E.niveauId, p, { tol, libre: e.altKey, depuis: E.chaine && E.chaine.depuis, dessous: idDessous() });
    s.croise = !!E.chaine && croiseUnMur(E.batiment, E.niveauId, E.chaine.depuis, s.point);
    E.survol = s;
  } else if (E.outil === 'escalier') {
    // #454c : le fantôme suit la souris ; pendant un appui, il tourne vers elle (par 15°).
    let depart = aimanter(E.batiment, E.niveauId, p, { tol, libre: e.altKey, dessous: idDessous() }).point;
    let angle = E.reglagesEscalier.angle;
    if (E.poseEscalier) {
      depart = E.poseEscalier.depart;
      if (Math.hypot(e.clientX - E.poseEscalier.x, e.clientY - E.poseEscalier.y) > 6) {
        const pas = Math.PI / 12;
        angle = Math.round(Math.atan2(p.z - depart.z, p.x - depart.x) / pas) * pas;
        E.poseEscalier.angle = angle;
      } else if (E.poseEscalier.angle != null) angle = E.poseEscalier.angle;
    }
    const fantome = { ...E.reglagesEscalier, niveauId: E.niveauId, depart, angle };
    // L'aimant (demandé) : un côté à moins de 15 px d'une face de mur s'y colle. Alt : libre.
    if (!e.altKey) fantome.depart = aimanterEscalier(E.batiment, fantome, 15 / E.vue.echelle);
    fantome.ok = !validiteDeLEscalier(E.batiment, fantome).erreur;
    E.fantomeEscalier = fantome;
  } else if (E.outil === 'ouverture') {
    // L'ouverture à poser suit la souris le long du mur survolé (#454a-3c).
    const m = murSous(E.batiment, E.niveauId, p, tol);
    if (m) {
      const r = placement(E.batiment, m.mur, m.t, E.reglagesOuverture.largeur);
      const H = hauteurDuMur(E.batiment, m.mur);
      E.survol = { murId: m.mur.id, le: r.le, ok: r.ok && E.reglagesOuverture.y <= H - 0.25, raison: r.raison || (r.ok ? null : 'large') };
      if (r.ok && E.reglagesOuverture.y > H - 0.25) E.survol.raison = 'haute';
    } else E.survol = null;
  } else if (E.outil === 'selection') {
    if (E.glisserMeuble) {
      // Le meuble suit la souris ; près d'un mur, il se colle à sa face (Alt : libre).
      const g = E.glisserMeuble;
      const x = E.batiment.elements.find(q => q.id === g.id);
      if (x) {
        let centre = { x: g.depart.x + p.x - g.p.x, z: g.depart.z + p.z - g.p.z };
        if (!e.altKey) centre = aimanterMeuble(E.batiment, x, centre);
        x.x = Math.round(centre.x * 1000) / 1000; x.z = Math.round(centre.z * 1000) / 1000;
        g.bouge = true;
        // Forcé dans un mur qu'il ne peut pas traverser : rouge ; il reviendra au relâcher (demandé).
        E.collisionMeuble = meubleEnCollision(E.batiment, x) ? x.id : null;
        apresModification();
      }
      return;
    }
    if (E.glisserEscalier) {
      // Le déplacement suit la souris ; une position où il traverserait un mur est sautée.
      const g = E.glisserEscalier;
      let depart = { x: g.depart.x + p.x - g.p.x, z: g.depart.z + p.z - g.p.z };
      const x = E.batiment.escaliers.find(q => q.id === g.id);
      if (x && !e.altKey) depart = aimanterEscalier(E.batiment, { ...x, depart }, 15 / E.vue.echelle);
      if (!modifierEscalier(E.batiment, g.id, { depart }).erreur) { g.bouge = true; apresModification(); }
      return;
    }
    if (E.glisserOuverture) {
      if (deplacerOuverture(E.batiment, E.glisserOuverture.id, p)) { E.glisserOuverture.bouge = true; apresModification(); }
      return;
    }
    const sommet = sommetSous(E.batiment, E.niveauId, p, tol);
    const ouvertureId = sommet ? null : ouvertureSous(E.batiment, E.niveauId, p, tol / 2);
    const m = (sommet || ouvertureId) ? null : murSous(E.batiment, E.niveauId, p, tol / 2);
    const escalierId = (sommet || ouvertureId || m) ? null : escalierSous(E.batiment, E.niveauId, p);
    const meubleId = (sommet || ouvertureId) ? null : meubleSous(E.batiment, E.niveauId, p);
    const pieceId = (sommet || m || ouvertureId || escalierId || meubleId) ? null : pieceSous(E.batiment, E.niveauId, p);
    E.survol = { sommet, murId: m ? m.mur.id : null, pieceId, ouvertureId, escalierId, meubleId };
  } else E.survol = null;
  dessinerPlan();
}

function cablerPlan(){
  const c = $('batimentPlan');
  c.addEventListener('wheel', (e) => {
    if (!E) return;
    e.preventDefault();
    // Une ouverture choisie : la molette la MONTE ou la DESCEND au lieu de zoomer (demandé ; 5 cm par
    // cran, 1 cm avec Maj). Les crans rapprochés ne font qu'un point d'annulation. L'aperçu 3D, lui,
    // garde sa molette pour zoomer.
    // #454e : sur un meuble (à l'outil Sélection), la molette le grandit ou le rétrécit (demandé). Les
    // crans rapprochés ne font qu'un point d'annulation ; Ctrl + molette zoome toujours.
    const meubleMolette = E.outil === 'selection' && !e.ctrlKey ? meubleSous(E.batiment, E.niveauId, souris(e).p) : null;
    if (meubleMolette) {
      const maintenant = Date.now();
      if (!E.molette || E.molette.id !== meubleMolette || maintenant - E.molette.t > 800) { E.historique.push(JSON.stringify(E.batiment)); E.refaire = []; }
      const x = E.batiment.elements.find(q => q.id === meubleMolette);
      const avant = x.echelle;
      echelonnerMeuble(x, e.deltaY < 0 ? 1 : -1);
      // Un cran qui le mettrait dans un mur qu'il ne peut pas traverser est refusé.
      if (meubleEnCollision(E.batiment, x)) x.echelle = avant;
      E.molette = { id: meubleMolette, t: maintenant };
      E.selection = { meubleId: meubleMolette };
      apresModification();
      return;
    }
    const ouv = E.outil === 'selection' && ouvertureSelectionnee();
    if (ouv) {
      const maintenant = Date.now();
      const nouveauGeste = !E.molette || E.molette.id !== ouv.id || maintenant - E.molette.t > 800;
      if (nouveauGeste) { E.historique.push(JSON.stringify(E.batiment)); E.refaire = []; }
      const pas = (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 0.01 : PAS_ALLEGE);
      if (monterOuverture(E.batiment, ouv.id, pas)) {
        E.molette = { id: ouv.id, t: maintenant };
        apresModification();
      } else if (nouveauGeste) E.historique.pop();
      return;
    }
    // L'outil Ouverture : la molette change le type de l'ouverture à poser (demandé) ; Ctrl + molette zoome.
    if (E.outil === 'ouverture' && !e.ctrlKey) {
      const types = TYPES_D_OUVERTURE, i = types.indexOf(E.reglagesOuverture.type);
      const type = types[(i + (e.deltaY > 0 ? 1 : types.length - 1)) % types.length];
      E.reglagesOuverture = { ...reglagesParDefaut(type), sens: E.reglagesOuverture.sens, charniere: E.reglagesOuverture.charniere };
      remplirPanneau(); survoler(e);
      return;
    }
    // L'outil Escalier : la molette change le type de l'escalier à poser (demandé) ; Ctrl + molette zoome.
    if (E.outil === 'escalier' && !e.ctrlKey) {
      const types = TYPES_D_ESCALIER, i = types.indexOf(E.reglagesEscalier.type);
      E.reglagesEscalier = { ...E.reglagesEscalier, type: types[(i + (e.deltaY > 0 ? 1 : types.length - 1)) % types.length] };
      remplirPanneau(); survoler(e);
      return;
    }
    const r = c.getBoundingClientRect();
    E.vue = zoomerAutour(E.vue, r.width, r.height, { x: e.clientX - r.left, y: e.clientY - r.top }, Math.exp(-e.deltaY * 0.0015));
    survoler(e);
  }, { passive: false });
  c.addEventListener('pointerdown', (e) => {
    if (!E) return;
    // Clic droit (ou milieu) maintenu : déplacer la vue. Un clic droit SANS glisser finit la chaîne.
    if (e.button === 2 || e.button === 1) {
      E.geste = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, bouge: false, bouton: e.button,
        // #454e : un clic droit maintenu SUR un élément le fait pivoter au lieu de déplacer la vue.
        meuble: e.button === 2 && E.outil === 'selection' ? meubleSous(E.batiment, E.niveauId, souris(e).p) : null };
      if (E.geste.meuble) { const x = E.batiment.elements.find(q => q.id === E.geste.meuble); E.geste.avant = JSON.stringify(x); E.geste.base = { rotY: x.rotY || 0, rotX: x.rotX || 0, rotZ: x.rotZ || 0 }; }
      c.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0 || !E.outil) return;
    const { p, tol } = souris(e);
    if (E.outil === 'mur') {
      // Le point est posé au RELÂCHER : un appui qui glisse trace une pièce rectangulaire.
      E.appui = { x: e.clientX, y: e.clientY, s: aimanter(E.batiment, E.niveauId, p, { tol, libre: e.altKey, depuis: E.chaine && E.chaine.depuis, dessous: idDessous() }) };
      c.setPointerCapture(e.pointerId);
      return;
    }
    if (E.outil === 'escalier') {
      // Le pied est posé à l'appui ; la direction se choisit en tirant, la pose se fait au relâcher.
      E.poseEscalier = { x: e.clientX, y: e.clientY, depart: aimanter(E.batiment, E.niveauId, p, { tol, libre: e.altKey, dessous: idDessous() }).point, angle: null };
      c.setPointerCapture(e.pointerId);
      return;
    }
    if (E.outil === 'ouverture') {
      const m = murSous(E.batiment, E.niveauId, p, tol);
      if (!m) return;
      const essai = ajouterOuverture(JSON.parse(JSON.stringify(E.batiment)), m.mur.id, m.t, E.reglagesOuverture);
      if (essai.erreur) return;   // refusée sans message (demandé) : l'aperçu était rouge
      // Posée : elle est choisie, et l'outil Sélection est pris (demandé, comme un escalier).
      let id = null;
      modifier(b => { const r = ajouterOuverture(b, m.mur.id, m.t, E.reglagesOuverture); id = r.ouverture && r.ouverture.id; });
      if (id) { choisirOutil('selection'); E.selection = { ouvertureId: id }; remplirPanneau(); dessinerPlan(); }
      return;
    }
    const sommet = sommetSous(E.batiment, E.niveauId, p, tol);
    if (sommet) {
      E.historique.push(JSON.stringify(E.batiment)); E.refaire = [];
      E.glisserSommet = { depart: sommet, actuel: sommet };
      c.setPointerCapture(e.pointerId);
      return;
    }
    // Une ouverture : la choisir, et la faire glisser le long de son mur si on tire.
    const ouvertureId = ouvertureSous(E.batiment, E.niveauId, p, tol / 2);
    if (ouvertureId) {
      E.selection = { ouvertureId };
      E.historique.push(JSON.stringify(E.batiment)); E.refaire = [];
      E.glisserOuverture = { id: ouvertureId, bouge: false };
      c.setPointerCapture(e.pointerId);
      remplirPanneau(); dessinerPlan();
      return;
    }
    // #454e : un meuble, le choisir, et le déplacer si on tire.
    const meubleId = meubleSous(E.batiment, E.niveauId, p);
    if (meubleId) {
      const x = E.batiment.elements.find(q => q.id === meubleId);
      E.selection = { meubleId };
      E.historique.push(JSON.stringify(E.batiment)); E.refaire = [];
      E.glisserMeuble = { id: meubleId, depart: { x: x.x, z: x.z }, p, bouge: false, avant: JSON.stringify(x) };
      c.setPointerCapture(e.pointerId);
      remplirPanneau(); dessinerPlan();
      return;
    }
    const m = murSous(E.batiment, E.niveauId, p, tol / 2);
    // Un escalier : le choisir, et le déplacer si on tire.
    const escalierId = m ? null : escalierSous(E.batiment, E.niveauId, p);
    if (escalierId) {
      const x = E.batiment.escaliers.find(q => q.id === escalierId);
      E.selection = { escalierId };
      E.historique.push(JSON.stringify(E.batiment)); E.refaire = [];
      E.glisserEscalier = { id: escalierId, depart: { ...x.depart }, p, bouge: false };
      c.setPointerCapture(e.pointerId);
      remplirPanneau(); dessinerPlan();
      return;
    }
    const pieceId = m ? null : pieceSous(E.batiment, E.niveauId, p);
    E.selection = m ? { murId: m.mur.id } : pieceId ? { pieceId } : null;
    remplirPanneau();
    dessinerPlan();
  });
  c.addEventListener('pointermove', (e) => {
    if (!E) return;
    if (E.geste && E.geste.meuble) {
      // ORIENTER (demandé), au mouvement de la souris depuis l'appui, lentement (0,4° par pixel) :
      // horizontal, tourner ; vertical, incliner ; Maj + horizontal, basculer ; Ctrl, par 15°. Il se
      // recolle aux murs dans sa nouvelle orientation (Alt : sans aimant) ; collé au sol, il reste posé.
      const g = E.geste;
      if (!g.tourne && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 4) return;
      const x = (E.batiment.elements || []).find(q => q.id === g.meuble);
      if (!x) return;
      if (!g.tourne) { E.historique.push(JSON.stringify(E.batiment)); E.refaire = []; g.tourne = true; g.bouge = true; }
      const VITESSE = Math.PI / 180 * 0.4, pas = e.ctrlKey ? Math.PI / 12 : 0;
      const q = (v) => (pas ? Math.round(v / pas) * pas : v);
      const dx = (e.clientX - g.x0) * VITESSE, dy = (e.clientY - g.y0) * VITESSE;
      x.rotY = g.base.rotY; x.rotX = g.base.rotX; x.rotZ = g.base.rotZ;
      if (e.shiftKey) pencherMeuble(x, 'z', q(dx)); else tournerDe(x, q(dx));
      pencherMeuble(x, 'x', q(dy));
      if (!e.altKey) { const c = aimanterMeuble(E.batiment, x, { x: x.x, z: x.z }); x.x = c.x; x.z = c.z; }
      E.collisionMeuble = meubleEnCollision(E.batiment, x) ? x.id : null;
      E.selection = { meubleId: x.id };
      apresModification();
      return;
    }
    if (E.geste) {
      const dx = e.clientX - E.geste.x, dy = e.clientY - E.geste.y;
      if (Math.abs(dx) + Math.abs(dy) > 0) E.geste.bouge = E.geste.bouge || Math.hypot(dx, dy) > 0;
      E.vue = glisserVue(E.vue, dx, dy);
      E.geste.x = e.clientX; E.geste.y = e.clientY;
    }
    survoler(e);
  });
  const fin = (e) => {
    if (!E) return;
    if (E.appui) {
      const { s: point } = E.appui;
      E.appui = null;
      if (E.rectangle) { if (e && e.type === 'pointerup' && E.rectangle.vers) poserLeRectangle(); else { E.rectangle = null; dessinerPlan(); } }
      else if (e && e.type === 'pointerup') poserUnPoint(point);
    }
    if (E.glisserEscalier) {
      const { bouge } = E.glisserEscalier;
      E.glisserEscalier = null;
      if (!bouge) E.historique.pop();
      apresModification();
    }
    if (E.glisserMeuble) {
      const { bouge, id, avant } = E.glisserMeuble;
      E.glisserMeuble = null;
      // Un clic sans glisser n'a rien changé, et un geste qui finit dans un mur est défait (demandé :
      // il revient à sa position d'avant) : le point d'annulation est retiré.
      if (!bouge || E.collisionMeuble === id) {
        E.historique.pop();
        if (E.collisionMeuble === id) remettreMeuble(id, avant);
      }
      E.collisionMeuble = null;
      apresModification();
    }
    if (E.poseEscalier) {
      const pose = E.poseEscalier;
      E.poseEscalier = null;
      if (e && e.type === 'pointerup') {
        const angle = pose.angle != null ? pose.angle : E.reglagesEscalier.angle;
        E.reglagesEscalier.angle = angle;   // le prochain simple clic reprend cette direction
        // La position aimantée du fantôme, s'il est toujours là ; sinon le pied tel que posé.
        const depart = E.fantomeEscalier && E.fantomeEscalier.angle === angle ? E.fantomeEscalier.depart : pose.depart;
        const reglages = { ...E.reglagesEscalier, depart, angle };
        const essai = ajouterEscalier(JSON.parse(JSON.stringify(E.batiment)), E.niveauId, reglages);
        if (!essai.erreur) {   // refusé : sans message (demandé), le fantôme était rouge
          // Posé : il est choisi, et l'outil Sélection est pris (demandé).
          let id = null;
          modifier(b => { const r = ajouterEscalier(b, E.niveauId, reglages); id = r.escalier && r.escalier.id; });
          if (id) { choisirOutil('selection'); E.selection = { escalierId: id }; remplirPanneau(); dessinerPlan(); }
        }
      }
      dessinerPlan();
    }
    if (E.glisserOuverture) {
      const { bouge } = E.glisserOuverture;
      E.glisserOuverture = null;
      // Un clic sans glisser n'a rien changé : le point d'annulation est retiré.
      if (!bouge) E.historique.pop();
      apresModification();
    }
    if (E.glisserSommet) {
      const { depart, actuel } = E.glisserSommet;
      E.glisserSommet = null;
      // Un angle relâché à sa place n'a rien changé : le point d'annulation est retiré.
      if (Math.hypot(depart.x - actuel.x, depart.z - actuel.z) < 1e-9) E.historique.pop();
      apresModification();
    }
    if (E.geste && E.geste.tourne) {
      // Fin d'une orientation : défaite si elle finit dans un mur (demandé).
      const { meuble, avant } = E.geste;
      E.geste = null;
      if (E.collisionMeuble === meuble) { E.historique.pop(); remettreMeuble(meuble, avant); }
      E.collisionMeuble = null;
      apresModification();
      return;
    }
    if (E.geste) {
      const { bouge } = E.geste;
      E.geste = null;
      // #454e : à l'outil Sélection, un clic droit sur un meuble le tourne d'un quart de tour (demandé).
      const meubleClic = !bouge && e && e.type === 'pointerup' && E.outil === 'selection' ? meubleSous(E.batiment, E.niveauId, souris(e).p) : null;
      if (meubleClic) {
        retoucherMeuble(meubleClic, tournerMeuble);
        E.selection = { meubleId: meubleClic };
        remplirPanneau(); dessinerPlan();
      } else
      // L'outil Escalier : un clic droit sans glisser fait tourner l'escalier à poser d'un quart de tour (demandé).
      if (!bouge && e && e.type === 'pointerup' && E.outil === 'escalier') {
        E.reglagesEscalier = { ...E.reglagesEscalier, angle: E.reglagesEscalier.angle + Math.PI / 2 };
        if (E.poseEscalier && E.poseEscalier.angle != null) E.poseEscalier.angle += Math.PI / 2;
        remplirPanneau(); survoler(e);
      } else if (!bouge && e && e.type === 'pointerup' && E.outil === 'ouverture') {
        // L'outil Ouverture : le clic droit change le sens d'ouverture (demandé), en faisant le tour
        // des quatre quarts possibles : charnière au début / à la fin, d'un côté du mur puis de l'autre.
        const { sens, charniere, type, coulissant, battants } = E.reglagesOuverture;
        // Seule une porte battante a un sens ; à deux battants, il n'y a pas de charnière à choisir.
        const suivant = type !== 'porte' || coulissant ? {} : battants === 2 ? { sens: sens === -1 ? 1 : -1 } : sens === -1 ? (charniere === 'fin' ? { sens: -1, charniere: 'debut' } : { sens: 1, charniere: 'debut' })
          : (charniere === 'fin' ? { sens: -1, charniere: 'fin' } : { sens: 1, charniere: 'fin' });
        E.reglagesOuverture = { ...E.reglagesOuverture, ...suivant };
        remplirPanneau(); survoler(e);
      } else if (!bouge && e && e.type === 'pointerup') { if (!finirLaChaine() && E.outil === 'selection') { E.selection = null; remplirPanneau(); dessinerPlan(); } }
    }
  };
  c.addEventListener('pointerup', fin);
  c.addEventListener('pointercancel', fin);
  c.addEventListener('dblclick', () => { if (E) finirLaChaine(); });
  c.addEventListener('pointerleave', () => { if (E && !E.glisserSommet) { E.survol = null; E.fantomeEscalier = null; dessinerPlan(); } });
  c.addEventListener('contextmenu', (e) => e.preventDefault());
  const Observateur = globalThis.ResizeObserver;
  if (Observateur) new Observateur(() => dessinerPlan()).observe(c);
}

// ── La fenêtre de l'aperçu 3D : ancrée à un coin, en plein écran, ou réduite (demandé) ──────────

const CLE_AFFICHAGE = 'storyboarder.batimentApercu';
let affichage = (() => {
  try { return affichageApercuLu(JSON.parse(globalThis.localStorage.getItem(CLE_AFFICHAGE) || 'null')); }
  catch { return affichageApercuLu(null); }
})();

function changerAffichage(nouveau){
  affichage = affichageApercuLu({ ...affichage, ...nouveau });
  try { globalThis.localStorage.setItem(CLE_AFFICHAGE, JSON.stringify(affichage)); } catch { /* une préférence perdue */ }
  appliquerAffichage();
}

function appliquerAffichage(){
  const f = $('batimentApercuFenetre'), icone = $('batimentApercuIcone');
  f.dataset.mode = affichage.mode;
  f.dataset.coin = affichage.coin;
  icone.dataset.coin = affichage.coin;
  icone.hidden = affichage.mode !== 'reduit';
  const plein = affichage.mode === 'plein';
  $('batimentApercuPlein').innerHTML = plein ? '&#x2921;' : '&#x2922;';
  $('batimentApercuPlein').title = plein ? tr('Back to a window', 'Revenir en fenêtre') : tr('Full-screen preview', 'Aperçu en plein écran');
  if (E && E.apercu) E.apercu.redessiner();
}

function cablerFenetreApercu(){
  const f = $('batimentApercuFenetre'), barre = $('batimentApercuBarre'), scene = $('batimentScene');
  $('batimentApercuReduire').onclick = () => changerAffichage({ mode: 'reduit' });
  // #454b : la coupe au niveau courant (les niveaux du dessus disparaissent de l'aperçu).
  $('batimentApercuCoupe').onclick = () => {
    if (!E) return;
    E.coupe = !E.coupe;
    $('batimentApercuCoupe').classList.toggle('actif', E.coupe);
    if (E.apercu) E.apercu.reconstruire(E.batiment);
  };
  $('batimentApercuPlein').onclick = () => changerAffichage({ mode: affichage.mode === 'plein' ? 'fenetre' : 'plein' });
  $('batimentApercuIcone').onclick = () => changerAffichage({ mode: 'fenetre' });
  barre.addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    changerAffichage({ mode: affichage.mode === 'plein' ? 'fenetre' : 'plein' });
  });
  // Tirer la barre : la fenêtre suit la souris, puis s'ancre au coin le plus proche.
  let glisser = null;
  barre.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || affichage.mode !== 'fenetre' || e.target.closest('button')) return;
    const rf = f.getBoundingClientRect(), rs = scene.getBoundingClientRect();
    glisser = { dx: e.clientX - rf.left, dy: e.clientY - rf.top, rs };
    f.classList.add('en-glisser');
    barre.setPointerCapture(e.pointerId);
  });
  barre.addEventListener('pointermove', (e) => {
    if (!glisser) return;
    const { rs } = glisser;
    f.style.left = `${e.clientX - rs.left - glisser.dx}px`;
    f.style.top = `${e.clientY - rs.top - glisser.dy}px`;
    f.style.right = 'auto'; f.style.bottom = 'auto';
  });
  const lacher = () => {
    if (!glisser) return;
    const rf = f.getBoundingClientRect(), { rs } = glisser;
    glisser = null;
    f.classList.remove('en-glisser');
    f.style.left = f.style.top = f.style.right = f.style.bottom = '';
    changerAffichage({ coin: coinLePlusProche(rf.left + rf.width / 2 - rs.left, rf.top + rf.height / 2 - rs.top, rs.width, rs.height) });
  };
  barre.addEventListener('pointerup', lacher);
  barre.addEventListener('pointercancel', lacher);
}

// ── L'aperçu 3D ──────────────────────────────────────────────────────────────────────────────────

const CHAMP = 35;

/**
 * Les murs EXTRUDÉS depuis les mêmes polygones que la vue de dessus (jonctions comprises), posés à
 * l'élévation de leur niveau.
 */
function ouvrirApercu(conteneur, b){
  const T = globalThis.THREE;
  if (!T) return null;
  const scene = new T.Scene();
  scene.add(new T.AmbientLight(0xffffff, 0.6));
  const cle = new T.DirectionalLight(0xffffff, 1.6);
  scene.add(cle);
  const grille = new T.GridHelper(40, 40, 0x888888, 0x555555);
  // ⚠️ SOUS LE SOL DES PIÈCES, de quelques centimètres (signalé : le quadrillage transperçait le sol
  // et brouillait sa texture). À 5 mm d'écart, la profondeur ne les départageait plus de loin ; il
  // reste visible dehors, et le sol des pièces le couvre.
  grille.position.y = -0.03;
  grille.renderOrder = -1;
  scene.add(grille);
  const mats = materiauxBatiment3D(T);
  // #454e : le mobilier par le cache des modèles ; ceux du bâtiment sont décodés à l'ouverture.
  mats.modele = (f) => { const c = getLoadedModel(f); return c && c.scene ? cloneSkinned(c.scene) : null; };
  const options = () => ({ jusquA: E && E.coupe ? E.niveauId : null, rouge: E ? E.collisionMeuble : null });
  let groupe = construireBatiment3D(T, b, mats, options());
  scene.add(groupe);
  const meubles = fichiersDesMeubles(b);
  if (meubles.length) preloadModels(meubles).then(() => { if (E && E.apercu) E.apercu.reconstruire(E.batiment); });

  let centre = [0, 1.4, 0], distance = 20, distanceCadrage = 20;
  let angles = { lacet: 0.7, tangage: 0.5 };
  const camera = new T.PerspectiveCamera(CHAMP, 1, 0.05, 2000);
  const rendu = new T.WebGLRenderer({ antialias: true, alpha: true });
  rendu.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
  conteneur.appendChild(rendu.domElement);

  let demande = 0;
  const dessiner = () => {
    demande = 0;
    const l = conteneur.clientWidth || 1, h = conteneur.clientHeight || 1;
    rendu.setSize(l, h, false);
    camera.aspect = l / h; camera.updateProjectionMatrix();
    camera.position.fromArray(positionCamera3D(centre, distance, angles));
    camera.lookAt(centre[0], centre[1], centre[2]);
    cle.position.copy(camera.position).add(new T.Vector3(distance * 0.5, distance, 0));
    rendu.render(scene, camera);
  };
  const redessiner = () => { if (!demande) demande = requestAnimationFrame(dessiner); };
  const recadrerApercu = () => {
    const boite = new T.Box3().setFromObject(groupe);
    const min = boite.isEmpty() ? [-5, 0, -5] : boite.min.toArray();
    const max = boite.isEmpty() ? [5, 3, 5] : boite.max.toArray();
    const r = cadrage3D(min, max, CHAMP, (conteneur.clientWidth || 1) / (conteneur.clientHeight || 1));
    centre = r.centre; distance = distanceCadrage = r.distance;
    redessiner();
  };

  let glisser = null;
  const el = rendu.domElement;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    glisser = { x: e.clientX, y: e.clientY, deplacer: e.button === 2 };
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!glisser) return;
    const dx = e.clientX - glisser.x, dy = e.clientY - glisser.y;
    if (glisser.deplacer) centre = deplacement3D(centre, angles, dx, dy, distance, conteneur.clientHeight || 1, CHAMP);
    else angles = orbite3D(angles, dx, dy);
    glisser = { ...glisser, x: e.clientX, y: e.clientY };
    redessiner();
  });
  const relache = () => { glisser = null; };
  el.addEventListener('pointerup', relache);
  el.addEventListener('pointercancel', relache);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('wheel', (e) => { e.preventDefault(); distance = zoom3D(distance, e.deltaY, distanceCadrage); redessiner(); }, { passive: false });
  const Observateur = globalThis.ResizeObserver;
  const observateur = Observateur ? new Observateur(redessiner) : null;
  if (observateur) observateur.observe(conteneur);
  recadrerApercu();

  return {
    recadrer: recadrerApercu,
    redessiner,
    /** Les murs ont changé : on refait le groupe, sans toucher au cadrage. */
    reconstruire(nouveau){
      scene.remove(groupe);
      groupe.traverse(n => { if (n.geometry) n.geometry.dispose(); });
      groupe = construireBatiment3D(T, nouveau, mats, options());
      scene.add(groupe);
      redessiner();
    },
    fermer(){
      if (demande) cancelAnimationFrame(demande);
      if (observateur) observateur.disconnect();
      groupe.traverse(n => { if (n.geometry) n.geometry.dispose(); });
      // `revetement` est la fabrique des revêtements, pas une matière : on ne libère que les matières.
      Object.values(mats).forEach(m => { if (m && typeof m.dispose === 'function') m.dispose(); });
      grille.geometry.dispose(); grille.material.dispose();
      rendu.dispose();
      if (rendu.forceContextLoss) rendu.forceContextLoss();
      el.remove();
    },
  };
}

// ── Enregistrer, le clavier, le câblage ──────────────────────────────────────────────────────────

/** « Placer dans la scène » / « Appliquer les modifications » : le bâtiment part, l'éditeur se ferme. */
function versLaScene(){
  if (!E || !E.destination || !E.batiment.murs.length) return;
  const { destination, batiment } = E;
  fermerSansDemander();
  destination.valider(JSON.parse(JSON.stringify(batiment)));
}

/**
 * « Enregistrer dans la bibliothèque » (#454a-4b, demandé : pas d'« Enregistrer sous ») :
 *   - un bâtiment neuf devient un modèle, nommé d'après lui ;
 *   - ouvert depuis la bibliothèque et toujours du même nom : il REMPLACE le modèle, après une
 *     confirmation qui le dit (les copies déjà placées ne changent pas) ; demandée une fois par
 *     ouverture de l'éditeur ;
 *   - RENOMMÉ dans l'éditeur : il devient un NOUVEAU modèle, l'ancien reste tel quel. C'est ainsi
 *     qu'on fait une variante (cf. actionDEnregistrement).
 */
async function enregistrer(){
  if (!E) return;
  const ed = E;
  const action = actionDEnregistrement(ed.fichier, ed.batiment.nom);
  if (action === 'remplacer' && !ed.remplacementAccepte) {
    const ok = await _rappels.confirmer(tr(
      `This replaces the model "${nomAfficheDuFichier(ed.fichier)}" in the library. The buildings already placed in your Scenes are copies: they do not change. To keep the model as it is and make a new one, give this building another name first.`,
      `Ceci remplace le modèle « ${nomAfficheDuFichier(ed.fichier)} » de la bibliothèque. Les bâtiments déjà placés dans vos Scènes sont des copies : ils ne changent pas. Pour garder le modèle tel quel et en faire un nouveau, donnez d'abord un autre nom à ce bâtiment.`),
    tr('Replace the model', 'Remplacer le modèle'));
    if (!ok || E !== ed) return;
    ed.remplacementAccepte = true;
  }
  const r = await enregistrerBatiment(ed.batiment, action === 'remplacer' ? ed.fichier : null);
  if (E !== ed) return;
  // Un échec : une modale (demandé ; plus de ligne de statut dans le menu).
  if (!r.ok) { await _rappels.alerter(tr(`The building could not be saved: ${r.error}`, `Le bâtiment n'a pas pu être enregistré : ${r.error}`), tr('Save failed', 'Échec de l\'enregistrement')); return; }
  const nouveau = action === 'nouveau' && ed.fichier;
  ed.fichier = r.fichier;
  ed.refBiblio = signatureDuBatiment(ed.batiment);
  // Le fichier réécrit n'a plus son ancienne structure : son entrée est remplacée, pas ajoutée.
  if (ed.structuresBiblio) {
    for (const [cle, f] of ed.structuresBiblio) if (f === r.fichier) ed.structuresBiblio.delete(cle);
    ed.structuresBiblio.set(signatureDeStructure(ed.batiment), r.fichier);
  }
  ed.remplacementAccepte = ed.remplacementAccepte && !nouveau;
  // Aucun message (demandé) : le bouton se grise, son infobulle dit sous quel nom.
  remplirPanneau();
}

function clavier(e){
  if (!E) return;
  const tag = document.activeElement && document.activeElement.tagName;
  // Un champ COULEUR ou une case ne prend pas de frappe : il ne doit pas retenir les touches de l'éditeur
  // (signalé : après un réglage de revêtement, Suppr ne supprimait plus la pièce).
  const typeDuChamp = tag === 'INPUT' ? document.activeElement.type : '';
  const dansUnChamp = (tag === 'INPUT' && typeDuChamp !== 'color' && typeDuChamp !== 'checkbox') || tag === 'TEXTAREA' || tag === 'SELECT';
  // Une modale ouverte par-dessus (la confirmation) garde ses touches.
  if (document.querySelector('.modal-overlay:not(.hidden)')) return;
  const avale = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  if (e.key === 'Escape') {
    avale();
    // Échap défait d'abord ce qui est en cours : la pièce qu'on tire, la chaîne, la sélection,
    // l'outil ; ensuite il ferme.
    if (E.rectangle || E.appui || E.poseEscalier) { E.rectangle = null; E.appui = null; E.poseEscalier = null; dessinerPlan(); return; }
    if (finirLaChaine()) return;
    if (E.selection) { E.selection = null; remplirPanneau(); dessinerPlan(); return; }
    if (E.outil) { choisirOutil(null); return; }
    fermerEditeurDeBatiment();
    return;
  }
  // Annuler et rétablir agissent sur le BÂTIMENT, pas sur le Projet caché dessous.
  const touche = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && !dansUnChamp && (touche === 'z' || touche === 'y')) {
    avale();
    if (touche === 'y' || e.shiftKey) retablir(); else annuler();
    return;
  }
  if (dansUnChamp || e.ctrlKey || e.metaKey) return;
  // B et P ouvrent leur bibliothèque PAR-DESSUS l'éditeur : on les laisse passer (events.js).
  if (!e.altKey && (touche === 'b' || touche === 'p')) return;
  if (touche === 'h') fermerEditeurDeBatiment();   // H ouvre l'éditeur (events.js) et le referme ici
  // E : l'Éditeur de modèle, à la place de celui-ci. Par son bouton, pour passer par la même porte
  // (events.js) : confirmation si le bâtiment n'est pas enregistré, puis le clic est rejoué.
  else if (touche === 'e') $('openPoseEditorBtn').click();
  else if (touche === 'm') basculerOutil('mur');
  else if (touche === 'o') basculerOutil('ouverture');
  else if (touche === 's') basculerOutil('escalier');
  else if (touche === 'r' && escalierSelectionne()) {
    const x = escalierSelectionne(), t = essaiEscalier(x.id, { angle: x.angle + Math.PI / 2 });
    if (!t.erreur) retoucherEscalier(x.id, t.changements);
  }
  else if (e.key === 'PageUp' || e.key === 'ArrowUp') changerDeNiveau(1);
  else if (e.key === 'PageDown' || e.key === 'ArrowDown') changerDeNiveau(-1);
  else if (touche === 'n') ajouterUnEtage();
  else if (touche === 'd') dupliquerLEtage();
  else if (touche === 'v') basculerOutil('selection');
  else if (e.key === 'Enter') finirLaChaine();
  else if ((e.key === 'Delete' || e.key === 'Backspace') && escalierSelectionne()) {
    const id = E.selection.escalierId;
    modifier(b => supprimerEscalier(b, id));
  }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && ouvertureSelectionnee()) {
    const id = E.selection.ouvertureId;
    modifier(b => supprimerOuverture(b, id));
  }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && murSelectionne()) {
    const id = E.selection.murId;
    modifier(b => supprimerMur(b, id));
  }
  // #454e : un meuble choisi.
  else if ((e.key === 'Delete' || e.key === 'Backspace') && meubleSelectionne()) {
    const id = E.selection.meubleId;
    modifier(b => supprimerMeuble(b, id));
  }
  // Une pièce choisie : ses murs, sauf ceux qu'elle partage (comme « Supprimer » à son clic droit).
  else if ((e.key === 'Delete' || e.key === 'Backspace') && pieceSelectionnee()) {
    supprimerPieceDeLEditeur(E.selection.pieceId);
  }
  // Le reste, raccourcis de la Planche cachée dessous, n'a pas de sens ici : avalé, comme au Lecteur.
  avale();
}

/**
 * Les sections du menu de l'éditeur se REPLIENT par leur titre (demandé), comme celles du menu de
 * droite d'une Case ; leur état est gardé pour l'éditeur (une mémoire à lui, tous bâtiments confondus).
 */
const MEMOIRE_SECTIONS = 'editeur-batiment';
function cablerSectionsRepliables(){
  document.querySelectorAll('#batimentPanneau .side-section > h2').forEach(h2 => {
    const sec = h2.closest('.side-section');
    try { if (sec.id) sec.classList.toggle('collapsed', sectionDroitePliee(localStorage, MEMOIRE_SECTIONS, sec.id)); } catch (e) { /* sans mémoire */ }
    h2.addEventListener('click', () => {
      sec.classList.toggle('collapsed');
      if (!sec.id) return;
      try { memoriserSectionDroite(localStorage, MEMOIRE_SECTIONS, sec.id, sec.classList.contains('collapsed')); } catch (e) { /* sans mémoire */ }
    });
  });
}

export function initEditeurDeBatiment(){
  if (!$('batimentEditeur')) return;
  cablerSectionsRepliables();
  $('batimentAjouterElement').onclick = () => { if (E) ajouterUnElement(); };
  $('batimentMeubleSupprimer').onclick = () => { const x = meubleSelectionne(); if (x) modifier(b => supprimerMeuble(b, x.id)); };
  // Un grain de revêtement arrivé après le dessin (batiment-revetements.js) : refaire l'aperçu.
  window.addEventListener('grains-batiment', () => { if (E && E.apercu) E.apercu.reconstruire(E.batiment); });
  $('batimentEditeurFermerX').onclick = () => fermerEditeurDeBatiment();
  $('batimentQuitterBtn').onclick = () => fermerEditeurDeBatiment();
  $('batimentRecadrerBtn').onclick = () => recadrer();
  $('batimentEnregistrerBtn').onclick = () => enregistrer();
  $('batimentPlacerBtn').onclick = () => versLaScene();
  $('batimentNom').addEventListener('input', (e) => {
    if (!E) return;
    const nom = e.target.value.trim();
    if (!nom) return;
    E.batiment.nom = nom; 
    majBoutonsDeSortie();
  });
  document.querySelectorAll('.batiment-outil').forEach(b => { b.onclick = () => basculerOutil(b.dataset.outil); });
  // #454c : l'escalier choisi.
  $('batimentEscalierTourner').onclick = () => {
    const x = escalierSelectionne(); if (!x) return;
    const t = essaiEscalier(x.id, { angle: x.angle + Math.PI / 2 });
    if (!t.erreur) retoucherEscalier(x.id, t.changements);
  };
  $('batimentEscalierSupprimer').onclick = () => { const x = escalierSelectionne(); if (x) modifier(b => supprimerEscalier(b, x.id)); };
  // #454a-3c : l'ouverture choisie.
  $('batimentOuvertureSupprimer').onclick = () => { const o = ouvertureSelectionnee(); if (o) modifier(b => supprimerOuverture(b, o.id)); };
  cablerPlan();
  cablerFenetreApercu();
}
