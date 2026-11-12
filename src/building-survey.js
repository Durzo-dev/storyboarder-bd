/**
 * @file building-survey.js
 * What a building SURVEY adds to OpenStreetMap. In France: the IGN BD TOPO, read from its WFS answer
 * (layer BDTOPO_V3:batiment), building by building:
 *   - the EAVES height (`hauteur`: from the lowest point of the ground to the lowest point of the roof,
 *     measured: 60 of 60 buildings in a sample of Eguisheim) and the roof's own height (highest minus lowest
 *     point of the roof), hence its pitch;
 *   - the use (residential, religious, commercial, annex…);
 *   - the materials of the walls and of the roof, from the land registry (about a third of the buildings):
 *     each digit of the code is a material (walls: 1 stone, 2 millstone, 3 concrete, 4 brick, 5 breeze
 *     block, 6 wood, 9 other; roof: 1 tiles, 2 slate, 3 zinc or aluminium, 4 concrete, 9 other); 0 or empty:
 *     unknown. Stone or brick with wood is a half-timbered house.
 * The survey is matched to the OSM buildings by footprint; a surveyed building OSM lacks is added. PURE.
 */
import { projector } from './geo-local.js';

/** The attribution the BD TOPO licence (Etalab 2.0) asks for. */
export const BDTOPO_ATTRIBUTION = '© IGN, BD TOPO®';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

function signedArea(pts){
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.z - q.x * p.z; }
  return a / 2;
}

/** The centre of mass of a polygon (falls back to the mean of its points when it has no area). */
function centroidOf(pts){
  const a = signedArea(pts);
  if (Math.abs(a) < 1e-9) return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length };
  let x = 0, z = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], k = p.x * q.z - q.x * p.z;
    x += (p.x + q.x) * k; z += (p.z + q.z) * k;
  }
  return { x: x / (6 * a), z: z / (6 * a) };
}

/** Is `p` inside the polygon `q` (even-odd)? */
function insidePolygon(p, q){
  let d = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    if ((q[i].z > p.z) !== (q[j].z > p.z) && p.x < (q[j].x - q[i].x) * (p.z - q[i].z) / (q[j].z - q[i].z) + q[i].x) d = !d;
  }
  return d;
}

/** The digits of a material code ('16' → [1, 6]), unknown (0) left out. */
const digitsOf = (code) => [...String(code || '')].map(Number).filter(n => n >= 1 && n <= 9);

/**
 * The surveyed buildings of a BD TOPO WFS answer, in local metres around `centre` (x to the east, z to the
 * south): [{ id, footprint, area, centre, eaves, roofRise, use, walls, roof, light }]. `footprint`: the
 * outer ring of the first polygon, without its closing point. A feature without a usable footprint is left
 * out.
 */
export function readBdTopo(geojson, centre){
  const { toLocal } = projector(centre);
  const out = [];
  for (const f of (geojson && Array.isArray(geojson.features)) ? geojson.features : []) {
    const g = f && f.geometry, p = (f && f.properties) || {};
    const ring = g && g.type === 'MultiPolygon' ? g.coordinates?.[0]?.[0] : g && g.type === 'Polygon' ? g.coordinates?.[0] : null;
    if (!Array.isArray(ring) || ring.length < 4) continue;
    const pts = ring.map(c => (Array.isArray(c) && finite(c[0]) && finite(c[1]) ? toLocal({ lat: c[1], lon: c[0] }) : null));
    if (pts.some(q => !q)) continue;
    const last = pts[pts.length - 1];
    if (Math.hypot(last.x - pts[0].x, last.z - pts[0].z) < 0.01) pts.pop();
    const area = Math.abs(signedArea(pts));
    if (pts.length < 3 || area < 1) continue;
    const low = p.altitude_minimale_toit, high = p.altitude_maximale_toit;
    out.push({
      id: String(f.id || ''),
      footprint: pts,
      area,
      centre: centroidOf(pts),
      eaves: finite(p.hauteur) && p.hauteur > 0 ? p.hauteur : null,
      roofRise: finite(low) && finite(high) && high >= low ? high - low : null,
      use: typeof p.usage_1 === 'string' ? p.usage_1 : null,
      walls: digitsOf(p.materiaux_des_murs),
      roof: digitsOf(p.materiaux_de_la_toiture),
      light: p.construction_legere === true,
    });
  }
  return out;
}

/**
 * The surveyed building that is this OSM footprint (local metres, world frame): one whose outline holds the
 * footprint's centre of mass, of a comparable area (between 0.4 and 2.5 times), the closest in area. Taken
 * buildings (`taken`, a Set of ids) are skipped, and the match is added to it. null if none.
 */
export function matchSurvey(footprint, surveys, taken = new Set()){
  const c = centroidOf(footprint), area = Math.abs(signedArea(footprint));
  let best = null, bestGap = Infinity;
  for (const s of surveys) {
    if (taken.has(s.id)) continue;
    const ratio = s.area / area;
    if (ratio < 0.4 || ratio > 2.5) continue;
    if (!insidePolygon(c, s.footprint) && !insidePolygon(s.centre, footprint)) continue;
    const gap = Math.abs(Math.log(ratio));
    if (gap < bestGap) { bestGap = gap; best = s; }
  }
  if (best) taken.add(best.id);
  return best;
}

