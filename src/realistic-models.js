/**
 * @file realistic-models.js
 * THE REALISTIC LEVEL'S MODELS (#480c): at a Realistic import, the built-in objects of the place (its trees,
 * of its own flora, its benches, lamps, bins…) are replaced by 3D models found on Sketchfab, chosen alone
 * (decided with Durzo, 13 Nov. 2026): free licences only (CC0, CC-BY: credited), light (faces, weight),
 * not animated, their name saying what they are, a few variants for each use (several conifers…). No
 * building (a monument has its own step). Without an answer, the built-in object stays.
 *
 * MEASURED on Sketchfab's search (13 Nov. 2026): a query alone brings packs, dioramas, scans of 100 MB,
 * « Hollow Knight » for « bench »: hence the name each result must bear (`name`), the words that rule one
 * out (EXCLUDED), the faces and weight. « stone pine » finds stones: « umbrella pine ». « cypress » finds
 * the bald cypress (another tree): left out.
 *
 * The choice is PURE (queries, candidates); the search and the downloads are the renderer's (store-ui.js).
 */

/** Words that rule a result out: a pack or a scene, not one object; a ruin; a cartoon. */
const EXCLUDED = /\b(pack|set|kit|collection|bundle|diorama|scene|environment|abandoned|ruin(ed)?|broken|destroyed|toon|cartoon|stylized|stylised|minecraft|voxel|exploded|assembly|game assets|props)\b/i;
/** The faces a model may have: under, a placeholder (a billboard, a cube); over, too heavy for a street of them. */
export const FACES = Object.freeze({ min: 300, max: 30000 });
/** The heaviest download (bytes): its textures are shrunk afterwards, but it is downloaded whole. */
export const MAX_BYTES = 8e6;
/** The licences taken alone: free, commercial use and changes allowed (CC-BY is credited). */
const FREE = new Set(['cc0', 'by']);
/** The most models downloaded for one import (the time it takes). */
export const MAX_DOWNLOADS = 14;

/**
 * The uses replaced, by built-in object: what to search (`queries`, in order), what a result's name must
 * say (`name`), what rules it out besides (`not`), how many variants.
 */
export const MODEL_USAGES = Object.freeze({
  arbre: { queries: ['tree'], name: /tree/i, not: /palm|pine|fir|cypress|olive|dead|christmas/i, variants: 3 },
  conifere: { queries: ['pine tree', 'conifer tree', 'fir tree'], name: /pine|conifer|fir|spruce|cedar/i, not: /umbrella|stone pine|christmas/i, variants: 2 },
  pin_parasol: { queries: ['umbrella pine'], name: /umbrella pine|stone pine|pinus pinea/i, variants: 1 },
  cypres: { queries: ['cypress tree'], name: /cypress/i, not: /bald/i, variants: 2 },
  olivier: { queries: ['olive tree'], name: /olive/i, not: /palm/i, variants: 2 },
  palmier: { queries: ['palm tree'], name: /palm/i, variants: 2 },
  arbuste: { queries: ['shrub'], name: /shrub|bush/i, variants: 2 },
  buisson: { queries: ['bush'], name: /bush|shrub/i, variants: 2 },
  bac_fleurs: { queries: ['flower planter', 'planter box'], name: /planter/i, variants: 1 },
  banc: { queries: ['park bench', 'street bench'], name: /bench/i, variants: 2 },
  lampadaire: { queries: ['street lamp', 'street light'], name: /street ?(lamp|light)|lamp ?post|lantern/i, variants: 1 },
  borne: { queries: ['bollard'], name: /bollard/i, variants: 1 },
  poubelle: { queries: ['litter bin', 'street trash can'], name: /bin\b|trash|garbage|waste/i, variants: 1 },
  abribus: { queries: ['bus shelter', 'bus stop shelter'], name: /bus ?(stop|shelter)/i, variants: 1 },
  fontaine: { queries: ['fountain'], name: /fountain/i, not: /pen|drinking/i, variants: 1 },
});

