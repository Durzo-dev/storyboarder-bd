/**
 * @file lecteur.js
 * Le LECTEUR d'un Tome ou d'un Chapitre (demandé) : lire les Planches à la suite, comme un album.
 * Ce module ne contient que des décisions PURES (testées sous Node) ; l'écran est dans
 * src/lecteur-ui.js.
 *
 * Les options viennent de la demande de Valentin (une ou deux pages, sens de lecture, page de
 * départ à gauche ou à droite avec une page blanche au besoin, défilement automatique et sa vitesse)
 * et de ce que font les lecteurs en ligne, retenu avec lui : la vue guidée case par case de
 * Comixology, un bandeau de miniatures, le plein écran avec l'ajustement de la page et la couleur
 * du fond.
 */

/** Les options par défaut, et les valeurs admises. */
export const OPTIONS_LECTEUR = Object.freeze({
  double: false,            // deux pages à la fois
  sens: 'ltr',              // 'ltr' : vers la droite (BD) ; 'rtl' : vers la gauche (manga)
  debut: 'droite',          // en double page, la première page à 'droite' (comme un livre) ou à 'gauche'
  auto: false,              // défilement automatique
  vitesse: 6,               // secondes par étape du défilement automatique
  guide: false,             // vue guidée case par case
  livre: true,              // « vue livre » : pages qui se tournent, reliure en double page ; sinon à plat
  ajustement: 'hauteur',    // 'hauteur' : la page entière tient ; 'largeur' : elle remplit la largeur
  fond: 'sombre',           // 'sombre' | 'gris' | 'clair'
  miniatures: true,         // le bandeau de miniatures
});
export const VITESSE_MIN = 1, VITESSE_MAX = 60;

/** Des options lues d'ailleurs (localStorage), ramenées aux valeurs admises. */
/**
 * L'ajustement qui s'applique VRAIMENT : en deux pages, toujours la page entière (demandé : la
 * largeur y changeait trop peu, le réglage n'y est plus proposé). Le choix fait en une page est
 * gardé et revient avec elle.
 */
export function ajustementEffectif(o){
  return o && !o.double && o.ajustement === 'largeur' ? 'largeur' : 'hauteur';
}

export function optionsValides(brut){
  const o = { ...OPTIONS_LECTEUR };
  const b = brut && typeof brut === 'object' ? brut : {};
  if (typeof b.double === 'boolean') o.double = b.double;
  if (b.sens === 'ltr' || b.sens === 'rtl') o.sens = b.sens;
  if (b.debut === 'droite' || b.debut === 'gauche') o.debut = b.debut;
  if (typeof b.auto === 'boolean') o.auto = b.auto;
  if (Number.isFinite(Number(b.vitesse))) o.vitesse = Math.max(VITESSE_MIN, Math.min(VITESSE_MAX, Math.round(Number(b.vitesse))));
  if (typeof b.guide === 'boolean') o.guide = b.guide;
  if (typeof b.livre === 'boolean') o.livre = b.livre;
  if (b.ajustement === 'hauteur' || b.ajustement === 'largeur') o.ajustement = b.ajustement;
  if (['sombre', 'gris', 'clair'].includes(b.fond)) o.fond = b.fond;
  if (typeof b.miniatures === 'boolean') o.miniatures = b.miniatures;
  return o;
}

/**
 * Les ÉTALEMENTS : ce qui s'affiche à la fois, dans l'ordre de lecture. `pages` : les index des
 * Planches à lire, dans l'ordre. Chaque étalement est `{ gauche, droite }` (index de Planche, ou
 * null pour une page blanche ; en simple page, seule `gauche` sert).
 *
 * En double page, la page « lue en second » d'un étalement est celle de droite en lecture vers la
 * droite, celle de gauche en lecture vers la gauche (manga). « Commencer à droite » en lecture vers
 * la droite, comme un livre imprimé dont la première page est un recto, place donc une page blanche
 * avant la première ; de même « commencer à gauche » en lecture vers la gauche. Une page blanche
 * complète aussi le dernier étalement si besoin.
 */
