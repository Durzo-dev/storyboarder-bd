/**
 * @file terrain-zone-pinceau.js
 * #462, LA ZONE AU PINCEAU (demandé le 3 novembre 2026) : une Zone de terrain peinte, et non plus
 * seulement un rectangle. PUR.
 *
 * Sa forme est un MASQUE de cases de 50 cm (`world.masque = { pas, x0, z0, nx, nz, plein }`, `plein`
 * une chaîne de '0' et de '1', ligne par ligne en z). Le reste du `world` d'une Zone est tenu à jour
 * (centre, taille, coins : le rectangle qui l'englobe), pour que tout ce qui sait déjà traiter une Zone
 * (le plan de la Scène, la liste, le déplacement) continue de la traiter.
 */

export const PAS_DE_ZONE = 0.5;
const COTE_MAX = 800;   // cases par côté (400 m)

const fini = (v) => typeof v === 'number' && Number.isFinite(v);

/** Un masque est-il lisible ? */
export function masqueValide(m){
  return !!m && fini(m.pas) && m.pas > 0 && fini(m.x0) && fini(m.z0) && Number.isInteger(m.nx) && Number.isInteger(m.nz)
    && m.nx > 0 && m.nz > 0 && typeof m.plein === 'string' && m.plein.length === m.nx * m.nz;
}

/** La case (i, j) du masque est-elle peinte ? */
const pleine = (m, i, j) => i >= 0 && j >= 0 && i < m.nx && j < m.nz && m.plein.charCodeAt(j * m.nx + i) === 49;

/** Le point (x, z) est-il dans la Zone peinte ? */
export function dansLeMasque(m, p){
  if (!masqueValide(m) || !p) return false;
  return pleine(m, Math.floor((p.x - m.x0) / m.pas), Math.floor((p.z - m.z0) / m.pas));
}

/** Les cases peintes : [{ x0, z0, x1, z1 }] (mètres). */
export function casesDuMasque(m){
  const res = [];
  if (!masqueValide(m)) return res;
  for (let j = 0; j < m.nz; j++) for (let i = 0; i < m.nx; i++) {
    if (pleine(m, i, j)) res.push({ x0: m.x0 + i * m.pas, z0: m.z0 + j * m.pas, x1: m.x0 + (i + 1) * m.pas, z1: m.z0 + (j + 1) * m.pas });
  }
  return res;
}

/**
 * The TRIANGLES (x, z) of a Panel's painted Zones taken TOGETHER, their edges SMOOTHED (asked by Durzo on 17 Nov.
 * 2026: Zones' edges in stairs of 1 m cells). Smoothed one by one, they left gaps where three Zones met (diamonds of
 * bare ground, seen): so the Zones are one grid of labels (each cell its Zone, a later one over an earlier; -1 none),
 * each cell CORNER takes the label most of its four cells have (a tie: a Zone before none, then the earlier Zone),
 * and each cell is shared out by its corners' labels, its edges cut at their middles:
 *   - one label: the whole cell (two triangles on the relief's diagonal, (x0, z1)–(x1, z0), as scene3d.js's);
 *   - two: marching squares (a corner alone, a triangle; two side by side, half; two opposite, joined for the cell's
 *     own label, split for the other);
 *   - three or four: each corner its quarter.
 * Every cell is shared out exactly: no gap, no overlap, a staircase a slope. `masques`: the Zones' masks in their
 * order (null for one with none); all on the same step (a mask on another step: its own cells, unsmoothed).
 * → for each mask, its triangles [[ [x, z], [x, z], [x, z] ]…]. PURE.
 */
