/**
 * @file terrain-editeur-ui.js
 * #462a, L'ÉDITEUR DE TERRAIN (demandé le 25 octobre, cadré le 2 novembre 2026 avec Valentin).
 *
 * Sur le modèle de l'éditeur de bâtiment : la VUE DE DESSUS de la Scène (un plan dessiné d'après les
 * données, terrain-plan.js), l'APERÇU 3D par-dessus (le rendu de la Scène sous une caméra libre,
 * rendreSceneVueLibre3D), le menu au bord. Il ne s'ouvre que sur une SCÈNE : par le bouton du
 * bandeau (une fenêtre demande laquelle ; inerte sans Scène), ou par « Modifier le terrain » au clic
 * droit dans une Scène. Les Éléments y sont visibles, ni modifiables ni déplaçables.
 *
 * #462b : les Zones et les Tracés se font ICI (outils Zone et Tracés ; Sélection pour les choisir, les
 * déplacer, les régler dans leur fenêtre habituelle, les supprimer), en mètres, sur le plan.
 * À venir : le relief (#462c), l'eau (#462d).
 *
 * ⚠️ RIEN N'EST APPLIQUÉ À LA SCÈNE AVANT « VALIDER » (demandé, 2 novembre 2026). L'éditeur travaille sur
 * la Scène elle-même (l'aperçu et les fenêtres de réglage en ont besoin), mais il garde son ÉTAT DE
 * DÉPART (le relief et les Zones et Tracés du canevas) : « Quitter » sans valider le remet, « Valider »
 * en fait UNE annulation de l'application (Ctrl+Z après coup ramène la Scène d'avant). Pendant
 * l'édition, l'annulation est celle de l'éditeur (son historique), et la sauvegarde automatique attend.
 */
import { S, tr, newId } from './state.js';
import { contenuDuPlan, cadrageDuPlan, versLePlan, zoomerLePlan, pasDeLaGrille, versLeMonde,
  zoneEntre, traceDePoints, deplacerLeMonde, sousLePoint } from './terrain-plan.js';
import { rendreSceneVueLibre3D, ensureElementWorldPos3D, pointDuBatimentPlace3D, panelCamBasis3D, getCamOrbitWorld,
  tracéUpdateScreenPts } from './scene3d.js';
import { nomDuTrace } from './canvas-tools.js';
import { peindreLeMasque, mondeDuMasque, casesDuMasque, PAS_DE_ZONE } from './terrain-zone-pinceau.js';
import { hauteurDuRelief, peindreLeRelief, reliefValide, reliefPlat, signatureDuRelief, MODES_DU_PINCEAU,
  PROFONDEUR_RIVIERE, NIVEAU_EAU_PAR_DEFAUT } from './terrain-relief.js';
import { TRACÉ_DEFAULTS } from './constants.js';
import { getElementDepth, vitesseRotation3D, vitesseDeplacement3D, facteurDeZoom3D, deltaMolette3D } from './utils.js';
import { niveauxTries } from './batiment-niveaux.js';
import { formesDesPieces } from './batiment-pieces.js';
import { PANEL_CAM_DEFAULT_DIST_3D, WALL_PX_PER_UNIT_3D, GROUND_TYPE_DEFS, teinteDuSol3D } from './constants.js';
import { carreDeTexture } from './textures-store-ui.js';
import { sectionDroitePliee, memoriserSectionDroite } from './section-memory.js';

const $ = (id) => document.getElementById(id);
let _rappels = { avantOuverture: () => {}, apresFermeture: () => {}, ouvrirLaScene: () => {}, instantane: () => {}, confirmer: async () => true,
  regler: () => {}, apresModification: () => {} };
/**
 * Les rappels de l'application (events.js) : fermer les autres écrans du centre, redessiner après ;
 * ouvrir la Scène (les fenêtres de réglage travaillent sur la page courante) ; l'instantané d'annulation
 * avant une modification ; la fenêtre de réglage d'une Zone ou d'un Tracé ; redessiner la Scène après.
 */
export function setTerrainEditeurCallbacks(r){ _rappels = { ..._rappels, ...r }; }

/** L'éditeur ouvert : { sceneId, vue, cam, formes, choisi, geste, demande }, ou null. */
let T = null;
/** Les réglages du pinceau du relief, gardés d'une ouverture à l'autre ; et celui des Zones peintes. */
const T_PINCEAU = { mode: 'monter', rayon: 4, force: 0.5 };
const T_PINCEAU_ZONE = { rayon: 2 };
export function editeurDeTerrainOuvert(){ return !!T; }

/** La Scène éditée, sa page et son canevas (null si elle a disparu). */
function laScene(){
  const scene = T && (S.scenes || []).find(s => s.id === T.sceneId);
  const donnees = scene && scene.pages && scene.pages[0];
  // ⚠️ LA PAGE COMME LA DONNE currentPage() (signalé : l'aperçu restait uni) : les dimensions, l'échelle
  // et le style sont ceux de la SCÈNE, pas de sa page brute, qui n'en a pas. Sans w / h, le champ de la
  // caméra et la taille du rendu valaient NaN.
  const page = donnees && { w: scene.w, h: scene.h, scale: scene.scale, format: scene.format, style3d: scene.style3d,
    objects: donnees.objects, bgColor: donnees.bgColor };
  const panel = page && (page.objects || []).find(o => o.type === 'panel');
  return panel ? { scene, page, panel } : null;
}

/** Ce que sait placer scene3d.js, pour le plan (terrain-plan.js le reçoit en paramètre). */
function outilsDuPlan(panel){
  return {
    placeDe: (o) => {
      if (Number.isFinite(o.wxFloor) && Number.isFinite(o.wzFloor)) return { x: o.wxFloor, z: o.wzFloor };
      const p = ensureElementWorldPos3D(o, panel);
      return { x: p.x, z: Number.isFinite(o.wzFloor) ? o.wzFloor : getElementDepth(o) };
    },
    // Un bâtiment : les pièces de son rez-de-chaussée (le plus bas des niveaux hors sol), au Sol.
    empreinteDuBatiment: (o) => {
      const b = o.batiment;
      if (!b || !b.niveaux) return [];
      const tries = niveauxTries(b);
      const rdc = tries.find(n => n.elevation > -1e-9) || tries[0];
      if (!rdc) return [];
      try {
        return [...formesDesPieces(b, rdc.id).values()].map(f => f.points.map(p => {
          const w = pointDuBatimentPlace3D(o, panel, { x: p.x, y: 0, z: p.z });
          return { x: w.x, z: w.z };
        }));
      } catch (e) { return []; }
    },
  };
}

// ── Ouvrir, fermer ────────────────────────────────────────────────────────────────────────────

