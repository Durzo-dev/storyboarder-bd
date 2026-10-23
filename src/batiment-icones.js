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

/** Les ouvertures, vues de dessus comme sur un plan d'architecte. */
export const ICONES_OUVERTURE = {
  porte: svg(32, 24, '<path d="M2 20h7M23 20h7" stroke-width="3"/><path d="M9 20V6"/><path d="M9 6a14 14 0 0 1 14 14" stroke-dasharray="2 2"/>'),
  fenetre: svg(32, 24, '<path d="M2 12h7M23 12h7" stroke-width="3"/><path d="M9 10h14M9 14h14"/>'),
  baie: svg(32, 24, '<path d="M2 12h4M26 12h4" stroke-width="3"/><path d="M6 10h12M14 14h12"/>'),
  passage: svg(32, 24, '<path d="M2 12h8M22 12h8" stroke-width="3"/><path d="M10 7v10M22 7v10" stroke-dasharray="2 2"/>'),
};
