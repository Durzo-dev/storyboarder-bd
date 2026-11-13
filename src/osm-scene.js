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
 * The defaults (level height, levels and roof per building type) come from the country's table
 * (real-place-sources.js). OSM gives no windows: they are GENERATED, a facade "inspired by", not a survey.
 */

import { creerBatiment } from './batiment.js';
import { ajouterEtage } from './batiment-niveaux.js';
import { ajouterContour } from './batiment-trace.js';
import { actualiserPieces } from './batiment-pieces.js';
import { fixerToit } from './batiment-toits.js';
import { ajouterOuverture } from './batiment-ouvertures.js';
import { mondeDuMasque } from './terrain-zone-pinceau.js';
import { projector } from './geo-local.js';
import { rulesFor } from './real-place-sources.js';
import { facadeStyleOf } from './facade-style.js';
import { monumentOf } from './monuments.js';
import { roofFromHeights, ridgeSense } from './height-reading.js';
/** A level's floor slab (batiment.js DEFAUTS_BATIMENT.dalle): a measured eaves height is levels and slabs. */
const LEVEL_SLAB = 0.2;
import { BDTOPO_ATTRIBUTION, matchSurvey, buildingTypeOf, surveyedRoof, wallFinishOf, roofFinishOf } from './building-survey.js';

/** The attribution OSM data requires near the work (export credits, #457b-4). */
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors, ODbL';

/** The largest zone (metres of side): the relief's largest side (COTE_MAX_DU_RELIEF − 1). */
export const ZONE_SIDE_MAX = 400;

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** A geometry point, whether Overpass `{lat, lon}` or the compact `[lat, lon]`. */
function geoPoint(p){
  if (Array.isArray(p)) return finite(p[0]) && finite(p[1]) ? { lat: p[0], lon: p[1] } : null;
  return p && finite(p.lat) && finite(p.lon) ? { lat: p.lat, lon: p.lon } : null;
}

const round = (v) => Math.round(v * 1000) / 1000;
const roundPoint = (p) => ({ x: round(p.x), z: round(p.z) });

/** OSM `roof:shape` → the building editor's roof types. Unknown: the default for the building type. */
const ROOF_SHAPES = { flat: 'plat', gabled: 'deux-pans', hipped: 'quatre-pans', 'half-hipped': 'quatre-pans',
  pyramidal: 'quatre-pans', skillion: 'un-pan', mansard: 'quatre-pans', gambrel: 'deux-pans', saltbox: 'deux-pans' };

const ROADS = { motorway: 10, trunk: 9, primary: 8, secondary: 7, tertiary: 6.5, unclassified: 5, residential: 5,
  living_street: 4.5, service: 3.5, road: 5, pedestrian: 5,
  motorway_link: 5, trunk_link: 5, primary_link: 5, secondary_link: 5, tertiary_link: 5 };
/**
 * The roads that wear a centre line when OSM gives no lane count: the main roads, two-way. A residential
 * street, a lane, a service road have none in France (seen: dashes down every village street).
 */
const MARKED_ROADS = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link',
  'primary_link', 'secondary_link', 'tertiary_link'];

/** Does this road wear a centre line? `lanes` first (2 or more: yes; 1: no), else its type, never one-way. */
export function markingOf(tags){
  const lanes = parseInt(tags.lanes, 10);
  if (lanes >= 2) return true;
  if (lanes === 1 || tags.oneway === 'yes' || tags.oneway === '-1') return false;
  return MARKED_ROADS.includes(tags.highway);
}

/**
 * A built-up zone (buildings over this share of its ground) stands on a paved Ground, not on grass (seen:
 * grass between the blocks of a city centre). Under it (a suburb, a village with gardens): grass, as before.
 */
const BUILT_UP = 0.25;
/** The paved Ground of a built-up zone, and the covering of a flat roof OSM and the survey say nothing of. */
const URBAN_GROUND = 'béton', FLAT_ROOF = '#8f8b84';

