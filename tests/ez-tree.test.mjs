/**
 * tests/ez-tree.test.mjs: EZ-TREE IN THE APPLICATION (#480g). The copy in src/vendor/ez-tree/, run with the
 * application's three r128, grows the very trees of EZ-Tree v1.1.0 (run with three 0.170 in a browser, 15 Nov.
 * 2026: the fingerprints below); and our species (src/tree-species.js) come out of src/ez-trees.js whole, at the
 * height asked, generated once a variant.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.THREE = THREE;
const { Tree, TreeOptions, EZ_TREE_VERSION } = await import('../src/vendor/ez-tree/ez-tree.js');
const { TREE_PRESETS } = await import('../src/vendor/ez-tree/presets.js');
const { generateSpeciesTree, speciesTree, barkRepeat, speciesOptions } = await import('../src/ez-trees.js');
const { SPECIES, speciesFor, speciesOfType } = await import('../src/tree-species.js');

/** A canvas that draws nothing (Node has none): every method of its context does nothing. */
const fakeCanvas = (size) => {
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ addColorStop() {} })), set: (o, k, v) => { o[k] = v; return true; } });
  return { width: size, height: size, getContext: () => ctx };
};

/** [triangles, a weighted sum of the branches' vertices, the same of the leaves'], seed 7919. */
const EZ_TREE_1_1_0 = {
  'Oak Large': [22566, 1870463.72, 3307346.384],
  'Ash Large': [21512, 1897799.356, 3205758.855],
  'Pine Medium': [19872, 684652.78, 1557039.086],
  'Oak Small': [6806, 203233.541, 466205.891],
  'Bush 3': [16170, 411512.573, 152308.221],
};

test('the copy is of EZ-Tree 1.1.0', () => assert.equal(EZ_TREE_VERSION, '1.1.0'));

for (const [preset, expected] of Object.entries(EZ_TREE_1_1_0)) {
  test(`« ${preset} »: the tree EZ-Tree 1.1.0 grows, with three r128`, () => {
    const t = new Tree(new TreeOptions());
    t.options.copy(structuredClone(TREE_PRESETS[preset]));
    t.options.seed = 7919;
    t.generate();
    let b = 0; t.branches.verts.forEach((v, i) => { b += v * ((i % 7) + 1); });
    let l = 0; t.leaves.verts.forEach((v, i) => { l += v * ((i % 5) + 1); });
    assert.equal(t.triangleCount, expected[0]);
    assert.ok(Math.abs(b - expected[1]) < 0.01, `branches ${b}`);
    assert.ok(Math.abs(l - expected[2]) < 0.01, `leaves ${l}`);
  });
}

const size = (o) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());

for (const name of Object.keys(SPECIES)) {
  test(`${name}: a whole tree, light enough, its foliage drawn`, () => {
    const t = generateSpeciesTree(name, 1, { makeCanvas: fakeCanvas });
    assert.ok(t.triangleCount > 3000 && t.triangleCount < 40000, `${t.triangleCount} triangles`);
    assert.ok(t.leavesMesh.material.map && t.leavesMesh.material.map.image.width === 512);
    // Read as they are (the application's renderer does not re-encode in sRGB): sRGB gave black trunks, seen.
    assert.equal(t.leavesMesh.material.map.encoding, THREE.LinearEncoding);
    assert.ok(t.leavesMesh.geometry.index.count > 0 && t.branchesMesh.geometry.index.count > 0);
  });
}

test('the silhouettes: the cypress a column, the olive broad', () => {
  const c = size(generateSpeciesTree('Cypres', 1, { makeCanvas: fakeCanvas }));
  const o = size(generateSpeciesTree('Olivier', 1, { makeCanvas: fakeCanvas }));
  assert.ok(c.y / Math.max(c.x, c.z) > 3, `cypress ${c.y} by ${c.x}`);
  assert.ok(Math.max(o.x, o.z) / o.y > 0.8, `olive ${o.x} by ${o.y}`);
});

test('two variants differ; a variant is generated once, its trees share it', () => {
  const a = speciesTree('Platane', 1, 12, { makeCanvas: fakeCanvas });
  const b = speciesTree('Platane', 1, 20, { makeCanvas: fakeCanvas });
  const c = speciesTree('Platane', 2, 12, { makeCanvas: fakeCanvas });
  const mesh = (g) => g.children[0].children[0];
  assert.equal(mesh(a).geometry, mesh(b).geometry);
  assert.notEqual(mesh(a).geometry, mesh(c).geometry);
});

test('the bark given is read as it is, its tint applied', () => {
  const bark = new THREE.Texture();
  const t = generateSpeciesTree('Tilleul', 1, { makeCanvas: fakeCanvas, barkTexture: () => bark });
  const m = t.branchesMesh.material;
  assert.equal(m.map, bark);
  assert.equal(bark.encoding, THREE.LinearEncoding);
  assert.equal(m.color.getHex(), SPECIES.Tilleul.barkTint);
});

test('the bark square on the trunk: as many texels round as up (a fixed [1, 6] squeezed it 17 times, seen)', () => {
  for (const name of Object.keys(SPECIES)) {
    const o = speciesOptions(name, 1);
    const [u, v] = barkRepeat(o);
    const round = 2 * Math.PI * o.branch.radius[0], section = o.branch.length[0] / o.branch.sections[0];
    assert.ok(Math.abs((round / u) / (section / v) - 1) < 1e-9, name);
    assert.ok(u >= 1 && u <= 4, `${name}: ${u} round`);
  }
});

test('a tree of the height asked, its foot on the ground', () => {
  for (const h of [6, 18]) {
    const box = new THREE.Box3().setFromObject(speciesTree('Tilleul', 1, h, { makeCanvas: fakeCanvas }));
    assert.ok(Math.abs(box.max.y - box.min.y - h) < 1e-6, `${box.max.y - box.min.y}`);
    assert.ok(Math.abs(box.min.y) < 1e-6);
  }
});

test('the species of a tree: its genus first, else its type', () => {
  assert.equal(speciesFor('arbre', 'Platanus'), 'Platane');
  assert.equal(speciesFor('arbre', 'Tilia'), 'Tilleul');
  assert.equal(speciesFor('arbre', 'Acer'), null);
  assert.equal(speciesFor('arbre', null), null);
  assert.equal(speciesFor('cypres', 'Thuja'), 'Cypres');
  assert.equal(speciesFor('olivier', null), 'Olivier');
  assert.equal(speciesFor('arbre', 'Olea'), 'Olivier');
  assert.equal(speciesFor('conifere', 'Olea'), null);
});

test('the sheet\'s « Essence » list: the species of the type, none for another', () => {
  assert.deepEqual(speciesOfType('arbre'), ['Platane', 'Tilleul']);
  assert.deepEqual(speciesOfType('olivier'), ['Olivier']);
  assert.deepEqual(speciesOfType('voiture'), []);
  for (const k of Object.keys(SPECIES)) assert.ok(SPECIES[k].label.fr && SPECIES[k].label.en, k);
});
