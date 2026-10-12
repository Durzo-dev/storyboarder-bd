/**
 * @file import-planche-ui.js
 * « Importer une planche » (clic droit sur une Planche, demandé le 12 octobre 2026) : choisir une
 * image, VÉRIFIER les Cases détectées, puis créer la Planche importée juste après celle du clic.
 *
 * Les décisions sont dans planche-importee.js (détection, retouches, ordre de lecture, forme de la
 * Planche) ; ici le sélecteur, le décodage, la modale de vérification et ses gestes.
 *
 * ⚠️ RIEN N'EST ÉCRIT AVANT LA VALIDATION : ni la Planche, ni l'image dans le dossier Images.
 * Renoncer (Annuler, Échap, clic dehors) laisse le Projet et le disque tels qu'ils étaient.
 *
 * LES GESTES DE LA VÉRIFICATION : un clic sur une Case la sélectionne ; la tirer la déplace ; tirer
 * un coin la redimensionne ; tirer dans le vide en trace une nouvelle ; Suppr (ou le bouton)
 * supprime la sélection. Le curseur de tolérance relance la détection, et REMPLACE les retouches :
 * c'est dit dans l'aide.
 */

import { S, tr, newId } from './state.js';
import { choisirImage, rangerImageChoisie } from './image-store.js';
import { preloadImagesFor } from './image-cache.js';
import {
  detecterCases, niveauxDeGris, ordreDeLecture, retoucherRegion, regionTracee, creerPlancheImportee, DETECTION,
} from './planche-importee.js';

const $ = (id) => document.getElementById(id);

/** La plus grande dimension de l'image ANALYSÉE : au-delà, la détection ralentit sans rien gagner. */
const ANALYSE_MAX_PX = 1400;
/** La distance, en pixels d'écran, à laquelle un coin se saisit. */
const POIGNEE_PX = 9;

let _rappels = { snapshot: () => {}, renderAll: () => {}, alerter: async () => {} };
/** Les rappels de events.js (règle n°2 : pas d'import circulaire). */
export function setImportPlancheCallbacks(r){ _rappels = { ..._rappels, ...r }; }

let etat = null;   // { ti, pi, choisi, bitmap, gris, aw, ah, regions, sel, geste, echelle }

/** Ferme la modale sans rien créer. */
export function fermerImportPlanche(){
  const m = $('importPlancheModal');
  if (m) m.classList.add('hidden');
  if (etat && etat.bitmap && etat.bitmap.close) etat.bitmap.close();
  etat = null;
}

function textes(){
  $('importPlancheTitre').textContent = tr('Import a page', 'Importer une planche');
  $('importPlancheAide').textContent = tr(
    'Check the detected panels before importing. Drag a panel to move it, a corner to resize it, drag in an empty area to add one; Delete removes the selected panel. Changing the sensitivity detects again and replaces your changes.',
    'Vérifiez les Cases détectées avant d\'importer. Tirez une Case pour la déplacer, un coin pour la redimensionner, tirez dans le vide pour en ajouter une ; Suppr retire la Case sélectionnée. Changer la sensibilité relance la détection et remplace vos retouches.');
  $('importPlancheToleranceLabel').textContent = tr('Sensitivity', 'Sensibilité');
  $('importPlancheSupprimer').textContent = tr('Remove the panel', 'Retirer la Case');
  $('importPlancheAnnuler').textContent = tr('Cancel', 'Annuler');
  $('importPlancheValider').textContent = tr('Import the page', 'Importer la planche');
}

function majCompte(){
  const n = etat.regions.length;
  $('importPlancheCompte').textContent = n
    ? tr(`${n} panel(s)`, `${n} Case(s)`)
    : tr('No panel: the whole image will be one panel.', 'Aucune Case : l\'image entière en fera une.');
  $('importPlancheSupprimer').disabled = etat.sel === null;
}

/** Relance la détection avec la tolérance du curseur. */
function detecter(){
  const tolerance = Number($('importPlancheTolerance').value) || DETECTION.tolerance;
  etat.regions = detecterCases(etat.gris, etat.aw, etat.ah, { tolerance });
  etat.sel = null;
  majCompte();
  dessiner();
}

