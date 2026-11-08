/**
 * @file batiment-murs-devant.js
 * #459b, LES MURS DE DEVANT (décidé avec Durzo le 2 novembre 2026) : comme les « murs découpés »
 * des Sims, les murs ENTRE LA CAMÉRA ET L'INTÉRIEUR d'un bâtiment s'effacent seuls, et reviennent quand
 * la caméra tourne : pour cadrer une Case DANS un bâtiment sans que ces murs gênent. Ils sont MASQUÉS
 * (le rendu « abaissé en muret », essayé d'abord, a été retiré : sans usage). Visibles par défaut.
 * Réglé par Case (`o.affichage.mursDevant = 'masques'`, champ AJOUTÉ) et dans l'aperçu de l'éditeur.
 *
 * Un mur est « de devant » si, à son niveau, il est du côté de la caméra (son milieu plus près d'elle
 * que le centre du niveau) et que sa face la REGARDE (sa normale à moins de 45° de la direction de la
 * caméra, ramenée à l'horizontale). Les murs du fond et des côtés restent : ce sont eux qu'on filme.
 * Fonctions PURES, sauf la mémoire du calcul (une WeakMap, jamais enregistrée).
 */

/** Une face « regarde » la caméra à moins de 45° (le cosinus). */
const FACE_VERS_LA_CAMERA = Math.cos(Math.PI / 4) - 1e-6;   // 45° compris

/** Les murs de devant de ce bâtiment placé sont-ils masqués ? (« abaisses », de la 1.15.3, l'est aussi.) */
export function mursDevantMasques(o){
  const m = o && o.affichage && o.affichage.mursDevant;
  return m === 'masques' || m === 'abaisses';
}

/** Masque ou réaffiche ; réafficher retire le champ (rien à enregistrer pour le défaut). */
export function fixerMursDevantMasques(o, oui){
  const a = { ...(o.affichage || {}) };
  if (oui) a.mursDevant = 'masques'; else delete a.mursDevant;
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
/** Retient les ids masqués pour cet Élément (null ou vide : rien d'effacé). */
export function retenirMursDevant(o, ids){ if (o) { if (ids && ids.length) _retenus.set(o, ids); else _retenus.delete(o); } }
/** Les ids retenus pour cet Élément, ou null. */
export const mursDevantRetenus = (o) => (o && _retenus.get(o)) || null;
