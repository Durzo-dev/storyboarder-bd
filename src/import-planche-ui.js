/**
 * @file import-planche-ui.js
 * « Importer une planche » (demandé le 12 octobre 2026) et la CORRECTION de ses Cases, directement
 * sur la Planche (demandé le 13 octobre 2026 : pas de modale, et l'on doit pouvoir y revenir depuis
 * le menu de la Planche).
 *
 * L'import range l'image, crée la Planche avec les Cases détectées juste après la Planche affichée,
 * et l'ouvre en ÉDITION DES CASES. Dans ce mode, sur la Planche : un clic sélectionne une Case, la
 * tirer la déplace, tirer un coin la redimensionne, tirer dans le vide en trace une nouvelle, Suppr
 * la retire, Échap termine ; un CLIC DROIT crée une Case (le seul moyen, demandé), un clic hors des
 * Cases désélectionne. Le menu de la Planche porte « Modifier les cases » / « Terminer » (la
 * sensibilité a été retirée, demandé : la correction suffit).
 *
 * Un import se défait d'un Ctrl+Z, comme tout le reste : un point d'annulation est pris avant.
 * Les décisions (détection, retouches, ordre de lecture) sont dans planche-importee.js.
 */

import { S, tr, newId, currentPageData, currentPage, createVolume } from './state.js';
import { choisirImage, rangerImageChoisie } from './image-store.js';
import { preloadImagesFor } from './image-cache.js';
import { snapCornerToRightAngle } from './hit-test.js';
import {
  detecterCases, niveauxDeGris, regionTracee, creerPlancheImportee,
  pointsDeLaCase, poserPointsDeLaCase, translaterPoints, dansLesPoints,
  estPlancheImportee, estCaseImportee, imageDeLaPlanche, poseDeLImage, formatPourLaPlanche, tomeAdaptable,
} from './planche-importee.js';

/** La plus grande dimension de l'image ANALYSÉE : au-delà, la détection ralentit sans rien gagner. */
const ANALYSE_MAX_PX = 1400;
/** La distance, en unités de Planche, à laquelle un coin se saisit. */
const POIGNEE = 8;

let _rappels = { snapshot: () => {}, renderAll: () => {}, redessiner: () => {}, alerter: async () => {}, confirmer: async () => false };
/** Les rappels de events.js (règle n°2 : pas d'import circulaire). */
export function setImportPlancheCallbacks(r){ _rappels = { ..._rappels, ...r }; }

/** L'édition en cours : la Planche (par son id), la Case sélectionnée, le geste. */
let edition = null;   // { pageId, sel, geste }

/**
 * LE CLIGNOTEMENT de la Case sélectionnée en correction (demandé) : sa bordure passe d'orange à
 * noir, en boucle. Un minuteur ne redessine que tant qu'une Case est sélectionnée.
 */
export const CLIGNOTEMENT_MS = 350;
let _minuteur = null;
function suivreLeClignotement(){
  const actif = editionDesCasesActive() && !!edition.sel;
  if (actif && !_minuteur) _minuteur = setInterval(() => {
    if (!editionDesCasesActive() || !edition.sel) { clearInterval(_minuteur); _minuteur = null; return; }
    _rappels.redessiner();
  }, CLIGNOTEMENT_MS);
  if (!actif && _minuteur) { clearInterval(_minuteur); _minuteur = null; }
}
/** La phase du clignotement : 0 orange, 1 noir (demandé : entre orange et noir seulement). */
export function phaseDuClignotement(t = Date.now()){ return Math.floor(t / CLIGNOTEMENT_MS) % 2; }

/** La Planche affichée est-elle en édition des Cases ? */
export function editionDesCasesActive(){
  const pd = currentPageData();
  return !!(edition && pd && pd.id === edition.pageId && estPlancheImportee(pd));
}

export function entrerEditionDesCases(){
  const pd = currentPageData();
  if (!pd || !estPlancheImportee(pd)) return;
  edition = { pageId: pd.id, sel: null, geste: null };
  S.selectedId = null; S.pageSelected = true;
  _rappels.renderAll();
}

/** Quitter la correction : plus aucune Case sélectionnée ni en surbrillance (demandé). */
export function sortirEditionDesCases(){
  if (!edition) return;
  edition = null;
  surbrillance = null;
  S.selectedId = null;
  _rappels.renderAll();
}

