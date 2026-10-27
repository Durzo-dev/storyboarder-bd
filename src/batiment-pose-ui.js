/**
 * @file batiment-pose-ui.js
 * « DANS UN BÂTIMENT » (#454e) : depuis la fiche d'un Personnage ou d'un Objet, choisir un bâtiment
 * placé dans la même Case (ou Scène) et y poser l'Élément.
 *
 * « Poser dans ce bâtiment » OUVRE L'ÉDITEUR DE BÂTIMENT (demandé ; l'étage et la pièce s'y
 * choisissent, plus dans la fiche). L'Élément y apparaît là où il est s'il est déjà dans ce bâtiment,
 * sinon au centre de la première pièce du rez-de-chaussée. Il s'y manie comme un meuble (déplacer, tourner, incliner, taille, élévation),
 * et peut changer d'étage ; le bâtiment, lui, ne se touche pas : seul l'outil Sélection est là, et
 * rien d'autre ne se prend. Les autres Éléments de la Case qui sont dans le bâtiment se voient, figés.
 *
 *   - « Valider la position » : la position, l'orientation et la taille reviennent dans les champs
 *     de la fiche, puis la fiche est ENREGISTRÉE (tout ce qu'elle porte, demandé) et se ferme ; la
 *     caméra de la Scène va vers l'Élément.
 *   - « Annuler », la croix ou Échap : rien ne change, la fiche est toujours ouverte au retour.
 *
 * Le bloc est construit ici, une fois par fiche, et glissé à la fin du corps de sa section Position.
 * Il disparaît quand la Case n'a aucun bâtiment où poser quoi que ce soit.
 */
import { estUnBatimentPlace, etagesEtPieces } from './batiment-element.js';
import {
  findOwningPanel, pointDuBatimentPlace3D, pointDansLeBatimentPlace3D, elementCommeMeuble3D, ensureElementWorldPos3D,
  clampPanelDepth3D, centerSceneCameraOnElement,
} from './scene3d.js';
import { centreDuMeuble, hauteurPourLeCentre, fixerAngle } from './batiment-mobilier.js';
import { niveauxTries } from './batiment-niveaux.js';
import { WALL_TYPES, WALL_OPENING_MAGNET_TYPES } from './constants.js';
import { estUneLumiere3D } from './light-source-3d.js';
import { getElementDepth } from './utils.js';

/** Les bâtiments placés où l'on peut poser `obj` : ceux de sa Case, qui ont au moins une pièce. */
export function batimentsOuPoser(obj, page, panel = findOwningPanel(obj, page)){
  return ((page && page.objects) || []).filter(o => estUnBatimentPlace(o) && o !== obj
    && findOwningPanel(o, page) === panel && etagesEtPieces(o.batiment).length);
}

// ── Les orientations : celle d'un Élément (ordre XYZ, comme son rendu) et celle d'un meuble ─────
// (ordre YXZ, cf. batiment-mobilier.js), dans le repère du bâtiment, lui-même tourné dans la Case.

const quaternion = (x, y, z, ordre) => new globalThis.THREE.Quaternion().setFromEuler(new globalThis.THREE.Euler(x || 0, y || 0, z || 0, ordre));

/** L'orientation d'un Élément de la Case, vue du bâtiment `bEl` : `{ rotY, rotX, rotZ }` d'un meuble. */
export function rotationDansLeBatiment(obj, bEl){
  const q = quaternion(bEl.rotX, bEl.rotY, bEl.rotZ, 'XYZ').invert().multiply(quaternion(obj.rotX, obj.rotY, obj.rotZ, 'XYZ'));
  const e = new globalThis.THREE.Euler().setFromQuaternion(q, 'YXZ');
  return { rotY: e.y, rotX: e.x, rotZ: e.z };
}

/** L'inverse : l'orientation d'un meuble `m` du bâtiment `bEl`, vue de la Case : `{ x, y, z }` (XYZ). */
export function rotationDansLaScene(m, bEl){
  const q = quaternion(bEl.rotX, bEl.rotY, bEl.rotZ, 'XYZ').multiply(quaternion(m.rotX, m.rotY, m.rotZ, 'YXZ'));
  const e = new globalThis.THREE.Euler().setFromQuaternion(q, 'XYZ');
  return { x: e.x, y: e.y, z: e.z };
}

