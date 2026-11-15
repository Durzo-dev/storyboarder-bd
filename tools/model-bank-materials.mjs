/**
 * tools/model-bank-materials.mjs: THE BANK'S PLANTS MADE MATTE (#480j, Durzo's report on 15 Nov. 2026: leaves white
 * at their edges, worse zoomed out; one tree white all over). Used by tools/model-bank-bake.mjs; tested by
 * tests/model-bank-materials.test.mjs.
 *
 * MEASURED, not guessed (the first guess was wrong): the leaf textures' transparent pixels were ALREADY the leaves'
 * green (« Érable 1 »: 124, 143, 45 next to a leaf), so no colour bled in. What whitens them is their MATERIAL:
 *   - « Érable 1 »: a metal-roughness map whose roughness (green channel) is near 0: glossy leaves, a white
 *     highlight on every edge, more of them seen at once from afar;
 *   - « Peuplier 3 », « Platane 1 », « Chêne 1 »: KHR_materials_pbrSpecularGlossiness (their colour in its
 *     diffuse texture) over a metallic factor of 1: the application's loader reads them as bare white metal.
 * So: specular-glossiness turned into metal-roughness (its diffuse becomes the base colour), then every material
 * of a plant matte and not metal (bark and leaves never shine like that); its normal map kept.
 */
/** The specular-glossiness extension's name. */
const SPEC_GLOSS = 'KHR_materials_pbrSpecularGlossiness';

/** A plant's roughness: matte (bark, leaves). */
export const PLANT_ROUGHNESS = 0.9;

/**
 * Specular-glossiness into metal-roughness, every model (the application reads only the latter): its diffuse
 * colour and texture become the base colour, its metal off (a diffuse is not a metal), the extension removed.
 * By hand, not gltf-transform's metalRough(): that one recomputes the maps pixel by pixel (sharp, which fails
 * here). Returns how many materials it turned.
 */
export function toMetalRough(doc) {
  let n = 0;
  for (const m of doc.getRoot().listMaterials()) {
    const sg = m.getExtension(SPEC_GLOSS);
    if (!sg) continue;
    m.setBaseColorFactor(sg.getDiffuseFactor());
    const tex = sg.getDiffuseTexture();
    if (tex) {
      m.setBaseColorTexture(tex);
      const from = sg.getDiffuseTextureInfo(), to = m.getBaseColorTextureInfo();
      if (from && to) to.copy(from);
    }
    m.setMetallicFactor(0);
    m.setMetallicRoughnessTexture(null);
    m.setExtension(SPEC_GLOSS, null);
    n++;
  }
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === SPEC_GLOSS) e.dispose();
  return n;
}

/** Every material of a plant matte and not metal, its metal-roughness map dropped. Returns how many it changed. */
export function mattePlant(doc) {
  let n = 0;
  for (const m of doc.getRoot().listMaterials()) {
    if (m.getMetallicFactor() === 0 && m.getRoughnessFactor() === PLANT_ROUGHNESS && !m.getMetallicRoughnessTexture()) continue;
    m.setMetallicFactor(0);
    m.setRoughnessFactor(PLANT_ROUGHNESS);
    m.setMetallicRoughnessTexture(null);
    n++;
  }
  return n;
}
