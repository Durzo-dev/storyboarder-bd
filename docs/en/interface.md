# Interface rules

*[Version française](../fr/interface.md)*

> The visual and interaction rules set by the user through feedback rounds, mostly while building the
> building editor (#454). They were scattered across `src/style.css` comments and conversations; this
> document gathers them. The checkable ones are held by `tests/interface.test.mjs`. The values' source
> of truth stays `src/style.css`: if a figure here and the stylesheet disagree, the stylesheet wins
> and this document is behind.

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

### Sub-sections

A grouping inside a section (Type, Steps, Dimensions): a **well** (`--creux`), a 13 px title in
`--ink-mid`, one step below the section title. It groups what is decided together.

### Controls

- A "Controls" section says what can be done **depending on the tool and the selection**.
- **One action per line**, as "Gesture: effect.", with no blank line between them.
- Short sentences: a line that wraps is too long.

### No status message in a menu

- A refused gesture produces **no message**: the preview was already red.
- Neither does a success: the button's state is enough ("Save" greys out, its tooltip says under
  which name).
- A failure that needs attention (a save that cannot happen) opens a **modal**.

## Choices and icons

### Pictograms rather than words

- A choice between shapes or variants shows as **line icons** (`currentColor`), **without a
  label**: the name is in the tooltip.
- The icon is drawn in the view where the difference reads:
  - **from above** for what reads on the plan (a staircase's shape, rails, a door's gestures);
  - **from the front** for openings (door, window, bay, passage, leaves, arch);
  - **from the side** for steps (solid or open).
- The active choice is **orange**: `--accent` border, `--accent-soft` fill.
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