/** Oriente un meuble comme `r` ({ rotY, rotX, rotZ }), par les règles du mobilier (bornes comprises). */
function orienter(m, r){
  fixerAngle(m, 'y', r.rotY); fixerAngle(m, 'x', r.rotX); fixerAngle(m, 'z', r.rotZ);
  if (!m.rotY) m.rotY = 0;
  return m;
}

/** Le centre d'un Élément dans le monde de sa Case : la règle du rendu (cf. _placerElement3D). */
function centreDansLaCase(o, panel){
  const ep = (o.wxFloor === undefined || o.wyFloor === undefined) ? ensureElementWorldPos3D(o, panel) : null;
  return {
    x: o.wxFloor ?? ep.x,
    y: (o.wyFloor ?? ep.y) + (o.roomFloatY || 0),
    z: (o.wzFloor !== undefined) ? o.wzFloor : getElementDepth(o),
  };
}

/** L'emprise d'un bâtiment, en mètres dans son repère (murs, épaisseur comprise). */
function emprise(b){
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const m of b.murs || []) {
    const e = (m.epaisseur || 0.2) / 2;
    for (const p of [m.a, m.b]) { minX = Math.min(minX, p.x - e); maxX = Math.max(maxX, p.x + e); minZ = Math.min(minZ, p.z - e); maxZ = Math.max(maxZ, p.z + e); }
  }
  return { minX, maxX, minZ, maxZ };
}

/** Ce qui, dans la Case, peut se trouver dans un bâtiment et s'y montrer (ni mur, ni lumière, ni dalle…). */
function seMontreDansLeBatiment(o){
  if (o.hidden3d) return false;
  if (o.type === 'perso') return true;
  return o.type === 'objet3d' && !estUnBatimentPlace(o) && !WALL_TYPES.includes(o.objType)
    && !(o.magnetWallId && WALL_OPENING_MAGNET_TYPES.includes(o.objType)) && !estUneLumiere3D(o)
    && !['dalle', 'piscine'].includes(o.objType);
}

/**
 * Un Élément de la Case vu comme un meuble du bâtiment `bat` (placé `bEl`), à SA place : son centre
 * ramené dans le repère du bâtiment, au niveau sous ses pieds, son orientation. Null s'il n'est pas
 * dans le bâtiment (hors de son emprise, ou plus bas que son sol, ou plus haut que son toit).
 */
function meubleASaPlace(o, rep, { id, bat, bEl, panel }){
  const { minX, maxX, minZ, maxZ } = emprise(bat);
  const tries = niveauxTries(bat);
  if (!tries.length) return null;
  const haut = Math.max(...tries.map(n => (n.elevation || 0) + (n.hauteur || 3))) + 0.5;
  const L = pointDansLeBatimentPlace3D(bEl, panel, centreDansLaCase(o, panel));
  if (L.x < minX || L.x > maxX || L.z < minZ || L.z > maxZ || L.y < -0.5 || L.y > haut) return null;
  const m = orienter({ id, modelFile: id, nom: o.name || '', x: L.x, z: L.z, echelle: 1, dims: rep.dims, base: rep.base }, rotationDansLeBatiment(o, bEl));
  const bas = L.y - rep.dims[2] / 2;
  const n = tries.filter(x => (x.elevation || 0) <= bas + 0.1).pop() || tries[0];
  m.niveauId = n.id;
  const y = Math.round(hauteurPourLeCentre(m, n.elevation || 0, L.y) * 1000) / 1000;
  // Posé sur son sol (à 2 cm près) : « Collé au sol », comme un meuble qu'on vient de poser.
  if (Math.abs(y) > 0.02) { m.colle = false; m.y = y; }
  return m;
}

/** La pièce où poser d'abord un Élément qui n'est pas encore dans le bâtiment : la première du rez-de-chaussée. */
export function pieceDeDepart(bat){
  const tries = niveauxTries(bat);
  const pleine = (p, n) => p.niveauId === n.id && p.repere && !p.vide;
  const avecPieces = tries.filter(n => (bat.pieces || []).some(p => pleine(p, n)));
  const rdc = avecPieces.find(n => (n.elevation || 0) >= 0) || avecPieces[0];
  return rdc ? bat.pieces.find(p => pleine(p, rdc)) : null;
}

