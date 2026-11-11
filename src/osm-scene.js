/**
 * @file osm-scene.js
 * #457b-2, THE OSM TRANSLATOR: an OpenStreetMap extract becomes what a Scene is made of. PURE: no network,
 * no DOM, no ids; tested on real extracts (tests/fixtures/osm-*.json).
 *
 * Input: an Overpass answer (`out geom`: each way carries its `geometry`, as `{lat, lon}` or `[lat, lon]`),
 * the centre of the zone and its half side (metres). Output, in METRES in the Scene's frame (x to the
 * east, z to the SOUTH, as the top view: north is up):
 *   - buildings: COMPLETE buildings (walls per level from the footprint, levels from `building:levels` or
 *     `height`, else a default per type; roof from `roof:shape`, else per type; windows generated per
 *     level and per facade; a door on the facade facing the nearest road), each with its centre;
 *   - paths: roads, dirt paths, low walls, fences, hedges, barriers, rivers (`kind`, `world.pts`, width);
 *   - zones: grass, earth, sand, asphalt, water… as a painted mask (`world` as a painted Zone has it);
 *   - elements: trees and street lamps (`objType`, position).
 * The importer (#457b-4) turns these into Page objects (ids, panel, 2D frames, relief); the ground under
 * buildings is already flattened by the rendering (reliefEffectif3D).
 *
 * The defaults (level height, levels and roof per building type) are those of FRANCE; #457b-3 makes them a
 * per-country table. OSM gives no windows: they are GENERATED, a facade "inspired by", not a survey.
 */

import { creerBatiment } from './batiment.js';
import { ajouterEtage } from './batiment-niveaux.js';
import { ajouterContour } from './batiment-trace.js';
import { actualiserPieces } from './batiment-pieces.js';
import { fixerToit } from './batiment-toits.js';
import { ajouterOuverture } from './batiment-ouvertures.js';
import { mondeDuMasque } from './terrain-zone-pinceau.js';

/** The attribution OSM data requires near the work (export credits, #457b-4). */
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors, ODbL';

/** The largest zone (metres of side): the relief's largest side (COTE_MAX_DU_RELIEF − 1). */
export const ZONE_SIDE_MAX = 400;

const EARTH_RADIUS = 6371008.8;
const DEG = Math.PI / 180;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Local metres around `centre` ({lat, lon}): an equirectangular projection, exact enough on 400 m (the
 * error grows with the square of the distance: well under a centimetre here). x to the east, z to the south.
 */
export function projector(centre){
  const kx = EARTH_RADIUS * DEG * Math.cos(centre.lat * DEG), kz = EARTH_RADIUS * DEG;
  return {
    toLocal: (p) => ({ x: (p.lon - centre.lon) * kx, z: -(p.lat - centre.lat) * kz }),
    toGeo: (q) => ({ lat: centre.lat - q.z / kz, lon: centre.lon + q.x / kx }),
  };
}

/** A geometry point, whether Overpass `{lat, lon}` or the compact `[lat, lon]`. */
function geoPoint(p){
  if (Array.isArray(p)) return finite(p[0]) && finite(p[1]) ? { lat: p[0], lon: p[1] } : null;
  return p && finite(p.lat) && finite(p.lon) ? { lat: p.lat, lon: p.lon } : null;
}

const round = (v) => Math.round(v * 1000) / 1000;
const roundPoint = (p) => ({ x: round(p.x), z: round(p.z) });

/**
 * THE FRENCH DEFAULTS (#457b-3 turns them into a per-country table). Levels and roof per `building`
 * value; the rest falls back on `default`. A level of 2.8 m, as the building editor's default.
 */
