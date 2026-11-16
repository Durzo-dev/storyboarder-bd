/**
 * src/vendor/ez-tree/ez-tree.js: EZ-TREE v2.0.0, THE TREE GENERATOR OF DAN GREENHECK (MIT, see LICENSE here),
 * copied into the application (#480g, asked by Durzo on 15 Nov. 2026; v2.0.0 since #488) from `src/lib/` of
 * https://github.com/dgreenheck/ez-tree: rng.js, branch.js, enums.js, options.js and tree.js in one file.
 *
 * ADAPTED, and only so (the growth itself is untouched: a preset and a seed give the tree EZ-Tree draws):
 *   - three r128 of the application, as its global `THREE` (EZ-Tree asks three 0.167 or later as a peer: nothing
 *     it uses here is newer than r128; the rounded leaf normals' shader line is r128's, see #createLeafMaterial);
 *   - no wind (the leaves' swaying shader, `update(time)`): a storyboard is still;
 *   - no trellis (a climbing plant on a grid), no preset loading by name (presets.js: the caller copies one);
 *   - indices in 32 bits when a tree passes 65 535 vertices (16 bits in EZ-Tree, which would wrap).
 * And ADDITIONS OF OURS (#485, for the weeping trees and the palms), marked « Ours (#485) », neutral by default (the
 * tree EZ-Tree draws, its random draws untouched), meant for a pull request to EZ-Tree:
 *   - `branch.droop[level]`: each section of a branch of that level turns that much (radians) toward the ground,
 *     whatever its radius (the growth force is divided by the radius: a trunk thick enough not to bend leaves its
 *     thin twigs bent the most, never hanging straight while the limbs only arch);
 *   - `branch.terminal`: the length of the branch a deciduous tree grows on from the end of each branch (its
 *     leader), as a share of its level's length (1: EZ-Tree's);
 *   - `leaves.hang` (0 to 1): a leaf turned that far from its twig's way toward hanging straight down (a willow's
 *     strands);
 *   - `fronds` (a palm's crown): `count` fronds grown from inside the top of a trunk with no point, each a long
 *     strip ARCHING from its base (`rise`, degrees above level, from `riseMin` for the oldest to `riseMax` for the
 *     youngest) and bending down as it goes (`droop`, radians a segment); `length`, `width`, `segments`,
 *     ±`variance`; `turn`: the strip turned about its line (degrees: 0 lies flat, a pinnate frond; ~70 faces out, a
 *     fan); `fold`: a V along its middle; `boots`: that many old leaf bases round the trunk's top, `bootLength` of a
 *     frond, down `bootDepth` radii; `cross`: a second strip across the first. Grown in the skeleton, meshed in the
 *     leaves' mesh (its material, its drawn texture: the frond's base at the texture's bottom, its tip at its top),
 *     whole at every level of detail. 0 fronds: none, no random draw.
 * A new version of EZ-Tree: see docs/en/tree-species.md (« EZ-Tree updates »).
 */

export const EZ_TREE_VERSION = '2.0.0';

/** Ours (#485): the turn that points a section's (or a leaf's) +y straight down. */
const DOWN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);

class RNG {
  m_w = 123456789;
  m_z = 987654321;
  mask = 0xffffffff;

  constructor(seed) {
    this.m_w = (123456789 + seed) & this.mask;
    this.m_z = (987654321 - seed) & this.mask;
  }

  /**
   * Returns a random number between min and max
   */
  random(max = 1, min = 0) {
    this.m_z = (36969 * (this.m_z & 65535) + (this.m_z >> 16)) & this.mask;
    this.m_w = (18000 * (this.m_w & 65535) + (this.m_w >> 16)) & this.mask;
    let result = ((this.m_z << 16) + (this.m_w & 65535)) >>> 0;
    result /= 4294967296;

    return (max - min) * result + min;
  }
}

class Branch {
  /**
   * Generates a new branch
   * @param {THREE.Vector3} origin The starting point of the branch
   * @param {THREE.Euler} orientation The starting orientation of the branch
   * @param {number} length The length of the branch
   * @param {number} radius The radius of the branch at its starting point
   */
  constructor(
    origin = new THREE.Vector3(),
    orientation = new THREE.Euler(),
    length = 0,
    radius = 0,
    level = 0,
    sectionCount = 0,
    segmentCount = 0,
  ) {
    this.origin = origin.clone();
    this.orientation = orientation.clone();
    this.length = length;
    this.radius = radius;
    this.level = level;
    this.sectionCount = sectionCount;
    this.segmentCount = segmentCount;
  }
}

const Billboard = {
  Single: 'single',
  Double: 'double',
};

const TreeType = {
  Deciduous: 'deciduous',
  Evergreen: 'evergreen',
};

