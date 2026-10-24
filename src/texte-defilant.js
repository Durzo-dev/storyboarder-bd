/**
 * @file texte-defilant.js
 * LE TEXTE COUPÉ DÉFILE AU SURVOL (demandé le 24 octobre 2026). Une ligne qui doit tenir sur une
 * ligne (le nom d'un Tome suivi de son format, un nom d'Élément…) se coupe avec « … » plutôt que de
 * passer à la ligne et de grossir sa rangée. Au survol, le texte défile jusqu'au bout pour se lire
 * en entier, marque une pause, revient, et recommence tant que la souris reste dessus.
 *
 * Rien à poser élément par élément : tout élément dont le CSS dit `text-overflow: ellipsis` ET dont
 * le texte déborde vraiment en profite (délégation sur le document). Le défilement passe par
 * `scrollLeft` (l'élément est déjà en `overflow:hidden`) ; la classe `.texte-defile` remplace le
 * « … » par une coupe nette le temps du défilement, sans quoi il resterait collé au bord droit.
 *
 * `prefers-reduced-motion` : pas d'animation, le texte complet passe en infobulle.
 */

/** Vitesse de défilement (px/s), attente avant de partir et pause à chaque bout (ms). */
export const DEFILEMENT = { vitesse: 45, attente: 500, pause: 1000 };

/**
 * Où en est le défilement `t` ms après le survol, pour un débordement de `debord` px : un aller,
 * une pause, un retour, une pause, en boucle. Pure, pour être testée.
 */
export function positionDuDefilement(t, debord, { vitesse, attente, pause } = DEFILEMENT){
  if (debord <= 0 || t <= attente) return 0;
  const trajet = debord / vitesse * 1000;
  const cycle = 2 * (trajet + pause);
  const u = (t - attente) % cycle;
  if (u < trajet) return debord * u / trajet;
  if (u < trajet + pause) return debord;
  if (u < 2 * trajet + pause) return debord * (1 - (u - trajet - pause) / trajet);
  return 0;
}

/** L'élément coupé par « … » qui contient `cible` (lui-même ou un parent proche), s'il déborde. */
function elementCoupe(cible){
  for (let el = cible, n = 0; el && el.nodeType === 1 && n < 4; el = el.parentElement, n++) {
    if (getComputedStyle(el).textOverflow === 'ellipsis') return el.scrollWidth > el.clientWidth + 1 ? el : null;
  }
  return null;
}

let actif = null, depart = 0, image = 0;

function arreter(){
  if (!actif) return;
  cancelAnimationFrame(image);
  actif.scrollLeft = 0;
  actif.classList.remove('texte-defile');
  actif = null;
}

function avancer(maintenant){
  if (!actif) return;
  actif.scrollLeft = positionDuDefilement(maintenant - depart, actif.scrollWidth - actif.clientWidth);
  image = requestAnimationFrame(avancer);
}

export function installerTexteDefilant(doc = document){
  const reduit = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  doc.addEventListener('mouseover', (e) => {
    // D'un enfant à l'autre du même texte (le « — format » est un <small>) : il continue. Sans ce
    // test, l'élément actif, passé en coupe nette, ne serait plus reconnu et repartirait de zéro.
    if (actif && actif.contains(e.target)) return;
    const el = elementCoupe(e.target);
    if (el === actif) return;
    arreter();
    if (!el) return;
    if (reduit) { if (!el.title) el.title = el.textContent.trim(); return; }
    actif = el; depart = performance.now();
    el.classList.add('texte-defile');
    image = requestAnimationFrame(avancer);
  });
  doc.addEventListener('mouseout', (e) => {
    if (actif && !(e.relatedTarget && actif.contains(e.relatedTarget))) arreter();
  });
}
