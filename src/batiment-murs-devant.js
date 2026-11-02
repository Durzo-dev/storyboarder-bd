/**
 * @file batiment-murs-devant.js
 * #459b, LES MURS DE DEVANT (décidé avec Valentin le 2 novembre 2026) : comme les « murs découpés »
 * des Sims, les murs ENTRE LA CAMÉRA ET L'INTÉRIEUR d'un bâtiment s'effacent seuls, et reviennent quand
 * la caméra tourne. Deux rendus au choix : ABAISSÉS (un muret de 50 cm, le plan reste lisible) ou
 * MASQUÉS. Visibles par défaut. Réglé par Case (`o.affichage.mursDevant`, champ AJOUTÉ) et dans
 * l'aperçu de l'éditeur de bâtiment.
 *
 * Un mur est « de devant » si, à son niveau, il est du côté de la caméra (son milieu plus près d'elle
 * que le centre du niveau) et que sa face la REGARDE (sa normale à moins de 45° de la direction de la
 * caméra, ramenée à l'horizontale). Les murs du fond et des côtés restent : ce sont eux qu'on filme.
 * Fonctions PURES, sauf la mémoire du calcul (une WeakMap, jamais enregistrée).
 */

/** Les rendus, dans l'ordre de la liste. */
export const MODES_MURS_DEVANT = Object.freeze(['visibles', 'abaisses', 'masques']);
/** La hauteur d'un mur abaissé, en mètres. */
export const HAUTEUR_MUR_ABAISSE = 0.5;
/** Une face « regarde » la caméra à moins de 45° (le cosinus). */
const FACE_VERS_LA_CAMERA = Math.cos(Math.PI / 4) - 1e-6;   // 45° compris

/** Le rendu des murs de devant d'un bâtiment placé : 'visibles' à défaut. */
export function modeMursDevant(o){
  const m = o && o.affichage && o.affichage.mursDevant;
  return MODES_MURS_DEVANT.includes(m) ? m : 'visibles';
}

/** Règle le rendu ; « visibles » retire le champ (rien à enregistrer pour le défaut). */
export function fixerMursDevant(o, mode){
  const a = { ...(o.affichage || {}) };
  if (mode && mode !== 'visibles' && MODES_MURS_DEVANT.includes(mode)) a.mursDevant = mode; else delete a.mursDevant;
  if (Object.keys(a).length) o.affichage = a; else delete o.affichage;
  return o;
}

/**
 * Les ids des murs de devant, pour une caméra vue du bâtiment dans la direction `vers` ({ x, z }, dans
 * le repère du bâtiment ; normée ici). Vide si la caméra est à la verticale (rien n'est « devant »).
 */
export function mursDeDevant(b, vers){
  const l = Math.hypot((vers && vers.x) || 0, (vers && vers.z) || 0);
  if (!b || l < 1e-3) return [];
  const v = { x: vers.x / l, z: vers.z / l };
  const parNiveau = new Map();
  for (const m of b.murs || []) {
    if (!parNiveau.has(m.niveauId)) parNiveau.set(m.niveauId, []);
    parNiveau.get(m.niveauId).push(m);
  }
  const ids = [];
  for (const murs of parNiveau.values()) {
    const centre = murs.reduce((c, m) => ({ x: c.x + (m.a.x + m.b.x) / 2 / murs.length, z: c.z + (m.a.z + m.b.z) / 2 / murs.length }), { x: 0, z: 0 });
    for (const m of murs) {
      const dx = m.b.x - m.a.x, dz = m.b.z - m.a.z, L = Math.hypot(dx, dz) || 1;
      const face = Math.abs((-dz * v.x + dx * v.z) / L) >= FACE_VERS_LA_CAMERA;
      const milieu = { x: (m.a.x + m.b.x) / 2, z: (m.a.z + m.b.z) / 2 };
      const devant = (milieu.x - centre.x) * v.x + (milieu.z - centre.z) * v.z > 0.05;
      if (face && devant) ids.push(m.id);
    }
  }
  return ids.sort();
}

/**
 * La direction de la caméra vue du bâtiment, dans SON repère : la direction monde `versMonde` ({x, z},
 * du bâtiment vers la caméra) tournée de −`rotY` (le lacet du bâtiment placé). PURE.
 */
export function versLaCameraDansLeBatiment(versMonde, rotY = 0){
  const c = Math.cos(rotY), s = Math.sin(rotY);
  return { x: versMonde.x * c - versMonde.z * s, z: versMonde.x * s + versMonde.z * c };
}

// La mémoire du dernier calcul, par bâtiment placé : la signature du rig la lit (il n'est refait que
// quand la liste change, pas à chaque image), sa construction l'applique.
const _retenus = new WeakMap();
/** Retient `{ mode, ids }` pour cet Élément (null : rien d'effacé). */
export function retenirMursDevant(o, valeur){ if (o) { if (valeur && valeur.ids.length) _retenus.set(o, valeur); else _retenus.delete(o); } }
/** Ce qui a été retenu pour cet Élément, ou null. */
export const mursDevantRetenus = (o) => (o && _retenus.get(o)) || null;
