/**
 * @file parcel-fences.js
 * THE WALLS AND FENCES OF A PLACE, FROM THE LAND REGISTRY (France, « Detailed » and « Realistic », #495): no open
 * source says where the walls and fences are and what they are (the aerial photo is too coarse, the LiDAR sees
 * most walls as vegetation and no fence; durzo-docs). The cadastre's parcels say where they CAN be: 93 % of the
 * walls OSM knows in Sare stand within 2 m of a parcel's limit (measured 22 Nov. 2026). So the limits of the
 * homes' parcels are closed ALL ROUND with what is likely there, by rules (decided with Durzo):
 *   - along a road, a low wall (an opening for the way in, before the house);
 *   - elsewhere (a neighbour, a field, an empty plot), a fence or a hedge;
 *   - in an old centre (a parcel mostly built), a high wall instead;
 *   - a side that already has a wall or a hedge somewhere (OSM, BD TOPO, read on the LiDAR) is completed with it;
 *   - never across a road or a path, nor along a building's wall: the pieces run up to it, and to each other.
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
/** Nothing within this much of a building's outline (m): the piece runs up to it instead; nor of a known Path. */
const BUILDING_CLEAR = 2.5;
const PATH_CLEAR = 2;
/** A limit is ON a road or a path within this share of its half width (it crosses it): left open there. A limit
 * along a road's edge is not (the cadastre's limit and the road's drawn edge are a metre or so apart). */