/** The options of a tree (EZ-Tree's defaults); a preset is copied over them. */
export class TreeOptions {
  constructor() {
    this.seed = 0;
    this.type = TreeType.Deciduous;

    // Bark parameters
    this.bark = {
      // Informational identifier carried through presets. The library does not
      // consume this field; the host app uses it to resolve which texture set
      // to assign to `maps` below.
      type: 'Bark001',

      // Texture maps supplied by the caller. Each entry is a THREE.Texture or
      // null. When `textured` is true, non-null maps are applied to the
      // material; null maps fall back to the tint color for that channel.
      maps: {
        color: null,
        ao: null,
        normal: null,
        roughness: null,
      },

      // Tint of the tree trunk
      tint: 0xffffff,

      // Use face normals for shading instead of vertex normals
      flatShading: false,

      // Apply texture to bark
      textured: true,

      // Scale for the texture
      textureScale: { x: 1, y: 1 },
    };

    // Branch parameters
    this.branch = {
      // Number of branch recursion levels. 0 = trunk only
      levels: 3,

      // Angle of the child branches relative to the parent branch (degrees)
      angle: {
        1: 70,
        2: 60,
        3: 60,
      },

      // Number of children per branch level
      children: {
        0: 7,
        1: 7,
        2: 5,
      },

      // External force encouraging tree growth in a particular direction
      force: {
        direction: { x: 0, y: 1, z: 0 },
        strength: 0.01,
      },

      // Amount of curling/twisting at each branch level
      gnarliness: {
        0: 0.15,
        1: 0.2,
        2: 0.3,
        3: 0.02,
      },

      // Length of each branch level
      length: {
        0: 20,
        1: 20,
        2: 10,
        3: 1,
      },

      // Radius of each branch level
      radius: {
        0: 1.5,
        1: 0.7,
        2: 0.7,
        3: 0.7,
      },

      // Number of sections per branch level
      sections: {
        0: 12,
        1: 10,
        2: 8,
        3: 6,
      },

      // Number of radial segments per branch level
      segments: {
        0: 8,
        1: 6,
        2: 4,
        3: 3,
      },

      // Defines where child branches start forming on the parent branch
      start: {
        1: 0.4,
        2: 0.3,
        3: 0.3,
      },

      // Taper at each branch level
      taper: {
        0: 0.7,
        1: 0.7,
        2: 0.7,
        3: 0.7,
      },

      // Amount of twist at each branch level
      twist: {
        0: 0,
        1: 0,
        2: 0,
        3: 0,
      },
    };

    // Leaf parameters
    this.leaves = {
      // Informational identifier (e.g. 'oak', 'ash'). Library does not consume
      // it; the host app uses it to resolve which texture to assign to `map`.
      type: 'oak',

      // Color map supplied by the caller. THREE.Texture or null.
      // When null, leaves render as a flat tinted quad.
      map: null,

      // Whether to use single or double/perpendicular billboards
      billboard: Billboard.Double,

      // Angle of leaves relative to parent branch (degrees)
      angle: 10,

      // Number of leaves
      count: 1,

      // Where leaves start to grow on the length of the branch (0 to 1)
      start: 0,

      // Size of the leaves
      size: 2.5,

      // Variance in leaf size between each instance
      sizeVariance: 0.7,

      // Tint color for the leaves
      tint: 0xffffff,

      // Controls transparency of leaf texture
      alphaTest: 0.5,

      // Calculates custom normals to imply a rounded canopy shape
      roundedNormals: true,
    };

    // Ours (#485), neutral by default: see the top of this file.
    this.branch.droop = { 0: 0, 1: 0, 2: 0, 3: 0 };
    this.branch.terminal = 1;
    this.leaves.hang = 0;
    this.fronds = {
      count: 0, length: 10, width: 2.5, riseMin: -20, riseMax: 70, droop: 0.08, segments: 8, variance: 0.15,
      turn: 0, cross: true, fold: 0, boots: 0, bootDepth: 3, bootLength: 0.1,
    };
  }

  /**
   * Copies the values from source into this object
   * @param {TreeOptions} source 
   */
  copy(source, target = this) {
    for (const key in source) {
      if (source.hasOwnProperty(key) && target.hasOwnProperty(key)) {
        const value = source[key];
        // Assign THREE.Texture (and any non-plain object) by reference rather
        // than recursing — recursion would walk a Texture's internals.
        if (value !== null && typeof value === 'object' && value.constructor === Object) {
          this.copy(value, target[key]);
        } else {
          target[key] = value;
        }
      }
    }
  }
}

export class Tree extends THREE.Group {
  /**
   * @type {RNG}
   */
  rng;

  /**
   * @type {TreeOptions}
   */
  options;

  /**
   * @type {Branch[]}
   */
  branchQueue = [];

  /**
   * @param {TreeOptions} params
   */
  constructor(options = new TreeOptions()) {
    super();
    this.name = 'Tree';
    this.branchesMesh = new THREE.Mesh();
    this.leavesMesh = new THREE.Mesh();
    this.lod = null;
    this.skeleton = null;
    this.add(this.branchesMesh);
    this.add(this.leavesMesh);
    this.options = options;
  }

  /**
   * Loads a tree from JSON
   * @param {TreeOptions} json 
   */
  loadFromJson(json) {
    this.options.copy(json);
    this.generate();
  }

  /**
   * @typedef {Object} LODDetail
   * @property {number} [sectionStride=1] Sample every Nth section ring; the
   *   first and last rings are always kept so branch endpoints stay put
   * @property {number} [segmentFactor=1] Radial segment multiplier;
   *   segments = max(3, round(segmentCount * segmentFactor))
   * @property {number} [leafStride=1] Keep every Nth leaf
   * @property {number} [leafScale=1] Size multiplier for the kept leaves,
   *   typically 1/sqrt(kept fraction) to preserve canopy coverage
   * @property {string} [billboard] Billboard mode override for this level
   *   ('single' or 'double'); defaults to options.leaves.billboard
   */

  /**
   * @typedef {Object} LODLevel
   * @property {number} distance Camera distance at which this level activates
   * @property {number} [hysteresis] Switch hysteresis as a fraction of distance
   * @property {LODDetail} [detail] Meshing detail for this level
   */

