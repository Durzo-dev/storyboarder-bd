/**
 * @file src/owned-first.js
 * PURE. In every store (models, textures, fonts), what was downloaded before and matches the search comes FIRST,
 * then the server's results, never twice (decided with Durzo, 23 Nov. 2026: « the search runs in the store, but
 * what was downloaded before and matches it shows first, in every store »).
 */

/** A name's words: lower case, without accents, split on anything but letters and digits. */
export function wordsOf(text){
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Does a name match a search? Each word of the search begins a word of the name (« eiff » finds « La tour Eiffel »);
 * an empty search matches everything.
 */
export function matchesSearch(name, search){
  const asked = wordsOf(search);
  if (!asked.length) return true;
  const words = wordsOf(name);
  return asked.every(a => words.some(w => w.startsWith(a)));
}

/**
 * Splits a page of results: `owned`, the items owned that match the search (in their order), and `results`, the
 * server's without those already shown. `ownedKey(item)` and `resultKey(result)` give one key to an item and the
 * same result (`source:id`); `nameOf(item)` its name.
 */
export function ownedFirst(results, owned, { search = '', ownedKey, resultKey, nameOf }){
  const shown = (owned || []).filter(o => matchesSearch(nameOf(o), search));
  const keys = new Set(shown.map(ownedKey));
  return { owned: shown, results: (results || []).filter(r => !keys.has(resultKey(r))) };
}