const ON_ROAD = 0.75;
/** How far a piece's end reaches to join a building or a known Path (m). */
const JOIN = 4;
/** The shortest piece laid (m); the opening left for the way in (m), in a front of this length at least. */
export const MIN_RUN = 1;
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
/** A garden hedge's thickness (m): trimmed, thinner than its height would make it. */
const HEDGE_THICKNESS = 0.8;
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
 * The walls, fences and hedges along the limits of the homes' parcels: Paths `{ kind, world: { pts }, wallHeight,
 * traceTexture?, source }` (source 'cadastre', or 'lidar' for a wall the heights confirm), MOST_PIECES at most.
 * `parcels`: builtParcels; `halfSize`: the zone's; `heights`: the MNH grid, `walls`: its cells where a wall may be
 * read (both optional: without them, the rules alone).
 */
export function parcelFences(parcels, translated, { halfSize, heights = null, walls = null } = {}){
  const paths = translated.paths || [];
  const roads = paths.filter(p => (p.kind === 'route' || p.kind === 'chemin') && p.world && Array.isArray(p.world.pts) && p.world.pts.length >= 2)
    .map(p => { const half = (p.world.width > 0 ? p.world.width : (p.kind === 'route' ? 6 : 2)) / 2; return { pts: p.world.pts, half, reach: half + ROAD_REACH }; })
    .map(r => ({ ...r, box: boxOf(r.pts, r.reach) }));
  const known = paths.filter(p => ['muret', 'haie', 'cloture'].includes(p.kind) && p.world && Array.isArray(p.world.pts) && p.world.pts.length >= 2)
    .map(p => ({ pts: p.world.pts, kind: p.kind, wallHeight: p.wallHeight, wallThickness: p.wallThickness, traceTexture: p.traceTexture, box: boxOf(p.world.pts, PATH_CLEAR) }));
  const feet = (translated.buildings || []).filter(b => Array.isArray(b.footprint) && b.footprint.length >= 3)
    .map(b => ({ ring: b.footprint.concat([b.footprint[0]]), box: boxOf(b.footprint, BUILDING_CLEAR) }));
  const built = parcels.filter(p => p.built);
  const h = halfSize;
  // A car park (a Zone of asphalt) is left open, as a road.
  const parkings = (translated.zones || []).filter(z => z.terrainType === 'bitume' && z.world && z.world.masque).map(z => z.world.masque);
  const onParking = (p) => parkings.some(m => {
    const i = Math.floor((p.x - m.x0) / m.pas), j = Math.floor((p.z - m.z0) / m.pas);
    return i >= 0 && j >= 0 && i < m.nx && j < m.nz && m.plein[j * m.nx + i] === '1';
  });
  /** What a point of parcel `k`'s limit is: { face, ref? }. */
  const faceOf = (p, out, k) => {
    if (Math.abs(p.x) > h || Math.abs(p.z) > h) return { face: 'out' };
    const road = roads.find(r => inBox(p, r.box) && distanceTo(p, r.pts) < r.half * ON_ROAD);
    if (road || onParking(p)) return { face: 'road' };
    const foot = feet.find(f => inBox(p, f.box) && (insidePolygon(p, f.ring) || distanceTo(p, f.ring) < BUILDING_CLEAR));
    if (foot) return { face: 'house', ref: foot.ring };
    const near = known.find(x => inBox(p, x.box) && distanceTo(p, x.pts) < PATH_CLEAR);
    if (near) return { face: 'known', ref: near };
    // Across the limit: of the two sides, the one out of this parcel; a limit two homes share is laid once.
    const own = built[k].ring;
    let across = { x: p.x + out.x * 1.5, z: p.z + out.z * 1.5 };
    if (insidePolygon(across, own)) across = { x: p.x - out.x * 1.5, z: p.z - out.z * 1.5 };
    const other = built.findIndex(q => q !== built[k] && inBox(across, q.box) && insidePolygon(across, q.ring));
    if (other >= 0 && other < k) return { face: 'theirs' };
    if (roads.some(r => inBox(p, r.box) && distanceTo(p, r.pts) < r.reach)) return { face: 'front' };
    return { face: 'side' };
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
    // Every metre of the limit, each knowing its side of the ring (a side is completed with what it already has).
    const samples = [];
    for (let i = 0; i + 1 < ring.length; i++) {
      const a = ring[i], b = ring[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z);
      if (L < 0.01) continue;
      const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L, nrm = { x: -uz, z: ux };
      for (let d = 0; d < L; d += STEP) {
        const p = { x: a.x + ux * d, z: a.z + uz * d };
        samples.push({ p, side: i, ...faceOf(p, nrm, k) });
      }
    }
    if (!samples.length) return;
    // A side's own: the first known wall or hedge on it.
    const sideKnown = new Map();
    for (const s of samples) if (s.face === 'known' && !sideKnown.has(s.side)) sideKnown.set(s.side, s.ref);
    const laid = (s) => s.face === 'front' || s.face === 'side';
    // A run: one side of the ring, one face (or completed with what the side has); runs are joined end to end.
    const kindOf = (s) => (sideKnown.has(s.side) ? 'own' : s.face) + ':' + s.side;
    // Start where a run starts: the ring has no first point of its own.
    let start = samples.findIndex((s, i) => { const q = samples[(i + samples.length - 1) % samples.length]; return laid(s) !== laid(q) || (laid(s) && kindOf(s) !== kindOf(q)); });
    if (start < 0) start = 0;
    const ordered = samples.slice(start).concat(samples.slice(0, start));
    let run = [];
    const flush = (next) => {
      if (run.length) {
        const pts = run.map(s => s.p);
        // Joined to what is next to it: a building's wall, a known Path, the next piece.
        const before = ordered[(ordered.indexOf(run[0]) + ordered.length - 1) % ordered.length];
        pts.unshift(...joinTo(before, run[0].p));
        if (next) pts.push(...joinTo(next, run[run.length - 1].p, true));
        if (lengthOf(pts) >= MIN_RUN) out.push(...piecesOf(run, pts, parcel, k, rise, sideKnown.get(run[0].side)));
      }
      run = [];
    };
    for (const s of ordered) {
      if (run.length && (!laid(s) || kindOf(s) !== kindOf(run[0]))) flush(s);
      if (laid(s)) run.push(s);
    }
    flush(ordered[0]);
  });
  return out.slice(0, MOST_PIECES);
}

const lengthOf = (pts) => pts.slice(1).reduce((s, p, k) => s + Math.hypot(p.x - pts[k].x, p.z - pts[k].z), 0);

/**
 * The point a piece reaches out to, beyond its end `p`, toward its neighbour sample `s`: a building's wall or a
 * known Path (their nearest point, within JOIN), the next piece (its first point); none along a road (left open).
 */
function joinTo(s, p, after = false){
  if (!s) return [];
  if (s.face === 'house' || s.face === 'known') {
    const q = nearestOnPolyline(p, s.face === 'house' ? s.ref : s.ref.pts);
    return q && Math.hypot(q.x - p.x, q.z - p.z) <= JOIN ? [q] : [];
  }
  if (s.face === 'front' || s.face === 'side' || s.face === 'theirs') return after ? [s.p] : [];
  return [];
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

/**
 * A run's pieces: the front opened for the way in; a wall if the LiDAR says so; what its side already has; else
 * its kind by the rules.
 */
function piecesOf(run, all, parcel, k, rise, own){
  const face = run[0].face;
  let parts = [all];
  if (face === 'front' && !own && run.length * STEP >= OPENING_FROM && parcel.houses.length) {
    // The opening: before the house (the run's point nearest to it), OPENING metres wide.
    const house = parcel.houses[0];
    let at = 0, d0 = Infinity;
    all.forEach((p, i) => { const d = Math.hypot(p.x - house.x, p.z - house.z); if (d < d0) { d0 = d; at = i; } });
    const half = Math.round(OPENING / STEP / 2);
    parts = [all.slice(0, Math.max(0, at - half + 1)), all.slice(at + half)];
  }
  const read = run.map(s => rise(s.p)).filter(v => v !== null);
  const raised = read.filter(v => v >= WALL_RISE);
  const pieces = [];
  for (const part of parts) {
    if (part.length < 2 || lengthOf(part) < MIN_RUN) continue;
    const pts = straight(part.map(q => ({ x: Math.round(q.x * 100) / 100, z: Math.round(q.z * 100) / 100 })));
    if (read.length && raised.length / read.length >= WALL_SHARE) {
      const hs = raised.slice().sort((a, b) => a - b);
      pieces.push({ kind: 'muret', world: { pts }, wallHeight: Math.round(hs[Math.floor(hs.length / 2)] * 10) / 10, traceTexture: parcel.dense ? STONE : RENDER, source: 'lidar' });
    } else if (own) {
      const piece = { kind: own.kind, world: { pts }, wallHeight: own.wallHeight > 0 ? own.wallHeight : HEIGHTS[own.kind === 'muret' ? 'front' : own.kind === 'haie' ? 'hedge' : 'fence'], source: 'cadastre' };
      if (own.kind === 'haie') piece.wallThickness = own.wallThickness > 0 ? own.wallThickness : HEDGE_THICKNESS;
      if (own.kind === 'muret') piece.traceTexture = own.traceTexture || (parcel.dense ? STONE : RENDER);
      pieces.push(piece);
    } else if (parcel.dense) pieces.push({ kind: 'muret', world: { pts }, wallHeight: HEIGHTS.wall, traceTexture: STONE, source: 'cadastre' });
    else if (face === 'front') pieces.push({ kind: 'muret', world: { pts }, wallHeight: HEIGHTS.front, traceTexture: RENDER, source: 'cadastre' });
    else if (draw(k) < 0.5) pieces.push({ kind: 'cloture', world: { pts }, wallHeight: HEIGHTS.fence, source: 'cadastre' });
    else pieces.push({ kind: 'haie', world: { pts }, wallHeight: HEIGHTS.hedge, wallThickness: HEDGE_THICKNESS, source: 'cadastre' });
  }
  return pieces;
}
