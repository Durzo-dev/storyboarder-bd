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
import { creerBatiment, nomAfficheDuFichier } from './batiment.js';
import { enregistrerBatiment } from './batiment-store.js';
import {
  versEcran, versBatiment, pasDeGrille, zoomerAutour, glisserVue, boiteDesMurs, cadrerSur,
  affichageApercuLu, coinLePlusProche,
} from './batiment-plan.js';
import { polygonesDesMurs, morceauxDuMur } from './batiment-geometrie.js';
import {
  placement, reglagesParDefaut, ajouterOuverture, deplacerOuverture, modifierOuverture, ouvertureSous,
  supprimerOuverture, intervalleDe, hauteurDuMur, monterOuverture, PAS_ALLEGE,
} from './batiment-ouvertures.js';
import {
  aimanter, ajouterMur, ajouterRectangle, croiseUnMur, deplacerSommet, supprimerMur, sommetSous, murSous,
  sommetsDuNiveau, longueurDuMur,
} from './batiment-trace.js';
import { actualiserPieces, formesDesPieces, pieceSous } from './batiment-pieces.js';
import { cadrage3D, orbite3D, zoom3D, positionCamera3D, deplacement3D } from './store-apercu-3d.js';
import { construireBatiment3D, materiauxBatiment3D } from './batiment-3d.js';

const $ = (id) => document.getElementById(id);

let _rappels = { confirmer: async () => true, avantOuverture: () => {}, apresFermeture: () => {} };
/** Les rappels d'events.js (règle n°2 : pas d'import circulaire). */
export function setBatimentEditeurCallbacks(r){ _rappels = { ..._rappels, ...r }; }

/** L'édition en cours : { batiment, fichier, modifie, vue, niveauId, apercu, geste }, ou null. */
let E = null;

export function editeurDeBatimentOuvert(){ return !!E; }

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
    batiment: b, fichier, modifie: false, vue: null, niveauId: b.niveaux[0].id, apercu: null, geste: null,
    // #454a-3 : le tracé.
    // Aucun outil à l'ouverture : le menu de base (demandé).
    outil: null, chaine: null, survol: null, selection: null,
    glisserSommet: null, historique: [], refaire: [],
    appui: null, rectangle: null,   // #454a-3b : un glisser de l'outil Mur trace une pièce rectangulaire
    // #454a-3c : les réglages de l'ouverture à poser, et l'ouverture qu'on fait glisser.
    reglagesOuverture: reglagesParDefaut('porte'), glisserOuverture: null,
    // #454a-4 : où va le bâtiment en sortant. { mode: 'placer' | 'appliquer', valider(batiment) },
    // ou null (ouvert par le bandeau : il ne va que dans la bibliothèque).
    destination,
  };
  $('batimentEditeur').classList.remove('hidden');
  $('batimentNom').value = b.nom;
  statut('');
  choisirOutil(null);
  recadrer();
  appliquerAffichage();
  E.apercu = ouvrirApercu($('batimentApercu'), b);
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
  if (E.modifie) {
    const ok = await _rappels.confirmer(
      tr('This building has unsaved changes. Close the editor without saving them?',
        'Ce bâtiment a des modifications non enregistrées. Fermer l\'éditeur sans les enregistrer ?'),
      tr('Building editor', 'Éditeur de bâtiment'));
    if (!ok || !E) return !E;
  }
  fermerSansDemander();
  return true;
}

function statut(texte){ $('batimentStatut').textContent = texte; }

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
  d.className = 'batiment-vide';
  d.textContent = texte;
  return d;
}
const metres = (v) => `${(Math.round(v * 100) / 100).toLocaleString(tr('en', 'fr'))} m`;
const surface = (v) => `${(Math.round(v * 10) / 10).toLocaleString(tr('en', 'fr'))} m²`;

