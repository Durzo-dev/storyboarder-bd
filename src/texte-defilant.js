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

/**
 * UNE LISTE DÉROULANTE NE DÉFILE PAS (signalé : le format d'un Tome dépassait sans défiler). Un
 * <select> natif n'a ni `scrollLeft` ni `scrollWidth` utilisables : son texte affiché n'est pas dans
 * le DOM. On le mesure donc (police calculée), et s'il dépasse la place laissée par la flèche, un
 * calque reprend ce texte par-dessus le temps du survol (le select passe en texte transparent) et
 * c'est lui qui défile. Le clic traverse le calque (`pointer-events:none`) et ouvre la liste.
 */
const PLACE_FLECHE = 22;   // px laissés à la flèche d'un <select> (style.css : padding droit)
let mesureur = null;
function largeurDuTexte(texte, police){
  mesureur = mesureur || document.createElement('canvas').getContext('2d');
  mesureur.font = police;
  return mesureur.measureText(texte).width;
}
function calqueDuSelect(sel){
  const option = sel.options[sel.selectedIndex];
  if (!option) return null;
  const cs = getComputedStyle(sel);
  const gauche = parseFloat(cs.paddingLeft) || 0;
  const place = sel.clientWidth - gauche - Math.max(parseFloat(cs.paddingRight) || 0, PLACE_FLECHE);
  // Police écrite en entier : `cs.font` peut revenir vide, et le canevas mesurerait alors en 10 px.
  const police = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  if (largeurDuTexte(option.text, police) <= place + 1) return null;
  const r = sel.getBoundingClientRect();
  const calque = document.createElement('span');
  calque.className = 'texte-defile-calque';
  calque.textContent = option.text;
  Object.assign(calque.style, {
    left: `${r.left + (parseFloat(cs.borderLeftWidth) || 0) + gauche}px`, top: `${r.top}px`,
    width: `${place}px`, height: `${r.height}px`, font: police, color: cs.color,
  });
  document.body.appendChild(calque);
  sel.classList.add('texte-defile-voile');
  return calque;
}

// `actif` : l'élément survolé ; `defile` : celui qui défile (le même, le <selectedcontent> d'une
// liste riche, ou le calque d'une liste native) ; `calque` : vrai si `defile` est un calque.
let actif = null, defile = null, calque = false, depart = 0, image = 0;

function arreter(){
  if (!actif) return;
  cancelAnimationFrame(image);
  if (calque) { defile.remove(); actif.classList.remove('texte-defile-voile'); }
  else { defile.scrollLeft = 0; defile.classList.remove('texte-defile'); }
  actif = defile = null; calque = false;
}

function avancer(maintenant){
  if (!defile) return;
  defile.scrollLeft = positionDuDefilement(maintenant - depart, defile.scrollWidth - defile.clientWidth);
  image = requestAnimationFrame(avancer);
}

export function installerTexteDefilant(doc = document){
  const reduit = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  doc.addEventListener('mouseover', (e) => {
    // D'un enfant à l'autre du même texte (le « — format » est un <small>) : il continue. Sans ce
    // test, l'élément actif, passé en coupe nette, ne serait plus reconnu et repartirait de zéro.
    if (actif && actif.contains(e.target)) return;
    arreter();
    const sel = e.target.closest && e.target.closest('select');
    if (sel) {
      if (reduit) { const o = sel.options[sel.selectedIndex]; if (o) sel.title = o.text; return; }
      // Liste riche : son texte est dans un <selectedcontent>, un vrai élément qui défile lui-même.
      const contenu = sel.querySelector('selectedcontent');
      if (contenu) {
        if (contenu.scrollWidth <= contenu.clientWidth + 1) return;
        actif = sel; defile = contenu;
        contenu.classList.add('texte-defile');
      } else {
        const c = calqueDuSelect(sel);
        if (!c) return;
        actif = sel; defile = c; calque = true;
      }
    } else {
      const el = elementCoupe(e.target);
      if (!el) return;
      if (reduit) { if (!el.title) el.title = el.textContent.trim(); return; }
      actif = defile = el;
      el.classList.add('texte-defile');
    }
    depart = performance.now();
    image = requestAnimationFrame(avancer);
  });
  doc.addEventListener('mouseout', (e) => {
    if (actif && !(e.relatedTarget && actif.contains(e.relatedTarget))) arreter();
  });
  // Ouvrir la liste, ou changer de choix au clavier : le calque se retire (son texte serait faux).
  doc.addEventListener('mousedown', arreter, true);
  doc.addEventListener('change', arreter, true);
  // Le panneau qui CONTIENT le texte défile et le déplace : on arrête. Aucun autre « scroll » ne
  // compte : le nôtre en émet un à chaque image (il s'arrêtait dès la première, sans que rien ne
  // bouge), et le retour à zéro d'un texte quitté en émet un qui couperait le suivant.
  doc.addEventListener('scroll', (e) => {
    const t = e.target;
    if (actif && t !== defile && typeof t.contains === 'function' && t.contains(actif)) arreter();
  }, true);
}
