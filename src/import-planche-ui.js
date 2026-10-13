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

import { S, tr, newId, currentPageData, currentPage } from './state.js';
import { choisirImage, rangerImageChoisie } from './image-store.js';
import { preloadImagesFor } from './image-cache.js';
import {
  detecterCases, niveauxDeGris, retoucherRegion, regionTracee, creerPlancheImportee,
  estPlancheImportee, estCaseImportee, imageDeLaPlanche, poseDeLImage,
} from './planche-importee.js';

/** La plus grande dimension de l'image ANALYSÉE : au-delà, la détection ralentit sans rien gagner. */
const ANALYSE_MAX_PX = 1400;
/** La distance, en unités de Planche, à laquelle un coin se saisit. */
const POIGNEE = 8;

let _rappels = { snapshot: () => {}, renderAll: () => {}, alerter: async () => {} };
/** Les rappels de events.js (règle n°2 : pas d'import circulaire). */
export function setImportPlancheCallbacks(r){ _rappels = { ..._rappels, ...r }; }

/** L'édition en cours : la Planche (par son id), la Case sélectionnée, le geste. */
let edition = null;   // { pageId, sel, geste }

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
  if (editionDesCasesActive()) edition.sel = id;
}
export function caseEnSurbrillance(){
  if (editionDesCasesActive()) return edition.sel;
  return surbrillance && casesImportees().some(o => o.id === surbrillance) ? surbrillance : null;
}

/** Ce qui est sous le pointeur (unités de Planche) : un coin de la Case sélectionnée, une Case, ou rien. */
function cible(p, po){
  const cases = casesImportees();
  const sel = cases.find(o => o.id === edition.sel);
  if (sel) {
    const r = sel.regionImage;
    const coins = { nw: [r.x, r.y], ne: [r.x + r.w, r.y], sw: [r.x, r.y + r.h], se: [r.x + r.w, r.y + r.h] };
    for (const [nom, [cx, cy]] of Object.entries(coins)) {
      if (Math.abs(po.x + cx * po.w - p.x) <= POIGNEE && Math.abs(po.y + cy * po.h - p.y) <= POIGNEE) return { o: sel, poignee: nom };
    }
  }
  const f = enFraction(p, po);
  let meilleure = null;
  for (const o of cases) {
    const r = o.regionImage;
    if (f.x >= r.x && f.x <= r.x + r.w && f.y >= r.y && f.y <= r.y + r.h
      && (!meilleure || r.w * r.h < meilleure.regionImage.w * meilleure.regionImage.h)) meilleure = o;
  }
  return meilleure ? { o: meilleure, poignee: 'deplacer' } : null;
}

/** Le curseur à montrer en survol, ou null hors édition. */
export function curseurEdition(p){
  if (!editionDesCasesActive()) return null;
  const t = cible(p, pose());
  if (!t) return 'crosshair';
  return t.poignee === 'deplacer' ? 'move' : (t.poignee === 'nw' || t.poignee === 'se' ? 'nwse-resize' : 'nesw-resize');
}

/** Le début d'un geste sur la Planche (bouton gauche). Rend true s'il est pris. */
export function debutGesteEdition(p){
  if (!editionDesCasesActive()) return false;
  const po = pose();
  const t = cible(p, po);
  if (t) {
    edition.sel = t.o.id;
    edition.geste = { o: t.o, poignee: t.poignee, depart: enFraction(p, po), r0: { ...t.o.regionImage }, pris: false };
  } else {
    // Un clic hors de toute Case désélectionne (demandé). On ne trace plus au bouton gauche : une
    // Case se crée au clic droit, et seulement ainsi.
    edition.sel = null;
    surbrillance = null;
  }
  return true;
}

export function mouvementGesteEdition(p){
  if (!editionDesCasesActive() || !edition.geste) return false;
  const g = edition.geste;
  const f = enFraction(p, pose());
  const dx = f.x - g.depart.x, dy = f.y - g.depart.y;
  if (!g.pris) { if (Math.abs(dx) < 0.002 && Math.abs(dy) < 0.002) return true; _rappels.snapshot(); g.pris = true; }
  g.o.regionImage = retoucherRegion(g.r0, g.poignee, dx, dy) || g.r0;
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
  await preloadImagesFor(pd.objects);
  // Elle s'ouvre directement en correction des Cases.
  entrerEditionDesCases();
}