/** La toile, à la taille de la zone, l'image entière dedans. */
function dimensionner(){
  const toile = $('importPlancheToile');
  const zone = toile.parentElement;
  const maxW = Math.max(200, (zone.clientWidth || 816) - 16);   // moins le padding de la zone
  const maxH = Math.max(200, Math.round(window.innerHeight * 0.6));
  const e = Math.min(maxW / etat.bitmap.width, maxH / etat.bitmap.height);
  const w = Math.round(etat.bitmap.width * e), h = Math.round(etat.bitmap.height * e);
  const dpr = window.devicePixelRatio || 1;
  toile.width = Math.round(w * dpr); toile.height = Math.round(h * dpr);
  toile.style.width = `${w}px`; toile.style.height = `${h}px`;
  etat.vue = { w, h, dpr };
}

function dessiner(){
  if (!etat) return;
  const toile = $('importPlancheToile');
  const c = toile.getContext('2d');
  const { w, h, dpr } = etat.vue;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  c.drawImage(etat.bitmap, 0, 0, w, h);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#FF7A45';
  etat.regions.forEach((r, i) => {
    const x = r.x * w, y = r.y * h, rw = r.w * w, rh = r.h * h;
    const choisie = i === etat.sel;
    c.lineWidth = choisie ? 3 : 2;
    c.strokeStyle = accent;
    c.setLineDash(choisie ? [] : [6, 4]);
    c.strokeRect(x + 1, y + 1, rw - 2, rh - 2);
    c.setLineDash([]);
    // Le numéro, dans une pastille pleine : lisible sur n'importe quel dessin.
    c.font = '600 12px system-ui, sans-serif';
    const t = String(i + 1);
    const lw = c.measureText(t).width + 10;
    c.fillStyle = accent; c.fillRect(x + 4, y + 4, lw, 18);
    c.fillStyle = '#FFFFFF'; c.textBaseline = 'middle'; c.fillText(t, x + 9, y + 13);
    if (choisie) {
      [[x, y], [x + rw, y], [x, y + rh], [x + rw, y + rh]].forEach(([px, py]) => {
        c.fillStyle = accent; c.fillRect(px - 5, py - 5, 10, 10);
      });
    }
  });
  if (etat.geste && etat.geste.trace) {
    const r = regionTracee(etat.geste.depart, etat.geste.courant);
    if (r) { c.strokeStyle = accent; c.lineWidth = 2; c.strokeRect(r.x * w, r.y * h, r.w * w, r.h * h); }
  }
}

/** Un point de la toile, en fractions de l'image. */
function fraction(e){
  const b = $('importPlancheToile').getBoundingClientRect();
  return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height };
}

/** Ce qui est sous le pointeur : un coin de la Case sélectionnée, une Case, ou rien. */
function cible(p){
  const { w, h } = etat.vue;
  if (etat.sel !== null) {
    const r = etat.regions[etat.sel];
    const coins = { nw: [r.x, r.y], ne: [r.x + r.w, r.y], sw: [r.x, r.y + r.h], se: [r.x + r.w, r.y + r.h] };
    for (const [nom, [cx, cy]] of Object.entries(coins)) {
      if (Math.abs((p.x - cx) * w) <= POIGNEE_PX && Math.abs((p.y - cy) * h) <= POIGNEE_PX) return { i: etat.sel, poignee: nom };
    }
  }
  // La plus PETITE Case sous le pointeur : une Case tracée dans une autre doit rester saisissable.
  let meilleure = null;
  etat.regions.forEach((r, i) => {
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
      && (meilleure === null || r.w * r.h < etat.regions[meilleure].w * etat.regions[meilleure].h)) meilleure = i;
  });
  return meilleure === null ? null : { i: meilleure, poignee: 'deplacer' };
}

