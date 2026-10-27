/**
 * @file batiment-element.js
 * LE BÂTIMENT PLACÉ dans une Case ou une Scène (#454a-4). Fonctions PURES.
 *
 * Un Élément `type: 'objet3d'`, `objType: 'batiment'` (une valeur de discriminant AJOUTÉE, rien de
 * renommé), qui EMBARQUE son bâtiment (`batiment`, la forme de batiment.js) : c'est la COPIE
 * INDÉPENDANTE décidée avec Valentin. Retoucher le fichier de la bibliothèque ne change pas les
 * bâtiments déjà placés ; « Modifier » sur un bâtiment placé retouche sa copie, et seulement elle.
 *
 * Il hérite du reste d'un objet 3D ordinaire : la position, la rotation, l'aimantation au Sol, la
 * ligne du menu de droite. Sa hauteur réelle (`realHeightFloor`) est celle du bâtiment : le rendu
 * normalise le rig sur elle, ce qui le laisse à l'échelle 1 (le bâtiment est déjà en mètres).
 */
import { WALL_PX_PER_UNIT_3D } from './constants.js';
import { newId } from './state.js';
import { clamp } from './utils.js';
import { hauteurDesMursDuNiveau, niveauxTries } from './batiment-niveaux.js';
import { hauteurDesToits } from './batiment-toits.js';

/** Le discriminant persisté. */
export const OBJ_TYPE_BATIMENT = 'batiment';

/** Cet Élément est-il un bâtiment placé ? */
export function estUnBatimentPlace(o){
  return !!o && o.type === 'objet3d' && o.objType === OBJ_TYPE_BATIMENT && !!o.batiment;
}

/**
 * L'encombrement d'un bâtiment, en mètres : sa hauteur (le haut du plus haut mur, toit plat compris,
 * c'est-à-dire exactement ce que dessine batiment-3d.js : le rendu s'y normalise), sa largeur (en x)
 * et sa profondeur (en z). Un bâtiment sans mur mesure 1 m en tout, pour rester visible et sélectionnable.
 */
export function encombrementDuBatiment(b){
  const murs = (b && b.murs) || [];
  if (!murs.length) return { hauteur: 1, largeur: 1, profondeur: 1 };
  const niveaux = new Map((b.niveaux || []).map(n => [n.id, n]));
  let haut = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const m of murs) {
    const n = niveaux.get(m.niveauId);
    haut = Math.max(haut, (n ? n.elevation : 0) + (m.hauteurPropre || hauteurDesMursDuNiveau(b, m.niveauId)));
    const e = m.epaisseur / 2;
    for (const p of [m.a, m.b]) {
      minX = Math.min(minX, p.x - e); maxX = Math.max(maxX, p.x + e);
      minZ = Math.min(minZ, p.z - e); maxZ = Math.max(maxZ, p.z + e);
    }
  }
  // #458 : le toit compte (le rendu se normalise sur la boîte du rig : un toit oublié le rétrécirait).
  haut = Math.max(haut, hauteurDesToits(b));
  return { hauteur: Math.max(0.1, haut), largeur: Math.max(0.1, maxX - minX), profondeur: Math.max(0.1, maxZ - minZ) };
}

/** Les dimensions 2D de l'Élément (en px de Planche), d'après l'encombrement, bornées par la page. */
function cadre2D(b, page){
  const { hauteur, largeur } = encombrementDuBatiment(b);
  const h = clamp(hauteur * WALL_PX_PER_UNIT_3D, 2, page.h * 0.95);
  const w = clamp(largeur * WALL_PX_PER_UNIT_3D, 2, page.w * 0.95);
  return { w, h, realH: hauteur };
}

/**
 * L'Élément d'un bâtiment posé au centre de la Case `panel` (ou du canevas d'une Scène). Le
 * bâtiment est COPIÉ ; `source` : le fichier de la bibliothèque d'où il vient, s'il en vient. Fonction PURE : l'appelant le range dans la Page et finalise sa création.
 */
