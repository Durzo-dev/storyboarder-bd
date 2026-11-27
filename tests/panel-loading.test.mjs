/**
 * tests/panel-loading.test.mjs: a Panel whose 3D image is not made yet says it is loading (scene3d.js), instead of
 * staying blank while a heavy Scene waits its turn and is built.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
const corps = src.slice(src.indexOf('export function drawPanelScene3D'), src.indexOf('export function drawPanelLoading3D'));
const veil = src.slice(src.indexOf('export function drawPanelLoading3D'), src.indexOf('// Reconstructs the orthonormal basis'));

test('a render put off (no image yet) draws the loading veil, not nothing', () => {
  assert.match(corps, /if \(!rendu\) \{ drawPanelLoading3D\(c, panel\); return; \}/);
  assert.doesNotMatch(corps, /if \(!rendu\) return;/);
});
test('the veil covers the Panel and says so in both languages', () => {
  assert.match(veil, /fillRect\(panel\.x, panel\.y, panel\.w, panel\.h\)/);
  assert.match(veil, /tr\('Loading the scene…', 'Chargement de la scène…'\)/);
  assert.match(veil, /c\.fillStyle = '#efefef';/, 'opaque: nothing shows through');
  assert.doesNotMatch(veil, /rgba\(/);
  assert.match(veil, /panel\.x \+ panel\.w \/ 2, panel\.y \+ panel\.h \/ 2/);
});
test('the text keeps a margin on each side: the font shrinks to fit the Panel\'s width less two margins', () => {
  assert.match(veil, /room = panel\.w - 2 \* margin/);
  assert.match(veil, /if \(width > room && width > 0\) \{ size = Math\.max\(8, size \* room \/ width\)/);
});
test('the veil saves and restores the context (it draws inside the Panel\'s clip)', () => {
  assert.match(veil, /c\.save\(\);[\s\S]*c\.restore\(\);/);
});
