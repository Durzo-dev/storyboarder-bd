# Volume formats

*[Version française](../fr/formats.md)*

> Requested by Valentin on 22 October 2026 (#453). The code: `src/formats.js` (the decisions, tested
> under Node), `src/formats-ui.js` (the modal), and a Volume's format list in `project-tree.js`.

## The rules

- Formats belong to the **Project**: all its Volumes draw from them, and a Project sent to someone
  carries its own.
- A format is **created** (name, width, height, in mm or px) and **renamed**. Its dimensions cannot
  be changed: the Panels of the Volumes using it would move.
- A format **in use** by a Volume cannot be deleted (the button's tooltip says which ones); nor can
  the last format.
- The four **built-in** formats (Franco-Belgian, US comics, Vertical webtoon, Custom format) are only
  a Project's starting list: renamable and deletable like the others.

## The gesture

Expand a Volume in the left-hand menu: its format list ends with **"Manage formats…"**, which opens
the "Project formats" modal. Each format shows its dimensions, how many Volumes use it, "Rename" and
"Delete"; below, the creation. Everything is undone with Ctrl+Z.

## Millimetres and pixels

A Page is drawn at a screen size (`w`, `h`) and exported multiplied by `scale`. A Panel's
**Dimensions** section shows its sides in mm: it must know how many screen px make a printed mm,
which `mmW`, the format's **printed width**, gives (Franco-Belgian: 550 px for 220 mm, 2.5 px per
mm).

- **In mm** (a printed album): the longer side is 725 px on screen, like the Franco-Belgian, export
  ×4; `mmW` is the entered width, and the mm shown are exact.
- **In px** (a webtoon, a screen): the entered size is the export's; beyond 1000 px, the Page is
  drawn reduced and `scale` brings it back to size. With no printed size, mm follow the 96 dpi
  screen equivalence.

## What is persisted

One **added** field at Project level, `formats`: `[{ key, nom?, unite, largeur, hauteur, w, h,
scale, mmW }]`. `nom` is absent until a built-in format is renamed: it then shows in the
application's language.

Each Volume keeps its `format` key **and its copy** of `w`, `h`, `scale`: that is what drawing and
earlier versions read. Since a format never changes dimensions, the copy cannot drift.

**On reading**, a file without `formats` gets the four built-in formats. A Volume whose key is
unknown, or whose dimensions match no format (a Volume switched to "Custom format" by a page import,
before #453), gets the list's format with its dimensions, else a new one ("Custom format 2"…): only
its key changes.

## Importing a page

An imported page without the Volume's proportions offers a matching format (see
[planche-importee.md](planche-importee.md)). That format joins the Project's ("Imported page", or an
existing one with the same dimensions): the pre-#453 defect, where picking "Custom format" again
reset the Volume to 480×660, went with it.
