/**
 * @file batiment-trace.js
 * LE TRACÉ DES MURS dans l'éditeur de bâtiment (#454a-3). Fonctions PURES : l'écran
 * (batiment-editeur-ui.js) leur passe le bâtiment, un point et une tolérance ; elles rendent le
 * point retenu, ou modifient le bâtiment.
 *
 * CE QUI VIENT DE L'OUTIL DE LA SCÈNE (canvas-tools.js, events.js) : l'aimantation aux sommets déjà
 * posés, les guides d'alignement sur ces sommets, la jonction en T quand un mur finit au milieu d'un
 * autre (l'autre est coupé en deux), et la chaîne qui continue depuis le dernier point.
 *
 * CE QUE L'ANALYSE A AJOUTÉ (docs/en/building-research.md, recommandation 13) :
 *   - l'ANGLE aimanté par pas de 15° depuis le point de départ (Sweet Home 3D, Planner 5D) ;
 *   - la LONGUEUR arrondie au centimètre, affichée pendant le tracé ;
 *   - le retour visuel AVANT de valider : un mur qui en croise un autre est refusé, et l'écran le
 *     montre en rouge (House Flipper 2) ;
 *   - Alt maintenu coupe toute aimantation le temps du geste (Valheim, Planet Zoo).
 *
 * Les tolérances sont en MÈTRES : l'écran convertit ses pixels (tant de px à l'échelle courante),
 * pour qu'aimanter « à 10 px » reste vrai à tous les zooms.
 */
import { TOLERANCE_SOMMET } from './batiment-geometrie.js';
import { BORNES_BATIMENT } from './batiment.js';

/** Le pas de l'angle aimanté, en radians (15°). */
export const PAS_ANGLE = Math.PI / 12;
/** L'arrondi d'une longueur, en mètres (1 cm). */
export const PAS_LONGUEUR = 0.01;

const dist = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
const arrondi = (v) => Math.round(v * 1000) / 1000;
const point = (p) => ({ x: arrondi(p.x), z: arrondi(p.z) });

/** Les murs d'un niveau. */
function mursDuNiveau(batiment, niveauId){
  return (batiment.murs || []).filter(m => m.niveauId === niveauId);
}

/** Les sommets (bouts de murs) d'un niveau, sans doublon. */
export function sommetsDuNiveau(batiment, niveauId){
  const vus = new Map();
  for (const m of mursDuNiveau(batiment, niveauId)) {
    for (const p of [m.a, m.b]) {
      const k = `${Math.round(p.x / TOLERANCE_SOMMET)},${Math.round(p.z / TOLERANCE_SOMMET)}`;
      if (!vus.has(k)) vus.set(k, { x: p.x, z: p.z });
    }
  }
  return [...vus.values()];
}

/** La projection de p sur le segment [a, b] : le point, la fraction (0 en a, 1 en b), la distance. */
export function projeter(p, a, b){
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2));
  const q = { x: a.x + t * dx, z: a.z + t * dz };
  return { point: q, t, distance: dist(p, q) };
}

/** Le sommet le plus proche de p à moins de `tol`, ou null. */
export function sommetSous(batiment, niveauId, p, tol){
  let meilleur = null;
  for (const s of sommetsDuNiveau(batiment, niveauId)) {
    const d = dist(p, s);
    if (d <= tol && (!meilleur || d < meilleur.d)) meilleur = { d, s };
  }
  return meilleur ? meilleur.s : null;
}

/** Le mur sous p (à moins de sa demi-épaisseur + `tol`), le plus proche, ou null. */
export function murSous(batiment, niveauId, p, tol){
  let meilleur = null;
  for (const m of mursDuNiveau(batiment, niveauId)) {
    const pr = projeter(p, m.a, m.b);
    if (pr.distance <= m.epaisseur / 2 + tol && (!meilleur || pr.distance < meilleur.d)) meilleur = { d: pr.distance, m, pr };
  }
  return meilleur ? { mur: meilleur.m, point: meilleur.pr.point, t: meilleur.pr.t } : null;
}

