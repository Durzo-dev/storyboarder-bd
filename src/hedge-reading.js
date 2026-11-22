/**
 * @file hedge-reading.js
 * THE HEDGES OF A PLACE, READ ON THE LIDAR (France, « Detailed » and « Realistic »): those OSM and the BD TOPO
 * have not mapped (gardens, mostly). The MNH (height-reading.js: the height above the ground every 50 cm) shows a
 * hedge as a RIDGE: a line of cells raised 0.5 to 5 m, much lower a few metres away on both sides. Those cells,
 * out of the buildings, the roads and the known barriers, and of what the LiDAR's classes say is a building or
 * nothing it could name (a parked car), gathered, then each long enough part followed as a line (its longest
 * path, then the longest through what is left). PURE.
 *
 * Measured (22 Nov. 2026, Sare to set, Plouguerneau to check; durzo-docs): the LiDAR finds the hedges, but not
 * the walls: a wall is mostly read as vegetation (covered, or lined with it) or as ground, retaining walls and
 * fences not at all. Decided by Durzo: a ridge in doubt is a hedge; walls stay OSM's.
 *
 * Frames: the grid's (height-reading.js), local metres around the zone's centre, x east, z south.
 */

/** A ridge rises this much at least above the ground (m), and at most this much (higher: trees, buildings). */
export const MIN_RISE = 0.5;
export const MAX_RISE = 5;
/** How far a ridge's sides are read (m), and how low they are there: under this share of its height. */
const REACH = 3;
const SIDE_SHARE = 0.7;
/** The shortest hedge kept (m). */
export const MIN_LENGTH = 10;
/** How far from a building's outline, beyond a road's or a known barrier's half width, nothing is read (m). */
const CLEAR = 0.5;
/** A hedge running within this much (m) of a longer one along this share of it is the same hedge: left out. */
const ALONGSIDE = 2.5;
const ALONGSIDE_SHARE = 0.7;
/** A line's points every metre. */
function densify(pts){
  const out = [pts[0]];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k], L = Math.hypot(b.x - a.x, b.z - a.z);
    for (let d = 1; d < L; d += 1) out.push({ x: a.x + (b.x - a.x) * d / L, z: a.z + (b.z - a.z) * d / L });
    out.push(b);
  }
  return out;
}
/** The most hedges read in a zone. */
export const MOST_HEDGES = 200;

/**
 * THE LIDAR'S CLASSES (WMS `IGNF_LIDAR-HD_CLASS`, its palette, measured on its answers): ground, low and higher
 * vegetation, building, « perennial above-ground » (a wall, a mast); transparent: nothing named (a car, a
 * passer-by). A ridge may stand on vegetation, the ground or above-ground; not on a building, nor on nothing.
 */
const PALETTE = [[207, 150, 70, 'ground'], [70, 150, 60, 'vegetation'], [90, 110, 40, 'vegetation'], [255, 0, 255, 'above'], [180, 20, 20, 'building']];
/** The class of a pixel of the class map (RGBA): 'ground', 'vegetation', 'above', 'building', or null (unknown). */
function classOf(r, g, b, a){
  if (a < 128) return null;
  const k = PALETTE.find(([pr, pg, pb]) => Math.abs(pr - r) + Math.abs(pg - g) + Math.abs(pb - b) <= 24);
  return k ? k[3] : null;
}
/** May a ridge stand on this pixel of the class map (RGBA)? Unknown colours: no. */
export function hedgeMayStand(r, g, b, a){
  const c = classOf(r, g, b, a);
  return c === 'ground' || c === 'vegetation' || c === 'above';
}
/**
 * May a WALL be read there (parcel-fences.js)? The ground or « perennial above-ground »: not vegetation (a hedge),
 * nor a building (its eaves), nor nothing named (a car).
 */
