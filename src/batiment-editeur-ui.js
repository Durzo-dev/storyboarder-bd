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
import { polygonesDesMurs } from './batiment-geometrie.js';
import {
  aimanter, ajouterMur, croiseUnMur, deplacerSommet, supprimerMur, sommetSous, murSous,
  sommetsDuNiveau, longueurDuMur,
} from './batiment-trace.js';
import { cadrage3D, orbite3D, zoom3D, positionCamera3D, deplacement3D } from './store-apercu-3d.js';

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
export function ouvrirEditeurDeBatiment({ batiment = null, fichier = null } = {}){
  if (E) fermerSansDemander();
  _rappels.avantOuverture();
  const b = batiment ? JSON.parse(JSON.stringify(batiment)) : creerBatiment('', tr);
  E = {
    batiment: b, fichier, modifie: false, vue: null, niveauId: b.niveaux[0].id, apercu: null, geste: null,
    // #454a-3 : le tracé.
    // Aucun outil à l'ouverture : le menu de base (demandé).
    outil: null, chaine: null, survol: null, selection: null,
    glisserSommet: null, historique: [], refaire: [],
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

function remplirPanneau(){
  const b = E.batiment;
  $('batimentFichier').textContent = E.fichier
    ? tr(`In the library: ${nomAfficheDuFichier(E.fichier)}`, `Dans la bibliothèque : ${nomAfficheDuFichier(E.fichier)}`)
    : tr('Not yet in the library', 'Pas encore dans la bibliothèque');
  const niveaux = $('batimentNiveaux');
  niveaux.replaceChildren(...b.niveaux.slice().reverse().map(n => ligne(n.nom, metres(n.hauteur))));
  const pieces = $('batimentPieces');
  pieces.replaceChildren(...(b.pieces.length ? b.pieces.map(p => ligne(p.nom, '')) : [vide(tr('No room yet', 'Aucune pièce pour l\'instant'))]));
  const m = murSelectionne();
  $('batimentSelectionMur').hidden = !m;
  $('batimentSelectionVide').hidden = !!m;
  if (m) {
    $('batimentMurLongueur').textContent = tr(`Length: ${metres(longueurDuMur(m))}`, `Longueur : ${metres(longueurDuMur(m))}`);
    if (document.activeElement !== $('batimentMurEpaisseur')) $('batimentMurEpaisseur').value = Math.round(m.epaisseur * 100);
  }
}

// ── Le tracé (#454a-3) : outils, historique, modifications ───────────────────────────────────────

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
  $('batimentPlan').classList.toggle('outil-mur', E.outil === 'mur');
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
  E.modifie = true;
  apresModification();
}

function apresModification(){
  if (E.selection && E.selection.murId && !murSelectionne()) E.selection = null;
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
  const survole = E.outil === 'selection' && E.survol && E.survol.murId;
  murs.forEach(m => {
    const f = formes.get(m.id); if (!f) return;
    poly(f);
    g.fillStyle = (E.selection && E.selection.murId === m.id) ? accent : encre;
    g.fill();
    if (survole === m.id) { g.strokeStyle = accent; g.lineWidth = 2; g.stroke(); }
  });

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

  // Le tracé en cours : le mur fantôme (rouge s'il en traverse un autre), sa longueur, les guides.
  if (E.outil === 'mur' && E.survol && E.survol.point) {
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
    E.glisserSommet.actuel = s.point;
    E.survol = { sommet: s.point };
    apresModification();
    return;
  }
  if (E.outil === 'mur') {
    const s = aimanter(E.batiment, E.niveauId, p, { tol, libre: e.altKey, depuis: E.chaine && E.chaine.depuis });
    s.croise = !!E.chaine && croiseUnMur(E.batiment, E.niveauId, E.chaine.depuis, s.point);
    E.survol = s;
  } else if (E.outil === 'selection') {
    const sommet = sommetSous(E.batiment, E.niveauId, p, tol);
    const m = sommet ? null : murSous(E.batiment, E.niveauId, p, tol / 2);
    E.survol = { sommet, murId: m ? m.mur.id : null };
  } else E.survol = null;
  dessinerPlan();
}

function cablerPlan(){
  const c = $('batimentPlan');
  c.addEventListener('wheel', (e) => {
    if (!E) return;
    e.preventDefault();
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
      poserUnPoint(aimanter(E.batiment, E.niveauId, p, { tol, libre: e.altKey, depuis: E.chaine && E.chaine.depuis }));
      return;
    }
    const sommet = sommetSous(E.batiment, E.niveauId, p, tol);
    if (sommet) {
      E.historique.push(JSON.stringify(E.batiment)); E.refaire = [];
      E.glisserSommet = { depart: sommet, actuel: sommet };
      c.setPointerCapture(e.pointerId);
      return;
    }
    const m = murSous(E.batiment, E.niveauId, p, tol / 2);
    E.selection = m ? { murId: m.mur.id } : null;
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
function construireMurs(T, b, matiere){
  const groupe = new T.Group();
  b.niveaux.forEach(n => {
    const murs = b.murs.filter(m => m.niveauId === n.id);
    const formes = polygonesDesMurs(murs);
    murs.forEach(m => {
      const f = formes.get(m.id); if (!f) return;
      const hauteur = m.hauteurPropre || n.hauteur;
      // La forme est tracée dans (x, −z) puis extrudée vers le haut : la rotation de −90° autour de x
      // envoie (x, y, profondeur) sur (x, profondeur, −y).
      const forme = new T.Shape(f.map(p => new T.Vector2(p.x, -p.z)));
      const geo = new T.ExtrudeGeometry(forme, { depth: hauteur, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const maillage = new T.Mesh(geo, matiere);
      maillage.position.y = n.elevation;
      groupe.add(maillage);
    });
  });
  return groupe;
}

function ouvrirApercu(conteneur, b){
  const T = globalThis.THREE;
  if (!T) return null;
  const scene = new T.Scene();
  scene.add(new T.AmbientLight(0xffffff, 0.6));
  const cle = new T.DirectionalLight(0xffffff, 1.6);
  scene.add(cle);
  const grille = new T.GridHelper(40, 40, 0x888888, 0x555555);
  scene.add(grille);
  const matiere = new T.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 0.9 });
  let groupe = construireMurs(T, b, matiere);
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
      groupe = construireMurs(T, nouveau, matiere);
      scene.add(groupe);
      redessiner();
    },
    fermer(){
      if (demande) cancelAnimationFrame(demande);
      if (observateur) observateur.disconnect();
      groupe.traverse(n => { if (n.geometry) n.geometry.dispose(); });
      matiere.dispose();
      grille.geometry.dispose(); grille.material.dispose();
      rendu.dispose();
      if (rendu.forceContextLoss) rendu.forceContextLoss();
      el.remove();
    },
  };
}

// ── Enregistrer, le clavier, le câblage ──────────────────────────────────────────────────────────

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
    // Échap défait d'abord ce qui est en cours : la chaîne, la sélection, l'outil ; ensuite il ferme.
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
  if (touche === 'm') basculerOutil('mur');
  else if (touche === 'v') basculerOutil('selection');
  else if (e.key === 'Enter') finirLaChaine();
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
  $('batimentFermerBtn').onclick = () => fermerEditeurDeBatiment();
  $('batimentRecadrerBtn').onclick = () => recadrer();
  $('batimentEnregistrerBtn').onclick = () => enregistrer();
  $('batimentNom').addEventListener('input', (e) => {
    if (!E) return;
    const nom = e.target.value.trim();
    if (!nom) return;
    E.batiment.nom = nom; E.modifie = true; statut('');
  });
  document.querySelectorAll('.batiment-outil').forEach(b => { b.onclick = () => basculerOutil(b.dataset.outil); });
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
