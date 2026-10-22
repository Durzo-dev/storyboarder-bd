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
  versEcran, pasDeGrille, zoomerAutour, glisserVue, polygoneDuMur, boiteDesMurs, cadrerSur,
  affichageApercuLu, coinLePlusProche,
} from './batiment-plan.js';
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
  E = { batiment: b, fichier, modifie: false, vue: null, niveauId: b.niveaux[0].id, apercu: null, geste: null };
  $('batimentEditeur').classList.remove('hidden');
  $('batimentNom').value = b.nom;
  statut('');
  remplirPanneau();
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

  // Les murs du niveau courant, pleins.
  g.fillStyle = couleur('--ink', '#ededef');
  E.batiment.murs.filter(m => m.niveauId === E.niveauId).forEach(m => {
    const pts = polygoneDuMur(m).map(p => versEcran(vue, l, h, p));
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill();
  });

  // L'échelle, en bas à gauche : la longueur du pas fort.
  const px = fort * vue.echelle;
  g.strokeStyle = couleur('--ink-soft', '#9a9aa2'); g.fillStyle = g.strokeStyle; g.lineWidth = 2;
  g.beginPath(); g.moveTo(16, h - 16); g.lineTo(16 + px, h - 16); g.stroke();
  g.font = '11px Inter, sans-serif'; g.fillText(metres(fort), 16, h - 22);
}

function cablerPlan(){
  const c = $('batimentPlan');
  c.addEventListener('wheel', (e) => {
    if (!E) return;
    e.preventDefault();
    const r = c.getBoundingClientRect();
    E.vue = zoomerAutour(E.vue, r.width, r.height, { x: e.clientX - r.left, y: e.clientY - r.top }, Math.exp(-e.deltaY * 0.0015));
    dessinerPlan();
  }, { passive: false });
  // Clic droit (ou milieu) maintenu : déplacer la vue, comme partout dans l'application. Le clic
  // gauche est gardé pour le tracé (#454a-3).
  c.addEventListener('pointerdown', (e) => {
    if (!E || (e.button !== 2 && e.button !== 1)) return;
    E.geste = { x: e.clientX, y: e.clientY };
    c.setPointerCapture(e.pointerId);
  });
  c.addEventListener('pointermove', (e) => {
    if (!E || !E.geste) return;
    E.vue = glisserVue(E.vue, e.clientX - E.geste.x, e.clientY - E.geste.y);
    E.geste = { x: e.clientX, y: e.clientY };
    dessinerPlan();
  });
  const fin = () => { if (E) E.geste = null; };
  c.addEventListener('pointerup', fin);
  c.addEventListener('pointercancel', fin);
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

/** Les murs en boîtes, posés à l'élévation de leur niveau. */
function construireMurs(T, b){
  const groupe = new T.Group();
  const matiere = new T.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 0.9 });
  const niveaux = new Map(b.niveaux.map(n => [n.id, n]));
  b.murs.forEach(m => {
    const n = niveaux.get(m.niveauId);
    const hauteur = m.hauteurPropre || (n ? n.hauteur : 2.8);
    const dx = m.b.x - m.a.x, dz = m.b.z - m.a.z, L = Math.hypot(dx, dz);
    const boite = new T.Mesh(new T.BoxGeometry(L, hauteur, m.epaisseur), matiere);
    boite.position.set((m.a.x + m.b.x) / 2, (n ? n.elevation : 0) + hauteur / 2, (m.a.z + m.b.z) / 2);
    boite.rotation.y = -Math.atan2(dz, dx);
    groupe.add(boite);
  });
  return { groupe, matiere };
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
  const { groupe, matiere } = construireMurs(T, b);
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
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); fermerEditeurDeBatiment(); return; }
  if (dansUnChamp || e.ctrlKey || e.metaKey) return;
  // Les raccourcis de la Planche cachée dessous n'ont pas de sens ici : avalés, comme au Lecteur.
  e.stopImmediatePropagation();
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
  cablerPlan();
  cablerFenetreApercu();
}