function remplirPanneau(){
  const b = E.batiment;
  const dest = $('batimentPlacerBtn');
  dest.hidden = !E.destination;
  if (E.destination) dest.textContent = E.destination.mode === 'appliquer' ? tr('Apply to the scene', 'Appliquer à la scène') : tr('Place in the scene', 'Placer dans la scène');
  // Rien à placer tant qu'aucun mur n'est tracé (demandé) : le bouton reste éteint, et dit pourquoi.
  const sansMur = !b.murs.length;
  dest.disabled = sansMur;
  dest.title = sansMur ? tr('Draw at least one wall first.', 'Tracez d\'abord au moins un mur.') : '';
  $('batimentFichier').textContent = E.fichier
    ? tr(`In the library: ${nomAfficheDuFichier(E.fichier)}`, `Dans la bibliothèque : ${nomAfficheDuFichier(E.fichier)}`)
    : tr('Not yet in the library', 'Pas encore dans la bibliothèque');
  const niveaux = $('batimentNiveaux');
  niveaux.replaceChildren(...b.niveaux.slice().reverse().map(n => ligne(n.nom, metres(n.hauteur))));
  // Les pièces du niveau, avec leur surface ; un clic en choisit une (outil Sélection).
  const formes = formesDesPieces(b, E.niveauId);
  const pieces = $('batimentPieces');
  const siennes = b.pieces.filter(p => p.niveauId === E.niveauId);
  pieces.replaceChildren(...(siennes.length ? siennes.map(p => {
    const l = ligne(p.nom, formes.has(p.id) ? surface(formes.get(p.id).aire) : '');
    l.classList.add('cliquable');
    l.onclick = () => { choisirOutil('selection'); E.selection = { pieceId: p.id }; remplirPanneau(); dessinerPlan(); };
    return l;
  }) : [vide(tr('No room yet: close a contour of walls.', 'Aucune pièce : fermez un contour de murs.'))]));
  const m = murSelectionne(), piece = pieceSelectionnee(), ouv = ouvertureSelectionnee();
  $('batimentSelectionMur').hidden = !m;
  $('batimentSelectionPiece').hidden = !piece;
  $('batimentSelectionOuverture').hidden = !ouv;
  $('batimentSelectionVide').hidden = !!(m || piece || ouv);
  $('batimentSelectionTitre').textContent = m ? tr('Selected wall', 'Mur sélectionné') : piece ? tr('Selected room', 'Pièce sélectionnée')
    : ouv ? tr('Selected opening', 'Ouverture sélectionnée') : tr('Selection', 'Sélection');
  // Les deux formulaires d'ouverture : celle qu'on va poser (outil Ouverture), celle qu'on a choisie.
  if (E.outil === 'ouverture') formulaireOuverture($('batimentReglagesOuverture'), E.reglagesOuverture, (c) => {
    E.reglagesOuverture = c.type && c.type !== E.reglagesOuverture.type ? { ...reglagesParDefaut(c.type), sens: E.reglagesOuverture.sens, charniere: E.reglagesOuverture.charniere } : { ...E.reglagesOuverture, ...c };
    remplirPanneau(); dessinerPlan();
  });
  if (ouv) formulaireOuverture($('batimentFormOuverture'), ouv, (c) => retoucherOuverture(ouv.id, c));
  if (piece) {
    if (document.activeElement !== $('batimentPieceNom')) $('batimentPieceNom').value = piece.nom;
    $('batimentPieceSurface').textContent = formes.has(piece.id) ? tr(`Area: ${surface(formes.get(piece.id).aire)}`, `Surface : ${surface(formes.get(piece.id).aire)}`) : '';
  }
  if (m) {
    $('batimentMurLongueur').textContent = tr(`Length: ${metres(longueurDuMur(m))}`, `Longueur : ${metres(longueurDuMur(m))}`);
    if (document.activeElement !== $('batimentMurEpaisseur')) $('batimentMurEpaisseur').value = Math.round(m.epaisseur * 100);
  }
}

// ── Le tracé (#454a-3) : outils, historique, modifications ───────────────────────────────────────

/** La pièce sélectionnée, si elle existe encore. */
function pieceSelectionnee(){
  if (!E || !E.selection || !E.selection.pieceId) return null;
  return E.batiment.pieces.find(p => p.id === E.selection.pieceId) || null;
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
  if (r.erreur) { statut(refusOuverture(r.erreur)); remplirPanneau(); return; }
  statut('');
  modifier(b => modifierOuverture(b, id, changements));
}

/**
 * Le formulaire d'une ouverture (#454a-3c), construit dans `conteneur` : le type, les dimensions en
 * centimètres, les battants, coulissante, vitrée. `changer(partiel)` reçoit chaque modification.
 */