export function trianglesDesZones(masques){
  const out = (masques || []).map(() => []);
  const valid = (masques || []).map((m, k) => (masqueValide(m) ? k : -1)).filter(k => k >= 0);
  if (!valid.length) return out;
  const pas = masques[valid[0]].pas;
  const same = valid.filter(k => Math.abs(masques[k].pas - pas) < 1e-9);
  for (const k of valid) if (!same.includes(k)) {
    for (const c of casesDuMasque(masques[k])) out[k].push([[c.x0, c.z0], [c.x0, c.z1], [c.x1, c.z0]], [[c.x1, c.z0], [c.x0, c.z1], [c.x1, c.z1]]);
  }
  // The grid of labels over all the masks, one cell of margin round them.
  let gx0 = Infinity, gz0 = Infinity, gx1 = -Infinity, gz1 = -Infinity;
  for (const k of same) { const m = masques[k]; gx0 = Math.min(gx0, m.x0); gz0 = Math.min(gz0, m.z0); gx1 = Math.max(gx1, m.x0 + m.nx * pas); gz1 = Math.max(gz1, m.z0 + m.nz * pas); }
  const ox = gx0 - pas, oz = gz0 - pas, nx = Math.round((gx1 - gx0) / pas) + 2, nz = Math.round((gz1 - gz0) / pas) + 2;
  const lab = new Int32Array(nx * nz).fill(-1);
  for (const k of same) {
    const m = masques[k], di = Math.round((m.x0 - ox) / pas), dj = Math.round((m.z0 - oz) / pas);
    for (let j = 0; j < m.nz; j++) for (let i = 0; i < m.nx; i++) if (pleine(m, i, j)) lab[(j + dj) * nx + i + di] = k;
  }
  const cell = (i, j) => (i >= 0 && j >= 0 && i < nx && j < nz ? lab[j * nx + i] : -1);
  const cornerLabel = (i, j) => {
    const ls = [cell(i - 1, j - 1), cell(i, j - 1), cell(i - 1, j), cell(i, j)];
    let best = -1, bestN = 0;
    for (const l of new Set(ls)) {
      const n = ls.filter(v => v === l).length;
      if (n > bestN || (n === bestN && ((best === -1 && l !== -1) || (l !== -1 && best !== -1 && l < best)))) { best = l; bestN = n; }
    }
    return best;
  };
  const corners = new Int32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) corners[j * (nx + 1) + i] = cornerLabel(i, j);
  // ⚠️ A triangle within ONE of the relief's triangles (each cell cut by its diagonal, (x0, z1)–(x1, z0)): draped,
  // it lies exactly on the relief. Across the diagonal, the relief poked through it on a bend (diamonds of the Ground
  // through the Zones along a road, seen on 17 Nov. 2026).
  const push = (k, ...ts) => {
    if (k < 0) return;
    for (const t of ts) {
      const i = Math.floor(Math.min(t[0][0], t[1][0], t[2][0]) / pas + 1e-6 - ox / pas) , j = Math.floor(Math.min(t[0][1], t[1][1], t[2][1]) / pas + 1e-6 - oz / pas);
      const cx0 = ox + i * pas, cz0 = oz + j * pas, side = (q) => (q[0] - cx0) / pas + (q[1] - cz0) / pas - 1;
      for (const half of [-1, 1]) {
        // Sutherland–Hodgman against the diagonal: the part on this side.
        const poly = [];
        for (let n = 0; n < 3; n++) {
          const a = t[n], b = t[(n + 1) % 3], sa = side(a) * half, sb = side(b) * half;
          if (sa <= 1e-9) poly.push(a);
          if ((sa < -1e-9 && sb > 1e-9) || (sa > 1e-9 && sb < -1e-9)) { const r = sa / (sa - sb); poly.push([a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]); }
        }
        for (let n = 1; n + 1 < poly.length; n++) {
          const tri = [poly[0], poly[n], poly[n + 1]];
          if (Math.abs((tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) - (tri[2][0] - tri[0][0]) * (tri[1][1] - tri[0][1])) > 1e-9) out[k].push(tri);
        }
      }
    }
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x0 = ox + i * pas, z0 = oz + j * pas, x1 = x0 + pas, z1 = z0 + pas;
    const P = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    const L = [corners[j * (nx + 1) + i], corners[j * (nx + 1) + i + 1], corners[(j + 1) * (nx + 1) + i + 1], corners[(j + 1) * (nx + 1) + i]];
    const labels = [...new Set(L)];
    if (labels.length === 1) { push(L[0], [P[0], P[3], P[1]], [P[1], P[3], P[2]]); continue; }
    const mid = (a, b) => [(P[a][0] + P[b][0]) / 2, (P[a][1] + P[b][1]) / 2];
    if (labels.length > 2) {
      const c = [(x0 + x1) / 2, (z0 + z1) / 2];
      for (let k = 0; k < 4; k++) push(L[k], [P[k], mid(k, (k + 1) % 4), c], [P[k], c, mid((k + 3) % 4, k)]);
      continue;
    }
    const own = cell(i, j);
    for (const l of labels) {
      if (l < 0) continue;
      const inn = L.map(v => v === l);
      if (inn[0] === inn[2] && inn[1] === inn[3] && inn[0] !== inn[1]) {
        const joined = own === l || (!labels.includes(own) && l === Math.max(...labels));
        if (!joined) { for (let k = 0; k < 4; k++) if (inn[k]) push(l, [P[k], mid(k, (k + 1) % 4), mid((k + 3) % 4, k)]); continue; }
      }
      const poly = [];
      for (let k = 0; k < 4; k++) {
        if (inn[k]) poly.push(P[k]);
        if (inn[k] !== inn[(k + 1) % 4]) poly.push(mid(k, (k + 1) % 4));
      }
      for (let k = 1; k + 1 < poly.length; k++) push(l, [poly[0], poly[k], poly[k + 1]]);
    }
  }
  return out;
}