/**
 * Le point retenu pour la souris en `p`, pendant un tracé qui part de `depuis` (ou null pour le
 * premier point). Par ordre de priorité :
 *   1. un SOMMET existant à moins de `tol` ;
 *   2. un point d'un MUR existant (à moins de `tol` de son axe) : il deviendra une jonction en T. En
 *      cours de tracé, c'est l'intersection du mur avec la direction aimantée par 15° (l'angle droit
 *      qu'on suivait), sinon le pied de la perpendiculaire depuis la souris ;
 *   3. sinon, depuis `depuis`, l'angle aimanté par pas de 15° et la longueur arrondie au
 *      centimètre ; puis les GUIDES : un sommet existant à la même abscisse ou à la même profondeur
 *      (à `tol` près) tire le point sur sa ligne.
 * Avec `libre` (Alt maintenu), le point est rendu tel quel.
 * Rend `{ point, accroche: { type: 'sommet' | 'mur' | null, murId? }, guides: [{ de, vers }] }`.
 */
export function aimanter(batiment, niveauId, p, { depuis = null, tol = 0.1, libre = false, sauf = null } = {}){
  if (libre) return { point: point(p), accroche: { type: null }, guides: [] };
  const exclus = (s) => sauf && dist(s, sauf) < TOLERANCE_SOMMET;
  const s = sommetsDuNiveau(batiment, niveauId).filter(q => !exclus(q))
    .map(q => ({ q, d: dist(p, q) })).filter(x => x.d <= tol).sort((x, y) => x.d - y.d)[0];
  if (s) return { point: point(s.q), accroche: { type: 'sommet' }, guides: [] };
  const surMur = mursDuNiveau(batiment, niveauId)
    .filter(m => !sauf || (dist(m.a, sauf) > TOLERANCE_SOMMET && dist(m.b, sauf) > TOLERANCE_SOMMET))
    .map(m => ({ m, pr: projeter(p, m.a, m.b) }))
    .filter(x => x.pr.distance <= tol && x.pr.t > 0 && x.pr.t < 1)
    .sort((x, y) => x.pr.distance - y.pr.distance)[0];
  if (surMur) {
    // ⚠️ EN COURS DE TRACÉ, L'ANGLE PASSE AVANT LA PROJECTION (signalé) : arrivé contre le mur d'en
    // face, le point tombait au pied de la perpendiculaire depuis la SOURIS, et l'angle droit qu'on
    // suivait se perdait au dernier moment. On garde la direction aimantée (par 15°) depuis `depuis`
    // et on prend son intersection avec le mur, si elle est sur lui et près de la souris.
    if (depuis && dist(p, depuis) > 1e-6) {
      const angle = Math.round(Math.atan2(p.z - depuis.z, p.x - depuis.x) / PAS_ANGLE) * PAS_ANGLE;
      const u = { x: Math.cos(angle), z: Math.sin(angle) };
      const { a, b } = surMur.m;
      const v = { x: b.x - a.x, z: b.z - a.z };
      const det = u.x * v.z - u.z * v.x;
      if (Math.abs(det) > 1e-9) {
        const t = ((a.x - depuis.x) * v.z - (a.z - depuis.z) * v.x) / det;
        const s = ((a.x - depuis.x) * u.z - (a.z - depuis.z) * u.x) / det;
        const q = { x: depuis.x + u.x * t, z: depuis.z + u.z * t };
        if (t > 0 && s > 0 && s < 1 && dist(q, p) <= Math.max(3 * tol, surMur.m.epaisseur)) {
          return { point: point(q), accroche: { type: 'mur', murId: surMur.m.id }, guides: [] };
        }
      }
    }
    return { point: point(surMur.pr.point), accroche: { type: 'mur', murId: surMur.m.id }, guides: [] };
  }

  let q = { ...p };
  if (depuis) {
    const L = dist(p, depuis);
    if (L > 1e-6) {
      const angle = Math.round(Math.atan2(p.z - depuis.z, p.x - depuis.x) / PAS_ANGLE) * PAS_ANGLE;
      const longueur = Math.round(L / PAS_LONGUEUR) * PAS_LONGUEUR;
      q = { x: depuis.x + Math.cos(angle) * longueur, z: depuis.z + Math.sin(angle) * longueur };
    }
  }
  // Les guides : sur la ligne d'un sommet existant. Un guide déplace le point sur son axe seulement.
  const guides = [];
  const sommets = sommetsDuNiveau(batiment, niveauId).filter(x => !exclus(x));
  const gx = sommets.map(x => ({ x, d: Math.abs(x.x - q.x) })).filter(o => o.d <= tol).sort((a, b) => a.d - b.d)[0];
  const gz = sommets.map(x => ({ x, d: Math.abs(x.z - q.z) })).filter(o => o.d <= tol).sort((a, b) => a.d - b.d)[0];
  if (gx) { q.x = gx.x.x; guides.push({ de: gx.x, axe: 'x' }); }
  if (gz) { q.z = gz.x.z; guides.push({ de: gz.x, axe: 'z' }); }
  const r = point(q);
  guides.forEach(g => { g.vers = r; });
  return { point: r, accroche: { type: null }, guides };
}

