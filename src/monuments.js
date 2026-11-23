/**
 * @file monuments.js
 * THE KNOWN MONUMENTS OF A REAL PLACE (#475): which of an import's buildings are monuments (OpenStreetMap
 * says so), what to search for them in the store (Sketchfab), and how a chosen model takes a monument's
 * place: on its footprint, as high as it, turned along it, the generated building hidden (not deleted: the
 * choice can be undone). The user chooses: models are proposed after the import, never put in place
 * automatically (decided by Durzo: a fragment or a statue would otherwise replace a cathedral unseen). PURE.
 */
import { wordsOf } from './owned-first.js';

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

/** Words a monument's name shares with any other of its kind (and the little words): they find nothing of its own. */
const GENERIC_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'of', 'the', 'and', 'a', 'en',
  'eglise', 'church', 'cathedrale', 'cathedral', 'chapelle', 'chapel', 'basilique', 'basilica', 'abbaye', 'abbey',
  'tour', 'tower', 'chateau', 'castle', 'pont', 'bridge', 'place', 'square', 'monument', 'statue', 'fontaine',
  'fountain', 'musee', 'museum', 'palais', 'palace', 'porte', 'gate', 'hotel', 'temple', 'theatre', 'theater']);

/** The words of a monument's name that tell it apart (« Cathédrale Saint-Pierre » → saint, pierre); all if none does. */
export function distinctiveWords(name){
  const words = wordsOf(name);
  const own = words.filter(w => !GENERIC_WORDS.has(w));
  return own.length ? own : words;
}

/** How many of a search's first results are looked at for a monument (one page of the store). */
export const FIRST_RESULTS = 24;

/**
 * Has the store a model of this monument (#480d, decided with Durzo: the step proposes a search only then)? One of
 * its first FIRST_RESULTS, under a licence the step accepts, whose name holds every distinctive word of the
 * monument's (measured on 15 monuments, 23 Nov.: the famous found, the local ones not; a homonym passes, « Chapelle
 * Saint-Michel » of another town: the user then sees it is not theirs).
 */
export function modelFound(monument, results){
  const asked = distinctiveWords(searchFor(monument));
  if (!asked.length) return false;
  return (results || []).slice(0, FIRST_RESULTS).some(r => r && licenceAccepted(r.licence)
    && asked.every(a => wordsOf(r.nom).includes(a)));
}
