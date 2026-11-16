/**
 * src/vendor/ez-tree/ez-tree.js: EZ-TREE v1.1.0, THE TREE GENERATOR OF DAN GREENHECK (MIT, see LICENSE here),
 * copied into the application (#480g, asked by Durzo on 15 Nov. 2026) from `src/lib/` of
 * https://github.com/dgreenheck/ez-tree: rng.js, branch.js, enums.js, options.js and tree.js in one file.
 *
 * ADAPTED, and only so (the growth itself is untouched: a preset and a seed give the tree EZ-Tree draws):
 *   - three r128 of the application, as its global `THREE` (EZ-Tree asks three 0.167 or later as a peer: nothing
 *     it uses here is newer than r128);
 *   - no textures of its own (its `textures.js` and images left out): the caller puts the bark and the foliage
 *     on the two materials (src/tree-species.js);
 *   - no wind (the leaves' swaying shader, `update(time)`): a storyboard is still;
 *   - no trellis (a climbing plant on a grid);
 *   - indices in 32 bits when a tree passes 65 535 vertices (16 bits in EZ-Tree, which would wrap).
 * And TWO ADDITIONS OF OURS (#485, for the weeping trees), neutral by default (0: the tree EZ-Tree draws, its random
 * draws untouched), meant for a pull request to EZ-Tree:
 *   - `branch.droop[level]`: each section of a branch of that level turns that much (radians) toward the ground,
 *     whatever its radius (the growth force is divided by the radius: a trunk thick enough not to bend leaves its
 *     thin twigs bent the most, never hanging straight while the limbs only arch);
 *   - `leaves.hang` (0 to 1): a leaf turned that far from its twig's way toward hanging straight down (a willow's
 *     strands);
 *   - `fronds` (a palm's crown): `count` fronds grown from the top of the trunk, each a long strip ARCHING from its
 *     base (`rise`, degrees above level, from `riseMin` for the oldest to `riseMax` for the youngest) and bending
 *     down as it goes (`droop`, radians a segment); `length`, `width`, `segments`, ±`variance`; `turn`: the strip
 *     turned about its line (degrees: 0 lies flat, a pinnate frond; ~70 faces out, a fan); `cross`: a second
 *     strip across the first (volume seen edge on). They go in the leaves' mesh (its material, its drawn texture:
 *     the frond's base at the texture's bottom, its tip at its top). 0 fronds: none, no random draw.
 * A new version of EZ-Tree: see docs/en/tree-species.md (« EZ-Tree updates »).
 */


export const EZ_TREE_VERSION = '1.1.0';

class RNG {
  constructor(seed) {
    this.mask = 0xffffffff;
    this.m_w = (123456789 + seed) & this.mask;
    this.m_z = (987654321 - seed) & this.mask;
  }

  /** A random number between min and max. */
  random(max = 1, min = 0) {
    this.m_z = (36969 * (this.m_z & 65535) + (this.m_z >> 16)) & this.mask;
    this.m_w = (18000 * (this.m_w & 65535) + (this.m_w >> 16)) & this.mask;
    let result = ((this.m_z << 16) + (this.m_w & 65535)) >>> 0;
    result /= 4294967296;
    return (max - min) * result + min;
  }
}

class Branch {
  constructor(origin, orientation, length = 0, radius = 0, level = 0, sectionCount = 0, segmentCount = 0) {
    this.origin = origin.clone();
    this.orientation = orientation.clone();
    this.length = length;
    this.radius = radius;
    this.level = level;
    this.sectionCount = sectionCount;
    this.segmentCount = segmentCount;
  }
}

const Billboard = { Single: 'single', Double: 'double' };
const TreeType = { Deciduous: 'deciduous', Evergreen: 'evergreen' };

/** Ours (#485): the turn that points a section's (or a leaf's) +y straight down. */
const DOWN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);

