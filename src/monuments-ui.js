/**
 * @file monuments-ui.js
 * A KNOWN MONUMENT'S MODEL (#475): laid in its place (`remplacerLeBatiment`: on the footprint, as high as
 * the generated building, turned along it; the building hidden, not deleted), as « New scene »'s last step
 * decides (real-place-ui.js); and, from the model's sheet, another model chosen or the building restored.
 * Nothing is put in place without the user's choice (decided by Durzo).
 */

import { S } from './state.js';
import { searchFor, alongFootprint, licenceAccepted } from './monuments.js';
import { ouvrirStore } from './store-ui.js';
import { createModelElement } from './model-store.js';
import { preloadModels, getLoadedModel } from './model-cache.js';
import { encombrementDuBatiment } from './batiment-element.js';
import { placeOnGround } from './real-place-lay.js';
import { reviewQuery } from './realistic-models.js';

const $ = (id) => document.getElementById(id);
let _rappels = { snapshot: () => {}, render: () => {} };

/** Wired once (events.js): `snapshot()` (an undo step), `render()` (renderAll). */
export function cablerMonuments(rappels){
  _rappels = { ..._rappels, ...rappels };
  // A monument's model, from its Element's sheet (#475, asked): changed, or the building restored.
  $('objectMonumentChange').onclick = () => depuisLaFiche(changerLeModele);
  $('objectMonumentRestore').onclick = () => depuisLaFiche(retablirLeBatiment);
}

const pageOf = (scene) => scene && scene.pages && scene.pages[0];
const panelOf = (scene) => (pageOf(scene) ? pageOf(scene).objects.find(o => o.type === 'panel') : null);

/**
 * The store on Sketchfab, a monument's name searched, in choice mode: `quandChoisi(fichier)` once a model is
 * chosen and downloaded (a « no derivatives » licence refused).
 */
export function chercherUnModele(monument, quandChoisi){
  ouvrirStore({
    onglet: 'sketchfab',
    texte: searchFor(monument),
    choisir: quandChoisi,
    accepter: (e) => !e.batiment && !e.introuvable,
    licence: licenceAccepted,
  });
}

// ── The review's models (#480d): replaced or removed, on « Finish » ────────────────────────────────

/** « Replace » a model of the review: the store on Sketchfab, on its use's search (what you have shows first). */
export function chercherUnModeleDUsage(usage, quandChoisi){
  ouvrirStore({ onglet: 'sketchfab', texte: reviewQuery(usage), choisir: quandChoisi, accepter: (e) => !e.batiment && !e.introuvable });
}

/** The place's credits without the line of a model the review took away (its name, as the import wrote it). */
function sansSonCredit(panel, nom){
  if (!panel || !Array.isArray(panel.creditsDuLieu) || !nom) return;
  panel.creditsDuLieu = panel.creditsDuLieu.filter(l => !l.includes(`« ${nom} »`) && !l.includes(`"${nom}"`));
}

/**
 * THE REVIEW'S CHOICES, LAID (« Finish »), in one undo step: `choix` maps a model file to `{ retirer: true }` (its
 * objects become their built-in object again, at their place and turn) or `{ fichier }` (another model, each object
 * keeping its place, turn and height). Its credit line goes; a new model is credited by the export's own list.
 */