export const DEFAULT_RULES = Object.freeze({
  levelHeight: 2.8,
  levels: { house: 2, detached: 2, semidetached_house: 2, terrace: 2, residential: 3, apartments: 4, hotel: 4,
    commercial: 2, retail: 1, office: 4, industrial: 1, warehouse: 1, garage: 1, garages: 1, shed: 1, hut: 1,
    church: 3, chapel: 2, school: 2, government: 3, public: 2, farm_auxiliary: 1, barn: 1, default: 2 },
  flatRoofs: ['commercial', 'retail', 'office', 'industrial', 'warehouse', 'garage', 'garages', 'school', 'government', 'public', 'supermarket'],
  roofPitch: 35,
});

/** OSM `roof:shape` → the building editor's roof types. Unknown: the default for the building type. */
const ROOF_SHAPES = { flat: 'plat', gabled: 'deux-pans', hipped: 'quatre-pans', 'half-hipped': 'quatre-pans',
  pyramidal: 'quatre-pans', skillion: 'un-pan', mansard: 'quatre-pans', gambrel: 'deux-pans', saltbox: 'deux-pans' };

const ROADS = { motorway: 10, trunk: 9, primary: 8, secondary: 7, tertiary: 6.5, unclassified: 5, residential: 5,
  living_street: 4.5, service: 3.5, road: 5, pedestrian: 5,
  motorway_link: 5, trunk_link: 5, primary_link: 5, secondary_link: 5, tertiary_link: 5 };
const DIRT_PATHS = { footway: 1.5, path: 1.2, track: 3, cycleway: 2, bridleway: 2, steps: 1.5 };
const BARRIERS = { wall: 'muret', retaining_wall: 'muret', city_wall: 'muret', fence: 'cloture', hedge: 'haie',
  guard_rail: 'barriere', railing: 'barriere' };
const WATERWAYS = { river: 8, canal: 6, stream: 2, ditch: 1, drain: 1 };
const ZONE_TYPES = {
  grass: 'herbe', meadow: 'herbe', village_green: 'herbe', recreation_ground: 'herbe', forest: 'herbe', wood: 'herbe',
  scrub: 'herbe', heath: 'herbe', grassland: 'herbe', cemetery: 'herbe',
  park: 'gazon', garden: 'gazon', pitch: 'gazon', golf_course: 'gazon',
  farmland: 'terre', orchard: 'terre', vineyard: 'terre', allotments: 'terre', construction: 'terre', brownfield: 'terre',
  sand: 'sable', beach: 'sable',
  water: 'eau', basin: 'eau', reservoir: 'eau',
  parking: 'bitume',
};
/** The mask step of an imported Zone (metres): a 400 m zone stays under 160 000 cells. */
const ZONE_STEP = 1;

// ── Geometry ────────────────────────────────────────────────────────────────────────────────────

function signedArea(pts){
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.z - b.x * a.z; }
  return s / 2;
}

/** A closed footprint cleaned: no closing duplicate, no point closer than 30 cm, no near-straight corner. */
export function cleanFootprint(pts){
  const p = pts.slice();
  if (p.length > 1 && Math.hypot(p[0].x - p[p.length - 1].x, p[0].z - p[p.length - 1].z) < 1e-6) p.pop();
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length && p.length > 3; i++) {
      const a = p[(i - 1 + p.length) % p.length], b = p[i], c = p[(i + 1) % p.length];
      const ab = Math.hypot(b.x - a.x, b.z - a.z), bc = Math.hypot(c.x - b.x, c.z - b.z);
      // Twice the triangle's area over the base: b's distance to the line a–c.
      const ac = Math.hypot(c.x - a.x, c.z - a.z);
      const dist = ac > 1e-9 ? Math.abs((c.x - a.x) * (a.z - b.z) - (a.x - b.x) * (c.z - a.z)) / ac : 0;
      if (ab < 0.3 || bc < 0.3 || dist < 0.08) { p.splice(i, 1); changed = true; i--; }
    }
  }
  return p.length >= 3 ? p : null;
}

function insidePolygon(p, q){
  let inside = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    if ((q[i].z > p.z) !== (q[j].z > p.z) && p.x < (q[j].x - q[i].x) * (p.z - q[i].z) / (q[j].z - q[i].z) + q[i].x) inside = !inside;
  }
  return inside;
}

