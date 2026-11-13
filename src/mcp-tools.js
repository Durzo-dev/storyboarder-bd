/**
 * @file mcp-tools.js
 * THE TOOLS an AI's client calls (docs/en/mcp.md): what each one is, as the AI reads it (name, description,
 * input schema), and what it does, through the application's own gestures injected by mcp-link.js
 * (`deps`), so that the decisions here stay testable without a window. The arguments are checked against the
 * schema before `run` (mcp-protocol.js); `run` checks the rest (an unknown Scene, a place not found) and
 * says it as a ToolError the AI can act on.
 */

import { ToolError, toolText } from './mcp-protocol.js';
import { DETAIL_LEVELS, ZONE_SIDE_MAX } from './osm-scene.js';
import { estUnBatimentPlace, encombrementDuBatiment } from './batiment-element.js';

/** What the AI is told of the server when it connects. */
export const INSTRUCTIONS = [
  'Storyboarder is a comic storyboarding application. Its Scenes are 3D sets (buildings, roads, grounds, relief, objects) that its Panels film.',
  'Start with list_scenes or create_scene_from_place; read_scene tells what a Scene holds; scene_preview shows it as an image.',
  'Distances are metres. In a Scene, x points east and z points south, from the centre of the Scene.',
].join(' ');

/** How long create_scene_from_place waits for its import before answering that it goes on (milliseconds). */
const IMPORT_WAIT_MS = 40000;
/** The smallest zone a real place is imported at (metres a side). */
const ZONE_SIDE_MIN = 50;
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

const sceneOf = (scenes, id) => {
  const s = scenes.find(x => x.id === id);
  if (!s) throw new ToolError(`No Scene has the id "${id}". Call list_scenes for the ids.`);
  return s;
};
const objectsOf = (scene) => (scene.pages && scene.pages[0] && scene.pages[0].objects) || [];
const panelOf = (scene) => objectsOf(scene).find(o => o.type === 'panel') || null;

/** One Scene in a list: its id, name, and what it holds. */
export function sceneListItem(scene){
  const objects = objectsOf(scene);
  const panel = panelOf(scene);
  const traces = objects.filter(o => o.type === 'tracé');
  return {
    id: scene.id,
    name: scene.name || '',
    buildings: objects.filter(o => estUnBatimentPlace(o)).length,
    paths: traces.filter(t => t.tracéType !== 'terrain').length,
    zones: traces.filter(t => t.tracéType === 'terrain').length,
    objects: objects.filter(o => o.type === 'objet3d' && !estUnBatimentPlace(o)).length,
    place: panel && panel.lieu ? { ...panel.lieu } : null,
  };
}

/** One building of a Scene: where it stands (metres from the centre), its size, levels and finishes. */
function buildingSummary(o){
  const b = o.batiment;
  const size = encombrementDuBatiment(b);
  const levels = (b.niveaux || []).filter(n => n.elevation > -1e-9).length;
  const top = (b.niveaux || []).reduce((p, q) => (!p || q.elevation > p.elevation ? q : p), null);
  return {
    id: o.id,
    name: o.name || b.nom || '',
    x: round(o.wxFloor || 0), z: round(o.wzFloor || 0),
    width_m: round(size.largeur), depth_m: round(size.profondeur), height_m: round(size.hauteur),
    levels,
    roof: (top && top.toit && top.toit.type) || null,
    facade_colour: (b.facade && b.facade.couleur) || null,
  };
}

/** What a Scene holds, for read_scene. */
export function sceneSummary(scene){
  const objects = objectsOf(scene);
  const panel = panelOf(scene);
  const traces = objects.filter(o => o.type === 'tracé');
  const count = (list, key) => list.reduce((m, t) => { const k = t[key] || 'other'; m[k] = (m[k] || 0) + 1; return m; }, {});
  // The relief: heights above its base altitude (terrain-relief.js).
  const r = panel && panel.relief;
  const h = r && r.h && r.h.length ? Array.from(r.h) : null;
  let relief = null;
  if (h) {
    const base = Number(r.altitude) || 0;
    let lo = Infinity, hi = -Infinity;
    for (const v of h) if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (lo <= hi) relief = { lowest_m: round(base + lo), highest_m: round(base + hi) };
  }
  return {
    ...sceneListItem(scene),
    ground: (panel && panel.groundType) || null,
    relief,
    credits: (panel && panel.creditsDuLieu) || [],
    building_list: objects.filter(o => estUnBatimentPlace(o)).map(buildingSummary),
    paths_by_kind: count(traces.filter(t => t.tracéType !== 'terrain'), 'tracéType'),
    zones_by_ground: count(traces.filter(t => t.tracéType === 'terrain'), 'terrainType'),
  };
}

/**
 * The tools, bound to the application's gestures. `deps`:
 *   - scenes(): the Project's Scenes;
 *   - importPlace({ query, lat, lon, sideM, detail }): imports a real place as a new Scene, shown to the user
 *     as the « New scene » window would; resolves to { scene } or { error } (a sentence);
 *   - preview(scene): opens the Scene, waits for it to be built and drawn, resolves to { data, mimeType } (an
 *     image of the Scene's view, base64).
 */