/** A pavement's width when OSM gives none (metres): a common French pavement. */
const SIDEWALK_WIDTH = 1.8;

/**
 * The sides of a road that have a pavement drawn WITH the road (`sidewalk`, `sidewalk:both|left|right`):
 * { left, right } (OSM's left and right, along the way's direction). `separate` or `no`: none (a pavement
 * mapped as its own way comes as a `footway=sidewalk`).
 */
export function sidewalkSides(tags){
  const yes = (v) => v === 'yes';
  const s = tags.sidewalk;
  let left = s === 'both' || s === 'left' || s === 'yes', right = s === 'both' || s === 'right' || s === 'yes';
  if (yes(tags['sidewalk:both'])) left = right = true;
  if (yes(tags['sidewalk:left'])) left = true;
  if (yes(tags['sidewalk:right'])) right = true;
  if (tags['sidewalk:left'] === 'no' || tags['sidewalk:left'] === 'separate') left = false;
  if (tags['sidewalk:right'] === 'no' || tags['sidewalk:right'] === 'separate') right = false;
  return { left, right };
}

/**
 * A polyline moved sideways by `d` metres (positive: to its left, along its direction; x to the east, z to the
 * south), each corner on the bisector of its two segments (the shift bounded at a sharp corner).
 */
export function offsetPolyline(pts, d){
  const n = pts.length, out = [];
  const normal = (a, b) => { const l = Math.hypot(b.x - a.x, b.z - a.z) || 1; return { x: (b.z - a.z) / l, z: -(b.x - a.x) / l }; };
  for (let i = 0; i < n; i++) {
    const n0 = i > 0 ? normal(pts[i - 1], pts[i]) : null, n1 = i < n - 1 ? normal(pts[i], pts[i + 1]) : null;
    let nx, nz, k = 1;
    if (n0 && n1) {
      nx = n0.x + n1.x; nz = n0.z + n1.z;
      const l = Math.hypot(nx, nz);
      if (l < 1e-6) { nx = n1.x; nz = n1.z; } else { nx /= l; nz /= l; k = Math.min(2, 1 / Math.max(0.5, nx * n1.x + nz * n1.z)); }
    } else { const m = n0 || n1; nx = m.x; nz = m.z; }
    out.push({ x: pts[i].x + nx * d * k, z: pts[i].z + nz * d * k });
  }
  return out;
}

/**
 * THE LEVELS OF DETAIL of an import (asked: richer is heavier, so one chooses), in order:
 *   - 'simple': the volumes from OSM, default roofs, roads, paths, Zones, trees and lamps;
 *   - 'detailed': and the IGN survey in France (heights, roofs, materials), materials from OSM, pavements,
 *     road signs, shrubs and benches;
 *   - 'realistic': and the facades (facade-style.js): shutters, stone surrounds, shop windows, by region.
 */
export const DETAIL_LEVELS = Object.freeze(['simple', 'detailed', 'realistic']);

/** How far from a building's outline an OSM entrance still belongs to it (metres): on it, give or take. */
const ENTRANCE_REACH = 1.5;

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

/** The distance from p to a closed ring (its edges, last to first included). */
function distanceToRing(p, ring){
  return distanceToPolyline(p, ring.concat([ring[0]]));
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

/** The point of a polyline nearest to `p`. */
function nearestOnPolyline(p, pts){
  let best = null, d0 = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
    const q = { x: a.x + t * dx, z: a.z + t * dz }, d = Math.hypot(p.x - q.x, p.z - q.z);
    if (d < d0) { d0 = d; best = q; }
  }
  return best;
}

/**
 * STREET FURNITURE FROM OSM (a node's tags → a built-in object), at the « Detailed » level: fountains,
 * bollards, litter bins, bus shelters (a stop with a shelter), with the trees, lamps, signs, shrubs and
 * benches. Null for anything else.
 */
