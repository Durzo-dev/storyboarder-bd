/**
 * #463b : un seul zoom (proportionnel à la molette, ×1,105 par cran), Maj + molette qui compte, et
 * Ctrl + molette qui zoome partout.
 */
import './helpers/dom-stub.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deltaMolette3D, facteurDeZoom3D, ZOOM_PAR_DELTA_3D } from '../src/utils.js';

const lire = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('le facteur : ×1,105 par cran de 100, symétrique, et un pavé tactile au même rythme', () => {
  assert.equal(ZOOM_PAR_DELTA_3D, 0.001);
  assert.ok(Math.abs(facteurDeZoom3D(100) - Math.exp(0.1)) < 1e-12);
  assert.ok(Math.abs(facteurDeZoom3D(100) * facteurDeZoom3D(-100) - 1) < 1e-12);
  // Dix petits pas de 10 font un cran de 100.
  assert.ok(Math.abs(facteurDeZoom3D(10) ** 10 - facteurDeZoom3D(100)) < 1e-9);
});

test('le Δ : lignes et pages en pixels ; Maj + molette (défilement horizontal) compte encore', () => {
  assert.equal(deltaMolette3D({ deltaY: -100, deltaMode: 0 }), -100);
  assert.equal(deltaMolette3D({ deltaY: 3, deltaMode: 1 }), 99);
  assert.equal(deltaMolette3D({ deltaY: 0, deltaX: -100, deltaMode: 0 }), -100);
});

test('tous les zooms passent par lui ; plus aucun pas fixe', () => {
  assert.match(lire('store-apercu-3d.js'), /distance \* facteurDeZoom3D\(deltaY\)/);
  assert.match(lire('batiment-editeur-ui.js'), /1 \/ facteurDeZoom3D\(dm\)/);
  assert.match(lire('modals.js'), /S\.objectPreviewZoom \/ facteurDeZoom3D\(deltaMolette3D\(e\)\)/);
  assert.match(lire('modals.js'), /S\.personaPreviewZoom \/ facteurDeZoom3D\(deltaMolette3D\(e\)\)/);
  assert.match(lire('persona-editor.js'), /const k = 1 \/ facteurDeZoom3D\(deltaMolette3D\(e\)\);/);
  assert.match(lire('events.js'), /clamp\(oldDist \* facteurDeZoom3D\(dm\)/);
  for (const f of ['modals.js', 'persona-editor.js', 'events.js', 'batiment-editeur-ui.js']) assert.doesNotMatch(lire(f), /1\.12 : 1 \/ 1\.12|zoomStep = 1\.08|0\.92 : 1\.08|e\.deltaY \* 0\.0015/, f);
});

test('Ctrl + molette zoome toujours ; Maj affine la profondeur d\'un Élément', () => {
  assert.match(lire('persona-editor.js'), /if \(S\.personaEditorHandleId && !e\.ctrlKey\)/);
  assert.match(lire('events.js'), /const _proprio = \(e\.ctrlKey && sel && \(sel\.type === 'perso' \|\| sel\.type === 'objet3d'\)\)/);
  assert.match(lire('events.js'), /PANEL_CAM_REF_DIST_3D \* 0\.06 \* \(e\.shiftKey \? 0\.2 : 1\)/);
});
