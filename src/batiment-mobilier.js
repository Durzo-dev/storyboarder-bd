/**
 * @file batiment-mobilier.js
 * LE MOBILIER D'UN BÂTIMENT (#454e, demandé le 26 octobre 2026) : des Éléments posés DANS l'éditeur,
 * fixes (décision 8 de #454 : le mobilier fixe dans l'éditeur, la mise en scène dans la Scène).
 *
 * « Ajouter un Élément » dans la section de la pièce ouvre le store de modèles ; le modèle choisi est
 * posé au centre de la pièce, au sol. À l'outil Sélection : glisser le déplace (et l'AIMANTE aux
 * murs), le clic droit le tourne d'un quart de tour, la molette le grandit ou le rétrécit, Suppr
 * l'enlève.
 *
 * Un meuble : `{ id, niveauId, modelFile, nom, x, z, rotY, echelle, dims: [l, p, h], base }`
 *   - x, z : le CENTRE de son empreinte, en mètres dans le repère du bâtiment ;
 *   - rotY : en radians, par quarts de tour ;
 *   - dims : largeur (x), profondeur (z), hauteur (y) À L'ÉCHELLE 1, en mètres ;
 *   - base : le facteur qui ramène le fichier à ces dimensions (un modèle fait en centimètres) ;
 *   - echelle : ce que la molette a changé, 1 au départ.
 * Il est TOUJOURS au sol de son niveau (demandé : fixé au sol par défaut).
 *
 * Fonctions PURES ; le rendu est dans batiment-3d.js, les gestes dans batiment-editeur-ui.js.
 */

/** Bornes de la taille (molette) et le pas d'un cran. */
export const ECHELLE_MEUBLE = { min: 0.2, max: 5, pas: 1.1 };
/** La distance à laquelle un meuble se colle à la face d'un mur, en mètres. */
export const AIMANT_MEUBLE = 0.25;
/** La hauteur prise pour un modèle sans dimensions plausibles (illisible, ou fait en centimètres). */
const HAUTEUR_REPLI = 1;

const arrondi = (v) => Math.round(v * 1000) / 1000;
const nouvelId = (liste) => { let i = (liste || []).length + 1; while ((liste || []).some(e => e.id === 'e' + i)) i++; return 'e' + i; };

/**
 * Les dimensions de départ d'un modèle `[l, p, h]` et le facteur `base` qui y ramène le fichier.
 * `mesurees` : ce que le modèle mesure ([x, z, y] comme les vignettes les relèvent), ou null. Un
 * modèle de plus de 6 m ou de moins de 5 cm de haut est sans doute dans une autre unité : ramené à
 * 1 m de haut, proportions gardées (la molette corrige ensuite).
 */
export function dimensionsDeDepart(mesurees){
  const [x, z, y] = Array.isArray(mesurees) ? mesurees.map(Number) : [];
  if (![x, z, y].every(v => Number.isFinite(v) && v > 0)) return { dims: [1, 1, HAUTEUR_REPLI], base: 1 };
  const base = y > 6 || y < 0.05 ? HAUTEUR_REPLI / y : 1;
  return { dims: [arrondi(x * base), arrondi(z * base), arrondi(y * base)], base };
}

/** Pose un meuble au point `centre` du niveau. Rend le meuble créé. */
export function ajouterMeuble(b, niveauId, { modelFile, nom, centre, mesurees }){
  if (!Array.isArray(b.elements)) b.elements = [];
  const { dims, base } = dimensionsDeDepart(mesurees);
  const m = {
    id: nouvelId(b.elements), niveauId, modelFile, nom: nom || String(modelFile || '').replace(/\.glb$/i, ''),
    x: arrondi(centre.x), z: arrondi(centre.z), rotY: 0, echelle: 1, dims, base,
  };
  b.elements.push(m);
  return m;
}

/** Les meubles d'un niveau. */
export const meublesDuNiveau = (b, niveauId) => (b.elements || []).filter(e => e && e.niveauId === niveauId && e.modelFile);

/** La demi-largeur et la demi-profondeur d'un meuble, à son échelle. */
function demiTaille(m){
  const k = m.echelle || 1;
  return { u: (m.dims[0] * k) / 2, v: (m.dims[1] * k) / 2 };
}

/** Ses axes : u le long de sa largeur, v le long de sa profondeur (tournés de rotY). */
function axes(m){
  const c = Math.cos(m.rotY || 0), s = Math.sin(m.rotY || 0);
  return { u: { x: c, z: -s }, v: { x: s, z: c } };
}

