/**
 * src/soils.js: THE COLOUR, AND AT THE « REALISTIC » LEVEL THE TEXTURE, OF THE BARE EARTH (#482e, France). PURE.
 *
 * The INRAE's soil map (`INRA.CARTE.SOLS:geoportail_vf`, the Géoplateforme's WFS, no key) gives every place its
 * soil-landscape unit: its dominant soil (`ger_nom`, the French Référentiel pédologique: « CALCOSOL(56%) »,
 * « BRUNISOL(30%) », « FLUVIOSOL », « ANDOSOL »…) and its description (`nom_ucs`: « Sols bruns calcaires limoneux
 * profonds sur loess », « … de sables bartoniens… », « … sur basalte… »). Measured on 16 Nov. 2026 on seven places
 * (Eguisheim, Fontainebleau, Sorède, the Beauce, Champagne, Brittany, Auvergne): 3 to 6 units each, 0.07 to 0.9 s.
 *
 * A Zone of bare earth (`terre`: fields, orchards, vineyards, building sites) takes its soil's colour
 * (`terrainColor`, the tint the terrain editor sets), read at its middle. At the « Realistic » level, a texture of
 * the soil from Poly Haven (CC0), chosen by hand for each kind (SOIL_KINDS.polyhaven), is downloaded into « My
 * textures » once and laid on those Zones instead (real-place-ui.js).
 */
import { projector } from './geo-local.js';

/**
 * The kinds of bare earth: its colour (as it shows, sRGB), and a Poly Haven texture of it (its id), chosen on
 * the catalogue's terrain textures (16 Nov. 2026).
 */
export const SOIL_KINDS = Object.freeze({
  chalk: { colour: '#b9ad94', polyhaven: 'dry_ground_01', fr: 'calcaire', en: 'chalky' },
  brown: { colour: '#6e5038', polyhaven: 'brown_mud_dry', fr: 'brun', en: 'brown' },
  loam: { colour: '#8a6a4a', polyhaven: 'farm_soil', fr: 'limoneux', en: 'loamy' },
  alluvial: { colour: '#5f5040', polyhaven: 'dirt_floor', fr: 'alluvial', en: 'alluvial' },
  wet: { colour: '#4c4237', polyhaven: 'brown_mud_02', fr: 'humide', en: 'wet' },
  sand: { colour: '#a8946c', polyhaven: 'park_sand', fr: 'sableux', en: 'sandy' },
  red: { colour: '#8c4a32', polyhaven: 'red_mud_stones', fr: 'rouge', en: 'red' },
  volcanic: { colour: '#3e3530', polyhaven: 'forest_ground_06', fr: 'volcanique', en: 'volcanic' },
  stony: { colour: '#7f7466', polyhaven: 'dry_ground_rocks', fr: 'caillouteux', en: 'stony' },
});

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * The kind of a soil unit, from its dominant soil and its description: the description's words first when they
 * name what shows (sand, chalk, a volcanic rock, stones, red earth), else the soil's group. Null when nothing says.
 */
export function soilKindOf(ger, description = '') {
  const g = plain(ger), d = plain(description);
  if (/basalte|volcan|trachy|andesit/.test(d) || /andosol/.test(g)) return 'volcanic';
  if (/fersialsol|rubefi/.test(g) || /\brouge/.test(d)) return 'red';
  if (/craie|crayeu/.test(d)) return 'chalk';
  if (/lithosol|peyrosol|rankosol|regosol/.test(g) || /caillou|pierr|graveleu|cailloutis/.test(d)) return 'stony';
  if (/podzosol|arenosol/.test(g) || /\bsabl/.test(d)) return 'sand';
  if (/calcosol|calcisol|rendosol|rendisol|dolomitosol/.test(g) || /calcair/.test(d)) return 'chalk';
  if (/reductisol|redoxisol|histosol|planosol|pelosol|tourb|hydromorph/.test(g + ' ' + d)) return 'wet';
  if (/fluviosol|colluviosol|thalassosol/.test(g) || /alluvi/.test(d)) return 'alluvial';
  if (/luvisol|limon/.test(g + ' ' + d)) return 'loam';
  if (/brunisol|alocrisol|cambisol|brun/.test(g + ' ' + d)) return 'brown';
  return null;
}

function inside(p, q) {
  let r = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    if ((q[i].z > p.z) !== (q[j].z > p.z) && p.x < (q[j].x - q[i].x) * (p.z - q[i].z) / (q[j].z - q[i].z) + q[i].x) r = !r;
  }
  return r;
}

/** The soil units of a WFS answer around `centre`: [{ kind, ring }] in local metres (those of no kind left out). */
export function readSoils(geojson, centre) {
  const { toLocal } = projector(centre);
  const out = [];
  for (const f of (geojson && Array.isArray(geojson.features)) ? geojson.features : []) {
    const kind = soilKindOf(f.properties && f.properties.ger_nom, f.properties && f.properties.nom_ucs);
    const g = f.geometry;
    if (!kind || !g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const p of polys) {
      const ring = (p[0] || []).filter(c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])).map(c => toLocal({ lat: c[1], lon: c[0] }));
      if (ring.length >= 4) out.push({ kind, ring });
    }
  }
  return out;
}

/** Some of a Zone's painted cells, spread (at most `n`): where its soil is read. */
function cellsOf(world, n = 25) {
  const m = world && world.masque;
  if (!m || typeof m.plein !== 'string') return world && Number.isFinite(world.cx) ? [{ x: world.cx, z: world.cz }] : [];
  const full = [];
  for (let k = 0; k < m.plein.length; k++) if (m.plein[k] === '1') full.push(k);
  const step = Math.max(1, Math.floor(full.length / n));
  const out = [];
  for (let k = 0; k < full.length; k += step) {
    const i = full[k] % m.nx, j = Math.floor(full[k] / m.nx);
    out.push({ x: m.x0 + (i + 0.5) * m.pas, z: m.z0 + (j + 0.5) * m.pas });
  }
  return out;
}

/** The soil kind under a Zone: the kind most of its cells stand on, or null. */
export function soilUnder(world, soils) {
  const votes = new Map();
  for (const p of cellsOf(world)) {
    const s = soils.find(u => inside(p, u.ring));
    if (s) votes.set(s.kind, (votes.get(s.kind) || 0) + 1);
  }
  let best = null;
  for (const [k, v] of votes) if (!best || v > best[1]) best = [k, v];
  return best ? best[0] : null;
}

/**
 * Each Zone of bare earth (`terrainType` 'terre') takes its soil's colour (`terrainColor`) and its kind (`soil`,
 * for the texture at the « Realistic » level). Changes `zones` in place; returns the kinds used, most used first.
 */
export function applySoils(zones, soils) {
  const used = new Map();
  for (const z of zones || []) {
    if (z.terrainType !== 'terre') continue;
    const kind = soilUnder(z.world, soils);
    if (!kind) continue;
    z.terrainColor = SOIL_KINDS[kind].colour;
    z.soil = kind;
    used.set(kind, (used.get(kind) || 0) + 1);
  }
  return [...used].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}
