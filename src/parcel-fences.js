/**
 * @file parcel-fences.js
 * THE WALLS AND FENCES OF A PLACE, FROM THE LAND REGISTRY (France, « Detailed » and « Realistic », #495): no open
 * source says where the walls and fences are and what they are (the aerial photo is too coarse, the LiDAR sees
 * most walls as vegetation and no fence; durzo-docs). The cadastre's parcels say where they CAN be: 93 % of the
 * walls OSM knows in Sare stand within 2 m of a parcel's limit (measured 22 Nov. 2026). So the limits of the
 * built parcels are closed with what is likely there, by rules (decided with Durzo):
 *   - along a road, a low wall (an opening for the way in, before the house);
 *   - between two built parcels, a fence or a hedge; nothing along a field or an empty plot;
 *   - in an old centre (a parcel mostly built), a high wall instead;
 *   - never against a building, nor where a Path (OSM, BD TOPO, a hedge read on the LiDAR) already is.
 * And the LiDAR confirms (`heights`, height-reading.js; `walls`, hedge-reading.js wallCells: the LiDAR's ground and
 * perennial above-ground, not its vegetation, buildings or unnamed things, cars): a limit raised 0.6 to 3 m along
 * most of it, there, is a real wall, its height measured. PURE.
 *
 * Frames: local metres around the zone's centre, x east, z south.
 */
import { insidePolygon, nearestOnPolyline } from './osm-scene.js';

/** How far apart the limits are read (m). */
const STEP = 1;
/** A limit is along a road within this much of its edge (m). */
const ROAD_REACH = 4;
/** Nothing within this much of a building's outline (m), nor of a known Path. */
const BUILDING_CLEAR = 2.5;
const PATH_CLEAR = 2;
/** The shortest piece laid (m); the opening left for the way in (m), in a front of this length at least. */
export const MIN_RUN = 3;
const OPENING = 3;
const OPENING_FROM = 8;
/** A parcel built over this share of its area is an old centre's: high walls. */
const DENSE = 0.5;
/** A house: a footprint of this many square metres at most; a parcel closed: this large at most (larger: a shop's
 * car park, a school, a farm; left open). */
const HOUSE_MAX = 400;
const PARCEL_MAX = 3000;
/** The heights laid (m): a front's low wall, a centre's wall, a fence, a hedge. */
export const HEIGHTS = Object.freeze({ front: 0.9, wall: 2, fence: 1.5, hedge: 1.8 });
/** The LiDAR's wall: raised this much (m), no more than that (higher: eaves, a tree), along this share of the limit. */
const WALL_RISE = 0.6;
const WALL_TOP = 3;
const WALL_SHARE = 0.6;
/** The most pieces laid in a zone. */
export const MOST_PIECES = 400;

const RENDER = 'int:facade:enduit', STONE = 'int:facade:pierre';

