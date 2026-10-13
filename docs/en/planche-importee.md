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

Right-click an empty area of the displayed Page, **"Import a page"** (under "Create a panel" and
"Create a speech bubble", and nowhere else). Pick an image (PNG, JPG, WebP): the image is stored,
the Panels detected, and the new Page opens right after the displayed one, in the same Chapter,
**in panel correction**.

**Correction happens on the Page** (requested on 13 October 2026, the first version used a modal):
a click selects a Panel (outside the Panels: deselects), dragging it moves it, dragging a corner
resizes it, a **right-click without dragging creates one** (the only way), Delete removes it, Esc
finishes; on leaving, nothing stays selected. The Page menu carries the **"Detected
panels"** section: "Edit the panels" goes back to it at any time, "Done" leaves (the sensitivity
slider was removed: correction is enough). Numbers follow reading order at import; afterwards they
are changed by **dragging** the rows of the Page menu list (except from their field), and a click on
a row **highlights the Panel** (a second click deselects it). An import is undone with Ctrl+Z.

## The detection

Rewritten on 13 October 2026 on fifteen real pages provided by Valentin (manga, Franco-Belgian,
comics, double spreads, screenshots with their frame), kept outside the repository in
`apercus/planches-test/`. The first version (a cut on full lines of paper only) found a single
Panel on most of them.

1. **The paper** is the light (else dark) grey level of the image's long uniform runs; the **frame**
   of a screenshot or a viewer is removed.
2. **The outside paper**: what can be reached from the edge without crossing ink (margins and
   gutters). Everything else belongs to the Panels, including the white inside of a manga Panel.
3. Its **components**, after a slight erosion that cuts thin strokes crossing a gutter.
4. Each is **cut again** along its separators: a band of outside paper closed by an overflow, a
   thin band of a uniform colour (dark gutter), or, in a box with almost no paper, a straight
   **inked edge** (adjoining Panels of a full-bleed comic).
5. Reading order gives the numbers; a **double spread** is read page by page.

**What it cannot do**, hence the check: a full-page illustration under Panels laid on top, slanted
Panels (returned as their rectangle), a Panel inset in another, borderless Panels on white paper
(they break up).

**Bubbles are not detected** (decided with Valentin).

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
left over take the Page's background colour. Zoom goes from 1 to 4; **holding the right button** on the Page
moves the image, the Panel outlines hiding during the gesture; "Recentre" removes the three fields.

## What is locked

On an imported Page, a click selects a Panel, dragging frames the whole, and nothing else: no
context menu, no creation, no Delete, no Camera mode. A Panel's menu is reduced to **Dimensions**
and **Description**; the Page menu shows the **Framing**, and the list of Panels where **each
description is typed directly**.
