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

/** The paths an object may not stand on, with their width when the path has none (m). */
export const OBSTACLE_PATHS = Object.freeze({ route: LARGEUR_PAR_DEFAUT_M.route, riviere: LARGEUR_PAR_DEFAUT_M.riviere,
  muret: 0.5, cloture: 0.1, haie: 1, barriere: 0.1 });

/** How far an object's base keeps from an obstacle (m): a trunk and its foot; anything else, its own footprint. */
export function clearanceOf(objType) {
  return TREE_TYPES.includes(objType) ? 1 : 0.4;
}

/**
 * What may stand against a building: a street lamp is often on a facade (OSM puts it on the outline). Pushed
 * out of the footprint, it went into the road and was left out (seen: 2 lamps of the quai de la Tournelle).
 */
export const AGAINST_BUILDINGS = Object.freeze(['lampadaire']);

/** How far an object may be moved (m). Beyond, it is left out. */
export const MAX_SHIFT_M = 4;

const PASSES = 6;

/** The obstacles of a translated place: { rings, lines } (lines with their half width). */
export function obstaclesOf(translated) {
  const rings = (translated.buildings || []).map(b => b.footprint).filter(f => Array.isArray(f) && f.length >= 3);
  const lines = [];
  for (const p of translated.paths || []) {
    if (!(p.kind in OBSTACLE_PATHS) || !p.world || !Array.isArray(p.world.pts) || p.world.pts.length < 2) continue;
    lines.push({ pts: p.world.pts, half: (p.world.width > 0 ? p.world.width : OBSTACLE_PATHS[p.kind]) / 2 });
  }
  return { rings, lines };
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
