# Screen pixels and zoomed pixels

*[Version française](../fr/ui-scale-coordinates.md)*

## The rule

**A screen coordinate is never written as is into a zoomed element.** Either it is converted once, in
a single place, or the element is not zoomed.

## The two frames

The interface size is applied by `zoom: var(--echelle-ui)` on the containers: `header`, `.sidebar`,
`.right-panel`, `.modal-box`, `.context-menu`, and the Model editor's panels. The application therefore
has two frames, and nothing says which one a number belongs to:

| where the number comes from | what it is |
|---|---|
| `e.clientX` / `e.clientY` of a mouse event | screen pixels |
| `getBoundingClientRect()`, any field | screen pixels, zoom included |
| `window.innerWidth` / `innerHeight` | screen pixels |
| `style.left` / `style.top` on a zoomed element | **zoomed pixels**, multiplied by the factor |

At the "Extra large" step (factor 1.3), a `.context-menu` with `left:200px` renders at 260 px.

## Floating menus: convert once

`placerMenuFlottant3D` (`src/ui-scale.js`) places a menu from its **anchor** (the cursor, or the item
opening a submenu), never from the menu's current position:
1. it clamps within the window **in screen pixels** (the window is not zoomed);
2. then it converts to zoomed pixels for `style.left` / `style.top`.

Called ten times with the same anchor, it returns the same answer ten times.

## The tooltip: do not zoom

What must sit exactly on something else leaves the zoomed containers. The tooltip is `position:fixed`
outside those containers, its size follows the setting through `calc(… * var(--echelle-ui))`, and its
position stays in screen pixels.

## Testing

The tests of `src/ui-scale.js` hold the arithmetic, the frame conversion, the clamping and the
independence from any current state. The behaviour of `zoom` itself belongs to the browser: it is
checked on screen, at the "Extra large" step, by opening a context menu and a submenu near the
window's right edge.

## Pitfalls

- **Never read a menu's position back to rewrite it**: each pass would multiply it by the factor again,
  until the menu leaves the screen.
- **Clamp before converting**: clamping afterwards would bring the menu back too early and leave a gap
  on the right, the wider the larger the interface.
