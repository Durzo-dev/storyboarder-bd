/**
 * tests/maps-link.test.mjs: the Google Maps link of a Panel showing a real place (maps-link.js), its lines under an
 * exported Page (export-credits.js), its clickable zones in the PDF (draw.js), the menu entry and the place carried
 * into a Panel by loadSceneIntoPanel (read in the sources).
 */
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { hasRealPlace, orbitCentreOf, viewOfPanel, streetViewLink, view3dLink, mapsLinkOf, STREET_HEIGHT_MAX } = await import('../src/maps-link.js');
const { liensDesCases } = await import('../src/export-credits.js');
const { buildSinglePageImagePdf } = await import('../src/draw.js');
const { projector } = await import('../src/geo-local.js');

const ETOILE = { lat: 48.8738, lon: 2.2950 };
const page = { w: 1200, h: 1600 };
const panel = (extra = {}) => ({ type: 'panel', x: 100, y: 200, w: 600, h: 400, caseNumber: 2,
  lieu: { ...ETOILE }, camRotX: 0, camRotY: 0, camDist: 10, camWx: 0, camWy: 1.6, camWz: 0, ...extra });

describe('hasRealPlace', () => {
  test('a Panel with a place, and the ones without', () => {
    assert.equal(hasRealPlace(panel()), true);
    assert.equal(hasRealPlace(panel({ lieu: undefined })), false);
    assert.equal(hasRealPlace(panel({ lieu: { lat: 'x', lon: 2 } })), false);
    assert.equal(hasRealPlace(null), false);
  });
});

describe('viewOfPanel', () => {
  test('no place, no view', () => assert.equal(viewOfPanel(panel({ lieu: null }), page), null));
  test('yaw 0 looks north: the eye stands south of the target (z +), heading 0', () => {
    const v = viewOfPanel(panel(), page);
    assert.equal(v.heading, 0);
    assert.ok(v.lat < ETOILE.lat, 'eye south of the centre');
    const back = projector(ETOILE).toLocal(v);
    assert.ok(Math.abs(back.z - 10) < 0.2 && Math.abs(back.x) < 0.2, JSON.stringify(back));
  });
  test('yaw −90° looks east: heading 90, the eye west of the target', () => {
    const v = viewOfPanel(panel({ camRotY: -Math.PI / 2 }), page);
    assert.equal(v.heading, 90);
    assert.ok(v.lon < ETOILE.lon);
  });
  test('a camera above its target looks down: negative pitch, and it is high', () => {
    const v = viewOfPanel(panel({ camRotX: Math.PI / 6, camDist: 100 }), page);
    assert.equal(v.pitch, -30);
    assert.ok(v.height > 50);
  });
  test('the centre the render resolved (an orbit target, a selected Element) wins over camWx/Wy/Wz', () => {
    const libre = viewOfPanel(panel(), page);
    const cible = viewOfPanel(panel({ _orbitCx: 50, _orbitCy: 1.6, _orbitCz: 0 }), page);
    const dx = projector(ETOILE).toLocal(cible).x - projector(ETOILE).toLocal(libre).x;
    assert.ok(Math.abs(dx - 50) < 0.5, String(dx));
    assert.deepEqual(orbitCentreOf(panel({ _orbitCx: 1, _orbitCy: NaN, _orbitCz: 3 })), { x: 0, y: 1.6, z: 0 });
  });
  test('the content shift carried from the Scene (decalageX) moves the place east', () => {
    const a = viewOfPanel(panel(), page), b = viewOfPanel(panel({ lieu: { ...ETOILE, decalageX: 100 } }), page);
    const dx = projector(ETOILE).toLocal(b).x - projector(ETOILE).toLocal(a).x;
    assert.ok(Math.abs(dx - 100) < 0.5, String(dx));
  });
  test('the field narrows with the Panel (it crops the Page), within Street View bounds', () => {
    const large = viewOfPanel(panel({ w: 1200 }), page).fov, etroit = viewOfPanel(panel({ w: 300 }), page).fov;
    assert.ok(etroit < large, `${etroit} < ${large}`);
    assert.ok(etroit >= 10 && large <= 120);
  });
});

