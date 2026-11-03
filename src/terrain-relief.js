/**
 * @file terrain-relief.js
 * #462c, LE RELIEF d'une Scène (décidé le 2 novembre 2026 : une grille de hauteurs au pinceau). PUR.
 *
 * Le relief est une GRILLE RÉGULIÈRE de hauteurs (mètres, au-dessus du Sol), au pas de 1 m, portée par
 * le canevas de la Scène (`panel.relief`, champ AJOUTÉ ; absent = Sol plat, comme avant) :
 *   { pas, x0, z0, nx, nz, h: [nx × nz hauteurs, ligne par ligne en z], v }
 * Elle ne couvre que ce qui a été peint, et S'AGRANDIT quand le pinceau en sort (jusqu'à 400 m de
 * côté). `v` compte les coups de pinceau (indicatif ; la signature du rendu lit les hauteurs).
 * Hors de la grille, et sur ses bords, la hauteur vaut 0 : le relief se raccorde au Sol plat.
 */

export const PAS_DU_RELIEF = 1;
/** Le plus grand côté de la grille, en points. */
export const COTE_MAX_DU_RELIEF = 401;
/** Les bornes des hauteurs (mètres). */
export const HAUTEUR_MIN = -20, HAUTEUR_MAX = 30;
/** Les modes du pinceau. */
export const MODES_DU_PINCEAU = Object.freeze(['monter', 'creuser', 'aplanir', 'adoucir']);
/** Ce qu'un passage du pinceau ajoute au plus (mètres), à pleine force, au centre. */
const PAS_DE_PINCEAU = 1.5;   // demandé : une force maximale bien plus grande (0,25 m avant)

const fini = (v) => typeof v === 'number' && Number.isFinite(v);

/** Un relief est-il lisible ? (sinon : Sol plat) */
export function reliefValide(r){
  return !!r && fini(r.pas) && r.pas > 0 && fini(r.x0) && fini(r.z0) && Number.isInteger(r.nx) && Number.isInteger(r.nz)
    && r.nx >= 2 && r.nz >= 2 && Array.isArray(r.h) && r.h.length === r.nx * r.nz;
}

/** La hauteur du relief en (x, z) (mètres), interpolée ; 0 hors de la grille ou sans relief. */
export function hauteurDuRelief(r, x, z){
  if (!reliefValide(r)) return 0;
  const fx = (x - r.x0) / r.pas, fz = (z - r.z0) / r.pas;
  if (!(fx >= 0 && fz >= 0 && fx <= r.nx - 1 && fz <= r.nz - 1)) return 0;
  const i = Math.min(r.nx - 2, Math.floor(fx)), j = Math.min(r.nz - 2, Math.floor(fz));
  const tx = fx - i, tz = fz - j;
  const h = (a, b) => r.h[b * r.nx + a] || 0;
  // ⚠️ PAR TRIANGLE, COMME LE MAILLAGE (signalé : une route drapée disparaissait par endroits dans le
  // relief). Chaque case est coupée en deux triangles par sa diagonale (i+1, j)–(i, j+1) (scene3d.js,
  // construireRelief3D) ; une interpolation bilinéaire s'en écarte au milieu de la case, et ce qui
  // était posé « dessus » passait dessous.
  if (tx + tz <= 1) return h(i, j) + (h(i + 1, j) - h(i, j)) * tx + (h(i, j + 1) - h(i, j)) * tz;
  return h(i + 1, j + 1) + (h(i, j + 1) - h(i + 1, j + 1)) * (1 - tx) + (h(i + 1, j) - h(i + 1, j + 1)) * (1 - tz);
}

/**
 * Le relief agrandi pour couvrir [x0, x1] × [z0, z1] (plus une marge d'un pas, pour que le bord reste
 * à 0). Rend un relief NEUF (les hauteurs recopiées), ou le même s'il couvre déjà. Borné à
 * COTE_MAX_DU_RELIEF points par côté : au-delà, la zone demandée est rognée.
 */