/** The options of a tree (EZ-Tree's defaults); a preset is copied over them. */
export class TreeOptions {
  constructor() {
    this.seed = 0;
    this.type = TreeType.Deciduous;
    this.bark = { type: 'oak', tint: 0xffffff, flatShading: false, textured: true, textureScale: { x: 1, y: 1 } };
    this.branch = {
      levels: 3,
      angle: { 1: 70, 2: 60, 3: 60 },
      children: { 0: 7, 1: 7, 2: 5 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.01 },
      gnarliness: { 0: 0.15, 1: 0.2, 2: 0.3, 3: 0.02 },
      length: { 0: 20, 1: 20, 2: 10, 3: 1 },
      radius: { 0: 1.5, 1: 0.7, 2: 0.7, 3: 0.7 },
      sections: { 0: 12, 1: 10, 2: 8, 3: 6 },
      segments: { 0: 8, 1: 6, 2: 4, 3: 3 },
      start: { 1: 0.4, 2: 0.3, 3: 0.3 },
      taper: { 0: 0.7, 1: 0.7, 2: 0.7, 3: 0.7 },
      twist: { 0: 0, 1: 0, 2: 0, 3: 0 },
      droop: { 0: 0, 1: 0, 2: 0, 3: 0 },
    };
    this.leaves = {
      type: 'oak', billboard: Billboard.Double, angle: 10, count: 1, start: 0, size: 2.5, sizeVariance: 0.7,
      tint: 0xffffff, alphaTest: 0.5, hang: 0,
    };
    this.fronds = { count: 0, length: 10, width: 2.5, riseMin: -20, riseMax: 70, droop: 0.08, segments: 8, variance: 0.15, turn: 0, cross: true };
    this.trellis = { enabled: false };
  }

  /** Copies the values of `source` into this object (only the keys it has). */
  copy(source, target = this) {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key) && Object.prototype.hasOwnProperty.call(target, key)) {
        if (typeof source[key] === 'object' && source[key] !== null) this.copy(source[key], target[key]);
        else target[key] = source[key];
      }
    }
  }
}

/** A tree: a group of two meshes, its branches and its leaves. */
export class Tree extends THREE.Group {
  constructor(options = new TreeOptions()) {
    super();
    this.name = 'Tree';
    this.branchQueue = [];
    this.branchesMesh = new THREE.Mesh();
    this.leavesMesh = new THREE.Mesh();
    this.add(this.branchesMesh);
    this.add(this.leavesMesh);
    this.options = options;
  }

  /** Copies options (a preset) over the tree's and generates it. */
  loadFromJson(json) {
    this.options.copy(json);
    this.generate();
  }

  /** Generates the tree anew. */
  generate() {
    this.branches = { verts: [], normals: [], indices: [], uvs: [] };
    this.leaves = { verts: [], normals: [], indices: [], uvs: [] };
    this.rng = new RNG(this.options.seed);

    // The trunk first
    this.branchQueue.push(new Branch(new THREE.Vector3(), new THREE.Euler(), this.options.branch.length[0],
      this.options.branch.radius[0], 0, this.options.branch.sections[0], this.options.branch.segments[0]));

    while (this.branchQueue.length > 0) this.generateBranch(this.branchQueue.shift());

    this.createBranchesGeometry();
    this.createLeavesGeometry();
  }