/** Ouvre l'éditeur sur la Scène `sceneId` ; `choisi` : l'id d'un Élément à désigner. */
export function ouvrirEditeurDeTerrain(sceneId, { choisi = null } = {}){
  if (!(S.scenes || []).some(s => s.id === sceneId)) return false;
  if (T) fermerSansDemander();
  _rappels.avantOuverture();
  // La Scène devient la page courante : les fenêtres de réglage (Tracé, Zone) et l'annulation y travaillent.
  if (S.editingSceneId !== sceneId) _rappels.ouvrirLaScene(sceneId);
  T = { sceneId, vue: null, cam: null, formes: [], choisi, geste: null, demande: 0,
    // #462b : l'outil, le Tracé à poser, la ligne en cours (et le point sous la souris), le rectangle de
    // Zone en cours, la Zone ou le Tracé qu'on fait glisser ; la signature du dernier aperçu rendu.
    outil: 'selection', sorteTrace: 'route', sorteZone: 'rectangle', pinceauZone: T_PINCEAU_ZONE.rayon, coupZone: null, chaine: null, fantome: null, rectangle: null, glisser: null, sigApercu: null,
    // #462c : le pinceau du relief (réglages gardés pendant la session), le coup en cours, le survol.
    pinceau: { ...T_PINCEAU }, coup: null, survol: null,
    // L'état de départ (remis si l'on quitte sans valider), l'historique de l'éditeur.
    origine: null, historique: [], refaire: [] };
  const sc = laScene();
  if (!sc) { T = null; return false; }
  T.origine = etatDuTerrain(sc);
  S.terrainEnEdition = true;
  // L'aperçu part de la caméra de la Scène.
  const p = sc.panel;
  const centre = getCamOrbitWorld(p, panelCamBasis3D(p));
  // Une Scène est souvent en vue de dessus (son défaut) : l'aperçu, lui, part de biais (55° au plus),
  // le plan montrant déjà le dessus.
  T.cam = { rotX: Math.min(0.96, Number.isFinite(p.camRotX) ? p.camRotX : 0.6), rotY: p.camRotY || 0,
    dist: p.camDist || PANEL_CAM_DEFAULT_DIST_3D, x: centre.x, y: centre.y, z: centre.z };
  $('terrainEditeur').classList.remove('hidden');
  $('terrainSceneNom').textContent = sc.scene.name || '';
  choisirOutil('selection');
  recadrer();
  redessiner();
  window.addEventListener('keydown', clavier, true);
  window.addEventListener('resize', redessiner);
  return true;
}

// ── L'état du terrain : ce que l'éditeur modifie, et peut remettre ─────────────────────────

/** Le relief et les Zones et Tracés du canevas de la Scène, copiés. */
function etatDuTerrain(sc){
  const traces = sc.page.objects.filter(o => o.type === 'tracé' && o.panelId === sc.panel.id);
  return JSON.parse(JSON.stringify({ relief: sc.panel.relief || null, traces }));
}
/** Remet un état : le relief, et les Zones et Tracés (à la place des premiers, dans l'ordre). */
function remettreLeTerrain(sc, etat){
  const copie = JSON.parse(JSON.stringify(etat));
  if (copie.relief) sc.panel.relief = copie.relief; else delete sc.panel.relief;
  const objets = sc.page.objects;
  let ou = objets.findIndex(o => o.type === 'tracé' && o.panelId === sc.panel.id);
  for (let i = objets.length - 1; i >= 0; i--) if (objets[i].type === 'tracé' && objets[i].panelId === sc.panel.id) objets.splice(i, 1);
  if (ou < 0 || ou > objets.length) ou = objets.length;
  objets.splice(ou, 0, ...copie.traces);
  for (const o of copie.traces) tracéUpdateScreenPts(o, sc.panel, sc.page);
}
/** L'éditeur a-t-il changé quelque chose depuis son ouverture ? */
function terrainModifie(){
  const sc = T && laScene();
  return !!sc && JSON.stringify(etatDuTerrain(sc)) !== JSON.stringify(T.origine);
}
/** Avant chaque modification : l'état courant va dans l'historique de l'éditeur (Ctrl+Z). */
function retenirPourAnnuler(){
  const sc = T && laScene();
  if (!sc) return;
  T.historique.push(etatDuTerrain(sc));
  if (T.historique.length > 100) T.historique.shift();
  T.refaire = [];
}
/** Une modification faite AILLEURS pendant l'édition (une fenêtre de réglage) : l'éditeur la retient. */
export function noterModificationDuTerrain(){ if (T) retenirPourAnnuler(); }
function defaire(sens){
  const sc = T && laScene();
  const pile = sens > 0 ? T.refaire : T.historique, autre = sens > 0 ? T.historique : T.refaire;
  if (!sc || !pile.length) return;
  autre.push(etatDuTerrain(sc));
  remettreLeTerrain(sc, pile.pop());
  apresModification(null);
}

/**
 * « Valider » : les modifications restent sur la Scène, et UNE annulation de l'application les
 * précède (l'état de départ remis le temps de l'instantané). L'éditeur se ferme.
 */
export function validerLeTerrain(){
  const sc = T && laScene();
  if (!sc) return;
  const brouillon = etatDuTerrain(sc), origine = T.origine;
  fermerSansDemander();
  if (JSON.stringify(brouillon) === JSON.stringify(origine)) return;
  remettreLeTerrain(sc, origine);
  _rappels.instantane();
  remettreLeTerrain(sc, brouillon);
  _rappels.apresModification();
}

/** Ferme sans rien demander ; ce qui n'est pas validé est retiré de la Scène. */
function fermerSansDemander(){
  if (!T) return;
  const sc = laScene();
  if (sc && terrainModifie()) remettreLeTerrain(sc, T.origine);
  if (T.demande) cancelAnimationFrame(T.demande);
  T = null;
  S.terrainEnEdition = false;
  $('terrainEditeur').classList.add('hidden');
  window.removeEventListener('keydown', clavier, true);
  window.removeEventListener('resize', redessiner);
  _rappels.apresFermeture();
}

/**
 * Quitte l'éditeur ; s'il y a des modifications non validées, demande d'abord (masquable). Rend une
 * promesse : vrai si l'éditeur est fermé.
 */
export async function fermerEditeurDeTerrain(){
  if (!T) return true;
  if (terrainModifie()) {
    const ok = await _rappels.confirmer(
      tr('Leave the terrain editor without validating? Its changes will be lost.',
        "Quitter l'éditeur de terrain sans valider ? Ses modifications seront perdues."),
      tr('Terrain editor', 'Éditeur de terrain'), { ok: tr('Leave', 'Quitter'), masquable: 'fermer-editeur-terrain' });
    if (!ok) return false;
  }
  fermerSansDemander();
  return true;
}

