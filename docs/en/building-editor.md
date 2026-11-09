# The Building editor

*[Version française](../fr/building-editor.md)*

## Role

The Building editor builds a building in top view, level by level: walls, openings, rooms, stairs,
roofs, finishes and fixed furniture, with a 3D preview. A building is a **Model**: it is saved in the
library (`<Projects folder>/Batiments/`) and placed in a Panel or a Scene, where it becomes an
**independent copy** embedded in the Element.

The editor opens from the header button, from "Create a building" in a Scene's context menu, or from
"Edit" on a placed building (which then edits its copy). It is a single central screen, like the
Reader: opening it closes the Model editor and the Reader.

## Files

Everything that decides is **pure** (no DOM, no three) and tested under Node; the screen and the
renderer only draw and relay gestures.

| File | What it holds |
|---|---|
| `src/batiment.js` | The format: create, read back (`normaliserBatiment`), write, name files. |
| `src/batiment-niveaux.js` | Levels: storeys, basements, derived elevations, duplication. |
| `src/batiment-trace.js` | Wall drawing: snapping, T-junctions, rectangles, moving vertices. |
| `src/batiment-geometrie.js` | Wall shapes including junctions (mitres), and their cutting at openings. |
| `src/batiment-pieces.js` | Rooms, derived from the walls (faces of the graph), islands, courtyards. |
| `src/batiment-ouvertures.js` | Doors, windows, bay windows, passages: placement and edits. |
| `src/batiment-escaliers.js` | Straight, L and U stairs: steps, stairwell, validity, snapping. |
| `src/batiment-toits.js` | Roofs per level: covered shape, slopes, edges. |
| `src/batiment-squelette.js` | The weighted straight skeleton, for roofs over L, T, U shapes. |
| `src/batiment-cours.js` | A courtyard (a room made void) extended to the levels above. |
| `src/batiment-revetements.js` | Finishes (texture, colour) of walls, floors, ceilings and facade. |
| `src/batiment-mobilier.js` | Fixed furniture placed in the editor. |
| `src/batiment-plan.js` | The top view: frame, grid, zoom, framing. |
| `src/batiment-3d.js` | The 3D builder, shared by the preview, the thumbnails and the Panels. |
| `src/batiment-element.js` | The placed building: the Element, its bounds, its hidden parts and cut. |
| `src/batiment-murs-devant.js` | The walls between the camera and the inside, hidden on demand. |
| `src/batiment-pose-ui.js` | "Place in this building" from a Character's or Object's sheet. |
| `src/batiment-store.js`, `src/batiment-bibliotheque.js`, `src/batiment-vignettes.js` | The library: read, write, rename, list with the models, thumbnails. |
| `src/batiment-icones.js` | The SVG pictograms of the settings. |
| `src/batiment-editeur-ui.js` | The screen: top view, 3D preview, menu, tools, undo. |
| `electron/main.js` (`batiments:*`) | Disk input and output, in `Batiments/`. |

## Data

**Units and frame**: **metres**, in the building's frame (x to the right, z downwards in top view,
y upwards in 3D, free origin). The placed Element converts to the Scene.

**The file** `*.batiment.json` (`VERSION_BATIMENT = 1`):

```
{ version, nom,
  niveaux:    [{ id, nom, elevation, hauteur, dalle, toit? }]
  murs:       [{ id, niveauId, a:{x,z}, b:{x,z}, epaisseur, hauteurPropre?, revetement? }]
  ouvertures: [{ id, murId, type, le, y, largeur, hauteur, battants, coulissant, vitre, sens,
                 charniere, dessus }]
  escaliers:  [{ id, niveauId, type, depart:{x,z}, angle, largeur, sens, contremarches, rampe }]
  pieces:     [{ id, niveauId, nom, repere, vide?, murs?, sol?, plafond? }]
  elements:   [{ id, niveauId, modelFile, nom, x, z, rotY, echelle, dims, base, colle?, y? }]
  facade?, toit }
```

- **Levels**: `elevation` is the top of the floor, `hauteur` the ceiling height, `dalle` the floor
  thickness, below the elevation. Elevations are **derived** (`recalerNiveaux`); the ground floor
  stays at 0, basements have a negative elevation.
- **Walls**: one wall per level; two walls only touch at their ends.
- **Openings**: attached to a wall; `le` is the fraction of the wall's length where their centre falls,
  `y` the sill height. Types: `porte`, `fenetre`, `baie`, `passage`.
- **Rooms**: only the name, the `repere` (an inside point) and the finishes are kept; the shape is
  recomputed. `vide: true` makes a courtyard.
- **Roofs**: one per level (`niveau.toit`, absent = flat): `{ type, pente, debord, sens, bordure,
  revetement }`. The building-level `toit` field is read back and kept, but not drawn.
- **Finishes**: `{ texture: 'int:<id>' | 'tex:<folder>' | null, couleur: '#rrggbb' | null }`.

An unreadable value takes its default, an unreadable wall is dropped, an unknown field is kept as is.
The rules common to all files are in [persisted-data.md](persisted-data.md).

**The placed building**: an Element `type: 'objet3d'`, `objType: 'batiment'`, which embeds the whole
building in `batiment`, and `batimentSource` (the source file, informative). Its display settings
(cut level, hidden parts, front walls) are in `affichage`.

## Flow

1. **Draw**: the screen converts the pointer to metres (`batiment-plan.js`), `aimanter` proposes the
   retained point (vertices, guides, angle in 15° steps, length to the centimetre; Alt turns it all
   off), then `ajouterMur` inserts it. A wall ending in the middle of another splits it in two
   (`couperMur`); a wall crossing another is refused (`croiseUnMur`).
2. **Rooms**: after each change, `actualiserPieces` walks the closed faces of the network of axes and
   reassigns names and finishes through the `repere`.
3. **Every change** goes through `modifier(b => …)` in the screen: one undo step (200 at most), then
   room update, redraw of the top view and of the preview.
4. **3D**: `construireBatiment3D` extrudes the polygons from `polygonesDesMurs`, cuts them at the
   openings, adds floors, joinery, stairs, roofs and furniture. The same builder serves the preview,
   the thumbnails and the Panels.
5. **Save**: `ecrireBatiment` then the `batiments:write` bridge. **Place**: `creerElementBatiment`
   copies the building into a new Element.

## Extending

- **An opening type**: add it to `TYPES_D_OUVERTURE` and `DEFAUTS_OUVERTURE` (`batiment.js`), its
  drawing in `batiment-3d.js` and the top view, its icon in `batiment-icones.js`.
- **A roof type**: `TYPES_TOIT` and `geometrieDuToit` (`batiment-toits.js`), then the icon.
- **A field**: add it, never rename one; read it back in `normaliserBatiment` with a default.

## Testing

`tests/batiment*.test.mjs` cover the format, drawing, rooms, openings, levels and basements, stairs,
roofs, courtyards, finishes, furniture, front walls, placement and the library. On screen: draw a
rectangle and a partition, check the two rooms, add a door, add a storey and a staircase, change the
roof, save, place in a Scene.

## Pitfalls

- **Do not let two walls touch anywhere but their ends**: rooms can no longer be derived. Go through
  `ajouterMur`, which splits the wall it touches.
- **Do not set an elevation by hand**: `recalerNiveaux` overwrites it.
- **Do not draw a building with any builder other than `construireBatiment3D`**: the placed building
  would no longer be the one in the preview.
- **Do not tie a placed building to its file**: it is a copy, editing the file must not change it.
- **Do not create one renderer per thumbnail**: WebGL contexts run out; `batiment-vignettes.js` keeps
  a single one.
