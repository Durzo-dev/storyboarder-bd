/**
 * tests/opaque-cutout.test.mjs: cut-out leaves write a full alpha (#480j, #489).
 *
 * MEASURED (bench, three r128, the model bank's own files): drawn on an empty background, the leaves of « Érable 1 »
 * wrote an alpha of 0.78 at 15 m, 0.60 at 40 m, 0.46 at 100 m; « Tilleul 1 » 0.60, 0.48, 0.44. A Panel's 3D image is
 * laid on the white page: those crowns looked almost white from afar. With the cut-out made opaque: 1 everywhere, the
 * same pixels drawn. « Platane 1 » and « Érable 2 » have BLENDED leaves (0.87 at every distance): drawn as cut-outs.
 */
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { empaqueterGlb } = require('../electron/bibliotheque/gltf-glb.js');
const { GLTFLoader } = await import('../src/vendor/GLTFLoader.js');
const { opaqueCutout, opaqueCutouts, OPAQUE_CUTOUT, LEAF_CUTOFF } = await import('../src/opaque-cutout.js');
const { preparerModeleImporte3D } = await import('../src/model-cache.js');
const { isBankPlantFile, BANK_PREFIX, BANK_PLANT_TYPES } = await import('../src/model-bank.js');
const { MODEL_BANK } = await import('../src/model-bank-data.js');
const T = globalThis.THREE;

/** The fragment shader three compiles, once the material's own change has run. */
function compiled(material){
  const shader = { fragmentShader: 'void main(){\n#include <alphatest_fragment>\n}', vertexShader: '', uniforms: {} };
  material.onBeforeCompile(shader, null);
  return shader.fragmentShader;
}
const leaf = (o = {}) => Object.assign(new T.MeshStandardMaterial({ map: new T.Texture() }), o);
const sceneOf = (...mats) => { const g = new T.Group(); mats.forEach(m => g.add(new T.Mesh(new T.BufferGeometry(), m))); return g; };

/** A real .glb with one triangle and one material of the given alpha mode, decoded by the application's loader. */
function decodedGlb(alphaMode){
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const gltf = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ alphaMode, alphaCutoff: 0.3, pbrMetallicRoughness: { baseColorFactor: [0.2, 0.5, 0.2, 1] } }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }], buffers: [{ uri: 't.bin', byteLength: 36 }],
  };
  const glb = empaqueterGlb(gltf, new Map([['t.bin', Buffer.from(pos.buffer)]]));
  const raw = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
  return new Promise((ok, ko) => new GLTFLoader().parse(raw, '', ok, ko));
}
const meshMaterial = (scene) => { let m = null; scene.traverse(n => { if (n.isMesh && !m) m = n.material; }); return m; };

describe('A cut-out writes a full alpha', () => {
  test('the shader keeps three\'s cut-out, then sets the alpha to 1', () => {
    const m = leaf({ alphaTest: 0.3 });
    opaqueCutout(m);
    const fs = compiled(m);
    assert.ok(fs.includes('#include <alphatest_fragment>\n\tdiffuseColor.a = 1.0;'));
    assert.equal(OPAQUE_CUTOUT.split('#include <alphatest_fragment>').length, 2, 'the cut-out itself is kept');
    assert.match(m.customProgramCacheKey(), /opaque-cutout$/, 'named in the program key: no program shared with a blended twin');
  });
  test('chained on the material\'s own shader change, once only', () => {
    const m = leaf({ alphaTest: 0.3 });
    m.onBeforeCompile = (s) => { s.fragmentShader += '\n// own'; };
    m.customProgramCacheKey = () => 'own';
    opaqueCutout(m);
    opaqueCutout(m);
    const fs = compiled(m);
    assert.ok(fs.endsWith('// own'), 'the earlier change still runs');
    assert.equal(fs.split('diffuseColor.a = 1.0;').length, 2, 'applied once, even when called twice');
    assert.equal(m.customProgramCacheKey(), 'own+opaque-cutout');
  });
});

