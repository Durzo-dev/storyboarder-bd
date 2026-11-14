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

/** The prefix of a bank model's file name (a name « My models » never gives: see resolveModelName). */
export const BANK_PREFIX = 'bank--';

/** An element's genus from OSM's tags (Latin, its first word, capitalised), or null. */
export function genusOfTags(tags = {}){
  const word = String(tags.genus || tags.species || tags.taxon || '').trim().split(/[\s_]+/)[0];
  return /^[a-z]{3,}$/i.test(word) ? word[0].toUpperCase() + word.slice(1).toLowerCase() : null;
}

/** A number in [0, 1) from a place and a salt: the same element draws the same at each import. */
function hash(x, z, salt){
  let h = Math.imul(Math.round(x * 10) | 0, 2246822519) ^ Math.imul(Math.round(z * 10) | 0, 3266489917) ^ salt;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
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
 * { n, used } (the bank entries used: their credits).
 */
export function applyBank(elements, { flora = null, rural = false, bank = MODEL_BANK } = {}){
  const used = new Map();
  let n = 0;
  for (const e of elements || []) {
    if (e.modelFile) continue;
    const genus = e.genus || drawFrom(flora && flora.genusShares && flora.genusShares[e.objType], hash(e.x, e.z, 0x5bd1));
    const list = bankModelsFor(e.objType, genus, { rural, bank });
    if (!list.length) continue;
    const m = list[Math.floor(hash(e.x, e.z, 0x9e37) * list.length)];
    e.usage = e.objType;
    e.modelFile = BANK_PREFIX + m.file;
    e.modelName = m.name;
    if (m.ratio > 0) e.modelRatio = m.ratio;
    used.set(m.file, m);
    n++;
  }
  return { n, used: [...used.values()] };
}

/** A bank model's credit (CC-BY: its title, author, licence and page). */
export function bankCredit(m, lang = 'fr'){
  return lang === 'en'
    ? `"${m.name}" by ${m.author}, CC BY 4.0, Sketchfab (${m.url})`
    : `« ${m.name} » par ${m.author}, CC BY 4.0, Sketchfab (${m.url})`;
}