function formulaireOuverture(conteneur, v, changer){
  const types = [['porte', tr('Door', 'Porte')], ['fenetre', tr('Window', 'Fenêtre')], ['baie', tr('Bay window', 'Baie vitrée')], ['passage', tr('Passage', 'Passage')]];
  const choix = (valeurs, actuelle, quoi) => {
    const d = document.createElement('div'); d.className = 'batiment-choix';
    valeurs.forEach(([val, lib]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = lib;
      b.classList.toggle('actif', actuelle === val);
      b.onclick = () => changer({ [quoi]: val });
      d.appendChild(b);
    });
    return d;
  };
  const champ = (libelle, valeur, quoi) => {
    const l = document.createElement('label'); l.className = 'batiment-champ';
    const t = document.createElement('span'); t.textContent = libelle;
    const w = document.createElement('span'); w.className = 'batiment-champ-valeur';
    const i = document.createElement('input'); i.type = 'number'; i.min = '0'; i.step = '1'; i.value = Math.round(valeur * 100);
    i.addEventListener('change', () => { const n = Number(i.value); if (Number.isFinite(n) && n >= 0) changer({ [quoi]: n / 100 }); });
    w.append(i, document.createTextNode(' cm'));
    l.append(t, w);
    return l;
  };
  const caseACocher = (libelle, valeur, quoi) => {
    const l = document.createElement('label'); l.className = 'batiment-case';
    const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!valeur;
    i.onchange = () => changer({ [quoi]: i.checked });
    l.append(i, document.createTextNode(libelle));
    return l;
  };
  const elements = [choix(types, v.type, 'type'),
    champ(tr('Width', 'Largeur'), v.largeur, 'largeur'), champ(tr('Height', 'Hauteur'), v.hauteur, 'hauteur'),
    champ(tr('Sill height', 'Hauteur d\'allège'), v.y, 'y')];
  if (v.type !== 'passage') {
    elements.push(choix([[1, tr('1 leaf', '1 battant')], [2, tr('2 leaves', '2 battants')]], v.battants, 'battants'));
    elements.push(caseACocher(tr('Sliding', 'Coulissante'), v.coulissant, 'coulissant'));
    elements.push(caseACocher(tr('Glazed', 'Vitrée'), v.vitre, 'vitre'));
  }
  conteneur.replaceChildren(...elements);
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
function choisirOutil(outil){
  if (!E) return;
  E.outil = outil || null; E.chaine = null; E.survol = null;
  if (E.outil !== 'selection') E.selection = null;
  document.querySelectorAll('.batiment-outil').forEach(b => b.classList.toggle('actif', b.dataset.outil === E.outil));
  $('batimentPanneau').dataset.outil = E.outil || 'aucun';
  $('batimentPlan').classList.toggle('outil-mur', E.outil === 'mur' || E.outil === 'ouverture');
  remplirPanneau();
  dessinerPlan();
}
/** Un clic sur un outil : le prend, ou le quitte s'il était déjà pris. */
function basculerOutil(outil){ if (E) choisirOutil(E.outil === outil ? null : outil); }

/** L'épaisseur des nouveaux murs, en mètres (le champ est en centimètres). */
function epaisseurDesNouveaux(){
  const v = Number($('batimentEpaisseur').value);
  return Number.isFinite(v) ? Math.min(1, Math.max(0.05, v / 100)) : 0.2;
}

/** Un point d'annulation, puis la modification, puis tout se redessine. */
function modifier(faire){
  E.historique.push(JSON.stringify(E.batiment));
  if (E.historique.length > 200) E.historique.shift();
  E.refaire = [];
  faire(E.batiment);
  actualiserPieces(E.batiment, E.niveauId, tr);
  E.modifie = true;
  apresModification();
}

function apresModification(){
  if (E.selection && ((E.selection.murId && !murSelectionne()) || (E.selection.pieceId && !pieceSelectionnee())
    || (E.selection.ouvertureId && !ouvertureSelectionnee()))) E.selection = null;
  remplirPanneau();
  dessinerPlan();
  if (E.apercu) E.apercu.reconstruire(E.batiment);
}

function annuler(){
  if (!E || !E.historique.length) return;
  E.refaire.push(JSON.stringify(E.batiment));
  E.batiment = JSON.parse(E.historique.pop());
  E.chaine = null; E.modifie = true;
  apresModification();
}
function retablir(){
  if (!E || !E.refaire.length) return;
  E.historique.push(JSON.stringify(E.batiment));
  E.batiment = JSON.parse(E.refaire.pop());
  E.chaine = null; E.modifie = true;
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
    statut(tr('This wall would cross another one: it is refused.', 'Ce mur en traverserait un autre : il est refusé.'));
    return;
  }
  // Un point posé sur un sommet déjà présent ferme la forme : la chaîne s'arrête là.
  const ferme = s.accroche.type === 'sommet';
  let r = null;
  modifier(b => { r = ajouterMur(b, E.niveauId, depuis, s.point, epaisseurDesNouveaux(), { accrocheA: accroche, accrocheB: s.accroche }); });
  if (r && r.erreur) { annuler(); E.refaire = []; return; }
  statut('');
  E.chaine = ferme ? null : { depuis: s.point, accroche: { type: 'sommet' } };
  dessinerPlan();
}

