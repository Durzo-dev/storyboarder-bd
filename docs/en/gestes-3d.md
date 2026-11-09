# 3D gestures: moving and turning

*[Version française](../fr/gestes-3d.md)*

Every place where something is moved or turned in 3D (the view and objects), with its controls and
what they do (speed, step, bounds). Values come from the code (files listed at the end).

Units: one 3D world unit is a **metre**. "One notch" of the wheel is a `deltaY` of 100.

## In short

| Place | Turn the view | Move the view | Zoom | Move the object | Turn the object |
|---|---|---|---|---|---|
| Store, Sketchfab model | Sketchfab's viewer | same | same | — | — |
| Store, the application's 3D preview | left drag | right drag | wheel | — | — |
| Element modal (preview) | — | — | wheel | — | the modal's sliders |
| Model editor | left drag (in empty space) | right drag | wheel | — | drag a joint (pose) |
| Building editor, plan | — (top view) | hold right or middle button | wheel | left drag | right-click, held right button, buttons, fields |
| Building editor, 3D preview | left drag | right drag | wheel | — | — |
| Panel, Camera mode | left drag | right drag, Ctrl + drag, middle drag, or arrows | wheel | left drag (the Element) | the modal's sliders |
| Scene | left drag in empty space | right drag, or arrows | wheel | left drag (the Element) | the modal's sliders |

## The shared settings

**3D gestures**, in the Configuration: two sliders from 25 to 200 %, in steps of 25 (100 % by
default), saved in the application's preferences (not in the Project).

| Setting | Value at 100 % | What it gives |
|---|---|---|
| 3D rotation speed | 0.0025 radian per screen pixel | 100 px of drag ≈ 14° |
| 3D move speed | 0.5 | the target follows the mouse at half its speed |

They apply to: the store's 3D preview (and the textures', and library buildings'), the building
editor's 3D preview, the Model editor (the view), the Panels' and Scenes' camera. They do **not**
apply to: the Model editor's joints, the building editor's furniture, the zooms, the modals'
sliders.

**A Panel's sensitivity** (`camRotSensitivity`, `camPanSensitivity`, 1 by default) also multiplies
the rotation and the move of ITS camera.

## The store

### Sketchfab model

The preview is **Sketchfab's viewer**, embedded as is: its gestures are its own (left drag to turn,
right drag to move, wheel to zoom, double-click to aim at a point). The application does not set
them, and the “3D gestures” setting does not apply.

### The application's 3D preview

For Poly Haven, “My models”, a library building, and a texture (sphere or flat, with the toggle at
the top right): `src/store-apercu-3d.js`. Its gestures were copied from Sketchfab's, so that every
store preview handles the same.

| Gesture | Effect | Values |
|---|---|---|
| Left drag | turn around the model | shared speed; tilt bounded to ±1.4 rad (≈ ±80°) |
| Right drag | move the target | shared speed (the model follows the mouse) |
| Wheel | move closer, further | distance × e^(Δ × 0.001), i.e. ×1.105 per notch; from 0.25 to 4 times the framing distance |

No keyboard. Drawing happens on demand (nothing loops).

## The Element modals

The Character modal and the Object modal have a **preview** that only the wheel touches:

| Gesture | Effect | Values |
|---|---|---|
| Wheel on the preview | zoom the preview (not the Element) | shared zoom (×1.105 per notch), from 0.2 to 6 |

The Element's **orientation** is set by sliders, from −180° to 180° by the degree, each with a
**field in degrees** next to it (`src/orientation-champs.js`), and
“Set upright” (Tilt and Lean back to zero, Turn kept):

| Modal | First slider | Second | Third |
|---|---|---|---|
| Character, Object, Room | “Turn” → `rotY` | “Tilt” → `rotX` | “Lean” → `rotZ` |
| Placed building | “Turn” → `rotY` | greyed | greyed |

The same names, in the same order, as the building editor.

Position is set by fields (depth, height…) and the “Stuck to the ground” box.

## The Model editor

It poses a Character, an Animal or an imported model (`src/persona-editor.js`). It does not change
the Element's orientation in its Panel: it sets its joints.

| Gesture | Effect | Values |
|---|---|---|
| Left drag in empty space | turn around the figure | shared speed, independent of zoom; gesture recognised after 3 px |
| Left click in empty space, no drag | deselect the joint | |
| Right drag | move the view | shared speed |
| Wheel | zoom | shared zoom (×1.105 per notch), from 0.25 to 6 |
| Wheel, a joint selected | go to the joint's next field | the view no longer zooms |
| Drag a handle (joint) | turn it | see below |
| Esc | close the editor | |

