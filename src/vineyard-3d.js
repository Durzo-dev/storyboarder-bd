/**
 * src/vineyard-3d.js: A VINEYARD DRAWN (#481b): its stocks (vineyard.js) as copies of a few built vines, one
 * InstancedMesh a vine's part (wood, leaves) and variant, its posts as copies of one post, its wires as lines:
 * thousands of stocks in a few draws.
 *
 * A stock is BUILT here, as a vineyard's is trained (cordon de Royat, the commonest in France): a short twisted
 * trunk, two arms along the row's wire, shoots rising from them, held up by the wires into a narrow wall of leaves.
 * EZ-Tree grows trees from a trunk out (its branches spread round it): it could not lay two arms along a wire. Its
 * materials are the « Vigne » species' (src/tree-species.js: bark and leaves drawn there, the leaves cut out).
 * Geometries and materials are SHARED by every vineyard (`userData.shared`): never disposed with a Zone (scene3d.js).
 */
import { generateSpeciesTree } from './ez-trees.js';
import { VARIANTS } from './tree-species.js';
import { vineStocks, vineRuns } from './vineyard.js';

/** The wires' heights (m): the fruiting wire (the arms on it), then the two that hold the shoots. */
export const VINE_WIRES = [0.6, 1.0, 1.4];

/** A number in [0, 1) from a seed and an index. */
function rnd(seed, i) {
  let h = Math.imul(seed | 0, 374761393) ^ Math.imul(i | 0, 668265263) ^ 0x2c1b3c6d;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * A stock's geometry (metres, its foot at the origin, its row along x): { wood, leaves } as plain arrays
 * ({ position, uv, index }). PURE (no THREE): tested without a renderer.
 */
export function buildVineStock(variant = 1) {
  const wood = { position: [], uv: [], index: [] }, leaves = { position: [], uv: [], index: [] };
  let n = 0;
  const r = () => rnd(variant * 7919, n++);
  // A tube along points, `sides` round, its radius from r0 to r1; u round it, v along it (metres).
  const tube = (pts, r0, r1, sides = 4) => {
    const base = wood.position.length / 3;
    let len = 0;
    pts.forEach((p, i) => {
      if (i) len += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1], p[2] - pts[i - 1][2]);
      const t = i / (pts.length - 1), rad = r0 + (r1 - r0) * t;
      // The ring's frame: perpendicular to the segment.
      const q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
      let dx = q[0] - o[0], dy = q[1] - o[1], dz = q[2] - o[2]; const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
      const ax = Math.abs(dy) < 0.9 ? 0 : 1, ay = Math.abs(dy) < 0.9 ? 1 : 0, az = 0;
      let bx = dy * az - dz * ay, by = dz * ax - dx * az, bz = dx * ay - dy * ax; const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
      const cx = dy * bz - dz * by, cy = dz * bx - dx * bz, cz = dx * by - dy * bx;
      for (let s = 0; s <= sides; s++) {
        const a = (s / sides) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        wood.position.push(p[0] + rad * (ca * bx + sa * cx), p[1] + rad * (ca * by + sa * cy), p[2] + rad * (ca * bz + sa * cz));
        wood.uv.push(s / sides, len * 2);
      }
    });
    for (let i = 0; i + 1 < pts.length; i++) for (let s = 0; s < sides; s++) {
      const a = base + i * (sides + 1) + s, b = a + sides + 1;
      wood.index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  };
  // A leaf card: a square of side `size` centred at c, turned `yaw` round the vertical, tipped `tilt` forward.
  const card = (c, size, yaw, tilt) => {
    const base = leaves.position.length / 3;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const lx = (u - 0.5) * size, ly = (v - 0.5) * size;
      // In the card's plane (x right, y up), tipped round x, then turned round y.
      const px = lx, py = ly * ct, pz = ly * st;
      leaves.position.push(c[0] + px * cy + pz * sy, c[1] + py, c[2] - px * sy + pz * cy);
      leaves.uv.push(u, v);
    }
    leaves.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  // The trunk: up to the fruiting wire, twisted.
  const top = VINE_WIRES[0] - 0.04 + r() * 0.06;
  const trunk = [[0, 0, 0]];
  for (let k = 1; k <= 4; k++) trunk.push([(r() - 0.5) * 0.06, top * k / 4, (r() - 0.5) * 0.06]);
  tube(trunk, 0.045, 0.03, 5);
  const head = trunk[trunk.length - 1];
  // The two arms along the wire (x), half a place each, sagging a little; shoots rising from their spurs.
  for (const side of [-1, 1]) {
    const len = 0.5 + r() * 0.08;
    const arm = [head, [side * len * 0.35, VINE_WIRES[0] + 0.01, (r() - 0.5) * 0.03], [side * len, VINE_WIRES[0] - 0.01, (r() - 0.5) * 0.03]];
    tube(arm, 0.025, 0.016, 4);
    for (let k = 0; k < 4; k++) {
      const t = 0.18 + 0.24 * k + r() * 0.08, x = side * len * t, z = (r() - 0.5) * 0.04;
      // A shoot up between the wires, leaning a little out of the row's plane.
      const lean = (r() - 0.5) * 0.12, tip = 1.45 + r() * 0.25;
      tube([[x, VINE_WIRES[0], z], [x + (r() - 0.5) * 0.05, (VINE_WIRES[0] + tip) / 2, z + lean / 2], [x + (r() - 0.5) * 0.08, tip, z + lean]], 0.009, 0.005, 3);
      // Its leaves: cards along it, facing out of the row on either side, turned and tipped at random.
      for (let j = 0; j < 6; j++) {
        const y = VINE_WIRES[0] + 0.08 + (tip - VINE_WIRES[0] - 0.05) * (j + 0.5) / 6;
        const out = (j % 2 ? 1 : -1) * (0.05 + r() * 0.06);
        card([x + (r() - 0.5) * 0.12, y, z + lean * (y - VINE_WIRES[0]) / (tip - VINE_WIRES[0]) + out],
          0.38 + r() * 0.1, (r() - 0.5) * 1.6, (r() - 0.5) * 0.8);
      }
    }
  }
  return { wood, leaves };
}

