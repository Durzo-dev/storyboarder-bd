# Imported pages

*[Version française](../fr/planche-importee.md)*

> Requested by Valentin on 12 October 2026. The code: `src/planche-importee.js` (the decisions,
> tested under Node), `src/import-planche-ui.js` (the check), and the marked branches in `draw.js`,
> `events.js` and `sidebar.js`.

## What it is

An already drawn page (a scan, an export from another program) joins a Volume as a full Page: it is
read in the Reader, filed in a Chapter, exported, and each of its Panels can be described. **Nothing
in it can be changed**: neither the Panels nor the drawing. Only the framing of the whole is set.

## The gesture

Right-click an empty area of the displayed Page, **"Import a page"** (under "Create a panel" and "Create a speech bubble", and nowhere else). Pick an image (PNG, JPG, WebP); the
application **detects the Panels**, then a **check** window shows them on the image: move them,
resize them by a corner, draw new ones in an empty area, remove them (Delete). The "Sensitivity"
slider runs the detection again, and replaces the changes. **Nothing is written before "Import the
page"**: neither the Page nor the image in the Images folder. The new Page goes right after the
displayed one, in the same Chapter.

## The detection

A recursive cut ("XY-cut"): the background colour is read around the edge of the image, a gutter is
a band of lines almost entirely of that colour, and the image is cut along the horizontal bands then
the vertical ones, as long as there are any. The remaining pieces, trimmed of their margins, are the
Panels; the too small ones (page number, signature) are dropped. Reading order (rows, then left to
right) gives the numbers.

**What it cannot do**, which is why there is a check: a bubble or a drawing that crosses a gutter
blocks it (two Panels become one); a borderless Panel on a white background loses its empty
margins; a slanted Panel is returned as its rectangle. Its thresholds (`DETECTION`) were set on
synthetic pages, not measured on a corpus.

**Bubbles are not detected** (decided with Valentin): nothing could be done with them, since they
cannot be changed; reading their text would be another piece of work.

## What is persisted

Two **added** fields, nothing renamed:

- on the Page, `importee: { largeur, hauteur }` (the image size), plus the framing of the whole,
  under the names of a Panel image's: `imageAnchorX`, `imageAnchorY`, `imageZoom` (absent =
  centred, 1);
- on each Panel, `imageFile` (the Page's image) and `regionImage: { x, y, w, h }`, its area in the
  image, as fractions.

**The image name lives on the Panels**, not on the Page: this gives the imported Page, without one
more line, what Panel images already do (preloading, Images section, renaming, Missing files). A
second copy on the Page would have fallen behind at the first rename. `casePorteUneImage3D`
nevertheless answers **no** for these Panels: it governs the menus of a Panel with an image (Image,
Framing, right-click reframing), which they do not have.

**A Panel's place is derived.** `x`, `y`, `w`, `h` and `pts` are recomputed at every draw from the
region and the framing (`placerCasesImportees`). A version of the application that ignores all this
reads ordinary Panels, in their place, without the image.

## The framing

At 1×, the image is **whole** ("contain"), not "cover" like a Panel image: a page almost never has
the exact proportions of the Volume's format, and covering would crop the edge Panels. The bands
left over take the Page's background colour. Zoom goes from 1 to 4; **dragging the Page** moves the
image (a click, under 3 pixels, only selects); "Recentre" removes the three fields.

## What is locked

On an imported Page, a click selects a Panel, dragging frames the whole, and nothing else: no
context menu, no creation, no Delete, no Camera mode. A Panel's menu is reduced to **Dimensions**
and **Description**; the Page menu shows the **Framing**, and the list of Panels where **each
description is typed directly**.