export function furnitureOf(tags = {}){
  if (tags.natural === 'tree') return 'arbre';
  if (tags.highway === 'street_lamp') return 'lampadaire';
  if (tags.traffic_sign || tags.highway === 'stop' || tags.highway === 'give_way') return 'panneau_signalisation';
  if (tags.natural === 'shrub') return 'buisson';
  if (tags.amenity === 'bench') return 'banc';
  if (tags.amenity === 'fountain') return 'fontaine';
  if (tags.barrier === 'bollard') return 'borne';
  if (tags.amenity === 'waste_basket') return 'poubelle';
  if ((tags.highway === 'bus_stop' && tags.shelter === 'yes') || (tags.amenity === 'shelter' && tags.shelter_type === 'public_transport')) return 'abribus';
  return null;
}

/** A tree's height from OSM (`height`, metres), or undefined: the object's default then. */
function treeHeight(tags){
  const v = parseFloat(tags.height);
  return v >= 2 && v <= 40 ? v : undefined;
}
/** The spacing of the trees of a row (`natural=tree_row`), metres. */
export const TREE_ROW_SPACING = 8;
/** The largest fountain mapped as an area that is drawn as a fountain object (m²): larger, its water is a Zone. */
const FOUNTAIN_AREA_MAX = 80;

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

/**
 * How many levels, and how high each: `building:levels`, else `height`, else the surveyed eaves height
 * (building-survey.js), else the type's default.
 */
export function levelsOf(tags, rules = rulesFor('fr'), survey = null){
  const levels = parseInt(tags['building:levels'], 10);
  const height = parseFloat(tags.height);
  const type = tags.building;
  // The LiDAR's eaves height (height-reading.js), measured: OSM's count of levels kept, their height from it.
  const measured = survey && survey.lidar && survey.lidar.eaves > 2 ? survey.lidar.eaves : 0;
  if (measured) {
    const count = Math.min(40, levels >= 1 ? levels : Math.max(1, Math.round(measured / rules.levelHeight)));
    return { count, height: Math.min(10, Math.max(2, measured / count - LEVEL_SLAB)) };
  }
  if (!(levels >= 1) && !(height > 0) && survey && survey.eaves > 0) {
    const count = Math.max(1, Math.round(survey.eaves / rules.levelHeight));
    return { count, height: Math.min(10, Math.max(2, survey.eaves / count)) };
  }
  let n = levels >= 1 ? levels : (height > 0 ? Math.max(1, Math.round(height / rules.levelHeight)) : (rules.levels[type] || rules.levels.default));
  n = Math.min(n, 40);
  let levelHeight = rules.levelHeight;
  if (height > 0 && levels >= 1) levelHeight = height / levels;
  return { count: n, height: Math.min(10, Math.max(2, levelHeight)) };
}

/**
 * The roof type: `roof:shape`, else flat when the survey measures a flat roof (`surveyed`, surveyedRoof),
 * else flat for commercial and public types, else gabled (France).
 */
export function roofOf(tags, rules = rulesFor('fr'), surveyed = null){
  // The LiDAR measures the roof itself (height-reading.js): it comes before any tag.
  if (surveyed && surveyed.lidar) return surveyed.flat ? 'plat' : surveyed.hip ? 'quatre-pans' : 'deux-pans';
  const shape = ROOF_SHAPES[tags['roof:shape']];
  if (shape) return shape;
  if (surveyed) return surveyed.flat ? 'plat' : 'deux-pans';
  return rules.flatRoofs.includes(tags.building) ? 'plat' : 'deux-pans';
}

/**
 * Windows on every wall of 2 m or more, at a regular step (one per 2.6 m); on the ground floor, a door in
 * the middle of the wall (1.5 m or more) that faces the nearest road (`doorWallId`). An opening the editor refuses (too
 * wide, overlapping) is skipped: a facade "inspired by".
 */
/** A door by the kind of its OSM entrance (`entrance=*`): a garage's is wide, the others a house door. */
function doorOf(kind){
  if (kind === 'garage') return { type: 'porte', largeur: 2.4, hauteur: 2.2, y: 0, battants: 2, vitre: false };
  return { type: 'porte', largeur: kind === 'main' ? 1 : 0.9, hauteur: 2.1, y: 0 };
}

