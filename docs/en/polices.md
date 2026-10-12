# Fonts

> Task #423, October 2026. Bubble fonts: the ones shipped with the application, and the ones the
> user adds.

## Ten built-in fonts, one per use

Chosen with Valentin on 11 October 2026, from one rule: **a bubble font is complete**, meaning the
regular, bold, italic and bold italic are drawn by its designer. The previous ten counted only one;
eight are therefore replaced, and the candidates were sorted so that none duplicates another.

| Original uses | Font | Styles |
|---|---|---|
| Dialogue, Narration | Comic Neue | complete |
| Handwritten | Shantell Sans | complete |
| Narration | Nunito | complete |
| Shouts | Kanit | complete |
| Sound effects | Grandstander | complete |
| Sound effects | Bangers | one style |
| Robotic | Chakra Petch | complete |
| Narration | EB Garamond | complete |
| Typewriter | Courier Prime | complete |
| Horror | Creepster | one style |

The original uses were revised by Valentin on 12 October 2026 (`USAGES_POLICES` and
`POLICES_BULLES`, `src/constants.js`); everyone changes them afterwards in "My fonts".

Bangers and Creepster have no free and complete equivalent: they stay, and their styles are
simulated. Whispers have no font of their own: they are marked by the bubble (dashed outline) and
the italic of the dialogue font.

All are under the SIL Open Font License 1.1, checked against the `METADATA.pb` files of the
`google/fonts` repository. They are downloaded once by `tools/fetch-fonts.mjs`, with their licences,
into `assets/fonts/`. The application's table is `POLICES_BULLES` (`src/constants.js`); a test keeps
it in agreement with the tool, the bubble list and `BUBBLE_FONT_PRELOAD_LIST`.

**Retired fonts rewrite no Project.** A bubble keeps the name written in its file; `policeDeBulle`
draws it with its replacement (`POLICES_BULLES_RETIREES`). See [persisted-data.md](persisted-data.md).

## Bold and italic

Two toggles, **B** and **I**, combinable, under a bubble's font. Two added fields, `bulleGras` and
`bulleItalique`.

**A missing style is simulated, never refused** (Valentin's decision): the browser thickens or
slants the font, and the application says so, with a `~` on the toggle and a tooltip. A first
version greyed the toggle out; it was dropped, because an incomplete imported font must stay usable.

`styleDuTexteDeBulle` gives the `ctx.font` prefix; `variantesDeLaPolice` (`src/polices-utilisateur.js`)
tells, for a built-in or imported font, whether each style is real or simulated. The four styles of
every font are preloaded at start-up.

## The Fonts window

"My fonts", opened by the **Aa** button in the header, right of the model library
(`src/polices-ui.js`):

- the built-in fonts, then the added ones (both groups are only named when some are added), as a
  thumbnail grid or a list (the choice is remembered), with a filter by use; in list mode, a field
  changes the sample sentence, the same as the details one;
- a click opens the details in place of the list, without the toolbar, with "Back" at the bottom,
  always visible: its uses, alphabets, figures, punctuation, accents, an editable test sentence in
  the four styles (simulated ones marked `~`), the licence and the rights;
- **uses** work like the tags of "My models", through the same list (`src/liste-etiquettes.js`):
  set them on a font, create, rename, delete, from the details or the filter. The filter keeps the
  fonts that carry AT LEAST ONE of the ticked uses. They live in the index (`usages`,
  `usagesDesPolices`, channel `fonts:usage`); until the user touches them, they are the original
  ones (one per built-in font), seeded in their language at the first change;
- a right click on an imported font renames or deletes it;
- "Add a font": from a file, or "Search online", which opens the "Online" tab (below).

## Importing a file

Formats: `.ttf`, `.otf`, `.woff`, `.woff2`. Files are copied into `<Projects folder>/Polices`, next to
`Modeles` and `Images`, for the same reason: what the user does to back up their Projects covers
their fonts.

**What is read from the file** (`electron/bibliotheque/polices-fichiers.js`, plain Node): the family
name (`name` table, name 16 else 1, without the weight word a variable font leaves there), the weight
and italic (`OS/2`, else `head`), a variable font's weights (`fvar`), the licence and its address
(names 13 and 14), the copyright and designer, and `fsType`, the rights the font grants itself. WOFF2
is decompressed (Brotli): `name`, `OS/2`, `head` and `fvar` are never transformed there. **What a font
says about itself is no proof**: it is shown, with a warning if it declares itself restricted, and
nothing is refused.

**Files of one family make a single font** (Regular, Bold, Italic…). The name shown is the family's,
not the file's (requested).

**The index** `Polices/polices.json` lists the families and their files, and keeps the **renames**:
renaming a font rewrites no Project, a bubble citing the old name is drawn with the new one, chained
and loop-free. The decisions (index, name conflicts, renames) are in `electron/bibliotheque/polices.js`,
tested under plain Node.

**Import happens in two steps**: `fonts:pick` chooses and reads, keeping the bytes under a token; the
interface settles name conflicts (an imported font of the same name: replace or keep both; a built-in
one: yours under another name, or skip); `fonts:commit` writes.

**The channels** `fonts:list`, `fonts:read`, `fonts:pick`, `fonts:commit`, `fonts:rename`,
`fonts:delete`, `fonts:usage` fall under the exception documented in [architecture.md](architecture.md): bytes chosen
by the user at run time. Each font is loaded into the browser by `FontFace`
(`chargerPolicesUtilisateur`), with its weight range when variable.

## The font store

The "Online" tab of "My fonts". Source: **Fontsource** (checked on 12 October 2026): a public API
with no key, all of Google Fonts plus other free fonts, and for every font, before any download, its
category, licence, weights and styles. Ruled out: the Google Fonts API (key required, same
catalogue), DaFont and 1001 Fonts (no API, varying licences).

- **Search** in the catalogue, kept one hour in memory: text (accent and case insensitive),
  category, **"Complete only"** (real bold and real italic, ticked by default), sort by name or
  date. Pages of 48; the rest loads as you scroll (`suiteADemander`, `src/store-ui.js`, the same
  rule as the model stores).
- **Previews** are downloaded when the thumbnail becomes visible (`IntersectionObserver`), under a
  family name of the store's own ("SB apercu <id>"); the details load the real styles.
- **A font already there** carries a tick, and its add button is greyed out.
- **"Add to my fonts"** downloads the regular, bold, italic and bold italic that exist, in Latin
  (French and English included), then follows the path of a file import: read, kept under a token,
  name conflicts settled, written by `fonts:commit`.
- The code: `electron/bibliotheque/store-fontsource.js` (decisions, tested under plain Node),
  `store-polices.js` (requests and caches), `src/polices-store-ui.js` (the tab). Channels
  `fontstore:infos`, `fontstore:chercher`, `fontstore:apercu`, `fontstore:ajouter`.
- **Simulation**: `STORYBOARD_SIMULER_STORE`, like the model store; a recorded extract of the
  catalogue (`tests/fixtures/fontsource-catalogue.json`), and the built-in fonts' files when a font
  of the extract is one of them.

## What remains

- Other sources, as a second tab if needed (Fontshare: about a hundred fonts, a foundry licence of
  its own).
- A missing imported font (file deleted, Project sent to someone) is reported under "Missing
  files" ([missing-resources.md](missing-resources.md)); the bubble shows in a fallback font
  meanwhile.
