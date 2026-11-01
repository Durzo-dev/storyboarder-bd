/**
 * #463d : tourner un Élément à la souris dans une Case ou une Scène, avec le moteur des articulations.
 */
import './helpers/dom-stub.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { debutDeRotation3D, angleDeRotation3D, quartDeTour3D, modeSelonLaCamera3D } from '../src/rotation-objet-3d.js';

const deg = (r) => r * 180 / Math.PI;
const proche = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('le plateau tournant (de face) : glisser à droite tourne à droite, 0,5° par pixel ; Maj cinq fois plus fin', () => {
  const s = debutDeRotation3D({ angle: 0, pivot: { x: 100, y: 100 }, pointeur: { x: 100, y: 100 }, axe: { x: 0, y: -1, versOeil: false }, mode: 'droit' });
  assert.equal(s.mode, 'droit');
  proche(deg(angleDeRotation3D(s, { x: 140, y: 100 }, { alt: true })), 20);
  proche(deg(angleDeRotation3D(s, { x: 140, y: 100 }, { alt: true, maj: true })), 4);
  proche(deg(angleDeRotation3D(s, { x: 100, y: 160 }, { alt: true })), 0, 1e-9);   // le long de l'axe : rien
});

test('aimant tous les 90° (à moins de 6°), Ctrl par 15°, Alt libre', () => {
  const s = debutDeRotation3D({ angle: 0, pivot: { x: 0, y: 0 }, pointeur: { x: 0, y: 0 }, axe: { x: 0, y: -1, versOeil: false }, mode: 'droit' });
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
  // Signalé : la boîte VUE (projetée par la vraie caméra), pas o.x / o.y, sinon la caméra bougeait.
  assert.match(ev, /const _cR = _caseR \? projectElementCenterToCanvas3D\(_elR, _caseR, _pgR\) : null;/);
  assert.match(ev, /_ex >= _boite\.x && _ex <= _boite\.x \+ _boite\.w && _ey >= _boite\.y && _ey <= _boite\.y \+ _boite\.h/);
  assert.match(ev, /_o\.rotY = angleDeRotation3D\(S\.dragOrig\.session, \{ x, y \}, \{ ctrl: e\.ctrlKey, alt: e\.altKey, maj: e\.shiftKey \}\);/);
  assert.match(ev, /_o\.rotY = quartDeTour3D\(_o\.rotY\);/);
  assert.match(ev, /if \(o\.type === 'objet3d' && o\.magnetWallId && WALL_OPENING_MAGNET_TYPES\.includes\(o\.objType\)\) return false;/);
});

// Signalé : vu de biais, faire le tour du Personnage inversait le sens à mi-chemin. Un bouton
// rotatif, quelle que soit la vue : le tour complet tourne toujours dans le même sens.
test('vu de biais aussi, un bouton rotatif : un tour complet de la souris, un tour complet de l\'objet, sans inversion', () => {
  const s = debutDeRotation3D({ angle: 0, pivot: { x: 0, y: 0 }, pointeur: { x: 100, y: 0 }, axe: { x: 0, y: -0.9, versOeil: true } });
  assert.equal(s.mode, 'circulaire');
  const pas = [];
  for (let k = 1; k <= 36; k++) { const a = k * Math.PI / 18; pas.push(deg(angleDeRotation3D(s, { x: 100 * Math.cos(a), y: 100 * Math.sin(a) }, { alt: true }))); }
  for (let k = 1; k < pas.length; k++) assert.ok(pas[k] < pas[k - 1], `le sens s'inverse au pas ${k}`);
  proche(pas.at(-1), -360, 1e-6);
});

test('le geste selon la caméra : de face (moins de 45° de plongée), le plateau ; de biais ou de dessus, le bouton', () => {
  const r = (d) => d * Math.PI / 180;
  assert.equal(modeSelonLaCamera3D(r(0)), 'droit');
  assert.equal(modeSelonLaCamera3D(r(25)), 'droit');
  assert.equal(modeSelonLaCamera3D(r(-20)), 'droit');   // contre-plongée légère
  assert.equal(modeSelonLaCamera3D(r(40)), 'droit');
  assert.equal(modeSelonLaCamera3D(r(50)), 'circulaire');
  assert.equal(modeSelonLaCamera3D(r(90)), 'circulaire');
  const ev = readFileSync(new URL('../src/events.js', import.meta.url), 'utf8');
  assert.match(ev, /const _mode = modeSelonLaCamera3D\(Math\.asin\(Math\.max\(-1, Math\.min\(1, b\.backward\.y\)\)\)\);/);
  assert.match(ev, /axe: _mode === 'droit' \? \{ x: 0, y: -1, versOeil: false \}/);
});


// Demandé : le repère de la caméra au style de l'éditeur de bâtiment, ses angles en champs (plus de curseurs).
test('caméra : le repère SVG (axes du monde vus par la caméra), Y et X cliquables, deux champs d\'angle', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const sb = readFileSync(new URL('../src/sidebar.js', import.meta.url), 'utf8');
  const ev = readFileSync(new URL('../src/events.js', import.meta.url), 'utf8');
  assert.match(html, /id="sideCameraRepere" class="batiment-meuble-repere camera-repere"/);
  assert.match(html, /<input type="number" id="camRotYInput"/);
  assert.match(html, /<input type="number" id="camRotXInput"/);
  assert.doesNotMatch(html, /id="sideCameraGizmoCanvas"|type="range" id="camRot[XY]Input"/);
  assert.match(sb, /const p = projectAxisDir3D\(v, basis\);/);
  assert.match(ev, /if \(S\.camAxeActif !== 'x'\) panel\.camRotYTarget =/);
  assert.match(ev, /S\.camAxeActif = S\.camAxeActif === g\.axe \? null : g\.axe;/);
});

// Demandé : l'axe choisi verrouille AUSSI le glisser sur la Case ; plus de sensibilités dans le menu Caméra.
test('caméra : l\'axe verrouille le glisser sur la Case ; le centre de rotation dans le Repère 3D ; plus de sensibilités', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const ev = readFileSync(new URL('../src/events.js', import.meta.url), 'utf8');
  assert.match(ev, /obj\.camRotYTarget = S\.camAxeActif === 'x' \? S\.dragOrig\.camRotY :/);
  assert.match(ev, /obj\.camRotXTarget = S\.camAxeActif === 'y' \? S\.dragOrig\.camRotX :/);
  assert.doesNotMatch(html, /camSensRotInput|camSensPanInput|sideCameraRotSection|sideCameraTransSection/);
  assert.ok(html.indexOf('id="camOrbitTargetSelect"') > html.indexOf('id="sideCameraRepere"'));
});