export function wallMayStand(r, g, b, a){
  const c = classOf(r, g, b, a);
  return c === 'ground' || c === 'above';
}
/** The cells where a ridge may stand, from the class map (`{ width, height, data }`, RGBA) over the grid `g`. */
export function hedgeCells(map, g){
  return cellsWhere(map, g, hedgeMayStand);
}
/** The cells where a wall may be read (wallMayStand), likewise. */
export function wallCells(map, g){
  return cellsWhere(map, g, wallMayStand);
}
function cellsWhere(map, g, may){
  if (!map || !g || !(map.width > 0) || !(map.height > 0)) return null;
  const out = new Uint8Array(g.n * g.n);
  for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) {
    const u = Math.min(map.width - 1, Math.floor((i + 0.5) * map.width / g.n)), v = Math.min(map.height - 1, Math.floor((j + 0.5) * map.height / g.n));
    const k = (v * map.width + u) * 4;
    out[j * g.n + i] = may(map.data[k], map.data[k + 1], map.data[k + 2], map.data[k + 3]) ? 1 : 0;
  }
  return out;
}

function insidePolygon(p, q){
  let d = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    if ((q[i].z > p.z) !== (q[j].z > p.z) && p.x < (q[j].x - q[i].x) * (p.z - q[i].z) / (q[j].z - q[i].z) + q[i].x) d = !d;
  }
  return d;
}
function distanceToSegment(p, a, b){
  const dx = b.x - a.x, dz = b.z - a.z, l = dx * dx + dz * dz;
  const t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
function distanceToPolyline(p, pts, closed = false){
  let d = Infinity;
  const n = pts.length;
  for (let k = 1; k < n + (closed ? 1 : 0); k++) d = Math.min(d, distanceToSegment(p, pts[k - 1], pts[k % n]));
  return d;
}
const boxOf = (pts, m) => pts.reduce((b, q) => ({ x0: Math.min(b.x0, q.x - m), x1: Math.max(b.x1, q.x + m), z0: Math.min(b.z0, q.z - m), z1: Math.max(b.z1, q.z + m) }),
  { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });
const inBox = (p, b) => p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1;

/** Douglas-Peucker: the points of `pts` that keep it within `tol` metres. */
function simplify(pts, tol){
  if (pts.length < 3) return pts.slice();
  let best = -1, k = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distanceToSegment(pts[i], pts[0], pts[pts.length - 1]);
    if (d > best) { best = d; k = i; }
  }
  if (best <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, k + 1), tol).slice(0, -1), ...simplify(pts.slice(k), tol)];
}

/**
 * The ridge cells of the grid `g` ({ n, step, halfSize, h }): raised MIN_RISE to MAX_RISE, and lower by half at
 * REACH metres on both sides along one of four directions (under SIDE_SHARE of its height). A Uint8Array mask.
 */
export function ridgeMask(g){
  const { n, step, h } = g;
  const r = Math.max(1, Math.round(REACH / step));
  const at = (i, j) => (i >= 0 && j >= 0 && i < n && j < n ? h[j * n + i] : NaN);
  const low = (v, top) => Number.isFinite(v) && v < Math.max(0.3, top * SIDE_SHARE);
  const mask = new Uint8Array(n * n);
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = h[j * n + i];
    if (!(v >= MIN_RISE && v <= MAX_RISE)) continue;
    for (const [dx, dz] of dirs) {
      const k = dx && dz ? Math.max(1, Math.round(r / Math.SQRT2)) : r;
      if (low(at(i + dx * k, j + dz * k), v) && low(at(i - dx * k, j - dz * k), v)) { mask[j * n + i] = 1; break; }
    }
  }
  return mask;
}

/**
 * The hedges read on the heights `g`, out of the obstacles: `rings` (building outlines) and `lines` ({ pts, half }:
 * roads, paths, the known barriers), and only where `cells` (hedgeCells) allows, when given. `[{ pts: [{x, z}…],
 * rise, width }]` (metres), the longest first, MOST_HEDGES at most.
 */
