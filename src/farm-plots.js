/**
 * src/farm-plots.js: THE FARM PLOTS OF A PLACE (France): the RPG, the parcels farmers declare to the CAP, each with
 * its crop. PURE.
 *
 * The IGN's `RPG.LATEST:parcelles_graphiques` (Géoplateforme WFS, no key): `code_group` (the crop's group, « 1 »
 * soft wheat … « 28 » various) and `code_cultu` (the crop itself, « BTH », « VRC », « OLI »). Measured on 17 Nov. 2026
 * (0.05 to 2.3 s): Sorède, 176 parcels within 1.5 km (vines 67, orchards 32, olives 4, fallows 16, rangelands 27);
 * the Beauce, wheat, barley, rape; Alsace, vines; Dordogne, meadows, maize, a walnut grove.
 *
 * Each parcel gives a Zone of its ground (`PLOT_GROUNDS`: earth tinted by its crop, or grass), cut out of the
 * OSM farmland and meadows under it (one Zone per cell: two flat Zones on one cell would flicker); orchards,
 * olive groves and nut groves are Zones with their trees in rows (`orchard`: drawn by orchard-3d.js). Vines: their
 * ground here, their stocks in rows
 * (`vines`: their direction; vineyard.js, drawn by vineyard-3d.js).
 */
import { projector } from './geo-local.js';
import { maskOfPolygon, insidePolygon } from './osm-scene.js';
import { mondeDuMasque } from './terrain-zone-pinceau.js';
import { vineRowAngle } from './vineyard.js';
import { speciesFor } from './tree-species.js';
import { cropOfGroup } from './crops-3d.js';

/** The credit of the RPG. */
export const RPG_CREDIT = Object.freeze({ fr: 'Parcelles agricoles : © IGN, RPG', en: 'Farm plots: © IGN, RPG' });

/**
 * A crop group's ground: `terrainType`, a tint (`terrainColor`, the crop's colour over the earth), and the trees
 * that fill it (`fill`: a kind of vegetation-zones.js and its genera). By `code_group`; one not named: none.
 */
const CEREAL = { terrainType: 'terre', terrainColor: '#b59c58' };      // straw and ears, golden
const FIELD = { terrainType: 'terre', terrainColor: '#8c8a4c' };       // rape, sunflower, peas: a green crop
const FALLOW = { terrainType: 'herbe', terrainColor: '#8c9a5c' };      // dry grass
export const PLOT_GROUNDS = Object.freeze({
  1: CEREAL, 2: CEREAL, 3: CEREAL, 4: CEREAL, 14: CEREAL,
  5: FIELD, 6: FIELD, 7: FIELD, 8: FIELD, 9: FIELD, 15: FIELD, 24: FIELD, 26: FIELD,
  11: FALLOW, 28: FALLOW,
  16: { terrainType: 'herbe' }, 18: { terrainType: 'herbe' }, 19: { terrainType: 'herbe' },
  17: { terrainType: 'herbe', terrainColor: '#7f9257' },                // summer pastures and heaths
  20: { terrainType: 'herbe', fill: { kind: 'orchard', genera: ['Malus', 'Prunus', 'Pyrus'] } },
  21: { terrainType: 'terre', vines: true },
  22: { terrainType: 'herbe', fill: { kind: 'nuts', genera: ['Juglans', 'Corylus', 'Castanea'] } },
  23: { terrainType: 'terre', terrainColor: '#9a7a55', fill: { kind: 'olives', genera: ['Olea'] } },
  25: { terrainType: 'terre', terrainColor: '#6a4a30' },                // vegetables and flowers: tilled earth
});

/** A nut grove's genus by its crop when it says which (walnut, hazelnut, chestnut, almond). */
const NUT_GENUS = Object.freeze({ NOX: 'Juglans', NOS: 'Corylus', CTG: 'Castanea', AME: 'Prunus' });

/** A parcel's ground and fill from its group and crop, or null. */
export function groundOfPlot(group, crop = '') {
  const g = PLOT_GROUNDS[parseInt(group, 10)];
  if (!g) return null;
  const nut = g.fill && g.fill.kind === 'nuts' && NUT_GENUS[String(crop).toUpperCase()];
  return nut ? { ...g, fill: { ...g.fill, genera: [nut] } } : g;
}

