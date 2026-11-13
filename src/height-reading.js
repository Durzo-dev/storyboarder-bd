/**
 * @file height-reading.js
 * THE HEIGHTS OF A PLACE FROM THE IGN'S LIDAR (#477d; study: durzo-docs toits-lidar.md): the MNH, the height
 * above the ground every 50 cm (roofs, trees), read at the import (Detailed and Realistic, France) for each
 * building's real eaves height and roof (flat or pitched, its pitch, its ridge's direction, two or four
 * slopes), and each tree's height. The grid is fetched by the main process (real-place.js heightGrid),
 * read here and dropped. PURE.
 *
 * Frames: local metres around the zone's centre, x east, z south; the grid's row 0 is the north, its cell
 * (i, j) the square whose centre is (-h + (i + 0.5)·step, -h + (j + 0.5)·step).
 */

/** The ground resolution asked (metres per cell): the MNH's own. */
export const HEIGHT_STEP = 0.5;
/** The largest side asked (cells). */
const MAX_CELLS = 2048;
/** The credit of the IGN's LiDAR HD (Licence Ouverte Etalab 2.0). */
export const LIDAR_CREDIT = Object.freeze({ en: 'Heights: © IGN, LiDAR HD (Licence Ouverte 2.0)', fr: 'Hauteurs : © IGN, LiDAR HD (Licence Ouverte 2.0)' });

/** The grid to ask for a zone, or null (outside France). Returns { bbox, width, height } (as aerialPhotoPlan). */
export function heightPlan({ toGeo, halfSize, country }){
  if (country !== 'fr' || !(halfSize > 0) || typeof toGeo !== 'function') return null;
  const nw = toGeo({ x: -halfSize, z: -halfSize }), se = toGeo({ x: halfSize, z: halfSize });
  const side = Math.min(MAX_CELLS, Math.max(16, Math.round(2 * halfSize / HEIGHT_STEP)));
  return { bbox: { south: se.lat, west: nw.lon, north: nw.lat, east: se.lon }, width: side, height: side };
}

/** The grid from the service's floats (`h`, row by row from the north) over a zone of half-side `halfSize`. */
export function heightGrid(h, width, halfSize){
  if (!h || !(width > 0) || h.length !== width * width) return null;
  return { n: width, step: 2 * halfSize / width, halfSize, h };
}

const at = (g, i, j) => (i >= 0 && j >= 0 && i < g.n && j < g.n ? g.h[j * g.n + i] : NaN);
const ok = (v) => Number.isFinite(v) && v > -2 && v < 400;
function quantile(sorted, q){
  if (!sorted.length) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
}
function insidePolygon(p, q){
  let d = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    if ((q[i].z > p.z) !== (q[j].z > p.z) && p.x < (q[j].x - q[i].x) * (p.z - q[i].z) / (q[j].z - q[i].z) + q[i].x) d = !d;
  }
  return d;
}

/** The grid's cells inside an outline (zone frame): [[i, j]…]. */
function cellsInside(g, outline){
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of outline) { x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); z1 = Math.max(z1, p.z); }
  const out = [];
  const i0 = Math.max(0, Math.floor((x0 + g.halfSize) / g.step)), i1 = Math.min(g.n - 1, Math.floor((x1 + g.halfSize) / g.step));
  const j0 = Math.max(0, Math.floor((z0 + g.halfSize) / g.step)), j1 = Math.min(g.n - 1, Math.floor((z1 + g.halfSize) / g.step));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (insidePolygon({ x: -g.halfSize + (i + 0.5) * g.step, z: -g.halfSize + (j + 0.5) * g.step }, outline)) out.push([i, j]);
  }
  return out;
}

/** Below this rise (top − eaves, metres) a roof is flat (a parapet, chimneys, a lift's housing). */
export const FLAT_RISE = 1.2;
/**
 * The share of slopes across the main one above which a roof is hipped (four slopes). MEASURED on Eguisheim's
 * MNH: gabled roofs 0.02 to 0.10; a 20 × 10 m hipped roof 0.12 to 0.25; but an L or U-shaped building reads
 * 0.16 to 0.22 too (its wings' slopes cross): only a nearly convex footprint is read as hipped.
 */
const HIP_SHARE = 0.12;
/** A footprint this convex (its area over its hull's) or more may be hipped. */
const HIP_CONVEXITY = 0.9;

const area = (q) => Math.abs(q.reduce((s, p, i) => { const r = q[(i + 1) % q.length]; return s + p.x * r.z - r.x * p.z; }, 0) / 2);
/** The convex hull of points (monotone chain). */
function hull(points){
  const p = points.slice().sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * A BUILDING'S ROOF FROM THE HEIGHTS, or null when the grid does not tell (too small, no data, nothing above
 * 2 m there: a building gone or not yet built). `outline`: its footprint in the zone frame. Returns
 * { eaves, top, flat, pitch, hip, ridge }: the eaves and top heights (metres above the ground: the 10th and
 * 95th percentiles of what stands above 2 m in it), flat or not, the pitch (degrees, the median slope of
 * its core: its edge, 1 m wide, aside), hipped or gabled (slopes across the main one), the ridge's
 * direction (unit {x, z}, across the main slope).
 */