/** One Zone's triangles on its own (trianglesDesZones of it alone). PURE. */
export function trianglesDuMasque(m){
  return trianglesDesZones([m])[0];
}

/** Le masque resserré sur ses cases peintes (null s'il n'en reste aucune). */
function resserrer(m){
  let i0 = m.nx, i1 = -1, j0 = m.nz, j1 = -1;
  for (let j = 0; j < m.nz; j++) for (let i = 0; i < m.nx; i++) {
    if (pleine(m, i, j)) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
  }
  if (i1 < 0) return null;
  const nx = i1 - i0 + 1, nz = j1 - j0 + 1;
  let plein = '';
  for (let j = j0; j <= j1; j++) plein += m.plein.slice(j * m.nx + i0, j * m.nx + i1 + 1);
  return { pas: m.pas, x0: m.x0 + i0 * m.pas, z0: m.z0 + j0 * m.pas, nx, nz, plein };
}

/**
 * Un passage du pinceau de Zone en `centre` ({x, z}), de rayon `rayon` (mètres) : peint (ou efface si
 * `effacer`). Rend le masque neuf, agrandi au besoin, resserré ; null s'il ne reste rien.
 */
export function peindreLeMasque(m, centre, rayon, effacer = false){
  if (!centre || !fini(centre.x) || !fini(centre.z) || !(rayon > 0)) return m;
  const pas = masqueValide(m) ? m.pas : PAS_DE_ZONE;
  let x0 = Math.floor((centre.x - rayon) / pas) * pas, z0 = Math.floor((centre.z - rayon) / pas) * pas;
  let x1 = Math.ceil((centre.x + rayon) / pas) * pas, z1 = Math.ceil((centre.z + rayon) / pas) * pas;
  if (masqueValide(m)) {
    if (effacer) { x0 = m.x0; z0 = m.z0; x1 = m.x0 + m.nx * pas; z1 = m.z0 + m.nz * pas; }
    else { x0 = Math.min(x0, m.x0); z0 = Math.min(z0, m.z0); x1 = Math.max(x1, m.x0 + m.nx * pas); z1 = Math.max(z1, m.z0 + m.nz * pas); }
  } else if (effacer) return null;
  const nx = Math.min(COTE_MAX, Math.round((x1 - x0) / pas)), nz = Math.min(COTE_MAX, Math.round((z1 - z0) / pas));
  const cases = new Array(nx * nz).fill('0');
  if (masqueValide(m)) {
    const di = Math.round((m.x0 - x0) / pas), dj = Math.round((m.z0 - z0) / pas);
    for (let j = 0; j < m.nz; j++) for (let i = 0; i < m.nx; i++) {
      if (pleine(m, i, j) && i + di < nx && j + dj < nz) cases[(j + dj) * nx + i + di] = '1';
    }
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const cx = x0 + (i + 0.5) * pas, cz = z0 + (j + 0.5) * pas;
    if (Math.hypot(cx - centre.x, cz - centre.z) <= rayon) cases[j * nx + i] = effacer ? '0' : '1';
  }
  return resserrer({ pas, x0, z0, nx, nz, plein: cases.join('') });
}

