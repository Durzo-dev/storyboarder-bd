/**
 * @file plan-echelle.js
 * #456d, L'ÉCHELLE d'un plan d'architecte : combien de mètres vaut un pixel de l'image de travail.
 * Fonctions PURES, vérifiées sous Node (tests/plan-echelle.test.mjs).
 *
 * Ce que la recherche a établi (docs/en/plan-sources.md) : sur une PHOTO, une échelle écrite
 * (« 1/100 », « 0,01 p. m. ») ne sert à rien, puisqu'on ignore la taille du papier photographié.
 * Seule une longueur connue, mesurée sur l'image, donne l'échelle : la barre d'échelle, une cote, ou
 * un mur dont on connaît la longueur. D'où :
 *
 *   - l'échelle est TOUJOURS demandée (deux points, une longueur, une unité), seule action imposée à
 *     l'utilisateur (décision de Valentin : tout le reste est automatique) ;
 *   - elle est PRÉ-REMPLIE par une estimation, que l'utilisateur n'a souvent qu'à valider : la
 *     largeur médiane des portes à un battant (environ 0,83 m), sinon l'épaisseur des murs
 *     extérieurs (environ 0,30 m), moins sûre ;
 *   - le résultat est CONTRÔLÉ : des murs de 2 cm ou un bâtiment de 2 km disent une erreur de saisie.
 *
 * Les unités sont celles qu'a validées Valentin, dont les anciennes : un château du XVIIe siècle est
 * gradué en toises.
 */

/** Les unités de la saisie, en mètres. La toise est celle du Châtelet (54 000 / 27 706 m). */
export const UNITES_DE_LONGUEUR = [
  { id: 'm', metres: 1, fr: 'mètre', en: 'metre' },
  { id: 'cm', metres: 0.01, fr: 'centimètre', en: 'centimetre' },
  { id: 'toise', metres: 54000 / 27706, fr: 'toise', en: 'toise' },
  { id: 'pied-du-roi', metres: 54000 / 27706 / 6, fr: 'pied du roi', en: 'pied du roi (French foot)' },
  { id: 'pouce-du-roi', metres: 54000 / 27706 / 72, fr: 'pouce du roi', en: 'pouce du roi (French inch)' },
  { id: 'pied', metres: 0.3048, fr: 'pied anglais', en: 'foot' },
  { id: 'pouce', metres: 0.0254, fr: 'pouce anglais', en: 'inch' },
];

/** La largeur supposée d'une porte à un battant, et l'épaisseur supposée d'un mur extérieur (m). */
const PORTE_TYPE = 0.83, MUR_EXTERIEUR_TYPE = 0.30;

const metresDe = (unite) => (UNITES_DE_LONGUEUR.find(u => u.id === unite) || UNITES_DE_LONGUEUR[0]).metres;
const mediane = (t) => { const s = t.slice().sort((a, b) => a - b); return s[s.length >> 1]; };

/**
 * L'échelle ESTIMÉE à partir des segments de `ouverturesDuPlan` : `{ metresParPixel, source }`,
 * `source` valant 'portes', 'murs', ou null s'il n'y a rien sur quoi s'appuyer.
 */
export function estimerLEchelle(segments){
  const portes = segments.flatMap(s => (s.ouvertures || []).filter(o => o.type === 'porte' && o.battants !== 2).map(o => o.s1 - o.s0));
  if (portes.length) return { metresParPixel: PORTE_TYPE / mediane(portes), source: 'portes' };
  // Sans porte : les murs les plus épais (le quart supérieur) sont pris pour des murs extérieurs.
  const epaisseurs = segments.map(s => s.epaisseur).filter(e => e > 0).sort((a, b) => a - b);
  if (!epaisseurs.length) return { metresParPixel: null, source: null };
  const exterieurs = epaisseurs.slice(Math.floor(epaisseurs.length * 0.75));
  return { metresParPixel: MUR_EXTERIEUR_TYPE / mediane(exterieurs), source: 'murs' };
}

/**
 * L'échelle SAISIE : `p1`, `p2` en pixels de l'image ORIGINALE (là où l'utilisateur clique),
 * `longueur` dans l'`unite` choisie, `facteur` celui de `detecterLesMurs` (l'image de travail est
 * `facteur` fois plus petite). Rend des mètres par pixel DE TRAVAIL, ou null si la saisie est vide.
 */
export function echelleDeuxPoints(p1, p2, longueur, unite = 'm', facteur = 1){
  const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (!(d > 0) || !(longueur > 0)) return null;
  return longueur * metresDe(unite) / d * facteur;
}

/**
 * La longueur entre deux points de l'image ORIGINALE, dans l'`unite` choisie, à l'échelle
 * `metresParPixel` (de travail) : de quoi pré-remplir le champ quand l'utilisateur pose ses points.
 */
export function longueurEntre(p1, p2, metresParPixel, unite = 'm', facteur = 1){
  return Math.hypot(p2.x - p1.x, p2.y - p1.y) / facteur * metresParPixel / metresDe(unite);
}

/**
 * Ce qui, à cette échelle, a l'air faux : une liste de clés parmi 'murs-minces' (médiane sous 4 cm),
 * 'murs-epais' (au-dessus de 3 m), 'trop-petit' (moins de 2 m de côté), 'trop-grand' (plus de
 * 500 m). Vide si tout est plausible.
 */
export function controlerLEchelle(segments, metresParPixel){
  if (!segments.length || !(metresParPixel > 0)) return [];
  const alertes = [];
  const e = mediane(segments.map(s => s.epaisseur)) * metresParPixel;
  if (e < 0.04) alertes.push('murs-minces');
  if (e > 3) alertes.push('murs-epais');
  const xs = segments.flatMap(s => [s.a.x, s.b.x]), ys = segments.flatMap(s => [s.a.y, s.b.y]);
  const cote = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * metresParPixel;
  if (cote < 2) alertes.push('trop-petit');
  if (cote > 500) alertes.push('trop-grand');
  return alertes;
}
