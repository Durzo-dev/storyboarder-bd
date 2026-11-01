/**
 * @file commandes-3d.js
 * #463f, LES COMMANDES D'UNE CASE ET D'UNE SCÈNE (demandé) : la section « Commandes » en tête du menu
 * de droite, comme celles des éditeurs, qui dit à chaque instant ce que font les gestes. Une ligne
 * par geste (« Geste : effet. »). Fonction PURE : `tr(en, fr)` est donné.
 *
 * `contexte` :
 *   - `ecran` : 'case' (une Case, hors mode Caméra), 'camera' (le mode Caméra d'une Case) ou
 *     'scene' (le canevas d'une Scène, dont la caméra est toujours active) ;
 *   - `element` : 'perso' | 'objet' si un Personnage ou un Objet est choisi (et se tourne), sinon null ;
 *   - `plateau` : vrai si le geste de rotation actif est le plateau tournant (caméra de face), faux
 *     pour le bouton rotatif (de biais ou de dessus) ;
 *   - `axe` : l'axe bloqué sur le repère de la caméra ('y', 'x' ou null).
 */
export function commandesDuMenu3D({ ecran = 'case', element = null, plateau = false, axe = null } = {}, tr){
  const l = [];
  if (ecran === 'camera' || ecran === 'scene') {
    l.push(axe === 'y' ? tr('Left drag: turn the view (horizontally only, Y is locked).', 'Glisser gauche : tourner la vue (à l\'horizontale seulement, Y est bloqué).')
      : axe === 'x' ? tr('Left drag: turn the view (vertically only, X is locked).', 'Glisser gauche : tourner la vue (à la verticale seulement, X est bloqué).')
        : tr('Left drag: turn the view.', 'Glisser gauche : tourner la vue.'));
    l.push(ecran === 'camera'
      ? tr('Right drag (or Ctrl + drag, or middle button): move the view.', 'Glisser droit (ou Ctrl + glisser, ou bouton du milieu) : déplacer la vue.')
      : tr('Right drag: move the view.', 'Glisser droit : déplacer la vue.'));
    l.push(tr('Wheel: move forward or back (Ctrl + wheel, even with an Element selected).', 'Molette : avancer ou reculer (Ctrl + molette, même un Élément choisi).'));
    l.push(tr('Arrows or W A S D: move the view.', 'Flèches ou W A S D : déplacer la vue.'));
    l.push(tr('Axes: click Y or X to turn around it only.', 'Repère : cliquer Y ou X pour ne tourner que sur lui.'));
  }
  if (element) {
    l.push(tr('Drag the selected Element: move it.', 'Tirer l\'Élément choisi : le déplacer.'));
    l.push(tr('Wheel over it: bring it closer or further (Shift: finer).', 'Molette : le rapprocher ou l\'éloigner (Maj : plus fin).'));
    l.push(plateau
      ? tr('Right button held on it, left / right: turn it (seen from the front).', 'Clic droit maintenu dessus, gauche / droite : le tourner (vu de face).')
      : tr('Right button held on it, circling around: turn it (seen from above).', 'Clic droit maintenu dessus, en tournant autour : le tourner (vu de dessus).'));
    l.push(tr('It snaps every 90° (Ctrl: by 15°, Alt: free).', 'Il s\'aimante tous les 90° (Ctrl : par 15°, Alt : libre).'));
    l.push(tr('R: a quarter turn.', 'R : un quart de tour.'));
    l.push(tr('Double-click: its window.', 'Double-clic : sa fenêtre.'));
  } else if (ecran === 'case') {
    l.push(tr('Click an Element in the list: select it.', 'Clic sur un Élément de la liste : le choisir.'));
    l.push(tr('Right-click the panel: its menu (Add, Camera…).', 'Clic droit sur la Case : son menu (Ajouter, Caméra…).'));
  }
  if (ecran === 'case') l.push(tr('C: Camera mode.', 'C : mode Caméra.'));
  if (ecran === 'camera') l.push(tr('C or the cross: leave Camera mode.', 'C ou la croix : sortir du mode Caméra.'));
  if (ecran === 'scene') l.push(tr('T: top-down view.', 'T : vue de dessus.'));
  l.push(tr('F: centre the view on the selected Element.', 'F : centrer la vue sur l\'Élément choisi.'));
  if (element) l.push(tr('Del: delete it. Esc: deselect.', 'Suppr : le supprimer. Échap : désélectionner.'));
  return l;
}