function distanceToPolyline(p, pts){
  let d = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
    d = Math.min(d, Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz)));
  }
  return d;
}

/**
 * A polyline clipped to the square |x|, |z| ≤ h: the pieces that lie inside (Liang–Barsky per segment,
 * consecutive pieces joined). Each piece has at least two points.
 */
export function clipPolyline(pts, h){
  const pieces = [];
  let current = null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    let t0 = 0, t1 = 1;
    const dx = b.x - a.x, dz = b.z - a.z;
    const clip = (p, q) => {
      if (p === 0) return q >= 0;
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
      return true;
    };
    if (!(clip(-dx, a.x + h) && clip(dx, h - a.x) && clip(-dz, a.z + h) && clip(dz, h - a.z))) { if (current) { pieces.push(current); current = null; } continue; }
    const u = { x: a.x + dx * t0, z: a.z + dz * t0 }, v = { x: a.x + dx * t1, z: a.z + dz * t1 };
    if (!current) current = [u];
    else if (Math.hypot(u.x - current[current.length - 1].x, u.z - current[current.length - 1].z) > 1e-6) { pieces.push(current); current = [u]; }
    current.push(v);
    if (t1 < 1) { pieces.push(current); current = null; }
  }
  if (current) pieces.push(current);
  return pieces.filter(p => p.length >= 2 && p.some((q, i) => i > 0 && Math.hypot(q.x - p[i - 1].x, q.z - p[i - 1].z) > 0.05));
}

/** A polygon as a painted Zone mask (cells of ZONE_STEP), clipped to the square of half side h; null if empty. */
export function maskOfPolygon(poly, h, step = ZONE_STEP){
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of poly) { x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); z1 = Math.max(z1, p.z); }
  x0 = Math.max(-h, Math.floor(x0 / step) * step); z0 = Math.max(-h, Math.floor(z0 / step) * step);
  x1 = Math.min(h, Math.ceil(x1 / step) * step); z1 = Math.min(h, Math.ceil(z1 / step) * step);
  const nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step);
  if (nx <= 0 || nz <= 0) return null;
  let full = '', any = false;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const inside = insidePolygon({ x: x0 + (i + 0.5) * step, z: z0 + (j + 0.5) * step }, poly);
    full += inside ? '1' : '0';
    if (inside) any = true;
  }
  return any ? { pas: step, x0, z0, nx, nz, plein: full } : null;
}

// ── Buildings ───────────────────────────────────────────────────────────────────────────────────

/** How many levels, and how high each: `building:levels`, else `height`, else the type's default. */
export function levelsOf(tags, rules = DEFAULT_RULES){
  const levels = parseInt(tags['building:levels'], 10);
  const height = parseFloat(tags.height);
  const type = tags.building;
  let n = levels >= 1 ? levels : (height > 0 ? Math.max(1, Math.round(height / rules.levelHeight)) : (rules.levels[type] || rules.levels.default));
  n = Math.min(n, 40);
  let levelHeight = rules.levelHeight;
  if (height > 0 && levels >= 1) levelHeight = height / levels;
  return { count: n, height: Math.min(10, Math.max(2, levelHeight)) };
}

/** The roof type: `roof:shape`, else flat for commercial and public types, else gabled (France). */
export function roofOf(tags, rules = DEFAULT_RULES){
  const shape = ROOF_SHAPES[tags['roof:shape']];
  if (shape) return shape;
  return rules.flatRoofs.includes(tags.building) ? 'plat' : 'deux-pans';
}

/**
 * Windows on every wall of 2 m or more, at a regular step (one per 2.6 m); on the ground floor, a door in
 * the middle of the wall (1.5 m or more) that faces the nearest road (`doorWallId`). An opening the editor refuses (too
 * wide, overlapping) is skipped: a facade "inspired by".
 */
