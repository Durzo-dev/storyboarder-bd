/**
 * src/placement-clearance.js: AN IMPORTED OBJECT STANDS CLEAR OF BUILDINGS AND OF WHAT BARS THE WAY (asked by
 * Durzo on 15 Nov. 2026: trees seen inside a small house and astride low walls). Pure.
 *
 * OSM puts a tree or a bench where it is, but our buildings, roads and walls are drawn from other surveys and
 * widths guessed: a trunk lands inside a footprint, on a carriageway, on a wall. Each object is pushed out, to the
 * nearest place where its base clears them all (CLEARANCE_M from it), a few metres at most; one that cannot be
 * cleared within MAX_SHIFT_M is left out (better no tree than a tree in a wall).
 *
 * Obstacles: building footprints (world, from translateOsm), and the paths that bar the way (OBSTACLE_PATHS),
 * their half width. Pavements and footpaths are not: street trees and furniture stand on them.
 */
import { insidePolygon, nearestOnPolyline } from './osm-scene.js';
import { LARGEUR_PAR_DEFAUT_M } from './terrain-plan.js';
import { TREE_TYPES } from './constants.js';
import { encombrementDuBatiment } from './batiment-element.js';

/** The paths an object may not stand on, with their width when the path has none (m). */
export const OBSTACLE_PATHS = Object.freeze({ route: LARGEUR_PAR_DEFAUT_M.route, riviere: LARGEUR_PAR_DEFAUT_M.riviere,
  muret: 0.5, cloture: 0.1, haie: 1, barriere: 0.1 });

/** How far an object's base keeps from an obstacle (m): a trunk and its foot; anything else, its own footprint. */
export function clearanceOf(objType) {
  return TREE_TYPES.includes(objType) ? 1 : 0.4;
}

/**
 * What may stand against a building, or in it: a street lamp is often on a facade (OSM puts it on the outline;
 * pushed out of the footprint, it went into the road and was left out: seen, 2 lamps of the quai de la
 * Tournelle); a bell tower stands within its church (#482d), rising out of its roof.
 */
export const AGAINST_BUILDINGS = Object.freeze(['lampadaire', 'clocher']);

/** How far an object may be moved (m). Beyond, it is left out. */
export const MAX_SHIFT_M = 4;

const PASSES = 6;

/** The obstacles of a translated place: { rings, heights, lines } (a ring's building height; lines with their half width). */
export function obstaclesOf(translated) {
  const built = (translated.buildings || []).filter(b => Array.isArray(b.footprint) && b.footprint.length >= 3);
  const rings = built.map(b => b.footprint);
  const heights = built.map(b => (b.building ? encombrementDuBatiment(b.building).hauteur : Infinity));
  const lines = [];
  for (const p of translated.paths || []) {
    if (!(p.kind in OBSTACLE_PATHS) || !p.world || !Array.isArray(p.world.pts) || p.world.pts.length < 2) continue;
    lines.push({ pts: p.world.pts, half: (p.world.width > 0 ? p.world.width : OBSTACLE_PATHS[p.kind]) / 2 });
  }
  return { rings, heights, lines };
}

/** Where `p` must go to clear one obstacle by `r`, or null if it already does. */
function pushOut(p, r, ring, line) {
  if (ring) {
    const edge = nearestOnPolyline(p, ring.concat([ring[0]]));
    const inside = insidePolygon(p, ring);
    const d = Math.hypot(p.x - edge.x, p.z - edge.z);
    if (!inside && d >= r) return null;
    // Outwards: from the edge away from the inside (inside, the way from p to the edge).
    let ux = inside ? edge.x - p.x : p.x - edge.x, uz = inside ? edge.z - p.z : p.z - edge.z;
    const l = Math.hypot(ux, uz) || 1;
    ux /= l; uz /= l;
    return { x: edge.x + ux * r, z: edge.z + uz * r };
  }
  const { q, a, b } = nearestSegment(p, line.pts);
  const need = line.half + r, d = Math.hypot(p.x - q.x, p.z - q.z);
  if (d >= need) return null;
  // Away from the line; on it exactly, across it (the segment's normal).
  let ux = p.x - q.x, uz = p.z - q.z;
  if (d < 1e-6) { ux = -(b.z - a.z); uz = b.x - a.x; }
  const l = Math.hypot(ux, uz) || 1;
  return { x: q.x + ux / l * need, z: q.z + uz / l * need };
}

