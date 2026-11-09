# Saved data: what is never renamed

*[Version française](../fr/persisted-data.md)*

> **The most important rule in the repository.** Breaking it breaks neither the build nor a test, and
> shows nothing on screen: it makes the files users have already saved unreadable.

A Project is serialised to JSON by `serializeProject()` (`src/io.js`). Everything that ends up in that
JSON is part of the **file format**: adding is allowed; removing or renaming is not. The same rules
apply to the application's other files (buildings, skeleton mappings, settings).
`tests/persisted-format.test.mjs` checks the code against the lists in this note.

## 1. Field names

**Project level**: `projectName`, `tomes`, `formats`, `scenes`, `currentTomeIndex`,
`currentPageIndex`, `poses`.

**Chapters** (`src/chapitres.js`): `chapitres` on a Volume (`[{ id, nom }]`, in order) and
`chapitreId` on a Page (absent: directly under the Volume). `pages` remains the flat list whose order
gives the numbering. On reading, a chapter's Pages are made contiguous, those without a chapter first.

**Imported pages** (see [planche-importee.md](planche-importee.md)): `importee` on a Page
(`{ largeur, hauteur }`, plus `imageAnchorX`, `imageAnchorY`, `imageZoom` for the framing), and on its
Panels `regionImage` (`{ x, y, w, h }` as fractions of the image), `imageFile`, and `pointsImage` (the
four corners, as fractions) for a distorted Panel. A Panel's place (`x`, `y`, `w`, `h`, `pts`) is
recomputed at every draw and still written.

**Formats** (see [formats.md](formats.md)): `formats` at project level
(`[{ key, nom?, unite, largeur, hauteur, w, h, scale, mmW }]`). Each Volume keeps its `format` key and
its copy of `w`, `h`, `scale`. A file without `formats` receives the four built-in formats; a Volume
whose dimensions match no format receives one at its dimensions.

**Building files** (see [building-editor.md](building-editor.md)):
`<Projects folder>/Batiments/*.batiment.json`, a separate, versioned format (`version: 1`). An unknown
field is kept on reading.

**Placed buildings**: an `objet3d` with `objType: 'batiment'` that embeds its copy of the building in
`batiment`, and `batimentSource` (the source file, informative). A version unaware of this type draws
it as an unknown object, without losing the field.

**Elements**: `pieceId`, `pieceLabel`, `altPieceId`, `pieceFloorType`, `objType`, `caseNumber`,
`batimentNames`, `batimentRotY`, `wallSide`, `modelFile`, `afficherMaillagesEgares`.

**World coordinates**: `wxFloor`, `wyFloor`, `wzFloor`, `realHeightFloor`, `realLenFloor`.
`realHeightFloor` is the saved size; the percentage on the "Actual size" slider is stored nowhere, it
is recomputed when the sheet opens (`getPersonaScalePercent`).

**Wall-mounted items**: `wallYFrac`, `wallAlongFrac`, `magnetWallId`, `wallHeight`.

**Panel camera**: `camWx`, `camWy`, `camWz`, `camDist`, `camRotX`, `camRotY`.