export function etendreLeRelief(r, x0, z0, x1, z1){
  const pas = reliefValide(r) ? r.pas : PAS_DU_RELIEF;
  const a = (v) => Math.floor(v / pas) * pas, b = (v) => Math.ceil(v / pas) * pas;
  let nx0 = a(x0) - pas, nz0 = a(z0) - pas, nx1 = b(x1) + pas, nz1 = b(z1) + pas;
  if (reliefValide(r)) {
    const rx1 = r.x0 + (r.nx - 1) * r.pas, rz1 = r.z0 + (r.nz - 1) * r.pas;
    if (nx0 >= r.x0 && nz0 >= r.z0 && nx1 <= rx1 && nz1 <= rz1) return r;
    nx0 = Math.min(nx0, r.x0); nz0 = Math.min(nz0, r.z0); nx1 = Math.max(nx1, rx1); nz1 = Math.max(nz1, rz1);
  }
  let nx = Math.round((nx1 - nx0) / pas) + 1, nz = Math.round((nz1 - nz0) / pas) + 1;
  if (nx > COTE_MAX_DU_RELIEF) { nx = COTE_MAX_DU_RELIEF; }
  if (nz > COTE_MAX_DU_RELIEF) { nz = COTE_MAX_DU_RELIEF; }
  const h = new Array(nx * nz).fill(0);
  if (reliefValide(r)) {
    const di = Math.round((r.x0 - nx0) / pas), dj = Math.round((r.z0 - nz0) / pas);
    for (let j = 0; j < r.nz; j++) for (let i = 0; i < r.nx; i++) {
      const I = i + di, J = j + dj;
      if (I >= 0 && J >= 0 && I < nx && J < nz) h[J * nx + I] = r.h[j * r.nx + i];
    }
  }
  return { pas, x0: nx0, z0: nz0, nx, nz, h, v: (reliefValide(r) && r.v) || 0 };
}

/** L'atténuation du pinceau à la distance d (0 au bord, 1 au centre), douce. */
export function attenuation(d, rayon){
  if (!(d < rayon)) return 0;
  return 0.5 * (1 + Math.cos(Math.PI * d / rayon));
}

/**
 * Un passage du pinceau en `centre` ({x, z}) : `mode` (monter, creuser, aplanir vers `cible`,
 * adoucir), `rayon` (mètres), `force` (0 à 1). Rend le relief (agrandi au besoin, `v` augmenté).
 * Le bord de la grille reste à 0 (raccord au Sol plat).
 */
export function peindreLeRelief(r, centre, { mode = 'monter', rayon = 4, force = 0.5, cible = 0 } = {}){
  if (!centre || !fini(centre.x) || !fini(centre.z) || !(rayon > 0)) return r;
  const g = etendreLeRelief(r, centre.x - rayon, centre.z - rayon, centre.x + rayon, centre.z + rayon);
  const res = g === r ? { ...r, h: r.h.slice() } : g;
  const avant = res.h.slice();
  const i0 = Math.max(1, Math.floor((centre.x - rayon - res.x0) / res.pas)), i1 = Math.min(res.nx - 2, Math.ceil((centre.x + rayon - res.x0) / res.pas));
  const j0 = Math.max(1, Math.floor((centre.z - rayon - res.z0) / res.pas)), j1 = Math.min(res.nz - 2, Math.ceil((centre.z + rayon - res.z0) / res.pas));
  const k = Math.max(0, Math.min(1, force));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = res.x0 + i * res.pas, z = res.z0 + j * res.pas;
    const w = attenuation(Math.hypot(x - centre.x, z - centre.z), rayon);
    if (!w) continue;
    const n = j * res.nx + i, h = avant[n];
    let nv = h;
    if (mode === 'monter') nv = h + PAS_DE_PINCEAU * k * w;
    else if (mode === 'creuser') nv = h - PAS_DE_PINCEAU * k * w;
    else if (mode === 'aplanir') nv = h + (cible - h) * Math.min(1, k * w);
    else if (mode === 'adoucir') {
      const moy = (avant[n - 1] + avant[n + 1] + avant[n - res.nx] + avant[n + res.nx] + 4 * h) / 8;
      nv = h + (moy - h) * Math.min(1, k * w);
    }
    res.h[n] = Math.round(Math.max(HAUTEUR_MIN, Math.min(HAUTEUR_MAX, nv)) * 1000) / 1000;
  }
  res.v = (res.v || 0) + 1;
  return res;
}

