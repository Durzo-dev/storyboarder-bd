/**
 * tests/scene-loading.test.mjs: a large Scene built a few buildings at a time (src/scene-loading.js), with the
 * real 3D code (the WebGL renderer alone is stubbed). Extract: Eguisheim (tests/fixtures/osm-eguisheim.json,
 * © OpenStreetMap contributors, ODbL).
 */
import './helpers/dom-stub.mjs';
import './helpers/render-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { translateOsm } = await import('../src/osm-scene.js');
const { sceneContentOf } = await import('../src/real-place-import.js');
const { layRealPlace } = await import('../src/real-place-lay.js');
const { createScene } = await import('../src/scenes.js');
const { drawPanelScene3D } = await import('../src/scene3d.js');
const L = await import('../src/scene-loading.js');

const village = JSON.parse(readFileSync(new URL('./fixtures/osm-eguisheim.json', import.meta.url), 'utf8'));
const centre = { lat: (village.bbox.sud + village.bbox.nord) / 2, lon: (village.bbox.ouest + village.bbox.est) / 2 };
let n = 0;
const content = sceneContentOf(translateOsm(village, { centre, halfSize: 100 }), { panelId: 'P', newId: () => `sl${++n}` });
const newScene = () => { const s = createScene(); layRealPlace(s, { ...content, elements: [] }, { halfSize: 100, newObject: () => null }); return s; };

describe('a Scene built progressively', () => {
  test('its buildings counted up to the total, then the ground; one render, at the end', async () => {
    const s = newScene(), total = L.placedBuildings(s.pages[0]).length;
    const seen = [];
    let renders = 0;
    const fini = await L.buildScene(s, { onProgress: (step, sub, detail) => seen.push({ step, sub, detail }), render: () => { renders++; } });
    assert.equal(fini, true);
    assert.equal(renders, 1);
    assert.deepEqual(seen[0], { step: 'buildings', sub: 0, detail: { done: 0, total } });
    assert.deepEqual(seen.at(-1), { step: 'ground', sub: 1, detail: null });
    let last = -1;
    for (const p of seen) { const v = L.buildProgress(p.step, p.sub); assert.ok(v >= last); last = v; }
  });
  test('not drawn while being built: a render then would build everything at once', async () => {
    const s = newScene(), page = s.pages[0], panel = page.objects.find(o => o.type === 'panel');
    let drawnDuring = null;
    const view = { ...page, w: s.w, h: s.h, objects: page.objects };
    const ctx = document.createElement('canvas').getContext('2d');
    let calls = 0;
    ctx.drawImage = () => { calls++; };
    const promise = L.buildScene(s, { render: () => {} });
    drawPanelScene3D(ctx, panel, view, s.style3d);
    drawnDuring = calls;
    await promise;
    assert.equal(drawnDuring, 0);
    drawPanelScene3D(ctx, panel, view, s.style3d);
    assert.ok(calls > 0, 'built: drawn');
  });
  test('cancelled: stops, says so, and leaves the Panel drawable', async () => {
    const s = newScene();
    let renders = 0;
    const fini = await L.buildScene(s, { cancelled: () => true, render: () => { renders++; } });
    assert.equal(fini, false);
    assert.equal(renders, 0);
  });
  test('the labels: the buildings with their count', async () => {
    const { S } = await import('../src/state.js');
    S.appLang = 'fr';
    assert.equal(L.buildStepLabel('buildings', { done: 120, total: 300 }), 'Construction des bâtiments 120 / 300');
    assert.equal(L.buildStepLabel('ground'), 'Affichage du relief, des routes et des sols');
  });
});

describe('opening an existing Scene', () => {
  test('a small one opens as before; a large one behind the card', () => {
    const small = createScene();
    assert.equal(L.ouvrirSceneProgressivement(small, {}), false);
    assert.ok(L.placedBuildings(newScene().pages[0]).length >= L.PROGRESSIVE_FROM, 'Eguisheim is large enough');
    assert.equal(L.ouvrirSceneProgressivement(newScene(), {}), true);
    assert.equal(document.getElementById('sceneLoading').hidden, false);
  });
  test('openScene asks first, before its render; the import\'s Scene is built by its window', () => {
    const sc = readFileSync(new URL('../src/scenes.js', import.meta.url), 'utf8');
    assert.match(sc, /if \(progressif && scene\) _avantOuverture\(scene, previous\);\n  renderAll\(\);/);
    const ev = readFileSync(new URL('../src/events.js', import.meta.url), 'utf8');
    assert.match(ev, /const construction = buildScene\(s, \{ onProgress, cancelled, render: renderAll \}\);\n    openScene\(s\.id, \{ progressif: false \}\);/);
  });
});