export function readHedges(g, { rings = [], lines = [], cells = null } = {}){
  if (!g || !(g.n > 0)) return [];
  const { n, step, halfSize, h } = g;
  const mask = ridgeMask(g);
  if (cells) for (let c = 0; c < mask.length; c++) if (!cells[c]) mask[c] = 0;
  const centre = (c) => ({ x: -halfSize + ((c % n) + 0.5) * step, z: -halfSize + (Math.floor(c / n) + 0.5) * step });
  // Out of the buildings and away from the lines (their box first: most cells are far from most obstacles).
  const rb = rings.filter(q => Array.isArray(q) && q.length >= 3).map(q => ({ q, b: boxOf(q, CLEAR) }));
  const lb = lines.filter(l => l && Array.isArray(l.pts) && l.pts.length >= 2).map(l => ({ l, m: (l.half || 0) + CLEAR, b: boxOf(l.pts, (l.half || 0) + CLEAR) }));
  for (let c = 0; c < mask.length; c++) {
    if (!mask[c]) continue;
    const p = centre(c);
    if (rb.some(({ q, b }) => inBox(p, b) && (insidePolygon(p, q) || distanceToPolyline(p, q, true) < CLEAR))
      || lb.some(({ l, m, b }) => inBox(p, b) && distanceToPolyline(p, l.pts) < m)) mask[c] = 0;
  }
  const neighbours = (c) => {
    const i = c % n, j = Math.floor(c / n), out = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const a = i + dx, b = j + dz;
      if (a >= 0 && b >= 0 && a < n && b < n && mask[b * n + a]) out.push(b * n + a);
    }
    return out;
  };
  // The farthest cell from `from` within `cells` (a Set), walking the mask: { far, prev } (prev: the way back).
  const walk = (from, cells) => {
    const dist = new Map([[from, 0]]), prev = new Map(), queue = [from];
    let far = from;
    for (let k = 0; k < queue.length; k++) {
      const c = queue[k];
      for (const d of neighbours(c)) {
        if (!cells.has(d) || dist.has(d)) continue;
        dist.set(d, dist.get(c) + 1); prev.set(d, c); queue.push(d);
        if (dist.get(d) > dist.get(far)) far = d;
      }
    }
    return { far, prev };
  };
  const found = [];
  const seen = new Uint8Array(n * n);
  const minCells = Math.ceil(MIN_LENGTH / step), reach = Math.max(1, Math.round(REACH / step));
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    // A part: its cells.
    const part = [s];
    seen[s] = 1;
    for (let k = 0; k < part.length; k++) for (const d of neighbours(part[k])) if (!seen[d]) { seen[d] = 1; part.push(d); }
    if (part.length < minCells) continue;
    const left = new Set(part);
    // Its longest path, then the longest through what is left, as long as one is long enough.
    while (left.size >= minCells && found.length < MOST_HEDGES * 2) {
      const start = left.values().next().value;
      const a = walk(start, left).far;
      const { far: b, prev } = walk(a, left);
      const path = [b];
      while (path[path.length - 1] !== a) path.push(prev.get(path[path.length - 1]));
      const pts = path.map(centre);
      let length = 0;
      for (let k = 1; k < pts.length; k++) length += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
      // The cells it takes: those of what is left within REACH of its cells (its width), removed.
      const taken = [];
      for (const c of path) {
        const i = c % n, j = Math.floor(c / n);
        for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) {
          const d = (j + dz) * n + i + dx;
          if (i + dx >= 0 && i + dx < n && left.has(d)) { left.delete(d); taken.push(d); }
        }
      }
      if (length < MIN_LENGTH) continue;   // its cells are gone: the loop goes on with the rest
      const rises = path.map(c => h[c]).sort((x, y) => x - y);
      const rise = rises[Math.floor(rises.length / 2)];
      const width = Math.max(step, taken.length * step * step / length);
      found.push({ pts: simplify(pts, 2 * step).map(p => ({ x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 })),
        rise: Math.round(rise * 10) / 10, width: Math.round(width * 10) / 10, length });
    }
  }
  // Two ridges side by side are one hedge (seen in Plouguerneau: a wide hedge read as two crests, drawn as one
  // thick block): the shorter goes when most of it runs within ALONGSIDE of a longer one.
  const kept = [];
  for (const f of found.sort((x, y) => y.length - x.length)) {
    const near = (p) => kept.some(k => distanceToPolyline(p, k.pts) <= ALONGSIDE);
    const dense = densify(f.pts);
    if (dense.filter(near).length >= ALONGSIDE_SHARE * dense.length) continue;
    kept.push(f);
  }
  return kept.slice(0, MOST_HEDGES).map(({ length, ...b }) => b);
}
