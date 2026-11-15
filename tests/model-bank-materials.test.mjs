/**
 * tests/model-bank-materials.test.mjs: THE BANK'S PLANTS MATTE (tools/model-bank-materials.mjs, #480j: leaves white
 * at their edges, one tree white all over). A specular-glossiness material gives its diffuse to the base colour and
 * leaves the metal; a plant's material loses its metal and its gloss, its colour and normal map kept.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document } from '@gltf-transform/core';
import { KHRMaterialsPBRSpecularGlossiness } from '@gltf-transform/extensions';
import { toMetalRough, mattePlant, PLANT_ROUGHNESS } from '../tools/model-bank-materials.mjs';

const png = (n) => new Uint8Array([137, 80, 78, 71, n]);

test('specular-glossiness: its diffuse becomes the base colour, no metal, the extension gone', () => {
  const doc = new Document();
  const sgExt = doc.createExtension(KHRMaterialsPBRSpecularGlossiness);
  const diffuse = doc.createTexture('leaf').setImage(png(1)).setMimeType('image/png');
  const m = doc.createMaterial('leafs').setMetallicFactor(1).setAlphaMode('MASK');
  m.setExtension('KHR_materials_pbrSpecularGlossiness', sgExt.createPBRSpecularGlossiness().setDiffuseTexture(diffuse).setDiffuseFactor([0.8, 0.9, 0.7, 1]));
  const plain = doc.createMaterial('bark').setMetallicFactor(0.2);
  assert.equal(toMetalRough(doc), 1);
  assert.equal(m.getBaseColorTexture(), diffuse);
  assert.deepEqual(m.getBaseColorFactor(), [0.8, 0.9, 0.7, 1]);
  assert.equal(m.getMetallicFactor(), 0);
  assert.equal(m.getExtension('KHR_materials_pbrSpecularGlossiness'), null);
  assert.equal(m.getAlphaMode(), 'MASK');
  assert.equal(doc.getRoot().listExtensionsUsed().length, 0);
  assert.equal(plain.getMetallicFactor(), 0.2, 'a metal-roughness material untouched');
});

test('a plant matte: no metal, no gloss map, rough; its colour and normal map kept; twice changes nothing', () => {
  const doc = new Document();
  const colour = doc.createTexture('c').setImage(png(2)), normal = doc.createTexture('n').setImage(png(3)), mr = doc.createTexture('mr').setImage(png(4));
  const m = doc.createMaterial('leaf').setBaseColorTexture(colour).setNormalTexture(normal).setMetallicRoughnessTexture(mr)
    .setMetallicFactor(0).setRoughnessFactor(1);
  assert.equal(mattePlant(doc), 1);
  assert.equal(m.getMetallicRoughnessTexture(), null);
  assert.equal(m.getMetallicFactor(), 0);
  assert.equal(m.getRoughnessFactor(), PLANT_ROUGHNESS);
  assert.equal(m.getBaseColorTexture(), colour);
  assert.equal(m.getNormalTexture(), normal);
  assert.equal(mattePlant(doc), 0);
});