/**
 * The doors of a building: one per OSM entrance on its outline (`entrances`, local metres, with `kind`), on
 * the ground-floor wall it stands on, where it stands (asked: the doors where they really are); without any,
 * one door in the middle of the ground-floor wall nearest a road (`fallbackWallId`). [{ wallId, le, kind }].
 */
function doorsOf(b, entrances, fallbackWallId){
  const ground = b.niveaux.reduce((p, q) => (q.elevation < p.elevation ? q : p)).id;
  const walls = b.murs.filter(m => m.niveauId === ground && Math.hypot(m.b.x - m.a.x, m.b.z - m.a.z) >= 1.2);
  const doors = [];
  for (const e of entrances) {
    let best = null;
    for (const w of walls) {
      const dx = w.b.x - w.a.x, dz = w.b.z - w.a.z, l2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((e.x - w.a.x) * dx + (e.z - w.a.z) * dz) / l2));
      const d = Math.hypot(e.x - (w.a.x + t * dx), e.z - (w.a.z + t * dz));
      if (d <= ENTRANCE_REACH && (!best || d < best.d)) best = { wallId: w.id, le: t, d, length: Math.sqrt(l2) };
    }
    if (!best) continue;
    // Two entrances on the same spot of a wall (a node mapped twice, a double door): one door.
    if (doors.some(o => o.wallId === best.wallId && Math.abs(o.le - best.le) * best.length < 1.2)) continue;
    doors.push({ wallId: best.wallId, le: best.le, kind: e.kind });
  }
  if (!doors.length && fallbackWallId) doors.push({ wallId: fallbackWallId, le: 0.5, kind: 'main' });
  return doors;
}

function generateOpenings(b, doors, style = null){
  const levels = b.niveaux.slice().sort((p, q) => p.elevation - q.elevation);
  const ground = levels[0] && levels[0].id;
  // The facade's details (realistic level, facade-style.js): a surround on every opening, shutters on the windows.
  const details = (type) => {
    if (!style) return {};
    const d = {};
    if (style.surround) d.encadrement = style.surround;
    if (style.shutters && type === 'fenetre') { d.volets = true; d.couleurVolets = style.shutterColour; }
    return d;
  };
  for (const wall of b.murs.slice()) {
    const length = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
    const onWall = wall.niveauId === ground ? doors.filter(d => d.wallId === wall.id) : [];
    // A door the editor refuses where it stands (too near a corner): moved towards the middle until it fits.
    for (const d of onWall) {
      const door = { ...doorOf(d.kind), ...details('porte') };
      for (let k = 0, le = d.le; k < 6; k++, le += (0.5 - le) * 0.35) {
        if (ajouterOuverture(b, wall.id, le, door).ouverture) { d.le = le; break; }
      }
    }
    if (length < 2) continue;
    // A shop's street side, on the ground floor: shop windows instead of windows.
    const shopFront = onWall.length > 0 && style && style.shopWindows;
    const n = Math.max(1, Math.floor((length - 0.8) / 2.6));
    for (let i = 0; i < n; i++) {
      const le = (i + 0.5) / n;
      if (onWall.some(d => Math.abs(le - d.le) * length < 1.2 + (d.kind === 'garage' ? 0.8 : 0))) continue;
      if (shopFront) ajouterOuverture(b, wall.id, le, { type: 'baie', largeur: 1.8, hauteur: 2.2, y: 0, coulissant: false, battants: 1 });
      else ajouterOuverture(b, wall.id, le, { type: 'fenetre', largeur: 1, hauteur: 1.3, y: 0.9, ...details('fenetre') });
    }
  }
}

