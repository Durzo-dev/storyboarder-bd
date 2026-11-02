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
 * À venir : les Zones et Tracés (#462b, qui ne se feront plus que là), le relief (#462c), l'eau (#462d).
 */
import { S, tr } from './state.js';
import { contenuDuPlan, cadrageDuPlan, versLePlan, zoomerLePlan, pasDeLaGrille, versLeMonde } from './terrain-plan.js';
import { rendreSceneVueLibre3D, ensureElementWorldPos3D, pointDuBatimentPlace3D, panelCamBasis3D, getCamOrbitWorld } from './scene3d.js';
import { getElementDepth } from './utils.js';
import { niveauxTries } from './batiment-niveaux.js';
import { formesDesPieces } from './batiment-pieces.js';
import { PANEL_CAM_DEFAULT_DIST_3D } from './constants.js';
import { sectionDroitePliee, memoriserSectionDroite } from './section-memory.js';

const $ = (id) => document.getElementById(id);
let _rappels = { avantOuverture: () => {}, apresFermeture: () => {} };
/** Les rappels de l'application (events.js) : fermer les autres écrans du centre, redessiner après. */
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
  T = { sceneId, vue: null, cam: null, formes: [], choisi, geste: null, demande: 0 };
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
  majContenu();
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
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermerEditeurDeTerrain(); }
}

// ── Le menu ───────────────────────────────────────────────────────────────────────────────────

/** Les commandes, selon ce qu'on peut faire (rien ne se modifie encore). */
export function commandesDuTerrain(trad = tr){
  return [
    trad('Wheel: zoom the top view · right drag: move it.', 'Molette : zoomer la vue de dessus · glisser droit : la déplacer.'),
    trad('Click an Element: point it out (it cannot be changed here).', 'Clic sur un Élément : le désigner (il ne se modifie pas ici).'),
    trad('3D preview: left drag turns, right drag moves, wheel zooms.', 'Aperçu 3D : glisser gauche tourne, glisser droit déplace, molette zoome.'),
    trad('Esc or Quit: back to the Scene.', 'Échap ou Quitter : retour à la Scène.'),
  ];
}

function majContenu(){
  const sc = laScene();
  if (!sc) return;
  T.formes = contenuDuPlan(sc.page, sc.panel, outilsDuPlan(sc.panel));
  $('terrainAide').textContent = commandesDuTerrain().join('\n');
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
    if (f.type === 'zone') {
      chemin(f.pts, true);
      g.globalAlpha = 0.45; g.fillStyle = f.couleur || encre; g.fill();
      g.globalAlpha = 1; g.strokeStyle = f.couleur || encre; g.lineWidth = 1; g.stroke();
    } else if (f.type === 'trace') {
      chemin(f.pts, false);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = f.couleur || encre; g.lineWidth = Math.max(2, f.largeur * vue.ppm);
      g.stroke();
    } else if (f.type === 'batiment') {
      const choisi = f.id === T.choisi;
      for (const q of f.polys) {
        chemin(q, true);
        g.globalAlpha = 0.25; g.fillStyle = choisi ? accent : encre; g.fill();
        g.globalAlpha = 1; g.strokeStyle = choisi ? accent : encre; g.lineWidth = choisi ? 2 : 1; g.stroke();
      }
    } else if (f.type === 'element') {
      const s = e(f), choisi = f.id === T.choisi;
      g.beginPath(); g.arc(s.x, s.y, choisi ? 6 : 4, 0, Math.PI * 2);
      g.fillStyle = choisi ? accent : encre; g.fill();
      if (f.nom && (choisi || vue.ppm >= 12)) {
        g.font = '11px Inter, sans-serif'; g.fillStyle = choisi ? accent : encre; g.globalAlpha = choisi ? 1 : 0.7;
        g.fillText(f.nom, s.x + 8, s.y + 4); g.globalAlpha = 1;
      }
    }
  }
}

/** L'Élément (ou le bâtiment) sous le pixel `s` du plan, ou null. */
function sousLePlan(s){
  const { l, h } = taillePlan();
  let meilleur = null, d0 = 12;
  for (const f of T.formes) {
    if (f.type === 'element') {
      const p = versLePlan(T.vue, f, l, h), d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < d0) { d0 = d; meilleur = f; }
    }
  }
  if (meilleur) return meilleur;
  const m = versLeMonde(T.vue, s, l, h);
  return T.formes.find(f => f.type === 'batiment' && f.polys.some(q => dansPolygone(m, q))) || null;
}
function dansPolygone(p, q){
  let dedans = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    if ((q[i].z > p.z) !== (q[j].z > p.z) && p.x < (q[j].x - q[i].x) * (p.z - q[i].z) / (q[j].z - q[i].z) + q[i].x) dedans = !dedans;
  }
  return dedans;
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
  plan.addEventListener('contextmenu', (e) => e.preventDefault());
  plan.addEventListener('pointerdown', (e) => {
    if (!T || !T.vue) return;
    const r = plan.getBoundingClientRect();
    const s = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (e.button === 2 || e.button === 1) { T.geste = { sorte: 'plan', x: e.clientX, y: e.clientY }; plan.setPointerCapture && plan.setPointerCapture(e.pointerId); return; }
    if (e.button === 0) {
      const f = sousLePlan(s);
      T.choisi = f ? f.id : null;
      majContenu(); redessiner();
    }
  });
  plan.addEventListener('pointermove', (e) => {
    if (!T || !T.geste || T.geste.sorte !== 'plan') return;
    T.vue = { ...T.vue, cx: T.vue.cx - (e.clientX - T.geste.x) / T.vue.ppm, cz: T.vue.cz - (e.clientY - T.geste.y) / T.vue.ppm };
    T.geste.x = e.clientX; T.geste.y = e.clientY;
    redessiner();
  });
  const finGestePlan = () => { if (T && T.geste && T.geste.sorte === 'plan') T.geste = null; };
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