**Turning a joint**: two gestures, chosen from the view.
- **Straight drag** when the joint's axis is seen from the side: 0.5° per pixel (360 px = half a
  turn), along the direction in which the joint turns on screen.
- **Circular gesture** when the axis points at the eye: the angle swept by the mouse around the
  handle, accumulated frame after frame, which avoids the reversal past half a turn.

Either way the angle is bounded: ±180°, or the joint's limits for an Animal (a knee only bends one
way). No snapping, no step.

## The building editor

### The plan

The top view (`src/batiment-editeur-ui.js`). Its view does not turn.

| Gesture | Effect | Values |
|---|---|---|
| Wheel | zoom towards the cursor | shared zoom (×1.105 per notch) |
| Ctrl + wheel | zoom, when the wheel is used for something else (see below) | |
| Hold right or middle button, in empty space | move the view | follows the mouse |
| Right-click, nothing selected | take the Wall tool; with the Wall tool and no line, back to Selection | |
| ↑ / ↓, Page Up / Page Down | change level | |
| V, N, D, H, E, B, P, Enter, Del, Esc | tools, levels, windows, end a line, delete, leave | |

### The furniture

An element placed in a room (`src/batiment-mobilier.js`). With the Selection tool:

| Gesture | Effect | Values |
|---|---|---|
| Left drag | move it | snaps to a wall face within 25 cm (two walls in a corner); **Alt**: no snapping |
| Right-click | a quarter turn | clockwise seen from above |
| Hold right button | turn it on the active axis | Y: like a knob (the angle swept around it, accumulated); X: up / down, Z: left / right, at 0.5° per pixel |
| … during that gesture | snaps every 90° (within 6°); **Ctrl**: by 15°; **Alt**: free | |
| Wheel (stuck to the floor) | make it bigger or smaller | ×1.1 per notch, from ×0.2 to ×5 |
| Wheel (raised) | raise or lower it | 5 cm per notch; **Shift**: 1 cm |
| Del | delete it | |

In its menu: the **axes** (a click on X, Y or Z chooses the active axis), the three angles to type in
degrees, “Turn by 90°”, “Straighten” (the arrival orientation), the size slider (logarithmic, ×1 in
the middle), the elevation, “Stuck to the floor”, “Can pass through walls”. Without the latter, a
gesture that pushes it into a wall turns it **red**, and it goes back on release; a one-shot change
(button, notch, field) is simply refused.

### The staircases

| Gesture | Effect | Values |
|---|---|---|
| Staircase tool: press then drag | place the foot, then orient | by 15° |
| Staircase tool: right-click | a quarter turn of the staircase to place | |
| Staircase tool: wheel | change type | Ctrl + wheel: zoom |
| Selection: drag | move it | snaps to walls within 15 screen px; **Alt**: no snapping |
| Selection: R | a quarter turn | shifted if needed to fit |
| Del | delete it | |

### The openings

| Gesture | Effect | Values |
|---|---|---|
| Opening tool: hover a wall, click | place it | |
| Opening tool: right-click | change how a door opens | four positions |
| Opening tool: wheel | change type | Ctrl + wheel: zoom |
| Selection: drag | slide it along its wall | |
| Selection: wheel | raise or lower it | 5 cm per notch; **Shift**: 1 cm; close notches (under 0.8 s) make one undo step |

A **wall corner** is dragged with its walls (**Alt**: no snapping).

### The editor's 3D preview

The same gestures and values as the store's 3D preview (left drag, right drag, wheel). Its buttons:
cut at the current level, minimise, maximise.

## The Panels

### The Panel, outside Camera mode

Dragging a Panel moves or resizes it on the Page (the layout). Holding the right button scrolls the
Page; a right-click opens the context menu.

### Camera mode

Entered with the **C** key or the “Camera” context menu.

| Gesture | Effect | Values |
|---|---|---|
| Left drag | turn the camera | shared speed × the Panel's sensitivity; tilt bounded to ±85° |
| Right drag, Ctrl + left drag, or middle drag | move the camera; a right click without moving opens the menu | shared speed × distance × sensitivity |
| Wheel | move forward, back, towards the cursor | shared zoom (×1.105 per notch); distance from 0.3 to 6,000; very close, it goes through |
| Arrows, or W A S D | move the camera | 4 % of the distance per press × sensitivity |

Camera moves are **smoothed** (it reaches its target in a few frames).

### Elements in a Panel

