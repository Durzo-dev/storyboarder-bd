/**
 * src/vegetation-zones.js: THE WOODS, ORCHARDS, HEATHS AND HEDGES OF A PLACE, FILLED (#482a, #482b; France). PURE.
 *
 * OSM maps a wood as a Zone (grass) and rarely its trees; the IGN surveys them: the BD Forêt v2
 * (`LANDCOVER.FORESTINVENTORY.V2:formation_vegetale`) gives each forest its ESSENCE (« Pin sylvestre », « Chênes
 * décidus »…), the BD TOPO (`BDTOPO_V3:zone_de_vegetation`) the nature of every planted area (Bois, Verger,
 * Haie, Lande ligneuse, forests…), even outside the farmers' declarations. Measured on 15 Nov. 2026 (Géoplateforme,
 * no key, 0.06 to 0.44 s): Fontainebleau's edge, two forests (« Chênes décidus », « Pin sylvestre »); Eguisheim,
 * vines and a hedge; a forest's outline up to 170 kB.
 *
 * Each area is filled with trees (or shrubs) on a jittered grid, its spacing by its kind, the same at each import
 * (a hash of the cell): an object `{ objType, x, z, kindKnown, genus?, height?, source, filled }` like OSM's, so the
 * flora, the LiDAR's heights and the clearance treat it as any tree. `filled`: the built-in tree, never a model
 * of the bank, of EZ-Tree or of the stores (model-bank.js, realistic-models.js): hundreds of them, each model
 * 7 000 to 400 000 faces, would sink the render. The BD Forêt first (its
 * essence); the BD TOPO where the BD Forêt has nothing. Vines wait for their models (#481). Never more than
 * MAX_TREES trees and MAX_SHRUBS shrubs in a zone: a 400 m forest would hold thousands; the spacing grows instead.
 */
import { projector } from './geo-local.js';

/** The credit of the BD Forêt (the BD TOPO's is the buildings'). */
export const BD_FORET_CREDIT = { fr: 'Forêts : © IGN, BD Forêt® v2', en: 'Forests: © IGN, BD Forêt® v2' };

/** At most this many trees, and shrubs, filled in one zone (each a model: the render's budget). */
export const MAX_TREES = 350;
export const MAX_SHRUBS = 150;

/** How far from a tree already there a filled one keeps (m): OSM's, the aerial photo's. */
const NEAR_EXISTING = 3;

/**
 * The kinds of areas: what grows there, how far apart (m), in rows or not, how high when nothing measured (m).
 * `mix`: half broadleaved, half conifers.
 */