function ringsOf(g, toLocal){
  const polys = !g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return polys.map(p => (p[0] || []).filter(c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map(c => toLocal({ lat: c[1], lon: c[0] }))).filter(r => r.length >= 4);
}
const areaOf = (r) => Math.abs(r.reduce((s, p, k) => { const q = r[(k + 1) % r.length]; return s + p.x * q.z - q.x * p.z; }, 0) / 2);
const middleOf = (r) => ({ x: r.reduce((s, p) => s + p.x, 0) / r.length, z: r.reduce((s, p) => s + p.z, 0) / r.length });
const boxOf = (pts, m = 0) => pts.reduce((b, q) => ({ x0: Math.min(b.x0, q.x - m), x1: Math.max(b.x1, q.x + m), z0: Math.min(b.z0, q.z - m), z1: Math.max(b.z1, q.z + m) }),
  { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });
const inBox = (p, b) => p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1;
const distanceTo = (p, pts) => { const q = nearestOnPolyline(p, pts); return q ? Math.hypot(q.x - p.x, q.z - p.z) : Infinity; };
/** A stable 0..1 from a number (a parcel's index): the same fence or hedge at every import. */
const draw = (k) => { const s = Math.sin(k * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

/**
 * The parcels of a zone, from the cadastre's answer (GeoJSON): `[{ ring, area, built, dense, houses }]`; `built`: a
 * home's (a house stands in it, nothing larger, and it is not too large itself); `houses`: their middles.
 */
export function builtParcels(answer, translated, { toLocal }){
  const feet = (translated.buildings || []).filter(b => Array.isArray(b.footprint) && b.footprint.length >= 3)
    .map(b => ({ ring: b.footprint, mid: middleOf(b.footprint), area: areaOf(b.footprint) }));
  const out = [];
  for (const f of (answer && Array.isArray(answer.features) ? answer.features : [])) {
    for (const ring of ringsOf(f.geometry, toLocal)) {
      const area = areaOf(ring);
      if (!(area > 20)) continue;
      const b = boxOf(ring);
      const inside = feet.filter(x => inBox(x.mid, b) && insidePolygon(x.mid, ring));
      const built = inside.reduce((s, x) => s + x.area, 0);
      const home = inside.length > 0 && area <= PARCEL_MAX && inside.every(x => x.area <= HOUSE_MAX);
      out.push({ ring, area, box: b, built: home, dense: home && built / area > DENSE, houses: inside.map(x => x.mid) });
    }
  }
  return out;
}

/**
 * The walls, fences and hedges along the limits of the built parcels: Paths `{ kind, world: { pts }, wallHeight,
 * traceTexture?, source }` (source 'cadastre', or 'lidar' for a wall the heights confirm), MOST_PIECES at most.
 * `parcels`: builtParcels; `halfSize`: the zone's; `heights`: the MNH grid, `walls`: its cells where a wall may be
 * read (both optional: without them, the rules alone).
 */
export function parcelFences(parcels, translated, { halfSize, heights = null, walls = null } = {}){
  const paths = translated.paths || [];
  const roads = paths.filter(p => (p.kind === 'route' || p.kind === 'chemin') && p.world && Array.isArray(p.world.pts) && p.world.pts.length >= 2)
    .map(p => ({ pts: p.world.pts, reach: (p.world.width > 0 ? p.world.width : (p.kind === 'route' ? 6 : 2)) / 2 + ROAD_REACH })).map(r => ({ ...r, box: boxOf(r.pts, r.reach) }));
  const known = paths.filter(p => p.kind !== 'route' && p.kind !== 'chemin' && p.kind !== 'trottoir' && p.world && Array.isArray(p.world.pts) && p.world.pts.length >= 2)
    .map(p => ({ pts: p.world.pts, box: boxOf(p.world.pts, PATH_CLEAR) }));
  const feet = (translated.buildings || []).filter(b => Array.isArray(b.footprint) && b.footprint.length >= 3)
    .map(b => ({ ring: b.footprint, box: boxOf(b.footprint, BUILDING_CLEAR) }));
  const built = parcels.filter(p => p.built);
  const h = halfSize;
  /** What a point of parcel `k`'s limit faces: 'front', 'shared' (another built parcel, read once), or null. */
  const faceOf = (p, out, k) => {
    if (Math.abs(p.x) > h || Math.abs(p.z) > h) return null;
    if (feet.some(f => inBox(p, f.box) && (insidePolygon(p, f.ring) || distanceTo(p, f.ring.concat([f.ring[0]])) < BUILDING_CLEAR))) return null;
    if (known.some(x => inBox(p, x.box) && distanceTo(p, x.pts) < PATH_CLEAR)) return null;
    if (roads.some(r => inBox(p, r.box) && distanceTo(p, r.pts) < r.reach)) return 'front';
    // Across the limit: of the two sides, the one out of this parcel.
    const own = built[k].ring;
    let across = { x: p.x + out.x * 1.5, z: p.z + out.z * 1.5 };
    if (insidePolygon(across, own)) across = { x: p.x - out.x * 1.5, z: p.z - out.z * 1.5 };
    const other = built.findIndex(q => q !== built[k] && inBox(across, q.box) && insidePolygon(across, q.ring));
    return other > k ? 'shared' : null;
  };
  const rise = (p) => {
    if (!heights || !walls) return null;
    const { n, step } = heights, hs = heights.halfSize;
    let best = 0;
    for (let dz = -0.75; dz <= 0.75; dz += step) for (let dx = -0.75; dx <= 0.75; dx += step) {
      const i = Math.floor((p.x + dx + hs) / step), j = Math.floor((p.z + dz + hs) / step);
      if (i < 0 || j < 0 || i >= n || j >= n || !walls[j * n + i]) continue;
      const v = heights.h[j * n + i];
      if (v > best && v <= WALL_TOP) best = v;
    }
    return best;
  };
  const out = [];
  built.forEach((parcel, k) => {
    const ring = parcel.ring;
    const samples = [];
    for (let i = 0; i + 1 < ring.length; i++) {
      const a = ring[i], b = ring[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z);
      if (L < 0.01) continue;
      const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L, nrm = { x: -uz, z: ux };
      for (let d = 0; d < L; d += STEP) {
        const p = { x: a.x + ux * d, z: a.z + uz * d };
        samples.push({ p, face: faceOf(p, nrm, k) });
      }
    }
    // The runs: consecutive points facing the same way.
    let run = [];
    const flush = () => {
      if (run.length * STEP >= MIN_RUN) out.push(...piecesOf(run, parcel, k, rise));
      run = [];
    };
    for (const s of samples) {
      if (run.length && s.face !== run[0].face) flush();
      if (s.face) run.push(s);
    }
    flush();
  });
  return out.slice(0, MOST_PIECES);
}

/** A line's points with the ones in a straight line between their neighbours (within 10 cm) left out. */
function straight(pts){
  const out = [pts[0]];
  for (let i = 1; i + 1 < pts.length; i++) {
    const a = out[out.length - 1], b = pts[i + 1], p = pts[i];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L > 0 && Math.abs((b.x - a.x) * (a.z - p.z) - (a.x - p.x) * (b.z - a.z)) / L > 0.1) out.push(p);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** A run's pieces: the front opened for the way in, its kind by the rules, a real wall if the LiDAR says so. */
function piecesOf(run, parcel, k, rise){
  const face = run[0].face;
  let parts = [run];
  if (face === 'front' && run.length * STEP >= OPENING_FROM && parcel.houses.length) {
    // The opening: before the house (the run's point nearest to it), OPENING metres wide.
    const house = parcel.houses[0];
    let at = 0, d0 = Infinity;
    run.forEach((s, i) => { const d = Math.hypot(s.p.x - house.x, s.p.z - house.z); if (d < d0) { d0 = d; at = i; } });
    const half = Math.round(OPENING / STEP / 2);
    parts = [run.slice(0, Math.max(0, at - half)), run.slice(at + half + 1)];
  }
  const pieces = [];
  for (const part of parts) {
    if (part.length * STEP < MIN_RUN) continue;
    const pts = straight(part.map(s => ({ x: Math.round(s.p.x * 100) / 100, z: Math.round(s.p.z * 100) / 100 })));
    const read = part.map(s => rise(s.p)).filter(v => v !== null);
    const raised = read.filter(v => v >= WALL_RISE);
    if (read.length && raised.length / read.length >= WALL_SHARE) {
      const hs = raised.sort((a, b) => a - b);
      pieces.push({ kind: 'muret', world: { pts }, wallHeight: Math.round(hs[Math.floor(hs.length / 2)] * 10) / 10, traceTexture: parcel.dense ? STONE : RENDER, source: 'lidar' });
      continue;
    }
    if (parcel.dense) pieces.push({ kind: 'muret', world: { pts }, wallHeight: HEIGHTS.wall, traceTexture: STONE, source: 'cadastre' });
    else if (face === 'front') pieces.push({ kind: 'muret', world: { pts }, wallHeight: HEIGHTS.front, traceTexture: RENDER, source: 'cadastre' });
    else if (draw(k) < 0.5) pieces.push({ kind: 'cloture', world: { pts }, wallHeight: HEIGHTS.fence, source: 'cadastre' });
    else pieces.push({ kind: 'haie', world: { pts }, wallHeight: HEIGHTS.hedge, source: 'cadastre' });
  }
  return pieces;
}