function clavier(e){
  if (!T) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  // Une fenêtre ouverte par-dessus garde Échap.
  if (document.querySelector('.modal-overlay:not(.hidden)')) return;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  if (e.key === 'Escape') {
    stop();
    // Échap défait d'abord ce qui est en cours, puis l'outil, puis quitte (comme l'éditeur de bâtiment).
    if (T.chaine || T.rectangle) { T.chaine = null; T.rectangle = null; redessiner(); }
    else if (T.outil !== 'selection') choisirOutil('selection');
    else fermerEditeurDeTerrain();
    return;
  }
  if (e.key === 'Enter' && T.chaine) { stop(); finirLaLigne(); return; }
  // L'annulation de l'ÉDITEUR (rien n'est encore sur la Scène) : Ctrl+Z, Ctrl+Y ou Ctrl+Maj+Z.
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { stop(); defaire(-1); return; }
    if (k === 'y' || (k === 'z' && e.shiftKey)) { stop(); defaire(1); return; }
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && terrainChoisi()) { stop(); supprimerLeChoisi(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  // H (l'Éditeur de bâtiment) : quitter celui-ci d'abord, en demandant s'il y a des modifications.
  if (e.key.toLowerCase() === 'h') { stop(); fermerEditeurDeTerrain().then(ok => { if (ok) $('openBatimentEditorBtn').click(); }); return; }
  const outil = { v: 'selection', z: 'zone', t: 'trace', r: 'relief' }[e.key.toLowerCase()];
  if (outil) { stop(); choisirOutil(T.outil === outil ? 'selection' : outil); }
}

// ── Les outils (#462b) ────────────────────────────────────────────────────────────────────────

const SORTES_DE_TRACE = ['route', 'chemin', 'riviere', 'muret', 'cloture', 'haie', 'barriere'];
// Une Zone se trace en rectangle ou au pinceau (demandé) ; l'eau est une texture de Zone (« Régler »).
const SORTES_DE_ZONE = ['rectangle', 'pinceau'];
const OUTILS = [['terrainOutilSelection', 'selection'], ['terrainOutilZone', 'zone'], ['terrainOutilTrace', 'trace'], ['terrainOutilRelief', 'relief']];
function nomDeMode(m){
  return ({ monter: tr('Raise', 'Monter'), creuser: tr('Dig', 'Creuser'), aplanir: tr('Flatten', 'Aplanir'), adoucir: tr('Smooth', 'Adoucir') })[m] || m;
}

/** Un passage du pinceau du relief en `m` (mètres) : le relief du canevas de la Scène change. */
function peindre(m){
  const sc = laScene();
  if (!sc || !T.coup) return;
  sc.panel.relief = peindreLeRelief(sc.panel.relief, m, { ...T.pinceau, cible: T.coup.cible });
  T.coup.dernier = m;
}
function nomDeSorte(sorte){
  return ({ route: tr('Road', 'Route'), chemin: tr('Dirt path', 'Chemin'), muret: tr('Low wall', 'Muret'),
    cloture: tr('Fence', 'Clôture'), haie: tr('Hedge', 'Haie'), barriere: tr('Barrier', 'Barrière'), riviere: tr('River', 'Rivière'),
    rectangle: tr('Rectangle', 'Rectangle'), pinceau: tr('Brush', 'Pinceau') })[sorte] || sorte;
}

function choisirOutil(outil){
  if (!T) return;
  T.outil = outil; T.chaine = null; T.rectangle = null; T.fantome = null;
  for (const [id, o] of OUTILS) $(id).classList.toggle('actif', o === outil);
  $('terrainPlan').classList.toggle('outil-mur', outil !== 'selection');
  majContenu();
  redessiner();
}

/** L'objet de la Scène (Zone ou Tracé) choisi, ou null. */
function terrainChoisi(){
  const sc = T && laScene();
  return sc && T.choisi ? sc.page.objects.find(o => o.id === T.choisi && o.type === 'tracé') || null : null;
}

/** Après une modification : l'écran du Tracé recalculé, la Scène et l'éditeur redessinés. */
function apresModification(obj){
  const sc = laScene();
  if (sc && obj) tracéUpdateScreenPts(obj, sc.panel, sc.page);
  _rappels.apresModification();
  majContenu();
  redessiner();
}

/** Pose une Zone ou un Tracé neuf (son `world` en mètres) et le choisit. */
function poser(sorte, world){
  const sc = laScene();
  if (!sc || !world) return;
  retenirPourAnnuler();
  const def = TRACÉ_DEFAULTS[sorte] || {};
  const obj = sorte === 'terrain'
    ? { id: newId(), type: 'tracé', tracéType: 'terrain', name: nomDuTrace('terrain'), panelId: sc.panel.id, terrainType: 'herbe', label: '', world }
    : { id: newId(), type: 'tracé', tracéType: sorte, name: nomDuTrace(sorte), panelId: sc.panel.id, color: def.color, width: def.width, world };
  // #462d : une rivière avec sa profondeur.
  if (sorte === 'riviere') obj.profondeur = PROFONDEUR_RIVIERE;
  if (def.wallHeight !== undefined) obj.wallHeight = def.wallHeight;
  sc.page.objects.push(obj);
  T.choisi = obj.id;
  apresModification(obj);
}

/**
 * Un passage du pinceau de Zone en `m` : la Zone du coup (neuve au premier passage, ou la Zone peinte
 * choisie) s'agrandit, ou se gomme (Maj). Gommée entièrement, elle disparaît.
 */
function peindreLaZone(m){
  const sc = laScene();
  if (!sc || !T.coupZone) return;
  let obj = T.coupZone.id ? sc.page.objects.find(o => o.id === T.coupZone.id) : null;
  const avant = obj && obj.world && obj.world.masque;
  const masque = peindreLeMasque(avant || null, m, T.pinceauZone, T.coupZone.effacer);
  T.coupZone.dernier = m;
  if (!masque) {
    if (obj) { sc.page.objects.splice(sc.page.objects.indexOf(obj), 1); T.choisi = null; T.coupZone.id = null; }
    return;
  }
  if (!obj) {
    obj = { id: newId(), type: 'tracé', tracéType: 'terrain', name: nomDuTrace('terrain'), panelId: sc.panel.id, terrainType: 'herbe', label: '', world: null };
    sc.page.objects.push(obj);
    T.coupZone.id = obj.id; T.choisi = obj.id;
  }
  obj.world = mondeDuMasque(masque);
  tracéUpdateScreenPts(obj, sc.panel, sc.page);
  majContenu();
}

function finirLaLigne(){
  if (!T || !T.chaine) return;
  const pts = T.chaine; T.chaine = null; T.fantome = null;
  poser(T.sorteTrace, traceDePoints(T.sorteTrace, pts));
  redessiner();
}

function supprimerLeChoisi(){
  const sc = laScene(), obj = terrainChoisi();
  if (!sc || !obj) return;
  retenirPourAnnuler();
  const i = sc.page.objects.indexOf(obj);
  if (i >= 0) sc.page.objects.splice(i, 1);
  T.choisi = null;
  apresModification(null);
}

/** « Retirer tout le relief » (demandé) : la Scène redevient plate, après confirmation (masquable). */
async function retirerLeRelief(){
  const sc = laScene();
  if (!sc || reliefPlat(sc.panel.relief)) return;
  const ok = await _rappels.confirmer(
    tr('Remove all the relief of this scene? The ground becomes flat again (Ctrl+Z undoes it).',
      'Retirer tout le relief de cette scène ? Le sol redevient plat (Ctrl+Z l\'annule).'),
    tr('Remove the relief', 'Retirer le relief'), { masquable: 'retirer-relief' });
  const sc2 = ok && T && laScene();
  if (!sc2) return;
  retenirPourAnnuler();
  delete sc2.panel.relief;
  apresModification(null);
}

/** Rafraîchit l'éditeur ouvert (la Scène a pu changer : annulation, fenêtre de réglage). */
export function rafraichirEditeurDeTerrain(){
  if (!T) return;
  majContenu();
  redessiner();
}

// ── Le menu ───────────────────────────────────────────────────────────────────────────────────

/** Les commandes, selon l'outil (une action par ligne). */
export function commandesDuTerrain(trad = tr, outil = 'selection'){
  const l = [];
  if (outil === 'zone') {
    l.push(trad('Rectangle: drag to draw a zone. Brush: drag to paint one (a selected painted zone grows; Shift: erase).',
      'Rectangle : glisser pour tracer une Zone. Pinceau : glisser pour en peindre une (une Zone peinte choisie s\'agrandit ; Maj : gommer).'));
    l.push(trad('Right-click: rectangle ↔ brush. Brush: wheel = size, Ctrl + wheel = zoom. Water: the Water texture under "Selection".',
      'Clic droit : rectangle ↔ pinceau. Pinceau : molette = taille, Ctrl + molette = zoom. L\'eau : la texture Eau dans « Sélection ».'));
  } else if (outil === 'relief') {
    l.push(trad('Drag: paint the relief (raise, dig, flatten to the height under the first click, smooth).', "Glisser : peindre le relief (monter, creuser, aplanir à la hauteur du premier clic, adoucir)."));
    l.push(trad('Wheel: size · right-click: next mode · Ctrl + wheel: zoom.', 'Molette : taille · clic droit : mode suivant · Ctrl + molette : zoom.'));
  } else if (outil === 'trace') {
    l.push(trad('Click: one point per bend; double-click, Enter or right-click: finish.', 'Clic : un point par virage ; double-clic, Entrée ou clic droit : terminer.'));
    l.push(trad('The kind is chosen in "Path to draw".', 'Le genre se choisit dans « Tracé à poser ».'));
  } else {
    l.push(trad('Click a zone or path: select it; drag: move it; Del: delete it.', 'Clic sur une Zone ou un Tracé : le choisir ; glisser : le déplacer ; Suppr : le supprimer.'));
    l.push(trad('Double-click: its settings. Elements are only pointed out here.', 'Double-clic : ses réglages. Les Éléments ne sont que désignés ici.'));
  }
  l.push(trad('V selection · Z zone · T paths · R relief.', 'V sélection · Z zone · T tracés · R relief.'));
  l.push(trad('Wheel: zoom · right drag: move the view.', 'Molette : zoomer · glisser droit : déplacer la vue.'));
  l.push(trad('Ctrl+Z / Ctrl+Y: undo, redo. Nothing reaches the Scene before "Validate".', 'Ctrl+Z / Ctrl+Y : annuler, rétablir. Rien ne va sur la Scène avant « Valider ».'));
  l.push(trad('Esc: cancel, then leave the tool, then back to the Scene.', "Échap : annuler, puis quitter l'outil, puis revenir à la Scène."));
  return l;
}

/**
 * Demandé : les réglages d'une ZONE DE TERRAIN dans la section « Sélection » (ceux de sa fenêtre) : son
 * nom, sa texture (le carré qui ouvre les textures du Sol), sa couleur (sauf l'Eau), son étiquette.
 * Construits une fois par Zone et par texture (même raison que boutonsDeChoix), relus ensuite.
 */
function reglagesDeZone(obj){
  const boite = $('terrainChoisiZone');
  const zone = obj && obj.tracéType === 'terrain' ? obj : null;
  const type = zone ? (zone.terrainType || 'herbe') : '';
  const cle = zone ? zone.id + ':' + type : '';
  const modifier = (faire) => { retenirPourAnnuler(); faire(); apresModification(zone); };
  if (boite.dataset.cle !== cle) {
    boite.dataset.cle = cle;
    if (!zone) { boite.replaceChildren(); return; }
    const def = GROUND_TYPE_DEFS.find(d => d.id === type) || GROUND_TYPE_DEFS[0];
    const libelle = (texte) => { const l = document.createElement('label'); l.className = 'terrain-curseur-libelle'; l.textContent = texte; return l; };
    const champ = (cleChamp, texte, indice) => {
      const c = document.createElement('input');
      c.type = 'text'; c.className = 'modal-input'; c.placeholder = indice; c.dataset.cle = cleChamp;
      c.onchange = () => modifier(() => { zone[cleChamp] = c.value; });
      return [libelle(texte), c];
    };
    const carre = carreDeTexture({
      valeur: type, usage: 'sol', titre: tr('Choose the terrain texture', 'Choisir la texture du terrain'),
      teinte: teinteDuSol3D(def, zone.terrainColor),
      appliquer: (id) => modifier(() => { zone.terrainType = id; delete zone.terrainColor; }),
    });
    const elements = [...champ('name', tr('Name', 'Nom'), tr('E.g. Meadow', 'Ex. Prairie')), libelle(tr('Texture', 'Texture')), carre];
    if (!def.eau) {
      const couleur = document.createElement('input');
      couleur.type = 'color'; couleur.className = 'terrain-couleur'; couleur.dataset.cle = 'terrainColor';
      let retenu = false;
      couleur.oninput = () => {
        if (!retenu) { retenirPourAnnuler(); retenu = true; }
        zone.terrainColor = couleur.value; apresModification(zone);
      };
      couleur.onchange = () => { retenu = false; };
      couleur._lire = () => teinteDuSol3D(def, zone.terrainColor) || def.swatch;
      elements.push(libelle(tr('Colour', 'Couleur')), couleur);
    }
    // (L'« étiquette affichée » de la fenêtre n'est pas reprise : elle ne s'affiche que sur les anciennes
    // Cases sans 3D, jamais dans une Scène. Le champ reste dans le fichier.)
    boite.replaceChildren(...elements);
  }
  if (!zone) return;
  for (const c of boite.children || []) {
    if (!c.dataset || !c.dataset.cle || document.activeElement === c) continue;
    if (c.dataset.cle === 'terrainColor') c.value = c._lire();
    else c.value = zone[c.dataset.cle] || '';
  }
}

/**
 * #462d : les réglages propres à la Zone ou au Tracé choisi : une rivière (largeur, profondeur), une
 * Zone d'eau (son niveau). Des curseurs construits UNE FOIS par objet (même raison que boutonsDeChoix) ;
 * le premier mouvement d'un curseur retient l'état pour Ctrl+Z.
 */
function reglagesDuChoisi(obj){
  const boite = $('terrainChoisiReglages');
  const defs = !obj ? [] : obj.tracéType === 'riviere'
    ? [{ cle: 'largeur', nom: tr('Width (m)', 'Largeur (m)'), min: 1, max: 30, pas: 0.5,
         lire: () => (obj.world && obj.world.width) || 4, ecrire: (v) => { obj.world = { ...obj.world, width: v }; } },
       { cle: 'profondeur', nom: tr('Depth (m)', 'Profondeur (m)'), min: 0.3, max: 5, pas: 0.1,
         lire: () => obj.profondeur || PROFONDEUR_RIVIERE, ecrire: (v) => { obj.profondeur = v; } }]
    : obj.tracéType === 'terrain'
      ? [
        // Demandé : la Zone relève ou creuse le terrain sous elle.
        { cle: 'hauteur', nom: tr('Ground height (m)', 'Hauteur du sol (m)'), min: -10, max: 10, pas: 0.1,
          lire: () => (Number.isFinite(obj.hauteurZone) ? obj.hauteurZone : 0), ecrire: (v) => { if (v) obj.hauteurZone = v; else delete obj.hauteurZone; } },
        ...(obj.terrainType === 'eau' ? [{ cle: 'niveau', nom: tr('Water level (m)', "Niveau de l'eau (m)"), min: -10, max: 10, pas: 0.05,
          lire: () => (Number.isFinite(obj.niveauEau) ? obj.niveauEau : NIVEAU_EAU_PAR_DEFAUT), ecrire: (v) => { obj.niveauEau = v; } }] : []),
      ]
      : [];
  const cle = obj ? obj.id + ':' + defs.map(d => d.cle).join(',') : '';
  if (boite.dataset.cle !== cle) {
    boite.replaceChildren(...defs.flatMap(d => {
      const l = document.createElement('label');
      l.className = 'terrain-curseur-libelle';
      const valeur = document.createElement('span');
      l.textContent = d.nom + ' ';
      l.appendChild(valeur);
      const c = document.createElement('input');
      c.type = 'range'; c.min = String(d.min); c.max = String(d.max); c.step = String(d.pas);
      c.dataset.cle = d.cle;
      let retenu = false;
      c.oninput = () => {
        if (!retenu) { retenirPourAnnuler(); retenu = true; }
        d.ecrire(Number(c.value));
        valeur.textContent = String(Number(c.value)).replace('.', ',');
        apresModification(obj);
      };
      c.onchange = () => { retenu = false; };
      c._lire = d.lire; c._valeur = valeur;
      return [l, c];
    }));
    boite.dataset.cle = cle;
  }
  for (const c of boite.children || []) {
    if (!c._lire || document.activeElement === c) continue;
    c.value = String(c._lire());
    c._valeur.textContent = String(c._lire()).replace('.', ',');
  }
}

/**
 * Une rangée de boutons de choix (genre de Tracé, mode du pinceau). ⚠️ CONSTRUITE UNE FOIS, PUIS
 * SEULEMENT RECOLORÉE (signalé : cliquer « Creuser » ne faisait rien). majContenu repasse à chaque
 * dessin de la page ; refaire les boutons remplaçait celui qu'on pressait entre l'appui et le
 * relâcher, et le clic n'arrivait jamais (le défaut du #459a).
 */
function boutonsDeChoix(conteneur, valeurs, nom, actuel, choisir){
  const cle = valeurs.map(nom).join('|');
  if (conteneur.dataset.cle !== cle) {
    conteneur.replaceChildren(...valeurs.map(v => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'nav-btn';
      b.dataset.valeur = v;
      b.textContent = nom(v);
      b.onclick = () => choisir(v);
      return b;
    }));
    conteneur.dataset.cle = cle;
  }
  for (const b of conteneur.children || []) b.classList.toggle('actif', b.dataset.valeur === actuel);
}