/**
 * A complete building from a cleaned footprint (local metres, centred), its tags and the world position of
 * its centre; `roads` (world polylines) to put the door on the side of the street; `survey` (or null): the
 * surveyed building it is (building-survey.js), for its heights, roof and materials where OSM says nothing.
 * Returns the building, or null if the editor refuses its walls (a footprint that crosses itself).
 */
export function buildingOf(footprint, tags, centre, roads = [], rules = rulesFor('fr'), translate = null, survey = null, finishes = true, place = null, entrances = []){
  const t = translate || ((en, fr) => fr);
  const name = tags.name || (tags['addr:housenumber'] && tags['addr:street'] ? `${tags['addr:housenumber']} ${tags['addr:street']}` : t('Building', 'Bâtiment'));
  const b = creerBatiment(name, t);
  const { count, height } = levelsOf(tags, rules, survey);
  b.niveaux[0].hauteur = height;
  for (let k = 1; k < count; k++) ajouterEtage(b, t);
  for (const level of b.niveaux) {
    const r = ajouterContour(b, level.id, footprint, 0.2);
    if (r.erreur) return null;
    actualiserPieces(b, level.id, t);
  }
  const top = b.niveaux.reduce((p, q) => (q.elevation > p.elevation ? q : p));
  const surveyed = surveyedRoof(survey, footprint);
  const roof = { type: roofOf(tags, rules, surveyed), pente: surveyed && !surveyed.flat ? surveyed.pitch : rules.roofPitch };
  // The LiDAR's ridge: along the longest side, or across it.
  if (surveyed && surveyed.ridge && roof.type === 'deux-pans') roof.sens = ridgeSense(footprint, surveyed.ridge);
  // A flat roof with no known covering: the grey of a gravel or bitumen roof, not the walls' colour.
  const roofFinish = (finishes && roofFinishOf(tags, survey)) || (roof.type === 'plat' ? { texture: null, couleur: FLAT_ROOF } : null);
  if (roofFinish) roof.revetement = roofFinish;
  fixerToit(b, top.id, roof);
  const facade = finishes ? wallFinishOf(tags, survey) : null;
  if (facade) b.facade = facade;
  // The doors: at the OSM entrances on its outline; without any, on the ground-floor wall whose middle is the
  // nearest to a road.
  let doorWallId = null, best = Infinity;
  // Only a wall wide enough for a door (1.5 m: 0.9 m and its jambs).
  for (const wall of b.murs.filter(m => m.niveauId === b.niveaux[0].id && Math.hypot(m.b.x - m.a.x, m.b.z - m.a.z) >= 1.5)) {
    const mid = { x: centre.x + (wall.a.x + wall.b.x) / 2, z: centre.z + (wall.a.z + wall.b.z) / 2 };
    for (const road of roads) { const d = distanceToPolyline(mid, road); if (d < best) { best = d; doorWallId = wall.id; } }
  }
  // Realistic (`place`: { lat, lon, seed, shop }): the facade of the building's type, height and region.
  const style = place ? facadeStyleOf({ type: tags.building, levels: count, lat: place.lat, lon: place.lon, seed: place.seed, shop: place.shop }) : null;
  const local = entrances.map(e => ({ x: e.x - centre.x, z: e.z - centre.z, kind: e.kind }));
  generateOpenings(b, doorsOf(b, local, doorWallId), style);
  return b;
}

/** The ground area of a building's level (its outer walls' outline), square metres. */
function areaOfLevel(b, levelId){
  const walls = b.murs.filter(m => m.niveauId === levelId);
  let a = 0;
  for (const m of walls) a += m.a.x * m.b.z - m.b.x * m.a.z;
  return Math.abs(a / 2);
}

// ── The extract ─────────────────────────────────────────────────────────────────────────────────

