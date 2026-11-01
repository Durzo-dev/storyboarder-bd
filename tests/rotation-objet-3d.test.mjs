/**
 * #463d : tourner un Élément à la souris dans une Case ou une Scène, avec le moteur des articulations.
 */
import './helpers/dom-stub.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { debutDeRotation3D, angleDeRotation3D, quartDeTour3D } from '../src/rotation-objet-3d.js';

const deg = (r) => r * 180 / Math.PI;
const proche = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('vu de face (axe vertical à l\'écran) : glisser à droite tourne, à 0,5° par pixel ; Maj cinq fois plus fin', () => {
  const s = debutDeRotation3D({ angle: 0, pivot: { x: 100, y: 100 }, pointeur: { x: 100, y: 100 }, axe: { x: 0, y: -1, versOeil: false } });
  assert.equal(s.mode, 'droit');
  proche(deg(angleDeRotation3D(s, { x: 140, y: 100 }, { alt: true })), 20);
  proche(deg(angleDeRotation3D(s, { x: 140, y: 100 }, { alt: true, maj: true })), 4);
  proche(deg(angleDeRotation3D(s, { x: 100, y: 160 }, { alt: true })), 0, 1e-9);   // le long de l'axe : rien
});

test('aimant tous les 90° (à moins de 6°), Ctrl par 15°, Alt libre', () => {
  const s = debutDeRotation3D({ angle: 0, pivot: { x: 0, y: 0 }, pointeur: { x: 0, y: 0 }, axe: { x: 0, y: -1, versOeil: false } });
  proche(deg(angleDeRotation3D(s, { x: 170, y: 0 })), 90);            // 85° → 90°
  proche(deg(angleDeRotation3D(s, { x: 170, y: 0 }, { alt: true })), 85);
  proche(deg(angleDeRotation3D(s, { x: 50, y: 0 }, { ctrl: true })), 30);  // 25° → 30°
});

test('vu de dessus (axe vers l\'œil) : un geste circulaire, cumulé, dans le sens de la souris', () => {
  const s = debutDeRotation3D({ angle: 0, pivot: { x: 0, y: 0 }, pointeur: { x: 100, y: 0 }, axe: { x: 0, y: 0.1, versOeil: true } });
  assert.equal(s.mode, 'circulaire');
  // Un quart de tour horaire à l'écran (vers le bas, y croît vers le bas) : −90° (horaire vu de dessus).
  proche(deg(angleDeRotation3D(s, { x: 0, y: 100 }, { alt: true })), -90, 1e-6);
  proche(deg(angleDeRotation3D(s, { x: -100, y: 0 }, { alt: true })), -180, 1e-6);
  proche(deg(angleDeRotation3D(s, { x: 0, y: -100 }, { alt: true })), -270, 1e-6);   // sans saut au demi-tour
});

test('R : un quart de tour horaire vu de dessus, ramené à ]−π, π]', () => {
  proche(quartDeTour3D(0), -Math.PI / 2);
  proche(quartDeTour3D(-Math.PI / 2), Math.PI);
});

test('câblage : clic droit maintenu SUR l\'Élément choisi, avant le recadrage et la vue ; R ; pas les orientations imposées', () => {
  const ev = readFileSync(new URL('../src/events.js', import.meta.url), 'utf8');
  const iRot = ev.indexOf("S.dragMode = 'objetRotation'");
  assert.ok(iRot > 0 && iRot < ev.indexOf("S.dragMode = 'imageAnchor'") && iRot < ev.indexOf("S.dragMode = 'panelCamPan'; S.dragStart = { x: _tx, y: _ty };"));
  assert.match(ev, /_ex >= _elR\.x && _ex <= _elR\.x \+ _elR\.w && _ey >= _elR\.y && _ey <= _elR\.y \+ _elR\.h/);
  assert.match(ev, /_o\.rotY = angleDeRotation3D\(S\.dragOrig\.session, \{ x, y \}, \{ ctrl: e\.ctrlKey, alt: e\.altKey, maj: e\.shiftKey \}\);/);
  assert.match(ev, /_o\.rotY = quartDeTour3D\(_o\.rotY\);/);
  assert.match(ev, /if \(o\.type === 'objet3d' && o\.magnetWallId && WALL_OPENING_MAGNET_TYPES\.includes\(o\.objType\)\) return false;/);
});
