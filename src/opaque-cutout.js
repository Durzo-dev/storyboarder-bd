/**
 * @file opaque-cutout.js
 * A cut-out material (alphaTest) that writes an alpha of 1 where it is drawn. A Panel's 3D image is laid on the page:
 * leaves that wrote the alpha of their mipmaps (0.45 to 0.8 from 15 to 100 m, measured on EZ-Tree's leaves and on the
 * model bank's maple and lime) let the white page through, and the crowns turned pale, almost white, from afar. Used by
 * the generated trees (ez-trees.js), the crops (crops-3d.js) and every imported model (model-cache.js). PURE of the
 * scene: only the material's shader is changed.
 */

/** The shader lines: the cut-out as three writes it, then a full alpha. */
export const OPAQUE_CUTOUT = '#include <alphatest_fragment>\n\tdiffuseColor.a = 1.0;';

/**
 * Makes a cut-out material write a full alpha. Chained on the material's own shader change (EZ-Tree's rounded
 * normals, the metals' ambient), and named in its program key. Once per material: a second call does nothing.
 */
export function opaqueCutout(material) {
  if (!material || (material.userData && material.userData.opaqueCutout)) return;
  material.userData = material.userData || {};
  material.userData.opaqueCutout = true;
  const before = material.onBeforeCompile;
  const keyBefore = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.onBeforeCompile = (shader, renderer) => {
    if (before) before(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', OPAQUE_CUTOUT);
  };
  material.customProgramCacheKey = () => `${keyBefore}+opaque-cutout`;
  material.needsUpdate = true;
}

/** The alpha threshold given to a blended leaf turned into a cut-out (glTF's own default for MASK). */
export const LEAF_CUTOFF = 0.5;

/**
 * Every cut-out material of an imported model (glTF MASK: alphaTest, not transparent) writes a full alpha. With
 * `plant`, a BLENDED material with a texture (a model's leaves) becomes a cut-out first: blended leaves wrote their
 * alpha too, and were drawn in no sure order. Glass and water (a bus shelter, a fountain) are not plants: kept blended.
 * Returns how many materials it changed.
 */
export function opaqueCutouts(scene, { plant = false } = {}) {
  let changed = 0;
  if (!scene || typeof scene.traverse !== 'function') return changed;
  scene.traverse(n => {
    if (!n.isMesh || !n.material) return;
    (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => {
      if (!m || (m.userData && m.userData.opaqueCutout)) return;
      if (plant && m.transparent && m.map) {
        m.transparent = false;
        m.depthWrite = true;
        m.alphaTest = LEAF_CUTOFF;
      }
      if (m.alphaTest > 0 && !m.transparent) { opaqueCutout(m); changed++; }
    });
  });
  return changed;
}
