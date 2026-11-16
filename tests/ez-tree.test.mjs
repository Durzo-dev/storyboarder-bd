/**
 * tests/ez-tree.test.mjs: EZ-TREE IN THE APPLICATION (#480g). The copy in src/vendor/ez-tree/, run with the
 * application's three r128, grows the very trees of EZ-Tree v2.0.0 (its own code run with three 0.170 under Node,
 * 16 Nov. 2026: the fingerprints below, bit for bit); and our species (src/tree-species.js) come out of src/ez-trees.js whole, at the
 * height asked, generated once a variant.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.THREE = THREE;
const { Tree, TreeOptions, EZ_TREE_VERSION } = await import('../src/vendor/ez-tree/ez-tree.js');
const { TREE_PRESETS } = await import('../src/vendor/ez-tree/presets.js');
const { generateSpeciesTree, speciesTree, barkRepeat, speciesOptions, crownOf, barkColour } = await import('../src/ez-trees.js');
const { SPECIES, speciesFor, speciesOfType } = await import('../src/tree-species.js');

/** A canvas that draws nothing (Node has none): every method of its context does nothing. */
const fakeCanvas = (size) => {
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ addColorStop() {} })), set: (o, k, v) => { o[k] = v; return true; } });
  return { width: size, height: size, getContext: () => ctx };
};

/** [triangles, a weighted sum of the branches' vertices, the same of the leaves'], seed 7919. */
const EZ_TREE_2_0_0 = {
  'Oak Large': [22566, 2209237.891, 4092194.651],
  'Ash Large': [21512, 1779395.51, 3018994.939],
  'Pine Medium': [19872, 706246.556, 1610244.522],
  'Oak Small': [6806, 253226.679, 630760.89],
  'Bush 3': [16170, 312775.233, 114456.868],
  'Aspen Large': [13668, 1311704.559, 2715624.197],
};

test('the copy is of EZ-Tree 2.0.0', () => assert.equal(EZ_TREE_VERSION, '2.0.0'));