/** La pose de l'image de la Planche affichée. */
function pose(){
  const page = currentPage();
  const i = page.importee;
  return poseDeLImage(page.w, page.h, i.largeur, i.hauteur, i);
}
const enFraction = (p, po) => ({ x: (p.x - po.x) / po.w, y: (p.y - po.y) / po.h });
const casesImportees = () => currentPageData().objects.filter(estCaseImportee);

/**
 * Les numéros, compactés de 1 à N dans l'ORDRE COURANT : celui de la détection à l'import, puis
 * celui que l'utilisateur a choisi en glissant les Cases dans le menu de la Planche. Une Case
 * ajoutée prend le dernier numéro ; une Case retirée laisse les autres dans leur ordre.
 */
function compacter(){
  casesImportees().slice().sort((a, b) => (a.caseNumber || 1e9) - (b.caseNumber || 1e9))
    .forEach((o, i) => { o.caseNumber = i + 1; });
}

/**
 * La Case MISE EN SURBRILLANCE depuis le menu de la Planche (demandé) : un clic sur sa ligne la
 * désigne sur la Planche sans quitter le menu. En correction, c'est aussi la Case sélectionnée.
 */
let surbrillance = null;
export function mettreEnSurbrillance(id){
  surbrillance = id || null;
  if (editionDesCasesActive()) { edition.sel = id || null; suivreLeClignotement(); }
}
export function caseEnSurbrillance(){
  if (editionDesCasesActive()) return edition.sel;
  return surbrillance && casesImportees().some(o => o.id === surbrillance) ? surbrillance : null;
}

/**
 * Ce qui est sous le pointeur (unités de Planche) : un COIN de la Case sélectionnée (`{ coin: i }`),
 * le MILIEU d'un de ses bords (`{ bord: i }`, le bord i joint les coins i et i+1, comme `pts`), une
 * Case (`deplacer`), ou rien. Mêmes poignées qu'une Case ordinaire (cf. hitPanelCorner, hitPanelEdge).
 */
function cible(p, po){
  const cases = casesImportees();
  const sel = cases.find(o => o.id === edition.sel);
  const versPage = (q) => ({ x: po.x + q.x * po.w, y: po.y + q.y * po.h });
  if (sel) {
    const pts = pointsDeLaCase(sel).map(versPage);
    for (let i = 0; i < 4; i++) if (Math.hypot(p.x - pts[i].x, p.y - pts[i].y) <= POIGNEE) return { o: sel, coin: i };
    for (let i = 0; i < 4; i++) {
      const a = pts[i], b = pts[(i + 1) % 4];
      if (Math.hypot(p.x - (a.x + b.x) / 2, p.y - (a.y + b.y) / 2) <= POIGNEE) return { o: sel, bord: i };
    }
  }
  const f = enFraction(p, po);
  let meilleure = null;
  for (const o of cases) {
    const r = o.regionImage;
    if (dansLesPoints(pointsDeLaCase(o), f.x, f.y)
      && (!meilleure || r.w * r.h < meilleure.regionImage.w * meilleure.regionImage.h)) meilleure = o;
  }
  return meilleure ? { o: meilleure, deplacer: true } : null;
}

/** Le curseur à montrer en survol, ou null hors édition. */
export function curseurEdition(p){
  if (!editionDesCasesActive()) return null;
  const t = cible(p, pose());
  if (!t) return 'crosshair';
  // Les mêmes curseurs qu'une Case ordinaire : la main sur un coin, une double flèche sur un bord.
  if (t.deplacer) return 'move';
  if (t.bord !== undefined) return (t.bord === 0 || t.bord === 2) ? 'ns-resize' : 'ew-resize';
  return 'pointer';
}

/** Le début d'un geste sur la Planche (bouton gauche). Rend true s'il est pris. */
export function debutGesteEdition(p){
  if (!editionDesCasesActive()) return false;
  const po = pose();
  const t = cible(p, po);
  if (t) {
    edition.sel = t.o.id;
    edition.geste = { ...t, depart: p, pts0: pointsDeLaCase(t.o), pris: false };
  } else {
    // Un clic hors de toute Case désélectionne (demandé). On ne trace plus au bouton gauche : une
    // Case se crée au clic droit, et seulement ainsi.
    edition.sel = null;
    surbrillance = null;
  }
  suivreLeClignotement();
  return true;
}

/** Le seuil d'équerre, en unités de Planche : celui d'une Case ordinaire (cf. events.js, panelCorner). */
const EQUERRE = 8;