/** Les segments [a, b] et [c, d] se coupent-ils AILLEURS qu'à un bout commun ? */
function seCroisent(a, b, c, d){
  const o = (p, q, r) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  const eps = 1e-9;
  return ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps));
}

/**
 * Le mur a→b croiserait-il un mur existant du niveau ? Les bouts qui touchent un mur (jonction en T,
 * sommet commun) ne comptent pas : seule une traversée est refusée. Un mur superposé à un autre
 * (sur la même droite, qui se recouvrent) l'est aussi.
 */
export function croiseUnMur(batiment, niveauId, a, b){
  for (const m of mursDuNiveau(batiment, niveauId)) {
    if (seCroisent(a, b, m.a, m.b)) return true;
    // Superposition : les deux bouts du nouveau sont sur l'axe de l'autre, ou l'inverse.
    const sur = (p, x, y) => projeter(p, x, y).distance < TOLERANCE_SOMMET;
    const dedans = (p, x, y) => { const pr = projeter(p, x, y); return pr.distance < TOLERANCE_SOMMET && pr.t > 1e-6 && pr.t < 1 - 1e-6; };
    if (sur(a, m.a, m.b) && sur(b, m.a, m.b) && (dedans(a, m.a, m.b) || dedans(b, m.a, m.b) || dedans(m.a, a, b) || dedans(m.b, a, b))) return true;
    if (dedans(m.a, a, b) && dedans(m.b, a, b)) return true;
  }
  return false;
}

function nouvelId(liste, prefixe){
  const pris = new Set(liste.map(e => e.id));
  let n = liste.length;
  while (pris.has(prefixe + n)) n++;
  return prefixe + n;
}

/**
 * Coupe le mur `murId` au point `p` (projeté sur lui) : deux murs, mêmes épaisseur, hauteur et
 * revêtements. Les ouvertures suivent la moitié où elles se trouvent, leur position recalculée.
 * Rend les ids des deux moitiés, ou null si le point est trop près d'un bout.
 */
