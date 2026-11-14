/**
 * tests/model-bank.test.mjs: the built-in model bank (src/model-bank.js, #480f): a tree takes a model of its
 * genus (OSM's, else drawn from the flora's), else a generic one of its form; the others one of their use; a
 * rural model only in a place little built; the same at each import; credits. And the shipped bank itself
 * (src/model-bank-data.js, written by tools/model-bank-bake.mjs): every file there, every credit whole.
 */
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { BANK_PREFIX, genusOfTags, bankModelsFor, applyBank, bankCredit } from '../src/model-bank.js';
import { MODEL_BANK } from '../src/model-bank-data.js';

const m = (file, objType, genera = [], extra = {}) => ({ file, objType, genera, generic: false, name: file, author: 'A', licence: 'CC-BY-4.0', url: `https://sketchfab.com/3d-models/x-${file}`, ratio: 0.7, ...extra });
const BANK = [
  m('platane-1.glb', 'arbre', ['Platanus'], { generic: true }),
  m('tilleul-1.glb', 'arbre', ['Tilia', 'Celtis'], { generic: true }),
  m('cerisier-1.glb', 'arbre', ['Prunus']),
  m('pin-1.glb', 'conifere', ['Pinus'], { generic: true }),
  m('banc-1.glb', 'banc', [], { generic: true }), m('banc-2.glb', 'banc', [], { generic: true }),
  m('borne-1.glb', 'borne', [], { generic: true }), m('borne-rurale.glb', 'borne', [], { generic: true, rural: true }),
];

describe('the bank, model by model', () => {
  test('a genus from OSM\'s tags: genus, species or taxon, its first word', () => {
    assert.equal(genusOfTags({ genus: 'Platanus' }), 'Platanus');
    assert.equal(genusOfTags({ species: 'Celtis australis' }), 'Celtis');
    assert.equal(genusOfTags({ taxon: 'tilia_cordata' }), 'Tilia');
    assert.equal(genusOfTags({ natural: 'tree' }), null);
  });
  test('the models of a genus; none of it: the generic ones of its form; a cherry is no generic tree', () => {
    assert.deepEqual(bankModelsFor('arbre', 'Prunus', { bank: BANK }).map(x => x.file), ['cerisier-1.glb']);
    assert.deepEqual(bankModelsFor('arbre', 'Celtis', { bank: BANK }).map(x => x.file), ['tilleul-1.glb']);
    assert.deepEqual(bankModelsFor('arbre', 'Ginkgo', { bank: BANK }).map(x => x.file), ['platane-1.glb', 'tilleul-1.glb']);
    assert.deepEqual(bankModelsFor('arbre', null, { bank: BANK }).map(x => x.file), ['platane-1.glb', 'tilleul-1.glb']);
    assert.deepEqual(bankModelsFor('palmier', null, { bank: BANK }), []);
  });
  test('a rural model only in a place little built', () => {
    assert.deepEqual(bankModelsFor('borne', null, { bank: BANK }).map(x => x.file), ['borne-1.glb']);
    assert.equal(bankModelsFor('borne', null, { bank: BANK, rural: true }).length, 2);
  });
  test('a bank file\'s name: its prefix; its credit', () => {
    assert.equal(bankCredit(BANK[0]), '« platane-1.glb » par A, CC BY 4.0, Sketchfab (https://sketchfab.com/3d-models/x-platane-1.glb)');
  });
  test('the main process reads a bank file from the application\'s assets, by the same prefix; never renames, deletes nor writes one', () => {
    const main = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');
    assert.ok(main.includes(`const BANK_PREFIX = '${BANK_PREFIX}';`) && main.includes("'assets', 'model-bank'"));
    for (const canal of ['models:delete', 'models:rename', 'models:write']) {
      const i = main.indexOf(`ipcMain.handle('${canal}'`);
      assert.ok(main.slice(i, i + 400).includes('estDeLaBanque('), `${canal} refuses a bank model`);
    }
  });
});

describe('a bank model is never « missing »', () => {
  test('the Projects folder does not hold it: not reported', async () => {
    const { ressourcesManquantes } = await import('../src/missing-resources.js');
    const objets = [{ type: 'objet3d', objType: 'modele', modelFile: BANK_PREFIX + 'banc-1.glb' }, { type: 'objet3d', objType: 'modele', modelFile: 'Mine.glb' }];
    assert.deepEqual(ressourcesManquantes({ objets, modelesPresents: [], imagesPresentes: [] }).modeles, ['Mine.glb']);
  });
});

describe('the bank given to an import', () => {
  const els = () => [
    { objType: 'arbre', genus: 'Prunus', x: 1, z: 1 },
    ...Array.from({ length: 40 }, (_, i) => ({ objType: 'arbre', x: i * 4.1, z: 7 })),
    { objType: 'banc', x: 3, z: 3 }, { objType: 'palmier', x: 5, z: 5 },
    { objType: 'arbre', modelFile: 'Oak.glb', x: 9, z: 9 },
  ];
  test('a tree of its genus; the others drawn from the flora\'s genera of their form; the same at each import', () => {
    const flora = { genusShares: { arbre: { Platanus: 0.5, Tilia: 0.5 } } };
    const a = els(), b = els();
    const r = applyBank(a, { flora, bank: BANK });
    applyBank(b, { flora, bank: BANK });
    assert.deepEqual(a.map(e => e.modelFile), b.map(e => e.modelFile));
    assert.equal(a[0].modelFile, BANK_PREFIX + 'cerisier-1.glb');
    const drawn = a.slice(1, 41).map(e => e.modelFile);
    assert.ok(drawn.includes(BANK_PREFIX + 'platane-1.glb') && drawn.includes(BANK_PREFIX + 'tilleul-1.glb'));
    assert.ok(!drawn.includes(BANK_PREFIX + 'cerisier-1.glb'), 'a cherry only where OSM says so');
    assert.equal(a[0].usage, 'arbre'); assert.equal(a[0].modelRatio, 0.7);
    assert.equal(a.find(e => e.objType === 'banc').modelFile.startsWith(BANK_PREFIX + 'banc-'), true);
    assert.equal(a.find(e => e.objType === 'palmier').modelFile, undefined, 'no palm in the bank: the built-in object');
    assert.equal(a[a.length - 1].modelFile, 'Oak.glb', 'a model already given kept');
    assert.equal(r.n, 42);
    assert.ok(['cerisier-1.glb', 'platane-1.glb', 'tilleul-1.glb'].every(f => r.used.some(x => x.file === f)), 'the models used, for their credits');
  });
});

describe('the shipped bank (src/model-bank-data.js)', () => {
  test('every model is a file of assets/model-bank, with a whole credit', () => {
    for (const x of MODEL_BANK) {
      assert.ok(existsSync(new URL(`../assets/model-bank/${x.file}`, import.meta.url)), x.file);
      assert.ok(x.name && x.author && /^https:\/\/sketchfab\.com\/3d-models\//.test(x.url) && x.licence === 'CC-BY-4.0', x.file);
      assert.ok(Array.isArray(x.genera) && x.objType && x.ratio > 0, x.file);
    }
  });
});