describe('the links', () => {
  const v = { lat: 48.87, lon: 2.29, height: 1.6, heading: 45, pitch: -10, fov: 70, vfov: 50 };
  test('Street View: the official pano form', () =>
    assert.equal(streetViewLink(v), 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=48.87,2.29&heading=45&pitch=-10&fov=70'));
  test('the 3D view: height, field, heading, tilt (90 + pitch)', () =>
    assert.equal(view3dLink({ ...v, height: 200 }), 'https://www.google.com/maps/@48.87,2.29,200a,50y,45h,80t/data=!3m1!1e3'));
  test('street height → Street View, above → 3D view', () => {
    assert.match(mapsLinkOf(v), /map_action=pano/);
    assert.match(mapsLinkOf({ ...v, height: STREET_HEIGHT_MAX + 1 }), /data=!3m1!1e3/);
  });
});

describe('liensDesCases (under the exported Page)', () => {
  test('one line per Panel with a place, numbered, none for the others', () => {
    const l = liensDesCases(page, [panel(), panel({ caseNumber: 3, lieu: undefined })], 'en');
    assert.equal(l.length, 1);
    assert.match(l[0].ligne, /^Panel 2 — Google Maps : https:\/\/www\.google\.com\/maps\//);
    assert.match(liensDesCases(page, [panel()], 'fr')[0].ligne, /^Case 2 /);
  });
});

describe('the PDF links', () => {
  const txt = (b) => Buffer.from(b).toString('latin1');
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  test('without links: no annotation, 6 entries', () => {
    const s = txt(buildSinglePageImagePdf(jpeg, 100, 200));
    assert.ok(!s.includes('/Annots') && s.includes('/Size 6'));
  });
  test('a link: an annotation over its rectangle (PDF origin bottom left), the xref counting it', () => {
    const s = txt(buildSinglePageImagePdf(jpeg, 100, 200, [{ x: 10, y: 20, w: 30, h: 40, uri: 'https://www.google.com/maps/@?a=(1)' }]));
    assert.match(s, /\/Annots \[6 0 R\]/);
    assert.match(s, /\/Rect \[10 140 40 180\]/);
    assert.match(s, /\/URI \(https:\/\/www\.google\.com\/maps\/@\?a=\\\(1\\\)\)/);
    assert.match(s, /xref\n0 7\n/);
    assert.ok(s.includes('/Size 7'));
    const xref = Number(s.match(/startxref\n(\d+)/)[1]);
    assert.ok(s.slice(xref).startsWith('xref'), 'startxref points at the xref');
    const off6 = Number(s.slice(xref).split('\n')[8].slice(0, 10));
    assert.ok(s.slice(off6).startsWith('6 0 obj'), 'object 6 at its offset');
  });
  test('a non-https link is dropped', () => {
    assert.ok(!txt(buildSinglePageImagePdf(jpeg, 100, 200, [{ x: 0, y: 0, w: 1, h: 1, uri: 'javascript:x' }])).includes('/Annots'));
  });
});

describe('wiring (sources)', () => {
  const ev = readFileSync(new URL('../src/events.js', import.meta.url), 'utf8');
  const sc = readFileSync(new URL('../src/scenes.js', import.meta.url), 'utf8');
  const dr = readFileSync(new URL('../src/draw.js', import.meta.url), 'utf8');
  test('the menu entry exists only on a Panel with a place', () =>
    assert.match(ev, /'ctxLienMaps'\)\.style\.display = hit && hit\.type === 'panel' && hasRealPlace\(hit\)/));
  test('loadSceneIntoPanel carries the place with the X shift, and clears it otherwise', () => {
    assert.match(sc, /panel\.lieu = \{ \.\.\.scenePanel\.lieu, decalageX: [^}]*worldBboxCx \}/);
    assert.match(sc, /else delete panel\.lieu;/);
  });
  test('exportPage takes all the Panels for the links, not only the described ones', () =>
    assert.match(dr, /liensDesCases\(page, panelsInPage\(page\)/));
  test('the link goes under its Panel\'s description; its own block only when the descriptions are off', () => {
    assert.match(dr, /const lienLines = l \? replierLigne/);
    assert.match(dr, /block\.lienLines\.forEach/);
    assert.match(dr, /const lienBlocs = \(panels\.length \? \[\] : liens\)\.map/);
  });
  test('in the PDF, the printed link is clickable too', () => assert.match(dr, /\.concat\(zonesDesLiens\)/));
});