export function couperMur(batiment, murId, p){
  const i = batiment.murs.findIndex(m => m.id === murId);
  if (i < 0) return null;
  const m = batiment.murs[i];
  const pr = projeter(p, m.a, m.b);
  const L = dist(m.a, m.b);
  if (pr.t * L < BORNES_BATIMENT.longueurMin || (1 - pr.t) * L < BORNES_BATIMENT.longueurMin) return null;
  const c = point(pr.point);
  const id2 = nouvelId(batiment.murs, 'm');
  const premier = { ...m, b: c, revetement: { ...m.revetement } };
  const second = { ...m, id: id2, a: c, revetement: { ...m.revetement } };
  batiment.murs.splice(i, 1, premier, second);
  (batiment.ouvertures || []).forEach(o => {
    if (o.murId !== murId) return;
    if (o.le <= pr.t) o.le = pr.t > 0 ? o.le / pr.t : 0.5;
    else { o.murId = id2; o.le = (o.le - pr.t) / (1 - pr.t); }
  });
  return [m.id, id2];
}

/**
 * Ajoute le mur a→b au niveau. Un bout posé au milieu d'un mur (accroche 'mur') coupe celui-ci :
 * jonction en T. Refuse un mur trop court ou qui en croise un autre. Rend `{ mur }` ou
 * `{ erreur: 'court' | 'croise' }`.
 */
export function ajouterMur(batiment, niveauId, a, b, epaisseur, { accrocheA = null, accrocheB = null } = {}){
  const pa = point(a), pb = point(b);
  if (dist(pa, pb) < BORNES_BATIMENT.longueurMin) return { erreur: 'court' };
  if (croiseUnMur(batiment, niveauId, pa, pb)) return { erreur: 'croise' };
  // Le mur à couper est RECHERCHÉ au point plutôt que pris dans l'accroche : si les deux bouts
  // tombent sur le même mur, la première coupe l'a déjà remplacé par deux moitiés.
  for (const [acc, q] of [[accrocheA, pa], [accrocheB, pb]]) {
    if (!acc || acc.type !== 'mur') continue;
    const hote = mursDuNiveau(batiment, niveauId).find(m => {
      const pr = projeter(q, m.a, m.b);
      return pr.distance < 0.002 && pr.t > 1e-6 && pr.t < 1 - 1e-6;
    });
    if (hote) couperMur(batiment, hote.id, q);
  }
  const mur = { id: nouvelId(batiment.murs, 'm'), niveauId, a: pa, b: pb, epaisseur, revetement: { interieur: null, exterieur: null } };
  batiment.murs.push(mur);
  return { mur };
}

/** Supprime un mur, et les ouvertures qu'il porte. */
export function supprimerMur(batiment, murId){
  batiment.murs = batiment.murs.filter(m => m.id !== murId);
  batiment.ouvertures = (batiment.ouvertures || []).filter(o => o.murId !== murId);
}

/**
 * Déplace le sommet `ancien` en `nouveau` : TOUS les bouts de murs du niveau qui y sont attachés le
 * suivent (déplacer un angle déforme les deux murs, il ne les sépare pas). Les murs devenus trop
 * courts disparaissent. Rend le nombre de bouts déplacés.
 */
export function deplacerSommet(batiment, niveauId, ancien, nouveau){
  const n = point(nouveau);
  let deplaces = 0;
  for (const m of mursDuNiveau(batiment, niveauId)) {
    if (dist(m.a, ancien) < TOLERANCE_SOMMET) { m.a = { ...n }; deplaces++; }
    if (dist(m.b, ancien) < TOLERANCE_SOMMET) { m.b = { ...n }; deplaces++; }
  }
  mursDuNiveau(batiment, niveauId).filter(m => dist(m.a, m.b) < BORNES_BATIMENT.longueurMin)
    .forEach(m => supprimerMur(batiment, m.id));
  return deplaces;
}

/** La longueur d'un mur, en mètres. */
export function longueurDuMur(m){ return dist(m.a, m.b); }

/**
 * Les parties du segment [u, v] que NE COUVRE aucun mur existant posé sur la même droite : des
 * intervalles de fraction [t0, t1] de u à v. Un côté de pièce accolé à un mur existant n'en double
 * pas l'épaisseur : seul ce qui dépasse est à construire.
 */
