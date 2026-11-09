# Ground textures

*[Version française](../fr/ground-textures.md)*

## Role

The Ground of a Panel or Scene, its Terrain zones and its Tracés carry materials: photographed grains,
baked at build time, laid in tiles, blended at several scales and paved to break repetition. Water and
sky, for their part, are computed.

## Files

| File | What it holds |
|---|---|
| `src/constants.js` | `GROUND_TYPE_DEFS` (the materials, their tile and `repeat`), `echellesSansTrou3D`. |
| `src/textures-integrees.js`, `src/textures-utilisateur.js` | Shipped materials and those from "My textures". |
| `src/ground-tiling-3d.js` | Anti-repetition paving (shader). |
| `src/ground-water-3d.js` | Computed water (shader). |
| `src/sky-3d.js` | The computed sky. |
| `src/scene3d.js` | Distance haze (`brumeDuLointain3D`, `distanceAuBordDuSol3D`). |
| `tools/bake-textures.mjs` | The grain baker (`npm run bake-textures`). |

## Texel density

Density is measured in **px/m** (texture pixels per metre of surface; one world unit = 1 m). What shows
is not density but its **inconsistency**: every photographed material therefore has the same density,
**256 px/m** (a 1024² grain on a 4 m tile, `repeat` 3000). The one exception, marked
`motifTailleReelle`: tiling, whose tile must be its real size (60 cm, `repeat` 4700).

3D models are flat colours, with no texture: a photographic Ground cannot match their sharpness at every
distance.

## Three scales, and paving

- The same texture is sampled at **three** distant **scales**, blended together: the large one carries
  what is seen from afar, the small one close detail. `echellesSansTrou3D` checks that neighbouring
  scales touch (the coarsest pattern of one reaches the finest of the next).
- A tileable texture is uniform at large scale by construction: the **wide layer** carries distant
  variation.
- **Paving** (`ground-tiling-3d.js`) samples in the cells of a triangular grid, each randomly offset and
  rotated, and blends three samples per pixel. It removes the tile's period (the grid visible when
  zooming out). Sampling goes through `textureGrad` with the original coordinate's derivatives (no mipmap
  seam), and the blend preserves contrast.

## Baking a material

The baker reads, in `assets/textures/sources/<material>/` (outside the repository), **three maps**:
- albedo (`Color`, `Diff`, `Albedo`, `BaseColor`);
- relief: displacement (`Displacement`, `Disp`, `Height`) **or** ambient occlusion, never both;
- the normal in **OpenGL** convention (`NormalGL`, `nor_gl`).

One set per folder; `.jpg`, `.jpeg`, `.png` only (no EXR). A 1K source is enough. Ground grains come out
at 1024² (`TAILLE_GRAIN_SOL`), Bubble grains at 512² (`TAILLE_GRAIN`); the baker's decisions (contrast
normalisation, nature, seam, pattern) are taken on the version reduced to 512.

The bake report gives a **`tuile`** line: the share of contrast living at tile scale, the one that
survives distance. It must fall **between 0.05 and 0.18**: below, the material averages out to a flat
colour from afar; above, patches recur. It cannot be predicted: bake and read it.

## Graphics memory

A grain is decoded into graphics memory: 1024 × 1024 × 4 bytes, plus a third for mipmaps. The macro
layer, greyscale, only serves as occlusion. A `DataTexture` is born with `Nearest` filtering and no
mipmaps, unlike a `CanvasTexture`: set it at creation.

## Water

Computed per pixel (`ground-water-3d.js`): colour from deep blue to subsurface turquoise on the crests,
foam at the top, the Panel's sky reflected according to Fresnel. Waves are **normals** (fourteen
sinusoidal trains from 12 m to 12 cm, on a slightly deformed plane), not geometry. A wave shorter than
`EAU_PIXELS_MIN` pixels fades out (analytic mipmap). They are not animated.

## The sky

Computed in all three modes (`sky-3d.js`): sun and moon in the exact direction of the scene's light,
clouds approximating volume (Beer-Lambert, rim facing the sun). Detail smaller than three pixels fades
out. The sky's horizon comes down to the Ground's visible edge.

## The distance

The camera's far plane is pushed beyond the Ground's farthest corner: it never cuts it. The Ground fades
into the sky's horizon colour before its edge (`brumeDuLointain3D`), only beyond the Panel's content;
the haze is removed after rendering, like the sky.

## Pitfalls

- **Do not make density follow camera distance**: repetition would slide at every wheel notch.
- **Do not put occlusion and displacement in the same folder**: the baker refuses.
- **DirectX normal**: it would invert the relief; only the GL one is read.
