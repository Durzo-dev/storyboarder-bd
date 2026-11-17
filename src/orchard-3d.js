/**
 * src/orchard-3d.js: AN ORCHARD DRAWN (#481): its trees in rows (vineyard.js's rows, the orchard's spacing) as copies
 * of a few LIGHT variants of its species (ez-trees.js `light`: about 1 500 triangles for an apple tree, against
 * 12 000), one InstancedMesh a part (bark, leaves) and variant: hundreds of trees in a few draws, where Elements
 * (one each, with their levels of detail) held a Scene to 350 trees and scattered the orchards' rows.
 *
 * An orchard is a Zone with `orchard` ({ angle, essence, gap, step, height }: farm-plots.js, osm-scene.js). Its trees
 * are not Elements. Geometries and materials are SHARED by every orchard of a species (`userData.shared`): never
 * disposed with a Zone (scene3d.js).
 */
import { generateSpeciesTree } from './ez-trees.js';
import { SPECIES, VARIANTS } from './tree-species.js';
import { vineStocks } from './vineyard.js';

/** At most this many trees an orchard Zone (the step along the rows widened beyond). */
export const MAX_ORCHARD_TREES = 1500;

/** A number in [0, 1) from integers and a salt. */
function hash(i, j, salt) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The trees of an orchard Zone: its rows, `gap` apart, a tree every `step`; on its cells, off `avoid`. PURE. */
export function orchardTrees(o, { avoid = null, max = MAX_ORCHARD_TREES } = {}) {
  const or = o && o.orchard;
  if (!or || !SPECIES[or.essence]) return [];
  return vineStocks(o.world && o.world.masque, { angle: or.angle || 0, gap: or.gap || 5, step: or.step || 4 }, { max, avoid, variants: VARIANTS })
    .map(t => ({ ...t, rotY: Math.round(hash(t.row, t.col, 0x3c6e) * Math.PI * 2 * 1000) / 1000 }));
}

/** A species' light variant generated once: its parts, its height and foot (EZ-Tree's units). */
const models = new Map();
function treeModel(essence, variant) {
  const key = `${essence}|${variant}`;
  if (!models.has(key)) {
    const tree = generateSpeciesTree(essence, variant, { lods: null, light: true });
    tree.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(tree);
    const parts = [];
    tree.traverse(m => { if (m.isMesh) parts.push({ geometry: m.geometry, material: m.material, matrix: m.matrixWorld.clone() }); });
    models.set(key, { parts, height: box.max.y - box.min.y, foot: box.min.y });
  }
  return models.get(key);
}

/**
 * The orchard of a Zone, the ground's height at (x, z) given by `heightAt`, no tree where `avoid(x, z)`: a Group of
 * InstancedMeshes, or null (no tree).
 */
export function orchard3D(o, heightAt = () => 0, { avoid = null } = {}) {
  const trees = orchardTrees(o, { avoid });
  if (!trees.length) return null;
  const { essence } = o.orchard;
  const metres = o.orchard.height > 0 ? o.orchard.height : SPECIES[essence].height;
  const group = new THREE.Group();
  group.userData.orchard = trees.length;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let v = 1; v <= VARIANTS; v++) {
    const list = trees.filter(t => t.variant === v);
    if (!list.length) continue;
    const model = treeModel(essence, v);
    const k = metres / model.height;
    for (const part of model.parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      list.forEach((t, i) => {
        const kk = k * t.scale;
        q.setFromAxisAngle(up, t.rotY);
        s.set(kk, kk, kk);
        p.set(t.x, heightAt(t.x, t.z) - model.foot * kk, t.z);
        mesh.setMatrixAt(i, m.compose(p, q, s).multiply(part.matrix));
      });
      mesh.instanceMatrix.needsUpdate = true;
      // The template's bounds are one tree's: culled by them, the whole orchard would vanish off its corner.
      mesh.frustumCulled = false;
      mesh.userData.shared = true;
      group.add(mesh);
    }
  }
  return group;
}