export function creerElementBatiment({ panel, page, batiment, source = null }){
  const { w, h, realH } = cadre2D(batiment, page);
  const o = {
    id: newId(), type: 'objet3d', objType: OBJ_TYPE_BATIMENT,
    batiment: JSON.parse(JSON.stringify(batiment)),
    x: clamp(panel.x + panel.w / 2 - w / 2, 0, page.w - w),
    y: clamp(panel.y + panel.h / 2 - h / 2, 0, page.h - h),
    w, h, baseW: w, baseH: h, z: 0,
    name: (batiment && batiment.nom) || 'Bâtiment',
    rotX: 0, rotY: 0, rotZ: 0,
    realHeightFloor: realH,
    magnetGround: true,
    homePanelId: panel.id,
  };
  // #454a-4b : placé depuis la bibliothèque, il garde le nom du fichier d'où il vient (informatif :
  // sa fiche dit où il sert). Une copie reste une copie : rien ne le relie au fichier pour la suite.
  if (source) o.batimentSource = source;
  return o;
}

/**
 * Remplace le bâtiment d'un Élément déjà placé (« Modifier », puis « Appliquer les modifications ») : sa
 * copie, son nom, sa hauteur réelle et son cadre 2D, recentré sur l'ancien. Sa position monde, sa
 * rotation et son aimantation ne bougent pas.
 */
export function appliquerBatiment(o, batiment, page){
  const { w, h, realH } = cadre2D(batiment, page);
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  Object.assign(o, {
    batiment: JSON.parse(JSON.stringify(batiment)),
    name: batiment.nom || o.name,
    realHeightFloor: realH,
    w, h, baseW: w, baseH: h,
    x: clamp(cx - w / 2, 0, page.w - w), y: clamp(cy - h / 2, 0, page.h - h),
  });
  return o;
}

/**
 * La signature d'un bâtiment, pour le cache des rigs : elle change dès que le bâtiment change, et
 * le rig se reconstruit. Un hachage du texte (FNV-1a), pas le texte entier : la clé se compare à
 * chaque rendu.
 */