/**
 * Le glisser, comme sur une Case ordinaire : un COIN se déplace seul (la Case se DÉFORME), et
 * s'aligne sur ses voisins à moins de 8 unités (snapCornerToRightAngle) ; un BORD se déplace
 * parallèlement à lui-même (haut et bas en hauteur, gauche et droite en largeur) ; la Case entière
 * se translate sans sortir de l'image.
 */
export function mouvementGesteEdition(p){
  if (!editionDesCasesActive() || !edition.geste) return false;
  const g = edition.geste;
  const po = pose();
  const dx = p.x - g.depart.x, dy = p.y - g.depart.y;
  if (!g.pris) { if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return true; _rappels.snapshot(); g.pris = true; }
  const fx = dx / po.w, fy = dy / po.h;
  let pts;
  if (g.deplacer) {
    pts = translaterPoints(g.pts0, fx, fy);
  } else if (g.coin !== undefined) {
    const enPage = g.pts0.map(q => ({ x: po.x + q.x * po.w, y: po.y + q.y * po.h }));
    const vise = { x: enPage[g.coin].x + dx, y: enPage[g.coin].y + dy };
    const s = snapCornerToRightAngle(g.coin, enPage, vise.x, vise.y, EQUERRE);
    pts = g.pts0.slice();
    pts[g.coin] = { x: (s.x - po.x) / po.w, y: (s.y - po.y) / po.h };
  } else {
    const i = g.bord, j = (i + 1) % 4;
    const horizontal = i === 0 || i === 2;
    pts = g.pts0.slice();
    pts[i] = { x: g.pts0[i].x + (horizontal ? 0 : fx), y: g.pts0[i].y + (horizontal ? fy : 0) };
    pts[j] = { x: g.pts0[j].x + (horizontal ? 0 : fx), y: g.pts0[j].y + (horizontal ? fy : 0) };
  }
  poserPointsDeLaCase(g.o, pts);
  S.projectDirty = true;
  return true;
}

export function finGesteEdition(){
  if (!editionDesCasesActive() || !edition.geste) return false;
  edition.geste = null;
  return true;
}

/** La taille d'une Case créée au clic droit, en part de l'image : de quoi la saisir, puis l'ajuster. */
const NOUVELLE_CASE = { w: 0.25, h: 0.18 };

/**
 * En correction, un CLIC DROIT sans glisser crée une Case centrée sur le point (demandé : le seul
 * moyen d'en créer une). Elle prend le dernier numéro et devient la Case sélectionnée.
 */
export function creerCaseAuPoint(p){
  if (!editionDesCasesActive()) return false;
  const f = enFraction(p, pose());
  if (f.x < 0 || f.x > 1 || f.y < 0 || f.y > 1) return false;
  const r = regionTracee({ x: f.x - NOUVELLE_CASE.w / 2, y: f.y - NOUVELLE_CASE.h / 2 }, { x: f.x + NOUVELLE_CASE.w / 2, y: f.y + NOUVELLE_CASE.h / 2 });
  if (!r) return false;
  _rappels.snapshot();
  const pd = currentPageData();
  const o = { id: newId(), type: 'panel', x: 0, y: 0, w: 1, h: 1, text: '', shape: 'rect', imageFile: imageDeLaPlanche(pd), regionImage: r, caseNumber: 1e9 };
  pd.objects.push(o);
  edition.sel = o.id;
  suivreLeClignotement();
  compacter();
  S.projectDirty = true;
  _rappels.renderAll();
  return true;
}

/** Retire la Case sélectionnée. */
export function supprimerCaseEnEdition(){
  if (!editionDesCasesActive() || !edition.sel) return false;
  const pd = currentPageData();
  // La dernière Case reste : une Planche importée porte son image par ses Cases.
  if (casesImportees().length <= 1) return true;
  _rappels.snapshot();
  pd.objects = pd.objects.filter(o => o.id !== edition.sel);
  edition.sel = null;
  compacter();
  S.projectDirty = true;
  _rappels.renderAll();
  return true;
}

/** Une image décodée → niveaux de gris réduits, pour la détection. */
function grisDe(bitmap){
  const e = Math.min(1, ANALYSE_MAX_PX / Math.max(bitmap.width, bitmap.height));
  const aw = Math.max(1, Math.round(bitmap.width * e)), ah = Math.max(1, Math.round(bitmap.height * e));
  const toile = document.createElement('canvas');
  toile.width = aw; toile.height = ah;
  const c = toile.getContext('2d', { willReadFrequently: true });
  c.drawImage(bitmap, 0, 0, aw, ah);
  return { aw, ah, gris: niveauxDeGris(c.getImageData(0, 0, aw, ah).data, aw, ah) };
}

