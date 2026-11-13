/**
 * tests/flora.test.mjs: the plants of a place (src/flora.js, #480b): GBIF's counts by genus read as shares of
 * forms (rare forms left out, the stone pines out of the pines), the genera named; the forms drawn for the
 * trees OSM says nothing of (the same at each import, OSM's own forms kept); and the OSM side
 * (src/osm-scene.js treeKindKnown).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GENERA, STONE_PINE_KEY, floraOf, applyFlora } from '../src/flora.js';
import { treeKindKnown } from '../src/osm-scene.js';

const key = (g) => GENERA[g][1];
const answer = (genera, species = []) => ({
  count: 1000,
  facets: [
    { field: 'GENUS_KEY', counts: genera.map(([g, n]) => ({ name: String(typeof g === 'string' ? key(g) : g), count: n })) },
    { field: 'SPECIES_KEY', counts: species.map(([k, n]) => ({ name: String(k), count: n })) },
  ],
});

describe('the flora of a place, from GBIF', () => {
  test('shares by form, the genera most observed first; an unknown genus (an orchid) left aside', () => {
    const f = floraOf(answer([['Quercus', 700], ['Celtis', 100], ['Olea', 100], ['Pinus', 100], ['Viburnum', 300], ['Lavandula', 100], [999999, 5000]]));
    assert.deepEqual(f.trees, { arbre: 0.8, conifere: 0.1, olivier: 0.1 });
    assert.deepEqual(f.shrubs, { arbuste: 0.75, buisson: 0.25 });
    assert.deepEqual(f.genera.slice(0, 2), ['Quercus', 'Viburnum']);
  });
  test('the stone pines out of the pines; a form under 1 % left out (a palm in Paris)', () => {
    const f = floraOf(answer([['Acer', 900], ['Pinus', 95], ['Phoenix', 5]], [[STONE_PINE_KEY, 45]]));
    assert.equal(f.trees.palmier, undefined);
    assert.ok(Math.abs(f.trees.pin_parasol - 45 / 995) < 0.002 && Math.abs(f.trees.conifere - 50 / 995) < 0.002, JSON.stringify(f.trees));
  });
  test('nothing known counted, no answer: null', () => {
    assert.equal(floraOf(answer([[999999, 10]])), null);
    assert.equal(floraOf(null), null);
    assert.equal(floraOf({ facets: [] }), null);
  });
  test('every genus has a form among the built-in objects and a key', () => {
    const forms = new Set(['arbre', 'conifere', 'cypres', 'olivier', 'palmier', 'arbuste', 'buisson']);
    for (const [g, [form, k]] of Object.entries(GENERA)) {
      assert.ok(forms.has(form), g);
      assert.ok(Number.isInteger(k) && k > 0, g);
    }
    assert.equal(new Set(Object.values(GENERA).map(v => v[1])).size, Object.keys(GENERA).length, 'no key twice');
  });
});

describe('the flora given to the trees', () => {
  const flora = { trees: { arbre: 0.5, olivier: 0.3, palmier: 0.2 }, shrubs: { arbuste: 0.5, buisson: 0.5 } };
  const trees = () => Array.from({ length: 400 }, (_, i) => ({ objType: 'arbre', x: (i % 20) * 7.3, z: Math.floor(i / 20) * 6.1 }));
  test('drawn in the shares, the same at each import', () => {
    const a = trees(), b = trees();
    applyFlora(a, flora); applyFlora(b, flora);
    assert.deepEqual(a.map(e => e.objType), b.map(e => e.objType));
    const share = (k) => a.filter(e => e.objType === k).length / a.length;
    assert.ok(Math.abs(share('arbre') - 0.5) < 0.08 && Math.abs(share('olivier') - 0.3) < 0.08 && Math.abs(share('palmier') - 0.2) < 0.08,
      `${share('arbre')} ${share('olivier')} ${share('palmier')}`);
  });
  test('a form OSM said, and the other objects, kept; a bush drawn among the shrubs', () => {
    const els = [{ objType: 'conifere', kindKnown: true, x: 1, z: 1 }, { objType: 'banc', x: 2, z: 2 },
      ...Array.from({ length: 40 }, (_, i) => ({ objType: 'buisson', x: i * 3.1, z: 0 }))];
    applyFlora(els, flora);
    assert.equal(els[0].objType, 'conifere');
    assert.equal(els[1].objType, 'banc');
    assert.ok(els.slice(2).some(e => e.objType === 'arbuste') && els.slice(2).some(e => e.objType === 'buisson'));
    assert.equal(applyFlora(els, null), 0);
  });
  test('OSM says a tree\'s form by its genus, species or leaves', () => {
    assert.equal(treeKindKnown({ natural: 'tree' }), false);
    assert.equal(treeKindKnown({ genus: 'Platanus' }), true);
    assert.equal(treeKindKnown({ leaf_type: 'broadleaved' }), true);
    assert.equal(treeKindKnown({ leaf_type: 'mixed' }), false);
  });
});