function majContenu(){
  const sc = laScene();
  if (!sc) return;
  T.formes = contenuDuPlan(sc.page, sc.panel, outilsDuPlan(sc.panel));
  if (T.choisi && !T.formes.some(f => f.id === T.choisi)) T.choisi = null;   // annulé, supprimé
  $('terrainAide').textContent = commandesDuTerrain(tr, T.outil).join('\n');
  // Le Tracé à poser (outil Tracés).
  $('terrainSecTrace').hidden = T.outil !== 'trace';
  if (T.outil === 'trace') {
    boutonsDeChoix($('terrainSortesTrace'), SORTES_DE_TRACE, nomDeSorte, T.sorteTrace, (sorte) => { T.sorteTrace = sorte; majContenu(); });
  }
  // Le pinceau du relief (outil Relief).
  $('terrainSecRelief').hidden = T.outil !== 'relief';
  if (T.outil === 'relief') {
    boutonsDeChoix($('terrainModesRelief'), MODES_DU_PINCEAU, nomDeMode, T.pinceau.mode, (mode) => { T.pinceau.mode = T_PINCEAU.mode = mode; majContenu(); });
    { const sc = laScene(); $('terrainReliefRetirerBtn').disabled = !sc || reliefPlat(sc.panel.relief); }
    if (document.activeElement !== $('terrainReliefTaille')) $('terrainReliefTaille').value = String(T.pinceau.rayon);
    if (document.activeElement !== $('terrainReliefForce')) $('terrainReliefForce').value = String(T.pinceau.force);
  }
  $('terrainValiderBtn').disabled = !terrainModifie();
  // La Zone ou le Tracé choisi.
  const obj = terrainChoisi();
  $('terrainSecChoisi').hidden = !obj;
  if (obj) $('terrainChoisiNom').textContent = obj.name || nomDeSorte(obj.tracéType);
  reglagesDeZone(obj);
  reglagesDuChoisi(obj);
  // « Régler » ne sert plus qu'aux Tracés : une Zone se règle dans la section même.
  $('terrainReglerBtn').hidden = !obj || obj.tracéType === 'terrain';
  // La Zone à poser (outil Zone).
  $('terrainSecZone').hidden = T.outil !== 'zone';
  if (T.outil === 'zone') {
    boutonsDeChoix($('terrainSortesZone'), SORTES_DE_ZONE, nomDeSorte, T.sorteZone, (z) => { T.sorteZone = z; majContenu(); redessiner(); });
    $('terrainZoneTailleLabel').hidden = $('terrainZoneTaille').hidden = T.sorteZone !== 'pinceau';
    if (document.activeElement !== $('terrainZoneTaille')) $('terrainZoneTaille').value = String(T.pinceauZone);
  }
  // La liste des Éléments : refaite seulement si elle a changé (même raison que boutonsDeChoix).
  const liste = $('terrainContenu');
  const nommes = T.formes.filter(f => f.type === 'element' || f.type === 'batiment');
  const nomDe = (f) => f.nom || (f.type === 'batiment' ? tr('Building', 'Bâtiment') : tr('Element', 'Élément'));
  const cle = JSON.stringify(nommes.map(f => [f.id, nomDe(f)]));
  if (liste.dataset.cle !== cle) {
    const lignes = nommes.map(f => {
      const l = document.createElement('div');
      l.className = 'batiment-ligne terrain-ligne';
      l.dataset.valeur = f.id;
      l.textContent = nomDe(f);
      l.onclick = () => { T.choisi = T.choisi === f.id ? null : f.id; majContenu(); redessiner(); };
      return l;
    });
    if (!lignes.length) {
      const v = document.createElement('p');
      v.className = 'empty-hint';
      v.textContent = tr('No Element in this Scene.', 'Aucun Élément dans cette Scène.');
      lignes.push(v);
    }
    liste.replaceChildren(...lignes);
    liste.dataset.cle = cle;
  }
  for (const l of liste.children || []) if (l.dataset && l.dataset.valeur) l.classList.toggle('actif', l.dataset.valeur === T.choisi);
}