/** The OSM `building` value that stands for a surveyed building's use (the defaults per type follow it). */
export function buildingTypeOf(survey){
  const use = survey && survey.use;
  if (use === 'Religieux') return 'church';
  if (use === 'Commercial et services') return 'commercial';
  if (use === 'Résidentiel') return 'house';
  if (use === 'Industriel') return 'industrial';
  if (use === 'Agricole') return 'farm_auxiliary';
  if (use === 'Annexe' || (survey && survey.light)) return 'shed';
  return 'yes';
}

/**
 * The narrowest width of a footprint (its smallest extent across any of its edges' directions): a pitched
 * roof rises over half of it.
 */
function narrowWidth(footprint){
  let best = Infinity;
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i], b = footprint[(i + 1) % footprint.length], l = Math.hypot(b.x - a.x, b.z - a.z);
    if (l < 0.5) continue;
    const nx = -(b.z - a.z) / l, nz = (b.x - a.x) / l;
    let lo = Infinity, hi = -Infinity;
    for (const p of footprint) { const d = p.x * nx + p.z * nz; lo = Math.min(lo, d); hi = Math.max(hi, d); }
    best = Math.min(best, hi - lo);
  }
  return Number.isFinite(best) ? best : 0;
}

/**
 * The roof from the survey: flat when it rises less than 0.5 m; else its pitch (degrees, 10 to 60) from its
 * height over half the footprint's narrow width. null when the survey says nothing of the roof.
 */
export function surveyedRoof(survey, footprint){
  if (!survey || !finite(survey.roofRise)) return null;
  if (survey.roofRise < 0.5) return { flat: true };
  const half = narrowWidth(footprint) / 2;
  if (!(half > 0.5)) return null;
  const pitch = Math.atan(survey.roofRise / half) * 180 / Math.PI;
  return { flat: false, pitch: Math.round(Math.min(60, Math.max(10, pitch))) };
}

// ── Finishes: what the walls and the roof are made of ────────────────────────────────────────────

const STONE = 'int:trace:muret', WOOD = 'int:trace:cloture';
const ROOF_TILES = 'int:toit:tuiles-plates', SLATE = 'int:toit:ardoise';
const METAL = '#8d9399', CONCRETE = '#9a948c', BRICK = '#a65a42';
const COLOURS = { white: '#f2efe8', beige: '#d8c9a8', cream: '#eee3c6', yellow: '#e2c46a', ochre: '#c99a4b', orange: '#d98c4a',
  red: '#a8483a', brown: '#7a5640', grey: '#9a9a96', gray: '#9a9a96', pink: '#d9a5a0', blue: '#7f97b3', green: '#8fa680', black: '#3a3a3a' };
const colourOf = (v) => {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + [...s.slice(1)].map(c => c + c).join('');
  return COLOURS[s] || null;
};
const finish = (texture, couleur) => (texture || couleur ? { texture: texture || null, couleur: couleur || null } : null);

/**
 * The facade's finish ({ texture, couleur } of batiment-revetements.js), or null for the default render.
 * OSM first (`building:material`, `building:colour`), then the survey: stone alone shows its stone, wood
 * alone its boards; a half-timbered house (wood with another material, or OSM `timber_framing`) and rendered
 * walls (concrete, brick, breeze block) keep the plain render: their facades are #468d's.
 */
export function wallFinishOf(tags = {}, survey = null){
  const colour = colourOf(tags['building:colour']);
  const m = tags['building:material'];
  if (m === 'stone' || m === 'sandstone' || m === 'limestone') return finish(STONE, colour);
  if (m === 'wood') return finish(WOOD, colour);
  if (m === 'brick') return finish(null, colour || BRICK);
  if (colour) return finish(null, colour);
  const d = survey ? survey.walls : [];
  if (d.length && d.every(n => n === 1 || n === 2)) return finish(STONE, null);
  if (d.length && d.every(n => n === 6)) return finish(WOOD, null);
  return null;
}

/** The roof's finish: OSM first (`roof:material`, `roof:colour`), then the survey's first known material. */
export function roofFinishOf(tags = {}, survey = null){
  const colour = colourOf(tags['roof:colour']);
  const m = tags['roof:material'];
  if (m === 'roof_tiles' || m === 'tile' || m === 'tiles') return finish(ROOF_TILES, colour);
  if (m === 'slate') return finish(SLATE, colour);
  if (m === 'metal' || m === 'zinc' || m === 'copper' || m === 'tin') return finish(null, colour || METAL);
  if (m === 'concrete') return finish(null, colour || CONCRETE);
  if (colour) return finish(null, colour);
  const first = survey && survey.roof.length ? survey.roof[0] : 0;
  if (first === 1) return finish(ROOF_TILES, null);
  if (first === 2) return finish(SLATE, null);
  if (first === 3) return finish(null, METAL);
  if (first === 4) return finish(null, CONCRETE);
  return null;
}
