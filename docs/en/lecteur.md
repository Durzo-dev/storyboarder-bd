# The Reader

*[Version française](../fr/lecteur.md)*

Asked for by Valentin in October 2026: read a Volume or a Chapter straight through, like an album,
without leaving the application. Right-click a Volume ("Read this volume") or a Chapter ("Read this
chapter"); reading starts at the displayed Page if it belongs to it.

## What it does

The Reader takes the Page's place (same footprint as the Model editor): the page in the centre, its
menu on the right, a thumbnail strip at the bottom.

**The menu** is titled with the Volume (and the Chapter), with the position below: "Page 1 · 1&2/9"
gives the number of the first Page shown, then the RANKS of the Pages on screen within what is being
read (two in two-page mode, without the blank page), over the total. The close button sits next to
the title, as in the other right-hand menus.

**Turning pages.** All the space left of the page and all the space right of it are clickable (at
least 64 px when the page fills the width); the arrow sits 32 px from the page, the same gap on both
sides. The side with no more pages shows no zone. On the keyboard: ← → (in manga, left moves
forward), Page Up / Page Down, Home and End; Space starts or stops automatic scrolling; F toggles full
screen (the menu disappears); Esc leaves full screen, then the Reader. While reading, the Page's other
shortcuts (E, C, T, WASD, [ ]) are swallowed, so as not to act on what is hidden underneath. Clicking
a Page, a Scene, an add button or the Editor in the left menu or the top bar closes the Reader;
expanding a Volume or a Chapter does not.

**The options** (remembered, `lecteur:options`):

- one or two pages; in two-page mode, first page on the right or on the left (a blank page fills the
  gap, in the background colour, hence invisible);
- whole page or fit width;
- **book view**, ticked by default: each page has its shadow, the two-page spread a binding shadow,
  and moving one step forward or back TURNS the page around the binding. Unticked, the pages sit flat
  against each other, with no effect or animation. A jump (thumbnail, Home, End) turns nothing;
- guided view panel by panel, in the manner of Comixology's "Guided View": the view glides from Panel
  to Panel in their number order, then moves to the next Page (one page, no book view);
- reading to the left or to the right (comics);
- automatic scrolling: its speed (1 to 60 seconds per page, or per panel in guided view), then the Play
  button; it stops by itself at the last page;
- dark, grey or light background; thumbnail strip; full screen.

## What lives where

- `src/lecteur.js`: the decisions, pure and tested. The spreads (which page on the left, which on the
  right, where the blank page goes depending on the direction and the first page), the meaning of the
  arrows and edges, the side that turns in book view (`coteQuiTourne`), the guided-view steps and
  their framing.
- `src/lecteur-ui.js`: the screen, the menu, the thumbnails, the keyboard, full screen, and the
  page-turn animation (`tournerLaPage`: a two-sided leaf pivots around the binding, the old page on the
  front, the incoming one on the back; a cover keeps the old page on the other side until the leaf
  passes the vertical).
- `rendrePlancheEnImage` (draw.js): a Page drawn on its own, by the same `drawContent` as the export,
  after loading its models and images.

## Size and full screen

Going full screen sends several size changes in a row. Redrawing each one made two or three visible
jumps (each asynchronous drawing landed at a size already outdated). Now each change RE-FITS what is
on screen, without redrawing (the guided view's transition is cut while re-fitting), and the drawing
at the right resolution comes once, a quarter of a second after the size has settled.

## Cost

Each Page is drawn on demand, at the displayed height, and kept while reading (sixteen at most).
Thumbnails are taken from the large drawings when they exist, otherwise prepared one by one in the
background. Drawing a Page off screen redoes its 3D renders at that size: going back to the Page
afterwards costs one more render.

## Later

Continuous vertical reading, like webtoons (#451 in TACHES.md).
