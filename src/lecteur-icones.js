/**
 * @file lecteur-icones.js
 * LES PICTOGRAMMES DES RÉGLAGES DU LECTEUR (demandé : « des boutons plus visuels, comme pour
 * l'éditeur de bâtiment »). Même famille que batiment-icones.js : SVG au trait de 1,6, en
 * `currentColor` (gris au repos, orange quand le choix est actif), sans libellé : le nom passe en
 * infobulle et en aria-label. Les pages sont vues de face ; l'écran, quand il compte, est un cadre.
 */

const svg = (corps) => `<svg viewBox="0 0 32 24" width="32" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${corps}</svg>`;
const PLEINE = 'fill="currentColor" fill-opacity=".3"';

/** Une page, ou deux côte à côte. */
export const ICONES_DOUBLE = {
  false: svg('<rect x="11" y="3" width="10" height="18" rx="1"/>'),
  true: svg('<rect x="6" y="3" width="10" height="18" rx="1"/><rect x="16" y="3" width="10" height="18" rx="1"/>'),
};

/** La première page, seule à droite ou à gauche : elle est pleine, sa voisine absente en pointillés. */
export const ICONES_DEBUT = {
  droite: svg(`<rect x="6" y="3" width="10" height="18" rx="1" stroke-dasharray="2 2.4"/><rect x="16" y="3" width="10" height="18" rx="1" ${PLEINE}/>`),
  gauche: svg(`<rect x="6" y="3" width="10" height="18" rx="1" ${PLEINE}/><rect x="16" y="3" width="10" height="18" rx="1" stroke-dasharray="2 2.4"/>`),
};

/** L'ajustement à l'écran (le cadre) : la page entière en hauteur, ou en largeur (elle dépasse). */
export const ICONES_AJUSTEMENT = {
  hauteur: svg(`<rect x="3" y="2" width="26" height="20" rx="1.5" stroke-opacity=".55"/><rect x="11.5" y="4" width="9" height="16" rx=".5" ${PLEINE}/>`),
  largeur: svg(`<rect x="3" y="2" width="26" height="20" rx="1.5" stroke-opacity=".55"/><path d="M5 22V4h22v18" ${PLEINE}/><path d="M9 11h14m-12-2-2 2 2 2m10-4 2 2-2 2"/>`),
};

/** Le sens de lecture : la flèche dit où l'on va, les pages qui défilent dans ce sens. */
export const ICONES_SENS = {
  rtl: svg('<rect x="19" y="5" width="9" height="14" rx="1"/><path d="M15 12H4m4-4-4 4 4 4"/>'),
  ltr: svg('<rect x="4" y="5" width="9" height="14" rx="1"/><path d="M17 12h11m-4-4 4 4-4 4"/>'),
};

/** Vue livre : un album ouvert dont la page de droite se tourne. */
export const ICONE_LIVRE = svg('<path d="M16 6c-3-2-8-2.5-12-1.5v15c4-1 9-.5 12 1.5"/><path d="M16 6v15"/><path d="M16 6c2-1.6 4.5-2.4 7-2.6l1 12.6c-3 .3-6 1.6-8 5"/><path d="M23 3.4c1.6 3 3 7.4 5 9.6" stroke-dasharray="1.6 2"/>');

/** Vue guidée : une planche et ses cases, l'une d'elles en lumière. */
export const ICONE_GUIDE = svg(`<rect x="9" y="2" width="14" height="20" rx="1"/><rect x="11" y="4" width="10" height="6" ${PLEINE}/><path d="M11 12h4v8h-4zM17 12h4v8h-4z"/>`);

/** Le bandeau de miniatures : l'écran (le cadre), et sous lui une rangée de petites pages, l'une en lumière. */
export const ICONE_MINIATURES = svg(`<rect x="3" y="2" width="26" height="13" rx="1.5" stroke-opacity=".55"/><rect x="4" y="17.5" width="5" height="4.5" rx=".5"/><rect x="10.5" y="17.5" width="5" height="4.5" rx=".5" ${PLEINE}/><rect x="17" y="17.5" width="5" height="4.5" rx=".5"/><rect x="23.5" y="17.5" width="5" height="4.5" rx=".5"/>`);
