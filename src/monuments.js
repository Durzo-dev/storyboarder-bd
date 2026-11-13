/**
 * @file monuments.js
 * THE KNOWN MONUMENTS OF A REAL PLACE (#475): which of an import's buildings are monuments (OpenStreetMap
 * says so), what to search for them in the store (Sketchfab), and how a chosen model takes a monument's
 * place: on its footprint, as high as it, turned along it, the generated building hidden (not deleted: the
 * choice can be undone). The user chooses: models are proposed after the import, never put in place
 * automatically (decided by Durzo: a fragment or a statue would otherwise replace a cathedral unseen). PURE.
 */

/** Buildings that are monuments by their very type. */
const MONUMENT_BUILDINGS = ['cathedral', 'church', 'chapel', 'basilica', 'castle', 'palace', 'temple', 'mosque', 'synagogue', 'shrine', 'tower'];
/** `historic` values that are no monument of interest here. */
const NOT_MONUMENTS = ['no', 'building'];

/**
 * A building's monument, or null: a named building that OSM links to Wikidata, lists as heritage or
 * historic, as a sight or a museum, or whose type is a church, a castle, a palace… Returns { name, nameEn,
 * wikidata } (`nameEn`: OSM `name:en` when it differs, a second search).
 */
export function monumentOf(tags = {}){
  const name = typeof tags.name === 'string' ? tags.name.trim() : '';
  if (!name) return null;
  const known = !!tags.wikidata || !!tags.heritage || (tags.historic && !NOT_MONUMENTS.includes(tags.historic))
    || ['attraction', 'museum'].includes(tags.tourism) || MONUMENT_BUILDINGS.includes(tags.building);
  if (!known) return null;
  const m = { name };
  const en = typeof tags['name:en'] === 'string' ? tags['name:en'].trim() : '';
  if (en && en !== name) m.nameEn = en;
  if (/^Q\d+$/.test(tags.wikidata || '')) m.wikidata = tags.wikidata;
  return m;
}

/** The search to open the store on for a monument: its English name when OSM gives one (Sketchfab's titles are mostly English), else its name. */
export function searchFor(monument){
  return (monument && (monument.nameEn || monument.name)) || '';
}

/**
 * The turn (radians, about the vertical, as an Element's `rotY`) that lays a model's x axis along a
 * footprint's main direction (`outline`: [{x, z}…], its principal axis). The model may still face the
 * wrong way by a half or quarter turn: the user turns it, as any Element.
 */
export function alongFootprint(outline){
  const n = outline.length;
  if (n < 3) return 0;
  const c = outline.reduce((m, p) => ({ x: m.x + p.x / n, z: m.z + p.z / n }), { x: 0, z: 0 });
  let xx = 0, zz = 0, xz = 0;
  for (const p of outline) { const dx = p.x - c.x, dz = p.z - c.z; xx += dx * dx; zz += dz * dz; xz += dx * dz; }
  const angle = 0.5 * Math.atan2(2 * xz, xx - zz);   // the main axis, from +x towards +z
  // rotation.y turns +x towards -z: the opposite sign.
  return Math.round(-angle * 1000) / 1000 || 0;   // never -0
}

/** The monuments of a Scene's page still shown (their generated building not yet replaced). */
export function monumentsOf(objects = []){
  return objects.filter(o => o && o.type === 'objet3d' && o.objType === 'batiment' && o.monument && !o.hidden3d);
}

/** The licences proposed for a monument: all but « no derivatives » (ND; the non-commercial ones show their warning). */
export function licenceAccepted(licence){
  return !(licence && typeof licence.code === 'string' && /(^|-)nd($|-)/.test(licence.code));
}
