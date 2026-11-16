/**
 * tests/ez-tree-bark.test.mjs: A TREE'S BARK ARRIVES AFTER ITS FIRST DRAWING. A Panel drawn before its trees' bark
 * arrived is cached (scene3d.js); `barkSettled` enters its signature, so the Panel is drawn again when the bark
 * arrives, or is found missing. Seen on 16 Nov. 2026 without it: oaks with plain white branches, from the cache.
 *
 * A DOM is faked (document, Image) before src/ez-trees.js is imported: its bark loading only runs with one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.THREE = THREE;
const fakeCanvas = (size) => {
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ addColorStop() {} })), set: (o, k, v) => { o[k] = v; return true; } });
  return { width: size, height: size, getContext: () => ctx };
};
const images = [];
globalThis.document = { createElement: () => fakeCanvas(256) };
globalThis.Image = class { constructor(){ images.push(this); } };
const { generateSpeciesTree, barkSettled } = await import('../src/ez-trees.js');

const imageOf = (file) => images.find(i => String(i.src).endsWith(file));

test('a bark asked is not settled until it arrives; then it is', () => {
  generateSpeciesTree('Chene', 1, { makeCanvas: fakeCanvas });
  const img = imageOf('ecorce-chene.jpg');
  assert.ok(img, 'the oak\'s bark is asked');
  assert.equal(barkSettled('Chene'), false);
  img.onload();
  assert.equal(barkSettled('Chene'), true);
});

test('a bark missing is settled too (its trees drawn plain, as they will stay)', () => {
  globalThis.console = Object.assign(Object.create(console), { warn() {} });
  generateSpeciesTree('Platane', 1, { makeCanvas: fakeCanvas });
  assert.equal(barkSettled('Platane'), false);
  imageOf('ecorce-platane.jpg').onerror();
  assert.equal(barkSettled('Platane'), true);
});

test('a bark never asked is not settled; one species\' arrival settles no other', () => {
  assert.equal(barkSettled('Tilleul'), false);
});

test('a bark drawn (the birch\'s): a canvas at once, settled, no file asked', () => {
  const before = images.length;
  const t = generateSpeciesTree('Bouleau', 1, { makeCanvas: fakeCanvas });
  assert.equal(images.length, before, 'no image file asked');
  let m; t.traverse(o => { if (o.isMesh && o.material.name === 'branches') m = o.material; });
  assert.ok(m.map && m.map.isCanvasTexture, 'the drawn canvas is the bark');
  assert.equal(barkSettled('Bouleau'), true);
});
