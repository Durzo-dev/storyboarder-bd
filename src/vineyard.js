/**
 * src/vineyard.js: A VINEYARD'S STOCKS (#481b): where each vine stands in a vineyard Zone, in rows. PURE.
 *
 * A vineyard is a Zone of earth with `vines` ({ angle }: the rows' direction, radians, from x toward z): its stocks
 * are not Elements (thousands of them would weigh down the Project and its lists) but drawn at render time as copies
 * of a few generated vines (vineyard-3d.js). Rows VINE_ROW_GAP apart, a stock every VINE_STEP along a row (a common
 * planting, 2 to 2.5 m by 1 to 1.2 m), only on the Zone's own cells; never more than MAX_VINES: the step along the
 * rows grows instead (the rows stay).
 */

export const VINE_ROW_GAP = 2.2;
export const VINE_STEP = 1.1;
export const MAX_VINES = 8000;

/** The direction of a parcel's rows: its longest side's (radians, atan2 of z over x), within [0, π). */
export function vineRowAngle(ring) {
  let best = 0, angle = 0;
  for (let i = 0; i + 1 < (ring || []).length; i++) {
    const a = ring[i], b = ring[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L > best) { best = L; angle = Math.atan2(b.z - a.z, b.x - a.x); }
  }
  angle = ((angle % Math.PI) + Math.PI) % Math.PI;
  return Math.round(angle * 1000) / 1000;
}

/**
 * The wired runs of a vineyard's rows: each row's stocks next to one another (no gap of more than one place),
 * from half a place before its first to half a place after its last, and its posts (at both ends, and between two
 * stocks every `postEvery`). → { runs: [{ a, b }],
 * posts: [{ x, z }] }, from vineStocks' stocks.
 */
export function vineRuns(stocks, { postEvery = 5 } = {}) {
  const rows = new Map();
  for (const s of stocks || []) { if (!rows.has(s.row)) rows.set(s.row, []); rows.get(s.row).push(s); }
  const runs = [], posts = [];
  for (const list of rows.values()) {
    list.sort((a, b) => a.col - b.col);
    let start = 0;
    for (let i = 1; i <= list.length; i++) {
      if (i < list.length && list[i].col - list[i - 1].col <= 2) continue;
      const run = list.slice(start, i);
      if (run.length >= 2) {
        // The posts between two stocks (never on a trunk), the end ones half a place beyond the last stocks.
        const f = run[0], l = run[run.length - 1], half = (p, q) => ({ x: Math.round((p.x + (p.x - q.x) / 2) * 100) / 100, z: Math.round((p.z + (p.z - q.z) / 2) * 100) / 100 });
        const a = half(f, run[1]), b = half(l, run[run.length - 2]);
        runs.push({ a, b });
        posts.push(a, b);
        for (let k = postEvery; k + 1 < run.length; k += postEvery) {
          posts.push({ x: Math.round((run[k].x + run[k - 1].x) * 50) / 100, z: Math.round((run[k].z + run[k - 1].z) * 50) / 100 });
        }
      }
      start = i;
    }
  }
  return { runs, posts };
}

/** A number in [0, 1) from integers and a salt: the same stock jitters the same at each render. */
function hash(i, j, salt) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The stocks of a vineyard Zone's mask (`masque`: { pas, x0, z0, nx, nz, plein }) → [{ x, z, rotY, scale, variant }]:
 * along rows of `angle`, `gap` apart, every `step`, on its full cells; at most `max` (the step widened).
 */
export function vineStocks(masque, { angle = 0, gap = VINE_ROW_GAP, step = VINE_STEP } = {}, { max = MAX_VINES, variants = 3 } = {}) {
  const m = masque;
  if (!m || !(m.pas > 0) || !(m.nx > 0) || !(m.nz > 0) || typeof m.plein !== 'string') return [];
  const ux = Math.cos(angle), uz = Math.sin(angle), vx = -uz, vz = ux;
  const full = (x, z) => {
    const i = Math.floor((x - m.x0) / m.pas), j = Math.floor((z - m.z0) / m.pas);
    return i >= 0 && j >= 0 && i < m.nx && j < m.nz && m.plein[j * m.nx + i] === '1';
  };
  // The mask's corners in the rows' frame (u along a row, v across).
  const xs = [m.x0, m.x0 + m.nx * m.pas], zs = [m.z0, m.z0 + m.nz * m.pas];
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const x of xs) for (const z of zs) {
    const u = x * ux + z * uz, v = x * vx + z * vz;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  // Rows on a grid of the world (not of the mask): the same vineyard keeps its rows when its outline changes.
  const lay = (s) => {
    const out = [];
    for (let r = Math.ceil(v0 / gap); r * gap <= v1; r++) {
      const v = r * gap;
      for (let c = Math.ceil(u0 / s); c * s <= u1; c++) {
        const u = c * s + (hash(r, c, 0x2c1b) - 0.5) * 0.15 * s;
        const x = u * ux + v * vx, z = u * uz + v * vz;
        if (!full(x, z)) continue;
        // Turned along its row (its arms on the wire), a few degrees off; `row`, `col`: its place in the grid.
        out.push({ x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100,
          rotY: Math.round((-angle + (hash(r, c, 0x51ed) - 0.5) * 0.12) * 1000) / 1000,
          scale: Math.round((0.92 + 0.16 * hash(r, c, 0x7a3f)) * 100) / 100,
          variant: 1 + Math.floor(hash(r, c, 0x9e37) * variants), row: r, col: c });
        if (out.length > max) return null;
      }
    }
    return out;
  };
  for (let s = step, k = 0; k < 30; k++, s *= 1.15) {
    const out = lay(s);
    if (out) return out;
  }
  return [];
}
