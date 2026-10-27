/**
 * L'icône de l'application (assets/icone, livrée par Valentin le 27 octobre 2026) : branchée sur
 * l'installeur et la fenêtre, et exclue de la licence CC (tous droits réservés).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const lire = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('l\'icône est là, branchée sur l\'exécutable et la fenêtre', () => {
  for (const f of ['storyboarder-bd.ico', 'storyboarder-bd-256.png', 'storyboarder-bd-icon.svg']) {
    assert.ok(existsSync(new URL(`../assets/icone/${f}`, import.meta.url)), f);
  }
  const pkg = JSON.parse(lire('package.json'));
  assert.equal(pkg.build.win.icon, 'assets/icone/storyboarder-bd.ico');
  assert.ok(pkg.build.files.includes('assets/**/*'), 'livrée avec l\'application');
  assert.match(lire('electron/main.js'), /icon: path\.join\(RACINE, 'assets', 'icone', 'storyboarder-bd\.ico'\)/);
});

test('elle porte le nom de l\'application, et la licence l\'exclut', () => {
  for (const f of ['storyboarder-bd-icon.svg', 'storyboarder-bd-icon-32.svg', 'storyboarder-bd-icon-16.svg']) {
    assert.doesNotMatch(lire(`assets/icone/${f}`), /Storyboard BD/, f);
  }
  assert.match(lire('LICENSE'), /assets\/icone\/[\s\S]*NOT covered by this license/);
  assert.match(lire('README.md'), /application icon[\s\S]*all rights reserved/);
  assert.match(lire('README.fr.md'), /icône de l'application[\s\S]*tous droits réservés/);
});
