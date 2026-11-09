# "Not visible": out of frame, or hidden

*[Version française](../fr/non-visible.md)*

## Role

A Panel's Element list puts at the bottom, under "Not visible", the ones that cannot be seen in the
Panel: out of frame, or entirely hidden (behind a wall, for instance). Export credits rely on the same
decision: a non-visible Element is not credited.

## The principle: an id render

After a Panel's normal render, the same scene is rendered a second time, small (the Panel's rectangle
is at most 192 pixels), with the same camera: each Element painted a unique colour, everything else
black, with no lighting or fog. The pixels of each colour are counted inside the Panel's rectangle: an
Element is visible if at least one remains. Out of frame, partial visibility and occlusion are settled
at once, with the real geometry.

`src/visibilite-3d.js` holds the colours, the counting and the decision (pure and tested) and the
WebGL pass. `renderPanelSceneUncached3D` (`scene3d.js`) runs it right after the render, on the scene
still in place.

## What the measurement ignores

- **Transparent things hide nothing**: a mesh whose materials all let you see through (opacity under
  0.95, or transmission) is removed from the id render.
- **Bubbles hide nothing**: they are drawn in 2D over the Panel.
- **The Panel's shape is its rectangle**: a slanted Panel counts a little more than it shows, which can
  only wrongly declare visible, never the reverse.

## When in doubt, visible

An Element that could not be measured (rig not loaded yet, measurement not done yet, WebGL failure) is
**not** declared non-visible: the geometric test of the projected box takes over, which only errs on
the cautious side. A missing credit would breach a licence.

## When the measurement happens

- **Side list**: it requests the selected Panel's measurement. The first time, one extra draw is
  scheduled; afterwards every render of that Panel measures it. Only the last eight Panels requested
  are measured.
- **Export**: every Panel of the Page is measured while it is drawn, and the Page is drawn **before**
  credits are computed (`exportPage`, `draw.js`).
- **A failure is recorded, not retried**: retrying would request a render at every frame.

The cost: one extra low-resolution render and a pixel read, for measured Panels only.