export function roofFromHeights(g, outline){
  if (!g || !outline || outline.length < 3) return null;
  const cells = cellsInside(g, outline);
  if (cells.length * g.step * g.step < 12) return null;
  const hs = cells.map(([i, j]) => at(g, i, j)).filter(v => ok(v) && v > 2).sort((a, b) => a - b);
  if (hs.length < 0.5 * cells.length) return null;
  const top = quantile(hs, 0.95), eaves = quantile(hs, 0.1);
  const r1 = (v) => Math.round(v * 10) / 10;
  if (top - eaves < FLAT_RISE) return { eaves: r1(quantile(hs, 0.5)), top: r1(top), flat: true, pitch: 0, hip: false, ridge: null };
  // The slopes of the core (a metre inside the edge): the edge mixes the street and the eaves.
  const inside = new Set(cells.map(([i, j]) => j * g.n + i));
  const m = Math.max(1, Math.round(1 / g.step));
  let c2 = 0, s2 = 0, w = 0;
  const slopes = [], axes = [];
  for (const [i, j] of cells) {
    if (![[i - m, j], [i + m, j], [i, j - m], [i, j + m]].every(([a, b]) => inside.has(b * g.n + a))) continue;
    const gx = (at(g, i + 1, j) - at(g, i - 1, j)) / (2 * g.step), gz = (at(g, i, j + 1) - at(g, i, j - 1)) / (2 * g.step);
    const s = Math.hypot(gx, gz);
    if (!Number.isFinite(s) || s < 0.15 || s > 2.5) continue;   // flat bits, steps and walls aside
    const a = Math.atan2(gz, gx);
    slopes.push(s); axes.push(a);
    c2 += s * Math.cos(2 * a); s2 += s * Math.sin(2 * a); w += s;
  }
  if (slopes.length < 10) return { eaves: r1(eaves), top: r1(top), flat: false, pitch: 30, hip: false, ridge: null };
  // (A sorted COPY: `slopes[k]` stays the slope of `axes[k]`, read below.)
  const sorted = slopes.slice().sort((a, b) => a - b);
  const pitch = Math.round(Math.min(60, Math.max(10, Math.atan(quantile(sorted, 0.5)) * 180 / Math.PI)));
  const phi = 0.5 * Math.atan2(s2, c2);   // the main slope's axis
  // The slopes across it (within 30° of the perpendicular): a hipped roof's ends.
  let across = 0;
  axes.forEach((a, k) => {
    let d = Math.abs(((a - phi) % Math.PI + Math.PI) % Math.PI);
    if (d > Math.PI / 2) d = Math.PI - d;
    if (d > Math.PI / 3) across += slopes[k];
  });
  return {
    eaves: r1(eaves), top: r1(top), flat: false, pitch,
    hip: across / w > HIP_SHARE && area(outline) >= HIP_CONVEXITY * area(hull(outline)),
    ridge: { x: Math.round(-Math.sin(phi) * 1000) / 1000, z: Math.round(Math.cos(phi) * 1000) / 1000 },
  };
}

/**
 * The `sens` of a gabled roof (batiment-toits.js: its ridge along the longest side, 0, or across it, 1) for a
 * ridge's direction, on a footprint (any frame).
 */
export function ridgeSense(outline, ridge){
  if (!ridge || !outline || outline.length < 2) return 0;
  let best = null;
  outline.forEach((a, k) => {
    const b = outline[(k + 1) % outline.length], L = Math.hypot(b.x - a.x, b.z - a.z);
    if (!best || L > best.L) best = { L, x: (b.x - a.x) / (L || 1), z: (b.z - a.z) / (L || 1) };
  });
  const along = Math.abs(best.x * ridge.x + best.z * ridge.z), across = Math.abs(-best.z * ridge.x + best.x * ridge.z);
  return along >= across ? 0 : 1;
}

/** A tree's height: the highest within 2 m of its trunk, or undefined (no data, under 3 m: a bush, a young tree). */
export function treeHeightAt(g, x, z){
  if (!g) return undefined;
  const i0 = Math.floor((x + g.halfSize) / g.step), j0 = Math.floor((z + g.halfSize) / g.step);
  const r = Math.round(2 / g.step);
  let top = -Infinity;
  for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (di * di + dj * dj > r * r) continue;
    const v = at(g, i0 + di, j0 + dj);
    if (ok(v)) top = Math.max(top, v);
  }
  return top >= 3 && top <= 40 ? Math.round(top * 10) / 10 : undefined;
}
