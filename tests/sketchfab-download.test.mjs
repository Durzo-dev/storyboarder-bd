/**
 * tests/sketchfab-download.test.mjs: downloading from Sketchfab (#444d).
 *
 * The pure decisions (the signed link, the error of a refused request, what the download button says)
 * are tested here. Out of reach under Node: the real requests (store.js, telechargerSketchfab), checked in
 * the application by downloading a model.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import sketchfab from '../electron/bibliotheque/store-sketchfab.js';
import './helpers/dom-stub.mjs';
const { etatBoutonTelechargement } = await import('../src/store-ui.js');

const ROOT = fileURLToPath(new URL('..', import.meta.url));

describe('#444d, the signed link of the .glb', () => {
  test('the .glb link and its size are taken from the answer', () => {
    const l = sketchfab.lienGlb({ glb: { url: 'https://example.org/a.glb?sig=1', size: 1234, expires: 300 }, gltf: { url: 'https://x/z.zip' } });
    assert.deepEqual(l, { url: 'https://example.org/a.glb?sig=1', octets: 1234 });
  });
  test('no .glb, or a link that is not https: nothing to download', () => {
    assert.equal(sketchfab.lienGlb({ gltf: { url: 'https://x/z.zip' } }), null);
    assert.equal(sketchfab.lienGlb({ glb: { url: 'http://x/a.glb' } }), null);
    assert.equal(sketchfab.lienGlb(null), null);
  });
  test('a refused request names its cause', () => {
    assert.equal(sketchfab.erreurDemande(401), 'connexion');
    assert.equal(sketchfab.erreurDemande(403), 'interdit');
    assert.equal(sketchfab.erreurDemande(404), 'introuvable');
    assert.equal(sketchfab.erreurDemande(429), 'quota');
    assert.equal(sketchfab.erreurDemande(500), 'reponse');
  });
});

describe('#444d, the download button of a Sketchfab record', () => {
  const etat = (p) => etatBoutonTelechargement({ source: 'sketchfab', possible: true, options: [], choisie: '1k', possede: null, poids: 25 * 1024 * 1024, ...p });
  test('signed in: download, with the weight and no resolution', () => {
    const e = etat({ compte: 'ok' });
    assert.equal(e.action, 'telecharger');
    assert.equal(e.actif, true);
    assert.equal(e.texte, 'Télécharger (25 Mo)');
    assert.equal(e.note, '');
  });
  test('signed out: the button signs in, then downloads', () => {
    const e = etat({ compte: 'requis', lang: 'en' });
    assert.equal(e.action, 'connexion');
    assert.equal(e.texte, 'Sign in and download');
  });
  test('while signing in: the button cancels, the note says where to look', () => {
    const e = etat({ compte: 'enCours' });
    assert.equal(e.action, 'annuler');
    assert.equal(e.texte, 'Annuler');
    assert.match(e.note, /navigateur/);
  });
  test('already downloaded: nothing to do, no resolution mentioned', () => {
    const e = etat({ compte: 'ok', possede: { fichier: 'a.glb', resolution: null } });
    assert.equal(e.actif, false);
    assert.equal(e.texte, '✓ Déjà téléchargé');
  });
  test('every download error has a message in both languages', async () => {
    const { textesStore } = await import('../src/store-texts.js');
    for (const lang of ['fr', 'en']) {
      for (const k of ['connexion', 'interdit', 'introuvable', 'formatAbsent', 'quota', 'corrompu', 'tropLourd']) {
        assert.equal(typeof textesStore(lang).erreurs[k], 'string', `${lang}/${k}`);
      }
    }
  });
});

describe('#444d, the token stays in the main process', () => {
  const store = readFileSync(`${ROOT}electron/bibliotheque/store.js`, 'utf8');
  test('the signed file link is fetched without the token (it is not Sketchfab\'s API)', () => {
    const lire = store.slice(store.indexOf('async function lireOctets'), store.indexOf('const md5'));
    assert.ok(lire.length > 0);
    assert.doesNotMatch(lire, /Authorization/);
  });
  test('the download answers the renderer with the model only', () => {
    const f = store.slice(store.indexOf('async function telechargerSketchfab'), store.indexOf('async function telecharger('));
    for (const m of f.matchAll(/return \{([^}]*)\}/g)) assert.doesNotMatch(m[1], /token|jeton/i);
  });
});

describe('the source mention in a record', () => {
  const ui = readFileSync(`${ROOT}src/store-ui.js`, 'utf8');
  const css = readFileSync(`${ROOT}src/style.css`, 'utf8');
  test('a record carries the mention in its information column, and hides the footer', () => {
    assert.match(ui, /classe: 'store-credit store-fiche-credit'/);
    assert.match(ui, /zone\.parentElement\.hidden = !!\(fiche && !fiche\.hidden\)/);
    // A class that sets `display` beats the hidden attribute: the footer needs its own rule.
    assert.match(css, /\.store-pied\[hidden\]\{ display:none; \}/);
  });
});

describe('#444d, NC and ND warnings', async () => {
  const { avertissementsLicence } = await import('../src/store-texts.js');
  test('read from the licence code, in both languages', () => {
    assert.deepEqual(avertissementsLicence({ code: 'by' }), []);
    assert.deepEqual(avertissementsLicence({ code: 'cc0' }), []);
    assert.equal(avertissementsLicence({ code: 'by-nc' }).length, 1);
    assert.match(avertissementsLicence({ code: 'by-nc' })[0], /non commerciale/);
    assert.match(avertissementsLicence({ code: 'by-nd' }, 'en')[0], /No-derivatives/);
    assert.equal(avertissementsLicence({ code: 'by-nc-nd' }).length, 2);
    assert.deepEqual(avertissementsLicence({ code: 'inconnue' }), []);
    assert.deepEqual(avertissementsLicence(null), []);
  });
  test('shown in the store record and in a "My models" record', () => {
    const ui = readFileSync(`${ROOT}src/store-ui.js`, 'utf8');
    assert.equal((ui.match(/avertissementsLicence\(/g) || []).length, 2);
  });
});

describe('#444d, a glTF archive becomes a .glb', async () => {
  const zlib = await import('node:zlib');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { glbDepuisArchiveGltf } = require('../electron/bibliotheque/gltf-archive.js');
  const { lireGlb } = require('../electron/bibliotheque/gltf-glb.js');
  const Z = require('../electron/bibliotheque/zip-lecture.js');
  // A small zip written here (stored and deflated entries), as in store-textures.test.mjs.
  function petitZip(fichiers){
    const locaux = [], centraux = [];
    let decalage = 0;
    for (const [nom, contenu, comprimer] of fichiers) {
      const donnees = comprimer ? zlib.deflateRawSync(contenu) : contenu;
      const n = Buffer.from(nom, 'utf8');
      const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(comprimer ? 8 : 0, 8);
      l.writeUInt32LE(donnees.length, 18); l.writeUInt32LE(contenu.length, 22); l.writeUInt16LE(n.length, 26);
      const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(comprimer ? 8 : 0, 10);
      c.writeUInt32LE(donnees.length, 20); c.writeUInt32LE(contenu.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(decalage, 42);
      locaux.push(l, n, donnees); centraux.push(c, n);
      decalage += 30 + n.length + donnees.length;
    }
    const central = Buffer.concat(centraux);
    const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(fichiers.length, 8); fin.writeUInt16LE(fichiers.length, 10);
    fin.writeUInt32LE(central.length, 12); fin.writeUInt32LE(decalage, 16);
    return Buffer.concat([...locaux, central, fin]);
  }
  const bin = Buffer.alloc(36, 1);
  const png = Buffer.from('\x89PNG fausse image', 'latin1');
  const gltf = {
    asset: { version: '2.0' },
    buffers: [{ uri: 'scene.bin', byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.length }],
    images: [{ uri: 'textures/peau.png' }],
  };
  test('the Sketchfab layout (scene.gltf, scene.bin, textures/) is packed into one .glb', () => {
    const zipBuf = petitZip([
      ['scene.gltf', Buffer.from(JSON.stringify(gltf)), true],
      ['scene.bin', bin, false],
      ['textures/peau.png', png, true],
      ['license.txt', Buffer.from('CC BY'), false],
    ]);
    const glb = glbDepuisArchiveGltf(zipBuf);
    assert.equal(Buffer.from(glb).toString('latin1', 0, 4), 'glTF');
    const lu = lireGlb(glb);
    assert.ok(lu && lu.json, 'the .glb reads back');
    assert.ok(!JSON.stringify(lu.json).includes('textures/peau.png'), 'the image is embedded, not referenced');
  });
  test('a missing file, no scene or two scenes: refused, never guessed', () => {
    assert.throws(() => glbDepuisArchiveGltf(petitZip([['scene.gltf', Buffer.from(JSON.stringify(gltf)), false]])), /manquante/);
    assert.throws(() => glbDepuisArchiveGltf(petitZip([['scene.bin', bin, false]])), /aucune scène/);
    assert.throws(() => glbDepuisArchiveGltf(petitZip([['a.gltf', Buffer.from('{}'), false], ['b.gltf', Buffer.from('{}'), false]])), /plusieurs/);
  });
  test('paths that leave the archive are skipped', () => {
    assert.equal(Z.cheminSur('textures/a.png'), true);
    assert.equal(Z.cheminSur('../a.png'), false);
    assert.equal(Z.cheminSur('textures/../../a.png'), false);
    assert.equal(Z.cheminSur('/etc/a'), false);
    assert.equal(Z.cheminSur('C:/a'), false);
    assert.equal(Z.cheminSur('textures/'), false);
  });
  test('the download answer: .glb first, else the glTF archive', () => {
    assert.equal(sketchfab.lienTelechargement({ glb: { url: 'https://x/a.glb' }, gltf: { url: 'https://x/a.zip' } }).format, 'glb');
    assert.deepEqual(sketchfab.lienTelechargement({ gltf: { url: 'https://x/a.zip', size: 9 } }), { url: 'https://x/a.zip', octets: 9, format: 'gltf' });
    assert.equal(sketchfab.lienTelechargement({ usdz: { url: 'https://x/a.usdz' } }), null);
  });
});
