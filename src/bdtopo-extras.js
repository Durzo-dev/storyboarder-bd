/**
 * src/bdtopo-extras.js: WHAT ELSE THE BD TOPO SURVEYS FOR A SCENE (#482f, France): hedges as lines, sports grounds,
 * cemeteries and their graves, water surfaces. PURE.
 *
 * Measured on 16 Nov. 2026 around six places (Brittany, Paris, Fontainebleau, Eguisheim, the Cotentin, Auvergne;
 * Géoplateforme WFS, no key, 0.07 to 1.3 s):
 *   - `BDTOPO_V3:haie`: lines, their `hauteur` and `largeur` (369 around the six; the same as `HAIES.BOCAGES:haie`,
 *     so one of the two is read);
 *   - `BDTOPO_V3:terrain_de_sport`: « Terrain de tennis », « Petit terrain multi-sports », « Grand terrain de
 *     sport », « Piste de sport »;
 *   - `BDTOPO_V3:cimetiere` (« Civil », « Militaire »…);
 *   - `BDTOPO_V3:surface_hydrographique` (« Ecoulement naturel », « Retenue », « Réservoir-bassin »…);
 *   - `BDTOPO_V3:detail_orographique`: points (an island's name): nothing to draw, left out.
 * Each is added where OSM has nothing of it already: a hedge 3 m from an OSM hedge, an area whose middle an OSM
 * Zone of the same ground holds, is OSM's.
 */
import { projector } from './geo-local.js';
import { maskOfPolygon, insidePolygon, nearestOnPolyline, clipPolyline } from './osm-scene.js';
import { mondeDuMasque } from './terrain-zone-pinceau.js';

/** A sports ground's surface: its Zone's ground, and a tint when it has one (a running track's red). */
export const SPORTS_GROUNDS = Object.freeze({
  tennis: { terrainType: 'béton', terrainColor: '#4f7d5a' },
  multi: { terrainType: 'béton' },
  large: { terrainType: 'gazon' },
  track: { terrainType: 'terre', terrainColor: '#a0472f' },
});

/** A cemetery's graves: rows this far apart (m), graves along a row this far apart; at most MAX_GRAVES. */
export const GRAVE_ROWS = 3, GRAVE_STEP = 1.6, MAX_GRAVES = 200;

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A sports ground's kind from its nature, or null. */
export function sportsKindOf(nature) {
  const n = plain(nature);
  if (/tennis/.test(n)) return 'tennis';
  if (/piste/.test(n)) return 'track';
  if (/grand terrain/.test(n)) return 'large';
  if (/terrain/.test(n)) return 'multi';
  return null;
}

