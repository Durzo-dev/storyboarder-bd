/**
 * tests/configuration-onglets.test.mjs : la modale de Configuration en trois onglets (demandé, elle
 * dépassait la hauteur d'un écran). Chaque réglage est rangé dans le bon onglet, les pages gardent
 * la hauteur de la plus longue, et le dernier onglet ouvert est retenu.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const HTML = lire('src/index.html');
const MODALE = HTML.slice(HTML.indexOf('id="settingsModal"'), HTML.indexOf('id="settingsModalClose"'));
const page = (nom) => {
  const i = MODALE.indexOf(`<div class="config-page" data-onglet="${nom}"`);
  assert.ok(i >= 0, `onglet ${nom} absent`);
  const j = MODALE.indexOf('<div class="config-page"', i + 1);
  return MODALE.slice(i, j < 0 ? undefined : j);
};

describe('Configuration : trois onglets', () => {
  test('les trois onglets, Général actif par défaut', () => {
    for (const [id, nom] of [['configOngletGeneral', 'general'], ['configOngletProjets', 'projets'], ['configOnglet3d', '3d']]) {
      assert.match(MODALE, new RegExp(`data-onglet="${nom}" id="${id}"`));
    }
    assert.match(MODALE, /class="config-onglet actif" role="tab" data-onglet="general"/);
  });

  test('chaque réglage est dans son onglet', () => {
    const attendus = {
      general: ['languageSelect', 'themeSelect', 'contrastCheckbox', 'uiScaleSelect', 'cacheMoRange'],
      projets: ['autosaveIntervalSelect', 'projectsDirBrowse', 'projectsDirReset', 'exportShowPanelBadgesCheckbox', 'exportShowPanelDescriptionsCheckbox'],
      '3d': ['gestesRotationRange', 'gestesDeplacementRange', 'gestesResetBtn', 'restoreBuiltinPosesBtn'],
    };
    for (const [nom, ids] of Object.entries(attendus)) {
      const p = page(nom);
      for (const id of ids) assert.ok(p.includes(`id="${id}"`), `${id} n'est pas dans l'onglet ${nom}`);
    }
  });

  test('les pages se superposent : la modale garde la hauteur de la plus longue', () => {
    const css = lire('src/style.css');
    assert.match(css, /\.config-pages\{ display:grid; \}/);
    assert.match(css, /\.config-page\{ grid-area:1 \/ 1;/);
    assert.match(css, /\.config-page\[hidden\]\{ display:block; visibility:hidden; \}/);
  });

  test('le câblage : un clic change d\'onglet, la modale rouvre sur le dernier', () => {
    const ev = lire('src/events.js');
    assert.match(ev, /pages\.forEach\(p => \{ p\.hidden = p\.dataset\.onglet !== onglet; \}\);/);
    assert.match(ev, /b\.addEventListener\('click', \(\) => choisirOngletConfig\(b\.dataset\.onglet\)\)/);
    const ouvrir = ev.slice(ev.indexOf('function openSettingsModal(){'));
    assert.match(ouvrir, /^function openSettingsModal\(\)\{\n {2}choisirOngletConfig\(ongletConfig\);/);
  });

  test('le bouton « Vitesses par défaut » ne colle plus au réglage suivant', () => {
    assert.match(MODALE, /id="gestesResetBtn" type="button" style="margin-top:0; margin-bottom:14px;/);
  });
});
