/**
 * @file model-bank.js
 * THE BUILT-IN MODEL BANK AT AN IMPORT (#480f, decided with Durzo, 14 Nov. 2026): models chosen by hand on
 * Sketchfab (CC-BY), made light (tools/model-bank-bake.mjs), shipped in assets/model-bank. At a Detailed or
 * Realistic import, each tree takes a model of ITS genus (OSM's `genus`, `species`, `taxon`; else one drawn
 * from the place's flora, flora.js), each bench, lamp, bin… one of its use; the Realistic level only searches
 * Sketchfab for what the bank has not (realistic-models.js). PURE.
 *
 * A bank model's file name bears BANK_PREFIX: the main process reads it from the application's assets, not
 * from « My models » (main.js, models:read).
 */
import { MODEL_BANK } from './model-bank-data.js';
import { SPECIES, VARIANTS, speciesFor } from './tree-species.js';

/** The prefix of a bank model's file name (a name « My models » never gives: see resolveModelName). */
export const BANK_PREFIX = 'bank--';

/** The bank's plant types: their blended leaves are drawn as cut-outs (opaque-cutout.js). */
export const BANK_PLANT_TYPES = Object.freeze(['arbre', 'conifere', 'palmier']);

/** Whether a model file (as an Element cites it) is one of the bank's plants. */
export function isBankPlantFile(file, bank = MODEL_BANK){
  if (typeof file !== 'string' || !file.startsWith(BANK_PREFIX)) return false;
  const m = bank.find(x => BANK_PREFIX + x.file === file);
  return !!m && BANK_PLANT_TYPES.includes(m.objType);
}

/** An element's genus from OSM's tags (Latin, its first word, capitalised), or null. */
export function genusOfTags(tags = {}){
  const word = String(tags.genus || tags.species || tags.taxon || '').trim().split(/[\s_]+/)[0];
  return /^[a-z]{3,}$/i.test(word) ? word[0].toUpperCase() + word.slice(1).toLowerCase() : null;
}

/** A tree's species from OSM (`species`, else `taxon`) when it names one (two words), lower case: « quercus ilex ». */
export function taxonOfTags(tags = {}){
  const words = String(tags.species || tags.taxon || '').trim().toLowerCase().split(/[\s_]+/);
  return words.length >= 2 && /^[a-z]{3,}$/.test(words[0]) && /^[a-z-]{3,}$/.test(words[1]) ? `${words[0]} ${words[1]}` : null;
}

