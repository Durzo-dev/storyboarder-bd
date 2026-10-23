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
import { hauteurDuMur } from './batiment-ouvertures.js';

/** Le discriminant persisté. */
export const OBJ_TYPE_BATIMENT = 'batiment';

/** Cet Élément est-il un bâtiment placé ? */
export function estUnBatimentPlace(o){
  return !!o && o.type === 'objet3d' && o.objType === OBJ_TYPE_BATIMENT && !!o.batiment;
}

/**
 * L'encombrement d'un bâtiment, en mètres : sa hauteur (le haut du plus haut mur), sa largeur (en x)
 * et sa profondeur (en z). Un bâtiment sans mur mesure 1 m en tout, pour rester visible et sélectionnable.
 */
export function encombrementDuBatiment(b){
  const murs = (b && b.murs) || [];
  if (!murs.length) return { hauteur: 1, largeur: 1, profondeur: 1 };
  const niveaux = new Map((b.niveaux || []).map(n => [n.id, n]));
  let haut = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const m of murs) {
    const n = niveaux.get(m.niveauId);
    haut = Math.max(haut, (n ? n.elevation : 0) + hauteurDuMur(b, m));
    const e = m.epaisseur / 2;
    for (const p of [m.a, m.b]) {
      minX = Math.min(minX, p.x - e); maxX = Math.max(maxX, p.x + e);
      minZ = Math.min(minZ, p.z - e); maxZ = Math.max(maxZ, p.z + e);
    }
  }
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
 * bâtiment est COPIÉ. Fonction PURE : l'appelant le range dans la Page et finalise sa création.
 */
export function creerElementBatiment({ panel, page, batiment }){
  const { w, h, realH } = cadre2D(batiment, page);
  return {
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
}

/**
 * Remplace le bâtiment d'un Élément déjà placé (« Modifier », puis « Appliquer à la scène ») : sa
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
