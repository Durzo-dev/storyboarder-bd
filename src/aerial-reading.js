/**
 * @file aerial-reading.js
 * READING THE AERIAL PHOTO AT THE IMPORT (« Realistic » level, France; the photo: aerial-photo.js). The photo
 * is never shown: its colours are read, metre by metre, to correct what the map data gets wrong or lacks:
 *   - the real ground of a square, a park, a car park (light paving, asphalt, grass);
 *   - the trees OpenStreetMap does not map (a canopy, dark green from above);
 *   - the lawns of courtyards and gardens no Zone covers;
 *   - the roofs whose material no source gives (tiles, or the grey of zinc and terraces).
 * Every reading has its threshold: below it, the data stays as it was. PURE.
 *
 * Frames: local metres around the zone's centre, x east, z south; the photo's top is the north, its pixel
 * (u, v) the point (-h + u · 2h / width, -h + v · 2h / height).
 */

import { roofFinishRead } from './building-survey.js';

/** What a metre of the photo shows. */
export const CLASSES = Object.freeze({ SHADOW: 0, TREE: 1, LAWN: 2, TILES: 3, LIGHT: 4, ASPHALT: 5, GREY: 6 });
const C = CLASSES;

/**
 * THE CLASS OF A PIXEL. Calibrated on the Écusson (Montpellier, the IGN's 2024 summer photo), by painting
 * every class over the whole photo and looking: vegetation (green excess 2g − r − b), dark green a canopy
 * and light green a lawn, shadows (dark), tiles (red over blue and green), light (sunny paving and light
 * roofs, unsaturated and bright), asphalt (the bluish grey of a street, sunny or shaded), the rest grey.
 */
export function classOfPixel(r, g, b){
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  // Vegetation first: a dense canopy is as dark as a shadow (measured: 71, 92, 88), but green where a shadow
  // is bluish.
  if (2 * g - r - b > 18 && l >= 50) return l < 125 ? C.TREE : C.LAWN;
  if (l < 95) return C.SHADOW;
  if (r > b + 22 && r > g + 6) return C.TILES;
  if (l > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 30) return C.LIGHT;
  if (b > r + 8) return C.ASPHALT;
  return C.GREY;
}

/**
 * The class of every metre of the zone (the most frequent among its pixels): { n, cells } (`cells[j·n + i]`:
 * the metre whose centre is (-h + i + 0.5, -h + j + 0.5)). `photo`: { width, height, data } (RGBA, as
 * getImageData gives); `halfSize`: h.
 */
export function classGrid(photo, halfSize){
  const n = Math.max(1, Math.round(2 * halfSize));
  const cells = new Uint8Array(n * n);
  const kx = photo.width / n, ky = photo.height / n;
  const votes = new Uint16Array(7);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    votes.fill(0);
    const u0 = Math.floor(i * kx), u1 = Math.max(u0 + 1, Math.floor((i + 1) * kx));
    const v0 = Math.floor(j * ky), v1 = Math.max(v0 + 1, Math.floor((j + 1) * ky));
    for (let v = v0; v < v1; v++) for (let u = u0; u < u1; u++) {
      const k = (v * photo.width + u) * 4;
      votes[classOfPixel(photo.data[k], photo.data[k + 1], photo.data[k + 2])]++;
    }
    let best = 0;
    for (let c = 1; c < 7; c++) if (votes[c] > votes[best]) best = c;
    cells[j * n + i] = best;
  }
  return { n, cells, halfSize };
}

// ── Where things are, on the grid ───────────────────────────────────────────────────────────────

function insidePolygon(p, q){
  let d = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    if ((q[i].z > p.z) !== (q[j].z > p.z) && p.x < (q[j].x - q[i].x) * (p.z - q[i].z) / (q[j].z - q[i].z) + q[i].x) d = !d;
  }
  return d;
}
const centreOf = (grid, i, j) => ({ x: -grid.halfSize + i + 0.5, z: -grid.halfSize + j + 0.5 });
const cellOf = (grid, x, z) => ({ i: Math.floor(x + grid.halfSize), j: Math.floor(z + grid.halfSize) });