/** The point of a polyline nearest to `p`, with its segment. */
function nearestSegment(p, pts) {
  let best = null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const q = nearestOnPolyline(p, [pts[i], pts[i + 1]]), d = Math.hypot(p.x - q.x, p.z - q.z);
    if (!best || d < best.d) best = { q, d, a: pts[i], b: pts[i + 1] };
  }
  return best;
}

/** Whether `p` clears every obstacle by `r` (a hair's tolerance). */
function clears(p, r, { rings, lines }) {
  return rings.every(ring => !pushOut(p, r - 1e-6, ring, null)) && lines.every(line => !pushOut(p, r - 1e-6, null, line));
}

/**
 * Moves each element clear of the obstacles, in place. Returns { moved, removed } and drops the elements that
 * cannot be cleared within MAX_SHIFT_M from `elements`.
 */
export function clearOfObstacles(elements, obstacles) {
  let moved = 0, removed = 0;
  if (!Array.isArray(elements)) return { moved, removed };
  const kept = [];
  for (const e of elements) {
    const r = clearanceOf(e.objType);
    const own = AGAINST_BUILDINGS.includes(e.objType) ? { rings: [], lines: obstacles.lines } : obstacles;
    const start = { x: e.x, z: e.z };
    let p = { ...start };
    for (let k = 0; k < PASSES && !clears(p, r, own); k++) {
      for (const ring of own.rings) p = pushOut(p, r, ring, null) || p;
      for (const line of own.lines) p = pushOut(p, r, null, line) || p;
    }
    const shift = Math.hypot(p.x - start.x, p.z - start.z);
    if (!clears(p, r, own) || shift > MAX_SHIFT_M) { removed++; continue; }
    if (shift > 0) { e.x = Math.round(p.x * 100) / 100; e.z = Math.round(p.z * 100) / 100; moved++; }
    kept.push(e);
  }
  elements.splice(0, elements.length, ...kept);
  return { moved, removed };
}

// ─── Trees apart (asked by Durzo on 16 Nov. 2026: trunks seen in each other) ─────────────────────────────────

/**
 * How close two tree trunks may stand (m). Measured in imports: pairs 0.45 to 1.5 m apart (sc16366, sc15727), from
 * several sources at once and from the moves above; real street trees stand 5 to 10 m apart, a tree row's 8.
 */
export const TREE_GAP_M = 2.5;

/** Is `p` at least TREE_GAP_M from every tree of `others` but `self`? */
function apartFromTrees(p, others, self) {
  return others.every(o => o === self || Math.hypot(o.x - p.x, o.z - p.z) >= TREE_GAP_M);
}

/**
 * Keeps the trees TREE_GAP_M apart, in place: walking the elements in their order (OSM's first, then the rows, the
 * filled areas, the aerial photo's), a tree closer than that to one already kept is left out. Shrubs and the rest are
 * not trees. Returns how many were left out.
 */
export function spaceTrees(elements) {
  if (!Array.isArray(elements)) return 0;
  const kept = [], trees = [];
  let removed = 0;
  for (const e of elements) {
    if (TREE_TYPES.includes(e.objType)) {
      if (!apartFromTrees(e, trees, null)) { removed++; continue; }
      trees.push(e);
    }
    kept.push(e);
  }
  elements.splice(0, elements.length, ...kept);
  return removed;
}

// ─── The crowns of the generated trees (asked by Durzo: crowns seen through a small house's roof) ─────────────