/** Le `world` complet d'une Zone peinte (le rectangle englobant, et le masque), ou null. */
export function mondeDuMasque(m){
  if (!masqueValide(m)) return null;
  const w = m.nx * m.pas, h = m.nz * m.pas, x0 = m.x0, z0 = m.z0, x1 = x0 + w, z1 = z0 + h;
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w, h, rotY: 0,
    corners: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }], masque: m };
}

/**
 * Le masque TOURNÉ de `angle` (radians, même sens que la rotation d'une Zone rectangulaire) autour de
 * `centre` : rééchantillonné case par case (le résultat reste aligné sur les axes). À appeler depuis
 * le masque d'ORIGINE d'un geste, pour ne pas accumuler les arrondis. Null s'il ne reste rien.
 */
export function tournerLeMasque(m, angle, centre){
  if (!masqueValide(m) || !fini(angle)) return m;
  const c = Math.cos(angle), s = Math.sin(angle);
  const tourne = (x, z) => ({ x: centre.x + (x - centre.x) * c - (z - centre.z) * s, z: centre.z + (x - centre.x) * s + (z - centre.z) * c });
  const x1 = m.x0 + m.nx * m.pas, z1 = m.z0 + m.nz * m.pas;
  const coins = [tourne(m.x0, m.z0), tourne(x1, m.z0), tourne(x1, z1), tourne(m.x0, z1)];
  const pas = m.pas;
  const X0 = Math.floor(Math.min(...coins.map(p => p.x)) / pas) * pas, Z0 = Math.floor(Math.min(...coins.map(p => p.z)) / pas) * pas;
  const nx = Math.min(COTE_MAX, Math.ceil((Math.max(...coins.map(p => p.x)) - X0) / pas));
  const nz = Math.min(COTE_MAX, Math.ceil((Math.max(...coins.map(p => p.z)) - Z0) / pas));
  let plein = '';
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    // La case d'arrivée lit la case de départ qui lui correspond (rotation inverse).
    const px = X0 + (i + 0.5) * pas - centre.x, pz = Z0 + (j + 0.5) * pas - centre.z;
    plein += dansLeMasque(m, { x: centre.x + px * c + pz * s, z: centre.z - px * s + pz * c }) ? '1' : '0';
  }
  return resserrer({ pas, x0: X0, z0: Z0, nx, nz, plein });
}

/** La case peinte la plus proche de `p` (son centre), à moins de `portee` mètres, ou null. */
export function caseLaPlusProche(m, p, portee){
  if (!masqueValide(m) || !p) return null;
  const n = Math.ceil(portee / m.pas) + 1;
  const ci = Math.floor((p.x - m.x0) / m.pas), cj = Math.floor((p.z - m.z0) / m.pas);
  let meilleur = null, d0 = Infinity;
  for (let j = cj - n; j <= cj + n; j++) for (let i = ci - n; i <= ci + n; i++) {
    if (!pleine(m, i, j)) continue;
    // Le point de la case le plus proche (et non son centre) : la bande commence au bord peint.
    const x = Math.max(m.x0 + i * m.pas, Math.min(p.x, m.x0 + (i + 1) * m.pas));
    const z = Math.max(m.z0 + j * m.pas, Math.min(p.z, m.z0 + (j + 1) * m.pas));
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < d0) { d0 = d; meilleur = { x, z }; }
  }
  return d0 <= portee ? meilleur : null;
}
