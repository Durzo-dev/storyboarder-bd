# 3D gestures: moving and turning

*[Version française](../fr/gestes-3d.md)*

> A survey, made in the code on 26 October 2026 (v1.11.163), of EVERY place where something is
> moved or turned in 3D: the view (the camera) and objects (a model, an element, a staircase). For
> each: the controls (mouse, keyboard, buttons) and what they do (speed, step, bounds). It ends with
> the common points, the differences, and recommendations to make it consistent. Values come from
> the code (files listed at the end); what needs an on-screen check is marked **to check**.
>
> Units: one 3D world unit is a **metre**. “One notch” of the wheel is a `deltaY` of 100, the usual
> value of a notched mouse wheel on Windows.

## In short

| Place | Turn the view | Move the view | Zoom | Move the object | Turn the object |
|---|---|---|---|---|---|
| Store, Sketchfab model | Sketchfab's viewer | same | same | — | — |
| Store, the application's 3D preview | left drag | right drag | wheel | — | — |
| Element modal (preview) | — | — | wheel | — | the modal's sliders |
| Model editor | left drag (in empty space) | right drag | wheel | — | drag a joint (pose) |
| Building editor, plan | — (top view) | hold right or middle button | wheel | left drag | right-click, held right button, buttons, fields |
| Building editor, 3D preview | left drag | right drag | wheel | — | — |
| Panel, Camera mode | left drag | Ctrl + drag, middle drag, or arrows | wheel | left drag (the Element) | the modal's sliders |
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
| Wheel on the preview | zoom the preview (not the Element) | ×1.08 per notch, from 0.2 to 6 |

The Element's **orientation** is set by sliders, from −180° to 180° by the degree:

| Modal | First slider | Second | Third |
|---|---|---|---|
| Character | “Horizontal rotation” → `rotY` | “Tilt” → `rotX` | “Roll” → `rotZ` |
| Object | “Horizontal rotation” → **`rotX`** | “Tilt” → **`rotY`** | “Roll” → `rotZ` |
| Room | “Horizontal rotation” → `rotY` | → `rotX` | → `rotZ` |
| Placed building | “Horizontal rotation” → `rotY` | greyed | greyed |

**Inconsistency found**: in the Object modal, “Horizontal rotation” sets `rotX` and “Tilt” sets
`rotY`. The renderer turns an Element around the vertical with `rotY`: both labels are therefore
most likely swapped there (**to check** on screen).

Position is set by fields (depth, height…) and the “Stuck to the ground” box.

## The Model editor

It poses a Character, an Animal or an imported model (`src/persona-editor.js`). It does not change
the Element's orientation in its Panel: it sets its joints.

| Gesture | Effect | Values |
|---|---|---|
| Left drag in empty space | turn around the figure | shared speed, independent of zoom; gesture recognised after 3 px |
| Left click in empty space, no drag | deselect the joint | |
| Right drag | move the view | shared speed |
| Wheel | zoom | ×1.12 per notch (whatever the wheel), from 0.25 to 6 |
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
| Wheel | zoom towards the cursor | × e^(−Δ × 0.0015), i.e. ×1.16 per notch |
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
| Ctrl + left drag, or middle drag | move the camera | shared speed × distance × sensitivity |
| Wheel | move forward, back, towards the cursor | ×1.08 per notch; distance from 0.3 to 6,000; very close, it goes through |
| Arrows, or W A S D | move the camera | 4 % of the distance per press × sensitivity |

Camera moves are **smoothed** (it reaches its target in a few frames).

### Elements in a Panel

| Gesture | Effect | Values |
|---|---|---|
| Left drag an Element | move it in the plane facing the camera | follows the real camera (a ray); it does not go under the ground |
| Wheel, an Element selected | move it forward or back along the camera's axis | 0.72 m per notch |
| Turn | only with its modal's sliders | ±180°, by the degree |

An opening snapped to a wall follows its wall; moving a wall takes its openings along.

## The Scenes

A Scene no longer has a Camera mode: its camera gestures are always on.

| Gesture | Effect | Values |
|---|---|---|
| Left drag in empty space | turn the camera | shared speed; gesture recognised after 3 px (a plain click selects the Scene) |
| Left drag next to the selected Element | turn AROUND it | a plain click deselects it |
| Hold right button | move the camera | shared speed; without moving, the context menu opens on release |
| Wheel | zoom towards the cursor | ×1.08 per notch |
| Arrows, or W A S D (nothing selected) | move the camera | 4 % of the distance per press |
| Left drag an Element, wheel | as in a Panel | |

## What has no 3D gesture

The Reader, the thumbnails, the Fonts window. A Panel's image has its own gestures (wheel: zoom the
image; drag: its anchor), in 2D.

## Common points

