/**
 * tests/glb-images.test.mjs: #467, a .glb whose images are replaced (src/glb-images.js), and the
 * texture qualities offered for a Sketchfab model. The shrinking itself (canvas, src/glb-reduction.js)
 * is checked in the application.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { lireGlb, imagesDuGlb, remplacerImages, ecrireGlb, tailleReduite, pixelsDe, optionsSketchfab } from '../src/glb-images.js';

const require = createRequire(import.meta.url);
const glbElectron = require('../electron/bibliotheque/gltf-glb.js');

function petitGlb(){
  const geometrie = new Uint8Array(12).map((_, i) => i + 1);
  const image = new Uint8Array(30).fill(7);
  const bin = new Uint8Array(44);
  bin.set(geometrie, 0); bin.set(image, 12);
  const json = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: 42 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 12 }, { buffer: 0, byteOffset: 12, byteLength: 30 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 1, type: 'VEC3' }],
    images: [{ bufferView: 1, mimeType: 'image/png' }, { uri: 'externe.png' }],
  };
  return ecrireGlb(json, bin);
}

describe('#467, replacing the images of a .glb', () => {
  test('a .glb reads back, and its stored images are listed (not those given by uri)', () => {
    const { json, bin } = lireGlb(petitGlb());
    const ims = imagesDuGlb(json, bin);
    assert.deepEqual(ims.map(i => [i.index, i.mime, i.octets.length]), [[0, 'image/png', 30]]);
  });
  test('the new image takes its place; the geometry is copied as is; offsets stay aligned', () => {
    const { json, bin } = lireGlb(petitGlb());
    const neuve = new Uint8Array(5).fill(9);
    const sortie = remplacerImages(json, bin, new Map([[0, { octets: neuve, mime: 'image/png' }]]));
    const lu = lireGlb(sortie);
    const [v0, v1] = lu.json.bufferViews;
    assert.deepEqual([...lu.bin.subarray(v0.byteOffset, v0.byteOffset + v0.byteLength)], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.equal(v1.byteOffset % 4, 0);
    assert.deepEqual([...lu.bin.subarray(v1.byteOffset, v1.byteOffset + v1.byteLength)], [9, 9, 9, 9, 9]);
    assert.equal(lu.json.buffers[0].byteLength, v1.byteOffset + 5);
    assert.equal(lu.json.accessors[0].bufferView, 0);
    // The packer the main process uses reads it too (same format).
    assert.ok(glbElectron.lireGlb(sortie).json);
  });
  test('sizes: the longest side brought down, the ratio kept; a small image unchanged', () => {
    assert.deepEqual(tailleReduite(4096, 2048, 1024), { l: 1024, h: 512, reduite: true });
    assert.deepEqual(tailleReduite(512, 512, 1024), { l: 512, h: 512, reduite: false });
    assert.equal(pixelsDe('1k'), 1024);
    assert.equal(pixelsDe('2k'), 2048);
    assert.equal(pixelsDe('origine'), null);
  });
});

describe('#467, the qualities offered for a Sketchfab model', () => {
  test('1k and 2k only when smaller than its largest texture, then the original with its weight', () => {
    assert.deepEqual(optionsSketchfab(4096, 9).map(o => o.resolution), ['1k', '2k', 'origine']);
    assert.deepEqual(optionsSketchfab(2048, 9).map(o => o.resolution), ['1k', 'origine']);
    assert.deepEqual(optionsSketchfab(1024, 9).map(o => o.resolution), ['origine']);
    assert.deepEqual(optionsSketchfab(undefined, 9).map(o => o.resolution), ['origine']);
    assert.equal(optionsSketchfab(4096, 9)[2].octets, 9);
    assert.equal(optionsSketchfab(4096, 9)[0].octets, null);
  });
});