// ── La vue de dessus ──────────────────────────────────────────────────────────────────────────

function taillePlan(){
  const c = $('terrainPlan');
  return { c, l: c.clientWidth || 800, h: c.clientHeight || 600 };
}

function recadrer(){
  if (!T) return;
  const { l, h } = taillePlan();
  T.vue = cadrageDuPlan(T.formes, l, h);
  redessiner();
}

function couleur(nom, repli){
  const v = getComputedStyle(document.body).getPropertyValue(nom).trim();
  return v || repli;
}

function dessinerPlan(){
  if (!T || !T.vue) return;
  const { c, l, h } = taillePlan();
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  if (c.width !== Math.round(l * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(l * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = couleur('--paper', '#1b1c1f');
  g.fillRect(0, 0, l, h);
  const vue = T.vue;
  const e = (p) => versLePlan(vue, p, l, h);
  // La grille (le pas suit le zoom), puis les axes de l'origine.
  const pas = pasDeLaGrille(vue.ppm);
  const coin0 = versLeMonde(vue, { x: 0, y: 0 }, l, h), coin1 = versLeMonde(vue, { x: l, y: h }, l, h);
  g.strokeStyle = couleur('--line', '#34353a'); g.lineWidth = 1; g.beginPath();
  for (let x = Math.ceil(coin0.x / pas) * pas; x <= coin1.x; x += pas) { const s = Math.round(e({ x, z: 0 }).x) + 0.5; g.moveTo(s, 0); g.lineTo(s, h); }
  for (let z = Math.ceil(coin0.z / pas) * pas; z <= coin1.z; z += pas) { const s = Math.round(e({ x: 0, z }).y) + 0.5; g.moveTo(0, s); g.lineTo(l, s); }
  g.stroke();
  const o = e({ x: 0, z: 0 });
  g.strokeStyle = couleur('--sepia', '#83838c'); g.beginPath();
  g.moveTo(Math.round(o.x) + 0.5, 0); g.lineTo(Math.round(o.x) + 0.5, h);
  g.moveTo(0, Math.round(o.y) + 0.5); g.lineTo(l, Math.round(o.y) + 0.5);
  g.stroke();
  // #462c : le relief, case par case (brun au-dessus du Sol, bleu en dessous ; plus soutenu plus c'est
  // haut ou profond), avant le reste.
  const sc = laScene();
  const r = sc && sc.panel.relief;
  if (reliefValide(r)) {
    const cote = r.pas * vue.ppm;
    for (let j = 0; j < r.nz; j++) for (let i = 0; i < r.nx; i++) {
      const hv = r.h[j * r.nx + i];
      if (!hv || Math.abs(hv) < 0.02) continue;
      const p = e({ x: r.x0 + i * r.pas, z: r.z0 + j * r.pas });
      if (p.x < -cote || p.y < -cote || p.x > l + cote || p.y > h + cote) continue;
      const a = Math.min(0.75, 0.12 + Math.abs(hv) * 0.12);
      g.fillStyle = hv > 0 ? `rgba(176, 120, 64, ${a})` : `rgba(64, 120, 200, ${a})`;
      g.fillRect(p.x - cote / 2, p.y - cote / 2, cote + 0.5, cote + 0.5);
    }
  }
  const encre = couleur('--ink', '#e8e8ea'), accent = couleur('--accent', '#e07a3c');
  const chemin = (pts, ferme) => { g.beginPath(); pts.forEach((p, i) => { const s = e(p); if (i) g.lineTo(s.x, s.y); else g.moveTo(s.x, s.y); }); if (ferme) g.closePath(); };
  for (const f of T.formes) {
    const choisi = f.id === T.choisi;
    if (f.type === 'zone' && f.masque) {
      // Une Zone peinte : ses cases (et, choisie, son contour à l'accent).
      g.fillStyle = choisi ? accent : (f.couleur || encre); g.globalAlpha = choisi ? 0.55 : 0.45;
      const cote = f.masque.pas * vue.ppm + 0.5;
      for (const k of casesDuMasque(f.masque)) { const p = e({ x: k.x0, z: k.z0 }); g.fillRect(p.x, p.y, cote, cote); }
      g.globalAlpha = 1;
    } else if (f.type === 'zone') {
      chemin(f.pts, true);
      g.globalAlpha = 0.45; g.fillStyle = f.couleur || encre; g.fill();
      g.globalAlpha = 1; g.strokeStyle = choisi ? accent : (f.couleur || encre); g.lineWidth = choisi ? 3 : 1; g.stroke();
    } else if (f.type === 'trace') {
      chemin(f.pts, false);
      g.lineCap = 'round'; g.lineJoin = 'round';
      if (choisi) { g.strokeStyle = accent; g.lineWidth = Math.max(2, f.largeur * vue.ppm) + 6; g.stroke(); }
      g.strokeStyle = f.couleur || encre; g.lineWidth = Math.max(2, f.largeur * vue.ppm);
      g.stroke();
    } else if (f.type === 'batiment') {
      for (const q of f.polys) {
        chemin(q, true);
        g.globalAlpha = 0.25; g.fillStyle = choisi ? accent : encre; g.fill();
        g.globalAlpha = 1; g.strokeStyle = choisi ? accent : encre; g.lineWidth = choisi ? 2 : 1; g.stroke();
      }
    } else if (f.type === 'element') {
      const s = e(f);
      g.beginPath(); g.arc(s.x, s.y, choisi ? 6 : 4, 0, Math.PI * 2);
      g.fillStyle = choisi ? accent : encre; g.fill();
      if (f.nom && (choisi || vue.ppm >= 12)) {
        g.font = '11px Inter, sans-serif'; g.fillStyle = choisi ? accent : encre; g.globalAlpha = choisi ? 1 : 0.7;
        g.fillText(f.nom, s.x + 8, s.y + 4); g.globalAlpha = 1;
      }
    }
  }
  dessinerEnCours(g, e);
}

/** Ce qui est en cours de tracé : la ligne (jusqu'à la souris), le rectangle de Zone. */
function dessinerEnCours(g, e){
  const accent = couleur('--accent', '#e07a3c');
  g.save();
  g.strokeStyle = accent; g.fillStyle = accent; g.lineWidth = 2; g.setLineDash([6, 4]);
  if (T.chaine && T.chaine.length) {
    const pts = T.fantome ? [...T.chaine, T.fantome] : T.chaine;
    g.beginPath(); pts.forEach((p, i) => { const s = e(p); if (i) g.lineTo(s.x, s.y); else g.moveTo(s.x, s.y); }); g.stroke();
    g.setLineDash([]);
    T.chaine.forEach(p => { const s = e(p); g.fillRect(s.x - 3, s.y - 3, 6, 6); });
  }
  // Le pinceau du relief sous la souris : son cercle, et la hauteur du relief à cet endroit.
  const pinceauDeZone = T.outil === 'zone' && T.sorteZone === 'pinceau';
  if ((T.outil === 'relief' || pinceauDeZone) && T.survol) {
    const c = e(T.survol), sc = laScene();
    g.setLineDash([4, 4]); g.lineWidth = 1.5;
    g.beginPath(); g.arc(c.x, c.y, (pinceauDeZone ? T.pinceauZone : T.pinceau.rayon) * T.vue.ppm, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.font = '11px Inter, sans-serif';
    if (pinceauDeZone) g.fillText(`${String(T.pinceauZone).replace('.', ',')} m`, c.x + 10, c.y - 10);
    else {
      const hv = sc ? hauteurDuRelief(sc.panel.relief, T.survol.x, T.survol.z) : 0;
      g.fillText(`${nomDeMode(T.pinceau.mode)} · ${hv >= 0 ? '+' : ''}${hv.toFixed(2).replace('.', ',')} m`, c.x + 10, c.y - 10);
    }
  }
  if (T.rectangle) {
    const a = e(T.rectangle.a), b = e(T.rectangle.b);
    g.globalAlpha = 0.18; g.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    g.globalAlpha = 1; g.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  }
  g.restore();
}

/** Ce qui est sous le pixel `s` du plan (8 px de tolérance), ou null. */
function sousLePlan(s){
  const { l, h } = taillePlan();
  return sousLePoint(T.formes, versLeMonde(T.vue, s, l, h), 8 / T.vue.ppm);
}

// ── L'aperçu 3D ───────────────────────────────────────────────────────────────────────────────

function dessinerApercu(){
  const sc = laScene();
  const c = $('terrainApercuCanvas');
  if (!sc || !c || $('terrainApercuFenetre').dataset.mode === 'reduit') return;
  const l = c.clientWidth || 320, h = c.clientHeight || 240;
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  if (c.width !== Math.round(l * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(l * dpr); c.height = Math.round(h * dpr); }
  // L'image a les proportions de la page : on la rend assez grande pour COUVRIR l'aperçu, puis on en
  // garde le milieu (la caméra vise le centre de l'image).
  const scale = Math.max(c.width / sc.page.w, c.height / sc.page.h);
  // Rendu seulement si la caméra, la taille ou la Scène ont changé : un rendu de Scène coûte cher, et
  // l'éditeur se redessine souvent (survol, tracé en cours).
  // Pendant un coup de pinceau aussi (demandé : l'aperçu suit le geste) ; les images se regroupent
  // d'elles-mêmes (une par image d'écran au plus, cf. redessiner), et la grille 3D se met à jour sur place.
  const sig = JSON.stringify([T.cam, c.width, c.height, signatureDuRelief(sc.panel.relief), sc.page.objects.map(o => [o.id, o.world, o.color, o.terrainType, o.terrainColor,
    o.wallHeight, o.wallThickness, o.marquage, o.traceTexture, o.wxFloor, o.wzFloor, o.rotY, o.hidden3d,
    // Signalé : le niveau de l'eau ne se voyait qu'en bougeant l'aperçu (absent de cette signature).
    o.niveauEau, o.profondeur, o.hauteurZone])]);
  if (sig === T.sigApercu) return;
  T.sigApercu = sig;
  const img = rendreSceneVueLibre3D(sc.panel, sc.page, T.cam, scale);
  const g = c.getContext('2d');
  if (!img || !g) return;
  const r = Math.min(img.width / c.width, img.height / c.height);
  const lw = c.width * r, lh = c.height * r;
  // La taille d'un pixel de l'aperçu à une distance de 1 : le champ vertical de la Scène (calé sur sa
  // page, cf. framePanelCamera3D) réduit à la part de l'image gardée, rapporté aux pixels affichés.
  const tanDemiChamp = (sc.page.h / WALL_PX_PER_UNIT_3D / 2) / PANEL_CAM_DEFAULT_DIST_3D;
  T.mParPixel = 2 * tanDemiChamp * (lh / img.height) / h;
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(img, (img.width - lw) / 2, (img.height - lh) / 2, lw, lh, 0, 0, c.width, c.height);
}

/**
 * Le geste de la caméra de l'aperçu, PUR : tourner (gauche), déplacer (droit), en pixels. LES MÊMES
 * VITESSES QUE L'ÉDITEUR DE BÂTIMENT (signalé : bien trop rapide) : vitesseRotation3D par pixel pour
 * tourner ; pour déplacer, le point visé suit la souris, `mParPixel` étant la taille d'un pixel de
 * l'aperçu à une distance de 1 (fournie par le dernier rendu : champ de la Scène, recadrage).
 */
export function bougerCameraApercu(cam, geste, dx, dy, mParPixel = 0.002){
  if (geste === 'tourner') {
    const v = vitesseRotation3D();
    return { ...cam, rotY: cam.rotY - dx * v, rotX: Math.min(Math.PI / 2 - 0.01, Math.max(0.03, cam.rotX + dy * v)) };
  }
  // Déplacer : le centre glisse sur le Sol, selon l'orientation de la caméra (le vertical de l'écran
  // couvre plus de Sol quand la caméra est basse).
  const k = vitesseDeplacement3D() * cam.dist * mParPixel, c = Math.cos(cam.rotY), s = Math.sin(cam.rotY);
  const kz = k / Math.max(0.3, Math.sin(cam.rotX));
  return { ...cam, x: cam.x - dx * c * k - dy * s * kz, z: cam.z + dx * s * k - dy * c * kz };
}
/** La molette de l'aperçu : le zoom commun (facteurDeZoom3D), borné. */
export function zoomerCameraApercu(cam, delta){
  return { ...cam, dist: Math.min(800, Math.max(2, cam.dist * facteurDeZoom3D(delta))) };
}

// ── Dessin ────────────────────────────────────────────────────────────────────────────────────

function redessiner(){
  if (!T || T.demande) return;
  const raf = globalThis.requestAnimationFrame || ((f) => setTimeout(f, 16));
  T.demande = raf(() => { if (!T) return; T.demande = 0; dessinerPlan(); dessinerApercu(); });
}

// ── Choisir la Scène (le bouton du bandeau) ───────────────────────────────────────────────────

/** Le bouton du bandeau : inerte sans Scène (demandé). */
export function majBoutonEditeurDeTerrain(){
  const b = $('openTerrainEditorBtn');
  if (!b) return;
  const aucune = !(S.scenes || []).length;
  b.disabled = aucune;
  b.title = aucune ? tr('Terrain editor (create a Scene first)', "Éditeur de terrain (créez d'abord une Scène)")
    : tr('Terrain editor', 'Éditeur de terrain');
}

/** Ferme la fenêtre du choix de la Scène. */
export function fermerChoixDeScene(){ $('terrainSceneModal').classList.add('hidden'); }

/** La fenêtre qui demande la Scène ; une seule ligne par Scène, un clic l'ouvre. */
export function ouvrirChoixDeScene(){
  const scenes = S.scenes || [];
  if (!scenes.length) return;
  $('terrainSceneListe').replaceChildren(...scenes.map(s => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'nav-btn terrain-scene-choix';
    b.textContent = s.name || tr('Scene', 'Scène');
    b.onclick = () => { fermerChoixDeScene(); ouvrirEditeurDeTerrain(s.id); };
    return b;
  }));
  $('terrainSceneModal').classList.remove('hidden');
}

// ── Câblage ───────────────────────────────────────────────────────────────────────────────────

const MEMOIRE_SECTIONS = 'editeur-terrain';
export function initEditeurDeTerrain(){
  if (!$('terrainEditeur')) return;
  document.querySelectorAll('#terrainPanneau .side-section > h2').forEach(h2 => {
    const sec = h2.closest('.side-section');
    try { if (sec.id) sec.classList.toggle('collapsed', sectionDroitePliee(localStorage, MEMOIRE_SECTIONS, sec.id)); } catch (e) { /* sans mémoire */ }
    h2.addEventListener('click', () => {
      sec.classList.toggle('collapsed');
      try { memoriserSectionDroite(localStorage, MEMOIRE_SECTIONS, sec.id, sec.classList.contains('collapsed')); } catch (e) { /* sans mémoire */ }
    });
  });
  $('terrainQuitterBtn').onclick = () => fermerEditeurDeTerrain();
  $('terrainValiderBtn').onclick = () => validerLeTerrain();
  $('terrainEditeurFermerX').onclick = () => fermerEditeurDeTerrain();
  $('terrainRecadrerBtn').onclick = () => recadrer();
  for (const [id, outil] of OUTILS) {
    $(id).onclick = () => { if (T) choisirOutil(T.outil === outil && outil !== 'selection' ? 'selection' : outil); };
  }
  $('terrainReliefTaille').oninput = () => { if (T) { T.pinceau.rayon = T_PINCEAU.rayon = Number($('terrainReliefTaille').value) || 4; redessiner(); } };
  $('terrainZoneTaille').oninput = () => { if (T) { T.pinceauZone = T_PINCEAU_ZONE.rayon = Number($('terrainZoneTaille').value) || 2; redessiner(); } };
  $('terrainReliefForce').oninput = () => { if (T) T.pinceau.force = T_PINCEAU.force = Number($('terrainReliefForce').value) || 0.5; };
  $('terrainReliefRetirerBtn').onclick = () => retirerLeRelief();
  $('terrainReglerBtn').onclick = () => { const o = terrainChoisi(); if (o) _rappels.regler(o); };
  $('terrainSupprimerBtn').onclick = () => supprimerLeChoisi();
  $('terrainSceneAnnuler').onclick = () => fermerChoixDeScene();
  $('terrainApercuPlein').onclick = () => {
    const f = $('terrainApercuFenetre');
    f.dataset.mode = f.dataset.mode === 'plein' ? 'fenetre' : 'plein';
    redessiner();
  };

  // La vue de dessus : molette = zoom, glisser droit = déplacer, clic = désigner.
  const plan = $('terrainPlan');
  plan.addEventListener('wheel', (e) => {
    if (!T || !T.vue) return;
    e.preventDefault();
    // Demandé : avec un pinceau (relief, Zone peinte), la molette règle sa TAILLE ; Ctrl + molette zoome.
    if (!e.ctrlKey && !e.metaKey) {
      const sens = e.deltaY < 0 ? 1 : -1;
      if (T.outil === 'relief') {
        T.pinceau.rayon = T_PINCEAU.rayon = Math.max(1, Math.min(30, T.pinceau.rayon + sens));
        majContenu(); redessiner(); return;
      }
      if (T.outil === 'zone' && T.sorteZone === 'pinceau') {
        T.pinceauZone = T_PINCEAU_ZONE.rayon = Math.max(0.5, Math.min(20, T.pinceauZone + sens * 0.5));
        majContenu(); redessiner(); return;
      }
    }
    const r = plan.getBoundingClientRect(), { l, h } = taillePlan();
    T.vue = zoomerLePlan(T.vue, { x: e.clientX - r.left, y: e.clientY - r.top }, l, h, e.deltaY > 0 ? 1 / 1.15 : 1.15);
    redessiner();
  }, { passive: false });
  plan.addEventListener('contextmenu', (e) => { e.preventDefault(); if (T && T.chaine) finirLaLigne(); });
  plan.addEventListener('pointerdown', (e) => {
    if (!T || !T.vue) return;
    const r = plan.getBoundingClientRect();
    const s = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (e.button === 2 && T.chaine) return;   // le clic droit termine la ligne (contextmenu)
    if (e.button === 2 || e.button === 1) { T.geste = { sorte: 'plan', x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, bouton: e.button }; plan.setPointerCapture && plan.setPointerCapture(e.pointerId); return; }
    if (e.button !== 0) return;
    const { l, h } = taillePlan();
    const m = versLeMonde(T.vue, s, l, h);
    if (T.outil === 'zone' && T.sorteZone === 'pinceau') {
      // Une Zone peinte choisie s'agrandit (ou se gomme, Maj) ; sinon, une Zone neuve.
      const sc = laScene();
      const choisie = sc && T.choisi ? sc.page.objects.find(o => o.id === T.choisi && o.tracéType === 'terrain' && o.world && o.world.masque) : null;
      if (e.shiftKey && !choisie) return;
      retenirPourAnnuler();
      T.coupZone = { id: choisie ? choisie.id : null, effacer: !!e.shiftKey, dernier: null };
      peindreLaZone(m);
      plan.setPointerCapture && plan.setPointerCapture(e.pointerId);
      redessiner();
      return;
    }
    if (T.outil === 'zone') { T.rectangle = { a: m, b: m }; plan.setPointerCapture && plan.setPointerCapture(e.pointerId); return; }
    if (T.outil === 'relief') {
      const sc = laScene();
      if (!sc) return;
      retenirPourAnnuler();
      // « Aplanir » vise la hauteur sous le premier clic, pour tout le coup.
      T.coup = { cible: hauteurDuRelief(sc.panel.relief, m.x, m.z), dernier: null };
      peindre(m);
      plan.setPointerCapture && plan.setPointerCapture(e.pointerId);
      redessiner();
      return;
    }
    if (T.outil === 'trace') {
      // Un double-clic termine (son second clic n'ajoute pas de point).
      if (e.detail >= 2 && T.chaine) { finirLaLigne(); return; }
      T.chaine = [...(T.chaine || []), m];
      redessiner();
      return;
    }
    const f = sousLePlan(s);
    T.choisi = f ? f.id : null;
    const obj = terrainChoisi();
    // Le double-clic ouvre la fenêtre d'un Tracé ; une Zone, elle, se règle dans « Sélection ».
    if (obj && e.detail >= 2 && obj.tracéType !== 'terrain') { _rappels.regler(obj); return; }
    // Une Zone ou un Tracé choisi se fait glisser (l'instantané au premier mouvement).
    if (obj && obj.world) { T.glisser = { id: obj.id, depart: m, origine: JSON.parse(JSON.stringify(obj.world)), bouge: false }; plan.setPointerCapture && plan.setPointerCapture(e.pointerId); }
    majContenu(); redessiner();
  });
  plan.addEventListener('dblclick', (e) => { if (T && T.outil === 'trace') { e.preventDefault(); finirLaLigne(); } });
  plan.addEventListener('pointermove', (e) => {
    if (!T || !T.vue) return;
    const r = plan.getBoundingClientRect(), { l, h } = taillePlan();
    const m = versLeMonde(T.vue, { x: e.clientX - r.left, y: e.clientY - r.top }, l, h);
    if (T.geste && T.geste.sorte === 'plan') {
      T.vue = { ...T.vue, cx: T.vue.cx - (e.clientX - T.geste.x) / T.vue.ppm, cz: T.vue.cz - (e.clientY - T.geste.y) / T.vue.ppm };
      T.geste.x = e.clientX; T.geste.y = e.clientY;
      redessiner();
    } else if (T.rectangle) { T.rectangle.b = m; redessiner(); }
    else if (T.outil === 'zone' && T.sorteZone === 'pinceau') {
      T.survol = m;
      if (T.coupZone && (!T.coupZone.dernier || Math.hypot(m.x - T.coupZone.dernier.x, m.z - T.coupZone.dernier.z) >= Math.max(PAS_DE_ZONE, T.pinceauZone / 3))) peindreLaZone(m);
      redessiner();
    }
    else if (T.outil === 'relief') {
      T.survol = m;
      // Un passage tous les quarts de rayon : le trait est régulier, quelle que soit la vitesse.
      if (T.coup && (!T.coup.dernier || Math.hypot(m.x - T.coup.dernier.x, m.z - T.coup.dernier.z) >= T.pinceau.rayon / 4)) peindre(m);
      redessiner();
    }
    else if (T.chaine) { T.fantome = m; redessiner(); }
    else if (T.glisser) {
      const obj = terrainChoisi();
      if (!obj) { T.glisser = null; return; }
      if (!T.glisser.bouge) { retenirPourAnnuler(); T.glisser.bouge = true; }
      obj.world = deplacerLeMonde(T.glisser.origine, m.x - T.glisser.depart.x, m.z - T.glisser.depart.z);
      apresModification(obj);
    }
  });
  const finGestePlan = (e) => {
    if (!T) return;
    if (T.geste && T.geste.sorte === 'plan') {
      // Demandé : avec l'outil Relief, un clic droit SANS bouger passe au mode suivant (glissé, il déplace la vue).
      const g0 = T.geste; T.geste = null;
      const clicSansBouger = g0.bouton === 2 && e && e.type === 'pointerup' && Math.hypot(e.clientX - g0.x0, e.clientY - g0.y0) < 4;
      if (clicSansBouger && T.outil === 'relief') {
        T.pinceau.mode = T_PINCEAU.mode = MODES_DU_PINCEAU[(MODES_DU_PINCEAU.indexOf(T.pinceau.mode) + 1) % MODES_DU_PINCEAU.length];
        majContenu(); redessiner();
      } else if (clicSansBouger && T.outil === 'zone') {
        // Demandé : avec l'outil Zone, le clic droit passe du Rectangle au Pinceau, et inversement.
        T.sorteZone = SORTES_DE_ZONE[(SORTES_DE_ZONE.indexOf(T.sorteZone) + 1) % SORTES_DE_ZONE.length];
        majContenu(); redessiner();
      }
    }
    if (T.coup) { T.coup = null; apresModification(null); }
    if (T.coupZone) { const id = T.coupZone.id; T.coupZone = null; const sc = laScene(); apresModification(sc && id ? sc.page.objects.find(o => o.id === id) : null); }
    if (T.rectangle && e && e.type === 'pointerup') {
      const { a, b } = T.rectangle; T.rectangle = null;
      poser('terrain', zoneEntre(a, b));
      redessiner();
    }
    T.rectangle = null;
    T.glisser = null;
  };
  plan.addEventListener('pointerup', finGestePlan);
  plan.addEventListener('pointerleave', () => { if (T && T.survol && !T.coup) { T.survol = null; redessiner(); } });
  plan.addEventListener('pointercancel', finGestePlan);

  // L'aperçu 3D : glisser gauche = tourner, droit = déplacer, molette = zoomer.
  const ap = $('terrainApercuCanvas');
  ap.addEventListener('contextmenu', (e) => e.preventDefault());
  ap.addEventListener('pointerdown', (e) => {
    if (!T) return;
    T.geste = { sorte: e.button === 0 ? 'tourner' : 'deplacer', x: e.clientX, y: e.clientY };
    ap.setPointerCapture && ap.setPointerCapture(e.pointerId);
  });
  ap.addEventListener('pointermove', (e) => {
    if (!T || !T.geste || T.geste.sorte === 'plan') return;
    T.cam = bougerCameraApercu(T.cam, T.geste.sorte, e.clientX - T.geste.x, e.clientY - T.geste.y, T.mParPixel);
    T.geste.x = e.clientX; T.geste.y = e.clientY;
    redessiner();
  });
  const finGesteApercu = () => { if (T && T.geste && T.geste.sorte !== 'plan') T.geste = null; };
  ap.addEventListener('pointerup', finGesteApercu);
  ap.addEventListener('pointercancel', finGesteApercu);
  ap.addEventListener('wheel', (e) => {
    if (!T) return;
    e.preventDefault();
    T.cam = zoomerCameraApercu(T.cam, deltaMolette3D(e));
    redessiner();
  }, { passive: false });
  majBoutonEditeurDeTerrain();
}
