/**
 * @file merge-meshes-3d.js
 * A group's meshes MERGED BY MATERIAL, for display: what looks the same becomes one mesh.
 *
 * A placed building is built piece by piece (batiment-3d.js): every window, wall face, slab is its own
 * mesh, about 300 per building. The GPU receives one draw call per mesh and per frame, and with a few
 * hundred buildings (a real place: Montpellier's Écusson, 300 buildings, 78 000 draw calls) that is what a
 * frame costs. Merged, a building is drawn in a few calls, one per material, looking exactly the same: the
 * vertices are only moved into the group's frame.
 *
 * Only plain meshes are merged; anything that carries a behaviour of its own stays as it is: skinned or
 * instanced meshes, multi-material meshes, meshes with userData (a ground mask, a piece of furniture), a
 * render order, a non-default layer, or a hidden ancestor. The building's DATA is never touched: the editor
 * works on it as before.
 */

/** Is this mesh a plain one, safe to fold into its material's mesh? */
function mergeable(m, root){
  if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh || Array.isArray(m.material) || !m.material) return false;
  if (m.renderOrder !== 0 || m.layers.mask !== 1 || Object.keys(m.userData).length) return false;
  const g = m.geometry;
  if (!g || !g.isBufferGeometry || !g.attributes.position || (g.morphAttributes && Object.keys(g.morphAttributes).length)) return false;
  for (let p = m; p && p !== root; p = p.parent) {
    if (!p.visible || (p !== m && Object.keys(p.userData).length)) return false;
  }
  return true;
}

/**
 * Merges the plain meshes of `root` by material (and shadow flags), in `root`'s own frame. Returns the
 * number of draw calls saved. The merged meshes' geometries are disposed (they belonged to the group).
 */
export function mergeByMaterial3D(T, root){
  root.updateMatrixWorld(true);
  const toRoot = new T.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  root.traverse(m => {
    if (!mergeable(m, root)) return;
    const key = `${m.material.id}|${m.castShadow}|${m.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(m);
  });
  let saved = 0;
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const material = meshes[0].material;
    const withUv2 = meshes.every(m => m.geometry.attributes.uv2);
    const withColor = !!material.vertexColors && meshes.every(m => m.geometry.attributes.color);
    let vertices = 0, indices = 0;
    for (const m of meshes) {
      const g = m.geometry, n = g.attributes.position.count;
      vertices += n; indices += g.index ? g.index.count : n;
    }
    const pos = new Float32Array(vertices * 3), nor = new Float32Array(vertices * 3), uv = new Float32Array(vertices * 2);
    const uv2 = withUv2 ? new Float32Array(vertices * 2) : null, col = withColor ? new Float32Array(vertices * 3) : null;
    const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
    const v = new T.Vector3(), matrix = new T.Matrix4(), normalMatrix = new T.Matrix3();
    let vo = 0, io = 0;
    for (const m of meshes) {
      const g = m.geometry;
      if (!g.attributes.normal) g.computeVertexNormals();
      matrix.multiplyMatrices(toRoot, m.matrixWorld);
      normalMatrix.getNormalMatrix(matrix);
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, n = P.count;
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(matrix);
        pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
        v.fromBufferAttribute(N, i).applyMatrix3(normalMatrix).normalize();
        nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z;
        if (U) { uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i); }
        if (uv2) { uv2[(vo + i) * 2] = g.attributes.uv2.getX(i); uv2[(vo + i) * 2 + 1] = g.attributes.uv2.getY(i); }
        if (col) { const C = g.attributes.color; col[(vo + i) * 3] = C.getX(i); col[(vo + i) * 3 + 1] = C.getY(i); col[(vo + i) * 3 + 2] = C.getZ(i); }
      }
      // A mirrored mesh (negative scale) has its faces turned inside out once moved: its triangles are
      // walked the other way round.
      const flip = matrix.determinant() < 0;
      const count = g.index ? g.index.count : n;
      for (let t = 0; t + 2 < count + 0; t += 3) {
        const a = g.index ? g.index.getX(t) : t, b = g.index ? g.index.getX(t + 1) : t + 1, c = g.index ? g.index.getX(t + 2) : t + 2;
        index[io++] = vo + a;
        index[io++] = vo + (flip ? c : b);
        index[io++] = vo + (flip ? b : c);
      }
      vo += n;
    }
    const merged = new T.BufferGeometry();
    merged.setAttribute('position', new T.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new T.BufferAttribute(nor, 3));
    merged.setAttribute('uv', new T.BufferAttribute(uv, 2));
    if (uv2) merged.setAttribute('uv2', new T.BufferAttribute(uv2, 2));
    if (col) merged.setAttribute('color', new T.BufferAttribute(col, 3));
    merged.setIndex(new T.BufferAttribute(index.subarray(0, io), 1));
    merged.computeBoundingBox(); merged.computeBoundingSphere();
    const mesh = new T.Mesh(merged, material);
    mesh.castShadow = meshes[0].castShadow; mesh.receiveShadow = meshes[0].receiveShadow;
    for (const m of meshes) { m.parent.remove(m); m.geometry.dispose(); }
    root.add(mesh);
    saved += meshes.length - 1;
  }
  // The groups left empty go too: the renderer walks every node of the scene on every frame.
  const prune = (o) => {
    for (const c of o.children.slice()) {
      prune(c);
      if (!c.isMesh && !c.isLight && !c.isCamera && c.type === 'Group' && !c.children.length && !Object.keys(c.userData).length) o.remove(c);
    }
  };
  prune(root);
  return saved;
}
