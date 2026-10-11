# The Reader

*[Version française](../fr/lecteur.md)*

Asked for by Valentin in October 2026: read a Volume or a Chapter straight through, like an album,
without leaving the application. Right-click a Volume or a Chapter → "Read".

## What it does

The Reader takes the Page's place (same footprint as the Model editor): the page in the centre, its
menu on the right, a thumbnail strip at the bottom. Pages turn with a click on the left or right
edge, or with the arrows; Space starts or stops automatic scrolling, F goes full screen (bar and menu
hidden), Home and End go to the ends, Esc leaves (full screen first). While reading, the Page's
shortcuts are swallowed, so as not to act on what is hidden underneath.

The menu: one or two pages; reading to the right (comics) or to the left (manga); in two-page mode,
first page on the right or on the left (a blank page fills the gap); automatic scrolling and its
speed (seconds per page, or per panel in guided view); guided view panel by panel (in the manner of
Comixology's "Guided View", in Panel number order); whole page or fit width; dark, grey or light
background; thumbnail strip. The options are remembered (`lecteur:options`).

## What lives where

- `src/lecteur.js`: the decisions, pure and tested. The spreads (which page on the left, which on the
  right, where the blank page goes depending on the direction and the first page), the meaning of the
  arrows and edges (in manga, left moves forward), the guided-view steps and their framing.
- `src/lecteur-ui.js`: the screen, the menu, the thumbnails, the keyboard and full screen.
- `rendrePlancheEnImage` (draw.js): a Page drawn on its own, by the same `drawContent` as the export,
  after loading its models and images.

## Cost

Each Page is drawn on demand, at the displayed height, and kept while reading (sixteen at most).
Thumbnails are taken from the large drawings when they exist, otherwise prepared one by one in the
background. Drawing a Page off screen redoes its 3D renders at that size: going back to the Page
afterwards costs one more render.
