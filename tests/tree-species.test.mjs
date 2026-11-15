/**
 * tests/tree-species.test.mjs: EVERY TREE SPECIES HAS ITS SHEET (asked by Durzo, 15 Nov. 2026): each species of
 * tools/ez-tree/species.js has its section (« ## Name … ») in docs/en/tree-species.md and in its French twin,
 * written before it is tuned; and no sheet speaks of a species that is not there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../tools/ez-tree/species.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('export const SPECIES'));
const species = [...body.matchAll(/^ {2}(\w+): \{ from:/gm)].map(m => m[1]);
const sheets = (lang) => [...readFileSync(new URL(`../docs/${lang}/tree-species.md`, import.meta.url), 'utf8')
  .matchAll(/^## (\S+)/gm)].map(m => m[1]);
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

test('the species are read from species.js', () => assert.ok(species.length >= 4, species.join(', ')));
for (const lang of ['fr', 'en']) {
  test(`docs/${lang}/tree-species.md: one sheet a species, none more`, () => {
    assert.deepEqual(sheets(lang).map(norm).sort(), species.map(norm).sort());
  });
}
