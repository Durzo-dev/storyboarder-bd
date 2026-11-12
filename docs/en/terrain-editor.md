# The terrain editor

*[Version française](../fr/terrain-editor.md)*

Shaping the ground of a Scene: relief, Zones, Paths, water.

## What lives where

| File | Role |
|---|---|
| `src/terrain-editeur-ui.js` | The editor: opening (a Scene only), tools, menus, plan, 3D preview, validation. |
| `src/terrain-plan.js` | PURE. The plan in metres (zones, paths, buildings, elements), framing, hit-testing, moving and turning a Zone. |
| `src/terrain-relief.js` | PURE. The height grid, the brush, rivers, raised or sloped Zones, the "bridging" profile of roads. |
| `src/terrain-zone-pinceau.js` | PURE. Painted Zones: a mask of 50 cm cells. |
| `src/scene3d.js` | Rendering: `reliefEffectif3D`, `poserRelief3D`, `draperSurLeRelief3D`, water, `rendreSceneVueLibre3D`. |

## Added data

Added fields: an old file reads as it is.

- **`panel.relief`** (the Scene canvas, and a Panel that loads it): `{ pas, x0, z0, nx, nz, h, v }`,
  heights in metres every metre, row by row in z, between `HAUTEUR_MIN` and `HAUTEUR_MAX` (±300 m;
  any older Project is within them). Absent: flat Ground. Optional
  `altitude`: the real altitude (metres above sea level) of the grid's level 0, for a relief taken
  from a real place (set by the import); heights stay relative to it, the real altitude of a
  point is `altitude` + height. Kept by every operation that rebuilds the grid.
- **`terrain` path** (Zone): `world.masque` `{ pas, x0, z0, nx, nz, plein }` for a painted Zone (the
  bounding rectangle stays in `world`); `hauteurZone`, `penteZone` (degrees), `sensPente` (degrees);
  `niveauEau` when `terrainType === 'eau'`.
- **`riviere` path**: `world.pts`, `world.width`, `profondeur`.
- **`trottoir` path**: `world.pts`, `world.width` (2 m by default); drawn as a slab `TROTTOIR_BORDURE_M` (0.14 m) high, its kerb on both sides, in the Ground's concrete grain, lighter.

## The rules that matter

- **Nothing is applied before "Validate".** The editor works on the Scene (the preview and the
  settings need it) but keeps its starting state; leaving without validating restores it; validating
  makes ONE application undo step. While editing, `snapshot()` feeds the editor's own history, and
  autosave waits.
- **Rendered relief = painted relief, raised by Zones, dug by rivers, flattened under buildings, cut
  under roads and paths** (`reliefEffectif3D`), recomputed at each render. A road is draped by its axis
  (`profilFranchissant`), so it stays level across its width: `cutUnderRoads` brings every grid point
  within half its width (plus 0.5 m and a cell and a half) down to 10 cm under the road, and the drape
  reuses the same profile. The cut is kept per Panel while neither the relief nor the lines change. It uses the Ground's very material; the flat Ground
  is pierced under it by a stencil mask without depth test (with it, the mask would fight the near-flat
  relief: moiré).
- **Relief and draped drawings never cast shadows**: `marquerProjectionDOmbre3D` recognises them by
  `userData.relief` / `userData.dessinAuSol`, not by their height (otherwise shadow acne).
- **A point's height follows the mesh triangles** (diagonal (i+1, j)–(i, j+1)), not a bilinear
  interpolation: otherwise what stands on it goes under it.
- **Performance**: during a brush stroke, Paths are frozen (`figerLesTraces3D`) and the preview is
  capped at 8 frames/s.
- **Menu buttons and lists are built once and only updated**: the menu is refreshed at every draw,
  and a button replaced between press and release loses the click.