/** Le glisser de l'outil Mur, relâché : la pièce rectangulaire (#454a-3b). */
function poserLeRectangle(){
  const { de, vers } = E.rectangle;
  E.rectangle = null;
  const essai = ajouterRectangle(JSON.parse(JSON.stringify(E.batiment)), E.niveauId, de, vers, epaisseurDesNouveaux());
  if (essai.erreur) {
    statut(essai.erreur === 'croise'
      ? tr('This room would cross a wall: it is refused.', 'Cette pièce traverserait un mur : elle est refusée.')
      : tr('This room is too small.', 'Cette pièce est trop petite.'));
    dessinerPlan();
    return;
  }
  statut('');
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
    const s = aimanter(E.batiment, E.niveauId, p, { tol, libre: e.altKey, sauf: E.glisserSommet.actuel });
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
      const vers = aimanter(E.batiment, E.niveauId, p, { tol, libre: e.altKey }).point;
      const essai = ajouterRectangle(JSON.parse(JSON.stringify(E.batiment)), E.niveauId, E.rectangle.de, vers, epaisseurDesNouveaux());
      E.rectangle = { de: E.rectangle.de, vers, erreur: essai.erreur || null };
      dessinerPlan();
      return;
    }
    const s = aimanter(E.batiment, E.niveauId, p, { tol, libre: e.altKey, depuis: E.chaine && E.chaine.depuis });
    s.croise = !!E.chaine && croiseUnMur(E.batiment, E.niveauId, E.chaine.depuis, s.point);
    E.survol = s;
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
    if (E.glisserOuverture) {
      if (deplacerOuverture(E.batiment, E.glisserOuverture.id, p)) { E.glisserOuverture.bouge = true; apresModification(); }
      return;
    }
    const sommet = sommetSous(E.batiment, E.niveauId, p, tol);
    const ouvertureId = sommet ? null : ouvertureSous(E.batiment, E.niveauId, p, tol / 2);
    const m = (sommet || ouvertureId) ? null : murSous(E.batiment, E.niveauId, p, tol / 2);
    const pieceId = (sommet || m || ouvertureId) ? null : pieceSous(E.batiment, E.niveauId, p);
    E.survol = { sommet, murId: m ? m.mur.id : null, pieceId, ouvertureId };
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
    const ouv = E.outil === 'selection' && ouvertureSelectionnee();
    if (ouv) {
      const maintenant = Date.now();
      const nouveauGeste = !E.molette || E.molette.id !== ouv.id || maintenant - E.molette.t > 800;
      if (nouveauGeste) { E.historique.push(JSON.stringify(E.batiment)); E.refaire = []; }
      const pas = (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 0.01 : PAS_ALLEGE);
      if (monterOuverture(E.batiment, ouv.id, pas)) {
        E.modifie = true;
        E.molette = { id: ouv.id, t: maintenant };
        statut(tr(`Sill height: ${metres(ouv.y)}`, `Hauteur d'allège : ${metres(ouv.y)}`));
        apresModification();
      } else if (nouveauGeste) E.historique.pop();
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
      E.geste = { x: e.clientX, y: e.clientY, bouge: false, bouton: e.button };
      c.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0 || !E.outil) return;
    const { p, tol } = souris(e);
    if (E.outil === 'mur') {
      // Le point est posé au RELÂCHER : un appui qui glisse trace une pièce rectangulaire.
      E.appui = { x: e.clientX, y: e.clientY, s: aimanter(E.batiment, E.niveauId, p, { tol, libre: e.altKey, depuis: E.chaine && E.chaine.depuis }) };
      c.setPointerCapture(e.pointerId);
      return;
    }
    if (E.outil === 'ouverture') {
      const m = murSous(E.batiment, E.niveauId, p, tol);
      if (!m) return;
      const essai = ajouterOuverture(JSON.parse(JSON.stringify(E.batiment)), m.mur.id, m.t, E.reglagesOuverture);
      if (essai.erreur) { statut(refusOuverture(essai.erreur)); return; }
      statut('');
      modifier(b => ajouterOuverture(b, m.mur.id, m.t, E.reglagesOuverture));
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
    const m = murSous(E.batiment, E.niveauId, p, tol / 2);
    const pieceId = m ? null : pieceSous(E.batiment, E.niveauId, p);
    E.selection = m ? { murId: m.mur.id } : pieceId ? { pieceId } : null;
    remplirPanneau();
    dessinerPlan();
  });
  c.addEventListener('pointermove', (e) => {
    if (!E) return;
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
    if (E.glisserOuverture) {
      const { bouge } = E.glisserOuverture;
      E.glisserOuverture = null;
      // Un clic sans glisser n'a rien changé : le point d'annulation est retiré.
      if (bouge) E.modifie = true; else E.historique.pop();
      apresModification();
    }
    if (E.glisserSommet) {
      const { depart, actuel } = E.glisserSommet;
      E.glisserSommet = null;
      // Un angle relâché à sa place n'a rien changé : le point d'annulation est retiré.
      if (Math.hypot(depart.x - actuel.x, depart.z - actuel.z) < 1e-9) E.historique.pop(); else E.modifie = true;
      apresModification();
    }
    if (E.geste) {
      const { bouge } = E.geste;
      E.geste = null;
      if (!bouge && e && e.type === 'pointerup') { if (!finirLaChaine() && E.outil === 'selection') { E.selection = null; remplirPanneau(); dessinerPlan(); } }
    }
  };
  c.addEventListener('pointerup', fin);
  c.addEventListener('pointercancel', fin);
  c.addEventListener('dblclick', () => { if (E) finirLaChaine(); });
  c.addEventListener('pointerleave', () => { if (E && !E.glisserSommet) { E.survol = null; dessinerPlan(); } });
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
  scene.add(grille);
  const mats = materiauxBatiment3D(T);
  let groupe = construireBatiment3D(T, b, mats);
  scene.add(groupe);

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
      groupe = construireBatiment3D(T, nouveau, mats);
      scene.add(groupe);
      redessiner();
    },
    fermer(){
      if (demande) cancelAnimationFrame(demande);
      if (observateur) observateur.disconnect();
      groupe.traverse(n => { if (n.geometry) n.geometry.dispose(); });
      Object.values(mats).forEach(m => m.dispose());
      grille.geometry.dispose(); grille.material.dispose();
      rendu.dispose();
      if (rendu.forceContextLoss) rendu.forceContextLoss();
      el.remove();
    },
  };
}