describe('An imported model\'s materials', () => {
  test('a cut-out (MASK) is made opaque; an opaque or blended material is left alone', () => {
    const mask = leaf({ alphaTest: 0.24 });
    const plain = leaf();
    const glass = leaf({ transparent: true, opacity: 0.4 });
    assert.equal(opaqueCutouts(sceneOf(mask, plain, glass)), 1);
    assert.ok(mask.userData.opaqueCutout);
    assert.ok(!plain.userData.opaqueCutout && plain.onBeforeCompile.toString() === T.Material.prototype.onBeforeCompile.toString());
    assert.ok(glass.transparent && !glass.userData.opaqueCutout, 'glass stays blended out of a plant');
  });
  test('a PLANT\'s blended leaves become a cut-out at glTF\'s threshold; a blended material without texture stays', () => {
    const leaves = leaf({ transparent: true, depthWrite: false });
    const tint = new T.MeshStandardMaterial({ transparent: true, opacity: 0.5 });
    assert.equal(opaqueCutouts(sceneOf(leaves, tint), { plant: true }), 1);
    assert.equal(leaves.transparent, false);
    assert.equal(leaves.depthWrite, true);
    assert.equal(leaves.alphaTest, LEAF_CUTOFF);
    assert.equal(LEAF_CUTOFF, 0.5);
    assert.ok(leaves.userData.opaqueCutout);
    assert.ok(tint.transparent && !tint.userData.opaqueCutout);
  });
  test('the real loader\'s MASK material goes out opaque from the single preparation; BLEND does not', async () => {
    const mask = meshMaterial(preparerModeleImporte3D(await decodedGlb('MASK')));
    assert.ok(mask.alphaTest > 0 && !mask.transparent);
    assert.ok(mask.userData.opaqueCutout, 'preparerModeleImporte3D makes the cut-out opaque');
    assert.ok(compiled(mask).includes('diffuseColor.a = 1.0;'));
    const blend = meshMaterial(preparerModeleImporte3D(await decodedGlb('BLEND')));
    assert.ok(blend.transparent && !blend.userData.opaqueCutout);
  });
});

describe('The bank\'s plants', () => {
  test('trees, conifers and palms are plants; furniture is not; a file out of the bank is not', () => {
    assert.deepEqual([...BANK_PLANT_TYPES], ['arbre', 'conifere', 'palmier']);
    assert.equal(isBankPlantFile(BANK_PREFIX + 'erable-2.glb'), true);
    assert.equal(isBankPlantFile(BANK_PREFIX + 'platane-1.glb'), true);
    assert.equal(isBankPlantFile(BANK_PREFIX + 'abribus-2.glb'), false, 'its glass stays blended');
    assert.equal(isBankPlantFile(BANK_PREFIX + 'fontaine-2.glb'), false, 'its water stays blended');
    assert.equal(isBankPlantFile('erable-2.glb'), false, 'a model of « My models » keeps its blending');
    assert.equal(isBankPlantFile(BANK_PREFIX + 'nothing.glb'), false);
    assert.equal(isBankPlantFile(null), false);
    assert.ok(MODEL_BANK.filter(m => BANK_PLANT_TYPES.includes(m.objType)).length >= 10);
  });
  test('the model cache and the thumbnails prepare a bank plant as a plant', () => {
    for (const f of ['model-cache.js', 'model-thumbnails.js']) {
      const src = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
      assert.match(src, /preparerModeleImporte3D\(gltf, \{ plant: isBankPlantFile\(nom\) \}\)/, f);
    }
  });
  test('one source: the generated trees and the crops use the same cut-out', () => {
    for (const f of ['ez-trees.js', 'crops-3d.js']) {
      const src = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
      assert.match(src, /import \{ opaqueCutout \} from '\.\/opaque-cutout\.js';/, f);
      assert.doesNotMatch(src, /export function opaqueCutout/, f);
    }
  });
});
