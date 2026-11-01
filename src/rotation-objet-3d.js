/**
 * @file rotation-objet-3d.js
 * #463d, TOURNER UN OBJET À LA SOURIS : un seul moteur, celui des articulations de l'Éditeur de modèle
 * (utils.js), pour les Éléments des Cases et des Scènes, et le même que suit déjà le mobilier de
 * l'éditeur de bâtiment. Fonctions PURES.
 *
 * DEUX GESTES, CHOISIS SELON LA VUE (comme une articulation) :
 *   - l'axe se voit DE CÔTÉ (sa projection à l'écran est longue) : GLISSER DROIT, perpendiculaire à
 *     l'axe, à 0,5° par pixel. Vu de face, glisser vers la droite fait tourner la face de l'objet
 *     vers la droite ;
 *   - l'axe pointe vers l'ŒIL (vu de dessus) : un geste CIRCULAIRE autour de l'objet, comme un
 *     bouton rotatif, cumulé d'une image à l'autre (un tour complet sans saut).
 * Ctrl : par 15° ; sinon l'aimant tous les 90° (à moins de 6°), qu'Alt retire ; Maj : cinq fois plus
 * fin. Les angles sont en RADIANS.
 */
import { POSE_DRAG_DEG_PER_PX, pointerSweepAngle3D, accumulateSweepDegrees3D } from './utils.js';
import { angleAimante } from './batiment-mobilier.js';

/** En deçà de cette longueur de projection de l'axe (sur 1), il « pointe vers l'œil ». */
export const AXE_VISIBLE_3D = 0.5;

/**
 * Commence une rotation. `angle` : l'angle de départ ; `pivot`, `pointeur` : à l'écran ; `axe` : la
 * projection de l'axe à l'écran `{ x, y }` (ordonnée vers le BAS, longueur ≤ 1), et `versOeil` s'il
 * pointe vers la caméra.
 */
export function debutDeRotation3D({ angle = 0, pivot, pointeur, axe }){
  const longueur = Math.hypot(axe.x, axe.y);
  return {
    angle0: angle, pivot, p0: pointeur, axe,
    mode: longueur >= AXE_VISIBLE_3D ? 'droit' : 'circulaire',
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
