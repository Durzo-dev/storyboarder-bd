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
import { BANK_PREFIX, bankLabel, genusOfTags, taxonOfTags, bankModelsFor, applyBank, bankCredit } from '../src/model-bank.js';
import { MODEL_BANK } from '../src/model-bank-data.js';

const m = (file, objType, genera = [], extra = {}) => ({ file, objType, genera, generic: false, name: file, author: 'A', licence: 'CC-BY-4.0', url: `https://sketchfab.com/3d-models/x-${file}`, ratio: 0.7, ...extra });
const BANK = [
  m('platane-1.glb', 'arbre', ['Platanus'], { generic: true }),
  m('tilleul-1.glb', 'arbre', ['Tilia', 'Celtis', 'Ulmus', 'Ficus'], { generic: true }),
  m('noyer-1.glb', 'arbre', ['Juglans', 'Ailanthus']),
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
    assert.deepEqual(bankModelsFor('arbre', 'Juglans', { bank: BANK }).map(x => x.file), ['noyer-1.glb']);
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

describe('a bank model\'s name', () => {
  test('the tree\'s real name in the language, numbered when the bank has several; the title otherwise', () => {
    const bank = [m('erable-1.glb', 'arbre', [], { use: 'erable', label: { fr: 'Érable', en: 'Maple' } }),
      m('erable-2.glb', 'arbre', [], { use: 'erable', label: { fr: 'Érable', en: 'Maple' } }),
      m('saule-1.glb', 'arbre', [], { use: 'saule', label: { fr: 'Saule', en: 'Willow' } }), m('banc-1.glb', 'banc', [], { use: 'banc', name: 'Park Bench' })];
    assert.equal(bankLabel(bank[1], 'fr', bank), 'Érable 2');
    assert.equal(bankLabel(bank[0], 'en', bank), 'Maple 1');
    assert.equal(bankLabel(bank[2], 'fr', bank), 'Saule');
    assert.equal(bankLabel(bank[3], 'fr', bank), 'Park Bench');
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
    { objType: 'arbre', genus: 'Ailanthus', x: 1, z: 1 },   // genera with no species of ours: the bank's
    ...Array.from({ length: 40 }, (_, i) => ({ objType: 'arbre', x: i * 4.1, z: 7 })),
    { objType: 'banc', x: 3, z: 3 }, { objType: 'palmier', x: 5, z: 5 },
    { objType: 'arbre', modelFile: 'Oak.glb', x: 9, z: 9 },
  ];
  test('a tree of its genus; the others drawn from the flora\'s genera of their form; the same at each import', () => {
    const flora = { genusShares: { arbre: { Platanus: 0.5, Ficus: 0.5 } } };
    const a = els(), b = els();
    const r = applyBank(a, { flora, bank: BANK });
    applyBank(b, { flora, bank: BANK });
    assert.deepEqual(a.map(e => [e.modelFile, e.essence, e.variante]), b.map(e => [e.modelFile, e.essence, e.variante]));
    assert.equal(a[0].modelFile, BANK_PREFIX + 'noyer-1.glb');
    const drawn = a.slice(1, 41);
    assert.ok(drawn.some(e => e.modelFile === BANK_PREFIX + 'tilleul-1.glb'), 'a fig (no species of ours): the bank');
    assert.ok(!drawn.some(e => e.modelFile === BANK_PREFIX + 'noyer-1.glb'), 'that model only where OSM says its genus');
    assert.equal(a[0].usage, 'arbre'); assert.equal(a[0].modelRatio, 0.7);
    assert.equal(a.find(e => e.objType === 'banc').modelFile.startsWith(BANK_PREFIX + 'banc-'), true);
    assert.equal(a.find(e => e.objType === 'palmier').modelFile, undefined, 'no palm in the bank: the built-in object');
    assert.equal(a[a.length - 1].modelFile, 'Oak.glb', 'a model already given kept');
    const planes = drawn.filter(e => e.essence);
    assert.equal(r.n + r.species, 42);
    assert.equal(r.species, planes.length);
    assert.ok(['noyer-1.glb', 'tilleul-1.glb'].every(f => r.used.some(x => x.file === f)), 'the models used, for their credits');
  });
  test('a tree of our species: no model, EZ-Tree\'s (#480g), its variant and height drawn from its place', () => {
    const a = els();
    applyBank(a, { flora: { genusShares: { arbre: { Platanus: 1 } } }, bank: BANK });
    const planes = a.slice(1, 41);
    assert.ok(planes.every(e => e.essence === 'Platane' && !e.modelFile && e.objType === 'arbre'));
    assert.deepEqual([...new Set(planes.map(e => e.variante))].sort(), [1, 2, 3]);
    assert.ok(planes.every(e => e.height >= 15.3 && e.height <= 20.7), 'the plane\'s 18 m, ±15 %');
    const known = [{ objType: 'arbre', genus: 'Platanus', height: 9, x: 0, z: 0 }, { objType: 'olivier', x: 2, z: 0 }];
    applyBank(known, { bank: BANK });
    assert.equal(known[0].height, 9, 'a measured height kept');
    assert.equal(known[1].essence, 'Olivier');
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

describe('a model renamed: its name shown, never its file (#480f, asked)', () => {
  test('the library keeps the name; an empty one gives the default back; it follows the file, and goes with it', async () => {
    const { createRequire } = await import('node:module');
    const biblio = createRequire(import.meta.url)('../electron/bibliotheque/bibliotheque-modeles.js');
    let b = biblio.appliquer(null, 'titre', { fichier: 'bank--erable-1.glb', nom: '  Érable  de la place ' }).bibliotheque;
    assert.equal(b.titres['bank--erable-1.glb'], 'Érable de la place');
    assert.equal(biblio.normaliser(JSON.parse(JSON.stringify(b))).titres['bank--erable-1.glb'], 'Érable de la place', 'kept on disk');
    b = biblio.renommerModele(biblio.appliquer(b, 'titre', { fichier: 'chaise.glb', nom: 'Ma chaise' }).bibliotheque, 'chaise.glb', 'siege.glb');
    assert.equal(b.titres['siege.glb'], 'Ma chaise');
    assert.equal(biblio.oublierModele(b, 'siege.glb').titres['siege.glb'], undefined);
    assert.equal(biblio.appliquer(b, 'titre', { fichier: 'bank--erable-1.glb', nom: '' }).bibliotheque.titres['bank--erable-1.glb'], undefined);
  });
  test('« My models » shows it', async () => {
    const { entreesLocales } = await import('../src/local-library.js');
    const [e] = entreesLocales({ fichiers: [{ nom: 'chaise.glb', taille: 1 }], bibliotheque: { titres: { 'chaise.glb': 'Ma chaise' } } });
    assert.equal(e.titre, 'Ma chaise'); assert.equal(e.titreChoisi, true); assert.equal(e.fichier, 'chaise.glb');
  });
});

describe('two models, two textures, never the same name shown (asked)', () => {
  test('the rename window refuses a name taken (case and spaces aside), and gives the reason', () => {
    const io = readFileSync(new URL('../src/io.js', import.meta.url), 'utf8');
    assert.match(io, /kind === 'nom-modele' \|\| kind === 'texture'\) \{\n\s+return \(\(S\.renameModalContext && S\.renameModalContext\.pris\) \|\| \[\]\)\.some\(n => String\(n\)\.trim\(\)\.toLowerCase\(\) === norm\);/);
    assert.ok(io.includes("'Un modèle porte déjà ce nom.'") && io.includes("'Une texture porte déjà ce nom.'"));
    const ev = readFileSync(new URL('../src/events.js', import.meta.url), 'utf8');
    assert.ok(ev.includes('pris: nomsAffichesModeles(fichier)') && ev.includes('pris: nomsDesTextures(t.cle)'));
  });
});

test('a tree\'s species from OSM (two words), and its species of ours before its genus\'s', () => {
  assert.equal(taxonOfTags({ species: 'Quercus ilex' }), 'quercus ilex');
  assert.equal(taxonOfTags({ taxon: 'Pinus pinea' }), 'pinus pinea');
  assert.equal(taxonOfTags({ genus: 'Quercus' }), null);
  assert.equal(taxonOfTags({ species: 'Quercus' }), null);
  const els = [{ objType: 'arbre', x: 1, z: 2, genus: 'Quercus', taxon: 'quercus ilex' }, { objType: 'arbre', x: 5, z: 2, genus: 'Quercus' }];
  applyBank(els);
  assert.deepEqual(els.map(e => e.essence), ['Yeuse', 'Chene']);
});