/**
 * La signature d'un relief pour le cache du rendu (ou '' sans relief) : ses dimensions et une somme
 * de contrôle de ses hauteurs. Pas `v` seul : une annulation suivie d'un autre coup de pinceau
 * redonnerait le même `v` pour d'autres hauteurs.
 */
export function signatureDuRelief(r){
  if (!reliefValide(r)) return '';
  let s = 0;
  for (let i = 0; i < r.h.length; i++) s = (Math.imul(s, 31) + Math.round((r.h[i] || 0) * 1000)) | 0;
  return `${r.pas}|${r.x0}|${r.z0}|${r.nx}|${r.nz}|${s}`;
}

/** Le relief est-il plat partout (rien à dessiner) ? */
export function reliefPlat(r){
  return !reliefValide(r) || r.h.every(v => !v);
}

/**
 * #462c-2 : une ligne (Tracé) redécoupée tous les `pas` mètres au plus, pour qu'elle épouse le relief
 * (deux points éloignés traverseraient les creux et les bosses). Les points d'origine sont gardés.
 */
export function densifierLaLigne(pts, pas = 1){
  if (!Array.isArray(pts) || pts.length < 2 || !(pas > 0)) return pts;
  const res = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.min(400, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / pas));
    for (let k = 1; k < n; k++) res.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n });
    res.push(b);
  }
  return res;
}

/**
 * #462c-2 : le relief APLANI sous les bâtiments (décidé) : chaque point de la grille dans une emprise
 * (ou à moins de `marge` mètres de son bord) prend la hauteur `base` de ce bâtiment. `emprises` :
 * [{ polys: [[{x, z}…]…], base }]. Rend un relief neuf, ou le même s'il n'y a rien à aplanir. PUR.
 */
export function aplanirSousLesEmprises(r, emprises, marge = 0.6){
  if (!reliefValide(r) || !emprises || !emprises.length) return r;
  const h = r.h.slice();
  const dedans = (p, q) => {
    let d = false;
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      if ((q[i].z > p.z) !== (q[j].z > p.z) && p.x < (q[j].x - q[i].x) * (p.z - q[i].z) / (q[j].z - q[i].z) + q[i].x) d = !d;
    }
    return d;
  };
  const pres = (p, q) => {
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      const a = q[j], b = q[i], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
      if (Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz)) <= marge) return true;
    }
    return false;
  };
  for (const { polys, base } of emprises) {
    const pts = polys.flat();
    if (!pts.length || !fini(base)) continue;
    const xs = pts.map(p => p.x), zs = pts.map(p => p.z);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - marge - r.x0) / r.pas)), i1 = Math.min(r.nx - 1, Math.ceil((Math.max(...xs) + marge - r.x0) / r.pas));
    const j0 = Math.max(0, Math.floor((Math.min(...zs) - marge - r.z0) / r.pas)), j1 = Math.min(r.nz - 1, Math.ceil((Math.max(...zs) + marge - r.z0) / r.pas));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const p = { x: r.x0 + i * r.pas, z: r.z0 + j * r.pas };
      if (polys.some(q => dedans(p, q) || pres(p, q))) h[j * r.nx + i] = base;
    }
  }
  return { ...r, h };
}

// ── #462d : l'eau ─────────────────────────────────────────────────────────────────────────────

/** La profondeur du lit d'une rivière (mètres) et l'eau qui y coule (sous le bord), par défaut. */
export const PROFONDEUR_RIVIERE = 1.2;
export const EAU_SOUS_LA_BERGE = 0.35;
/** Le niveau d'un lac ou d'une mer, par défaut (mètres, par rapport au Sol). */
// Juste AU-DESSUS du Sol (signalé : une Zone passée à la texture Eau ne se voyait pas, sa nappe à
// −0,3 m passant sous le Sol plat). Creusée plus bas, l'eau remplit ; plus haut, le sol la cache.
export const NIVEAU_EAU_PAR_DEFAUT = 0.02;
/** La pente des berges, au-delà du lit (mètres). */
const BERGE = 1.5;