/** The outer rings and their holes of a GeoJSON geometry, in local metres. */
function ringsOf(g, toLocal) {
  const polys = !g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  const loc = (r) => (Array.isArray(r) ? r.filter(c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map(c => toLocal({ lat: c[1], lon: c[0] })) : []);
  return polys.map(p => ({ ring: loc(p[0]), holes: p.slice(1).map(loc).filter(h => h.length >= 4) })).filter(p => p.ring.length >= 4);
}

/**
 * The BD TOPO's vineyards and orchards (`BDTOPO_V3:zone_de_vegetation`, natures « Vigne » and « Verger »: the same
 * answer as the woods, vegetation-zones.js) as plots: they cover what the RPG lacks (not declared, outside the CAP).
 * Laid after the RPG's (addPlotGrounds: a cell an RPG plot holds is left to it).
 */
export function readBdTopoVines(geojson, centre) {
  const { toLocal } = projector(centre);
  const out = [];
  for (const f of (geojson && geojson.features) || []) {
    const nature = String((f.properties || {}).nature || '');
    // A vineyard, an orchard (its genera those of the RPG's orchards).
    const group = /vigne/i.test(nature) ? 21 : /verger/i.test(nature) ? 20 : 0;
    if (!group) continue;
    for (const r of ringsOf(f.geometry, toLocal)) out.push({ group, crop: 'BDTOPO', ground: PLOT_GROUNDS[group], source: 'bdtopo', ...r });
  }
  return out;
}

/** The RPG's answer (GeoJSON) around `centre` → [{ group, crop, ground, ring, holes }] in local metres. */
export function readPlots(geojson, centre) {
  const { toLocal } = projector(centre);
  const out = [];
  for (const f of (geojson && geojson.features) || []) {
    const p = f.properties || {};
    const ground = groundOfPlot(p.code_group, p.code_cultu);
    if (!ground) continue;
    for (const r of ringsOf(f.geometry, toLocal)) out.push({ group: parseInt(p.code_group, 10), crop: String(p.code_cultu || ''), ground, ...r });
  }
  return out;
}

/**
 * An orchard's rows by its kind: rows `gap` apart (m), a tree every `step`, as high as `height` (m; a pruned fruit tree,
 * a grown olive or walnut), the trees' type (for their species, speciesFor).
 */
export const ORCHARD_KINDS = Object.freeze({
  orchard: { gap: 5, step: 3.5, height: 4, objType: 'arbre' },
  olives: { gap: 7, step: 6, height: 5, objType: 'olivier' },
  nuts: { gap: 9, step: 8, height: 9, objType: 'arbre' },
});

/** An orchard plot's `orchard` field: its rows' direction, its species (one of its genera, drawn from its outline). */
export function orchardOf(p) {
  const fill = p.ground && p.ground.fill, kind = fill && ORCHARD_KINDS[fill.kind];
  if (!kind) return null;
  const c = p.ring[0] || { x: 0, z: 0 };
  const pick = Math.abs(Math.round(c.x * 7 + c.z * 13)) % fill.genera.length;
  const essence = speciesFor(kind.objType, fill.genera[pick]);
  return essence ? { angle: vineRowAngle(p.ring), essence, gap: kind.gap, step: kind.step, height: kind.height } : null;
}


/** The grounds a parcel takes the place of: OSM's farmland, meadows, orchards and vines (earth or grass). */
const YIELDING = new Set(['terre', 'herbe']);

/** A mask's cell holding (x, z), or -1. */
function cellOf(m, x, z) {
  const i = Math.floor((x - m.x0) / m.pas), j = Math.floor((z - m.z0) / m.pas);
  return i >= 0 && j >= 0 && i < m.nx && j < m.nz ? j * m.nx + i : -1;
}

/**
 * Each plot as a Zone of its ground (`translated.zones`, changed in place), within `halfSize`: its cells cut out of
 * the earth and grass Zones already there (OSM's farmland), and its own cells left out where another ground holds
 * them (a building's yard, a road's verge, water). Holes kept out. Returns how many Zones were added.
 */
export function addPlotGrounds(translated, plots, halfSize) {
  let n = 0;
  // The Zones' cells as arrays while cutting (a string rebuilt at each cell cost seconds on a large field).
  const cellsOf = new Map();
  const cellsOfZone = (z) => { if (!cellsOf.has(z)) cellsOf.set(z, z.world.masque.plein.split('')); return cellsOf.get(z); };
  for (const p of plots) {
    const mask = maskOfPolygon(p.ring, halfSize);
    if (!mask) continue;
    const cells = mask.plein.split('');
    const others = translated.zones.filter(z => z.world && z.world.masque);
    for (let k = 0; k < cells.length; k++) {
      if (cells[k] !== '1') continue;
      const x = mask.x0 + (k % mask.nx + 0.5) * mask.pas, z = mask.z0 + (Math.floor(k / mask.nx) + 0.5) * mask.pas;
      if (p.holes.some(h => insidePolygon({ x, z }, h))) { cells[k] = '0'; continue; }
      // The Zones holding this cell: if one of them keeps it (another ground, an earlier plot), the plot leaves it;
      // else the plot takes it from all of them (two OSM grounds may overlap: none left holding it).
      const holders = [];
      for (const zone of others) {
        const c = cellOf(zone.world.masque, x, z);
        if (c >= 0 && cellsOfZone(zone)[c] === '1') holders.push([zone, c]);
      }
      if (holders.some(([zone]) => !YIELDING.has(zone.terrainType) || zone.plot)) cells[k] = '0';
      else for (const [zone, c] of holders) cellsOfZone(zone)[c] = '0';
    }
    const plein = cells.join('');
    if (!plein.includes('1')) continue;
    const world = mondeDuMasque({ ...mask, plein });
    if (!world) continue;
    const zone = { terrainType: p.ground.terrainType, world, source: p.source || 'rpg', code: p.crop, plot: true };
    if (p.ground.terrainColor) zone.terrainColor = p.ground.terrainColor;
    // A vineyard: its stocks in rows along its longest side, drawn at render time (vineyard.js).
    if (p.ground.vines) zone.vines = { angle: vineRowAngle(p.ring) };
    // An orchard, an olive or nut grove: its trees in rows, drawn at render time (orchard-3d.js).
    const orchard = orchardOf(p);
    if (orchard) zone.orchard = orchard;
    // A field of wheat, maize, sunflowers or rape: its crop standing in rows (crops-3d.js, #481c).
    const crop = cropOfGroup(p.group);
    if (crop && p.source !== 'bdtopo') zone.crop = { kind: crop, angle: vineRowAngle(p.ring) };
    translated.zones.push(zone);
    cellsOf.set(zone, cells);
    n++;
  }
  // The slivers between two neighbouring parcels (their outlines a few centimetres apart, a cell's centre falling
  // between them) given to a plot around them: a cell held by no Zone, two or more of its neighbours the plot's.
  const heldByAny = (x, z) => [...cellsOf.keys(), ...translated.zones].some(zone => {
    const m = zone.world && zone.world.masque; const c = m ? cellOf(m, x, z) : -1;
    return c >= 0 && (cellsOf.has(zone) ? cellsOf.get(zone)[c] : m.plein[c]) === '1';
  });
  for (const zone of translated.zones.filter(z => z.plot)) {
    const m = zone.world.masque, cells = cellsOfZone(zone), before = cells.slice();   // counted on `before`: no creeping
    for (let k = 0; k < cells.length; k++) {
      if (cells[k] === '1') continue;
      const i = k % m.nx, j = Math.floor(k / m.nx);
      const own = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => {
        const ii = i + a, jj = j + b; return ii >= 0 && jj >= 0 && ii < m.nx && jj < m.nz && before[jj * m.nx + ii] === '1';
      }).length;
      if (own >= 2 && !heldByAny(m.x0 + (i + 0.5) * m.pas, m.z0 + (j + 0.5) * m.pas)) cells[k] = '1';
    }
  }
  for (const [z, cells] of cellsOf) {
    const plein = cells.join('');
    z.world = mondeDuMasque({ ...z.world.masque, plein }) || { ...z.world, masque: { ...z.world.masque, plein } };
  }
  // An OSM Zone left with no cell: gone.
  translated.zones = translated.zones.filter(z => !(z.world && z.world.masque) || z.world.masque.plein.includes('1'));
  return n;
}