  /**
   * Default levels for generateLODs(). LOD1 is roughly 40% of the full
   * triangle count, LOD2 roughly 20%.
   * @type {LODLevel[]}
   */
  static defaultLODLevels = [
    { distance: 0, detail: {} },
    {
      distance: 100,
      hysteresis: 0.05,
      detail: {
        sectionStride: 3,
        segmentFactor: 0.75,
        leafStride: 2,
        // Slightly under the area-preserving sqrt(2): individual leaves are
        // still resolvable at this distance, so a full compensation reads as
        // "bigger leaves" rather than "same canopy".
        leafScale: 1.25,
      },
    },
    {
      distance: 250,
      hysteresis: 0.05,
      detail: {
        sectionStride: 6,
        segmentFactor: 0.4,
        leafStride: 2,
        // Deliberately under-compensated: full coverage compensation for the
        // thinning + single billboard would need 2x scale, which reads as
        // balloon leaves. A slightly sparser canopy with natural-size leaves
        // looks better at this distance (fogged, 250+ units in the demo).
        leafScale: 1.3,
        billboard: Billboard.Single,
      },
    },
  ];

  /**
   * Generate a new tree
   */
  generate() {
    this.#clearLOD();
    this.#generateSkeleton();

    const buffers = this.#meshSkeleton();
    this.branches = buffers.branches;
    this.leaves = buffers.leaves;

    this.createBranchesGeometry();
    this.createLeavesGeometry();
  }

  /**
   * Generates the tree as a set of levels of detail hosted in a THREE.LOD
   * object inside this group. The renderer switches levels automatically
   * based on camera distance. All levels share one bark and one leaf
   * material, so update() animates wind at every level.
   * @param {LODLevel[]} levels Level descriptors, in any order
   */
  generateLODs(levels = Tree.defaultLODLevels) {
    this.#clearLOD();
    this.#generateSkeleton();

    const barkMaterial = this.#createBarkMaterial();
    const leafMaterial = this.#createLeafMaterial();

    this.lod = new THREE.LOD();
    this.lod.name = 'TreeLOD';

    // THREE.LOD sorts its levels by distance internally, so sort here too and
    // let the nearest level own the reused meshes regardless of input order.
    const ordered = [...levels].sort(
      (a, b) => (a.distance ?? 0) - (b.distance ?? 0),
    );

    ordered.forEach((level, index) => {
      const buffers = this.#meshSkeleton(level.detail ?? {});

      let branchesMesh, leavesMesh;
      if (index === 0) {
        // Reuse the existing meshes for the closest level so update(),
        // traversal and the vertex/triangle count getters keep working.
        this.branches = buffers.branches;
        this.leaves = buffers.leaves;
        branchesMesh = this.branchesMesh;
        leavesMesh = this.leavesMesh;
        branchesMesh.geometry.dispose();
        branchesMesh.material.dispose();
        leavesMesh.geometry.dispose();
        leavesMesh.material.dispose();
      } else {
        branchesMesh = new THREE.Mesh();
        leavesMesh = new THREE.Mesh();
      }

      branchesMesh.geometry = this.#buildBufferGeometry(buffers.branches);
      branchesMesh.material = barkMaterial;
      leavesMesh.geometry = this.#buildBufferGeometry(buffers.leaves);
      leavesMesh.material = leafMaterial;

      for (const mesh of [branchesMesh, leavesMesh]) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }

      const group = new THREE.Group();
      group.add(branchesMesh, leavesMesh);
      this.lod.addLevel(group, level.distance ?? 0, level.hysteresis ?? 0);
    });