function cabler(){
  const modale = document.getElementById('importPlancheModal');
  if (!modale || modale.dataset.cable) return;
  modale.dataset.cable = '1';
  // Clic en dehors : on renonce, comme Annuler (convention de toutes les modales).
  modale.addEventListener('mousedown', (e) => { if (e.target === modale) fermerImportPlanche(); });
  $('importPlancheAnnuler').onclick = fermerImportPlanche;
  $('importPlancheValider').onclick = valider;
  $('importPlancheSupprimer').onclick = supprimerSelection;
  $('importPlancheTolerance').addEventListener('change', () => { if (etat) detecter(); });
  const toile = $('importPlancheToile');
  toile.addEventListener('mousedown', (e) => {
    if (!etat || e.button !== 0) return;
    e.preventDefault();
    const p = fraction(e);
    const t = cible(p);
    if (t) {
      etat.sel = t.i;
      etat.geste = { i: t.i, poignee: t.poignee, depart: p, r0: { ...etat.regions[t.i] } };
    } else {
      etat.sel = null;
      etat.geste = { trace: true, depart: p, courant: p };
    }
    majCompte();
    dessiner();
  });
  window.addEventListener('mousemove', (e) => {
    if (!etat || !etat.geste) return;
    const p = fraction(e);
    const g = etat.geste;
    if (g.trace) g.courant = p;
    else etat.regions[g.i] = retoucherRegion(g.r0, g.poignee, p.x - g.depart.x, p.y - g.depart.y) || g.r0;
    dessiner();
  });
  window.addEventListener('mouseup', () => {
    if (!etat || !etat.geste) return;
    const g = etat.geste;
    etat.geste = null;
    if (g.trace) {
      const r = regionTracee(g.depart, g.courant);
      if (r) { etat.regions.push(r); etat.sel = etat.regions.length - 1; }
    }
    majCompte();
    dessiner();
  });
  // ⚠️ EN CAPTURE, ET IL S'ARRÊTE LÀ : sans cela, Suppr atteindrait aussi l'écouteur du canevas
  // (events.js), qui supprimerait l'objet sélectionné SUR LA PLANCHE, derrière la modale.
  window.addEventListener('keydown', (e) => {
    if (!etat || modale.classList.contains('hidden')) return;
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    supprimerSelection();
  }, true);
  window.addEventListener('resize', () => { if (etat) { dimensionner(); dessiner(); } });
}

function supprimerSelection(){
  if (!etat || etat.sel === null) return;
  etat.regions.splice(etat.sel, 1);
  etat.sel = null;
  majCompte();
  dessiner();
}

/** L'image décodée, et sa version réduite en niveaux de gris pour la détection. */
async function decoder(octets){
  const bitmap = await createImageBitmap(new Blob([octets]));
  const e = Math.min(1, ANALYSE_MAX_PX / Math.max(bitmap.width, bitmap.height));
  const aw = Math.max(1, Math.round(bitmap.width * e)), ah = Math.max(1, Math.round(bitmap.height * e));
  const toile = document.createElement('canvas');
  toile.width = aw; toile.height = ah;
  const c = toile.getContext('2d', { willReadFrequently: true });
  c.drawImage(bitmap, 0, 0, aw, ah);
  return { bitmap, aw, ah, gris: niveauxDeGris(c.getImageData(0, 0, aw, ah).data, aw, ah) };
}

/** Le point d'entrée : clic droit sur la Planche `pi` du Tome `ti`, entrée « Importer une planche ». */
export async function ouvrirImportPlanche(ti, pi){
  cabler();
  const choisi = await choisirImage();
  if (choisi.canceled) return;
  if (!choisi.ok) { await _rappels.alerter(tr(`The image could not be read: ${choisi.error}`, `L'image n'a pas pu être lue : ${choisi.error}`)); return; }
  let d;
  try { d = await decoder(choisi.data); }
  catch (err) { await _rappels.alerter(tr('This file is not an image the application can read.', 'Ce fichier n\'est pas une image que l\'application sait lire.')); return; }
  etat = { ti, pi, choisi, ...d, regions: [], sel: null, geste: null };
  textes();
  $('importPlancheTolerance').value = String(DETECTION.tolerance);
  $('importPlancheModal').classList.remove('hidden');
  dimensionner();
  detecter();
}

/** Valider : l'image rangée, la Planche créée après celle du clic, et affichée. */
async function valider(){
  if (!etat) return;
  const { ti, pi, choisi, bitmap } = etat;
  const t = S.tomes[ti];
  if (!t) { fermerImportPlanche(); return; }
  const range = await rangerImageChoisie(choisi);
  if (!range.ok) { await _rappels.alerter(tr(`The image could not be saved: ${range.error}`, `L'image n'a pas pu être rangée : ${range.error}`)); return; }
  const pd = creerPlancheImportee({
    nomImage: range.name, largeur: bitmap.width, hauteur: bitmap.height,
    regions: ordreDeLecture(etat.regions), newId,
  });
  // Elle rejoint le chapitre de la Planche cliquée, juste après elle.
  const voisine = t.pages[pi];
  if (voisine && voisine.chapitreId) pd.chapitreId = voisine.chapitreId;
  fermerImportPlanche();
  _rappels.snapshot();
  t.pages.splice(pi + 1, 0, pd);
  S.currentTomeIndex = ti;
  S.currentPageIndex = pi + 1;
  S.selectedId = null; S.selectedRoomId = null;
  S.projectDirty = true;
  preloadImagesFor(pd.objects);
  _rappels.renderAll();
}