/** Les quatre coins de son empreinte au sol. */
export function empreinteDuMeuble(m){
  const { u, v } = axes(m), d = demiTaille(m);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({
    x: m.x + u.x * d.u * a + v.x * d.v * b, z: m.z + u.z * d.u * a + v.z * d.v * b,
  }));
}

/** Le meuble du niveau sous le point p (le plus petit, s'ils se chevauchent), ou null. */
export function meubleSous(b, niveauId, p){
  let meilleur = null;
  for (const m of meublesDuNiveau(b, niveauId)) {
    const { u, v } = axes(m), d = demiTaille(m);
    const dx = p.x - m.x, dz = p.z - m.z;
    if (Math.abs(dx * u.x + dz * u.z) <= d.u && Math.abs(dx * v.x + dz * v.z) <= d.v) {
      const aire = d.u * d.v;
      if (!meilleur || aire < meilleur.aire) meilleur = { id: m.id, aire };
    }
  }
  return meilleur ? meilleur.id : null;
}

/**
 * L'AIMANT (demandé) : le centre où poser le meuble `m` voulu en `centre`, collé à la face des murs
 * dont il passe à moins de `tol`. Au plus un mur par direction (deux murs qui se croisent : un coin).
 * Un mur ne compte que s'il est en face du meuble (leurs étendues se recouvrent le long du mur).
 */
export function aimanterMeuble(b, m, centre, tol = AIMANT_MEUBLE){
  const murs = (b.murs || []).filter(w => w.niveauId === m.niveauId);
  const { u, v } = axes(m), d = demiTaille(m);
  const retenus = [];
  for (const w of murs) {
    const L = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z);
    if (L < 1e-6) continue;
    const t = { x: (w.b.x - w.a.x) / L, z: (w.b.z - w.a.z) / L };
    let n = { x: -t.z, z: t.x };
    // La distance (signée) du centre à l'axe du mur ; la normale est tournée vers le meuble.
    let dist = (centre.x - w.a.x) * n.x + (centre.z - w.a.z) * n.z;
    if (dist < 0) { n = { x: -n.x, z: -n.z }; dist = -dist; }
    // L'étendue du meuble le long de la normale du mur, et le long du mur.
    const enTravers = Math.abs(n.x * u.x + n.z * u.z) * d.u + Math.abs(n.x * v.x + n.z * v.z) * d.v;
    const leLong = Math.abs(t.x * u.x + t.z * u.z) * d.u + Math.abs(t.x * v.x + t.z * v.z) * d.v;
    const ecart = dist - (w.epaisseur || 0.2) / 2 - enTravers;
    if (Math.abs(ecart) > tol) continue;
    const s = (centre.x - w.a.x) * t.x + (centre.z - w.a.z) * t.z;
    if (s + leLong < 0.01 || s - leLong > L - 0.01) continue;   // pas en face du mur
    retenus.push({ n, ecart });
  }
  // Le plus proche d'abord ; un second seulement s'il n'est pas parallèle au premier (un coin).
  retenus.sort((a, c) => Math.abs(a.ecart) - Math.abs(c.ecart));
  const pris = [];
  for (const r of retenus) {
    if (pris.length === 2) break;
    if (pris.some(q => Math.abs(q.n.x * r.n.x + q.n.z * r.n.z) > 0.9)) continue;
    pris.push(r);
  }
  const p = { x: centre.x, z: centre.z };
  for (const r of pris) { p.x -= r.n.x * r.ecart; p.z -= r.n.z * r.ecart; }
  return { x: arrondi(p.x), z: arrondi(p.z), colle: pris.length > 0 };
}

/** Un quart de tour (le clic droit, demandé). */
export function tournerMeuble(m){
  const q = Math.round(((m.rotY || 0) / (Math.PI / 2)) + 1) % 4;
  m.rotY = q * Math.PI / 2;
  return m;
}

/** Grandir (cran > 0) ou rétrécir (cran < 0) d'un pas de molette, dans les bornes. */
export function echelonnerMeuble(m, cran){
  const k = (m.echelle || 1) * (cran > 0 ? ECHELLE_MEUBLE.pas : 1 / ECHELLE_MEUBLE.pas);
  m.echelle = Math.round(Math.min(ECHELLE_MEUBLE.max, Math.max(ECHELLE_MEUBLE.min, k)) * 1000) / 1000;
  return m;
}

/** Retire un meuble. */
export function supprimerMeuble(b, id){
  b.elements = (b.elements || []).filter(e => e.id !== id);
}

/** Les fichiers de modèle que porte un bâtiment (pour les précharger, et la signature du rendu). */
export function fichiersDesMeubles(b){
  return [...new Set((b && b.elements || []).map(e => e && e.modelFile).filter(f => typeof f === 'string' && f))];
}
