/**
 * src/landmarks.js: THE LANDMARKS THE IGN SURVEYS (#482d, France): crosses, calvaries, wind turbines, relay masts
 * and bell towers, from the BD TOPO's « constructions ponctuelles » (`BDTOPO_V3:construction_ponctuelle`, points,
 * their `nature` and, often, their `hauteur`). Things OSM maps seldom. PURE.
 *
 * Measured on 15 Nov. 2026 (Géoplateforme, no key), around a dozen places: Clocher (64; 10 to 40 m high), Croix
 * (25 to 78), Antenne (12 to 225 m), Eolienne (126 to 178 m, Picardy and Champagne), Calvaire (1 or 2), and
 * Cheminée, Phare, Minaret, Transformateur, « Autre construction élevée », left out (no object for them).
 *
 * Each becomes an element `{ objType, x, z, height?, source }` like OSM's furniture, its surveyed height when
 * the survey gives one. One OSM already maps (the same object within SAME_PLACE metres) is not added twice, but
 * takes the surveyed height when it has none.
 */
import { projector } from './geo-local.js';

/** The surveyed natures kept, and the built-in object each becomes. */
export const LANDMARK_OBJECTS = Object.freeze({
  Croix: 'croix', Calvaire: 'calvaire', Eolienne: 'eolienne', 'Éolienne': 'eolienne', Antenne: 'antenne', Clocher: 'clocher',
});

/** Within this distance (m) an OSM object of the same kind is the same landmark (a wind turbine's: its rotor). */
const SAME_PLACE = { croix: 10, calvaire: 10, antenne: 15, clocher: 15, eolienne: 40 };

/** A surveyed height within these bounds (m) is kept; else the object's own. */
const HEIGHTS = { croix: [1, 15], calvaire: [2, 20], eolienne: [40, 260], antenne: [6, 300], clocher: [8, 120] };

/**
 * The landmarks of a WFS answer (GeoJSON points) around `centre`, within the zone (`halfSize`), not already in
 * `existing` (elements { objType, x, z }): the new elements.
 */
export function readLandmarks(geojson, centre, { halfSize = Infinity, existing = [] } = {}) {
  const { toLocal } = projector(centre);
  const out = [];
  for (const f of (geojson && Array.isArray(geojson.features)) ? geojson.features : []) {
    const p = (f && f.properties) || {};
    const objType = LANDMARK_OBJECTS[p.nature];
    const c = f && f.geometry && f.geometry.type === 'Point' ? f.geometry.coordinates : null;
    if (!objType || !Array.isArray(c) || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const q = toLocal({ lat: c[1], lon: c[0] });
    if (Math.abs(q.x) > halfSize || Math.abs(q.z) > halfSize) continue;
    const near = SAME_PLACE[objType];
    const [lo, hi] = HEIGHTS[objType];
    const height = Number.isFinite(p.hauteur) && p.hauteur >= lo && p.hauteur <= hi ? p.hauteur : null;
    const same = [...existing, ...out].find(e => e.objType === objType && Math.hypot(e.x - q.x, e.z - q.z) < near);
    // The same landmark OSM maps: its surveyed height given to it when it has none (seen: a 215 m wind turbine
    // standing at the object's 150).
    if (same) { if (height && !(same.height > 0)) same.height = height; continue; }
    const e = { objType, x: Math.round(q.x * 100) / 100, z: Math.round(q.z * 100) / 100, source: 'bdtopo' };
    if (height) e.height = height;
    out.push(e);
  }
  return out;
}