function generateOpenings(b, doorWallId){
  const levels = b.niveaux.slice().sort((p, q) => p.elevation - q.elevation);
  const ground = levels[0] && levels[0].id;
  for (const wall of b.murs.slice()) {
    const length = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
    const isDoorWall = wall.id === doorWallId && wall.niveauId === ground;
    if (isDoorWall) ajouterOuverture(b, wall.id, 0.5, { type: 'porte', largeur: 0.9, hauteur: 2.1, y: 0 });
    if (length < 2) continue;
    const n = Math.max(1, Math.floor((length - 0.8) / 2.6));
    for (let i = 0; i < n; i++) {
      const le = (i + 0.5) / n;
      if (isDoorWall && Math.abs(le - 0.5) * length < 1.2) continue;
      ajouterOuverture(b, wall.id, le, { type: 'fenetre', largeur: 1, hauteur: 1.3, y: 0.9 });
    }
  }
}

/**
 * A complete building from a cleaned footprint (local metres, centred), its tags and the world position of
 * its centre; `roads` (world polylines) to put the door on the side of the street. Returns the building, or
 * null if the editor refuses its walls (a footprint that crosses itself).
 */
export function buildingOf(footprint, tags, centre, roads = [], rules = DEFAULT_RULES, translate = null){
  const t = translate || ((en, fr) => fr);
  const name = tags.name || (tags['addr:housenumber'] && tags['addr:street'] ? `${tags['addr:housenumber']} ${tags['addr:street']}` : t('Building', 'Bâtiment'));
  const b = creerBatiment(name, t);
  const { count, height } = levelsOf(tags, rules);
  b.niveaux[0].hauteur = height;
  for (let k = 1; k < count; k++) ajouterEtage(b, t);
  for (const level of b.niveaux) {
    const r = ajouterContour(b, level.id, footprint, 0.2);
    if (r.erreur) return null;
    actualiserPieces(b, level.id, t);
  }
  const top = b.niveaux.reduce((p, q) => (q.elevation > p.elevation ? q : p));
  fixerToit(b, top.id, { type: roofOf(tags, rules), pente: rules.roofPitch });
  // The door: on the ground-floor wall whose middle is the nearest to a road.
  let doorWallId = null, best = Infinity;
  // Only a wall wide enough for a door (1.5 m: 0.9 m and its jambs).
  for (const wall of b.murs.filter(m => m.niveauId === b.niveaux[0].id && Math.hypot(m.b.x - m.a.x, m.b.z - m.a.z) >= 1.5)) {
    const mid = { x: centre.x + (wall.a.x + wall.b.x) / 2, z: centre.z + (wall.a.z + wall.b.z) / 2 };
    for (const road of roads) { const d = distanceToPolyline(mid, road); if (d < best) { best = d; doorWallId = wall.id; } }
  }
  generateOpenings(b, doorWallId);
  return b;
}

// ── The extract ─────────────────────────────────────────────────────────────────────────────────

/** The `kind` and width of a way that is a path (road, dirt path, wall, river), or null. */
export function pathKindOf(tags){
  if (tags.tunnel && tags.tunnel !== 'no') return null;   // under the ground: not drawn
  const width = parseFloat(tags.width);
  if (tags.highway && tags.area !== 'yes') {
    if (ROADS[tags.highway]) return { kind: 'route', width: width > 0 ? width : ROADS[tags.highway], marking: !['pedestrian', 'service', 'living_street'].includes(tags.highway) };
    if (DIRT_PATHS[tags.highway]) return { kind: 'chemin', width: width > 0 ? width : DIRT_PATHS[tags.highway] };
  }
  if (BARRIERS[tags.barrier]) return { kind: BARRIERS[tags.barrier] };
  if (WATERWAYS[tags.waterway]) return { kind: 'riviere', width: width > 0 ? width : WATERWAYS[tags.waterway] };
  return null;
}

/** The ground of a closed way that is a Zone, or null. */
export function zoneTypeOf(tags){
  if (tags.amenity === 'parking') return 'bitume';
  if (tags.highway === 'pedestrian' && tags.area === 'yes') return 'bitume';
  return ZONE_TYPES[tags.landuse] || ZONE_TYPES[tags.leisure] || ZONE_TYPES[tags.natural] || null;
}

