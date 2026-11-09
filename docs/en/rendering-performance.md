# Drawing performance

*[Version française](../fr/rendering-performance.md)*

## Role

How a Page is drawn, what avoids redoing work, what the known items cost, and how to measure before
fixing. The detailed measurement campaigns are in the maintainer's private documentation.

## The drawing path

- **`scheduleDrawCurrentPage`** (`src/draw.js`) groups redraw requests into a single frame; hot paths
  (drag, wheel) go through it, which `tests/events.test.mjs` checks.
- **`drawCurrentPage`** draws the displayed Page; export goes through the same `drawContent`.
- **A Panel's 3D render** (`renderPanelScene3D`) is most of the cost. A Panel keeps its image as long as
  its **signature** (`computePanelSceneSignature3D`: Elements, camera, lighting, Ground…) does not
  change. The signature is computed on every call; a setting that does not enter it redraws nothing.
- **The renderer is single and off-screen**, capped at `PANEL_SCENE_RENDER_MAX_PX` (1400 px): each
  consumer resizes it, renders, then copies into a 2D canvas.

## The Panel image cache

Rendered images are kept in a recency list, under a **byte cap** ("Pages kept in memory" in Settings,
`PLAFOND_CACHE_MO_DEFAUT` = 300 MB, up to `PLAFOND_CACHE_MO_MAX` = 900 MB). A cap in bytes rather than
in Pages, because a Page costs 36 to 67 MB depending on its load, about three times that at the largest
interface size. The displayed Page is never evicted: 0 keeps only that one.

## Orders of magnitude

| Item | Cost |
|---|---|
| `drawCurrentPage` on a loaded Page (8 Panels) | median ~8 ms, p95 ~14 ms per frame |
| A Panel render | median ~13 ms; at worst a few hundred ms (first frame, rigs built) |
| A Panel image, even 6000×4000 | negligible when drawing; ~92 MB of decoded memory |
| A placed light source, per frame | negligible; ~30 ms at the first encounter of a number of lights |
| Sun shadow | ~1 ms per frame; resolution (1024 to 4096) barely changes the time |
| Eight casting sources | ~3.9 ms per frame; a compilation at the first encounter |

GLSL compilations are paid **once per configuration and per session**: the number of lights and shadows
enters the program key. Moving or recolouring recompiles nothing.

## Measuring

**The application's probe** (`src/perf-probe.js`), in the console (F12): `sonde.demarrer()`,
reproduce the slowdown, `sonde.rapport()` (a table, with a one-line summary at the top),
`sonde.arreter()`. It:
- is off by default (one boolean test per call);
- **aggregates without logging**: one `console.log` per frame costs more than what is measured;
- keeps **exact counts and totals** apart from the bounded sample used for quantiles;
- records slow frames (over `IMAGE_LENTE_MS`, 50 ms) and counts **new shader programs** (a compilation
  costs tens of milliseconds at once);
- says why a report is empty ("never started" is not "nothing to report").

Report the **median** next to the mean: the first frame builds every rig. A new item is measured with
`sondeDebut()` / `sondeFin(name, t0)`.

**A WebGL probe** (GPU cost), in a real browser:
- an **off-screen** render target, never the display buffer;
- `readPixels` after each render (`gl.finish()` synchronises nothing under ANGLE);
- a unique `define` per trial, otherwise Chromium's program cache answers instead of the GPU;
- materials kept alive between trials;
- **a witness that must move** (a known load), checked before trusting a figure; and, for a visual
  effect, count the **changed pixels**: work that costs may produce nothing.

## Pitfalls

- **Do not optimise from reading the code**: measure first.
- **Do not reduce images on import**: drawing costs nothing, and reframing zoom would turn blurry.
- **Do not set the cache as a number of Pages**: the right number depends on the machine and the
  screen.