/** A broadleaved genus's English name (what Sketchfab's titles say), for the place's own trees. */
const GENUS_EN = Object.freeze({
  Platanus: 'plane tree', Quercus: 'oak tree', Tilia: 'linden tree', Acer: 'maple tree', Fraxinus: 'ash tree',
  Aesculus: 'horse chestnut tree', Betula: 'birch tree', Fagus: 'beech tree', Ulmus: 'elm tree', Populus: 'poplar tree',
  Salix: 'willow tree', Prunus: 'cherry tree', Castanea: 'chestnut tree', Magnolia: 'magnolia tree', Carpinus: 'hornbeam tree',
  Robinia: 'locust tree', Ginkgo: 'ginkgo tree', Eucalyptus: 'eucalyptus tree', Ficus: 'fig tree', Malus: 'apple tree',
});

/** The searches for a use: a broadleaved tree first as the place's own genera (flora.js), then any tree. */
export function queriesFor(usage, flora = null){
  const u = MODEL_USAGES[usage];
  if (!u) return [];
  if (usage !== 'arbre') return u.queries.slice();
  const own = (flora && Array.isArray(flora.genera) ? flora.genera : []).map(g => GENUS_EN[g]).filter(Boolean).slice(0, 2);
  return [...own, ...u.queries];
}

/**
 * The results fit for a use (store's common format: `nom`, `licence.code`, `poids`, `details`), in their
 * order: free licence, not animated, faces and weight within bounds, the name saying the use and nothing
 * ruled out. Each model once.
 */
export function candidatesFor(usage, results){
  const u = MODEL_USAGES[usage];
  if (!u || !Array.isArray(results)) return [];
  const seen = new Set();
  return results.filter(r => {
    if (!r || seen.has(r.id)) return false;
    const faces = r.details && r.details.faces, name = String(r.nom || '');
    const fit = FREE.has(r.licence && r.licence.code)
      && !(r.details && r.details.anime)
      && faces >= FACES.min && faces <= FACES.max
      && r.poids > 0 && r.poids <= MAX_BYTES
      && u.name.test(name) && !EXCLUDED.test(name) && !(u.not && u.not.test(name));
    if (fit) seen.add(r.id);
    return fit;
  });
}

/** The uses an import holds (its elements' built-in objects with no model yet: the bank's first), the most present first. */
export function usagesOf(elements){
  const n = new Map();
  for (const e of elements || []) if (MODEL_USAGES[e.objType] && !e.modelFile && !e.essence && !e.filled) n.set(e.objType, (n.get(e.objType) || 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]).map(([u, count]) => ({ usage: u, count }));
}

/** A number in [0, 1) from a place (x, z): the same element takes the same variant at each import. */
function hash(x, z){
  let h = Math.imul(Math.round(x * 10) | 0, 2654435761) ^ Math.imul(Math.round(z * 10) | 0, 40503);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * THE MODELS GIVEN TO THE ELEMENTS: each element of a use that has models takes one of them (`modelFile`,
 * `modelRatio`; its use kept, `usage`, for the review step). `models`: { usage: [{ fichier, ratio, nom }] }.
 * Changes `elements` in place; returns how many took a model.
 */
export function applyModels(elements, models){
  let n = 0;
  for (const e of elements || []) {
    const list = models && models[e.objType];
    if (e.modelFile || e.essence || e.filled || !Array.isArray(list) || !list.length) continue;
    const m = list[Math.floor(hash(e.x, e.z) * list.length)];
    e.usage = e.objType;
    e.modelFile = m.fichier;
    if (m.nom) e.modelName = m.nom;
    if (m.ratio > 0) e.modelRatio = m.ratio;
    n++;
  }
  return n;
}

/**
 * THE REVIEW (#480d, the last step of « New scene », as the monuments): the models the stores gave the Scene's
 * objects (`usage` and `modelFile`; never the bank's, `bankPrefix`, nor a monument's), one row per model:
 * `{ fichier, nom, usage, count }`, the most used first.
 */
export function reviewRows(objects, bankPrefix){
  const rows = new Map();
  for (const o of objects || []) {
    if (!o || !o.usage || typeof o.modelFile !== 'string' || o.monument || (bankPrefix && o.modelFile.startsWith(bankPrefix))) continue;
    const r = rows.get(o.modelFile) || { fichier: o.modelFile, nom: o.name || o.modelFile.replace(/\.glb$/i, ''), usage: o.usage, count: 0 };
    r.count++;
    rows.set(o.modelFile, r);
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.nom.localeCompare(b.nom));
}

/** What « Replace » searches for a use: its first search (the store shows what you already have first). */
export const reviewQuery = (usage) => (MODEL_USAGES[usage] ? MODEL_USAGES[usage].queries[0] : '');

