# Displaying imported models

*[Version française](../fr/imported-models-display.md)*

## Role

An imported model (`.glb`, or a `.gltf` packed on import) must look in a Panel as it does in its
thumbnail and in the store preview. Everything goes through **a single path**,
`preparerModeleImporte3D` (`src/model-cache.js`), once at decoding; the store's 3D preview uses it too.

## What preparation does

1. **Colours**: GLTFLoader decodes colour textures as linear and reads material colours as linear,
   while the renderer does not re-encode to sRGB. Textures are read as is, colours converted for the
   screen.
2. **Vertex colours**: the same conversion, once per shared geometry.
3. **Metals**: in three, ambient light only lights the diffuse part, which a metal lacks. A shader line
   makes the metal reflect the Panel's ambient light, like a uniform environment: it follows each
   Panel's lighting, night included.
4. **Emissive strength**: `KHR_materials_emissive_strength`, ignored by three 0.128, is read from the
   JSON and applied.
5. **The file's lights and cameras**: removed. Placed in a Panel, a model would otherwise light the
   whole Panel, as many times as it has copies.

## On import

- **A `.gltf`**: its neighbours (`.bin`, textures) are read and packed into a real `.glb`
  (`gltf-glb.js`). A neighbour outside the `.gltf`'s folder is refused.
- **A compression without a decoder** (Draco, Meshopt, KTX2) required by the file: refused, with its
  name.

## Preview framing

- `boiteDeCadrageModele3D` only unites the bones that **deform** something (non-zero weight, or an
  attached rigid mesh): the effect or attachment bones of a game model, placed far from the body, do not
  stretch the box. The Model editor's orbit turns around this box's centre.
- As a safety net, a sheet's preview is rendered once at the base framing; the rectangle of its opaque
  pixels is measured, and the camera is recentred on it and brought closer, in at most three passes
  (`src/cadrage-apercu.js` for the pure computation; `cadrageAjusteModele3D` in `scene3d.js`). It is the
  **distance** to the target that is adjusted, never a zoom-out. The result is remembered per model,
  pose, orientation and render format.

## Limits

- **`KHR_materials_specular` and `KHR_materials_ior`** are ignored by three 0.128: the reflection stays
  the default one (4%).
- **Animations** are not played: the model is set in its rest pose, then by the skeleton sliders.
