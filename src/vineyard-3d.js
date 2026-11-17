/**
 * src/vineyard-3d.js: A VINEYARD DRAWN (#481b): its stocks (vineyard.js) as copies of a few generated vines, one
 * InstancedMesh a vine's part (bark, leaves) and variant: thousands of stocks in six draws.
 *
 * The vines are EZ-Tree's (src/tree-species.js, « Vigne »), generated once each, without levels of detail (a few
 * hundred triangles each). Their geometries and materials are SHARED by every vineyard: the meshes carry
 * `userData.shared`, and whoever drops a vineyard must not dispose them (scene3d.js).
 */
import { generateSpeciesTree } from './ez-trees.js';
import { SPECIES, VARIANTS } from './tree-species.js';
import { vineStocks } from './vineyard.js';

/** A vine generated once: its parts (geometry, material), its height and its foot (EZ-Tree's units). */
const models = new Map();
function vineModel(variant) {
  if (!models.has(variant)) {
    const tree = generateSpeciesTree('Vigne', variant, { lods: null });
    tree.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(tree);
    const parts = [];
    tree.traverse(o => { if (o.isMesh) parts.push({ geometry: o.geometry, material: o.material }); });
    models.set(variant, { parts, height: box.max.y - box.min.y, foot: box.min.y });
  }
  return models.get(variant);
}

/**
 * The vineyard of a Zone (`o.vines`, its mask `o.world.masque`), the ground's height at (x, z) given by `heightAt`:
 * a Group of InstancedMeshes, or null (no stock).
 */
export function vineyard3D(o, heightAt = () => 0) {
  const masque = o && o.world && o.world.masque;
  const stocks = vineStocks(masque, o.vines || {}, { variants: VARIANTS });
  if (!stocks.length) return null;
  const group = new THREE.Group();
  group.userData.vineyard = stocks.length;
  const metres = SPECIES.Vigne.height;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let v = 1; v <= VARIANTS; v++) {
    const list = stocks.filter(st => st.variant === v);
    if (!list.length) continue;
    const model = vineModel(v);
    const k = metres / model.height;
    for (const part of model.parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      list.forEach((st, i) => {
        const kk = k * st.scale;
        q.setFromAxisAngle(up, st.rotY);
        s.set(kk, kk, kk);
        p.set(st.x, heightAt(st.x, st.z) - model.foot * kk, st.z);
        mesh.setMatrixAt(i, m.compose(p, q, s));
      });
      mesh.instanceMatrix.needsUpdate = true;
      // The template's bounds are one vine's: culled by them, the whole vineyard would vanish off its corner.
      mesh.frustumCulled = false;
      mesh.userData.shared = true;
      group.add(mesh);
    }
  }
  return group;
}
