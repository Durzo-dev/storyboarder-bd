# Bubbles

*[Version française](../fr/bubble-styles.md)*

## Role

A Bubble is a **free** combination of graphic axes, none of which implies the others: shape, stroke,
fill, tail, text, particles. Any shape combines with any tail. Saved styles are presets of these axes,
named by their look ("Oval with halo"), never by a register ("Thought").

## Files

Each axis has a **pure** module (decision, tested under Node); drawing is in `src/draw.js`
(`drawBubble`, the path shared by screen and export).

| File | What it holds |
|---|---|
| `src/bubble-shape.js` | The shape registry and its contract (outline, text area, default tail). |
| `src/bubble-tail.js` | The tail registry: triangle, lightning, hair, circles, none. |
| `src/bubble-style.js` | Fill (opacity) and stroke (pattern, regularity, wobble). |
| `src/bubble-texture.js` | Fill textures: layer stacks, grains. |
| `src/bubble-grain.js` | The impure half of textures: loading grains, canvas patterns. |
| `src/bubble-particle.js` | Particles scattered around the edge (blot, flame). |
| `src/bubble-merge.js` | Merging Bubbles into one Bubble with several lobes. |
| `src/bubble-library.js` | The style library. |
| `src/cyclic-noise.js` | The shared cyclic noise (wobbly stroke, blot silhouette), with a stable seed. |

## Axes and their values

| Axis | Field | Values (saved keys) |
|---|---|---|
| Shape | `bulleShape` | `ovale` (default), `facette`, `rect` (**rounded** rectangle), `rectnet` (sharp corners), `octogone`, `etoile`, `ecu`, `tache` |
| Tail | `tailShape`, `tailVisible`, `tailMirror`, `tailAngle`, `tailLen` | `triangle` (default), `eclair`, `cheveu`, `ronds`, `aucune` |
| Stroke | `bulleBorderVisible`, `bulleBorderWidth`, `bulleBorderColor`, `bulleBorderDash`, `bulleBorderRegularity` | pattern `plein`, `pointille`, `tirets`, `epine`; regularity `net`, `tremble` |
| Fill | `bulleColor`, `bulleFillOpacity`, `bulleTexture` | texture `aucune` (default), `papier`, `glace`, `lave`, `nuit-etoile` |
| Particles | `bulleParticule` | `aucune` (default), `tache`, `flamme` |
| Text | `bulleFont`, `bulleFontScale`, `bulleGras`, `bulleItalique`, `bulleTextColor`, `bulleTextOutlineColor`, `bulleTextOutlineScale`, `bullePadding` | see [polices.md](polices.md) |
| Merging | `bulleFusionnable`, `bulleGroupe`, `bulleAvantFusion` | |

**Defaults and compatibility**: an absent field takes its default (a Bubble without `bulleShape` is an
oval). `bulleFillOpacity` at `0` means 0 (invisible fill), only `null` means 1.

**Retired keys, which migrate**: `ALIAS_FORME` (`dents` and `epines` → `etoile`, `bande` → `rect`) and
`ALIAS_TEXTURE` (`fondus` → `nuit-etoile`). An **unknown** key throws an error instead of silently
falling back to the default.

## The shape contract

A shape provides, in `bubble-shape.js`'s registry:

| Function | What it returns | Who uses it |
|---|---|---|
| `pointDuContour(o, theta)` | the outline point in direction `theta` | the tail anchor, dragging its tip |
| `pointsDuContour(o)` | the outline points, or `null` if the shape is smooth | the continuous stroke that skips the arc under the tail |
| `encartInterieur(o)` | the area where text is laid out | text layout and `bullePadding` |
| `queueParDefaut(o)` | whether a Bubble of this shape is born with a tail | creation; `tailVisible`, once it exists, wins |

Curved outlines (shield, blot) are **sampled** into close points: a ray's intersection with them is
exact. The blot has one outline **per Bubble**, drawn from its id (`cyclic-noise.js`): it is the same on
screen and in the export. Its text area is computed on that outline, not as a fixed fraction.

The oval keeps the whole box as its text area: text may slightly overflow the curve near the corners.

## Tails

`bubble-tail.js` describes each tail relative to the shape's outline, without depending on it. The hair
tail can be flipped (`tailMirror`, `queuePeutSInverser3D`). Circles are a chain of three decreasing
circles (`RONDS_*`).

## Textures and particles

- **A texture** is a stack of layers, drawn in the Bubble's path inset towards its centre, plus a
  **grain** (a photographed image, tinted) loaded by `bubble-grain.js`. A texture can **impose** its
  colour (the sheet then hides the picker) or only **suggest** it.
- **Particles** are a cloud spread around the edge, not a stroke pattern: they combine with any stroke
  (wobbly and speckled, for instance).

## Merging

Two **mergeable** Bubbles that touch (`bullesEnContact3D`) can become one: a single outline, and as many
text areas as **lobes**. A group carries N lobes. The **selected** Bubble imposes its look on the
others; `CHAMPS_PROPRES_AU_LOBE` lists what stays specific to each lobe (place, text, group). "Split the
bubbles" gives each lobe back its earlier state (`bulleAvantFusion`).

## Saved styles

- A style is everything a Bubble carries **except** `CHAMPS_HORS_STYLE` (the lobe-specific fields,
  `tailAngle`, `tailLen`): the list excludes instead of enumerating, so an added axis enters styles
  without any change here.
- The library is an **application** setting (`settings.json`, key `bulleStyles`), shared between
  Projects, outside `S` and undo.
- A Bubble keeps a **copy** of the values, never a reference: editing a style does not repaint finished
  pages. `styleCorrespondant3D` says whether a Bubble still follows a style.

## Drawing and stacking

- A Bubble is **never clipped** by its Panel: it can overflow onto the gutter.
- Bubbles are drawn in a separate pass, **in front of every Panel**, whatever the order of objects.
- The export has the Page's size: what goes beyond the Page is cut.

## Extending

- **A shape**: a key (never reuse an existing one), an entry in `REGISTRE` with its four functions, its
  label and its icon; the tests cross every shape with every tail.
- **A texture, a particle**: an entry in their registry; a retired key goes into the alias table.

## Testing

`tests/bubble-*.test.mjs`, `tests/apercu-bulle.test.mjs`, `tests/bulle-gras-italique.test.mjs`. What
tests cannot see (text leaving its shape, a shape not looking as it should) is checked by **rendering
the Bubbles as images** and looking at them.

## Pitfalls

- **`rect` is the rounded rectangle**, `rectnet` the sharp one: the `rect` key no longer changes
  meaning.
- **Write `tailVisible != null`**, not `!== false`: an explicit "yes" must win over the shape's default.
- **Do not add a `clip()` to Bubble drawing**, and do not merge their pass into the objects loop.
- **An unstable seed** would make the blot change shape at every render.
