/**
 * @file batiment-icones.js
 * LES PICTOGRAMMES DES RÉGLAGES de l'éditeur de bâtiment (demandé : « plus d'icônes visuelles que de
 * boutons texte »). Des SVG au trait, en `currentColor` : ils prennent la couleur du bouton, gris au
 * repos, orange quand le choix est actif. Vus DE DESSUS comme le plan, sauf les marches (de profil :
 * c'est là que pleines et ouvertes se distinguent).
 */

const svg = (l, h, corps) => `<svg viewBox="0 0 ${l} ${h}" width="${l}" height="${h}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${corps}</svg>`;
const marches = (x, y, l, h, pas) => {
  let d = '';
  for (let v = y + pas; v < y + h - 1; v += pas) d += `M${x} ${v}h${l}`;
  return `<rect x="${x}" y="${y}" width="${l}" height="${h}"/><path d="${d}"/>`;
};

/** Les formes d'escalier, vues de dessus : les volées striées de marches, les paliers lisses. */
export const ICONES_TYPE_ESCALIER = {
  droit: svg(32, 32, marches(10, 3, 12, 26, 5)),
  L: svg(32, 32, '<path d="M4 29V3h25v9H13v17z"/><path d="M4 12h9M13 3v9"/><path d="M4 17h9M4 21h9M4 25h9M18 3v9M23 3v9"/>'),
  U: svg(32, 32, '<path d="M3 29V3h26v26h-8V12H11v17z"/><path d="M3 12h8M21 12h8"/><path d="M3 17h8M3 21h8M3 25h8M21 17h8M21 21h8M21 25h8"/>'),
};

/** Le côté où tourne un escalier en L ou en U : une flèche coudée. */
export const ICONES_SENS_ESCALIER = {
  1: svg(24, 24, '<path d="M16 21V10a3 3 0 0 0-3-3H6m3-3-3 3 3 3"/>'),
  '-1': svg(24, 24, '<path d="M8 21V10a3 3 0 0 1 3-3h7m-3-3 3 3-3 3"/>'),
};

/** La rampe : le même escalier, un trait épais du côté de la rampe. */
const rampe = (gauche, droite) => svg(24, 24, `${marches(8, 2, 8, 20, 5)}${gauche ? '<path d="M4 2v20" stroke-width="2.6"/>' : ''}${droite ? '<path d="M20 2v20" stroke-width="2.6"/>' : ''}`);
export const ICONES_RAMPE = {
  aucune: rampe(false, false),
  gauche: rampe(true, false),
  droite: rampe(false, true),
  deux: rampe(true, true),
};

/** Les marches, de profil : pleines (contremarches) ou ouvertes (les seules marches). */
export const ICONES_MARCHES = {
  true: svg(32, 22, '<path d="M3 19h7v-5h7V9h7V4h5v15z" fill="currentColor" fill-opacity=".25"/>'),
  false: svg(32, 22, '<path d="M3 19h7M10 14h7M17 9h7M24 4h5" stroke-width="2.4"/><path d="M3 21 29 3" stroke-width="1.1"/>'),
};

/** Les ouvertures, vues DE FACE (demandé : plus parlant que le symbole du plan), posées sur le sol. */
export const ICONES_OUVERTURE = {
  // Une porte : un panneau haut, sa poignée.
  porte: svg(32, 28, '<path d="M2 26h28"/><rect x="10" y="3" width="12" height="23"/><path d="M19 15v1.5" stroke-width="2"/>'),
  // Une fenêtre : à mi-hauteur, deux carreaux et son appui.
  fenetre: svg(32, 28, '<path d="M2 26h28"/><rect x="9" y="5" width="14" height="12"/><path d="M16 5v12M9 11h14M7 19h18"/>'),
  // Une baie vitrée : large, du sol presque au plafond, deux vantaux qui coulissent.
  baie: svg(32, 28, '<path d="M2 26h28"/><rect x="4" y="4" width="24" height="22"/><path d="M16 4v22M9 15h4m-1.5-1.5L13 15l-1.5 1.5M23 15h-4m1.5-1.5L19 15l1.5 1.5"/>'),
  // Un passage : l'encadrement seul, sans rien dedans.
  passage: svg(32, 28, '<path d="M2 26h28"/><path d="M10 26V3h12v23" stroke-width="2.2"/>'),
};

/** Comment l'ouverture s'ouvre, de face : un battant, deux, ou deux vantaux qui coulissent. */
export const ICONES_MANOEUVRE = {
  1: svg(32, 28, '<path d="M2 26h28"/><rect x="9" y="3" width="14" height="23"/><path d="M20 13v3" stroke-width="2"/>'),
  2: svg(32, 28, '<path d="M2 26h28"/><rect x="5" y="3" width="22" height="23"/><path d="M16 3v23"/><path d="M13.5 13v3M18.5 13v3" stroke-width="2"/>'),
  coulissant: svg(32, 28, '<path d="M2 26h28"/><rect x="4" y="3" width="14" height="23"/><rect x="14" y="5" width="14" height="21"/><path d="M7 14h6m-2-2 2 2-2 2"/>'),
};

/** Le remplissage d'une porte, de face : pleine, ou vitrée. */
export const ICONES_REMPLISSAGE = {
  pleine: svg(32, 28, '<path d="M2 26h28"/><rect x="9" y="3" width="14" height="23" fill="currentColor" fill-opacity=".25"/><path d="M20 13v3" stroke-width="2"/>'),
  vitree: svg(32, 28, '<path d="M2 26h28"/><rect x="9" y="3" width="14" height="23"/><rect x="12" y="6" width="8" height="12"/><path d="M14 10l2-2M14 14l4-4"/>'),
};

/** Le dessus d'un passage, de face : droit, ou en arche. */
export const ICONES_DESSUS = {
  droit: svg(32, 28, '<path d="M2 26h28"/><path d="M10 26V3h12v23" stroke-width="2.2"/>'),
  arche: svg(32, 28, '<path d="M2 26h28"/><path d="M10 26V11a6 6 0 0 1 12 0v15" stroke-width="2.2"/>'),
};

/** Les deux gestes d'une porte battante, vus de dessus : changer de côté, changer de charnière. */
export const ICONES_INVERSER = {
  cote: svg(32, 30, '<path d="M2 14h8M22 14h8" stroke-width="3"/><path d="M10 14V4"/><path d="M10 4a10 10 0 0 1 10 10" stroke-dasharray="2 2"/><path d="M16 18v9m-3-3 3 3 3-3"/>'),
  charniere: svg(32, 30, '<path d="M2 14h8M22 14h8" stroke-width="3"/><path d="M10 14V4"/><path d="M10 4a10 10 0 0 1 10 10" stroke-dasharray="2 2"/><path d="M9 24h14m-3-3 3 3-3 3M12 21l-3 3 3 3"/>'),
};