/** The grid's cells inside an outline ([{x, z}…], zone frame): their indices. */
export function cellsInside(grid, outline){
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of outline) { x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); z1 = Math.max(z1, p.z); }
  const a = cellOf(grid, x0, z0), b = cellOf(grid, x1, z1);
  const out = [];
  for (let j = Math.max(0, a.j); j <= Math.min(grid.n - 1, b.j); j++) for (let i = Math.max(0, a.i); i <= Math.min(grid.n - 1, b.i); i++) {
    if (insidePolygon(centreOf(grid, i, j), outline)) out.push(j * grid.n + i);
  }
  return out;
}

/** The grid's cells a Zone's mask covers (translateOsm's `world.masque`, 1 m cells or coarser). */
export function cellsOfMask(grid, m){
  const out = [];
  if (!m || !m.plein) return out;
  for (let b = 0; b < m.nz; b++) for (let a = 0; a < m.nx; a++) {
    if (m.plein[b * m.nx + a] !== '1') continue;
    for (let dz = 0; dz < m.pas; dz++) for (let dx = 0; dx < m.pas; dx++) {
      const c = cellOf(grid, m.x0 + a * m.pas + dx + 0.5, m.z0 + b * m.pas + dz + 0.5);
      if (c.i >= 0 && c.j >= 0 && c.i < grid.n && c.j < grid.n) out.push(c.j * grid.n + c.i);
    }
  }
  return out;
}

const count = (grid, idx) => {
  const k = new Array(7).fill(0);
  for (const c of idx) k[grid.cells[c]]++;
  return k;
};

// ── The readings ────────────────────────────────────────────────────────────────────────────────

/** The grounds a reading may change (water is drawn as water, which the photo does not tell better). */
export const READ_GROUNDS = Object.freeze(['béton', 'bitume', 'herbe', 'gazon', 'terre', 'sable', 'gravier']);

/**
 * THE REAL GROUND OF A ZONE, or null to keep its own: what most of its metres show, shadows and roofs set
 * aside (they say nothing of the ground), when they are enough (40 % of the Zone). Green: grass ('gazon',
 * unless already a grass); light: paving ('béton'). Never asphalt (below).
 */
export function groundOfZone(grid, zone){
  if (!READ_GROUNDS.includes(zone.terrainType)) return null;
  const idx = cellsOfMask(grid, zone.world && zone.world.masque);
  if (idx.length < 20) return null;
  const k = count(grid, idx);
  const green = k[C.TREE] + k[C.LAWN], light = k[C.LIGHT], dark = k[C.ASPHALT] + k[C.GREY];
  const told = green + light + dark;
  if (told < 0.4 * idx.length) return null;
  let ground = null;
  if (green >= 0.5 * told) ground = ['herbe', 'gazon'].includes(zone.terrainType) ? zone.terrainType : 'gazon';
  else if (light >= 0.5 * told) ground = 'béton';
  // ⚠️ NO ASPHALT IS READ (seen at the Comédie: the opera's terrace, a light paving in the opera's shadow,
  // read bluish and turned black). A shaded paving and an asphalt look alike from above.
  return ground && ground !== zone.terrainType ? ground : null;
}

/**
 * A ROOF'S MATERIAL, or null when the photo does not tell: what most of its metres show (its edge set
 * aside: a metre there may be the street), shadows and greenery aside. 'tiles' (55 %) or 'grey' (65 %:
 * zinc, a terrace, a gravel roof).
 */
export function roofOfBuilding(grid, outline){
  const inside = new Set(cellsInside(grid, outline));
  const n = grid.n;
  const core = [...inside].filter(c => inside.has(c - 1) && inside.has(c + 1) && inside.has(c - n) && inside.has(c + n));
  const k = count(grid, core);
  const tiles = k[C.TILES], grey = k[C.LIGHT] + k[C.GREY] + k[C.ASPHALT];
  const told = tiles + grey;
  if (told < 6 || told < 0.5 * core.length) return null;
  if (tiles >= 0.55 * told) return 'tiles';
  if (grey >= 0.65 * told) return 'grey';
  return null;
}

