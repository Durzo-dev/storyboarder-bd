/**
 * tests/real-place-lay.test.mjs: a real place laid in a new Scene (src/real-place-lay.js), then rendered by
 * the real 3D code (the WebGL renderer alone is stubbed): every building and object drawn at its place,
 * standing on the Ground, and the zone framed. Extract: Eguisheim (tests/fixtures/osm-eguisheim.json,
 * © OpenStreetMap contributors, ODbL).
 */
import './helpers/dom-stub.mjs';
import './helpers/render-stub.mjs';
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { translateOsm } = await import('../src/osm-scene.js');
const { sceneContentOf } = await import('../src/real-place-import.js');
const { layRealPlace } = await import('../src/real-place-lay.js');
const { createScene } = await import('../src/scenes.js');
const { drawPanelScene3D } = await import('../src/scene3d.js');
const rig = await import('../src/rig3d.js');
const { GROUND_Y_DEFAULT_3D } = await import('../src/constants.js');
const { reliefDepuisAltitudes, hauteurDuRelief } = await import('../src/terrain-relief.js');
const { readBdTopo } = await import('../src/building-survey.js');

const village = JSON.parse(readFileSync(new URL('./fixtures/osm-eguisheim.json', import.meta.url), 'utf8'));
const centre = { lat: (village.bbox.sud + village.bbox.nord) / 2, lon: (village.bbox.ouest + village.bbox.est) / 2 };
const HALF = 100;
let n = 0;
const content = sceneContentOf(translateOsm(village, { centre, halfSize: HALF }), { panelId: 'P', newId: () => `rp${++n}` });
// The built-in objects (trees, lamps) as events.js makes them, reduced to what the laying reads.
const newObject = (panel, view, objType) => ({ id: `rp${++n}`, type: 'objet3d', objType, x: 0, y: 0, w: 20, h: 40,
  z: 0, realHeightFloor: 1, magnetGround: true, homePanelId: panel.id, rotX: 0, rotY: 0, rotZ: 0 });

