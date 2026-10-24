# Interface rules

*[Version française](../fr/interface.md)*

> The visual and interaction rules of the whole application, set by the user through feedback rounds
> (button convention #398, accessibility #409, interface size #410, editors, store, building editor
> #454…). They were scattered across `src/style.css` comments and conversations; this document
> gathers them. The checkable ones are held by `tests/interface.test.mjs`. The values' source
> of truth stays `src/style.css`: if a figure here and the stylesheet disagree, the stylesheet wins
> and this document is behind.
>
> The **design system** (the four renderings' tokens, typography, gaps, radii, controls, and every
> screen: header, left and right menus, context menus, modals, store, editors, Reader) is a page
> generated from the code: [design-system.html](../design-system.html), by
> `node tools/design-system.mjs`, which the pre-commit hook runs on every commit. A test checks it is
> up to date.

## Colours

### A button says what it does through its colour (#398)

| Colour | Class | Role | Examples |
|---|---|---|---|
| Orange | `.full-btn` | confirm, or **create** something | Save, Apply, Add a floor, Duplicate the floor |
| Grey | `.nav-btn` | navigate, or act without creating | Cancel, Quit, Reframe, Turn by 90° |
| Red | `.delete-btn` | delete | Delete the staircase |
| Yellow | `.edit-btn` | rename, edit | Rename |

- A **disabled** button is dark grey whatever its class: its colour does not announce what it cannot
  do.
- Hovering a grey button is **never orange**: orange promises a creation or a confirmation.
- **What informs is not orange** (#460b): an information chip (dimensions, progress, licence,
  count, number) is neutral, `--ink-mid` on `--creux`. Orange only comes back when its row is active.
- Colour never carries the meaning alone: the label or the tooltip says it too (colour blindness,
  see [colour-accessibility.md](colour-accessibility.md)).

### Everything goes through tokens

No interface colour is hard-coded: `--paper`, `--ink`, `--accent`, `--danger`… The four renderings
(Dark, Light, and each one's high contrast) redefine the same tokens. A hard-coded value is wrong in
three themes out of four.

## Spacing

### The four gaps

| Gap | Between |
|---|---|
| 14 px | two sections (`.side-section`), and between the last section and the bottom buttons |
| 10 px | two sub-sections, and between a sub-section and the field that follows |
| 8 px | two rows of one sub-section (its `gap`, nothing else) |
| 6 px | two neighbouring or stacked buttons |

- Inside a sub-section, **only the `gap` spaces**: the rows' own margins (choices, checkboxes,
  fields) are zeroed there. One extra margin immediately reads as a hole.
- A gap is set **the same above and below an element**: a field between two blocks has the same
  space on each side.
- ⚠️ Two neighbouring vertical margins **collapse** instead of adding up: only the larger counts.
  Aiming for a gap by adding two margins gives the larger of the two.

## Structure of a right-hand menu

### One menu, one section that gets added

- An editor has **one menu**: its permanent sections stay (for the building editor: Building,
  Levels, Rooms).
- A **contextual section** is added when needed: what the current tool will place, or what is
  selected. No menu per tool.
- The exit buttons (Save, Reframe, Quit) **always** stay at the bottom.
- No "Close the tool" button: a tool is left by clicking its button again, or with Esc.
- An item with no settings of its own (a wall, a room) has **no** section: selecting it leaves the
  menu as it is.

### Section hierarchy

**One hierarchy** (#460f), in panels, modals and store pages: **screen or modal** (14.5 to 16 px
title) > **section** (paper card, 11 px upper-case grey title after an orange dot, folding) >
**sub-section** (well, 13 px title).

### Sub-sections

A grouping inside a section (Type, Steps, Dimensions): a **well** (`--creux`), a 13 px title in
`--ink-mid`, one step below the section title. It groups what is decided together.

### Controls

- A "Controls" section says what can be done **depending on the tool and the selection**.
- **One action per line**, as "Gesture: effect.", with no blank line between them.
- Short sentences: a line that wraps is too long.

### Empty states

An empty list says so in one sentence that invites action ("No room yet: close a contour of
walls"), with a single style, `.empty-hint` (#460h): 12 px, grey `--ink-soft`, no italics.

### No status message in a menu

- A refused gesture produces **no message**: the preview was already red.
- Neither does a success: the button's state is enough ("Save" greys out, its tooltip says under
  which name).
- A failure that needs attention (a save that cannot happen) opens a **modal**.

## Screens

### Header

- The application's name on the left, then **round buttons** opening the screens (building, model,
  library, fonts, undo, save, settings, manual).
