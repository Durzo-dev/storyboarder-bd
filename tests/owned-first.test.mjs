/**
 * tests/owned-first.test.mjs, what was downloaded first in every store (src/owned-first.js).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { wordsOf, matchesSearch, ownedFirst } from '../src/owned-first.js';

describe('owned first, in every store', () => {
  test('a search\'s words each begin a word of the name, accents and case aside', () => {
    assert.deepEqual(wordsOf('( FREE ) La tour Eiffel.glb'), ['free', 'la', 'tour', 'eiffel', 'glb']);
    assert.equal(matchesSearch('La tour Eiffel', 'eiff'), true);
    assert.equal(matchesSearch('Cathédrale Saint-Pierre', 'cathedrale pierre'), true);
    assert.equal(matchesSearch('Rubber Duck Toy', 'duck chair'), false, 'every word');
    assert.equal(matchesSearch('Oak tree', 'ak'), false, 'a word begins with it, not merely holds it');
    assert.equal(matchesSearch('Anything', '  '), true, 'an empty search matches all');
  });

  test('⚠️ THE OWNED THAT MATCH COME FIRST, AND THE SERVER\'S RESULTS NEVER SHOW THEM TWICE', () => {
    const owned = [{ source: 's', id: '1', nom: 'Oak tree' }, { source: 's', id: '2', nom: 'Bench' }, { source: 's', id: '3', nom: 'Oak stump' }];
    const results = [{ source: 's', id: '9', nom: 'Big oak' }, { source: 's', id: '3', nom: 'Oak stump' }, { source: 's', id: '7', nom: 'Oak leaf' }];
    const k = (x) => `${x.source}:${x.id}`;
    const r = ownedFirst(results, owned, { search: 'oak', ownedKey: k, resultKey: k, nameOf: (o) => o.nom });
    assert.deepEqual(r.owned.map(o => o.id), ['1', '3'], 'the bench does not match');
    assert.deepEqual(r.results.map(o => o.id), ['9', '7'], 'the owned stump is not shown again');
  });

  test('⚠️ EVERY STORE ORDERS ITS RESULTS SO (models, textures, fonts), the owned of THAT store only', () => {
    const lire = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
    const modeles = lire('store-ui.js'), textures = lire('textures-store-ui.js'), polices = lire('polices-ui.js');
    assert.ok(modeles.includes('[...possedes.values()].filter(e => e.source === source)'), 'models: the tab\'s source');
    assert.ok(modeles.includes('tri.results.filter(r => !possedesMontres.has(cleDuResultat(r)))'), 'models: not again on a next page');
    assert.ok(textures.includes("mes.filter(t => String(t.cle || '').startsWith(onglet + ':'))"), 'textures: the tab\'s source');
    assert.ok(polices.includes('const cartes = [...tri.owned.map(carte), ...tri.results.map(r => carte({ ...r, enLigne: true }))];'), 'fonts');
  });
});

