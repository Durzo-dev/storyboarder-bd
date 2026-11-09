# Cast shadows

*[Version française](../fr/cast-shadows.md)*

## Role

A Panel's sun can cast shadows, and so can each placed light source, on request. They show on screen
and in the export (same `drawContent`).

## Files

- `src/shadows-3d.js`: the pure decisions: a Panel's visible field, the sun's shadow box, snapping, a
  source's shadow camera, what casts.
- `src/rig3d.js`, `src/scene3d.js`: setting it on the shared scene (`appliquerOmbresDeCase3D`,
  `marquerProjectionDOmbre3D`).
- `src/lighting-3d.js` (field `ombresPortees`), `src/light-source-3d.js` (field `projetteOmbre`).

## Two switches, hierarchical

- **The Panel**: "Cast shadows" in the Light section (`lumiere.ombresPortees`, absent = off), whatever
  the mode. It passes from a Scene to its Panels with the rest of the lighting.
- **Each placed source**: "Casts a shadow" in its sheet (`projetteOmbre`, unticked by default). Ticked
  on a Panel without shadows, it does nothing, and a hint under the box says so.

On the rendering side: `shadowMap.enabled` (the renderer) follows **both** kinds of caster;
`castShadow` belongs to each light.

## The sun's shadow

A `DirectionalLight` renders its shadow from an orthographic camera, whose box must be framed on **what
the Panel looks at**: the Ground is 12,000 units wide, and a box that size would give no visible shadow.

- **The box** covers the bounding sphere of the view frustum (`sphereTroncDeVision3D`), centred on the
  frustum's centroid, up to `PROFONDEUR_OMBRE_CAMDIST` (4) times the orbit distance.
- **The light's target** follows the Panel's orbit centre, and the shadow camera is placed outside the
  volume it looks at.
- **Snapping**: the radius is rounded up to the next doubling step (`PALIER_RAYON_OMBRE`), and the centre
  to a whole number of texels, in the light's frame (`repereOmbreSoleil3D`, `centreAccrocheOmbre3D`).
  Zooming within one step therefore changes neither the grid nor the shadow.
- **Resolution**: `RESOLUTION_OMBRE_SOLEIL` = 4096. `ombreSoleilSeraVisible3D` says whether a texel
  stays smaller than what casts (`TAILLE_TEXEL_MAX`).

## A placed source's shadow

A **cube** map (six depth passes per frame), of `RESOLUTION_OMBRE_SOURCE` = 512. `cameraOmbreSource3D`
sets its planes: near at `NEAR_OMBRE_SOURCE`, far at the source's range, or, at zero range, derived from
the Panel's visible field.

## Who casts, who receives

- Every lit material **receives**.
- Everything rising above the ground casts: an object whose **top** is less than
  `EPAISSEUR_MIN_PROJETEUR` (2 cm) above the ground (`estUnDessinAuSol3D`: paths, roads, zones) receives
  but does not cast. The criterion reads the top, not the base (a hedge set 2 cm above the ground
  casts).

## A render's cycle

The resting state of shadows is **off**. A Panel's render switches them on for itself, then sets them
back when leaving: a preview (sheet, Model editor), which shares the renderer, never inherits a Panel's
state. `marquerProjectionDOmbre3D` is called **after** the Panel's rigs are built, so that rigs created
during this render cast too.

## Cost

The sun costs about 1 ms per frame; eight casting sources, about 3.9 ms. Each combination (number of
sources, number of shadows) met for the first time triggers a GLSL compilation: ticking a source's
shadow can freeze the application for a moment. Measurements in
[rendering-performance.md](rendering-performance.md).

## Pitfalls

- **Frame the box on the Panel**, never on the Ground, and **move** it with the orbit (its target).
- **Do not let the radius follow continuously**: the shadow grid would change at every wheel notch, and
  outlines crawl.
- **Set `castShadow` after building the rigs**: otherwise a Panel's first image, cached, has no shadow.
- **Measure a shadow with a witness** (a second receiving surface): an isolated mesh never shows
  anything.