describe('real place, laid in a new Scene and rendered', () => {
  let panel, buildings, cam, frustum, T;
  before(() => {
    const scene = createScene();
    let page;
    ({ page, panel } = layRealPlace(scene, { ...content, elements: [] }, { halfSize: HALF, newObject }));
    buildings = page.objects.filter(o => o.objType === 'batiment');
    drawPanelScene3D(document.createElement('canvas').getContext('2d'), panel, { ...page, w: scene.w, h: scene.h, objects: page.objects }, scene.style3d);
    T = globalThis.THREE; cam = rig.personaCamera3D;
    cam.updateMatrixWorld();
    frustum = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  });

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

describe('real place on a slope: the roads stay above the relief', () => {
  // A hillside: 12 % up towards the north-east, over the whole zone (the village's real lie, steepened).
  const nx = 2 * HALF + 1, altitudes = new Array(nx * nx);
  for (let j = 0; j < nx; j++) for (let i = 0; i < nx; i++) altitudes[j * nx + i] = 200 + 0.12 * (i - (nx - 1 - j));
  let mesh = null;
  before(() => {
    const { relief } = reliefDepuisAltitudes({ x0: -HALF, z0: -HALF, pas: 1, nx, nz: nx, altitudes });
    const scene = createScene();
    const { page, panel } = layRealPlace(scene, { ...content, relief, elements: [] }, { halfSize: HALF, newObject });
    drawPanelScene3D(document.createElement('canvas').getContext('2d'), panel, { ...page, w: scene.w, h: scene.h, objects: page.objects }, scene.style3d);
    // The rendered relief: its mesh, read back as a height field.
    rig.personaScene3D.traverse(m => { if (m.isMesh && m.userData.relief && m.parent) mesh = m; });
  });
  test('the relief is rendered', () => assert.ok(mesh));
  test('the roads and paths stay on the relief (seen: streets half buried)', () => {
    const pos = mesh.geometry.attributes.position, field = { x0: -HALF, z0: -HALF, pas: 1, nx, nz: nx, h: new Array(nx * nx) };
    for (let k = 0; k < pos.count; k++) field.h[k] = pos.getY(k) - GROUND_Y_DEFAULT_3D;
    let meshes = 0, vertices = 0, under = 0, worst = 0;
    rig.personaScene3D.traverse(m => {
      if (!m.isMesh || !m.userData.dessinAuSol || m.userData.relief) return;
      meshes++;
      m.updateMatrixWorld();
      const p = m.geometry.attributes.position, v = new globalThis.THREE.Vector3();
      for (let k = 0; k < p.count; k++) {
        v.fromBufferAttribute(p, k).applyMatrix4(m.matrixWorld);
        const depth = hauteurDuRelief(field, v.x, v.z) - (v.y - GROUND_Y_DEFAULT_3D);
        vertices++;
        if (depth > 0.01) under++;
        worst = Math.max(worst, depth);
      }
    });
    assert.ok(meshes > 20 && vertices > 50000);
    // Measured before the cut: 31,985 vertices of 93,186 under the relief, down to 1.6 m. What is left (24) is a
    // few vertices where a path turns sharply (its profile bends between two grid points), a few centimetres.
    assert.ok(under / vertices < 0.001, `${under} of ${vertices} vertices under the relief`);
    assert.ok(worst < 0.1, `a vertex ${worst.toFixed(2)} m under the relief`);
  });
});

describe('real place with the IGN survey: materials and heights drawn', () => {
  const bd = JSON.parse(readFileSync(new URL('./fixtures/bdtopo-eguisheim.json', import.meta.url), 'utf8'));
  const surveyed = sceneContentOf(translateOsm(village, { centre, halfSize: HALF, survey: readBdTopo(bd, centre) }), { panelId: 'P', newId: () => `rp${++n}` });
  test('every building, stone and tiles included, is drawn standing on the Ground', () => {
    const scene = createScene();
    const { page, panel } = layRealPlace(scene, { ...surveyed, elements: [] }, { halfSize: HALF, newObject });
    drawPanelScene3D(document.createElement('canvas').getContext('2d'), panel, { ...page, w: scene.w, h: scene.h, objects: page.objects }, scene.style3d);
    const T = globalThis.THREE;
    const buildings = page.objects.filter(o => o.objType === 'batiment');
    assert.ok(buildings.some(o => o.batiment.facade), 'some with a facade finish');
    for (const o of buildings) {
      const box = new T.Box3().setFromObject(rig.ensureObjectRigEntry3D(o).figureGroup);
      assert.ok(!box.isEmpty() && Math.abs(box.min.y - GROUND_Y_DEFAULT_3D) < 0.1, `${o.name}: drawn, on the Ground`);
    }
  });
});

describe('a pavement Path, rendered', () => {
  test('a slab as wide as the Path, its top a kerb above the Ground', () => {
    const scene = createScene();
    const t = { id: 'pv1', type: 'tracé', tracéType: 'trottoir', name: 'Trottoir', color: '#B4B0A8', width: 6,
      world: { pts: [{ x: -10, z: 0 }, { x: 10, z: 0 }], width: 2 } };
    const { page, panel } = layRealPlace(scene, { traces: [t], buildings: [], elements: [], credits: [] }, { halfSize: 20, newObject });
    drawPanelScene3D(document.createElement('canvas').getContext('2d'), panel, { ...page, w: scene.w, h: scene.h, objects: page.objects }, scene.style3d);
    let box = null;
    rig.personaScene3D.traverse(m => {
      if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
      const b = new globalThis.THREE.Box3().setFromObject(m);
      if (b.max.y - b.min.y > 0.1 && b.max.y - b.min.y < 0.2 && Math.abs(b.max.z - b.min.z - 2) < 0.1) box = b;
    });
    assert.ok(box, 'a 14 cm high, 2 m wide slab');
    assert.ok(Math.abs(box.max.y - (GROUND_Y_DEFAULT_3D + 0.145)) < 0.02);
  });
});

describe('the effective relief, kept between frames', () => {
  test('a camera move reuses it; a building moved flattens the ground at its new place', () => {
    const scene = createScene();
    const nx = 2 * HALF + 1, altitudes = [];
    for (let j = 0; j < nx; j++) for (let i = 0; i < nx; i++) altitudes.push(200 + 0.2 * i);
    const { relief } = reliefDepuisAltitudes({ x0: -HALF, z0: -HALF, pas: 1, nx, nz: nx, altitudes });
    const one = { ...content, relief, traces: [], elements: [], buildings: content.buildings.slice(0, 1) };
    const { page, panel } = layRealPlace(scene, one, { halfSize: HALF, newObject });
    const pg = { ...page, w: scene.w, h: scene.h, objects: page.objects };
    const b = page.objects.find(o => o.objType === 'batiment');
    const draw = () => drawPanelScene3D(document.createElement('canvas').getContext('2d'), panel, pg, scene.style3d);
    const heightAt = (x, z) => {
      let mesh = null;
      rig.personaScene3D.traverse(m => { if (m.isMesh && m.userData.relief && m.parent && m.parent.visible !== false) mesh = m; });
      const pos = mesh.geometry.attributes.position, k = Math.round(z + HALF) * nx + Math.round(x + HALF);
      return pos.getY(k);
    };
    draw();
    const flatHere = heightAt(b.wxFloor + 1, b.wzFloor), flatThere = heightAt(b.wxFloor - 1, b.wzFloor);
    assert.ok(Math.abs(flatHere - flatThere) < 1e-6, 'flattened under the building');
    panel.camRotY = 0.4; panel.camRotYTarget = 0.4;
    draw();
    assert.ok(heightAt(b.wxFloor + 1, b.wzFloor) === flatHere, 'the same after a camera move');
    const x0 = b.wxFloor;
    b.wxFloor += 30;
    draw();
    assert.ok(Math.abs(heightAt(x0 + 1, b.wzFloor) - heightAt(x0 - 1, b.wzFloor)) > 0.3, 'the old place: the slope again');
    assert.ok(Math.abs(heightAt(b.wxFloor + 1, b.wzFloor) - heightAt(b.wxFloor - 1, b.wzFloor)) < 1e-6, 'the new place: flattened');
  });
});