function distanceAuTrait(p, pts){
  let d = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
    d = Math.min(d, Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz)));
  }
  return d;
}

/** Le creux d'un lit de rivière à la distance d de son axe : plein au milieu, nul au haut de la berge. */
export function creuxDuLit(d, largeur, profondeur){
  const demi = largeur / 2;
  if (d <= demi) return profondeur * (1 - 0.5 * (d / demi) * (d / demi));
  if (d < demi + BERGE) { const t = (d - demi) / BERGE; return profondeur * 0.5 * (1 - t) * (1 - t); }
  return 0;
}

/**
 * Le relief CREUSÉ par les rivières (#462d) : `rivieres` = [{ pts, largeur, profondeur }]. La grille
 * est créée ou agrandie au besoin (une Scène plate reçoit son relief à cet endroit). PUR.
 */
export function creuserLesRivieres(r, rivieres){
  const liste = (rivieres || []).filter(v => Array.isArray(v.pts) && v.pts.length >= 2 && v.largeur > 0 && v.profondeur > 0);
  if (!liste.length) return r;
  let g = r;
  for (const v of liste) {
    const m = v.largeur / 2 + BERGE + 1;
    const xs = v.pts.map(p => p.x), zs = v.pts.map(p => p.z);
    g = etendreLeRelief(g, Math.min(...xs) - m, Math.min(...zs) - m, Math.max(...xs) + m, Math.max(...zs) + m);
  }
  const h = g.h.slice();
  for (const v of liste) {
    const m = v.largeur / 2 + BERGE;
    const xs = v.pts.map(p => p.x), zs = v.pts.map(p => p.z);
    const i0 = Math.max(1, Math.floor((Math.min(...xs) - m - g.x0) / g.pas)), i1 = Math.min(g.nx - 2, Math.ceil((Math.max(...xs) + m - g.x0) / g.pas));
    const j0 = Math.max(1, Math.floor((Math.min(...zs) - m - g.z0) / g.pas)), j1 = Math.min(g.nz - 2, Math.ceil((Math.max(...zs) + m - g.z0) / g.pas));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * g.nx + i;
      const c = creuxDuLit(distanceAuTrait({ x: g.x0 + i * g.pas, z: g.z0 + j * g.pas }, v.pts), v.largeur, v.profondeur);
      if (c > 0) h[k] = Math.min(h[k], g.h[k] - c);
    }
  }
  return { ...g, h };
}

/**
 * Demandé (3 novembre 2026) : une Zone RELÈVE ou CREUSE le terrain sous elle (`hauteurZone`, mètres).
 * `zones` = [{ x0, z0, x1, z1, dedans(p) → bool, delta }] : chaque point de la grille dans la Zone
 * monte de `delta` (la grille est créée ou agrandie au besoin ; le pas d'un mètre fait la pente du
 * bord). PUR (le prédicat `dedans` est fourni par l'appelant).
 */
export function releverLesZones(r, zones){
  const liste = (zones || []).filter(z => z && fini(z.delta) && z.delta !== 0 && typeof z.dedans === 'function');
  if (!liste.length) return r;
  let g = r;
  for (const z of liste) g = etendreLeRelief(g, z.x0, z.z0, z.x1, z.z1);
  const h = g.h.slice();
  for (const z of liste) {
    const i0 = Math.max(1, Math.floor((z.x0 - g.x0) / g.pas)), i1 = Math.min(g.nx - 2, Math.ceil((z.x1 - g.x0) / g.pas));
    const j0 = Math.max(1, Math.floor((z.z0 - g.z0) / g.pas)), j1 = Math.min(g.nz - 2, Math.ceil((z.z1 - g.z0) / g.pas));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (z.dedans({ x: g.x0 + i * g.pas, z: g.z0 + j * g.pas })) h[j * g.nx + i] += z.delta;
    }
  }
  return { ...g, h };
}