for (const [preset, expected] of Object.entries(EZ_TREE_2_0_0)) {
  test(`« ${preset} »: the tree EZ-Tree 2.0.0 grows, with three r128`, () => {
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
    // A palm is light (a trunk, a few dozen fronds: 480 and 2 160 measured); a tree with branches far less so.
    assert.ok(t.triangleCount > (SPECIES[name].type === 'palmier' ? 300 : 3000) && t.triangleCount < 40000, `${t.triangleCount} triangles`);
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
  // Its first mesh (within its levels of detail since EZ-Tree 2).
  const mesh = (g) => { let m = null; g.traverse(o => { if (!m && o.isMesh && o.geometry.index) m = o; }); return m; };
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
    // EZ-Tree 2 puts the turns round a branch in u: round(radius × textureScale.x), at least 1.
    const turns = Math.max(1, Math.round(o.branch.radius[0] * o.bark.textureScale.x)) * u;
    const round = 2 * Math.PI * o.branch.radius[0], section = o.branch.length[0] / o.branch.sections[0];
    assert.ok(Math.abs((round / turns) / (section / v) - 1) < 1e-9, name);
    assert.equal(turns, 2, `${name}: ${turns} round`);
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
  assert.equal(speciesFor('arbre', 'Acer'), 'Erable');
  assert.equal(speciesFor('arbre', 'Grevillea'), null, 'a genus of none of ours');
  assert.equal(speciesFor('conifere', 'Cedrus'), 'Cedre', 'a cedar is no pine');
  assert.equal(speciesFor('conifere', 'Pinus'), 'Pin');
  assert.equal(speciesFor('pin_parasol', 'Pinus'), 'Pignon', 'a stone pine: the species of its type');
  assert.equal(speciesFor('arbre', 'Quercus'), 'Chene');
  assert.equal(speciesFor('arbre', 'Quercus', 'quercus ilex'), 'Yeuse', 'its species before its genus');
  assert.equal(speciesFor('arbre', 'Quercus', 'quercus robur'), 'Chene');
  assert.equal(speciesFor('arbuste', 'Corylus'), 'Noisetier');
  // Wave 3: the rarer genera, the shrubs and bushes; a shrub or a bush without its genus: its type's stand-in.
  assert.equal(speciesFor('arbre', 'Ginkgo'), 'Ginkgo');
  assert.equal(speciesFor('arbre', 'Zelkova'), 'Orme');
  assert.equal(speciesFor('conifere', 'Sequoiadendron'), 'Sequoia');
  assert.equal(speciesFor('arbuste', 'Ilex'), 'Laurier');
  assert.equal(speciesFor('arbuste', 'Crataegus'), 'Noisetier');
  assert.equal(speciesFor('buisson', 'Ulex'), 'Genet');
  assert.equal(speciesFor('arbuste', null), 'Laurier');
  assert.equal(speciesFor('buisson', null), 'Ronce');
  assert.equal(speciesFor('arbuste', 'Grevillea'), 'Laurier');
  assert.equal(speciesFor('arbre', 'Styphnolobium'), 'Sophora');
  assert.equal(speciesFor('arbre', null), null);
  assert.equal(speciesFor('cypres', 'Thuja'), 'Cypres');
  assert.equal(speciesFor('olivier', null), 'Olivier');
  assert.equal(speciesFor('arbre', 'Olea'), 'Olivier');
  assert.equal(speciesFor('conifere', 'Olea'), null);
  // Wave 1, lots 2 and 3: two genera for one species; the conifers by their genus only.
  assert.equal(speciesFor('arbre', 'Pyrus'), 'Pommier');
  assert.equal(speciesFor('arbre', 'Malus'), 'Pommier');
  assert.equal(speciesFor('conifere', 'Picea'), 'Sapin');
  assert.equal(speciesFor('conifere', 'Pinus'), 'Pin');
  assert.equal(speciesFor('pin_parasol', null), 'Pignon', 'a stone pine is no Scots pine: its own species');
  assert.equal(speciesFor('conifere', null), null);
});

test('the pine\'s trunk bare under a high crown, the poplar narrow, the fir a cone', () => {
  for (const v of [1, 2, 3]) assert.ok(crownOf('Pin', v, { makeCanvas: fakeCanvas }).base > 0.45, `pine ${v}`);
  const p = size(generateSpeciesTree('Peuplier', 1, { makeCanvas: fakeCanvas }));
  assert.ok(p.y / Math.max(p.x, p.z) > 1.8, `poplar ${p.y} by ${p.x}`);
  assert.ok(crownOf('Sapin', 1, { makeCanvas: fakeCanvas }).base < 0.25, 'the fir\'s branches down low');
});

test('the sheet\'s « Essence » list: the species of the type, none for another', () => {
  assert.ok(['Platane', 'Tilleul', 'Erable', 'Chene'].every(k => speciesOfType('arbre').includes(k)));
  assert.deepEqual(speciesOfType('olivier'), ['Olivier']);
  assert.deepEqual(speciesOfType('voiture'), []);
  for (const k of Object.keys(SPECIES)) assert.ok(SPECIES[k].label.fr && SPECIES[k].label.en, k);
});

test('a crown seen from above, for a tree 1 high: around its trunk, starting part way up', () => {
  for (const name of Object.keys(SPECIES)) {
    const c = crownOf(name, 1, { makeCanvas: fakeCanvas });
    const xs = c.hull.map(p => p.x), zs = c.hull.map(p => p.z);
    assert.ok(c.hull.length >= 3, name);
    assert.ok(Math.min(...xs) < 0 && Math.max(...xs) > 0 && Math.min(...zs) < 0 && Math.max(...zs) > 0, `${name}: round the trunk`);
    assert.ok(c.base > 0.02 && c.base < 0.8, `${name}: from ${c.base}`);
  }
  const width = (n) => { const c = crownOf(n, 1, { makeCanvas: fakeCanvas }); return Math.max(...c.hull.map(p => p.x)) - Math.min(...c.hull.map(p => p.x)); };
  assert.ok(width('Olivier') > 2 * width('Cypres'), 'the olive broad, the cypress narrow');
});

test('the rig\'s box is centred on the trunk (the render centres the box on the tree\'s place)', () => {
  for (const name of Object.keys(SPECIES)) {
    const box = new THREE.Box3().setFromObject(speciesTree(name, 2, 10, { makeCanvas: fakeCanvas }));
    const c = box.getCenter(new THREE.Vector3());
    assert.ok(Math.abs(c.x) < 1e-6 && Math.abs(c.z) < 1e-6, `${name}: ${c.x}, ${c.z}`);
  }
});

test('a bark lightened: the plane\'s and the poplar\'s above white, the others at their tint', () => {
  assert.ok(barkColour(SPECIES.Platane).r > 1.5 && barkColour(SPECIES.Peuplier).g > 1.2);
  assert.equal(barkColour(SPECIES.Tilleul).getHex(), SPECIES.Tilleul.barkTint);
  const bark = new THREE.Texture();
  const t = generateSpeciesTree('Platane', 1, { makeCanvas: fakeCanvas, barkTexture: () => bark });
  let m; t.traverse(o => { if (o.isMesh && o.material.name === 'branches') m = o.material; });
  assert.ok(Math.abs(m.color.r - 1.6) < 1e-6, 'the gain reaches the material');
});

test('every species has its bark: a Poly Haven asset, or one drawn', () => {
  for (const [name, sp] of Object.entries(SPECIES)) assert.ok(!!sp.bark !== !!sp.barkDrawn, name);
});

test('our additions to EZ-Tree (#485): a level\'s droop bends it down, hanging leaves point down; 0 changes nothing', () => {
  const grow = (set) => {
    const t = new Tree(new TreeOptions());
    t.options.copy(structuredClone(TREE_PRESETS['Ash Medium']));
    t.options.seed = 7919;
    set(t.options);
    t.generate();
    return t;
  };
  const lowest = (t) => { const v = t.branches.verts; let y = Infinity; for (let i = 1; i < v.length; i += 3) y = Math.min(y, v[i]); return y; };
  const plain = grow(() => {}), zero = grow(o => { o.branch.droop[2] = 0; o.leaves.hang = 0; });
  assert.deepEqual(zero.branches.verts, plain.branches.verts, 'droop 0: the very tree');
  assert.deepEqual(zero.leaves.verts, plain.leaves.verts, 'hang 0: the very leaves');
  const drooping = grow(o => { o.branch.droop[2] = 0.3; o.branch.droop[3] = 0.4; });
  const meanY = (t) => { const v = t.branches.verts; let s = 0; for (let i = 1; i < v.length; i += 3) s += v[i]; return s / (v.length / 3); };
  assert.ok(meanY(drooping) < meanY(plain) - 1, `twigs drooping: lower (${meanY(drooping).toFixed(1)} < ${meanY(plain).toFixed(1)})`);
  assert.ok(lowest(drooping) >= lowest(plain) - 50, 'the trunk unbent');
  // A leaf is a quad from its stalk (vertices 1, 2) to its tip (0, 3): hanging, its tip is below its stalk.
  const tipsBelow = (t) => { const v = t.leaves.verts; let n = 0, all = 0; for (let q = 0; q + 12 <= v.length; q += 12) { all++; if (v[q + 1] < v[q + 4]) n++; } return n / all; };
  const hanging = grow(o => { o.leaves.hang = 0.95; });
  // Measured with EZ-Tree 2.0.0: 0.947 of hanging leaves, 0.307 of the others (1.1.0: 0.973, 0.601).
  assert.ok(tipsBelow(hanging) > 0.9 && tipsBelow(plain) < 0.5, `${tipsBelow(hanging)} of hanging leaves point down, ${tipsBelow(plain)} of the others`);
});

test('our palms (#485): fronds only at the top of a bare trunk, none by default; a fan palm and a date palm by genus', () => {
  for (const name of ['Palmier', 'Dattier']) {
    const t = generateSpeciesTree(name, 1, { makeCanvas: fakeCanvas });
    const box = new THREE.Box3().setFromObject(t), h = box.max.y - box.min.y;
    const pos = t.leavesMesh.geometry.attributes.position;
    assert.ok(pos.count > 100, `${name}: its fronds (${pos.count} vertices)`);
    let low = Infinity; for (let i = 0; i < pos.count; i++) low = Math.min(low, pos.getY(i));
    // Measured: the old leaf bases (boots) come down to 0.50 of a fan palm's height, the hanging fronds to ~0.3 of a date palm's.
    assert.ok((low - box.min.y) / h > (name === 'Dattier' ? 0.25 : 0.4), `${name}: its crown above its bare trunk (${((low - box.min.y) / h).toFixed(2)})`);
  }
  const plain = new Tree(new TreeOptions());
  plain.options.copy(structuredClone(TREE_PRESETS['Oak Small'])); plain.generate();
  assert.equal(plain.options.fronds.count, 0);
  assert.equal(speciesFor('palmier', 'Chamaerops'), 'Palmier');
  assert.equal(speciesFor('palmier', 'Trachycarpus'), 'Palmier');
  assert.equal(speciesFor('palmier', 'Phoenix'), 'Dattier');
  assert.equal(speciesFor('palmier', null), null, 'two palms: none without its genus');
});

test('our additions (#485): a shorter leader, a palm trunk with no point, folded fronds and leaf bases', () => {
  const grow = (preset, set) => {
    const t = new Tree(new TreeOptions());
    t.options.copy(structuredClone(TREE_PRESETS[preset]));
    t.options.seed = 7919;
    set(t.options);
    t.generate();
    return t;
  };
  const top = (t) => { const v = t.branches.verts; let y = -Infinity; for (let i = 1; i < v.length; i += 3) y = Math.max(y, v[i]); return y; };
  const plain = grow('Aspen Large', () => {}), short = grow('Aspen Large', o => { o.branch.terminal = 0.3; });
  assert.ok(top(short) < top(plain) - 5, `the leader shortened: ${top(short).toFixed(1)} under ${top(plain).toFixed(1)}`);
  // A palm: its trunk's last ring as wide as the one under it (EZ-Tree pinches a last branch to a point).
  const palm = grow('Aspen Small', o => { o.branch.levels = 0; o.leaves.count = 0; Object.assign(o.fronds, { count: 10, boots: 6, fold: 0.5, cross: false }); });
  const v = palm.branches.verts, ring = palm.options.branch.segments[0] + 1, last = v.length / 3 - ring;
  const width = (start) => {
    const at = (k, c) => v[(start + k) * 3 + c];
    const cx = [0, 1, 2].map(c => { let s = 0; for (let k = 0; k < ring; k++) s += at(k, c); return s / ring; });
    let m = 0; for (let k = 0; k < ring; k++) m = Math.max(m, Math.hypot(at(k, 0) - cx[0], at(k, 1) - cx[1], at(k, 2) - cx[2]));
    return m;
  };
  assert.ok(width(last) > width(last - ring) * 0.5, 'no point at the top of a palm trunk');
  // Five vertices a row of a frond (its fold), and the boots: 16 fronds in all.
  const rows = (f) => f.count * (f.segments + 1) + f.boots * 3;
  assert.equal(palm.leaves.verts.length / 3, 5 * rows(palm.options.fronds));
});

test('the leaves write a full alpha where drawn (the white page showed through mipmapped leaves), EZ-Tree\'s shader kept', () => {
  const t = generateSpeciesTree('Chene', 1, { makeCanvas: fakeCanvas });
  const m = t.leavesMesh.material;
  const shader = { fragmentShader: 'a\n#include <alphatest_fragment>\n#include <normal_fragment_begin>\nb', vertexShader: '' };
  globalThis.THREE.ShaderChunk.normal_fragment_begin ??= '';
  m.onBeforeCompile(shader, null);
  assert.match(shader.fragmentShader, /#include <alphatest_fragment>\n\tdiffuseColor\.a = 1\.0;/);
  assert.ok(!shader.fragmentShader.includes('#include <normal_fragment_begin>'), 'EZ-Tree\'s rounded normals still applied');
  assert.match(m.customProgramCacheKey(), /ez-tree-rounded-normals\+opaque-cutout$/);
  assert.equal(t.branchesMesh.material.customProgramCacheKey().includes('opaque'), false, 'the bark is not cut out');
});
