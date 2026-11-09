# Volume formats

*[Version française](../fr/formats.md)*

## Role

Formats (a Page's dimensions) belong to the **Project**: all its Volumes draw from them, and a Project
sent to someone carries its own.

## Files

- `src/formats.js`: the decisions (create, rename, delete, read back), tested under Node.
- `src/formats-ui.js`: the "Project formats" modal.
- `src/project-tree.js`: a Volume's format list in the left menu, ending with "Manage formats…".

## The rules

- A format is **created** (name, width, height, in mm or px) and **renamed**. Its dimensions do not
  change: the Panels of the Volumes using it would move.
- A format **used** by a Volume cannot be deleted (the button's tooltip says which ones); nor can the
  last format.
- The four **built-in** formats (Franco-Belgian, US Comics, Vertical webtoon, Custom format) are a
  Project's starting list, renamable and deletable like the others.
- Everything is undone with Ctrl+Z.

## Millimetres and pixels

A Page is drawn at a screen size (`w`, `h`) and exported multiplied by `scale`. A Panel's
**Dimensions** section shows its sides in mm thanks to `mmW`, the format's **printed width**
(Franco-Belgian: 550 px for 220 mm, i.e. 2.5 px per mm).

- **In mm** (printed album): the longest side is 725 px on screen, export ×4; `mmW` is the width typed.
- **In px** (webtoon, screen): the size typed is the export size; above 1000 px, the Page is drawn
  reduced and `scale` brings it back to size. Millimetres then follow the 96 dpi equivalence.

## Data

`formats` at Project level: `[{ key, nom?, unite, largeur, hauteur, w, h, scale, mmW }]`. `nom` is
absent while a built-in format has not been renamed: it is then shown in the application's language.

Each Volume keeps its `format` key **and its copy** of `w`, `h`, `scale`, which drawing reads. Since a
format never changes dimensions, the copy cannot fall out of step.

**On reading**, a file without `formats` receives the four built-in formats. A Volume with an unknown
key, or with dimensions matching no format, receives the list's format at its dimensions, otherwise a
new one ("Custom format 2"…): only its key changes.

## Importing a page

An imported page whose proportions differ from the Volume's offers a matching format (see
[planche-importee.md](planche-importee.md)). That format joins the Project's ("Imported page", or an
existing format with the same dimensions).