// Suppr et Échap pendant l'édition. EN CAPTURE, et ils s'arrêtent là : sans cela, Suppr atteindrait
// l'écouteur du canevas (events.js) et Échap ouvrirait le menu Projet.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('keydown', (e) => {
    if (!editionDesCasesActive()) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); supprimerCaseEnEdition(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); sortirEditionDesCases(); }
  }, true);
}

/**
 * La planche n'a pas les proportions du Tome : on PROPOSE un format qui lui corresponde (demandé).
 * Si le Tome peut changer sans rien déranger (ses autres Planches sont vides ou importées), on
 * propose de l'adapter ; sinon, de créer un Tome à ce format et d'y placer la planche. Refuser la
 * garde dans le Tome, avec des bandes (cf. poseDeLImage). Le point d'annulation de l'import couvre
 * aussi ce choix.
 */
async function proposerUnFormat(t, pd){
  const f = formatPourLaPlanche(t, pd.importee.largeur, pd.importee.hauteur);
  if (!f) return;
  const dims = `${pd.importee.largeur} × ${pd.importee.hauteur} px`;
  if (tomeAdaptable(t, pd.id)) {
    const ok = await _rappels.confirmer(tr(
      `This page (${dims}) does not have the proportions of the volume "${t.name}". Switch the volume to a custom format that matches it?`,
      `Cette planche (${dims}) n'a pas les proportions du tome « ${t.name} ». Passer le tome à un format personnalisé qui lui correspond ?`),
    tr('Page format', 'Format de la planche'));
    if (ok) { t.format = 'custom'; t.w = f.w; t.h = f.h; }
    return;
  }
  const ok = await _rappels.confirmer(tr(
    `This page (${dims}) does not have the proportions of the volume "${t.name}", whose other pages would be upset by a format change. Create a new volume in a format that matches it, and move the page there?`,
    `Cette planche (${dims}) n'a pas les proportions du tome « ${t.name} », dont les autres planches seraient dérangées par un changement de format. Créer un nouveau tome à son format et y placer la planche ?`),
  tr('Page format', 'Format de la planche'));
  if (!ok) return;
  t.pages = t.pages.filter(p => p !== pd);
  delete pd.chapitreId;
  const nouveau = createVolume('custom');
  nouveau.w = f.w; nouveau.h = f.h; nouveau.scale = t.scale;
  nouveau.pages.push(pd);
  S.currentTomeIndex = S.tomes.indexOf(nouveau);
  S.currentPageIndex = 0;
  if (S.expandedVolumes && S.expandedVolumes.add) S.expandedVolumes.add(nouveau.id);
}

/** Le point d'entrée : clic droit dans le vide de la Planche `pi` du Tome `ti`. */
export async function ouvrirImportPlanche(ti, pi){
  const choisi = await choisirImage();
  if (choisi.canceled) return;
  if (!choisi.ok) { await _rappels.alerter(tr(`The image could not be read: ${choisi.error}`, `L'image n'a pas pu être lue : ${choisi.error}`)); return; }
  let bitmap;
  try { bitmap = await createImageBitmap(new Blob([choisi.data])); }
  catch (err) { await _rappels.alerter(tr('This file is not an image the application can read.', 'Ce fichier n\'est pas une image que l\'application sait lire.')); return; }
  const { aw, ah, gris } = grisDe(bitmap);
  const regions = detecterCases(gris, aw, ah);
  const t = S.tomes[ti];
  if (!t) return;
  const range = await rangerImageChoisie(choisi);
  if (!range.ok) { await _rappels.alerter(tr(`The image could not be saved: ${range.error}`, `L'image n'a pas pu être rangée : ${range.error}`)); return; }
  const pd = creerPlancheImportee({ nomImage: range.name, largeur: bitmap.width, hauteur: bitmap.height, regions, newId });
  if (bitmap.close) bitmap.close();
  const voisine = t.pages[pi];
  if (voisine && voisine.chapitreId) pd.chapitreId = voisine.chapitreId;
  _rappels.snapshot();
  t.pages.splice(pi + 1, 0, pd);
  S.currentTomeIndex = ti;
  S.currentPageIndex = pi + 1;
  S.selectedId = null; S.selectedRoomId = null;
  S.projectDirty = true;
  await proposerUnFormat(t, pd);
  await preloadImagesFor(pd.objects);
  // Elle s'ouvre directement en correction des Cases.
  entrerEditionDesCases();
}

