# The Model editor

*[Version française](../fr/model-editor.md)*

## Role

The Model editor poses a single Character, Animal or articulated imported model: fine joint adjustment
through sliders and through handles on the canvas, and a pose library. It covers the central area; the
header and left menu stay usable, and navigating elsewhere leaves it (`clicQuitteLEditeur3D`).

## The two entries

- **Standalone** (header button): a library model, with no target. Poses are saved there; the "Apply"
  button is **absent**.
- **From the sheet** of a Character, Animal or imported model (3D model section): the Element with its
  settings. "Apply" writes into the sheet's **draft** (`S.modalDraftJoints`), closes the editor and
  returns to the sheet; it is the sheet's save (`descModalSave`) that changes the Element. Leaving
  without applying changes nothing.

## Files

| File | What it holds |
|---|---|
| `src/persona-editor.js` | The editor: opening, draft, camera, sliders, handles, poses, wiring (`wirePersonaEditor`). |
| `src/utils.js` | The pure decisions: poses (`makePose3D`, `renamePose3D`, `deletePose3D`), sliders (`poseSliderSpecs3D`), joint gestures (`straightDragDegrees3D`, `accumulateSweepDegrees3D`). |
| `src/rig3d.js` | Rigs, `getEffectiveJoints`, `cloneJoints`, an imported model's slider groups. |
| `src/skeleton-pose.js`, `src/pose-bridge.js`, `src/skeleton-retarget.js` | An imported model's pose (bones, roles, carrying over a humanoid pose). |
| `src/scene3d.js` | `renderModelForEditor3D`, rendering through the shared renderer. |

## The draft

Everything works on a draft (`S.personaEditorDraft`), never on the Element. Values are authoritative:
`getEffectiveJoints(o)` returns `o.joints3d`, otherwise the base pose named by `o.position`. Applying a
pose **copies its angles** into `joints3d`; `position` is only a display reference (a base pose's key,
or a saved pose's id). The library and the label (`positionLabel`) are described in
[pose-library.md](pose-library.md).

## Gestures

Left button held in empty space: turn the view; right button held: move it; wheel: zoom. On a handle,
the left button adjusts the joint: a straight drag when the axis is seen side-on, a circular gesture
when it points at the eye. Values in [gestes-3d.md](gestes-3d.md). The opening framing has a single
definition, `resetPersonaEditorCamera`, called by `openPersonaEditor`.

## A pose's data

`poses: [{ id, name, skeleton, joints }]`: `joints` is what `cloneJoints` produces, `skeleton` the
skeleton type (human, animal type), so a pose is never applied to a skeleton that is not its own. A pose
only holds joints (no emotion, no hands). `lieFlat` (lying down) lives in the joint values.

## Pitfalls

- **Never write "unknown" into `position`**: the label is computed at display time; keeping the id lets
  the Project repair itself as soon as it finds its library again.
- **A `<select>` empties its value** if it is not among its options: an unknown pose gets a synthetic
  option, otherwise saving would write `''`.
- **`POSE_3D` is completed at run time** by `draw.js` (`allonge`, `vaincu`): never filter the pose list
  on presence in `POSE_3D`, and pass the table as a parameter.
- **`resyncIdCounter` (`io.js`) must visit `poses`**: otherwise a new pose could reuse another's id.
- **The editor covers the application**: `window` keyboard listeners keep running behind it. A new
  screen on top must be added to `io.js`'s guards (Esc would otherwise open the Project menu).
