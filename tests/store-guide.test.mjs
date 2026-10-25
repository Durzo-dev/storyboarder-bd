/**
 * Le guide « Faire un store » (docs/en/store-guide.md) et ses maquettes, générées par
 * tools/store-guide-figures.mjs : une maquette retouchée dans le générateur sans être réécrite
 * laisserait le guide montrer l'ancienne.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { figures } from '../tools/store-guide-figures.mjs';

const DOCS = new URL('../docs/', import.meta.url);
const dossier = new URL(['img', 'store-guide', ''].join('/'), DOCS);

describe('le guide « Faire un store »', () => {
  test('RÉGRESSION : les maquettes sont à jour (sinon : node tools/store-guide-figures.mjs)', () => {
    for (const [nom, contenu] of Object.entries(figures())) {
      const f = new URL(nom, dossier);
      assert.ok(existsSync(f), `${nom} manque`);
      assert.equal(readFileSync(f, 'utf8'), contenu, `${nom} n'est plus à jour`);
    }
  });
  test('chaque langue montre ses quatre maquettes, dans sa langue', () => {
    for (const langue of ['fr', 'en']) {
      const md = readFileSync(new URL([langue, 'store-guide.md'].join('/'), DOCS), 'utf8');
      for (const n of ['fenetre', 'carte', 'vignette', 'fiche']) assert.ok(md.includes(`../img/store-guide/${n}.${langue}.svg`), `${langue} : ${n}`);
    }
  });
  test('les règles des stores ont quitté le système de design (demandé : il reste visuel)', () => {
    assert.doesNotMatch(readFileSync(new URL('../tools/design-system.mjs', import.meta.url), 'utf8'), /Faire un store/);
  });
});
