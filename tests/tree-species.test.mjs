/**
 * tests/tree-species.test.mjs: EVERY TREE SPECIES HAS ITS SHEET (asked by Durzo, 15 Nov. 2026): each species of
 * src/tree-species.js has its section (« ## Name … (*Latin name*) ») in docs/en/tree-species.md and in its French twin,
 * written before it is tuned; and no sheet speaks of a species that is not there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/tree-species.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('export const SPECIES'));
const species = [...body.matchAll(/^ {2}(\w+): \{ from:/gm)].map(m => m[1]);
const sheets = (lang) => [...readFileSync(new URL(`../docs/${lang}/tree-species.md`, import.meta.url), 'utf8')
  .matchAll(/^## (\S+).*\(\*/gm)].map(m => m[1]);
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

test('the species are read from species.js', () => assert.ok(species.length >= 4, species.join(', ')));
for (const lang of ['fr', 'en']) {
  test(`docs/${lang}/tree-species.md: one sheet a species, none more`, () => {
    assert.deepEqual(sheets(lang).map(norm).sort(), species.map(norm).sort());
  });
}

test('every bark file a species reads is shipped, and every shipped bark is read (one file a Poly Haven bark)', async () => {
  const { readdirSync } = await import('node:fs');
  const { SPECIES, barkFile } = await import('../src/tree-species.js');
  const shipped = readdirSync(new URL('../assets/textures/', import.meta.url)).filter(f => /^ecorce-.*\.jpg$/.test(f)).sort();
  const read = [...new Set(Object.keys(SPECIES).filter(k => SPECIES[k].bark).map(barkFile))].sort();
  assert.deepEqual(read, shipped);
  const ids = Object.values(SPECIES).map(sp => sp.bark).filter(Boolean);
  assert.equal(new Set(ids).size, shipped.length, 'as many files as Poly Haven barks');
});