export async function appliquerLaRevue(scene, rows, choix){
  const page = pageOf(scene), panel = panelOf(scene);
  if (!page || !panel || !choix || !choix.size) return 0;
  const nouveaux = [...choix.values()].map(c => c.fichier).filter(Boolean);
  if (nouveaux.length) await preloadModels(nouveaux);
  _rappels.snapshot();
  const view = { w: scene.w, h: scene.h, scale: scene.scale, format: scene.format, style3d: scene.style3d, objects: page.objects };
  let n = 0;
  for (const row of rows) {
    const c = choix.get(row.fichier);
    if (!c) continue;
    sansSonCredit(panel, row.nom);
    for (const o of page.objects.filter(x => x.modelFile === row.fichier && x.usage)) {
      if (c.fichier) {
        const m = getLoadedModel(c.fichier);
        o.modelFile = c.fichier;
        o.name = c.fichier.replace(/\.glb$/i, '');
        if (m && m.ratioLargeur > 0) { o.w = o.h * m.ratioLargeur; o.baseW = o.w; }
      } else if (_rappels.newObject) {
        const b = _rappels.newObject(panel, view, o.usage);
        if (Number.isFinite(o.rotY)) b.rotY = o.rotY;
        placeOnGround(b, panel, o.wxFloor || 0, o.wzFloor || 0);
        page.objects.splice(page.objects.indexOf(o), 1, b);
      }
      n++;
    }
  }
  S.projectDirty = true;
  _rappels.render();
  return n;
}

/** A ground floor's outline, in the building's own frame. */
function contour(b){
  const sol = b.niveaux.reduce((p, q) => (q.elevation < p.elevation ? q : p));
  return b.murs.filter(m => m.niveauId === sol.id).map(m => ({ x: m.a.x, z: m.a.z }));
}

/**
 * THE MODEL IN THE MONUMENT'S PLACE: an Element of the model, as high as the generated building, turned
 * along its footprint, at its place on the ground; the building hidden (`hidden3d`), its monument kept.
 * One undo step.
 */
export async function remplacerLeBatiment(scene, o, fichier){
  const page = pageOf(scene), panel = panelOf(scene);
  if (!page || !panel || !page.objects.includes(o)) return null;
  await preloadModels([fichier]);
  const m = getLoadedModel(fichier);
  _rappels.snapshot();
  const view = { w: scene.w, h: scene.h, scale: scene.scale, format: scene.format, style3d: scene.style3d, objects: page.objects };
  const el = createModelElement({ panel, page: view, modelFile: fichier, name: o.monument.name,
    realHeightM: encombrementDuBatiment(o.batiment).hauteur, ratioLargeur: m ? m.ratioLargeur : undefined });
  el.rotY = alongFootprint(contour(o.batiment));
  // Its monument and building: its sheet changes the model, or restores the building.
  el.monument = { ...o.monument };
  el.monumentDe = o.id;
  placeOnGround(el, panel, o.wxFloor || 0, o.wzFloor || 0);
  page.objects.push(el);
  o.hidden3d = true;
  S.projectDirty = true;
  _rappels.render();
  return el;
}

// ── From a monument's model, in the Scene (its sheet) ────────────────────────────────────────────

/** The Scene page holding an object, and the object, from its id. */
function trouver(id){
  for (const sc of S.scenes || []) {
    const page = pageOf(sc);
    const o = page && page.objects.find(x => x.id === id);
    if (o) return { scene: sc, page, o };
  }
  return null;
}

/** The sheet's object (modals.js sets the field's `data-id`), the sheet closed, then `faire`. */
function depuisLaFiche(faire){
  const id = $('objectMonumentField').dataset.id;
  const t = id && trouver(id);
  if (!t) return;
  $('objectModalCancel').click();
  faire(t);
}

/** Another model for the monument: the store on Sketchfab again; the Element keeps its place, turn and height. */
function changerLeModele({ o }){
  chercherUnModele(o.monument, async (fichier) => {
    await preloadModels([fichier]);
    const m = getLoadedModel(fichier);
    _rappels.snapshot();
    o.modelFile = fichier;
    if (m && m.ratioLargeur > 0) { o.w = o.h * m.ratioLargeur; o.baseW = o.w; }
    S.projectDirty = true;
    _rappels.render();
  });
}

/** The generated building back, the model removed (one undo step). */
function retablirLeBatiment({ page, o }){
  const b = page.objects.find(x => x.id === o.monumentDe);
  _rappels.snapshot();
  page.objects.splice(page.objects.indexOf(o), 1);
  if (b) delete b.hidden3d;
  S.projectDirty = true;
  _rappels.render();
}
