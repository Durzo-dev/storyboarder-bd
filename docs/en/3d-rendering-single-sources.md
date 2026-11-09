# 3D rendering: single sources

*[Version française](../fr/3d-rendering-single-sources.md)*

## The rule

A 3D Element is described in several places at once: the geometry drawing it, the hole cut for it, its
on-screen selection box, the camera target. **Each value has a single function computing it**, and all
those places call it. Two separate computations of the same value agree the day they are written, then
diverge, often partially (right horizontal position, wrong vertical one), which keeps the gap invisible
until the Element is moved.

## The authoritative functions

| Question | Function | File |
|---|---|---|
| Where is a wall item placed on a wall Tracé? | `wallOpeningWorldPosOnTracé3D` | `scene3d.js` |
| …and its **centre** (box, camera)? | `tracéOpeningWorldCenter3D` | `scene3d.js` |
| How big is that wall item? | `tracéOpeningSize3D` | `scene3d.js` |
| What scale for its rig? | `tracéOpeningRigScale3D` | `scene3d.js` |
| How tall is a wall Tracé? | `tracéWallHeight3D` | `scene3d.js` |
| How thick? | `tracéWallThickness3D` | `scene3d.js` |
| Where is the hole to cut? | `tracéOpeningHole3D` | `scene3d.js` |
| Point and tangent on a Tracé | `tracéFrameAtFrac3D` | `scene3d.js` |
| Thickness of walls from the former Build tool | `BUILD_WALL_THICKNESS_RATIO_3D` | `constants.js` |

**None of these values is recomputed by hand.** If a formula is needed elsewhere, call the function; if
it does not fit, change it, in the one place it lives.

Points to know:
- the walk along the path serves rendering **and** the camera: without it, the camera would centre on
  stale stored coordinates;
- a wall item's vertical span (wall height minus the item's height) applies to the rig **and** to the
  hole;
- a wall item's size is independent in width and height (`tracéOpeningSize3D`), never a uniform scale
  taken from the height;
- a wall Tracé's default height is written in one place only, read by `tracéWallHeight3D`.

## Finding a gap

- **Measure before fixing**: a throwaway script importing the real modules (with
  `tests/helpers/dom-stub.mjs`) and printing each place's values over a parameter range; a gap growing
  with a parameter points at the faulty copy.
- **Mutation testing** (see [testing-method.md](testing-method.md)).

## Invariants locked by the tests

`tests/scene3d.test.mjs` holds an **invariant** suite sweeping both fractions (`wallAlongFrac`,
`wallYFrac`) over three low-wall shapes (straight, bent, loop) and checking that the hole, the wall
item, the render box, the camera and the frame all point at the same place.

When adding a value derived from another, add it to those invariants too.

## The same principle outside 3D

The application's version lives in four files; `tools/bump-version.mjs` keeps them in step and
`tests/version.test.mjs` requires it (see [versioning.md](versioning.md)).