- **A shared view grammar** in the store preview, the Model editor, the building editor's preview
  and the Scenes: left drag to turn, right drag to move, wheel to zoom, taken from Sketchfab.
- **A shared speed** for turning and moving the view (0.0025 rad/px and 0.5), adjustable in the
  Configuration.
- **The wheel acts on what is selected** when something is: an Element's depth (Panel), a joint's
  field (Model editor), an opening's height, an element's size or elevation (building editor);
  otherwise it zooms.
- **Alt removes snapping** wherever there is some (building editor: draw, place, move, turn).
- **Shift refines** (1 cm instead of 5); **Ctrl** gives 15° steps or gives the wheel back to zoom.
- **A 3 px threshold** separates a click from a drag (Model editor, Scenes).
- **Del** deletes what is selected; **Esc** deselects, then leaves.

## Differences and inconsistencies

1. **The right button**: it moves the view everywhere, EXCEPT on a building-editor element, where it
   turns it. In a Panel outside Camera mode, it scrolls the Page. The same gesture does not mean the
   same thing from one screen to another.
2. **Moving a Panel's camera** uses Ctrl + left drag or middle drag, while Scenes and previews use
   right drag.
3. **Five different zooms**: ×1.105 (previews), ×1.08 (Panels, Scenes, modals), ×1.12 (Model
   editor), ×1.16 (building plan), and ×1.1 for an element's size. Some follow the wheel (`e^Δ`),
   others count fixed notches: a notchless wheel (touchpad) does not behave the same everywhere.
4. **Two rotation speeds**: the view turns at 0.14° per pixel (adjustable), a joint or an element at
   0.5° per pixel (not adjustable), three and a half times faster.
5. **Turning an object** has no gesture in Panels and Scenes (sliders only), while the building
   editor has four (right-click, held right button, buttons, fields) and the Model editor one (for
   joints).
6. **Angle snapping**: 90° (6°) and Ctrl 15° on a building element; 15° only when placing a
   staircase; none on a joint nor in the modals.
7. **Orientation labels**: “Roll” in the modals, “Lean” in the building editor; and the Object modal
   most likely ties “Horizontal rotation” to the wrong axis (**to check**).
8. **The quarter turn**: R for a staircase, right-click or button for an element, nothing elsewhere.
9. **The direction of drag rotations**: the store preview subtracts the horizontal drag from its
   angle, the Model editor and the Panels' camera add it. The frames differ, so the on-screen result
   may be the same: **to check** that “drag right” turns the same way everywhere.
10. **The “3D gestures” preference** covers neither joints nor furniture.

## Recommendations

**1. One view grammar, wherever there is a free camera.** Left drag in empty space: turn; right
drag: move; wheel: zoom; arrows: move by steps. A Panel's Camera mode would move to right drag (Ctrl
+ drag and middle drag staying as alternatives), like Scenes and previews.

**2. One object grammar, wherever an object is handled.** Left click: select; left drag: move;
**held right button ON the selected object: turn it** (in empty space, it stays the view move);
short right-click on it: a quarter turn; R: a quarter turn; wheel on it: its property (depth, size,
height); Del; Esc. This is already the building editor, without the conflict of point 1 of the
previous list: the right button only turns what is selected. Panel and Scene Elements would finally
gain a rotation gesture.

**3. A single object-rotation engine**, the joints', which has proven itself: straight drag at a
fixed speed when the axis is seen from the side, accumulated circular gesture when it points at the
eye. It would replace the furniture's own rules (knob for Y, linear for X and Z) with a rule that
works in every view (top, front, 3D). The active axis is chosen in an axes widget, as in the building
editor.

**4. Modifiers that mean the same everywhere.** Alt: no snapping. Ctrl: by steps (15° for an angle);
Ctrl + wheel: always zoom. Shift: finer (1 cm, 1°). And angle snapping wherever an object turns: 90°
within 6°.

**5. Shared values, in one place** (like `VITESSE_ROTATION_3D` today): a single zoom proportional to
the wheel (×1.1 per notch, `e^(Δ × 0.001)`), towards the cursor when the view allows; an object
rotation speed (0.5°/px) added to the “3D gestures” settings.

**6. Modals aligned on the building editor**: the same names (Rotation, Tilt, Lean), in the same
order, on the same axes (fix the Object modal), with a degree field next to each slider and
“Straighten”.

**7. Controls everywhere**: every screen with 3D gestures lists them, like the building editor's
menu (“Gesture: effect.”), previews included (a tooltip on the preview).

**A possible breakdown**, from least risky to longest: fix the Object modal's labels (6); unify zooms
and modifiers (4, 5); right drag for the Panels' camera (1); the Element rotation gesture in Panels
and Scenes, with the joints' engine (2, 3); finally Controls everywhere (7).

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
