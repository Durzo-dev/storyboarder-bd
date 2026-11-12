/**
 * tests/merge-meshes-3d.test.mjs: a building's pieces merged by material for display (src/merge-meshes-3d.js),
 * on a real building of Eguisheim (tests/fixtures/osm-eguisheim.json, © OpenStreetMap contributors, ODbL),
 * built for real with three.
 */
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../node_modules/three/build/three.module.js';
import { translateOsm } from '../src/osm-scene.js';
import { construireBatiment3D, materiauxBatiment3D } from '../src/batiment-3d.js';
import { mergeByMaterial3D } from '../src/merge-meshes-3d.js';

const v = JSON.parse(readFileSync(new URL('./fixtures/osm-eguisheim.json', import.meta.url), 'utf8'));
const centre = { lat: (v.bbox.sud + v.bbox.nord) / 2, lon: (v.bbox.ouest + v.bbox.est) / 2 };
const church = translateOsm(v, { centre, halfSize: 100 }).buildings.find(b => /Église/.test(b.building.nom)).building;
const mats = materiauxBatiment3D(THREE);

function measure(g){
  let meshes = 0, triangles = 0;
  const materials = new Set();
  g.updateMatrixWorld(true);
  g.traverse(m => {
    if (!m.isMesh || !m.visible) return;
    meshes++; materials.add(m.material);
    triangles += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  });
  return { meshes, triangles, materials, box: new THREE.Box3().setFromObject(g) };
}

describe('a building merged by material', () => {
  const before = measure(construireBatiment3D(THREE, church, mats));
  const g = construireBatiment3D(THREE, church, mats);
  const saved = mergeByMaterial3D(THREE, g);
  const after = measure(g);
  test('a few meshes instead of hundreds, one per material and kept piece', () => {
    assert.ok(before.meshes > 300, `${before.meshes} before`);
    assert.ok(after.meshes <= before.materials.size + 5, `${after.meshes} after, for ${before.materials.size} materials`);
    assert.equal(saved, before.meshes - after.meshes);
  });
  test('the same building: same triangles, same materials, same box', () => {
    assert.equal(after.triangles, before.triangles);
    assert.deepEqual([...after.materials].map(m => m.id).sort(), [...before.materials].map(m => m.id).sort());
    for (const k of ['x', 'y', 'z']) {
      assert.ok(Math.abs(after.box.min[k] - before.box.min[k]) < 1e-4 && Math.abs(after.box.max[k] - before.box.max[k]) < 1e-4, k);
    }
  });
  test('the groups left empty are gone', () => {
    let empty = 0;
    g.traverse(o => { if (o.type === 'Group' && o !== g && !o.children.length) empty++; });
    assert.equal(empty, 0);
  });
});

describe('what is not merged', () => {
  test('a mesh with userData, a render order, or a hidden ancestor stays as it is', () => {
    const root = new THREE.Group(), mat = new THREE.MeshStandardMaterial();
    const box = () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    const plain1 = box(), plain2 = box(), marked = box(), ordered = box(), hidden = new THREE.Group(), inHidden = box();
    plain2.position.x = 3; marked.userData.masqueDuSol = true; ordered.renderOrder = -1000; hidden.visible = false;
    hidden.add(inHidden);
    root.add(plain1, plain2, marked, ordered, hidden);
    assert.equal(mergeByMaterial3D(THREE, root), 1, 'the two plain boxes become one');
    assert.ok(root.children.includes(marked) && root.children.includes(ordered) && hidden.children.includes(inHidden));
  });
  test('a mirrored mesh keeps its faces turned outwards', () => {
    const root = new THREE.Group(), mat = new THREE.MeshStandardMaterial();
    const a = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat), b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    b.scale.x = -1;
    root.add(a, b);
    mergeByMaterial3D(THREE, root);
    const g = root.children[0].geometry, p = g.attributes.position, i = g.index;
    const normalOf = (t) => {
      const A = new THREE.Vector3().fromBufferAttribute(p, i.getX(t)), B = new THREE.Vector3().fromBufferAttribute(p, i.getX(t + 1)), C = new THREE.Vector3().fromBufferAttribute(p, i.getX(t + 2));
      return new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A)).z;
    };
    assert.ok(normalOf(0) > 0 && normalOf(6) > 0, 'both towards +z, as before the merge');
  });
});
