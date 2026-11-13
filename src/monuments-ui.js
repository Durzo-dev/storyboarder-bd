/**
 * @file monuments-ui.js
 * THE « MONUMENTS FOUND » WINDOW (#475): after a real place's import, its known monuments (monuments.js),
 * each with « Find a 3D model » (the store, on Sketchfab, its name searched, in choice mode: the model chosen
 * and downloaded comes back here) and « Keep the building ». A chosen model takes the monument's place: on
 * its footprint, as high as its building, turned along it; the generated building is hidden, not deleted
 * (Ctrl+Z undoes the whole). Nothing is put in place without the user's choice (decided by Durzo).
 */

import { tr, S } from './state.js';
import { monumentsOf, searchFor, alongFootprint, licenceAccepted } from './monuments.js';
import { ouvrirStore } from './store-ui.js';
import { createModelElement } from './model-store.js';
import { preloadModels, getLoadedModel } from './model-cache.js';
import { encombrementDuBatiment } from './batiment-element.js';
import { placeOnGround } from './real-place-lay.js';
import { enregistrerFermeture } from './modal-stack.js';

const $ = (id) => document.getElementById(id);
let _rappels = { snapshot: () => {}, render: () => {} };
/** The Scene whose monuments are shown. */
let _scene = null;

/** Wired once (events.js): `snapshot()` (an undo step), `render()` (renderAll). */
export function cablerMonuments(rappels){
  _rappels = { ..._rappels, ...rappels };
  $('monumentsClose').onclick = fermer;
  $('monumentsDone').onclick = fermer;
  enregistrerFermeture('monumentsModal', fermer);
  const monumentsModal = $('monumentsModal');
  monumentsModal.addEventListener('mousedown', (e) => { if (e.target === monumentsModal) fermer(); });
}

function fermer(){
  $('monumentsModal').classList.add('hidden');
  _scene = null;
}

const pageOf = (scene) => scene && scene.pages && scene.pages[0];
const panelOf = (scene) => (pageOf(scene) ? pageOf(scene).objects.find(o => o.type === 'panel') : null);

/** After an import: the window, when the Scene holds monuments; nothing otherwise. */
export function proposerMonuments(scene){
  const page = pageOf(scene);
  if (!page || !monumentsOf(page.objects).length) return;
  _scene = scene;
  dessiner();
  $('monumentsModal').classList.remove('hidden');
}

/** One row per monument still shown; the window closes by itself when none is left. */
function dessiner(){
  const page = pageOf(_scene);
  const liste = monumentsOf(page ? page.objects : []);
  if (!liste.length) { fermer(); return; }
  $('monumentsListe').replaceChildren(...liste.map(o => {
    const ligne = document.createElement('div');
    ligne.className = 'monument-ligne';
    const nom = document.createElement('span');
    nom.className = 'monument-nom';
    nom.textContent = o.monument.name;
    const chercher = document.createElement('button');
    chercher.type = 'button'; chercher.className = 'nav-btn';
    chercher.textContent = tr('Find a 3D model', 'Chercher un modèle 3D');
    chercher.onclick = () => choisirUnModele(o);
    const garder = document.createElement('button');
    garder.type = 'button'; garder.className = 'nav-btn';
    garder.textContent = tr('Keep the building', 'Garder le bâtiment');
    garder.onclick = () => { delete o.monument; S.projectDirty = true; dessiner(); };
    ligne.append(nom, chercher, garder);
    return ligne;
  }));
}

/** The store on Sketchfab, the monument's name searched; the model chosen comes back to replaceBuilding. */
function choisirUnModele(o){
  const scene = _scene;
  $('monumentsModal').classList.add('hidden');
  ouvrirStore({
    onglet: 'sketchfab',
    texte: searchFor(o.monument),
    choisir: async (fichier) => {
      await remplacerLeBatiment(scene, o, fichier);
      _scene = scene;
      dessiner();
      if (monumentsOf(pageOf(scene).objects).length) $('monumentsModal').classList.remove('hidden');
    },
    accepter: (e) => !e.batiment && !e.introuvable,
    licence: licenceAccepted,
  });
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
  placeOnGround(el, panel, o.wxFloor || 0, o.wzFloor || 0);
  page.objects.push(el);
  o.hidden3d = true;
  S.projectDirty = true;
  _rappels.render();
  return el;
}
