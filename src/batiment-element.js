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
 * Le point où poser un Élément dans une pièce, dans le repère du bâtiment (mètres) : son `repere`
 * (un point intérieur, cf. batiment-pieces.js, juste même pour une pièce en L) au niveau de son
 * sol (le sol est dessiné 5 mm au-dessus de l'élévation, cf. batiment-3d.js). Null si la pièce
 * n'existe pas. PURE.
 */
export function pointDeLaPiece(b, pieceId){
  const p = ((b && b.pieces) || []).find(x => x.id === pieceId);
  if (!p || !p.repere) return null;
  const n = (b.niveaux || []).find(x => x.id === p.niveauId);
  return { x: p.repere.x, y: (n ? n.elevation || 0 : 0) + 0.005, z: p.repere.z };
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
