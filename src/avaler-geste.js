/**
 * @file src/avaler-geste.js
 * LE CLIC QUI FERME UNE FENÊTRE FLOTTANTE S'ARRÊTE LÀ (signalé deux fois : fermer le store de
 * textures ou le sélecteur de couleur d'un clic à côté fermait AUSSI le menu de la Case).
 *
 * Une fenêtre flottante se ferme à l'APPUI (pointerdown, mousedown) ; le reste du geste — le
 * relâchement, le clic — tombait alors sur ce qu'il y avait dessous, la Planche, dont les gestes
 * le prenaient pour un clic dans le vide : désélection, et le menu de la Case se fermait.
 *
 * `avalerLaSuiteDuGeste()` arrête, avant tout le monde (capture sur la fenêtre), le relâchement et
 * le clic qui suivent, une fois. Si rien ne suit (le geste a été annulé), elle se retire d'elle-même.
 */
const SUITE = ['pointerup', 'mouseup', 'click', 'dblclick', 'contextmenu'];

export function avalerLaSuiteDuGeste(){
  if (typeof window === 'undefined') return;
  const arreter = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.type === 'click' || e.type === 'contextmenu') retirer();
  };
  const retirer = () => { clearTimeout(minuterie); for (const t of SUITE) window.removeEventListener(t, arreter, true); };
  for (const t of SUITE) window.addEventListener(t, arreter, true);
  // Un appui sans clic (glissé hors de la fenêtre, touche relâchée ailleurs) ne doit pas laisser
  // le prochain clic de l'utilisateur avalé.
  const minuterie = setTimeout(retirer, 800);
}