export function signatureDuBatiment(b){
  const t = JSON.stringify(b || null);
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${t.length}:${(h >>> 0).toString(16)}`;
}

/**
 * La signature de la STRUCTURE d'un bâtiment, son nom mis à part (demandé : savoir si un bâtiment
 * est déjà dans la bibliothèque d'après ce qu'il est, pas d'après son nom). Deux bâtiments qui ne
 * diffèrent que par le nom ont la même.
 */
export function signatureDeStructure(b){
  if (!b) return signatureDuBatiment(b);
  const { nom: _nom, ...reste } = b;
  void _nom;
  return signatureDuBatiment(reste);
}

/**
 * Les étages d'un bâtiment et leurs pièces, du plus bas au plus haut, pour choisir où poser un
 * Élément (#454e) : `[{ id, nom, elevation, pieces: [{ id, nom }] }]`. Un étage sans pièce fermée
 * n'y figure pas (on ne pose rien dans une pièce qui n'existe pas). PURE.
 */
export function etagesEtPieces(b){
  if (!b) return [];
  return niveauxTries(b).map(n => ({
    id: n.id, nom: n.nom, elevation: n.elevation || 0,
    pieces: (b.pieces || []).filter(p => p.niveauId === n.id && p.repere).map(p => ({ id: p.id, nom: p.nom })),
  })).filter(n => n.pieces.length);
}

/**
 * L'AFFICHAGE d'un bâtiment placé (#459a) : ce que montre SA Case, sans toucher au bâtiment.
 * `o.affichage = { jusquA }` (un champ AJOUTÉ, absent par défaut : tout est montré) :
 *   - `jusquA` : l'id du dernier niveau montré, ouvert par le haut (sans son plafond ni la dalle du
 *     dessus), comme la coupe de l'éditeur ; les niveaux au-dessus disparaissent.
 * Il vit sur l'Élément placé, donc par Case : « Modifier » et la bibliothèque n'en héritent pas.
 */

/** Le niveau où couper, s'il existe encore dans le bâtiment (un niveau supprimé ne coupe plus rien). PURE. */
export function niveauDeCoupe(o){
  const id = o && o.affichage && o.affichage.jusquA;
  return id && ((o.batiment && o.batiment.niveaux) || []).some(n => n.id === id) ? id : null;
}

/**
 * Ce que la Case ne montre pas de ce bâtiment (#464) : `{ murs, plafonds, sols }`, des ids qui
 * existent ENCORE (un mur supprimé par « Modifier » ne masque plus rien), ou null s'il n'y a rien.
 * `o.affichage.masques` est un champ AJOUTÉ. PURE.
 */
export function masquesDe(o){
  const m = o && o.affichage && o.affichage.masques;
  if (!m || !o.batiment) return null;
  const murs = new Set((o.batiment.murs || []).map(x => x.id));
  const pieces = new Set((o.batiment.pieces || []).map(x => x.id));
  const r = {
    murs: (m.murs || []).filter(id => murs.has(id)),
    plafonds: (m.plafonds || []).filter(id => pieces.has(id)),
    sols: (m.sols || []).filter(id => pieces.has(id)),
  };
  return r.murs.length || r.plafonds.length || r.sols.length ? r : null;
}

/** Pose les masques (`null` ou vides : tout réafficher). Le champ disparaît quand il ne dit rien. PURE. */
export function fixerMasques(o, m){
  const a = { ...(o.affichage || {}) };
  const propre = m && {
    murs: [...new Set(m.murs || [])], plafonds: [...new Set(m.plafonds || [])], sols: [...new Set(m.sols || [])],
  };
  if (propre && (propre.murs.length || propre.plafonds.length || propre.sols.length)) a.masques = propre;
  else delete a.masques;
  if (Object.keys(a).length) o.affichage = a; else delete o.affichage;
  return o;
}

/** « 2 murs, 1 plafond » : le résumé des masques, ou '' s'il n'y en a pas. PURE. */
export function resumeDesMasques(m, traduire){
  if (!m) return '';
  const n = (k, un, plusieurs) => (k ? `${k} ${k > 1 ? plusieurs : un}` : '');
  return [
    n(m.murs.length, traduire('wall', 'mur'), traduire('walls', 'murs')),
    n(m.plafonds.length, traduire('ceiling', 'plafond'), traduire('ceilings', 'plafonds')),
    n(m.sols.length, traduire('floor', 'sol'), traduire('floors', 'sols')),
  ].filter(Boolean).join(', ');
}

/** Coupe au niveau `id`, ou montre tout (`null`). Le champ disparaît quand il ne dit plus rien. PURE. */
export function fixerCoupe(o, id){
  const a = { ...(o.affichage || {}) };
  if (id) a.jusquA = id; else delete a.jusquA;
  if (Object.keys(a).length) o.affichage = a; else delete o.affichage;
  return o;
}

/**
 * Remet la hauteur réelle d'un bâtiment placé d'accord avec son bâtiment (#454b : les murs montent
 * désormais à travers le toit plat). Le rendu normalise le rig sur `realHeightFloor` : un écart le
 * rétrécirait. Rend vrai si quelque chose a changé.
 */
export function recalerHauteurDuBatimentPlace(o){
  if (!estUnBatimentPlace(o)) return false;
  const h = encombrementDuBatiment(o.batiment).hauteur;
  if (Math.abs((o.realHeightFloor || 0) - h) < 1e-6) return false;
  const k = o.realHeightFloor > 0 ? h / o.realHeightFloor : 1;
  o.realHeightFloor = h;
  if (o.h > 0) { o.h *= k; o.baseH = o.h; }
  return true;
}