/**
 * Les autres Éléments de la Case qui sont DANS le bâtiment, en meubles figés (demandé : visibles, pas
 * sélectionnables), chacun au niveau sous ses pieds. Ajoutés à `bat.elements`, leurs copies à `copies`.
 */
function ajouterLesVoisins(bat, copies, { obj, bEl, page, panel }){
  for (const o of page.objects) {
    if (o === obj || o.id === obj.id || !seMontreDansLeBatiment(o) || findOwningPanel(o, page) !== panel) continue;
    let rep;
    try { rep = elementCommeMeuble3D(o); } catch (e) { continue; }
    const id = '@v:' + o.id;
    const m = meubleASaPlace(o, rep, { id, bat, bEl, panel });
    if (!m) continue;
    copies.set(id, rep.copie);
    m.fige = true; m.traverse = true;
    bat.elements.push(m);
  }
}

/**
 * Ouvre l'éditeur sur une copie du bâtiment `bEl`, l'Élément `obj` posé au centre de la pièce
 * `pieceId`. `fiche` : ce qu'il faut pour lire et écrire la fiche (cf. preparerPoseDansUnBatiment).
 */
async function ouvrirLaPose({ obj, bEl, page, panel, fiche }){
  const bat = JSON.parse(JSON.stringify(bEl.batiment));
  if (!Array.isArray(bat.elements)) bat.elements = [];
  const rep = elementCommeMeuble3D(obj);
  const copies = new Map();
  const ID = '@pose';
  copies.set(ID, rep.copie);
  // Déjà dans ce bâtiment : là où il est (demandé : rouvrir l'éditeur le retrouve). Sinon, au centre
  // de la première pièce du rez-de-chaussée, son orientation gardée.
  let m = meubleASaPlace(obj, rep, { id: ID, bat, bEl, panel });
  if (!m) {
    const piece = pieceDeDepart(bat);
    if (!piece) return;
    m = orienter({ id: ID, niveauId: piece.niveauId, modelFile: ID, x: piece.repere.x, z: piece.repere.z, echelle: 1, dims: rep.dims, base: rep.base },
      rotationDansLeBatiment(obj, bEl));
  }
  m.nom = obj.name || fiche.nomParDefaut;
  bat.elements.push(m);
  ajouterLesVoisins(bat, copies, { obj, bEl, page, panel });
  const { ouvrirEditeurDeBatiment } = await import('./batiment-editeur-ui.js');
  const modale = fiche.modale();
  modale.classList.add('hidden');
  ouvrirEditeurDeBatiment({ batiment: bat, pose: {
    id: ID, copies,
    annuler: () => modale.classList.remove('hidden'),
    valider: (m, batFinal) => {
      const W = pointDuBatimentPlace3D(bEl, panel, centreDuMeuble(batFinal, m));
      const rot = rotationDansLaScene(m, bEl);
      // La position vient désormais des champs X, Y, Z : un `wyFloor` (celui des murs du traceur)
      // l'emporterait au rendu sur le Y qu'on écrit, et la fiche ne serait plus raccord.
      delete obj.wyFloor;
      fiche.ecrire({ x: W.x, y: W.y, z: clampPanelDepth3D(W.z), rot, hauteur: rep.hauteurReelle(rot, m.echelle || 1) });
      fiche.enregistrer();
      centerSceneCameraOnElement(panel, obj);
    },
  } });
}

function remplir(select, items, garder){
  const avant = garder ? select.value : null;
  select.textContent = '';
  items.forEach(({ id, nom }) => {
    const opt = document.createElement('option');
    opt.value = id; opt.textContent = nom;
    select.appendChild(opt);
  });
  if (avant && items.some(i => i.id === avant)) select.value = avant;
}

/**
 * Installe (au premier appel) et prépare le bloc d'une fiche. `prefixe` : 'persona' ou 'object'
 * (les ids des champs de la fiche en découlent). `versCurseurRotY(rad)` : la valeur du curseur de
 * rotation horizontale (celui du Personnage a sa propre convention). `hauteurActuelle()` : la hauteur
 * réelle enregistrée de l'Élément. `enregistrer()` : le bouton Enregistrer de la fiche.
 */