- Each round button has a tooltip with its shortcut; it **lights up** while its screen is open.

### Left menu

- The **Project name** on top (a click opens the Project modal), then one card per list: Volumes,
  Scenes, Images. Each card folds by its title.
- Rows are bordered tiles; the **active** row is marked in orange (border, plus a light
  orange fill for a Page).
  Right-click: its menu. Drag: reorder, the insertion point marked by an orange line.
- Secondary additions ("Add a page", "Add a chapter") are dashed buttons; the main addition ("New
  volume") is the orange button at the bottom of the card.
- A **fixed footer** says how long ago the Project was saved.

### The application's right-hand menu

- It follows what is selected: Page, Panel, Bubble; the Camera; the Manual when nothing is.
- A centred header with its round close cross; sections fold with a click on their title.
- A setting is a **block**: an upper-case label above, a full-width field below. In the right-hand
  panel, a block is not indented.
- The panel's checkboxes have one look (box, then a normal-case label).

### Editors and Reader

- The Model editor, the building editor and the Reader **cover the central area**, not the window:
  the header and the left menu stay visible.
- Their right-hand menu is built with the same sections as the application's, and their exit
  actions (Apply, Save, Quit) always sit at the bottom.
- In the Model editor, a joint group is a folding card on a well; a chain inside an anchor is
  separated from the next by a rule.

### Modals

- A **dark veil**, a dark-paper box with a 10 px radius, a 14.5 px bold title.
- **Only one area scrolls**: the box. Long modals (an Element) are split into folding sections on a
  well, rather than into areas with a capped height.
- Actions sit **at the bottom right**: Cancel in grey, then the action in its colour.
- A field is not stuck to the title; the gap between two fields (14 px) comes from the bottom margin
  of the field above. An error line, when the field has one, goes below it.
- A long modal has a round cross at the top right; Esc closes it.
- **Project modal**: its buttons keep a uniform fill, and the role's colour only shows **on hover**.
  It is the application's first screen; four fill colours would make it a rainbow.

### Tabs

The store and the Settings have tabs: text, the active one **underlined in orange**. The pages of a
tabbed modal take the height of the longest: the modal does not change size from one tab to the
next.

### Context menus

- `--white` fill, 8 px radius, drop shadow; an entry = an **emoji** then a 12.5 px label.
- A submenu shows a ▶ on the right. Delete comes last.

### Store and fonts window

- One tab per source, the filters on top, the licence notice at the bottom: **only the grid
  scrolls**.
- A card: thumbnail, name, author, licence badge (orange if commercial use is allowed, grey
  otherwise), size. The import tile is a dashed card.
- The **details page replaces the grid** instead of opening on top of it; the fonts window does the
  same.

### Information banners

**Information** (the resume banner) is **blue**, not in an action colour: the colour says what the
banner is, not what a button will do.

## Accessibility

### Themes and contrast

- Four renderings: Dark, Light, and each one's **high contrast** (a modifier that combines, not a
  fifth theme). The values are **measured**: 4.5:1 for text, 7:1 in high contrast; a test replays
  the computation.
- Three rule tokens: `--line` frames (decorative), `--line-strong` separates inside a block,
  `--bord-actif` borders what can be clicked or typed into (3:1 minimum).
- Text on a coloured button has its own token (`--sur-accent`, `--sur-danger`, `--sur-warn`).
- The **focus ring** (`--focus`) follows the field's shape.
- 3D preview backgrounds (`--fond-3d`) stay light in all four themes; scrollbars are styled the same
  way everywhere.

### Interface size