function partiesNonCouvertes(batiment, niveauId, u, v){
  const L = dist(u, v);
  const couverts = [];
  for (const m of mursDuNiveau(batiment, niveauId)) {
    // Sur la même droite : les deux bouts du mur sur la droite (u, v), prolongée.
    const surDroite = (p) => {
      const dx = v.x - u.x, dz = v.z - u.z;
      return Math.abs((p.x - u.x) * dz - (p.z - u.z) * dx) / (L || 1) < TOLERANCE_SOMMET;
    };
    if (!surDroite(m.a) || !surDroite(m.b)) continue;
    const t = (p) => ((p.x - u.x) * (v.x - u.x) + (p.z - u.z) * (v.z - u.z)) / (L * L || 1);
    const t0 = Math.max(0, Math.min(t(m.a), t(m.b))), t1 = Math.min(1, Math.max(t(m.a), t(m.b)));
    if (t1 - t0 > 1e-9) couverts.push([t0, t1]);
  }
  couverts.sort((x, y) => x[0] - y[0]);
  const libres = [];
  let curseur = 0;
  for (const [t0, t1] of couverts) {
    if (t0 > curseur + 1e-9) libres.push([curseur, t0]);
    curseur = Math.max(curseur, t1);
  }
  if (curseur < 1 - 1e-9) libres.push([curseur, 1]);
  return libres.filter(([t0, t1]) => (t1 - t0) * L >= BORNES_BATIMENT.longueurMin);
}

/**
 * Une pièce rectangulaire d'un seul geste (#454a-3b, comme « tirer une pièce » des Sims et de
 * Bloxburg) : quatre côtés entre les coins opposés `p1` et `p2`. Un côté accolé à un mur existant ne
 * le double pas (seule la partie qui dépasse est construite), un coin posé sur un mur y fait une
 * jonction en T. Tout ou rien : si un morceau à construire en traverserait un autre, rien n'est
 * ajouté. Rend `{ murs }` (les murs ajoutés) ou `{ erreur: 'court' | 'croise' }`.
 */
export function ajouterRectangle(batiment, niveauId, p1, p2, epaisseur){
  const a = point(p1), c = point(p2);
  if (Math.abs(c.x - a.x) < BORNES_BATIMENT.longueurMin || Math.abs(c.z - a.z) < BORNES_BATIMENT.longueurMin) return { erreur: 'court' };
  const coins = [a, { x: c.x, z: a.z }, c, { x: a.x, z: c.z }];
  const morceaux = [];
  coins.forEach((u, i) => {
    const v = coins[(i + 1) % 4];
    for (const [t0, t1] of partiesNonCouvertes(batiment, niveauId, u, v)) {
      const lerp = (t) => point({ x: u.x + (v.x - u.x) * t, z: u.z + (v.z - u.z) * t });
      morceaux.push([lerp(t0), lerp(t1)]);
    }
  });
  if (morceaux.some(([u, v]) => croiseUnMur(batiment, niveauId, u, v))) return { erreur: 'croise' };
  // Les coins posés au milieu d'un mur existant le coupent, même si aucun morceau n'y aboutit
  // (côté entièrement accolé) : la pièce doit pouvoir s'y refermer.
  for (const q of coins) {
    const hote = mursDuNiveau(batiment, niveauId).find(m => {
      const pr = projeter(q, m.a, m.b);
      return pr.distance < 0.002 && pr.t > 1e-6 && pr.t < 1 - 1e-6;
    });
    if (hote) couperMur(batiment, hote.id, q);
  }
  const surUnMur = { type: 'mur' };   // ajouterMur cherche lui-même le mur à couper, s'il y en a un
  const murs = morceaux.map(([u, v]) => ajouterMur(batiment, niveauId, u, v, epaisseur, { accrocheA: surUnMur, accrocheB: surUnMur }).mur).filter(Boolean);
  return { murs };
}