  generateBranch(branch) {
    const indexOffset = this.branches.verts.length / 3;
    const o = this.options;

    const sectionOrientation = branch.orientation.clone();
    const sectionOrigin = branch.origin.clone();
    // EZ-Tree compares with 'Deciduous' (capital D) here, never true: kept, so the trees stay EZ-Tree's.
    const sectionLength = branch.length / branch.sectionCount / (o.type === 'Deciduous' ? o.branch.levels - 1 : 1);

    const sections = [];

    for (let i = 0; i <= branch.sectionCount; i++) {
      let sectionRadius = branch.radius;

      // Final section of the final level: a radius of nearly zero
      if (i === branch.sectionCount && branch.level === o.branch.levels) {
        sectionRadius = 0.001;
      } else if (o.type === TreeType.Deciduous) {
        sectionRadius *= 1 - o.branch.taper[branch.level] * (i / branch.sectionCount);
      } else if (o.type === TreeType.Evergreen) {
        // Evergreens have no terminal branch: a taper of 1
        sectionRadius *= 1 - (i / branch.sectionCount);
      }

      // The segments of this section
      let first;
      for (let j = 0; j < branch.segmentCount; j++) {
        const angle = (2.0 * Math.PI * j) / branch.segmentCount;
        const vertex = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
          .multiplyScalar(sectionRadius).applyEuler(sectionOrientation).add(sectionOrigin);
        const normal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).applyEuler(sectionOrientation).normalize();
        const uv = new THREE.Vector2(j / branch.segmentCount, (i % 2 === 0) ? 0 : 1);

        this.branches.verts.push(vertex.x, vertex.y, vertex.z);
        this.branches.normals.push(normal.x, normal.y, normal.z);
        this.branches.uvs.push(uv.x, uv.y);
        if (j === 0) first = { vertex, normal, uv };
      }

      // The first vertex again, for a continuous UV mapping
      this.branches.verts.push(first.vertex.x, first.vertex.y, first.vertex.z);
      this.branches.normals.push(first.normal.x, first.normal.y, first.normal.z);
      this.branches.uvs.push(1, first.uv.y);

      sections.push({ origin: sectionOrigin.clone(), orientation: sectionOrientation.clone(), radius: sectionRadius });

      sectionOrigin.add(new THREE.Vector3(0, sectionLength, 0).applyEuler(sectionOrientation));

      // A random turn of the next section: the more gnarled, the larger
      const gnarliness = Math.max(1, 1 / Math.sqrt(sectionRadius)) * o.branch.gnarliness[branch.level];
      sectionOrientation.x += this.rng.random(gnarliness, -gnarliness);
      sectionOrientation.z += this.rng.random(gnarliness, -gnarliness);

      // The growth force
      const qSection = new THREE.Quaternion().setFromEuler(sectionOrientation);
      const qTwist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.branch.twist[branch.level]);
      const qForce = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0),
        new THREE.Vector3().copy(o.branch.force.direction));
      qSection.multiply(qTwist);
      qSection.rotateTowards(qForce, o.branch.force.strength / sectionRadius);
      // Ours (#485): the droop of this level, the same for a thick limb as for a thin twig.
      const droop = o.branch.droop[branch.level] || 0;
      if (droop > 0) qSection.rotateTowards(DOWN, droop);

      sectionOrientation.setFromQuaternion(qSection);
    }

    this.generateBranchIndices(indexOffset, branch);

    // Ours (#485): a palm's fronds, at the top of its trunk.
    const palm = branch.level === 0 && o.fronds.count > 0;
    if (palm) this.generateFronds(sections[sections.length - 1]);

    // Deciduous trees: a terminal branch growing out of the end of its parent
    if (o.type === 'deciduous') {
      const lastSection = sections[sections.length - 1];
      if (branch.level < o.branch.levels) {
        this.branchQueue.push(new Branch(lastSection.origin, lastSection.orientation, o.branch.length[branch.level + 1],
          lastSection.radius, branch.level + 1, branch.sectionCount, branch.segmentCount));
      } else if (!palm) {
        this.generateLeaf(lastSection.origin, lastSection.orientation);
      }
    }

    if (branch.level === o.branch.levels) this.generateLeaves(sections);
    else if (branch.level < o.branch.levels) this.generateChildBranches(o.branch.children[branch.level], branch.level + 1, sections);
  }

  /** Where, on a parent's sections, a child starts (0 to 1): its origin, orientation and the radius there. */
  sectionAt(sections, start) {
    const sectionIndex = Math.floor(start * (sections.length - 1));
    const sectionA = sections[sectionIndex];
    const sectionB = sectionIndex === sections.length - 1 ? sectionA : sections[sectionIndex + 1];
    const alpha = (start - sectionIndex / (sections.length - 1)) / (1 / (sections.length - 1));
    const origin = new THREE.Vector3().lerpVectors(sectionA.origin, sectionB.origin, alpha);
    const qA = new THREE.Quaternion().setFromEuler(sectionA.orientation);
    const qB = new THREE.Quaternion().setFromEuler(sectionB.orientation);
    const orientation = new THREE.Euler().setFromQuaternion(qB.slerp(qA, alpha));
    return { origin, orientation, radius: (1 - alpha) * sectionA.radius + alpha * sectionB.radius };
  }

  /** The orientation of a child at `angle` (degrees) from its parent, turned `radialAngle` around it. */
  static childOrientation(parentOrientation, angle, radialAngle) {
    const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle / (180 / Math.PI));
    const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), radialAngle);
    const q3 = new THREE.Quaternion().setFromEuler(parentOrientation);
    return new THREE.Euler().setFromQuaternion(q3.multiply(q2.multiply(q1)));
  }

  generateChildBranches(count, level, sections) {
    const o = this.options;
    const radialOffset = this.rng.random();
    for (let i = 0; i < count; i++) {
      const childBranchStart = this.rng.random(1.0, o.branch.start[level]);
      const at = this.sectionAt(sections, childBranchStart);
      const radialAngle = 2.0 * Math.PI * (radialOffset + i / count);
      const orientation = Tree.childOrientation(at.orientation, o.branch.angle[level], radialAngle);
      const length = o.branch.length[level] * (o.type === TreeType.Evergreen ? 1.0 - childBranchStart : 1.0);
      this.branchQueue.push(new Branch(at.origin, orientation, length, o.branch.radius[level] * at.radius, level,
        o.branch.sections[level], o.branch.segments[level]));
    }
  }

  generateLeaves(sections) {
    const o = this.options;
    const radialOffset = this.rng.random();
    for (let i = 0; i < o.leaves.count; i++) {
      const leafStart = this.rng.random(1.0, o.leaves.start);
      const at = this.sectionAt(sections, leafStart);
      const radialAngle = 2.0 * Math.PI * (radialOffset + i / o.leaves.count);
      let orientation = Tree.childOrientation(at.orientation, o.leaves.angle, radialAngle);
      // Ours (#485): a leaf turned toward hanging straight down, its own turn about the vertical kept.
      if (o.leaves.hang > 0) {
        const hanging = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), radialAngle).premultiply(DOWN);
        orientation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromEuler(orientation).slerp(hanging, o.leaves.hang));
      }
      this.generateLeaf(at.origin, orientation);
    }
  }

  /**
   * Ours (#485): a palm's crown, around the top of its trunk (`top`: its last section). The fronds go round by the
   * golden angle, the youngest standing up, the oldest hanging: each a strip of `segments` quads along an arching
   * line, its texture's v from its base (0) to its tip (1).
   */
  generateFronds(top) {
    const f = this.options.fronds;
    const up = new THREE.Vector3(0, 1, 0);
    const axis = up.clone().applyEuler(top.orientation);
    for (let i = 0; i < f.count; i++) {
      const age = this.rng.random();
      const turn = i * 2.39996 + this.rng.random(0.3, -0.3);
      const rise = THREE.MathUtils.degToRad(f.riseMax + (f.riseMin - f.riseMax) * age + this.rng.random(8, -8));
      const length = f.length * (1 + this.rng.random(f.variance, -f.variance));
      const out = new THREE.Vector3(Math.cos(turn), 0, Math.sin(turn));
      const dir = out.clone().multiplyScalar(Math.cos(rise)).addScaledVector(up, Math.sin(rise)).normalize();
      const side = new THREE.Vector3().crossVectors(dir, up).normalize();
      if (side.lengthSq() < 1e-6) side.set(-Math.sin(turn), 0, Math.cos(turn));
      const spine = [top.origin.clone().addScaledVector(out, top.radius * 0.6).addScaledVector(axis, -top.radius * 0.3)];
      const step = length / f.segments;
      for (let k = 0; k < f.segments; k++) {
        const p = spine[k].clone().addScaledVector(dir, step);
        spine.push(p);
        dir.applyAxisAngle(side, -f.droop).normalize();
      }
      const along = spine[spine.length - 1].clone().sub(spine[0]).normalize();
      const face = side.clone().applyAxisAngle(along, THREE.MathUtils.degToRad(f.turn));
      this.frondStrip(spine, face, f.width);
      // Across the first: turned a quarter round about the line from the spine's start to its end.
      if (f.cross) this.frondStrip(spine, face.clone().applyAxisAngle(along, Math.PI / 2), f.width * 0.8);
    }
  }

  /** Ours (#485): a strip along `spine` (points), `width` wide across `side`, its v from 0 at its base to 1. */
  frondStrip(spine, side, width) {
    const i = this.leaves.verts.length / 3;
    const n = spine.length - 1;
    for (let k = 0; k <= n; k++) {
      const a = spine[k].clone().addScaledVector(side, -width / 2), b = spine[k].clone().addScaledVector(side, width / 2);
      const along = spine[Math.min(k + 1, n)].clone().sub(spine[Math.max(k - 1, 0)]).normalize();
      const normal = new THREE.Vector3().crossVectors(side, along).normalize();
      this.leaves.verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      this.leaves.normals.push(normal.x, normal.y, normal.z, normal.x, normal.y, normal.z);
      this.leaves.uvs.push(0, k / n, 1, k / n);
    }
    for (let k = 0; k < n; k++) {
      const a = i + 2 * k;
      this.leaves.indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }

  /** A leaf: one quad, or two crossed (« double » billboard). */
  generateLeaf(origin, orientation) {
    let i = this.leaves.verts.length / 3;
    const leafSize = this.options.leaves.size *
      (1 + this.rng.random(this.options.leaves.sizeVariance, -this.options.leaves.sizeVariance));
    const W = leafSize;
    const L = leafSize;

    const createLeaf = (rotation) => {
      const v = [
        new THREE.Vector3(-W / 2, L, 0),
        new THREE.Vector3(-W / 2, 0, 0),
        new THREE.Vector3(W / 2, 0, 0),
        new THREE.Vector3(W / 2, L, 0),
      ].map((p) => p.applyEuler(new THREE.Euler(0, rotation, 0)).applyEuler(orientation).add(origin));
      for (const p of v) this.leaves.verts.push(p.x, p.y, p.z);
      const n = new THREE.Vector3(0, 0, 1).applyEuler(orientation);
      for (let k = 0; k < 4; k++) this.leaves.normals.push(n.x, n.y, n.z);
      this.leaves.uvs.push(0, 1, 0, 0, 1, 0, 1, 1);
      this.leaves.indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
      i += 4;
    };

    createLeaf(0);
    if (this.options.leaves.billboard === Billboard.Double) createLeaf(Math.PI / 2);
  }

  /** The faces of a branch (a cylinder without end caps). */
  generateBranchIndices(indexOffset, branch) {
    const N = branch.segmentCount + 1;
    for (let i = 0; i < branch.sectionCount; i++) {
      for (let j = 0; j < branch.segmentCount; j++) {
        const v1 = indexOffset + i * N + j;
        const v2 = indexOffset + i * N + (j + 1);
        const v3 = v1 + N;
        const v4 = v2 + N;
        this.branches.indices.push(v1, v3, v2, v2, v3, v4);
      }
    }
  }

  static indexOf(indices, vertexCount) {
    const Type = vertexCount > 65535 ? Uint32Array : Uint16Array;
    return new THREE.BufferAttribute(new Type(indices), 1);
  }

  createBranchesGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.branches.verts), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.branches.normals), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.branches.uvs), 2));
    g.setIndex(Tree.indexOf(this.branches.indices, this.branches.verts.length / 3));
    g.computeBoundingSphere();
    const mat = new THREE.MeshPhongMaterial({
      name: 'branches',
      flatShading: this.options.bark.flatShading,
      color: new THREE.Color(this.options.bark.tint),
    });
    this.branchesMesh.geometry.dispose();
    this.branchesMesh.geometry = g;
    this.branchesMesh.material.dispose();
    this.branchesMesh.material = mat;
    this.branchesMesh.castShadow = true;
    this.branchesMesh.receiveShadow = true;
  }

  createLeavesGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.leaves.verts), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.leaves.uvs), 2));
    g.setIndex(Tree.indexOf(this.leaves.indices, this.leaves.verts.length / 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const mat = new THREE.MeshPhongMaterial({
      name: 'leaves',
      color: new THREE.Color(this.options.leaves.tint),
      side: THREE.DoubleSide,
      alphaTest: this.options.leaves.alphaTest,
      dithering: true,
    });
    this.leavesMesh.geometry.dispose();
    this.leavesMesh.geometry = g;
    this.leavesMesh.material.dispose();
    this.leavesMesh.material = mat;
    this.leavesMesh.castShadow = true;
    this.leavesMesh.receiveShadow = true;
  }

  get vertexCount() {
    return (this.branches.verts.length + this.leaves.verts.length) / 3;
  }

  get triangleCount() {
    return (this.branches.indices.length + this.leaves.indices.length) / 3;
  }
}