A setting enlarges the interface (`--echelle-ui`): header, menus, modals and context menus. **The
Page is not enlarged**, nor the modals' veil: only what is read.

### Fields

**The field rule** (#460e): a **short number** with its unit sits on one line, label on the left,
field on the right (`.modal-field-ligne`, `.batiment-champ`). A **list**, a **slider**, a **colour**
or a **text** keep their label above, full-width field.

## Choices and icons

### Pictograms rather than words

- A choice between shapes or variants shows as **line icons** (`currentColor`), **without a
  label**: the name is in the tooltip.
- The icon is drawn in the view where the difference reads:
  - **from above** for what reads on the plan (a staircase's shape, rails, a door's gestures);
  - **from the front** for openings (door, window, bay, passage, leaves, arch);
  - **from the side** for steps (solid or open).
- The active choice is **orange**: `--accent` border, `--accent-soft` fill.
- **Types and options**: types (door, window…) are large tiles; a type's options (leaves, solid or
  glazed, the side a staircase turns to) come below a rule, as compact segmented selectors. At equal
  count, an option stays smaller than a type, and its shape sets it apart without comparing sizes.
- A checkbox becomes two icons when both states can be drawn (Solid / Open, Solid / Glazed).
- A choice that changes nothing visible for that type is **not offered** (the number of leaves of a
  sliding bay, the filling of a window).

The icons live in `src/batiment-icones.js`.

### Tooltips

- A tooltip **names**: it does not depend on context (no "Will move the staircase by 207 cm").
- **Only exception: an impossible choice**. It is greyed out, not clickable, and its tooltip gives
  the reason. This also holds for a tool (the Stairs tool with no level above).
- A keyboard shortcut is written in parentheses at the end: "Add an empty level on top (N)".

## Gestures

### The same gestures from one tool to the next

| Gesture | Effect while placing |
|---|---|
| Click | place, **select** what was placed, and take the Selection tool |
| Right-click | turn, or change the direction |
| Wheel | change the type |
| Ctrl + wheel | zoom (when the wheel changes the type) |
| Hold Alt | place without snapping |
| Esc | deselect, then leave the tool, then close the editor |

- An empty editor opens on the tool that fills it (the Wall tool), and so does a new floor.
- A click **anywhere** in a list row picks it; right-click opens its menu (Rename, Delete).
- **An active row** (#460d) looks the same everywhere: orange border, `--accent-soft` fill, bold
  orange text. **Dragging to reorder** shows a 3 px orange line above or below the target row.

### Modals

- **Never two modals in a row**: merge them into one.
- A blocking modal **lists what blocks, with the reason**, and offers to resolve it.
- Its buttons are **short**: "Delete", not "Delete the level and the staircase".

## Words

### Labels

- Short: a label that wraps is too long.
- A technical term that is unclear is **replaced** and explained in a tooltip: "Sill height" became
  "Elevation" ("Distance between the floor and the bottom of the opening").
- In French, the application's nouns keep their capital: Projet, Tome, Planche, Case, Bulle, Scène,
  Élément.

## Planned harmonisations (#460)

Found while analysing the design system; to do later. Once settled, each rule joins this document
with its test.

- **#460a** ✅ Native sliders and checkboxes in orange: `accent-color: var(--accent)` on `<body>`.
- **#460b** ✅ Orange also informed (dimension and progress chips, licence badges, level numbers): move
  to a neutral chip.
- **#460c** ✅ One choice component, `.choix` (building editor, Reader), with its variants
  `.choix-types`, `.choix-options` and `.choix-bascules`.
- **#460d** ✅ One active-row style and one drop line.
- **#460e** ✅ Rule settled: a short number on one line, the rest above.
- **#460f** ✅ One hierarchy: screen > section (panel style) > sub-section.
- **#460g** ✅ One tab component, `.onglets` / `.onglet` (store, fonts, Settings).
- **#460h** ✅ One empty state, `.empty-hint`: 12 px, grey `--ink-soft`, no italics.
- **#460i** 22 text sizes: move to six.
- **#460j** 11 radii: move to three.
- **#460k** Icons: a single line-icon family (header, context menus).
