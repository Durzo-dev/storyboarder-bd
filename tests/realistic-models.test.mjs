/**
 * tests/realistic-models.test.mjs: the Realistic level's models (src/realistic-models.js, #480c): the searches
 * for a use (the place's own trees first), the results fit for it (licence, faces, weight, name, words ruled
 * out: what Sketchfab's search was MEASURED to bring), the uses of an import, the models given to the
 * elements (the same variant at each import).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MODEL_USAGES, FACES, MAX_BYTES, queriesFor, candidatesFor, usagesOf, applyModels, reviewRows, reviewQuery } from '../src/realistic-models.js';
import { readFileSync } from 'node:fs';
import { OBJECT_REAL_HEIGHT_M } from '../src/constants.js';

let n = 0;
const result = (nom, { code = 'by', faces = 5000, poids = 2e6, anime = false } = {}) =>
  ({ id: `m${n++}`, nom, licence: { code }, poids, details: { faces, anime } });

describe('what to search, what to take', () => {
  test('a broadleaved tree: the place\'s own genera first, then any tree; another use: its own searches', () => {
    assert.deepEqual(queriesFor('arbre', { genera: ['Viburnum', 'Platanus', 'Quercus', 'Acer'] }), ['plane tree', 'oak tree', 'tree']);
    assert.deepEqual(queriesFor('arbre', null), ['tree']);
    assert.deepEqual(queriesFor('pin_parasol'), ['umbrella pine']);
    assert.deepEqual(queriesFor('voiture'), []);
  });
  test('the results MEASURED on Sketchfab: packs, scenes, games, a bald cypress, too heavy, a placeholder, ruled out', () => {
    const page = [
      result('Trees of Paris', { faces: 0 }), result('Patch of Heaven - The White Tree', { poids: 55e6 }),
      result('Maple tree'), result('Tree Pack Low Poly'), result('Bus Shelter Diorama'),
      result('Oak tree', { code: 'by-nc' }), result('Animated tree', { anime: true }), result('Toon Tree 02'),
      result('Birch tree', { code: 'cc0' }),
    ];
    assert.deepEqual(candidatesFor('arbre', page).map(r => r.nom), ['Maple tree', 'Birch tree']);
    assert.deepEqual(candidatesFor('cypres', [result('Bald Cypress'), result('Cypress Tree - Low Poly', { faces: 1594 })]).map(r => r.nom), ['Cypress Tree - Low Poly']);
    assert.deepEqual(candidatesFor('banc', [result('Hollow Knight'), result('Wooden Park Bench')]).map(r => r.nom), ['Wooden Park Bench']);
    assert.deepEqual(candidatesFor('olivier', [result('Olive palm tree'), result('Olive Tree')]).map(r => r.nom), ['Olive Tree']);
    assert.equal(candidatesFor('arbre', [result('Pine tree')]).length, 0, 'a pine is a conifer');
    assert.equal(candidatesFor('arbre', null).length, 0);
  });
  test('the bounds: faces and weight', () => {
    assert.equal(candidatesFor('borne', [result('Bollard', { faces: FACES.max + 1 })]).length, 0);
    assert.equal(candidatesFor('borne', [result('Bollard', { poids: MAX_BYTES + 1 })]).length, 0);
    assert.equal(candidatesFor('borne', [result('Bollard', { faces: FACES.min })]).length, 1);
  });
  test('every use is a built-in object with a height, and has searches and a name to match', () => {
    for (const [u, d] of Object.entries(MODEL_USAGES)) {
      assert.ok(OBJECT_REAL_HEIGHT_M[u] > 0, u);
      assert.ok(d.queries.length && d.name instanceof RegExp && d.variants >= 1, u);
      assert.ok(d.queries.some(q => d.name.test(q)) || u === 'arbuste' || u === 'buisson' || u === 'pin_parasol' || u === 'poubelle', `${u}: a search matching its own name`);
    }
  });
});

describe('the models given to an import', () => {
  const els = () => [
    ...Array.from({ length: 60 }, (_, i) => ({ objType: 'arbre', x: i * 3.7, z: (i % 7) * 5.3 })),
    { objType: 'banc', x: 1, z: 2 }, { objType: 'banc', x: 4, z: 2 }, { objType: 'voiture', x: 0, z: 0 },
  ];
  test('its uses, the most present first; an object with no use left aside', () => {
    assert.deepEqual(usagesOf(els()), [{ usage: 'arbre', count: 60 }, { usage: 'banc', count: 2 }]);
  });
  test('each element of a use takes one of its models, the same at each import; its use kept', () => {
    const models = { arbre: [{ fichier: 'a.glb', nom: 'A', ratio: 0.8 }, { fichier: 'b.glb', nom: 'B' }, { fichier: 'c.glb', nom: 'C' }] };
    const a = els(), b = els();
    assert.equal(applyModels(a, models), 60);
    applyModels(b, models);
    assert.deepEqual(a.map(e => e.modelFile), b.map(e => e.modelFile));
    const used = new Set(a.filter(e => e.modelFile).map(e => e.modelFile));
    assert.equal(used.size, 3, 'the three variants used');
    const t = a.find(e => e.modelFile === 'a.glb');
    assert.equal(t.usage, 'arbre'); assert.equal(t.modelName, 'A'); assert.equal(t.modelRatio, 0.8);
    assert.equal(a.find(e => e.objType === 'banc').modelFile, undefined, 'no model: the built-in object');
  });
});

describe('#480d: the review of the models the stores gave', () => {
  test('⚠️ ONE ROW PER MODEL OF THE STORES, the most used first; never the bank\'s, a monument\'s or a model laid by hand', () => {
    const o = (modelFile, usage, name) => ({ type: 'objet3d', modelFile, usage, name });
    const rows = reviewRows([o('Oak.glb', 'arbre', 'Oak'), o('Bench.glb', 'banc', 'Bench'), o('Oak.glb', 'arbre', 'Oak'),
      o('bank--plane.glb', 'arbre', 'Plane'), { ...o('Eiffel.glb', 'monument'), monument: { name: 'Tour Eiffel' } },
      { type: 'objet3d', modelFile: 'Mine.glb', name: 'Mine' }], 'bank--');
    assert.deepEqual(rows, [{ fichier: 'Oak.glb', nom: 'Oak', usage: 'arbre', count: 2 }, { fichier: 'Bench.glb', nom: 'Bench', usage: 'banc', count: 1 }]);
  });
  test('« Replace » searches the use\'s first search', () => {
    assert.equal(reviewQuery('banc'), 'park bench');
    assert.equal(reviewQuery('nothing'), '');
  });
  test('⚠️ THE STEP SHOWS THEM WITH THE MONUMENTS, LAID ON « FINISH », its credit line removed', () => {
    const ui = readFileSync(new URL('../src/real-place-ui.js', import.meta.url), 'utf8');
    const m = readFileSync(new URL('../src/monuments-ui.js', import.meta.url), 'utf8');
    assert.ok(ui.includes('if (fini && (trouves.length || modeles.length)) {'), 'a step for models alone too');
    assert.ok(ui.includes('if (poser) await appliquerLaRevue(scene, modeles, choixModeles);'), 'closing changes nothing');
    assert.ok(m.includes('sansSonCredit(panel, row.nom);'));
    assert.ok(m.includes('page.objects.splice(page.objects.indexOf(o), 1, b);'), 'removed: the built-in object in its place');
  });
});