/** The outer rings of a GeoJSON (Multi)Polygon, in local metres. */
function ringsOf(g, toLocal) {
  const polys = !g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return polys.map(p => (p[0] || []).filter(c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map(c => toLocal({ lat: c[1], lon: c[0] }))).filter(r => r.length >= 4);
}

/** The lines of a GeoJSON (Multi)LineString, in local metres. */
function linesOf(g, toLocal) {
  const lines = !g ? [] : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
  return lines.map(l => l.filter(c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map(c => toLocal({ lat: c[1], lon: c[0] }))).filter(l => l.length >= 2);
}

/** A ring's middle (the mean of its points). */
const middleOf = (r) => ({ x: r.reduce((s, p) => s + p.x, 0) / r.length, z: r.reduce((s, p) => s + p.z, 0) / r.length });

/** Whether an existing Zone of `ground` (translated: { terrainType, world.masque }) covers `p`. */
function zoneCovers(zones, ground, p) {
  return zones.some(z => {
    const m = z.world && z.world.masque;
    if (z.terrainType !== ground || !m) return false;
    const i = Math.floor((p.x - m.x0) / m.pas), j = Math.floor((p.z - m.z0) / m.pas);
    return i >= 0 && j >= 0 && i < m.nx && j < m.nz && m.plein[j * m.nx + i] === '1';
  });
}

/** The graves of a cemetery: rows of graves within its outline, turned as its longest side; at most `max`. */
export function gravesOf(ring, h, max = MAX_GRAVES) {
  let best = null;
  for (let i = 0; i + 1 < ring.length; i++) {
    const a = ring[i], b = ring[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z);
    if (!best || L > best.L) best = { L, ux: (b.x - a.x) / L, uz: (b.z - a.z) / L };
  }
  if (!best) return [];
  const { ux, uz } = best, vx = -uz, vz = ux;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of ring) {
    const u = p.x * ux + p.z * uz, v = p.x * vx + p.z * vz;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  const out = [];
  const rotY = Math.atan2(-uz, ux);
  for (let v = v0 + GRAVE_ROWS / 2; v < v1; v += GRAVE_ROWS) {
    for (let u = u0 + GRAVE_STEP / 2; u < u1; u += GRAVE_STEP) {
      const p = { x: u * ux + v * vx, z: u * uz + v * vz };
      if (Math.abs(p.x) > h || Math.abs(p.z) > h || !insidePolygon(p, ring)) continue;
      // A grave clear of the wall (1.5 m): the path round a cemetery.
      const edge = nearestOnPolyline(p, ring);
      if (Math.hypot(edge.x - p.x, edge.z - p.z) < 1.5) continue;
      out.push({ objType: out.length % 3 === 2 ? 'pierre_tombale' : 'tombe', x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100,
        rotY: Math.round(rotY * 1000) / 1000, kindKnown: true, source: 'bdtopo' });
    }
  }
  if (out.length <= max) return out;
  const step = out.length / max;
  return Array.from({ length: max }, (_, i) => out[Math.floor(i * step)]);
}

/**
 * The BD TOPO's extras (`answers`: { hedges, sports, cemeteries, waters }, GeoJSON each or null) added to a
 * translation (translateOsm's `{ paths, zones, elements }`, changed in place), within `halfSize`. Returns how many
 * of each were added.
 */
export function addExtras(translated, answers, centre, halfSize) {
  const { toLocal } = projector(centre);
  const h = halfSize;
  const n = { hedges: 0, sports: 0, cemeteries: 0, graves: 0, waters: 0 };
  const osmHedges = translated.paths.filter(p => p.kind === 'haie').map(p => p.world.pts);
  for (const f of (answers.hedges && answers.hedges.features) || []) {
    for (const line of linesOf(f.geometry, toLocal).flatMap(l => clipPolyline(l, h))) {
      if (line.length < 2) continue;
      const mid = line[Math.floor(line.length / 2)];
      if (osmHedges.some(pts => { const q = nearestOnPolyline(mid, pts); return q && Math.hypot(q.x - mid.x, q.z - mid.z) < 3; })) continue;
      // The same hedge surveyed as an area and filled with shrubs (vegetation-zones.js): left to it.
      if (translated.elements.filter(e => e.filled && e.objType === 'buisson' && Math.hypot(e.x - mid.x, e.z - mid.z) < 3).length >= 2) continue;
      const p = f.properties || {};
      const path = { kind: 'haie', world: { pts: line.map(q => ({ x: Math.round(q.x * 100) / 100, z: Math.round(q.z * 100) / 100 })) }, source: 'bdtopo' };
      if (p.largeur > 0 && p.largeur < 20) path.world.width = p.largeur;
      if (p.hauteur > 0.3 && p.hauteur < 30) path.wallHeight = p.hauteur;
      translated.paths.push(path);
      n.hedges++;
    }
  }
  const zoneFrom = (ring, terrainType, extra = {}) => {
    const mask = maskOfPolygon(ring, h);
    const world = mask && mondeDuMasque(mask);
    if (!world) return false;
    translated.zones.push({ terrainType, world, source: 'bdtopo', ...extra });
    return true;
  };
  for (const f of (answers.sports && answers.sports.features) || []) {
    const kind = sportsKindOf(f.properties && f.properties.nature);
    if (!kind) continue;
    const { terrainType, terrainColor } = SPORTS_GROUNDS[kind];
    for (const ring of ringsOf(f.geometry, toLocal)) {
      if (zoneCovers(translated.zones, 'gazon', middleOf(ring)) || zoneCovers(translated.zones, terrainType, middleOf(ring))) continue;
      if (zoneFrom(ring, terrainType, terrainColor ? { terrainColor } : {})) n.sports++;
    }
  }
  for (const f of (answers.cemeteries && answers.cemeteries.features) || []) {
    for (const ring of ringsOf(f.geometry, toLocal)) {
      if (!zoneFrom(ring, 'gravier')) continue;
      n.cemeteries++;
      // Its graves, unless OSM already has some there.
      if (translated.elements.some(e => (e.objType === 'tombe' || e.objType === 'pierre_tombale') && insidePolygon(e, ring))) continue;
      const graves = gravesOf(ring, h);
      translated.elements.push(...graves);
      n.graves += graves.length;
    }
  }
  for (const f of (answers.waters && answers.waters.features) || []) {
    for (const ring of ringsOf(f.geometry, toLocal)) {
      if (zoneCovers(translated.zones, 'eau', middleOf(ring))) continue;
      if (zoneFrom(ring, 'eau')) n.waters++;
    }
  }
  return n;
}
