# Internal notes

*[Version française](../fr/README.md)*

Contributor documentation. What is addressed to the user is in the [README](../../README.md) and in
the built-in manual (`src/help-content.js`).

## What this folder holds

These notes describe **how the code works today**, so that a developer new to the project can
understand it, change it and take it over. They do not tell how it got there: no dates, no history,
no abandoned attempts, no decision records. That "why" lives in the maintainer's private
documentation.

A note is updated **in the same commit** as the code it describes.

### Note template

1. **Role**: what this part does, in a few lines.
2. **Files**: the modules, and what each one holds.
3. **Data**: formats, saved fields, units.
4. **Flow**: what calls what, in which order.
5. **Extending**: how to add a case (a type, a source, an option).
6. **Testing**: the tests covering this part, and what is checked on screen.
7. **Pitfalls**: what not to do, one sentence each, with its consequence.

A section with nothing to say is left out.

## Read before touching the code

| Note | Subject |
|---|---|
| [persisted-data.md](persisted-data.md) | Saved data: what is never renamed, reading back, added fields. |
| [architecture.md](architecture.md) | What goes where, IPC channels, circular imports, shared state, naming. |
| [3d-rendering-single-sources.md](3d-rendering-single-sources.md) | 3D rendering: one source per computation. |
| [imported-skeletons.md](imported-skeletons.md) | Imported skeletons: recognition, morphologies, roles, mappings, posing. |

## Method and procedures

| Note | Subject |
|---|---|
| [testing-method.md](testing-method.md) | Writing and organising tests, making code testable, what stays out of reach. |
| [versioning.md](versioning.md) | Version numbers, git hooks, tags, publishing. |
| [updates.md](updates.md) | Built-in updates: signed attestation, mandatory version, publishing. |
| [missing-resources.md](missing-resources.md) | A Project's missing resources and the window that explains them. |

## Interface

| Note | Subject |
|---|---|
| [interface.md](interface.md) | Interface rules: buttons, menus, Controls, icons, tooltips, modals, labels. |
| [ui-scale-coordinates.md](ui-scale-coordinates.md) | Interface size: screen pixels and zoomed pixels. |
| [colour-accessibility.md](colour-accessibility.md) | Colour that depicts, colour that signals, and colour-vision deficiencies. |
| [gestes-3d.md](gestes-3d.md) | The 3D gestures of each screen: controls, speeds, steps, bounds. |
| [store-guide.md](store-guide.md) | Making a store: window, cards, sheet, download, adding a source. |

## Pages, Panels and Bubbles

| Note | Subject |
|---|---|
| [formats.md](formats.md) | Volume formats. |
| [planche-importee.md](planche-importee.md) | Imported pages and their detected Panels. |
| [panel-images.md](panel-images.md) | An image in a Panel instead of a 3D scene. |
| [lecteur.md](lecteur.md) | The Reader of a Volume or Chapter. |
| [bubble-styles.md](bubble-styles.md) | Bubbles: shapes, tails, borders, styles. |
| [polices.md](polices.md) | Built-in and imported fonts, bold and italic, the Fonts window. |
| [non-visible.md](non-visible.md) | "Not visible": knowing whether an Element is out of frame or hidden. |

## 3D: frames, rendering, light

| Note | Subject |
|---|---|
| [3d-reference-frames.md](3d-reference-frames.md) | World constants, canvas and world coordinates, orientation, scales. |
| [rendering-performance.md](rendering-performance.md) | The cost of drawing and how to measure it. |
| [lighting.md](lighting.md) | Lighting of a Panel and a Scene. |
| [positioned-lights.md](positioned-lights.md) | Light sources placed in a Scene. |
| [cast-shadows.md](cast-shadows.md) | Cast shadows. |
| [ground-textures.md](ground-textures.md) | Ground textures: scales, density, memory. |
| [imported-models-display.md](imported-models-display.md) | Displaying imported models: materials, lights, formats. |

## Characters and models

| Note | Subject |
|---|---|
| [model-editor.md](model-editor.md) | The Model editor. |
| [pose-library.md](pose-library.md) | The pose library. |
| [asset-store.md](asset-store.md) | The asset store and its sources. |

## Editors

| Note | Subject |
|---|---|
| [building-editor.md](building-editor.md) | The Building editor: format, levels, walls, rooms, openings, stairs, roofs. |
| [terrain-editor.md](terrain-editor.md) | The Terrain editor: relief, Zones, water, rivers. |

---

Every note exists in two languages, **one folder per language**: `docs/en/name.md` and
`docs/fr/name.md`, same base name. Both are kept in step, and `tests/docs.test.mjs` refuses a note
without its counterpart, a dead link, or a section added on one side only. For the language of the
code, see [architecture.md](architecture.md#language).
