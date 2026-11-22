/**
 * @file src/realistic-textures.js
 * THE « REALISTIC » LEVEL'S TEXTURES: what a place imported at that level wears in the bundled textures' place.
 *
 * « Detailed » dresses the facades, the grounds and the Paths with the bundled textures only (it works offline):
 * a render, a dressed stone, the low wall's bricks, cobbles, gravel, asphalt. « Realistic » looks further: each
 * of those has a Poly Haven texture (CC0) chosen by hand, by region where the region shows (a pale sandstone in
 * the south, grey blocks in the north), downloaded once into « My textures » (real-place-ui.js) and laid instead.
 * A choice that IS the bundled texture's source needs nothing: the bundled one stays.
 *
 * Pure: the table, what a translated place needs, and the swap.
 */
import { PROVENANCE } from './textures-integrees.js';
import { BRICK_TINT } from './building-survey.js';

/**
 * The slots: what is swapped, the usages its texture must serve (texture-matieres.js), and the Poly Haven id
 * for the south (`south`, latitude under 46°) and the north. Chosen with Durzo on the catalogue (22 Nov. 2026).
 */
export const REALISTIC_TEXTURES = Object.freeze({
  render: { usages: ['mur-ext'], south: 'painted_plaster_wall', north: 'white_stucco_02' },
  stone: { usages: ['mur-ext'], south: 'sandstone_blocks_05', north: 'medieval_blocks_03' },
  brick: { usages: ['mur-ext'], south: 'red_bricks_04', north: 'red_bricks_04' },
  paving: { usages: ['sol', 'route', 'chemin'], south: 'cobblestone_floor_08', north: 'cobblestone_floor_08' },
  gravel: { usages: ['sol', 'chemin'], south: 'gravel_floor', north: 'gravel_floor' },
  asphalt: { usages: ['sol'], south: 'clean_asphalt', north: 'clean_asphalt' },
  road: { usages: ['route'], south: 'asphalt_04', north: 'asphalt_04' },
  lowWall: { usages: ['muret'], south: 'rustic_stone_wall_02', north: 'stone_wall' },
});

/** The Poly Haven ids the bundled grains come from (PROVENANCE): those are never downloaded. */
const BUNDLED = new Set(Object.values(PROVENANCE).filter(p => p[1] === 'Poly Haven').map(p => p[0]));

const FACADES = { 'int:facade:enduit': 'render', 'int:facade:pierre': 'stone', 'int:trace:muret': 'brick' };
const GROUNDS = { paves: 'paving', gravier: 'gravel', bitume: 'asphalt' };

/** The slot of a facade ({ texture, couleur }), or null. */
export const facadeSlot = (f) => (f && FACADES[f.texture]) || null;
/** The slot of a Zone (its `terrainType`), or null. */
export const zoneSlot = (z) => (z && GROUNDS[z.terrainType]) || null;
/** The slot of a Path ({ kind, traceTexture }), or null. */
export function pathSlot(p){
  if (!p) return null;
  if (p.traceTexture === 'int:sol:paves' && (p.kind === 'route' || p.kind === 'chemin')) return 'paving';
  if (p.traceTexture === 'int:sol:gravier' && p.kind === 'chemin') return 'gravel';
  if (p.traceTexture === 'int:facade:pierre' && p.kind === 'muret') return 'lowWall';
  if (p.kind === 'route' && !p.traceTexture) return 'road';
  return null;
}

/** The Poly Haven id of a slot for the region, or null when the bundled texture is that one already. */
export function realisticTextureOf(slot, { south = false } = {}){
  const s = REALISTIC_TEXTURES[slot];
  if (!s) throw new Error(`realistic-textures: unknown slot « ${slot} »`);
  const id = south ? s.south : s.north;
  return BUNDLED.has(id) ? null : id;
}

/**
 * What a translated place (osm-scene.js) needs from the stores: `[{ slot, polyhaven, usages }]`, each slot it
 * uses once, in the table's order, those whose bundled texture stays left out.
 */
export function realisticNeeds(translated, { south = false } = {}){
  const used = new Set([
    ...(translated.buildings || []).map(e => facadeSlot(e && e.building && e.building.facade)),
    ...(translated.zones || []).map(zoneSlot),
    ...(translated.paths || []).map(pathSlot),
  ]);
  return Object.keys(REALISTIC_TEXTURES).filter(k => used.has(k))
    .map(slot => ({ slot, polyhaven: realisticTextureOf(slot, { south }), usages: REALISTIC_TEXTURES[slot].usages }))
    .filter(n => n.polyhaven);
}

/**
 * Lays the stores' textures (`ids`: slot → `tex:…`) in place, in `translated`. A brick facade's default tint goes
 * (the bricks are red already); a render keeps its colour (it tints the plaster). Returns how many were laid.
 */
export function applyRealisticTextures(translated, ids = {}){
  let laid = 0;
  for (const e of translated.buildings || []) {
    const f = e && e.building && e.building.facade;
    const id = ids[facadeSlot(f)];
    if (!id) continue;
    e.building.facade = { texture: id, couleur: facadeSlot(f) === 'brick' && f.couleur === BRICK_TINT ? null : f.couleur };
    laid++;
  }
  for (const z of translated.zones || []) {
    const id = ids[zoneSlot(z)];
    if (id) { z.terrainType = id; delete z.terrainColor; laid++; }
  }
  for (const p of translated.paths || []) {
    const id = ids[pathSlot(p)];
    if (id) { p.traceTexture = id; laid++; }
  }
  return laid;
}
