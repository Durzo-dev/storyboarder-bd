/**
 * @file real-place-import.js
 * What the translator gives (osm-scene.js) and the altitudes (real-place-sources.js), turned into the
 * content of a Scene: Path and Zone objects, buildings and Elements to place, the relief and the credits.
 * PURE: ids come from `newId`; placing the buildings and Elements (2D frames, depth) is the screen's
 * (real-place-ui.js), which uses the application's own creation functions.
 */

import { TRACÉ_DEFAULTS } from './constants.js';
import { PROFONDEUR_RIVIERE, reliefDepuisAltitudes } from './terrain-relief.js';
import { LARGEUR_PAR_DEFAUT_M } from './terrain-plan.js';
import { poidsLisible } from './store-texts.js';

/**
 * A Path object (road, dirt path, wall, river) from a translated path, as the terrain editor lays one.
 * `nameOf(kind)`: the application's default name of a Path (canvas-tools.js, nomDuTrace), when OSM has none.
 */
export function pathObject(p, { panelId, newId, nameOf = (k) => k }){
  const def = TRACÉ_DEFAULTS[p.kind] || {};
  const o = { id: newId(), type: 'tracé', tracéType: p.kind, name: p.name || nameOf(p.kind), panelId,
    color: def.color, width: def.width, world: { ...p.world, pts: p.world.pts.map(q => ({ x: q.x, z: q.z })) } };
  // The plan's stroke keeps its proportion to the 3D width, as the terrain editor's settings do.
  if (p.world.width && def.width && LARGEUR_PAR_DEFAUT_M[p.kind]) o.width = def.width * p.world.width / LARGEUR_PAR_DEFAUT_M[p.kind];
  if (def.wallHeight !== undefined) o.wallHeight = def.wallHeight;
  if (p.kind === 'riviere') o.profondeur = PROFONDEUR_RIVIERE;
  if (p.marking === false) o.marquage = false;
  return o;
}

/** A Zone object (a painted mask) from a translated zone. */
export function zoneObject(z, { panelId, newId, nameOf = () => 'Terrain' }){
  return { id: newId(), type: 'tracé', tracéType: 'terrain', name: z.name || nameOf('terrain'), panelId, terrainType: z.terrainType, label: '',
    world: JSON.parse(JSON.stringify(z.world)) };
}

/**
 * The content of a Scene from a real place. `translated`: translateOsm's result; `altitudes`: planRelief's
 * assembly (or null: a flat Ground); `reliefCredit`: the altitude provider's attribution; `nameOf`: the
 * default name of a Path or Zone (nomDuTrace). Zones come first
 * (drawn under the Paths). Returns { traces, buildings, elements, relief, bornee, credits, counts }.
 */
export function sceneContentOf(translated, { panelId, newId, nameOf, altitudes = null, reliefCredit = null }){
  const zones = translated.zones.map(z => zoneObject(z, { panelId, newId, nameOf }));
  const paths = translated.paths.map(p => pathObject(p, { panelId, newId, nameOf }));
  const r = altitudes ? reliefDepuisAltitudes(altitudes) : null;
  const credits = [translated.attribution];
  if (translated.surveyAttribution) credits.push(translated.surveyAttribution);
  if (r && reliefCredit) credits.push(reliefCredit);
  return {
    traces: [...zones, ...paths],
    buildings: translated.buildings,
    elements: translated.elements,
    relief: r ? r.relief : null,
    ground: translated.ground || null,
    bornee: !!(r && r.bornee),
    credits,
    counts: { buildings: translated.buildings.length, paths: paths.length, zones: zones.length, elements: translated.elements.length },
  };
}

/**
 * THE IMPORT'S STEPS, in order, with their share of the progress bar (what they usually take: the map data
 * and the relief are network, the rest is computing).
 */
export const IMPORT_STEPS = Object.freeze(['map', 'country', 'buildings', 'facades', 'relief', 'scene', 'construction', 'ground']);
// The last two are the Scene's building (scene-loading.js), shown in the same window: one bar, start to end.
// 'facades': the colours read on street photos (#474c, the « Realistic » level; passed at the others).
const STEP_WEIGHTS = Object.freeze({ map: 0.28, country: 0.04, buildings: 0.1, facades: 0.08, relief: 0.18, scene: 0.04, construction: 0.23, ground: 0.05 });

/** The progress (0 to 1) at `step`, that step itself `sub` done (0 to 1). An unknown step: 0. */
export function importProgress(step, sub = 0){
  const i = IMPORT_STEPS.indexOf(step);
  if (i < 0) return 0;
  let done = 0;
  for (let k = 0; k < i; k++) done += STEP_WEIGHTS[IMPORT_STEPS[k]];
  return Math.min(1, done + STEP_WEIGHTS[step] * Math.max(0, Math.min(1, sub)));
}

/**
 * The line under the steps while the map data comes: the server asked (Overpass, with mirrors), the time
 * spent on it, what has arrived. `p`: { server, servers, bytes } from the main process; `lang`: 'en' or 'fr'.
 */
export function downloadDetail(p, seconds, lang = 'fr'){
  const en = lang === 'en';
  if (p && p.probing) return en ? 'Finding the most available server…' : 'Recherche du serveur le plus disponible…';
  if (!p || !(p.server > 0)) return '';
  const parts = [en ? `Server ${p.server} of ${p.servers}` : `Serveur ${p.server} sur ${p.servers}`, `${Math.max(0, Math.floor(seconds))} s`];
  parts.push(p.bytes > 0 ? `${poidsLisible(p.bytes, lang)} ${en ? 'received' : 'reçus'}` : (en ? 'waiting for the answer' : 'en attente de la réponse'));
  return parts.join(' · ');
}