export function etalements(pages, { double = false, sens = 'ltr', debut = 'droite' } = {}){
  const liste = Array.isArray(pages) ? pages.slice() : [];
  if (!double) return liste.map(p => ({ gauche: p, droite: null }));
  const blancDevant = (sens === 'ltr' && debut === 'droite') || (sens === 'rtl' && debut === 'gauche');
  const suite = blancDevant ? [null, ...liste] : liste;
  if (suite.length % 2) suite.push(null);
  const out = [];
  for (let i = 0; i < suite.length; i += 2) {
    const [premiere, seconde] = [suite[i], suite[i + 1]];
    out.push(sens === 'rtl' ? { gauche: seconde, droite: premiere } : { gauche: premiere, droite: seconde });
  }
  return out;
}

/** L'étalement qui montre la Planche `page` (0 si elle n'y est pas). */
export function etalementDeLaPage(liste, page){
  const i = (liste || []).findIndex(e => e.gauche === page || e.droite === page);
  return i < 0 ? 0 : i;
}

/**
 * Le sens d'une touche ou d'un bord cliqué : +1 (suivant) ou -1 (précédent). En lecture vers la
 * gauche, la flèche gauche et le bord gauche AVANCENT, comme quand on tourne les pages d'un manga.
 */
export function pasDuCote(cote, sens){
  const versDroite = cote === 'droite';
  return (sens === 'rtl') === versDroite ? -1 : 1;
}

/**
 * Les ÉTAPES de la vue guidée : pour chaque Planche, ses Cases dans l'ordre de lecture (leur
 * numéro), chacune avec son rectangle ; une Planche sans Case est une étape à elle seule (toute la
 * page). `casesDe(index)` rend les Cases d'une Planche : `[{ x, y, w, h, caseNumber }]`.
 */
export function etapesGuidees(pages, casesDe){
  const out = [];
  for (const page of pages || []) {
    const cases = (casesDe(page) || []).filter(c => c && c.w > 0 && c.h > 0)
      .slice().sort((a, b) => (a.caseNumber || Infinity) - (b.caseNumber || Infinity));
    if (!cases.length) out.push({ page, cadre: null });
    else cases.forEach(c => out.push({ page, cadre: { x: c.x, y: c.y, w: c.w, h: c.h } }));
  }
  return out;
}

/** La première étape guidée de la Planche `page` (0 si elle n'y est pas). */
export function etapeDeLaPage(etapes, page){
  const i = (etapes || []).findIndex(e => e.page === page);
  return i < 0 ? 0 : i;
}

/**
 * Le cadrage d'un rectangle de la page dans une vue : l'échelle (pixels de vue par unité de page)
 * et le décalage qui le centrent, avec une marge. `cadre` null = la page entière. PURE.
 */
export function cadrageDansLaVue(cadre, page, vue, marge = 0.06){
  const r = cadre || { x: 0, y: 0, w: page.w, h: page.h };
  const utileL = vue.w * (1 - 2 * marge), utileH = vue.h * (1 - 2 * marge);
  const echelle = Math.min(utileL / Math.max(1e-6, r.w), utileH / Math.max(1e-6, r.h));
  return {
    echelle,
    x: vue.w / 2 - (r.x + r.w / 2) * echelle,
    y: vue.h / 2 - (r.y + r.h / 2) * echelle,
  };
}

/**
 * La page qui TOURNE en vue livre : le côté de l'étalement qui pivote autour de la reliure. Avancer
 * en lecture vers la droite tourne la page de DROITE vers la gauche ; reculer, celle de gauche vers
 * la droite ; en manga, l'inverse. PURE.
 */
export function coteQuiTourne(pas, sens){
  if (!pas) return null;
  return (pas > 0) === (sens !== 'rtl') ? 'droite' : 'gauche';
}

/** L'étape suivante ou précédente, bornée ; `fin` dit si l'on est arrivé au bout dans ce sens. */
export function avancer(index, pas, total){
  const n = Math.max(0, total | 0);
  const suivant = Math.max(0, Math.min(n - 1, index + pas));
  return { index: suivant, fin: suivant === index };
}