/** A number in [0, 1) from a place and a salt: the same element draws the same at each import. */
function hash(x, z, salt){
  let h = Math.imul(Math.round(x * 10) | 0, 2246822519) ^ Math.imul(Math.round(z * 10) | 0, 3266489917) ^ salt;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/**
 * THE PLANTS RETIRED FROM THE BANK: our EZ-Tree species cover every genus they showed, so no import chose them
 * any more; their files are no longer shipped. Each one's type and genus, for the Scenes that still hold one
 * (retireBankPlant): file → [objType, genus].
 */
export const RETIRED_BANK_PLANTS = Object.freeze({
  'bouleau-1.glb': ['arbre', 'Betula'],
  'bouleau-2.glb': ['arbre', 'Betula'],
  'bouleau-3.glb': ['arbre', 'Betula'],
  'peuplier-1.glb': ['arbre', 'Populus'],
  'peuplier-3.glb': ['arbre', 'Populus'],
  'peuplier-4.glb': ['arbre', 'Populus'],
  'saule-1.glb': ['arbre', 'Salix'],
  'saule-2.glb': ['arbre', 'Salix'],
  'cerisier-1.glb': ['arbre', 'Prunus'],
  'palmier-nain-1.glb': ['palmier', 'Chamaerops'],
  'palmier-nain-2.glb': ['palmier', 'Chamaerops'],
  'arbuste-2.glb': ['arbuste', null],
  'marronnier-1.glb': ['arbre', 'Aesculus'],
  'marronnier-2.glb': ['arbre', 'Aesculus'],
  'marronnier-3.glb': ['arbre', 'Aesculus'],
  'chene-1.glb': ['arbre', 'Quercus'],
  'chene-2.glb': ['arbre', 'Quercus'],
  'cedre-1.glb': ['conifere', 'Cedrus'],
  'cedre-2.glb': ['conifere', 'Cedrus'],
  'cypres-1.glb': ['cypres', 'Cupressus'],
  'cypres-2.glb': ['cypres', 'Cupressus'],
  'olivier-1.glb': ['olivier', 'Olea'],
  'buisson-2.glb': ['buisson', null],
  'buisson-3.glb': ['buisson', null],
  'buisson-4.glb': ['buisson', null],
  'buisson-5.glb': ['buisson', null],
  'palmier-washingtonia-1.glb': ['palmier', 'Washingtonia'],
  'palmier-washingtonia-2.glb': ['palmier', 'Washingtonia'],
});

/**
 * An Element showing a retired bank plant (RETIRED_BANK_PLANTS) becomes the EZ-Tree tree of its species, in place:
 * its type and species, a variant drawn from its place, its height kept, its width the type's
 * (`aspectOf(objType)`: width over height), its centre kept. Returns whether it changed. Run on loading a Project.
 */
export function retireBankPlant(o, aspectOf = () => null){
  const file = o && typeof o.modelFile === 'string' && o.modelFile.startsWith(BANK_PREFIX) ? o.modelFile.slice(BANK_PREFIX.length) : null;
  const was = file && RETIRED_BANK_PLANTS[file];
  if (!was) return false;
  const essence = speciesFor(was[0], was[1]);
  if (!essence) return false;
  const sp = SPECIES[essence];
  o.objType = sp.type;
  o.essence = essence;
  o.variante = 1 + Math.floor(hash(o.wxFloor || 0, o.wzFloor || 0, 0x7f4a) * VARIANTS);
  for (const k of ['modelFile', 'modelName', 'modelRatio', 'usage']) delete o[k];
  const aspect = aspectOf(sp.type);
  if (aspect > 0 && o.h > 0) {
    const w = o.h * aspect;
    if (typeof o.x === 'number' && o.w > 0) o.x += (o.w - w) / 2;
    o.w = w;
    if (o.baseH > 0) o.baseW = o.baseH * aspect;
  }
  return true;
}

/** A key drawn from shares ({ key: share }), or null. */
function drawFrom(shares, u){
  const entries = Object.entries(shares || {}).filter(([, s]) => s > 0);
  const sum = entries.reduce((s, [, v]) => s + v, 0);
  if (!(sum > 0)) return null;
  let left = u * sum;
  for (const [k, v] of entries) { left -= v; if (left < 0) return k; }
  return entries[entries.length - 1][0];
}

/**
 * The bank models that may stand for an element: of its genus first; without one (or none of it), the
 * models of its use marked generic. A rural model (a bollard of stones) only in a place little built.
 */
export function bankModelsFor(objType, genus = null, { rural = false, bank = MODEL_BANK } = {}){
  const ofUse = bank.filter(m => m.objType === objType && (!m.rural || rural));
  const ofGenus = genus ? ofUse.filter(m => m.genera.includes(genus)) : [];
  return ofGenus.length ? ofGenus : ofUse.filter(m => m.generic);
}

/**
 * THE BANK GIVEN TO AN IMPORT: each element whose use the bank has takes one of its models (`modelFile` with
 * BANK_PREFIX, `modelName`, `modelRatio`, `usage`): a tree of its genus (OSM's, `genus`; else drawn from the
 * flora's genera of its form, `flora.genera`), the others of their use. Changes `elements` in place; returns
 * { n, used, species } (the bank entries used: their credits; the trees given to EZ-Tree).
 *
 * A tree of one of OUR SPECIES (src/tree-species.js) takes no model: it is generated by EZ-Tree (#480g), its
 * `essence` (the species), its `variante` (1 to VARIANTS, drawn from its place), its type and, without a known
 * height, the species' usual one (±15 %).
 */
export function applyBank(elements, { flora = null, rural = false, bank = MODEL_BANK, lang = 'fr' } = {}){
  const used = new Map();
  let n = 0, species = 0;
  for (const e of elements || []) {
    if (e.modelFile) continue;
    const genus = e.genus || drawFrom(flora && flora.genusShares && flora.genusShares[e.objType], hash(e.x, e.z, 0x5bd1));
    const essence = speciesFor(e.objType, genus, e.taxon);
    if (essence) {
      const sp = SPECIES[essence];
      e.essence = essence;
      e.variante = 1 + Math.floor(hash(e.x, e.z, 0x7f4a) * VARIANTS);
      e.objType = sp.type;
      if (!(e.height > 0)) e.height = Math.round(sp.height * (0.85 + 0.3 * hash(e.x, e.z, 0x31c7)) * 10) / 10;
      species++;
      continue;
    }
    // A tree filling a wood (vegetation-zones.js, `filled`) of none of our species: the built-in tree, light
    // (hundreds of them), never a model of the bank.
    if (e.filled) continue;
    const list = bankModelsFor(e.objType, genus, { rural, bank });
    if (!list.length) continue;
    const m = list[Math.floor(hash(e.x, e.z, 0x9e37) * list.length)];
    e.usage = e.objType;
    e.modelFile = BANK_PREFIX + m.file;
    e.modelName = bankLabel(m, lang, bank);
    if (m.ratio > 0) e.modelRatio = m.ratio;
    used.set(m.file, m);
    n++;
  }
  return { n, used: [...used.values()], species };
}

/**
 * A bank model's name as the application shows it (asked: the tree's real name, in the language, numbered when
 * the bank has several): « Érable 2 », « Maple 2 ». Its Sketchfab title without a label (street furniture).
 */
export function bankLabel(m, lang = 'fr', bank = MODEL_BANK){
  const name = m && m.label ? (m.label[lang] || m.label.fr) : (m && m.name) || '';
  if (!m || !m.label) return name;
  const same = bank.filter(x => x.use === m.use);
  return same.length > 1 ? `${name} ${same.findIndex(x => x.file === m.file) + 1}` : name;
}

/** A bank model's credit (CC-BY: its title, author, licence and page). */
export function bankCredit(m, lang = 'fr'){
  return lang === 'en'
    ? `"${m.name}" by ${m.author}, CC BY 4.0, Sketchfab (${m.url})`
    : `« ${m.name} » par ${m.author}, CC BY 4.0, Sketchfab (${m.url})`;
}
