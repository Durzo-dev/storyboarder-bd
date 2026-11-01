/**
 * @file rotation-objet-3d.js
 * #463d, TOURNER UN OBJET À LA SOURIS : un seul moteur, celui des articulations de l'Éditeur de modèle
 * (utils.js), pour les Éléments des Cases et des Scènes, et le même que suit déjà le mobilier de
 * l'éditeur de bâtiment. Fonctions PURES.
 *
 * LE GESTE DÉPEND DE LA CAMÉRA, choisi au DÉBUT du geste et gardé jusqu'au relâchement (décidé avec
 * Valentin, comme les articulations : en ligne vu de côté, rotatif vu par la pointe de l'axe) :
 *   - caméra DE FACE ou presque (elle plonge de moins de 45°, `PLONGEE_PLATEAU_3D`) : un PLATEAU
 *     TOURNANT, glisser à gauche ou à droite, à 0,5° par pixel ; vers la droite, la face de l'objet
 *     tourne vers la droite. De face, le plan de rotation est vu par la tranche : tourner la souris
 *     autour de l'objet n'y correspond à rien de visible ;
 *   - caméra DE BIAIS OU DE DESSUS : un BOUTON ROTATIF, l'angle que la souris parcourt AUTOUR de
 *     l'objet à l'écran, cumulé d'une image à l'autre (un tour complet sans saut ; le glisser en ligne
 *     s'y inversait à mi-tour, signalé). Le principe du mobilier du bâtiment, toujours vu de dessus.
 * Ctrl : par 15° ; sinon l'aimant tous les 90° (à moins de 6°), qu'Alt retire ; Maj : cinq fois plus
 * fin. Les angles sont en RADIANS.
 */
import { POSE_DRAG_DEG_PER_PX, pointerSweepAngle3D, accumulateSweepDegrees3D } from './utils.js';
import { angleAimante } from './batiment-mobilier.js';

/** En deçà de cette plongée de la caméra (radians), le plateau tournant ; au-delà, le bouton rotatif. */
export const PLONGEE_PLATEAU_3D = 45 * Math.PI / 180;   // 30° d'abord, 45° demandé à l'essai

/**
 * Le geste pour une caméra qui plonge de `plongee` radians (vers le bas, positif ; une caméra en
 * contre-plongée compte par sa valeur absolue). PURE.
 */
export function modeSelonLaCamera3D(plongee){
  return Math.abs(plongee || 0) < PLONGEE_PLATEAU_3D ? 'droit' : 'circulaire';
}

/**
 * Commence une rotation. `angle` : l'angle de départ ; `pivot`, `pointeur` : à l'écran ; `axe` : la
 * projection de l'axe à l'écran `{ x, y }` (ordonnée vers le BAS, longueur ≤ 1), et `versOeil` s'il
 * pointe vers la caméra.
 */
export function debutDeRotation3D({ angle = 0, pivot, pointeur, axe, mode = 'circulaire' }){
  const longueur = Math.hypot(axe.x, axe.y);
  return {
    angle0: angle, pivot, p0: pointeur, axe,
    mode, longueur,
    balaye: 0, angleSouris: pointerSweepAngle3D(pivot, pointeur),
  };
}

/** L'angle (radians) pour ce pointeur ; met à jour la session (le balayage cumulé). */
export function angleDeRotation3D(s, pointeur, { ctrl = false, alt = false, maj = false } = {}){
  const fin = maj ? 0.2 : 1;
  let deg;
  if (s.mode === 'droit') {
    // Perpendiculaire à l'axe projeté : pour un axe vertical vu de face, vers la droite.
    const l = Math.hypot(s.axe.x, s.axe.y) || 1;
    const dir = { x: -s.axe.y / l, y: s.axe.x / l };
    deg = ((pointeur.x - s.p0.x) * dir.x + (pointeur.y - s.p0.y) * dir.y) * POSE_DRAG_DEG_PER_PX;
  } else {
    const a = pointerSweepAngle3D(s.pivot, pointeur);
    if (a !== null) { s.balaye = accumulateSweepDegrees3D(s.balaye, s.angleSouris, a); s.angleSouris = a; }
    // Le balayage est positif dans le sens horaire à l'écran ; vu du côté où l'axe pointe, c'est
    // tourner en sens inverse (une rotation positive est anti-horaire vue depuis la pointe de l'axe).
    deg = s.axe.versOeil ? -s.balaye : s.balaye;
  }
  return angleAimante(s.angle0 + deg * fin * Math.PI / 180, { pas: ctrl ? Math.PI / 12 : 0, libre: alt });
}

/** Un quart de tour (R), dans le sens horaire vu de dessus, comme le mobilier. */
export const quartDeTour3D = (angle) => {
  let a = (angle || 0) - Math.PI / 2;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
};