// ── Enregistrer, le clavier, le câblage ──────────────────────────────────────────────────────────

/** « Placer dans la scène » / « Appliquer à la scène » : le bâtiment part, l'éditeur se ferme. */
function versLaScene(){
  if (!E || !E.destination || !E.batiment.murs.length) return;
  const { destination, batiment } = E;
  E.modifie = false;
  fermerSansDemander();
  destination.valider(JSON.parse(JSON.stringify(batiment)));
}

async function enregistrer(){
  if (!E) return;
  const ed = E;
  const r = await enregistrerBatiment(ed.batiment, ed.fichier);
  if (E !== ed) return;
  if (!r.ok) { statut(tr(`Could not save: ${r.error}`, `Échec de l'enregistrement : ${r.error}`)); return; }
  ed.fichier = r.fichier;
  ed.modifie = false;
  remplirPanneau();
  statut(tr(`Saved as "${nomAfficheDuFichier(r.fichier)}".`, `Enregistré sous « ${nomAfficheDuFichier(r.fichier)} ».`));
}

function clavier(e){
  if (!E) return;
  const tag = document.activeElement && document.activeElement.tagName;
  const dansUnChamp = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  // Une modale ouverte par-dessus (la confirmation) garde ses touches.
  if (document.querySelector('.modal-overlay:not(.hidden)')) return;
  const avale = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  if (e.key === 'Escape') {
    avale();
    // Échap défait d'abord ce qui est en cours : la pièce qu'on tire, la chaîne, la sélection,
    // l'outil ; ensuite il ferme.
    if (E.rectangle || E.appui) { E.rectangle = null; E.appui = null; dessinerPlan(); return; }
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
  else if (touche === 'v') basculerOutil('selection');
  else if (e.key === 'Enter') finirLaChaine();
  else if ((e.key === 'Delete' || e.key === 'Backspace') && ouvertureSelectionnee()) {
    const id = E.selection.ouvertureId;
    modifier(b => supprimerOuverture(b, id));
  }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && murSelectionne()) {
    const id = E.selection.murId;
    modifier(b => supprimerMur(b, id));
  }
  // Le reste, raccourcis de la Planche cachée dessous, n'a pas de sens ici : avalé, comme au Lecteur.
  avale();
}

