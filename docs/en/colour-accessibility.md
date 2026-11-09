# Colour and visual accessibility

*[Version française](../fr/colour-accessibility.md)*

## Two kinds of colour

Two things are written `#RRGGBB` in this repository, and they are treated in opposite ways.

- **Colour that DEPICTS**: a Character's skin, the grass texture, a hedge's tint (`rig3d.js`,
  `scene3d.js`, `constants.js`). It represents; a theme never touches it.
- **Colour that SIGNALS**: selected, reframing, snapped, detached. It is interface laid over the
  drawing (`draw.js`, `style.css`); it goes through tokens, which the themes redefine.

## The rules

- **Colour never carries meaning alone** (WCAG 1.4.1): the label or the tooltip says it too. A
  colour-blind user loses emphasis, never information.
- **Every interface colour is a token** (`--paper`, `--ink`, `--accent`, `--danger`…), never a
  hard-coded value.
- **Four renderings**: Dark and Light, and the **increased contrast** of each. Contrast is a modifier
  combined with the theme, not one more theme: in `settings.json`, `theme` is `dark` or `light`, and
  `contrast` is added to it.

## Thresholds

| Token | Threshold |
|---|---|
| Body text | 4.5:1 (AA); 7:1 in increased contrast (AAA) |
| `--bord-actif`: boundary of what is clicked or typed into | 3:1 against the **outer** neighbour (WCAG 1.4.11) |
| `--focus`: focus ring | 3:1 against neighbouring colours (WCAG 2.4.11), in all four renderings |
| `--line`, `--line-strong`: decorative frames and separators | no threshold |

- A field's boundary is measured against the **page**, not against its own fill: the outside says
  where the component ends.
- The focus ring does not use `--accent`: in the Light theme, the orange does not reach 3:1 against
  the paper.
- `:focus-visible` rather than `:focus`: a mouse click does not ring what it touches. The ring is an
  explicit `outline`, which follows the field's `border-radius`.
- Text on a coloured button has its own token (`--sur-accent`, `--sur-danger`, `--sur-warn`).

`tests/theme-contrast.test.mjs` replays these computations on the real stylesheet.

## Colour blindness

`--accent`, `--danger` and `--warn` belong to the red-orange-yellow family, which red-green colour
blindness brings together. No theme corrects this, because these colours carry emphasis and not meaning
(rule above), and `--accent` is the application's orange. A colour-blind palette would have to take one
of the three out of that family (for instance `--accent` towards blue).

## Measuring a colour pair

Brettel and Viénot (1999) simulation: sRGB to linear, to LMS through Viénot's matrix, deficiency
matrix, back; then Euclidean distance in sRGB (under 60, two colours no longer separate at a glance;
under 90, it is tight). Measure **the pairs the user must tell apart** on screen, not a palette in the
abstract.

## Pitfalls

- **Do not repaint what depicts** for a theme: the drawing would become wrong.
- **No `overflow:hidden` on a container of fields**: a focus ring is drawn outside its field, and would
  be clipped.
- **Do not reuse `--line` for an interactive boundary**: it is under 3:1.
