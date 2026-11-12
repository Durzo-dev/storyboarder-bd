/**
 * tests/real-place-lay.test.mjs: a real place laid in a new Scene (src/real-place-lay.js), then rendered by
 * the real 3D code (the WebGL renderer alone is stubbed): every building and object drawn at its place,
 * standing on the Ground, and the zone framed. Extract: Eguisheim (tests/fixtures/osm-eguisheim.json,
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
const rig = await import('../src/rig3d.js');
const { GROUND_Y_DEFAULT_3D } = await import('../src/constants.js');

const village = JSON.parse(readFileSync(new URL('./fixtures/osm-eguisheim.json', import.meta.url), 'utf8'));
const centre = { lat: (village.bbox.sud + village.bbox.nord) / 2, lon: (village.bbox.ouest + village.bbox.est) / 2 };
const HALF = 100;
let n = 0;
const content = sceneContentOf(translateOsm(village, { centre, halfSize: HALF }), { panelId: 'P', newId: () => `rp${++n}` });
// The built-in objects (trees, lamps) as events.js makes them, reduced to what the laying reads.
const newObject = (panel, view, objType) => ({ id: `rp${++n}`, type: 'objet3d', objType, x: 0, y: 0, w: 20, h: 40,
  z: 0, realHeightFloor: 1, magnetGround: true, homePanelId: panel.id, rotX: 0, rotY: 0, rotZ: 0 });

describe('real place, laid in a new Scene and rendered', () => {
  const scene = createScene();
  const { page, panel } = layRealPlace(scene, { ...content, elements: [] }, { halfSize: HALF, newObject });
  const buildings = page.objects.filter(o => o.objType === 'batiment');
  drawPanelScene3D(document.createElement('canvas').getContext('2d'), panel, { ...page, w: scene.w, h: scene.h, objects: page.objects }, scene.style3d);
  const T = globalThis.THREE, cam = rig.personaCamera3D;
  cam.updateMatrixWorld();
  const frustum = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));

  test('every building is drawn, at its place, standing on the Ground (seen: none drawn, their 2D frame NaN)', () => {
    assert.equal(buildings.length, content.buildings.length);
    assert.ok(buildings.length > 10);
    for (const o of buildings) {
      assert.ok([o.x, o.y, o.w, o.h].every(Number.isFinite), `${o.name}: a 2D frame`);
      const fg = rig.ensureObjectRigEntry3D(o).figureGroup;
      assert.ok(fg.parent && fg.visible, `${o.name}: in the scene`);
      const box = new T.Box3().setFromObject(fg);
      assert.ok(!box.isEmpty() && frustum.intersectsBox(box), `${o.name}: in view`);
      const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
      assert.ok(Math.hypot(cx - o.wxFloor, cz - o.wzFloor) < 30, `${o.name}: at its place`);
      assert.ok(Math.abs(box.min.y - GROUND_Y_DEFAULT_3D) < 0.1, `${o.name}: on the Ground (${box.min.y.toFixed(2)})`);
      assert.equal(o.z, 0, 'the depth stays 0: the size does not follow the north-south position');
    }
  });
  test('the zone is framed from above, with a small margin', () => {
    assert.equal(panel.camRotX, Math.PI / 2);
    // 480 × 360 page: 9 m high at the default 30 m, so 0.15 m per metre of distance on each side.
    assert.ok(Math.abs(panel.camDist - HALF * 1.1 / 0.15) < 1e-6);
    assert.ok(cam.far > panel.camDist + 50, 'the far plane reaches the Ground');
  });
  test('objects are made against the Scene\'s size, and stand on the Ground', () => {
    const s2 = createScene();
    const seen = [];
    const { page: p2 } = layRealPlace(s2, { traces: [], buildings: [], elements: [{ objType: 'arbre', x: 12, z: -40 }], credits: [] },
      { halfSize: HALF, newObject: (panel, view, t) => { seen.push(view); return newObject(panel, view, t); } });
    assert.deepEqual([seen[0].w, seen[0].h], [s2.w, s2.h]);
    const tree = p2.objects.find(o => o.objType === 'arbre');
    assert.deepEqual([tree.wxFloor, tree.wzFloor, tree.z], [12, -40, 0]);
  });
});