/** Its geometries and the species' materials, built once per variant. */
const models = new Map();
let materials = null, postGeometry = null, postMaterial = null, wireMaterial = null;
function vineMaterials() {
  if (!materials) {
    // The species' bark and leaves, as EZ-Tree sets them (the bark shipped, the leaves cut out).
    const tree = generateSpeciesTree('Vigne', 1, { lods: null });
    materials = { wood: tree.branchesMesh.material, leaves: tree.leavesMesh.material };
    materials.leaves.side = THREE.DoubleSide;
    // Seen from afar, a card's mipmaps average its leaves with the gaps between them: under EZ-Tree's alphaTest (0.5)
    // whole rows of leaves vanished, the vineyard a field of fences (seen from 260 m on 17 Nov. 2026). A lower
    // threshold keeps the wall of leaves; this material is the vineyard's own (the tree was generated for it).
    materials.leaves.alphaTest = 0.2;
  }
  return materials;
}
function geometryOf(part) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(part.position, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2));
  g.setIndex(part.index);
  g.computeVertexNormals();
  return g;
}
function vineModel(variant) {
  if (!models.has(variant)) {
    const built = buildVineStock(variant);
    models.set(variant, { wood: geometryOf(built.wood), leaves: geometryOf(built.leaves) });
  }
  return models.get(variant);
}

/**
 * The vineyard of a Zone (`o.vines`, its mask `o.world.masque`), the ground's height at (x, z) given by `heightAt`,
 * no stock where `avoid(x, z)` (the Traces across it, vineyard.js onTraces): a Group (stocks, posts, wires), or null.
 */
export function vineyard3D(o, heightAt = () => 0, { avoid = null } = {}) {
  const masque = o && o.world && o.world.masque;
  const stocks = vineStocks(masque, o.vines || {}, { variants: VARIANTS, avoid });
  if (!stocks.length) return null;
  const group = new THREE.Group();
  group.userData.vineyard = stocks.length;
  const mats = vineMaterials();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const shared = (mesh) => { mesh.frustumCulled = false; mesh.userData.shared = true; group.add(mesh); };
  for (let v = 1; v <= VARIANTS; v++) {
    const list = stocks.filter(st => st.variant === v);
    if (!list.length) continue;
    const model = vineModel(v);
    for (const [geometry, material] of [[model.wood, mats.wood], [model.leaves, mats.leaves]]) {
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      list.forEach((st, i) => {
        q.setFromAxisAngle(up, st.rotY);
        s.set(st.scale, 0.9 + 0.1 * st.scale, 1);
        p.set(st.x, heightAt(st.x, st.z), st.z);
        mesh.setMatrixAt(i, m.compose(p, q, s));
      });
      mesh.instanceMatrix.needsUpdate = true;
      // The template's bounds are one stock's: culled by them, the whole vineyard would vanish off its corner.
      shared(mesh);
    }
  }
  // The posts (weathered wood, 1.6 m) and the wires between the end ones.
  const { runs, posts } = vineRuns(stocks);
  if (posts.length) {
    if (!postGeometry) {
      postGeometry = new THREE.BoxGeometry(0.06, 1.65, 0.06); postGeometry.translate(0, 1.65 / 2 - 0.05, 0);
      postMaterial = new THREE.MeshStandardMaterial({ color: 0x7c705f, roughness: 0.95, metalness: 0 });
      wireMaterial = new THREE.LineBasicMaterial({ color: 0x8a8a86 });
    }
    const mesh = new THREE.InstancedMesh(postGeometry, postMaterial, posts.length);
    posts.forEach((pt, i) => { m.makeTranslation(pt.x, heightAt(pt.x, pt.z), pt.z); mesh.setMatrixAt(i, m); });
    mesh.instanceMatrix.needsUpdate = true;
    shared(mesh);
    // The wires follow the ground between a run's ends at a few points (a vineyard on a slope).
    const seg = [];
    for (const { a, b } of runs) {
      const L = Math.hypot(b.x - a.x, b.z - a.z), k = Math.max(1, Math.ceil(L / 4));
      for (const hw of VINE_WIRES) {
        for (let i = 0; i < k; i++) {
          const t0 = i / k, t1 = (i + 1) / k;
          const x0 = a.x + (b.x - a.x) * t0, z0 = a.z + (b.z - a.z) * t0, x1 = a.x + (b.x - a.x) * t1, z1 = a.z + (b.z - a.z) * t1;
          seg.push(x0, heightAt(x0, z0) + hw, z0, x1, heightAt(x1, z1) + hw, z1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    // Its own geometry, disposed with the Zone; the wire's material shared.
    group.add(new THREE.LineSegments(g, wireMaterial));
  }
  return group;
}