export function makeTools(deps){
  return [
    {
      name: 'list_scenes',
      title: 'List the Scenes',
      description: 'The Scenes of the Project open in Storyboarder: id, name, how many buildings, paths, zones and objects each holds, and the real place it was made from (if any).',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      run: async () => {
        const list = deps.scenes().map(sceneListItem);
        const lines = list.map(s => `- ${s.id} « ${s.name} »: ${s.buildings} buildings, ${s.paths} paths, ${s.zones} zones, ${s.objects} objects`);
        return toolText(list.length ? `${list.length} Scene(s):\n${lines.join('\n')}` : 'The Project has no Scene yet.', { scenes: list });
      },
    },
    {
      name: 'read_scene',
      title: 'Read a Scene',
      description: 'What a Scene holds: its place, ground, relief, credits, the paths and zones by kind, and every building (id, position x/z in metres from the centre, x east and z south, size, levels, roof, facade colour).',
      inputSchema: {
        type: 'object',
        properties: { scene_id: { type: 'string', description: 'The Scene\'s id, from list_scenes.' } },
        required: ['scene_id'], additionalProperties: false,
      },
      run: async ({ scene_id }) => {
        const summary = sceneSummary(sceneOf(deps.scenes(), scene_id));
        return toolText(`Scene « ${summary.name} »: ${summary.buildings} buildings, ${summary.paths} paths, ${summary.zones} zones. Details in the structured content.`, summary);
      },
    },
    {
      name: 'create_scene_from_place',
      title: 'Create a Scene from a real place',
      description: 'Imports a real place as a new Scene: buildings (OpenStreetMap, and in France the IGN\'s survey for heights and roofs), roads, pavements, grounds, trees, relief. Give the place by name (an address, a square, a town) or by its coordinates. It takes from 20 seconds to a few minutes; the user sees its progress and may cancel it.',
      inputSchema: {
        type: 'object',
        properties: {
          place: { type: 'string', minLength: 2, maxLength: 200, description: 'The place\'s name or address, e.g. « Place de la Comédie, Montpellier ». Not needed with lat and lon.' },
          lat: { type: 'number', minimum: -90, maximum: 90, description: 'The centre\'s latitude (WGS 84).' },
          lon: { type: 'number', minimum: -180, maximum: 180, description: 'The centre\'s longitude (WGS 84).' },
          size_m: { type: 'integer', minimum: ZONE_SIDE_MIN, maximum: ZONE_SIDE_MAX, description: `The side of the square zone, metres (${ZONE_SIDE_MIN} to ${ZONE_SIDE_MAX}; 200 by default). Larger is slower.` },
          detail: { type: 'string', enum: [...DETAIL_LEVELS], description: 'simple: volumes; detailed (default): windows, doors, finishes; realistic: also facades styled by region and coloured from street photos.' },
        },
        additionalProperties: false,
      },
      run: async ({ place, lat, lon, size_m = 200, detail = 'detailed' }) => {
        const coords = lat !== undefined || lon !== undefined;
        if (coords && (lat === undefined || lon === undefined)) throw new ToolError('Give both lat and lon, or a place by name.');
        if (!coords && !place) throw new ToolError('Give a place by name, or its lat and lon.');
        const importing = deps.importPlace({ query: coords ? null : place, lat, lon, sideM: size_m, detail, name: place || null });
        // ⚠️ AN IMPORT OUTLASTS A CLIENT'S PATIENCE (seen: Claude's call timed out while the Scene was being
        // built, the Scene made all the same). After IMPORT_WAIT_MS the tool answers that it goes on.
        const r = await Promise.race([importing, new Promise(ok => setTimeout(() => ok({ pending: true }), deps.importWaitMs ?? IMPORT_WAIT_MS))]);
        if (r && r.pending) {
          return toolText(`The import goes on in Storyboarder (a large place takes a few minutes; the user sees its progress). Call list_scenes in a minute: the new Scene appears there${place ? ` (« ${place} »)` : ''}, with its place.`, { pending: true });
        }
        if (!r || r.error) throw new ToolError(r && r.error ? r.error : 'The import failed.');
        const item = sceneListItem(r.scene);
        return toolText(`Scene « ${item.name} » created (id ${item.id}): ${item.buildings} buildings, ${item.paths} paths, ${item.zones} zones. Call scene_preview to see it.`, item);
      },
    },
    {
      name: 'scene_preview',
      title: 'See a Scene',
      description: 'An image of a Scene as its camera sees it (from above, after an import). Opens the Scene in Storyboarder.',
      inputSchema: {
        type: 'object',
        properties: { scene_id: { type: 'string', description: 'The Scene\'s id, from list_scenes.' } },
        required: ['scene_id'], additionalProperties: false,
      },
      run: async ({ scene_id }) => {
        const scene = sceneOf(deps.scenes(), scene_id);
        const img = await deps.preview(scene);
        if (!img || !img.data) throw new ToolError('The Scene could not be drawn (was it closed while drawn?). Try again.');
        return { content: [{ type: 'image', data: img.data, mimeType: img.mimeType || 'image/jpeg' }, { type: 'text', text: `Scene « ${scene.name} », as its camera sees it.` }] };
      },
    },
  ];
}