    this.add(this.lod);
  }

  /**
   * Builds branch and leaf geometry at the given detail level without
   * modifying the tree's own meshes. Useful for external instancing or
   * custom LOD systems. Reuses the current skeleton, generating one first
   * if none exists.
   * @param {LODDetail} detail
   * @returns {{ branches: THREE.BufferGeometry, leaves: THREE.BufferGeometry }}
   */
  createGeometry(detail = {}) {
    if (!this.skeleton) {
      this.#generateSkeleton();
    }
    const buffers = this.#meshSkeleton(detail);
    return {
      branches: this.#buildBufferGeometry(buffers.branches),
      leaves: this.#buildBufferGeometry(buffers.leaves),
    };
  }

  /**
   * Tears down any LOD state and restores the flat branches/leaves meshes
   * as direct children, so generate() behaves as if LODs never existed.
   */
  #clearLOD() {
    if (!this.lod) return;

    this.lod.levels.forEach((level) => {
      for (const mesh of level.object.children) {
        // One level reuses branchesMesh/leavesMesh; their geometry and the
        // shared materials are disposed by whichever generate path runs next.
        if (mesh === this.branchesMesh || mesh === this.leavesMesh) continue;
        mesh.geometry.dispose();
      }
    });

    this.remove(this.lod);
    this.lod = null;
    this.add(this.branchesMesh, this.leavesMesh);
  }

  /**
   * Grows the tree skeleton: the section frames of every branch and the
   * placement of every leaf. All RNG consumption happens here, so any
   * number of meshing passes can run against one skeleton without changing
   * the tree's shape.
   */
  #generateSkeleton() {
    this.skeleton = {
      branches: [],
      leaves: [],
      fronds: [],
    };

    this.rng = new RNG(this.options.seed);

    // Create the trunk of the tree first
    this.branchQueue.push(
      new Branch(
        new THREE.Vector3(),
        new THREE.Euler(),
        this.options.branch.length[0],
        this.options.branch.radius[0],
        0,
        this.options.branch.sections[0],
        this.options.branch.segments[0],
      ),
    );

    while (this.branchQueue.length > 0) {
      const branch = this.branchQueue.shift();
      this.#growBranch(branch);
    }
  }

  /**
   * Meshes the current skeleton into geometry buffers at the given detail.
   * Consumes no RNG, so it can run repeatedly with different detail specs.
   * @param {LODDetail} detail
   */
  #meshSkeleton(detail = {}) {
    const sectionStride = Math.max(1, Math.floor(detail.sectionStride ?? 1));
    const segmentFactor = detail.segmentFactor ?? 1;
    const leafStride = Math.max(1, Math.floor(detail.leafStride ?? 1));
    const leafScale = detail.leafScale ?? 1;
    const billboard = detail.billboard ?? this.options.leaves.billboard;

    const branches = {
      verts: [],
      normals: [],
      indices: [],
      uvs: [],
      windFactor: []
    };

    const leaves = {
      verts: [],
      normals: [],
      indices: [],
      uvs: [],
    };

    for (const skeletonBranch of this.skeleton.branches) {
      this.#meshBranch(branches, skeletonBranch, sectionStride, segmentFactor);
    }

    for (let i = 0; i < this.skeleton.leaves.length; i += leafStride) {
      this.#meshLeaf(leaves, this.skeleton.leaves[i], leafScale, billboard);
    }

    // Ours (#485): the palms' fronds (every level of detail keeps them all: a palm has few).
    for (const frond of this.skeleton.fronds) this.#meshFrond(leaves, frond);

    return { branches, leaves };
  }

  /**
   * Grows a branch's skeleton, queueing child branches and recording leaf
   * placements. Consumes RNG in the exact order of the original interleaved
   * generator so seeds keep producing identical trees.
   * @param {Branch} branch
   * @returns
   */
  #growBranch(branch) {
    const sectionOrientation = branch.orientation.clone();
    const sectionOrigin = branch.origin.clone();
    const sectionLength =
      branch.length /
      branch.sectionCount /
      (this.options.type === 'Deciduous' ? this.options.branch.levels - 1 : 1);

    // This information is used for generating child branches after the branch
    // geometry has been constructed
    const sections = [];

    for (let i = 0; i <= branch.sectionCount; i++) {
      let sectionRadius = branch.radius;

      // If final section of final level, set radius to effecively zero
      // Ours (#485): a palm's trunk keeps its thickness to its top (its fronds grow there): no point.
      if (
        i === branch.sectionCount &&
        branch.level === this.options.branch.levels &&
        !(branch.level === 0 && this.options.fronds.count > 0)
      ) {
        sectionRadius = 0.001;
      } else if (this.options.type === TreeType.Deciduous) {
        sectionRadius *=
          1 - this.options.branch.taper[branch.level] * (i / branch.sectionCount);
      } else if (this.options.type === TreeType.Evergreen) {
        // Evergreens do not have a terminal branch so they have a taper of 1
        sectionRadius *= 1 - (i / branch.sectionCount);
      }

      // Use this information later on when generating child branches
      sections.push({
        origin: sectionOrigin.clone(),
        orientation: sectionOrientation.clone(),
        radius: sectionRadius,
      });

      sectionOrigin.add(
        new THREE.Vector3(0, sectionLength, 0).applyEuler(sectionOrientation),
      );

      // Perturb the orientation of the next section randomly. The higher the
      // gnarliness, the larger potential perturbation
      const gnarliness =
        Math.max(1, 1 / Math.sqrt(sectionRadius)) *
        this.options.branch.gnarliness[branch.level];

      sectionOrientation.x += this.rng.random(gnarliness, -gnarliness);
      sectionOrientation.z += this.rng.random(gnarliness, -gnarliness);

      // Apply growth force to the branch
      const qSection = new THREE.Quaternion().setFromEuler(sectionOrientation);

      const qTwist = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        this.options.branch.twist[branch.level],
      );

      qSection.multiply(qTwist);

      // Rotate the section's growth direction toward force.direction (positive
      // strength) or away from it (negative). The (sectionUp × target) axis
      // makes force.direction behave as a real world axis: when sectionUp is
      // already aligned with target the rotation is zero, so a vertical trunk
      // with force=(0,1,0) doesn't get gnarliness drift amplified — the old
      // slerp form was degenerate at qForce=identity and pushed branches in
      // whatever random direction the section had drifted.
      const sectionUp = new THREE.Vector3(0, 1, 0).applyQuaternion(qSection);
      const target = new THREE.Vector3()
        .copy(this.options.branch.force.direction)
        .normalize();
      const axis = new THREE.Vector3().crossVectors(sectionUp, target);
      const sinFull = axis.length();
      if (sinFull > 1e-6) {
        axis.divideScalar(sinFull);
        const fullAngle = Math.atan2(sinFull, sectionUp.dot(target));
        const step = this.options.branch.force.strength / sectionRadius;
        const clamped = Math.max(-fullAngle, Math.min(fullAngle, step));
        qSection.premultiply(
          new THREE.Quaternion().setFromAxisAngle(axis, clamped),
        );
      }

      // Ours (#485): the droop of this level, the same for a thick limb as for a thin twig.
      const droop = this.options.branch.droop[branch.level] || 0;
      if (droop > 0) qSection.rotateTowards(DOWN, droop);

      sectionOrientation.setFromQuaternion(qSection);
    }

    this.skeleton.branches.push({
      sections,
      segmentCount: branch.segmentCount,
      baseRadius: branch.radius,
    });

    // Ours (#485): a palm's fronds, at the top of its trunk.
    const palm = branch.level === 0 && this.options.fronds.count > 0;
    if (palm) this.#growFronds(sections[sections.length - 1]);

    // Deciduous trees have a terminal branch that grows out of the
    // end of the parent branch
    if (this.options.type === 'deciduous') {
      const lastSection = sections[sections.length - 1];

      if (branch.level < this.options.branch.levels) {
        this.branchQueue.push(
          new Branch(
            lastSection.origin,
            lastSection.orientation,
            // Ours (#485): `branch.terminal` scales it (1 by default).
            this.options.branch.length[branch.level + 1] * this.options.branch.terminal,
            lastSection.radius,
            branch.level + 1,
            // Section count and segment count must be same as parent branch
            // since the child branch is growing from the end of the parent branch
            branch.sectionCount,
            branch.segmentCount,
          ),
        );
      } else if (!palm) {
        this.#recordLeaf(lastSection.origin, lastSection.orientation);
      }
    }

    // If we are on the last branch level, generate leaves
    if (branch.level === this.options.branch.levels) {
      this.generateLeaves(sections);
    } else if (branch.level < this.options.branch.levels) {
      this.generateChildBranches(
        this.options.branch.children[branch.level],
        branch.level + 1,
        sections);
    }
  }

  /**
   * Generate branches from a parent branch
   * @param {number} count The number of child branches to generate
   * @param {number} level The level of the child branches
   * @param {{
   *  origin: THREE.Vector3,
   *  orientation: THREE.Euler,
   *  radius: number
   * }[]} sections The parent branch's sections
   * @returns
   */
  generateChildBranches(count, level, sections) {
    const radialOffset = this.rng.random();
    const startMin = this.options.branch.start[level];
    const heightStep = (1.0 - startMin) / count;
    const angleSlots = this.shuffledIndices(count);

    for (let i = 0; i < count; i++) {
      // Stratified sampling along the parent's length: jitter within slot [i, i+1]
      // so children are spread evenly but not perfectly periodic.
      const childBranchStart = startMin + (i + this.rng.random()) * heightStep;

      // Find which sections are on either side of the child branch origin point
      // so we can determine the origin, orientation and radius of the branch
      const sectionIndex = Math.floor(childBranchStart * (sections.length - 1));
      const sectionA = sections[sectionIndex];
      let sectionB;
      if (sectionIndex === sections.length - 1) {
        sectionB = sectionA;
      } else {
        sectionB = sections[sectionIndex + 1];
      }

      // Find normalized distance from section A to section B (0 to 1)
      const alpha =
        (childBranchStart - sectionIndex / (sections.length - 1)) /
        (1 / (sections.length - 1));

      // Linearly interpolate origin from section A to section B
      const childBranchOrigin = new THREE.Vector3().lerpVectors(
        sectionA.origin,
        sectionB.origin,
        alpha,
      );

      // Linearly interpolate radius
      const childBranchRadius =
        this.options.branch.radius[level] *
        ((1 - alpha) * sectionA.radius + alpha * sectionB.radius);

      // Linearlly interpolate the orientation
      const qA = new THREE.Quaternion().setFromEuler(sectionA.orientation);
      const qB = new THREE.Quaternion().setFromEuler(sectionB.orientation);
      const parentOrientation = new THREE.Euler().setFromQuaternion(
        qB.slerp(qA, alpha),
      );

      // Stratified radial angle: each child gets a 2π/count slot, jittered ±½ slot.
      // angleSlots[i] randomly permutes slot assignment so that the height slot
      // and angle slot are uncorrelated — otherwise evergreens (where branch
      // length depends on height) spiral their longest branches to a fixed side.
      const radialJitter = this.rng.random(0.5, -0.5);
      const radialAngle = 2.0 * Math.PI * (radialOffset + (angleSlots[i] + radialJitter) / count);
      const q1 = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        this.options.branch.angle[level] / (180 / Math.PI),
      );
      const q2 = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        radialAngle,
      );
      const q3 = new THREE.Quaternion().setFromEuler(parentOrientation);

      const childBranchOrientation = new THREE.Euler().setFromQuaternion(
        q3.multiply(q2.multiply(q1)),
      );

      const childBranchLength =
        this.options.branch.length[level] *
        (this.options.type === TreeType.Evergreen
          ? 1.0 - childBranchStart
          : 1.0);

      this.branchQueue.push(
        new Branch(
          childBranchOrigin,
          childBranchOrientation,
          childBranchLength,
          childBranchRadius,
          level,
          this.options.branch.sections[level],
          this.options.branch.segments[level],
        ),
      );
    }
  }

  /**
   * Logic for spawning child branches from a parent branch's section
   * @param {{
  *  origin: THREE.Vector3,
  *  orientation: THREE.Euler,
  *  radius: number
  * }[]} sections The parent branch's sections
  * @returns
  */
  generateLeaves(sections) {
    const radialOffset = this.rng.random();
    const count = this.options.leaves.count;
    const startMin = this.options.leaves.start;
    const heightStep = (1.0 - startMin) / count;
    const angleSlots = this.shuffledIndices(count);

    for (let i = 0; i < count; i++) {
      // Stratified sampling along the parent's length.
      const leafStart = startMin + (i + this.rng.random()) * heightStep;

      // Find which sections are on either side of the child branch origin point
      // so we can determine the origin, orientation and radius of the branch
      const sectionIndex = Math.floor(leafStart * (sections.length - 1));
      const sectionA = sections[sectionIndex];
      let sectionB;
      if (sectionIndex === sections.length - 1) {
        sectionB = sectionA;
      } else {
        sectionB = sections[sectionIndex + 1];
      }

      // Find normalized distance from section A to section B (0 to 1)
      const alpha =
        (leafStart - sectionIndex / (sections.length - 1)) /
        (1 / (sections.length - 1));

      // Linearly interpolate origin from section A to section B
      const leafOrigin = new THREE.Vector3().lerpVectors(
        sectionA.origin,
        sectionB.origin,
        alpha,
      );

      // Linearlly interpolate the orientation
      const qA = new THREE.Quaternion().setFromEuler(sectionA.orientation);
      const qB = new THREE.Quaternion().setFromEuler(sectionB.orientation);
      const parentOrientation = new THREE.Euler().setFromQuaternion(
        qB.slerp(qA, alpha),
      );

      // Stratified radial angle with permuted slot assignment.
      // See generateChildBranches for rationale.
      const radialJitter = this.rng.random(0.5, -0.5);
      const radialAngle = 2.0 * Math.PI * (radialOffset + (angleSlots[i] + radialJitter) / count);
      const q1 = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        this.options.leaves.angle / (180 / Math.PI),
      );
      const q2 = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        radialAngle,
      );
      const q3 = new THREE.Quaternion().setFromEuler(parentOrientation);

      let leafOrientation = new THREE.Euler().setFromQuaternion(
        q3.multiply(q2.multiply(q1)),
      );

      // Ours (#485): a leaf turned toward hanging straight down, its own turn about the vertical kept.
      const hang = this.options.leaves.hang;
      if (hang > 0) {
        const hanging = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), radialAngle).premultiply(DOWN);
        leafOrientation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromEuler(leafOrientation).slerp(hanging, hang));
      }

      this.#recordLeaf(leafOrigin, leafOrientation);
    }
  }

  /**
  * Records a leaf placement in the skeleton. The size variance is sampled
  * here so the meshing passes stay RNG-free.
  * @param {THREE.Vector3} origin The starting point of the leaf
  * @param {THREE.Euler} orientation The orientation of the leaf
  */
  #recordLeaf(origin, orientation) {
    const size =
      this.options.leaves.size *
      (1 +
        this.rng.random(
          this.options.leaves.sizeVariance,
          -this.options.leaves.sizeVariance,
        ));

    this.skeleton.leaves.push({
      origin: origin.clone(),
      orientation: orientation.clone(),
      size,
    });
  }

  /**
  * Emits the quad geometry for one skeleton leaf into the buffers
  * @param {{verts: number[], normals: number[], indices: number[], uvs: number[]}} buffers
  * @param {{origin: THREE.Vector3, orientation: THREE.Euler, size: number}} leaf
  * @param {number} scale Size multiplier for this detail level
  * @param {string} billboard Billboard mode for this detail level
  */
  #meshLeaf(buffers, leaf, scale, billboard) {
    let i = buffers.verts.length / 3;

    const { origin, orientation } = leaf;

    // Width and length of the leaf quad
    const leafSize = leaf.size * scale;

    const W = leafSize;
    const L = leafSize;

    const createLeaf = (rotation) => {
      // Create quad vertices
      const v = [
        new THREE.Vector3(-W / 2, L, 0),
        new THREE.Vector3(-W / 2, 0, 0),
        new THREE.Vector3(W / 2, 0, 0),
        new THREE.Vector3(W / 2, L, 0),
      ].map((v) =>
        v
          .applyEuler(new THREE.Euler(0, rotation, 0))
          .applyEuler(orientation)
          .add(origin),
      );

      buffers.verts.push(
        v[0].x,
        v[0].y,
        v[0].z,
        v[1].x,
        v[1].y,
        v[1].z,
        v[2].x,
        v[2].y,
        v[2].z,
        v[3].x,
        v[3].y,
        v[3].z,
      );

      const n = new THREE.Vector3(0, 0, 1).applyEuler(orientation);

      // The normal vectors are an average of the direction of the leaf and the directions to the individual vertices.
      // This creates a nice rounded shape while maintaining the canopy shape as a whole.
      const roundedNormals = this.options.leaves.roundedNormals;
      const n1 = roundedNormals ? new THREE.Vector3().copy(n).add(v[0]).sub(origin).normalize() : n;
      const n2 = roundedNormals ? new THREE.Vector3().copy(n).add(v[1]).sub(origin).normalize() : n;
      const n3 = roundedNormals ? new THREE.Vector3().copy(n).add(v[2]).sub(origin).normalize() : n;
      const n4 = roundedNormals ? new THREE.Vector3().copy(n).add(v[3]).sub(origin).normalize() : n;

      buffers.normals.push(
        n1.x,
        n1.y,
        n1.z,
        n2.x,
        n2.y,
        n2.z,
        n3.x,
        n3.y,
        n3.z,
        n4.x,
        n4.y,
        n4.z,
      );
      buffers.uvs.push(0, 1, 0, 0, 1, 0, 1, 1);
      buffers.indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
      i += 4;
    };

    createLeaf(0);
    if (billboard === Billboard.Double) {
      createLeaf(Math.PI / 2);
    }
  }

  /**
   * Ours (#485): a palm's crown, grown into the skeleton (all its random draws here) round the top of its trunk
   * (`top`: its last section): fronds by the golden angle, the youngest standing up, the oldest hanging, from inside
   * the top; then the old leaf bases (`boots`) round it, down `bootDepth` trunk radii.
   */
  #growFronds(top) {
    const f = this.options.fronds;
    const axis = new THREE.Vector3(0, 1, 0).applyEuler(top.orientation);
    for (let i = 0; i < f.count; i++) {
      const age = this.rng.random();
      const turn = i * 2.39996 + this.rng.random(0.3, -0.3);
      const rise = THREE.MathUtils.degToRad(f.riseMax + (f.riseMin - f.riseMax) * age + this.rng.random(8, -8));
      const length = f.length * (1 + this.rng.random(f.variance, -f.variance));
      const out = new THREE.Vector3(Math.cos(turn), 0, Math.sin(turn));
      const base = top.origin.clone().addScaledVector(out, top.radius * 0.25).addScaledVector(axis, -top.radius * (0.3 + 0.5 * age));
      this.#recordFrond(base, out, rise, length, f.width, f.segments, f.droop, 1);
    }
    for (let i = 0; i < f.boots; i++) {
      const turn = i * 2.39996 + this.rng.random(0.4, -0.4);
      const depth = this.rng.random() * f.bootDepth * top.radius;
      const out = new THREE.Vector3(Math.cos(turn), 0, Math.sin(turn));
      const base = top.origin.clone().addScaledVector(axis, -depth).addScaledVector(out, top.radius * 0.8);
      const rise = THREE.MathUtils.degToRad(this.rng.random(75, 45));
      this.#recordFrond(base, out, rise, f.length * f.bootLength, f.width * 0.5, 2, 0, 0.09);
    }
  }

  /**
   * Ours (#485): one frond's spine from `base`, toward `out` raised `rise` (radians), `length` long in `segments`
   * bending `droop` each, and the strip's way across; its drawing from v 0 at its base to `vEnd`.
   */
  #recordFrond(base, out, rise, length, width, segments, droop, vEnd) {
    const up = new THREE.Vector3(0, 1, 0);
    const dir = out.clone().multiplyScalar(Math.cos(rise)).addScaledVector(up, Math.sin(rise)).normalize();
    const side = new THREE.Vector3().crossVectors(dir, up).normalize();
    if (side.lengthSq() < 1e-6) side.set(-out.z, 0, out.x);
    const spine = [base.clone()];
    const step = length / segments;
    for (let k = 0; k < segments; k++) {
      spine.push(spine[k].clone().addScaledVector(dir, step));
      dir.applyAxisAngle(side, -droop).normalize();
    }
    const along = spine[spine.length - 1].clone().sub(spine[0]).normalize();
    const face = side.clone().applyAxisAngle(along, THREE.MathUtils.degToRad(this.options.fronds.turn));
    this.skeleton.fronds.push({ spine, face, along, width, vEnd });
  }

  /**
   * Ours (#485): a frond's strip(s) into the leaves' buffers: FOLDED along its middle (`fronds.fold`: its edges
   * raised that share of its half width), five vertices a row, its v from 0 at its base to `vEnd`; a second strip
   * across the first if `fronds.cross`.
   */
  #meshFrond(buffers, frond) {
    const { fold, cross } = this.options.fronds;
    const strip = (side, width) => {
      const i = buffers.verts.length / 3;
      const spine = frond.spine, n = spine.length - 1, across = [-1, -0.5, 0, 0.5, 1];
      for (let k = 0; k <= n; k++) {
        const along = spine[Math.min(k + 1, n)].clone().sub(spine[Math.max(k - 1, 0)]).normalize();
        const normal = new THREE.Vector3().crossVectors(side, along).normalize();
        for (const a of across) {
          const p = spine[k].clone().addScaledVector(side, a * width / 2).addScaledVector(normal, Math.abs(a) * fold * width / 2);
          const nn = normal.clone().addScaledVector(side, -Math.sign(a) * fold).normalize();
          buffers.verts.push(p.x, p.y, p.z);
          buffers.normals.push(nn.x, nn.y, nn.z);
          buffers.uvs.push((a + 1) / 2, frond.vEnd * k / n);
        }
      }
      for (let k = 0; k < n; k++) {
        for (let c = 0; c < across.length - 1; c++) {
          const a = i + across.length * k + c, b = a + across.length;
          buffers.indices.push(a, a + 1, b + 1, a, b + 1, b);
        }
      }
    };
    strip(frond.face, frond.width);
    if (cross) strip(frond.face.clone().applyAxisAngle(frond.along, Math.PI / 2), frond.width * 0.8);
  }

  /**
   * Fisher-Yates shuffle of [0..count-1] using the tree's RNG so results stay
   * seed-reproducible.
   * @param {number} count
   * @returns {number[]}
   */
  shuffledIndices(count) {
    const arr = Array.from({ length: count }, (_, k) => k);
    for (let k = count - 1; k > 0; k--) {
      const r = Math.floor(this.rng.random() * (k + 1));
      [arr[k], arr[r]] = [arr[r], arr[k]];
    }
    return arr;
  }

  /**
   * Emits the ring geometry and indices for one skeleton branch
   * @param {{verts: number[], normals: number[], indices: number[], uvs: number[]}} buffers
   * @param {{sections: {origin: THREE.Vector3, orientation: THREE.Euler, radius: number}[], segmentCount: number, baseRadius: number}} skeletonBranch
   * @param {number} sectionStride Sample every Nth section ring
   * @param {number} segmentFactor Radial segment multiplier
   */
  #meshBranch(buffers, skeletonBranch, sectionStride, segmentFactor) {
    const { sections, segmentCount, baseRadius } = skeletonBranch;

    // Terminal branches inherit the parent's segmentCount, so parent and
    // child resolve to the same reduced count and junctions stay sealed.
    const segments = Math.max(3, Math.round(segmentCount * segmentFactor));

    // Number of texture wraps around the branch's circumference. Scaling with
    // the branch's base radius keeps bark feature size roughly consistent
    // across thick trunks and thin twigs. Held constant for the whole branch
    // so tapered sections share a wrap count and don't twist the texture
    // longitudinally.
    const wrapsX = Math.max(
      1,
      Math.round(baseRadius * this.options.bark.textureScale.x),
    );

    // Sample every Nth ring, always keeping the first and last so branch
    // endpoints (and parent/child junctions) stay put across detail levels.
    const sampled = [];
    for (let i = 0; i < sections.length; i += sectionStride) {
      sampled.push(sections[i]);
    }
    if ((sections.length - 1) % sectionStride !== 0) {
      sampled.push(sections[sections.length - 1]);
    }

    // Used later for geometry index generation
    const indexOffset = buffers.verts.length / 3;

    for (let k = 0; k < sampled.length; k++) {
      const section = sampled[k];

      // Create the segments that make up this section.
      let first;
      for (let j = 0; j < segments; j++) {
        const angle = (2.0 * Math.PI * j) / segments;

        // Create the segment vertex
        const vertex = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
          .multiplyScalar(section.radius)
          .applyEuler(section.orientation)
          .add(section.origin);

        const normal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
          .applyEuler(section.orientation)
          .normalize();

        // uv.y alternates by sampled ring position rather than original
        // section index, so section skipping keeps the 0/1 tiling pattern.
        const uv = new THREE.Vector2(
          (j / segments) * wrapsX,
          (k % 2 === 0) ? 0 : 1,
        );

        buffers.verts.push(...Object.values(vertex));
        buffers.normals.push(...Object.values(normal));
        buffers.uvs.push(...Object.values(uv));

        if (j === 0) {
          first = { vertex, normal, uv };
        }
      }

      // Duplicate the first vertex so there is continuity in the UV mapping.
      // u=wrapsX maps to the same texel as u=0 since wrapsX is an integer.
      buffers.verts.push(...Object.values(first.vertex));
      buffers.normals.push(...Object.values(first.normal));
      buffers.uvs.push(wrapsX, first.uv.y);
    }

    // Build geometry for each section of the branch (cylinder without end caps)
    let v1, v2, v3, v4;
    const N = segments + 1;
    for (let i = 0; i < sampled.length - 1; i++) {
      // Build the quad for each segment of the section
      for (let j = 0; j < segments; j++) {
        v1 = indexOffset + i * N + j;
        // The last segment wraps around back to the starting segment, so omit j + 1 term
        v2 = indexOffset + i * N + (j + 1);
        v3 = v1 + N;
        v4 = v2 + N;
        buffers.indices.push(v1, v3, v2, v2, v3, v4);
      }
    }
  }

  /**
   * Builds a BufferGeometry from raw attribute buffers
   * @param {{verts: number[], normals: number[], indices: number[], uvs: number[]}} buffers
   * @returns {THREE.BufferGeometry}
   */
  #buildBufferGeometry(buffers) {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(buffers.verts), 3),
    );
    g.setAttribute(
      'normal',
      new THREE.BufferAttribute(new Float32Array(buffers.normals), 3),
    );
    g.setAttribute(
      'uv',
      new THREE.BufferAttribute(new Float32Array(buffers.uvs), 2),
    );
    // Ours: 32-bit indices past 65 535 vertices (16 bits would wrap).
    const big = buffers.verts.length / 3 > 65535;
    g.setIndex(
      new THREE.BufferAttribute(big ? new Uint32Array(buffers.indices) : new Uint16Array(buffers.indices), 1),
    );
    g.computeBoundingSphere();
    return g;
  }

  /**
   * Creates the bark material from the current options
   * @returns {THREE.MeshStandardMaterial}
   */
  #createBarkMaterial() {
    const mat = new THREE.MeshStandardMaterial({
      name: 'branches',
      flatShading: this.options.bark.flatShading,
      color: new THREE.Color(this.options.bark.tint),
      metalness: 0.0,
      roughness: 1.0,
    });

    if (this.options.bark.textured) {
      // textureScale.x is baked into UVs during meshing (wrapsX), so only
      // the Y axis needs runtime scaling on the texture itself.
      const scale = this.options.bark.textureScale;
      const maps = this.options.bark.maps;
      const apply = (texture) => {
        if (!texture) return null;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.x = 1;
        texture.repeat.y = 1 / scale.y;
        return texture;
      };
      if (maps.color) mat.map = apply(maps.color);
      if (maps.ao) mat.aoMap = apply(maps.ao);
      if (maps.normal) mat.normalMap = apply(maps.normal);
      if (maps.roughness) {
        mat.roughnessMap = apply(maps.roughness);
        // Point metalnessMap at the same texture: metalness stays 0 because
        // the metalness factor is 0, and GLTFExporter reuses the texture
        // as-is instead of synthesizing a merged metal/rough PNG (and
        // warning about it) when the two slots differ.
        mat.metalnessMap = mat.roughnessMap;
      }
    }

    return mat;
  }

  /**
   * Generates the geometry for the branches
   */
  createBranchesGeometry() {
    this.branchesMesh.geometry.dispose();
    this.branchesMesh.geometry = this.#buildBufferGeometry(this.branches);
    this.branchesMesh.material.dispose();
    this.branchesMesh.material = this.#createBarkMaterial();
    this.branchesMesh.castShadow = true;
    this.branchesMesh.receiveShadow = true;
  }

  /**
   * Creates the leaf material, including the wind sway vertex shader, from
   * the current options
   * @returns {THREE.MeshStandardMaterial}
   */
  #createLeafMaterial() {
    const mat = new THREE.MeshStandardMaterial({
      name: 'leaves',
      map: this.options.leaves.map ?? null,
      color: new THREE.Color(this.options.leaves.tint),
      side: THREE.DoubleSide,
      alphaTest: this.options.leaves.alphaTest,
      metalness: 0.0,
      roughness: 1.0,
      dithering: true
    });

    // No wind (a storyboard is still); the rounded normals kept: the back face's normal is not flipped. three r128
    // writes the flip `normal = normal * faceDirection;` (later versions `normal *= faceDirection;`).
    if (this.options.leaves.roundedNormals) {
      mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_begin>',
          THREE.ShaderChunk.normal_fragment_begin
            .replace('normal = normal * faceDirection;', '')
            .replace('normal *= faceDirection;', ''),
        );
      };
      mat.customProgramCacheKey = () => 'ez-tree-rounded-normals';
    }

    return mat;
  }

  /**
   * Generates the geometry for the leaves
   */
  createLeavesGeometry() {
    this.leavesMesh.geometry.dispose();
    this.leavesMesh.geometry = this.#buildBufferGeometry(this.leaves);
    this.leavesMesh.material.dispose();
    this.leavesMesh.material = this.#createLeafMaterial();
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