/** The connected groups of the cells kept by `keep(cell)` (4-neighbours): [[cell…]…]. */
function groups(grid, keep){
  const n = grid.n, seen = new Uint8Array(n * n), out = [];
  for (let c = 0; c < n * n; c++) {
    if (seen[c] || !keep(c)) continue;
    const g = [], stack = [c];
    seen[c] = 1;
    while (stack.length) {
      const d = stack.pop();
      g.push(d);
      const i = d % n, j = (d - i) / n;
      for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {
        if (a < 0 || b < 0 || a >= n || b >= n) continue;
        const e = b * n + a;
        if (!seen[e] && keep(e)) { seen[e] = 1; stack.push(e); }
      }
    }
    out.push(g);
  }
  return out;
}

/** A tree's crown, seen from above (m²): a canopy this large holds one tree. */
export const CROWN_AREA = 35;
/** The smallest canopy read as a tree (m²): smaller, a bush or noise. */
export const SMALLEST_CANOPY = 8;
/** A read tree's height (m): a crown of 35 m² is a street or park tree of about 8 m. */
export const READ_TREE_HEIGHT = 8;
/** The most trees a reading adds. */
export const MOST_TREES = 300;

/**
 * THE TREES OPENSTREETMAP LACKS: the canopies (groups of dark-green metres, 8 m² or more) outside the
 * buildings (`taken`: cells not to use) and away from the mapped trees (`trees`: [{x, z}], 3 m), each
 * holding one tree per crown (35 m²), spread over it (the farthest from those already placed). Returns
 * [{ x, z }].
 */
export function missingTrees(grid, { taken = new Set(), trees = [] } = {}){
  const n = grid.n;
  const nearMapped = new Set();
  for (const t of trees) {
    const c = cellOf(grid, t.x, t.z);
    for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
      const a = c.i + di, b = c.j + dj;
      if (a >= 0 && b >= 0 && a < n && b < n && di * di + dj * dj <= 9) nearMapped.add(b * n + a);
    }
  }
  const canopies = groups(grid, (c) => grid.cells[c] === C.TREE && !taken.has(c));
  const out = [];
  for (const g of canopies.sort((a, b) => b.length - a.length)) {
    if (g.length < SMALLEST_CANOPY || out.length >= MOST_TREES) continue;
    const free = g.filter(c => !nearMapped.has(c));
    if (free.length < SMALLEST_CANOPY) continue;
    const want = Math.max(1, Math.round(free.length / CROWN_AREA));
    const pts = free.map(c => centreOf(grid, c % n, (c - (c % n)) / n));
    const mid = pts.reduce((s, p) => ({ x: s.x + p.x / pts.length, z: s.z + p.z / pts.length }), { x: 0, z: 0 });
    const placed = [pts.reduce((best, p) => (Math.hypot(p.x - mid.x, p.z - mid.z) < Math.hypot(best.x - mid.x, best.z - mid.z) ? p : best))];
    while (placed.length < want) {
      let far = null, d0 = -1;
      for (const p of pts) {
        const d = Math.min(...placed.map(q => Math.hypot(p.x - q.x, p.z - q.z)));
        if (d > d0) { d0 = d; far = p; }
      }
      placed.push(far);
    }
    for (const p of placed) if (out.length < MOST_TREES) out.push({ x: p.x, z: p.z });
  }
  return out;
}

/** The smallest lawn read (m²): smaller, a staircase of metres more than a lawn (seen at the Comédie). */
export const SMALLEST_LAWN = 25;

/**
 * THE LAWNS NO ZONE COVERS (a courtyard's, a garden's): the groups of light-green metres (25 m² or more)
 * outside the buildings and the Zones (`taken`), as ONE painted Zone's mask ({ pas, x0, z0, nx, nz, plein },
 * terrain-zone-pinceau.js), or null.
 */
