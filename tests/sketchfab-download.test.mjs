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