export function initEditeurDeBatiment(){
  if (!$('batimentEditeur')) return;
  $('batimentEditeurFermerX').onclick = () => fermerEditeurDeBatiment();
  $('batimentQuitterBtn').onclick = () => fermerEditeurDeBatiment();
  $('batimentFermerOutilBtn').onclick = () => choisirOutil(null);
  $('batimentRecadrerBtn').onclick = () => recadrer();
  $('batimentEnregistrerBtn').onclick = () => enregistrer();
  $('batimentPlacerBtn').onclick = () => versLaScene();
  $('batimentNom').addEventListener('input', (e) => {
    if (!E) return;
    const nom = e.target.value.trim();
    if (!nom) return;
    E.batiment.nom = nom; E.modifie = true; statut('');
  });
  document.querySelectorAll('.batiment-outil').forEach(b => { b.onclick = () => basculerOutil(b.dataset.outil); });
  // Renommer la pièce choisie : un point d'annulation au moment où le nom est validé.
  $('batimentPieceNom').addEventListener('change', (e) => {
    const piece = pieceSelectionnee(); const nom = e.target.value.trim();
    if (!piece || !nom || nom === piece.nom) { if (piece) e.target.value = piece.nom; return; }
    modifier(b => { const p = b.pieces.find(q => q.id === piece.id); if (p) p.nom = nom; });
  });
  $('batimentPieceNom').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  // #454a-3c : l'ouverture choisie.
  $('batimentOuvertureSupprimer').onclick = () => { const o = ouvertureSelectionnee(); if (o) modifier(b => supprimerOuverture(b, o.id)); };
  $('batimentOuvertureSens').onclick = () => { const o = ouvertureSelectionnee(); if (o) retoucherOuverture(o.id, { sens: o.sens === -1 ? 1 : -1 }); };
  $('batimentOuvertureCharniere').onclick = () => { const o = ouvertureSelectionnee(); if (o) retoucherOuverture(o.id, { charniere: o.charniere === 'fin' ? 'debut' : 'fin' }); };
  $('batimentMurSupprimer').onclick = () => { const m = murSelectionne(); if (m) modifier(b => supprimerMur(b, m.id)); };
  $('batimentMurEpaisseur').addEventListener('change', (e) => {
    const m = murSelectionne(); const v = Number(e.target.value);
    if (!m || !Number.isFinite(v)) return;
    modifier(() => { m.epaisseur = Math.min(1, Math.max(0.05, v / 100)); });
  });
  $('batimentEpaisseur').addEventListener('change', () => { $('batimentEpaisseur').value = Math.round(epaisseurDesNouveaux() * 100); dessinerPlan(); });
  cablerPlan();
  cablerFenetreApercu();
}