export const AREA_KINDS = Object.freeze({
  broadleaved: { objType: 'arbre', spacing: 7 },
  conifers: { objType: 'conifere', spacing: 6 },
  mixed: { objType: 'mix', spacing: 7 },
  open: { objType: 'arbre', spacing: 13 },
  wood: { objType: 'arbre', spacing: 8 },
  poplars: { objType: 'arbre', genus: 'Populus', spacing: 7, rows: true },
  orchard: { objType: 'arbre', genus: 'Malus', spacing: 6, rows: true, height: 4 },
  heath: { objType: 'buisson', spacing: 6 },
  hedge: { objType: 'buisson', spacing: 2.5 },
});

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A BD Forêt essence (and its formation, `tfv`) → { kind, genera }: genera drawn in turn, or none (the flora's). */
export function kindOfEssence(essence, tfv = '') {
  const e = plain(essence), t = plain(tfv);
  if (/lande/.test(t) || e === 'nc') return { kind: 'heath', genera: [] };
  if (/sans couvert/.test(t) || e === 'nr') return null;
  if (/chene/.test(e)) return { kind: 'broadleaved', genera: ['Quercus'] };
  if (/hetre/.test(e)) return { kind: 'broadleaved', genera: ['Fagus'] };
  if (/chataignier/.test(e)) return { kind: 'broadleaved', genera: ['Castanea'] };
  if (/robinier/.test(e)) return { kind: 'broadleaved', genera: ['Robinia'] };
  if (/peuplier/.test(e)) return { kind: 'poplars', genera: ['Populus'] };
  if (/^pin|pins/.test(e)) return { kind: 'conifers', genera: ['Pinus'] };
  if (/sapin|epicea/.test(e)) return { kind: 'conifers', genera: ['Abies', 'Picea'] };
  if (/douglas/.test(e)) return { kind: 'conifers', genera: ['Pseudotsuga'] };
  if (/meleze/.test(e)) return { kind: 'conifers', genera: ['Larix'] };
  if (/conifere/.test(e)) return { kind: 'conifers', genera: [] };
  if (/mixte|melange/.test(e) || /mixte|melange de feuillus et/.test(t)) return { kind: 'mixed', genera: [] };
  if (/feuillu/.test(e)) return { kind: 'broadleaved', genera: [] };
  return { kind: 'wood', genera: [] };
}

/** A BD TOPO vegetation `nature` → { kind, genera }, or null (vines: #481; anything unknown). */
export function kindOfNature(nature) {
  const n = plain(nature);
  if (/vigne/.test(n)) return null;
  if (/verger/.test(n)) return { kind: 'orchard', genera: ['Malus', 'Prunus', 'Pyrus'] };
  if (/peupleraie/.test(n)) return { kind: 'poplars', genera: ['Populus'] };
  if (/haie/.test(n)) return { kind: 'hedge', genera: [] };
  if (/lande/.test(n)) return { kind: 'heath', genera: [] };
  if (/foret ouverte/.test(n)) return { kind: 'open', genera: [] };
  if (/conifere/.test(n)) return { kind: 'conifers', genera: [] };
  if (/mixte/.test(n)) return { kind: 'mixed', genera: [] };
  if (/feuillu/.test(n)) return { kind: 'broadleaved', genera: [] };
  if (/bois|foret|arbor/.test(n)) return { kind: 'wood', genera: [] };
  return null;
}

/** The outer rings of a GeoJSON geometry, and their holes, in local metres. */
function ringsOfGeometry(g, toLocal) {
  const polys = !g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  const loc = (r) => (Array.isArray(r) ? r.filter(c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map(c => toLocal({ lat: c[1], lon: c[0] })) : []);
  return polys.map(p => ({ ring: loc(p[0]), holes: p.slice(1).map(loc).filter(h => h.length >= 4) })).filter(p => p.ring.length >= 4);
}

/**
 * The planted areas of a place: the WFS answers `{ forests, zones }` (GeoJSON) around `centre` →
 * [{ kind, genera, ring, holes, source }] in local metres (x to the east, z to the south). BD Forêt first.
 */
export function readVegetation({ forests = null, zones = null } = {}, centre) {
  const { toLocal } = projector(centre);
  const out = [];
  for (const f of (forests && forests.features) || []) {
    const k = kindOfEssence(f.properties && f.properties.essence, f.properties && f.properties.tfv);
    if (!k) continue;
    for (const p of ringsOfGeometry(f.geometry, toLocal)) out.push({ ...k, ...p, source: 'bdforet' });
  }
  for (const f of (zones && zones.features) || []) {
    const k = kindOfNature(f.properties && f.properties.nature);
    if (!k) continue;
    for (const p of ringsOfGeometry(f.geometry, toLocal)) out.push({ ...k, ...p, source: 'bdtopo' });
  }
  return out;
}

function inside(p, q) {
  let r = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    if ((q[i].z > p.z) !== (q[j].z > p.z) && p.x < (q[j].x - q[i].x) * (p.z - q[i].z) / (q[j].z - q[i].z) + q[i].x) r = !r;
  }
  return r;
}

/** A number in [0, 1) from integers and a salt: the same cell jitters the same at each import. */
function hash(i, j, salt) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const inArea = (p, a) => inside(p, a.ring) && !a.holes.some(h => inside(p, h));

/** The points of an area on its grid (spacing × k), jittered (not in rows), within the zone. */
function gridOf(a, spacing, h, salt) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of a.ring) { x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); z1 = Math.max(z1, p.z); }
  x0 = Math.max(x0, -h); z0 = Math.max(z0, -h); x1 = Math.min(x1, h); z1 = Math.min(z1, h);
  const pts = [];
  const rows = AREA_KINDS[a.kind].rows;
  for (let i = Math.floor(x0 / spacing); i * spacing <= x1; i++) {
    for (let j = Math.floor(z0 / spacing); j * spacing <= z1; j++) {
      const jx = rows ? 0.5 : 0.15 + 0.7 * hash(i, j, salt), jz = rows ? 0.5 : 0.15 + 0.7 * hash(i, j, salt ^ 0x5bd1);
      const p = { x: (i + jx) * spacing, z: (j + jz) * spacing };
      if (Math.abs(p.x) <= h && Math.abs(p.z) <= h && inArea(p, a)) pts.push({ ...p, i, j });
    }
  }
  return pts;
}

/**
 * The trees and shrubs filling the planted areas of a zone (`halfSize`: its half side, m), away from the
 * trees already there (`existing`: elements { objType, x, z }). Returns the new elements (OSM's shape: objType,
 * x, z, kindKnown, genus, height, source). A BD TOPO area inside a BD Forêt one is the same forest: left to it.
 */
export function fillVegetation(areas, { halfSize, existing = [] } = {}) {
  const forests = areas.filter(a => a.source === 'bdforet');
  const kept = areas.filter(a => a.source === 'bdforet'
    || !forests.some(f => { const c = a.ring[0]; return inArea(c, f) || inArea(a.ring[Math.floor(a.ring.length / 2)], f); }));
  const placed = (k) => {
    const all = [];
    kept.forEach((a, n) => {
      const kind = AREA_KINDS[a.kind];
      if ((kind.objType === 'buisson') !== (k === 'shrub')) return;
      for (const p of gridOf(a, kind.spacing, halfSize, 0x9e37 + n)) all.push({ a, p, kind, n });
    });
    return all;
  };
  const out = [];
  const near = existing.filter(e => typeof e.x === 'number');
  for (const [k, max] of [['tree', MAX_TREES], ['shrub', MAX_SHRUBS]]) {
    let cands = placed(k);
    // Too many: one in every `step` kept, spread (the grid's own order mixes the areas).
    const step = cands.length > max ? cands.length / max : 1;
    cands = step > 1 ? Array.from({ length: max }, (_, i) => cands[Math.floor(i * step)]) : cands;
    for (const { a, p, kind, n } of cands) {
      if (near.some(e => Math.hypot(e.x - p.x, e.z - p.z) < NEAR_EXISTING)) continue;
      const u = hash(p.i, p.j, 0x31c7 + n);
      const objType = kind.objType === 'mix' ? (u < 0.5 ? 'arbre' : 'conifere') : kind.objType;
      const genera = a.genera.length ? a.genera : (kind.genus ? [kind.genus] : []);
      const e = { objType, x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, kindKnown: true, source: a.source, filled: true };
      if (genera.length) e.genus = genera[Math.floor(hash(p.i, p.j, 0x7f4a + n) * genera.length)];
      if (kind.height) e.height = Math.round(kind.height * (0.85 + 0.3 * u) * 10) / 10;
      out.push(e);
    }
  }
  return out;
}
