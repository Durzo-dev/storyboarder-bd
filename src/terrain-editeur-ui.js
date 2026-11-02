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
 */
import { S, tr, newId } from './state.js';
import { contenuDuPlan, cadrageDuPlan, versLePlan, zoomerLePlan, pasDeLaGrille, versLeMonde,
  zoneEntre, traceDePoints, deplacerLeMonde, sousLePoint } from './terrain-plan.js';
import { rendreSceneVueLibre3D, ensureElementWorldPos3D, pointDuBatimentPlace3D, panelCamBasis3D, getCamOrbitWorld,
  tracéUpdateScreenPts } from './scene3d.js';
import { nomDuTrace } from './canvas-tools.js';
import { TRACÉ_DEFAULTS } from './constants.js';
import { getElementDepth } from './utils.js';
import { niveauxTries } from './batiment-niveaux.js';
import { formesDesPieces } from './batiment-pieces.js';
import { PANEL_CAM_DEFAULT_DIST_3D } from './constants.js';
import { sectionDroitePliee, memoriserSectionDroite } from './section-memory.js';

const $ = (id) => document.getElementById(id);
let _rappels = { avantOuverture: () => {}, apresFermeture: () => {}, ouvrirLaScene: () => {}, instantane: () => {},
  regler: () => {}, apresModification: () => {} };
/**
 * Les rappels de l'application (events.js) : fermer les autres écrans du centre, redessiner après ;
 * ouvrir la Scène (les fenêtres de réglage travaillent sur la page courante) ; l'instantané d'annulation
 * avant une modification ; la fenêtre de réglage d'une Zone ou d'un Tracé ; redessiner la Scène après.
 */
export function setTerrainEditeurCallbacks(r){ _rappels = { ..._rappels, ...r }; }

/** L'éditeur ouvert : { sceneId, vue, cam, formes, choisi, geste, demande }, ou null. */
let T = null;
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
  if (T) fermerEditeurDeTerrain();
  _rappels.avantOuverture();
  // La Scène devient la page courante : les fenêtres de réglage (Tracé, Zone) et l'annulation y travaillent.
  if (S.editingSceneId !== sceneId) _rappels.ouvrirLaScene(sceneId);
  T = { sceneId, vue: null, cam: null, formes: [], choisi, geste: null, demande: 0,
    // #462b : l'outil, le Tracé à poser, la ligne en cours (et le point sous la souris), le rectangle de
    // Zone en cours, la Zone ou le Tracé qu'on fait glisser ; la signature du dernier aperçu rendu.
    outil: 'selection', sorteTrace: 'route', chaine: null, fantome: null, rectangle: null, glisser: null, sigApercu: null };
  const sc = laScene();
  if (!sc) { T = null; return false; }
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