/** The turns tried for a crown (a crown leans: turned, it may clear the building). */
export const CROWN_TURNS = 8;
/** The variants tried for a tree of ours (EZ-Tree grows another tree from another seed). */
export const CROWN_VARIANTS = 8;
/** The shifts tried (m), each in 8 directions; the largest is MAX_SHIFT_M. */
const CROWN_SHIFTS = [1, 2, 3, MAX_SHIFT_M];

/** Points of a crown in the plan: its outline, the middles of its sides, and the outline halved. */
function crownSamples(crown, heightM, x, z, rotY) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  // three's turn about Y: (x, z) → (x cos + z sin, −x sin + z cos).
  const at = (q, k) => ({ x: x + (q.x * c + q.z * s) * heightM * k, z: z + (-q.x * s + q.z * c) * heightM * k });
  const h = crown.hull, out = [];
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    out.push(at(a, 1), at({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, 1), at(a, 0.5));
  }
  return out;
}

/** How many of a crown's points are inside a building higher than the crown's foot. */
function crownHits(points, baseM, { rings, heights }) {
  let n = 0;
  for (const p of points) {
    for (let i = 0; i < rings.length; i++) if (heights[i] > baseM && insidePolygon(p, rings[i])) { n++; break; }
  }
  return n;
}

/**
 * Keeps the crowns of our generated trees (`essence`) out of the buildings they would cross (a building lower than
 * where the crown starts is no matter). For each, in this order, the first that clears: turned (CROWN_TURNS),
 * moved a few metres (CROWN_SHIFTS, its trunk still clear), then another variant (CROWN_VARIANTS), turned and
 * moved likewise. None: left as it was. `crownOf(essence, variant)`: { hull, base } for a tree 1 high
 * (ez-trees.js). Changes `rotY`, `x`, `z`, `variante` in place; returns how many were turned, moved, regrown,
 * and how many still cross.
 */
export function fitCrowns(elements, obstacles, crownOf) {
  const n = { turned: 0, moved: 0, regrown: 0, crossing: 0 };
  for (const e of elements || []) {
    if (!e.essence || !(e.height > 0)) continue;
    const r = clearanceOf(e.objType), rot0 = Number.isFinite(e.rotY) ? e.rotY : 0, v0 = e.variante || 1;
    const trees = (elements || []).filter(o => TREE_TYPES.includes(o.objType));
    const fits = (v, x, z, rot) => {
      const crown = crownOf(e.essence, v);
      return crownHits(crownSamples(crown, e.height, x, z, rot), crown.base * e.height, obstacles) === 0;
    };
    if (fits(v0, e.x, e.z, rot0)) continue;
    const variants = [v0, ...Array.from({ length: CROWN_VARIANTS }, (_, i) => i + 1).filter(v => v !== v0)];
    let found = null;
    search: for (const v of variants) {
      for (const d of [0, ...CROWN_SHIFTS]) {
        for (let a = 0; a < (d ? 8 : 1); a++) {
          const x = e.x + d * Math.cos(a * Math.PI / 4), z = e.z + d * Math.sin(a * Math.PI / 4);
          // Moved: its trunk still clear, and not against another tree's.
          if (d && (!clears({ x, z }, r, obstacles) || !apartFromTrees({ x, z }, trees, e))) continue;
          for (let t = 0; t < CROWN_TURNS; t++) {
            const rot = rot0 + t * 2 * Math.PI / CROWN_TURNS;
            if (fits(v, x, z, rot)) { found = { v, x, z, rot, d }; break search; }
          }
        }
      }
    }
    if (!found) { n.crossing++; continue; }
    if (found.v !== v0) { e.variante = found.v; n.regrown++; } else if (found.d) n.moved++; else n.turned++;
    e.rotY = Math.round(found.rot * 1000) / 1000;
    e.x = Math.round(found.x * 100) / 100; e.z = Math.round(found.z * 100) / 100;
  }
  return n;
}
