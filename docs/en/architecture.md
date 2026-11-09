# Architecture and naming

*[Version française](../fr/architecture.md)*

The README lists the files. This note gives the **rules**: what is allowed to go where, and how
things are named.

## Rule 1: application code lives in `src/`

**`electron/`** holds the main process (CommonJS, loaded by Node, never by the renderer):
- `main.js`: the window, disk access, IPC channels;
- `preload.js`: the `window.storyboarderAPI` bridge;
- the blocking screen and its bridge (`preload-blocage.js`);
- the pure decisions they apply: `window-state.js` (window geometry), the Projects folder,
  `update-policy.js` and `updater.js` (updates);
- `electron/bibliotheque/`: model store, thumbnails, library of imported models.

`main.js` resolves the application root (`RACINE`) for `assets/` and the fixtures.

**`src/`** holds the whole interface: `index.html`, `style.css` and the ES modules they load.
`src/app.js` imports `events.js`, the real entry point.

**The root** only keeps what tools look for there: `package.json`, READMEs, licence, ESLint and
type-checking configuration.

### Main-process information comes down as a generated file

The renderer does not read `package.json`. When information known at build time is useful to it, it
is **generated** into `src/` rather than served by a channel:
- `src/version.js`, written by `tools/bump-version.mjs`;
- `assets/fonts/`, written by `node tools/fetch-fonts.mjs`, and `assets/fonts/dafont/`, by
  `node tools/import-dafont.mjs` (see [polices.md](polices.md)). The fonts travel in the installer;
  `style.css` imports them.

### When an IPC channel is justified

A channel is opened for a feature only if **all three** conditions hold:
- it does **disk access** (the job of `main.js`) that no existing channel can do;
- the data arrives **at run time**, chosen by the user: nothing can generate it at build time;
- the decision stays in `src/`: `main.js` does the input/output and **defends itself** (refusing any
  name that is not a bare file name), the `src/` module **decides** (retained name, collisions,
  messages) and is tested. Example: `src/model-store.js` and `tests/model-store.test.mjs`.

Open channels: `models:*` (imported 3D models), `images:*` (Panel images, see
[panel-images.md](panel-images.md)), `fonts:*` (user fonts, see [polices.md](polices.md)),
`skeletons:*` (the mapping file), `batiments:*` (buildings, see
[building-editor.md](building-editor.md)), `textures:*`, `fontstore:*`, `project:*`, `settings:*` and
`maj:*` (updates, see [updates.md](updates.md)). The full list is in `electron/preload.js`, and its
declaration in `types/globals.d.ts`.

## Rule 2: circular imports are broken by injection

Modules have crossed needs (`scene3d.js` redraws the page, `draw.js` updates the side panel). A module
that needs to call "upwards" exposes a `set*Callbacks()` that `events.js` calls at start-up:

```js
setScene3DCallbacks({ drawCurrentPage, refreshCameraSliders, renderSideCameraGizmo });
setDrawCallbacks({ canvas, ctx, applyZoom, updateSidePanel, … });
setPersonaEditorCallbacks({ buildPersonaPositionOptions });
```

Order of preference: a **pure function** in `utils.js` (or a pure module) → an **injected
callback** → a direct import, only if the graph stays acyclic.

## Rule 3: shared state goes through `S`

`src/state.js` exports `S`, the application's mutable state (`S.selectedId`, `S.modalTarget`,
`S.traceTool`, `S.tomes`…). A dependency on `S` is invisible in signatures: state it in the function's
comment.

### The shared 3D scene: a preview goes through `rendreApercu3D`

Panel rendering and single-Element previews (sheets, Model editor) share the same scene and renderer
(`src/rig3d.js`). A preview **never** draws the scene itself: it calls `rendreApercu3D(type, id,
camera)`, which hides everything but its Element and then draws. Only this function and Panel
rendering draw the shared scene; `tests/rig3d.test.mjs` checks it. Screens with their own preview
(store, Building editor) have their own renderer.

## Rule 4: type checking is a linter

`jsconfig.json` runs TypeScript over `src/**/*.js` in `checkJs` mode, with no compilation and no `.ts`
file: `npm run typecheck`, and `npm run typecheck:report` for a sorted summary. It is **optional** and
not wired to the pre-commit hook (most diagnostics come from untyped DOM access).

What matters: `types/globals.d.ts` declares the Electron bridge, and `tests/electron-bridge.test.mjs`
refuses any divergence between that declaration and `preload.js`.

Pitfalls:
- an index signature (`[key: string]: unknown`) on a boundary interface allows everything and checks
  nothing;
- a test that reads source code must strip the comments first.

## Naming

These rules are about **code**. Saved data follows its own ([persisted-data.md](persisted-data.md)).

### `3D` suffix

Every function or constant working in 3D world units carries it: `tracéWallHeight3D`,
`GROUND_Y_DEFAULT_3D`. It tells a world computation from a canvas one at a glance.

### `ensure*` prefix

`ensurePersonaRigEntry3D`, `ensureWallRenderEntry3D`: return the existing entry or build it (cache,
added to the scene). `get*` is kept for what changes nothing.

### `_` prefix

Only for a computation temporary in a dense scope (`_tracéPos`). It does not mean "private".

### Two homonyms to know

**`trace` (the tool) and `tracé` (the object).** `S.traceTool`, `startTraceTool` name the mouse
drawing tool (Roads, Paths, Terrain zones). `tracéBBox`, `drawTracé`, `type: 'tracé'` name the saved
object (road, path, low wall, fence, hedge, barrier). A search for one misses the other: search for
both. `'tracé'` is a saved value, it is never renamed.

**`render` has three meanings**: WebGL rendering (`renderPanelScene3D`), DOM building
(`renderSideElementRow`, `renderTree`), and `renderAll()`, which orchestrates both. A `render*` in
`sidebar.js` or `project-tree.js` does not touch three.

### Language

- **Domain terms: French**, as in the data and the interface: `tracé`, `Case`, `Tome`, `Planche`,
  `Muret`. `tracé` is never translated, not even in a comment.
- **Identifiers and comments**: the original modules (`events.js`, `draw.js`, `scene3d.js`,
  `rig3d.js`, `utils.js`…) are in English, the more recent ones in French. Write in the language of the
  file being changed.
- **Links to the docs**: always `docs/en/…`; `tests/docs.test.mjs` checks the target exists and is the
  English one.

## Rule 5: what goes with a change

In the **same commit**:
- **visible to the user**: `README.md` and `README.fr.md`, the manual `src/help-content.js` in both
  languages, `src/i18n.js` for an added label;
- **change in how something works**: the `docs/` note describing it, in both languages (rules and
  template in [README.md](README.md)).

Internal work (refactoring, tests) is not bound by this.