/** The `kind` and width of a way that is a path (road, dirt path, wall, river), or null. */
export function pathKindOf(tags){
  if (tags.tunnel && tags.tunnel !== 'no') return null;   // under the ground: not drawn
  const width = parseFloat(tags.width);
  if (tags.highway && tags.area !== 'yes') {
    if (ROADS[tags.highway]) return { kind: 'route', width: width > 0 ? width : ROADS[tags.highway], marking: markingOf(tags) };
    if (tags.highway === 'footway' && tags.footway === 'sidewalk') return { kind: 'trottoir', width: width > 0 ? width : SIDEWALK_WIDTH };
    if (DIRT_PATHS[tags.highway]) return { kind: 'chemin', width: width > 0 ? width : DIRT_PATHS[tags.highway] };
  }
  if (BARRIERS[tags.barrier]) return { kind: BARRIERS[tags.barrier] };
  if (WATERWAYS[tags.waterway]) return { kind: 'riviere', width: width > 0 ? width : WATERWAYS[tags.waterway] };
  return null;
}

/** The ground of an OSM `surface` value, or undefined when it has none of ours. */
const SURFACES = {
  asphalt: 'bitume', chipseal: 'bitume',
  paved: 'béton', concrete: 'béton', 'concrete:plates': 'béton', paving_stones: 'béton', sett: 'béton',
  cobblestone: 'béton', unhewn_cobblestone: 'béton', stone: 'béton', marble: 'béton', granite: 'béton',
  gravel: 'gravier', fine_gravel: 'gravier', pebblestone: 'gravier', compacted: 'gravier',
  grass: 'herbe', sand: 'sable', dirt: 'terre', ground: 'terre', earth: 'terre', mud: 'terre',
};

/** The ground of a closed way that is a Zone, or null. */
export function zoneTypeOf(tags){
  if (tags.amenity === 'parking') return SURFACES[tags.surface] || 'bitume';
  // A pedestrian square is paved, not asphalted, unless its `surface` says otherwise.
  if (tags.highway === 'pedestrian' && tags.area === 'yes') return SURFACES[tags.surface] || 'béton';
  return ZONE_TYPES[tags.landuse] || ZONE_TYPES[tags.leisure] || ZONE_TYPES[tags.natural] || null;
}

/**
 * Translates an Overpass extract. `centre`: {lat, lon}; `halfSize`: half the side of the zone (metres, at
 * most ZONE_SIDE_MAX / 2); `country` (ISO code, `fr` by default: France first) picks the default values
 * (real-place-sources.js), unless `rules` are given; `survey` (building-survey.js, readBdTopo) completes the
 * buildings; `detail` (DETAIL_LEVELS) what is made. Returns { buildings, paths, zones, elements, skipped, attribution, surveyAttribution?, builtShare,
 * ground? } (`ground`: the paved Ground of a built-up zone).
 */