/**
 * Translates an Overpass extract. `centre`: {lat, lon}; `halfSize`: half the side of the zone (metres, at
 * most ZONE_SIDE_MAX / 2). Returns { buildings, paths, zones, elements, skipped, attribution }.
 */
export function translateOsm(data, { centre, halfSize = ZONE_SIDE_MAX / 2, rules = DEFAULT_RULES, translate = null } = {}){
  const h = Math.min(Math.max(1, halfSize), ZONE_SIDE_MAX / 2);
  const { toLocal } = projector(centre);
  const out = { buildings: [], paths: [], zones: [], elements: [], skipped: { outside: 0, invalid: 0, tunnels: 0, relations: 0 }, attribution: OSM_ATTRIBUTION };
  const ways = [];
  for (const e of (data && data.elements) || []) {
    const tags = e.tags || {};
    if (e.type === 'relation') { out.skipped.relations++; continue; }
    if (e.type === 'node') {
      const g = geoPoint(e), p = g && toLocal(g);
      if (!p || Math.abs(p.x) > h || Math.abs(p.z) > h) continue;
      const objType = tags.natural === 'tree' ? 'arbre' : tags.highway === 'street_lamp' ? 'lampadaire' : null;
      if (objType) out.elements.push({ objType, x: round(p.x), z: round(p.z), osmId: e.id });
      continue;
    }
    if (e.type !== 'way' || !Array.isArray(e.geometry)) continue;
    const pts = e.geometry.map(geoPoint);
    if (pts.some(p => !p)) { out.skipped.invalid++; continue; }
    ways.push({ id: e.id, tags, pts: pts.map(toLocal) });
  }
  const roads = [];
  for (const w of ways) {
    if (w.tags.building) continue;
    const kind = pathKindOf(w.tags);
    if (!kind) { if (w.tags.tunnel && w.tags.tunnel !== 'no') out.skipped.tunnels++; continue; }
    for (const piece of clipPolyline(w.pts, h)) {
      const world = { pts: piece.map(roundPoint) };
      if (kind.width) world.width = kind.width;
      const path = { kind: kind.kind, world, osmId: w.id };
      if (w.tags.name) path.name = w.tags.name;
      if (kind.marking === false) path.marking = false;
      out.paths.push(path);
      if (kind.kind === 'route' || kind.kind === 'chemin') roads.push(piece);
    }
  }
  for (const w of ways) {
    const closed = w.pts.length >= 4 && Math.hypot(w.pts[0].x - w.pts[w.pts.length - 1].x, w.pts[0].z - w.pts[w.pts.length - 1].z) < 0.01;
    if (w.tags.building && closed) {
      const fp = cleanFootprint(w.pts);
      if (!fp || Math.abs(signedArea(fp)) < 4) { out.skipped.invalid++; continue; }
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const p of fp) { x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); z1 = Math.max(z1, p.z); }
      const centreOf = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
      if (Math.abs(centreOf.x) > h || Math.abs(centreOf.z) > h) { out.skipped.outside++; continue; }
      const local = fp.map(p => roundPoint({ x: p.x - centreOf.x, z: p.z - centreOf.z }));
      const building = buildingOf(local, w.tags, centreOf, roads, rules, translate);
      if (!building) { out.skipped.invalid++; continue; }
      out.buildings.push({ building, x: round(centreOf.x), z: round(centreOf.z), osmId: w.id });
      continue;
    }
    const ground = closed && zoneTypeOf(w.tags);
    if (ground) {
      const mask = maskOfPolygon(w.pts, h);
      if (!mask) { out.skipped.outside++; continue; }
      const zone = { terrainType: ground, world: mondeDuMasque(mask), osmId: w.id };
      if (w.tags.name) zone.name = w.tags.name;
      out.zones.push(zone);
    }
  }
  return out;
}