| Gesture | Effect | Values |
|---|---|---|
| Left drag an Element | move it in the plane facing the camera | follows the real camera (a ray); it does not go under the ground |
| Wheel, an Element selected | move it forward or back along the camera's axis | 0.72 m per notch |
| Right button held on the selected Element | turn it around the vertical | depending on the camera when the gesture starts (`rotation-objet-3d.js`): from the front (less than 45° of downward tilt), a turntable, horizontal drag at 0.5°/px; at an angle or from above, a rotary knob, the angle the mouse sweeps around it, accumulated (the straight drag reversed halfway round there, reported); 90° snap (6°), Ctrl by 15°, Alt free, Shift five times finer; without moving, the menu |
| R | a quarter turn, clockwise seen from above | |
| Its modal's sliders | the three angles | ±180°, by the degree, field in degrees |

An opening snapped to a wall follows its wall; moving a wall takes its openings along.

## The Scenes

A Scene no longer has a Camera mode: its camera gestures are always on.

| Gesture | Effect | Values |
|---|---|---|
| Left drag in empty space | turn the camera | shared speed; gesture recognised after 3 px (a plain click selects the Scene) |
| Left drag next to the selected Element | turn AROUND it | a plain click deselects it |
| Hold right button | move the camera | shared speed; without moving, the context menu opens on release |
| Wheel | zoom towards the cursor | shared zoom (×1.105 per notch) |
| Arrows, or W A S D (nothing selected) | move the camera | 4 % of the distance per press |
| Left drag an Element, wheel | as in a Panel | |

## What has no 3D gesture

The Reader, the thumbnails, the Fonts window. A Panel's image has its own gestures (wheel: zoom the
image; drag: its anchor), in 2D.

## The common grammar

- **The view** (previews, Model editor, building preview, Panels in Camera mode, Scenes): left drag to
  turn, right drag to move, wheel to zoom. Shared speeds (`VITESSE_ROTATION_3D`,
  `VITESSE_DEPLACEMENT_3D`), adjustable in Settings.
- **A single zoom**: `facteurDeZoom3D` (`utils.js`), proportional to the wheel (×1.105 per notch);
  `deltaMolette3D` converts lines and pages to pixels and counts Shift + wheel. Ctrl + wheel always
  zooms. A building element's size keeps ×1.1 steps: it is a property, not a view.
- **The wheel acts on what is selected** when something is (an Element's depth, a joint's field, an
  opening's height, a piece of furniture's size); otherwise it zooms.
- **Turning an object**: right button held on the selected object, R for a quarter turn. A single
  engine (`rotation-objet-3d.js`): a turntable from the front, a rotary knob at an angle or from above;
  90° snap (within 6°), Ctrl by 15°. Speed: "Object rotation speed" (`degresParPixelObjet3D`).
- **Modifiers**: Alt removes snapping; Shift refines; Ctrl gives 15° steps.
- **A 3 px threshold** separates a click from a drag.
- **Delete** removes what is selected; **Esc** deselects, then leaves.
- **Orientations** are named Turn (`rotY`), Tilt (`rotX`), Lean (`rotZ`) everywhere, with a field in
  degrees and "Set upright".
- **Controls** at the top of the menu of a Panel, its Camera mode and a Scene (`commandes-3d.js`), and
  tooltips on the previews.

## Known differences

- **The right button** moves the view everywhere, except on a selected object, which it turns; in a
  Panel outside Camera mode, it scrolls the Page.
- **The quarter turn**: R for a staircase or an Element, right click or a button for a building
  element.
- **Angle snapping** does not exist on a joint or in the modals.
- **The direction of drag rotations**: the store preview subtracts the horizontal drag from its angle,
  the Model editor and the Panel camera add it; to check on screen that "drag right" turns the same way
  everywhere.

## Sources

- `src/utils.js`: the shared speeds (`VITESSE_ROTATION_3D`, `VITESSE_DEPLACEMENT_3D`,
  `deplacement3D`), the joint gestures (`POSE_DRAG_DEG_PER_PX`, `straightDragDegrees3D`,
  `accumulateSweepDegrees3D`, `dragJointStep3D`).
- `src/store-apercu-3d.js`: the store's 3D preview (`orbite3D`, `zoom3D`, `cadrage3D`).
- `src/modals.js`: the Element modals' previews; `src/index.html` and `src/events.js`: their
  orientation sliders.
- `src/persona-editor.js`: the Model editor.
- `src/batiment-editeur-ui.js`, `src/batiment-mobilier.js`, `src/batiment-escaliers.js`,
  `src/batiment-ouvertures.js`: the building editor.
- `src/events.js`: Panels and Scenes (wheel, `panelCamRotate`, `panelCamPan`, `move`, arrows, C key).