export function preparerPoseDansUnBatiment({ prefixe, obj, page, traduire, versCurseurRotY, hauteurActuelle, enregistrer }){
  const $ = (id) => document.getElementById(prefixe + id);
  const champX = $('PosXInput');
  if (!champX) return;
  const corps = champX.closest('.modal-section-body');
  let bloc = $('BatimentPose');
  if (!bloc) {
    bloc = document.createElement('div');
    bloc.id = prefixe + 'BatimentPose';
    bloc.className = 'batiment-pose';
    bloc.innerHTML = `
      <label class="modal-field-label"></label>
      <div class="batiment-pose-listes">
        <select data-role="batiment"></select>
      </div>
      <button type="button" class="project-modal-btn nav-btn batiment-pose-btn"></button>`;
    corps.appendChild(bloc);
  }
  const selB = bloc.querySelector('[data-role="batiment"]');
  const bouton = bloc.querySelector('button');
  bloc.querySelector('label').textContent = traduire('In a building', 'Dans un bâtiment');
  bouton.textContent = traduire('Place in this building', 'Poser dans ce bâtiment');
  bouton.title = traduire('Opens the building editor: choose the floor and the place there.', 'Ouvre l\'éditeur de bâtiment : l\'étage et la place s\'y choisissent.');
  selB.title = traduire('Building', 'Bâtiment');
  const panel = obj && page ? findOwningPanel(obj, page) : null;
  const batiments = panel ? batimentsOuPoser(obj, page, panel) : [];
  bloc.style.display = batiments.length ? '' : 'none';
  if (!batiments.length) return;
  const leBatiment = () => batiments.find(b => b.id === selB.value) || batiments[0];
  remplir(selB, batiments.map(b => ({ id: b.id, nom: b.name || traduire('Building', 'Bâtiment') })), true);
  const deg = (r) => (r || 0) * 180 / Math.PI;
  const fiche = {
    nomParDefaut: obj.type === 'perso' ? traduire('Character', 'Personnage') : traduire('Object', 'Objet'),
    modale: () => champX.closest('.modal-overlay') || document.getElementById(prefixe === 'persona' ? 'descModal' : 'objectModal'),
    /** Les valeurs revenues de l'éditeur, dans les champs : la fiche les enregistre comme les siennes. */
    ecrire({ x, y, z, rot, hauteur }){
      // ⚠️ LES VALEURS EXACTES, PAS ARRONDIES (demandé : la fiche raccord avec l'éditeur). Les champs
      // de position les gardent telles quelles ; les curseurs d'orientation sont libérés de leur pas
      // (1°) le temps de l'enregistrement, sans quoi l'Élément tournerait d'une fraction de degré.
      champX.value = String(x);
      $('PosYInput').value = String(y);
      $('DepthInput').value = String(z);
      const aimant = $('GroundMagnetCheckbox');
      if (aimant && aimant.checked) { aimant.checked = false; aimant.dispatchEvent(new window.Event('change', { bubbles: true })); }
      for (const [k, v] of [['RotYInput', versCurseurRotY(rot.y)], ['RotXInput', deg(rot.x)], ['RotZInput', deg(rot.z)]]) {
        $(k).step = 'any'; $(k).value = String(v);
      }
      // La taille : le champ Hauteur quand la fiche l'a, sinon le curseur en %, libéré de son pas
      // (5 %) le temps d'y écrire la valeur exacte.
      const champH = $('HeightField'), h = $('HeightInput'), curseur = $('SizeInput');
      if (champH && champH.style.display !== 'none' && h) h.value = Math.round(hauteur * 100) / 100;
      else if (curseur) {
        const avant = hauteurActuelle();
        if (avant > 0 && Math.abs(hauteur - avant) > 1e-6) { curseur.step = 'any'; curseur.value = String(Number(curseur.value) * hauteur / avant); }
      }
    },
    enregistrer(){
      enregistrer();
      const curseur = $('SizeInput');
      if (curseur) curseur.step = '5';
      ['RotYInput', 'RotXInput', 'RotZInput'].forEach(k => { $(k).step = '1'; });
    },
  };
  bouton.onclick = () => ouvrirLaPose({ obj, bEl: leBatiment(), page, panel, fiche });
}