export function lawnMask(grid, { taken = new Set() } = {}){
  const n = grid.n;
  const kept = groups(grid, (c) => grid.cells[c] === C.LAWN && !taken.has(c)).filter(g => g.length >= SMALLEST_LAWN).flat();
  if (!kept.length) return null;
  let i0 = n, j0 = n, i1 = -1, j1 = -1;
  for (const c of kept) { const i = c % n, j = (c - i) / n; i0 = Math.min(i0, i); j0 = Math.min(j0, j); i1 = Math.max(i1, i); j1 = Math.max(j1, j); }
  const nx = i1 - i0 + 1, nz = j1 - j0 + 1, set = new Set(kept);
  let plein = '';
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) plein += set.has(j * n + i) ? '1' : '0';
  return { pas: 1, x0: -grid.halfSize + i0, z0: -grid.halfSize + j0, nx, nz, plein };
}

// ── The whole reading, on an import ─────────────────────────────────────────────────────────────

/**
 * READS THE PHOTO ON AN IMPORT'S TRANSLATION (translateOsm's result, changed in place): the Zones' real
 * grounds, the missing trees (as Elements), the lawns no Zone covers (one more Zone), the roofs no source
 * describes. `south`: barrel tiles (building-survey.js). Returns what changed: { grounds, trees, lawn, roofs }
 * (counts; `lawn` in m²).
 */
export function readAerialPhoto(grid, translated, { south = false } = {}){
  const summary = { grounds: 0, trees: 0, lawn: 0, roofs: 0 };
  // Where the buildings stand: no tree, no lawn there.
  const taken = new Set();
  const outlines = translated.buildings.map(e => outlineOf(e));
  for (const o of outlines) for (const c of cellsInside(grid, o)) taken.add(c);
  // The Zones' grounds; their cells are not the courtyards' lawns.
  const zoneCells = new Set(taken);
  for (const z of translated.zones) {
    const g = groundOfZone(grid, z);
    if (g) { z.terrainType = g; summary.grounds++; }
    for (const c of cellsOfMask(grid, z.world && z.world.masque)) zoneCells.add(c);
  }
  // The missing trees.
  const mapped = translated.elements.filter(e => e.objType === 'arbre');
  for (const t of missingTrees(grid, { taken, trees: mapped })) {
    translated.elements.push({ objType: 'arbre', x: Math.round(t.x * 10) / 10, z: Math.round(t.z * 10) / 10, height: READ_TREE_HEIGHT, aerial: true });
    summary.trees++;
  }
  // The lawns no Zone covers.
  const lawn = lawnMask(grid, { taken: zoneCells });
  if (lawn) {
    const w = lawn.nx * lawn.pas, h = lawn.nz * lawn.pas;
    translated.zones.push({ terrainType: 'gazon', aerial: true, world: { cx: lawn.x0 + w / 2, cz: lawn.z0 + h / 2, w, h, rotY: 0,
      corners: [{ x: lawn.x0, z: lawn.z0 }, { x: lawn.x0 + w, z: lawn.z0 }, { x: lawn.x0 + w, z: lawn.z0 + h }, { x: lawn.x0, z: lawn.z0 + h }], masque: lawn } });
    summary.lawn = [...lawn.plein].filter(ch => ch === '1').length;
  }
  // The roofs no source describes.
  translated.buildings.forEach((e, k) => {
    if (e.roofKnown) return;
    const kind = roofOfBuilding(grid, outlines[k]);
    const finish = kind && roofFinishRead(kind, south);
    if (!finish) return;
    const top = e.building.niveaux.reduce((p, q) => (q.elevation > p.elevation ? q : p));
    // A flat roof keeps its grey: only a pitched roof takes the photo's material.
    if (!top.toit || top.toit.type === 'plat') return;
    top.toit.revetement = finish;
    summary.roofs++;
  });
  return summary;
}

/** A building's outline in the zone's frame (its ground floor's walls). */
function outlineOf(entry){
  const b = entry.building;
  const ground = b.niveaux.reduce((p, q) => (q.elevation < p.elevation ? q : p));
  return b.murs.filter(m => m.niveauId === ground.id).map(m => ({ x: entry.x + m.a.x, z: entry.z + m.a.z }));
}