**Textures and colours**: `groundType` (the Ground of a Panel or Scene), `terrainType` (a Terrain
zone) and `traceTexture` (a Tracé; absent: its type's texture) hold either a built-in material id or
`tex:<folder>`, the texture's folder in `Textures/`. `groundColor` and `terrainColor` (`#rrggbb`) tint
the texture; absent, natural colour; changing texture removes them. `marquage: false` on a road
removes the white line. A missing texture makes the Ground fall back to the first material and the
Tracé to its original texture, and the id is kept: the texture returns as soon as it is downloaded
again.

**Bubble fonts**: `bulleFont`, `bulleGras`, `bulleItalique` (booleans, absent = false). A font
removed from the application stays written as is; on reading, `policeDeBulle` (`src/constants.js`,
table `POLICES_BULLES_RETIREES`) draws it with its replacement. The name is only rewritten when the
user picks another font.

Some names are French, others English, a few awkward (`batimentNames`): a saved field name is a format
identifier, not naming.

### `poses`: a copy of the poses in use

The pose library belongs to the **application** (`settings.json`, key `poseLibrary`). The project file
only carries a **copy of the poses it uses** (`[{ id, name, skeleton, joints }]`), to stay readable on
a machine that lacks them. On opening, those poses are merged into the library (unknown ids only).

The six base poses are seeded on first launch with their key as `id` (`'assis'`, `'debout'`…);
`POSE_3D` is the safety net for a deleted base pose. No Character **depends** on `poses`: applying a
pose copies its angles into `joints3d`. `normalizePoses3D` (`io.js`) reads the field tolerantly
(absent, null or malformed: empty list).

### `modelFile`: a file name, not a path

An imported model is an `objet3d` with `objType: 'modele'` whose `modelFile` is the **name of a file**
in `<Projects folder>/Modeles`, never an absolute path.
- **The file can be missing**: the model shows as a placeholder box, the Element is never deleted
  (see § 6).
- **Models follow the Projects**: they live in the folder chosen for Projects.
- **Renaming a model** rewrites `modelFile` in every Element of the open Project and in its undo stack,
  and moves its skeleton mapping. Other Projects are updated when opened: every rename is logged in
  `settings.json` (`modelRenames`), and `proposerRepointageModeles` offers the update if the cited file
  is gone **and** its successor exists.

### The skeleton mapping file

Stored next to the `Modeles` folder, indexed by file name (`SKELETON_MAP_FORMAT = 1`). An entry:

| key | written by | shape |
|---|---|---|
| `os` | a humanoid | `{ slot: boneName }`, closed list of eighteen |
| `roles` | any other morphology | `{ role: boneName }`, the list coming from the archetype |
| `membres` | ticked or renamed chains | `[{ racine, nom, retenu }]` |
| `morphologie` | the selector | a key of `ARCHETYPES_3D` |
| `valide` | "I have seen this screen" | boolean |
| `empreinte` | saving | `"49-ebfba2f4"`: the bone count then a digest |

- `empreinte` identifies **the skeleton** the entry is about, so another file can ask "is it the same
  one?" without decoding the `.glb`. It never creates an entry on its own.
- `os` and `roles` can be **stored** together; only one is **read**, according to the morphology.
  Writing one never erases the other.
- `roles` lives next to `os` instead of widening it: a version that filters `os` on its eighteen slots
  would otherwise lose the keys silently.

### `skeletonPose3d`: slots and bones

An imported model's pose is a dictionary `{ key: {x, y, z} }` in radians. A key is:
- a humanoid **slot** (`tete`, `avantbras_g`, `cuisse_d`), closed list of eighteen;
- or a **bone**, prefixed `os:` (`os:Bone_L_078`), the bone's name as three sees it.

The prefix stops a bone named `tete` from overwriting the slot. A humanoid writes slots, a creature
writes bones; a key that designates nothing stays inert. A bone key is read back **without being
checked**: the `.glb` is not necessarily decoded when the Project is saved.

## 2. Discriminant values

The strings that recognise what an object is are as fixed as field names:

```
type      : 'perso' | 'objet3d' | 'panel' | 'tracé' | 'terrain' | 'bulle'
objType   : 'mur' | 'mur_coin' | 'dalle' | 'fenetre_ouverte' | 'porte_ouverte' | 'modele' | 'batiment' | …
tracéType : 'muret' | 'cloture' | 'haie' | 'barriere' | 'route' | 'chemin' | 'terrain' | 'riviere'
wallSide  : 'avant' | 'arriere'
door/window state : 'gauche' | 'droite' | 'fermee'
```

`'tracé'` has its accent, `'cloture'`, `'barriere'` and `'fermee'` do not: that is how they are in the
files.

## 3. DOM ids

An `index.html` id ties the HTML to the JS looking for it: a `getElementById(...)` returning `null` at
start-up interrupts the loading of the whole of `events.js`, and no button responds any more. An id
can be renamed, but **in the same commit** in `index.html`, in every `getElementById` /
`querySelector` in `src/`, and in the selector tables of `src/i18n.js`.

## 4. CSS classes and displayed text

A CSS class ties `style.css` to the JS that sets or tests it: rename it on both sides. Visible labels
go through `src/i18n.js` and the modules' `tr(en, fr)`, never hard-coded.

## 5. If a rename is really needed: a migration

`migratePanelWorldCoords` and `migrateElementWxFloor` (`src/io.js`) are the models:
1. the new field is written on save;
2. on load, if the old one is present and the new one absent, convert;
3. the old field stays **read** indefinitely.

## 6. An unreadable file does not destroy the open one

`applyProjectData` validates the data's shape (`validateProjectShape`) **before writing anything**
into `S`.
- **Refused**: a value present and of the wrong type where loading iterates (`tomes`, `scenes`,
  `pages`, `objects`). The open Project stays intact, and its autosave resumes.
- **Tolerated**: absent, `null`, or merely absurd (an index out of bounds, a null name).
- **Never silently repaired**: turning a malformed list into `[]` would open an empty Project that
  autosave would then write over the real file.

`tests/persisted-format.test.mjs` also checks that the refusal happens before the first write.

## Pitfalls

- **`tracé` is never translated**, not in data, identifiers or comments.
- **Every key of a mapping entry must be named in `normaliserFichier`**: the function rebuilds the
  entry key by key, and a forgotten key disappears at the first rewrite.
- **Do not bump a format number for an addition** (`SKELETON_MAP_FORMAT`, `VERSION_BATIMENT`): an
  earlier version would reject the whole file, whereas it ignores an unknown key.
- **Never delete an Element whose file is missing**: a passing absence (unmounted disk) would become a
  permanent loss at the next autosave.