export function translateOsm(data, { centre, halfSize = ZONE_SIDE_MAX / 2, country = 'fr', rules = rulesFor(country), translate = null, survey = null, detail = 'detailed', heights = null } = {}){
  const detailed = detail !== 'simple', realistic = detail === 'realistic';
  const shops = [], entrances = [];
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
      const objType = furnitureOf(tags);
      // An entrance (`entrance=*`, a node on a building's outline): its door goes where it is.
      if (tags.entrance && tags.entrance !== 'no') entrances.push({ x: p.x, z: p.z, kind: tags.entrance });
      // Realistic: a shop or a café is a point inside its building (shop windows on its ground floor).
      if (realistic && (tags.shop || ['restaurant', 'cafe', 'bar', 'pharmacy', 'bank', 'fast_food'].includes(tags.amenity))) shops.push(p);
      // Simple: the trees and lamps only.
      if (!detailed && objType !== 'arbre' && objType !== 'lampadaire') continue;
      if (objType) {
        const el = { objType, x: round(p.x), z: round(p.z), osmId: e.id };
        if (objType === 'arbre' && treeHeight(tags)) el.height = treeHeight(tags);
        out.elements.push(el);
      }
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
    const found = pathKindOf(w.tags);
    // Simple: a mapped pavement is a plain path.
    const kind = found && !detailed && found.kind === 'trottoir' ? { kind: 'chemin', width: found.width } : found;
    if (!kind) { if (w.tags.tunnel && w.tags.tunnel !== 'no') out.skipped.tunnels++; continue; }
    for (const piece of clipPolyline(w.pts, h)) {
      const world = { pts: piece.map(roundPoint) };
      if (kind.width) world.width = kind.width;
      const path = { kind: kind.kind, world, osmId: w.id };
      if (w.tags.name) path.name = w.tags.name;
      if (kind.marking === false) path.marking = false;
      out.paths.push(path);
      if (kind.kind === 'route' || kind.kind === 'chemin') roads.push(piece);
      // The pavements drawn with the road: a Path each, beside it (just past its edge).
      if (kind.kind === 'route' && detailed) {
        const sides = sidewalkSides(w.tags);
        const sw = parseFloat(w.tags['sidewalk:width'] || w.tags['sidewalk:both:width']) > 0 ? parseFloat(w.tags['sidewalk:width'] || w.tags['sidewalk:both:width']) : SIDEWALK_WIDTH;
        for (const [side, sign] of [['left', 1], ['right', -1]]) {
          if (!sides[side]) continue;
          out.paths.push({ kind: 'trottoir', world: { pts: offsetPolyline(piece, sign * (kind.width / 2 + sw / 2)).map(roundPoint), width: sw }, osmId: w.id });
        }
      }
    }
  }
  // Detailed: the rows of trees (a tree every TREE_ROW_SPACING m along the line) and the small fountains
  // mapped as areas (a fountain object at their middle).
  if (detailed) {
    for (const w of ways) {
      if (w.tags.natural === 'tree_row') {
        for (const piece of clipPolyline(w.pts, h)) {
          // `next`: the distance along the line of the next tree; `walked`: the distance at the segment's start.
          let next = 0, walked = 0;
          for (let i = 0; i + 1 < piece.length; i++) {
            const a = piece[i], b = piece[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z);
            for (; len > 0 && next <= walked + len; next += TREE_ROW_SPACING) {
              const t = (next - walked) / len;
              const el = { objType: 'arbre', x: round(a.x + (b.x - a.x) * t), z: round(a.z + (b.z - a.z) * t), osmId: w.id };
              if (treeHeight(w.tags)) el.height = treeHeight(w.tags);
              out.elements.push(el);
            }
            walked += len;
          }
        }
      }
      if (w.tags.amenity === 'fountain' && w.pts.length >= 4 && Math.abs(signedArea(w.pts)) <= FOUNTAIN_AREA_MAX) {
        const c = w.pts.slice(0, -1).reduce((m, p, _, all) => ({ x: m.x + p.x / all.length, z: m.z + p.z / all.length }), { x: 0, z: 0 });
        if (Math.abs(c.x) <= h && Math.abs(c.z) <= h) out.elements.push({ objType: 'fontaine', x: round(c.x), z: round(c.z), osmId: w.id });
      }
    }
    // A bus shelter faces its street: its open side (+z) turned towards the nearest road.
    for (const el of out.elements) {
      if (el.objType !== 'abribus' || !roads.length) continue;
      let q = null, d0 = Infinity;
      for (const r of roads) { const n2 = nearestOnPolyline(el, r); const d = n2 ? Math.hypot(n2.x - el.x, n2.z - el.z) : Infinity; if (d < d0) { d0 = d; q = n2; } }
      if (q && d0 > 0.01 && d0 < 30) el.rotY = round(Math.atan2(q.x - el.x, q.z - el.z));
    }
  }
  // The survey (building-survey.js, readBdTopo): each OSM building takes the surveyed building it is.
  const surveys = detailed && Array.isArray(survey) ? survey : [];
  const taken = new Set(), osmFootprints = [];
  for (const w of ways) {
    const closed = w.pts.length >= 4 && Math.hypot(w.pts[0].x - w.pts[w.pts.length - 1].x, w.pts[0].z - w.pts[w.pts.length - 1].z) < 0.01;
    if (w.tags.building && closed) {
      const fp = cleanFootprint(w.pts);
      if (!fp || Math.abs(signedArea(fp)) < 4) { out.skipped.invalid++; continue; }
      osmFootprints.push(fp);
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const p of fp) { x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); z1 = Math.max(z1, p.z); }
      const centreOf = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
      if (Math.abs(centreOf.x) > h || Math.abs(centreOf.z) > h) { out.skipped.outside++; continue; }
      const local = fp.map(p => roundPoint({ x: p.x - centreOf.x, z: p.z - centreOf.z }));
      const surveyed = surveys.length ? matchSurvey(fp, surveys, taken) : null;
      // The LiDAR's reading (height-reading.js): the real eaves and roof, with the survey's other facts.
      const lidar = detailed && heights ? roofFromHeights(heights, fp) : null;
      const building = buildingOf(local, w.tags, centreOf, roads, rules, translate, lidar ? { ...(surveyed || {}), lidar } : surveyed, detailed,
        realistic ? { lat: centre.lat, lon: centre.lon, seed: w.id, shop: shops.some(p => insidePolygon(p, fp)) || (surveyed && surveyed.use === 'Commercial et services') } : null,
        entrances.filter(e => distanceToRing(e, fp) <= ENTRANCE_REACH));
      if (!building) { out.skipped.invalid++; continue; }
      const entry = { building, x: round(centreOf.x), z: round(centreOf.z), osmId: w.id };
      if (surveyed) entry.surveyId = surveyed.id;
      // Its roof's material given by a source (OSM, the survey): the aerial photo leaves it (aerial-reading.js).
      if (roofFinishOf(w.tags, surveyed)) entry.roofKnown = true;
      // A known monument (monuments.js): a model may take its place, the user's choice after the import.
      const monument = detailed ? monumentOf(w.tags) : null;
      if (monument) entry.monument = monument;
      out.buildings.push(entry);
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
  // A surveyed building OSM lacks (none of its buildings holds its centre): added from the survey alone.
  for (const s of surveys) {
    if (taken.has(s.id) || osmFootprints.some(fp => insidePolygon(s.centre, fp))) continue;
    const fp = cleanFootprint(s.footprint.concat([s.footprint[0]]));
    if (!fp || Math.abs(signedArea(fp)) < 4) continue;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of fp) { x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); z1 = Math.max(z1, p.z); }
    const centreOf = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
    if (Math.abs(centreOf.x) > h || Math.abs(centreOf.z) > h) continue;
    const local = fp.map(p => roundPoint({ x: p.x - centreOf.x, z: p.z - centreOf.z }));
    const lidar = heights ? roofFromHeights(heights, fp) : null;
    const building = buildingOf(local, { building: buildingTypeOf(s) }, centreOf, roads, rules, translate, lidar ? { ...s, lidar } : s, detailed,
      realistic ? { lat: centre.lat, lon: centre.lon, seed: s.id, shop: s.use === 'Commercial et services' } : null,
      entrances.filter(e => distanceToRing(e, fp) <= ENTRANCE_REACH));
    if (!building) continue;
    taken.add(s.id);
    out.buildings.push({ building, x: round(centreOf.x), z: round(centreOf.z), surveyId: s.id, ...(roofFinishOf({}, s) ? { roofKnown: true } : {}) });
  }
  if (taken.size) out.surveyAttribution = BDTOPO_ATTRIBUTION;
  // How many entrances OSM maps here (#474a: their coverage is measured on real imports, in the log).
  out.entrances = entrances.length;
  // The Ground: paved when the zone is built up (BUILT_UP), else left to the Scene's default (grass).
  let built = 0;
  for (const b of out.buildings) {
    const level = b.building.niveaux.reduce((p, q) => (q.elevation < p.elevation ? q : p));
    built += areaOfLevel(b.building, level.id);
  }
  out.builtShare = Math.round(built / (4 * h * h) * 1000) / 1000;
  if (out.builtShare >= BUILT_UP) out.ground = URBAN_GROUND;
  return out;
}
