# Image in a Panel

*[Version française](../fr/panel-images.md)*

## Role

A Panel holds **either an image or 3D, never both**: a scanned sketch, a photographic reference, a
hand-drawn panel. The image covers the Panel while keeping its proportions, and can be reframed
(move, zoom).

## Files

| File | What it holds |
|---|---|
| `src/image-store.js` | The decisions: naming, collisions, `casePorteUneImage3D`, framing fields. |
| `src/image-library.js` | The left menu's Images section: uses, renaming, deletion from disk. |
| `src/draw.js` | Drawing in `drawContent` (screen and export), `ancrageApresGlissement3D` (reframing). |
| `src/events.js`, `src/sidebar.js` | Context menus, reframing mode, wheel, Image and Framing sections. |
| `electron/main.js` (`images:*`) | Input and output, in `<Projects folder>/Images`. |

## Data

On the Panel, added fields:
- `imageFile`: the **name** of the file in `<Projects folder>/Images`, never a path;
- `imageAnchorX`, `imageAnchorY`: the framing, as a **fraction** of the available play (0 to 1, 0.5 =
  centred). A fraction stays right when the Panel or the image changes size, and staying within
  [0, 1] guarantees no empty band appears;
- `imageZoom`: from 1 (the covering framing) to 4.

Absent = centred, 1×. "Recentre" **deletes** the three fields: a recentred Project is identical to one
never reframed.

## The rules

- **Exclusivity is enforced upstream**: a Panel containing Elements does not offer "Insert an image"
  (clear it first); a Panel with an image accepts no Element, loaded Scene or imported model. The
  context menu removes "Add", "Load a Scene" and "Import a Model".
- **Forbidden on a Scene's canvas** (`isLockedScenePanel`): a Scene is a 3D set.
- **The file is copied** into the `Images` folder, like an imported model; the Panel only keeps its
  name. Formats: PNG, JPG, WebP (`sanitizeImageName` keeps the original extension, lower-cased).
- **Detaching does not delete**: "Remove the image" and "Clear panel" detach the image without
  confirmation (Ctrl+Z brings it back, framing included); the file stays. Deleting from disk happens
  in the Images section, after confirmation.
- **A missing file does not clear the Panel**: it shows "Image not found" and returns to normal if the
  file comes back.
- **Bubbles stay**: they are Page objects, not part of the Panel.
- **The right-hand menu** of a Panel with an image loses Ground and Elements, and gains the **Image**
  (the file, change, remove) and **Framing** (zoom, recentre) sections.

## Reframing

- **"Move the image" mode** (right-click or Framing section): dragging moves the image within its
  Panel. It is left with Esc, a click outside the Panel, or the disappearance of its object; releasing
  the button does not leave it. The mode is visible (dashed border, hand cursor).
- **Right button held** on a selected Panel with an image: the same drag, without a mode. Beyond
  3 pixels of movement, the context menu does not open.
- **The wheel** zooms if the Panel is selected **and** under the cursor; it shares step, bounds and
  direction with the zoom slider and the Camera wheel.
- **"Recentre"** only appears once the framing has been touched.

The drag arithmetic is a pure function, `ancrageApresGlissement3D`.

## The Images section

Twin of the Models section: two groups ("in Panels", "unused"; an image never lives in a Scene). Each
listed place is clickable and leads to its Panel. Renaming an image rewrites `imageFile` in the
**open** Project only: unlike models, there is no log that repairs other Projects when they open.

## Cost

Drawing an image costs nothing measurable, even a very large one; the real cost is the memory of the
decoded image (about 92 MB for 6000×4000). Images are not reduced on import. Details in
[rendering-performance.md](rendering-performance.md).

## Testing

`tests/image-store.test.mjs` and `tests/image-library.test.mjs`. On screen: insert an image into an
empty Panel, reframe (mode, right button held, wheel), recentre, clear the Panel then Ctrl+Z, delete
the file from disk and check "Image not found".