/** Ferme l'éditeur (rien n'y est encore modifiable : rien à demander). */
export function fermerEditeurDeTerrain(){
  if (!T) return true;
  if (T.demande) cancelAnimationFrame(T.demande);
  T = null;
  $('terrainEditeur').classList.add('hidden');
  window.removeEventListener('keydown', clavier, true);
  window.removeEventListener('resize', redessiner);
  _rappels.apresFermeture();
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
  if ((e.key === 'Delete' || e.key === 'Backspace') && terrainChoisi()) { stop(); supprimerLeChoisi(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const outil = { v: 'selection', z: 'zone', t: 'trace' }[e.key.toLowerCase()];
  if (outil) { stop(); choisirOutil(T.outil === outil ? 'selection' : outil); }
}

// ── Les outils (#462b) ────────────────────────────────────────────────────────────────────────

const SORTES_DE_TRACE = ['route', 'chemin', 'muret', 'cloture', 'haie', 'barriere'];
function nomDeSorte(sorte){
  return ({ route: tr('Road', 'Route'), chemin: tr('Dirt path', 'Chemin'), muret: tr('Low wall', 'Muret'),
    cloture: tr('Fence', 'Clôture'), haie: tr('Hedge', 'Haie'), barriere: tr('Barrier', 'Barrière') })[sorte] || sorte;
}

function choisirOutil(outil){
  if (!T) return;
  T.outil = outil; T.chaine = null; T.rectangle = null; T.fantome = null;
  for (const [id, o] of [['terrainOutilSelection', 'selection'], ['terrainOutilZone', 'zone'], ['terrainOutilTrace', 'trace']]) $(id).classList.toggle('actif', o === outil);
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
  _rappels.instantane();
  const def = TRACÉ_DEFAULTS[sorte] || {};
  const obj = sorte === 'terrain'
    ? { id: newId(), type: 'tracé', tracéType: 'terrain', name: nomDuTrace('terrain'), panelId: sc.panel.id, terrainType: 'herbe', label: '', world }
    : { id: newId(), type: 'tracé', tracéType: sorte, name: nomDuTrace(sorte), panelId: sc.panel.id, color: def.color, width: def.width, world };
  if (def.wallHeight !== undefined) obj.wallHeight = def.wallHeight;
  sc.page.objects.push(obj);
  T.choisi = obj.id;
  apresModification(obj);
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
  _rappels.instantane();
  const i = sc.page.objects.indexOf(obj);
  if (i >= 0) sc.page.objects.splice(i, 1);
  T.choisi = null;
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
    l.push(trad('Drag: draw a terrain zone (a rectangle).', 'Glisser : tracer une Zone de terrain (un rectangle).'));
  } else if (outil === 'trace') {
    l.push(trad('Click: one point per bend; double-click, Enter or right-click: finish.', 'Clic : un point par virage ; double-clic, Entrée ou clic droit : terminer.'));
    l.push(trad('The kind is chosen in "Path to draw".', 'Le genre se choisit dans « Tracé à poser ».'));
  } else {
    l.push(trad('Click a zone or path: select it; drag: move it; Del: delete it.', 'Clic sur une Zone ou un Tracé : le choisir ; glisser : le déplacer ; Suppr : le supprimer.'));
    l.push(trad('Double-click: its settings. Elements are only pointed out here.', 'Double-clic : ses réglages. Les Éléments ne sont que désignés ici.'));
  }
  l.push(trad('V selection · Z zone · T paths.', 'V sélection · Z zone · T tracés.'));
  l.push(trad('Wheel: zoom · right drag: move the view.', 'Molette : zoomer · glisser droit : déplacer la vue.'));
  l.push(trad('Esc: cancel, then leave the tool, then back to the Scene.', "Échap : annuler, puis quitter l'outil, puis revenir à la Scène."));
  return l;
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
    $('terrainSortesTrace').replaceChildren(...SORTES_DE_TRACE.map(sorte => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'nav-btn' + (sorte === T.sorteTrace ? ' actif' : '');
      b.textContent = nomDeSorte(sorte);
      b.onclick = () => { T.sorteTrace = sorte; majContenu(); };
      return b;
    }));
  }
  // La Zone ou le Tracé choisi.
  const obj = terrainChoisi();
  $('terrainSecChoisi').hidden = !obj;
  if (obj) $('terrainChoisiNom').textContent = obj.name || nomDeSorte(obj.tracéType);
  const liste = $('terrainContenu');
  const nommes = T.formes.filter(f => f.type === 'element' || f.type === 'batiment');
  const lignes = nommes.map(f => {
    const l = document.createElement('div');
    l.className = 'batiment-ligne terrain-ligne' + (f.id === T.choisi ? ' actif' : '');
    l.textContent = f.nom || (f.type === 'batiment' ? tr('Building', 'Bâtiment') : tr('Element', 'Élément'));
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
  const encre = couleur('--ink', '#e8e8ea'), accent = couleur('--accent', '#e07a3c');
  const chemin = (pts, ferme) => { g.beginPath(); pts.forEach((p, i) => { const s = e(p); if (i) g.lineTo(s.x, s.y); else g.moveTo(s.x, s.y); }); if (ferme) g.closePath(); };
  for (const f of T.formes) {
    const choisi = f.id === T.choisi;
    if (f.type === 'zone') {
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
  const sig = JSON.stringify([T.cam, c.width, c.height, sc.page.objects.map(o => [o.id, o.world, o.color, o.terrainType, o.terrainColor,
    o.wallHeight, o.wallThickness, o.marquage, o.traceTexture, o.wxFloor, o.wzFloor, o.rotY, o.hidden3d])]);
  if (sig === T.sigApercu) return;
  T.sigApercu = sig;
  const img = rendreSceneVueLibre3D(sc.panel, sc.page, T.cam, scale);
  const g = c.getContext('2d');
  if (!img || !g) return;
  const r = Math.min(img.width / c.width, img.height / c.height);
  const lw = c.width * r, lh = c.height * r;
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(img, (img.width - lw) / 2, (img.height - lh) / 2, lw, lh, 0, 0, c.width, c.height);
}

/** Le geste de la caméra de l'aperçu, PUR : tourner (gauche), déplacer (droit), en pixels. */
export function bougerCameraApercu(cam, geste, dx, dy){
  if (geste === 'tourner') {
    return { ...cam, rotY: cam.rotY - dx * 0.008, rotX: Math.min(Math.PI / 2 - 0.01, Math.max(0.03, cam.rotX + dy * 0.008)) };
  }
  // Déplacer : le centre glisse sur le Sol, selon l'orientation de la caméra.
  const k = cam.dist * 0.0025, c = Math.cos(cam.rotY), s = Math.sin(cam.rotY);
  return { ...cam, x: cam.x - (dx * c + dy * s) * k, z: cam.z - (-dx * s + dy * c) * k };
}
/** La molette de l'aperçu : la distance, bornée. */
export function zoomerCameraApercu(cam, deltaY){
  return { ...cam, dist: Math.min(800, Math.max(2, cam.dist * (deltaY > 0 ? 1.12 : 1 / 1.12))) };
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
  $('terrainEditeurFermerX').onclick = () => fermerEditeurDeTerrain();
  $('terrainRecadrerBtn').onclick = () => recadrer();
  for (const [id, outil] of [['terrainOutilSelection', 'selection'], ['terrainOutilZone', 'zone'], ['terrainOutilTrace', 'trace']]) {
    $(id).onclick = () => { if (T) choisirOutil(T.outil === outil && outil !== 'selection' ? 'selection' : outil); };
  }
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
    if (e.button === 2 || e.button === 1) { T.geste = { sorte: 'plan', x: e.clientX, y: e.clientY }; plan.setPointerCapture && plan.setPointerCapture(e.pointerId); return; }
    if (e.button !== 0) return;
    const { l, h } = taillePlan();
    const m = versLeMonde(T.vue, s, l, h);
    if (T.outil === 'zone') { T.rectangle = { a: m, b: m }; plan.setPointerCapture && plan.setPointerCapture(e.pointerId); return; }
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
    if (obj && e.detail >= 2) { _rappels.regler(obj); return; }
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
    else if (T.chaine) { T.fantome = m; redessiner(); }
    else if (T.glisser) {
      const obj = terrainChoisi();
      if (!obj) { T.glisser = null; return; }
      if (!T.glisser.bouge) { _rappels.instantane(); T.glisser.bouge = true; }
      obj.world = deplacerLeMonde(T.glisser.origine, m.x - T.glisser.depart.x, m.z - T.glisser.depart.z);
      apresModification(obj);
    }
  });
  const finGestePlan = (e) => {
    if (!T) return;
    if (T.geste && T.geste.sorte === 'plan') T.geste = null;
    if (T.rectangle && e && e.type === 'pointerup') {
      const { a, b } = T.rectangle; T.rectangle = null;
      poser('terrain', zoneEntre(a, b));
      redessiner();
    }
    T.rectangle = null;
    T.glisser = null;
  };
  plan.addEventListener('pointerup', finGestePlan);
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
    T.cam = bougerCameraApercu(T.cam, T.geste.sorte, e.clientX - T.geste.x, e.clientY - T.geste.y);
    T.geste.x = e.clientX; T.geste.y = e.clientY;
    redessiner();
  });
  const finGesteApercu = () => { if (T && T.geste && T.geste.sorte !== 'plan') T.geste = null; };
  ap.addEventListener('pointerup', finGesteApercu);
  ap.addEventListener('pointercancel', finGesteApercu);
  ap.addEventListener('wheel', (e) => {
    if (!T) return;
    e.preventDefault();
    T.cam = zoomerCameraApercu(T.cam, e.deltaY);
    redessiner();
  }, { passive: false });
  majBoutonEditeurDeTerrain();
}
