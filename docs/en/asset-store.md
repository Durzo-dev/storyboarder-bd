# The asset store

*[Version française](../fr/asset-store.md)*

Searching, showing and downloading resources from elsewhere without leaving the
application: 3D models first, textures next.

The interface and code rules shared by every store (window, cards, thumbnails, detail page), with
mockups, are in [store-guide.md](store-guide.md).

## Agreed scope

- **3D models, Sketchfab first**, then **Poly Haven**.
- **Textures next**: Poly Haven and ambientCG, on the same shell.
- **No dependency on a single source.** Sketchfab has changed owners twice (Epic in 2021, KitBash on
  12 August 2026); its API may change again. Each source is an interchangeable module, and
  everything else only knows the common format.

## What the Sketchfab API allows

Checked by calling the API.

- **Public search**, no login: `GET api.sketchfab.com/v3/search?type=models`, with
  `downloadable=true`, `q`, `license` (a single code), `categories` (one slug), `sort_by`
  (`-likeCount`, `-publishedAt`), `max_face_count`, `count` and `cursor` for the next page.
- **Each result** carries the name, the author and their page, five thumbnails (64 to 1920 px), the
  license (its label, not its code), face and animation counts, an embeddable 3D preview address,
  and `archives.glb`: size, texture count and maximum texture resolution. Some models have 8k
  textures and weigh more than 20 MB: the detail view must say so before downloading.
- **Download with login**: `GET /v3/models/{uid}/download` with the user's token returns links valid
  for five minutes to a glTF archive (zip: `scene.gltf`, `scene.bin`, `textures/`). The help pages
  also mention a direct GLB, to be checked once we have a token.
- **OAuth login required to download.** The application must be registered with Sketchfab
 ; "Implicit" mode, no secret, redirect to a local address.
- **Obligations** (Developer Terms 4.5 to 4.7): say the models come from Sketchfab, show the license
  and the author with a link, and carry that credit into whatever the user distributes.

## What the Poly Haven API allows

Checked by calling the API (`api.polyhaven.com`, guide: `polyhaven.com/llms.txt`).

- **No key, no account**, for searching as for downloading. Everything is **CC0**: commercial use
  included, no attribution required. The terms ask for a **User-Agent** naming the application, and
  for saying where the models shown come from (the credit under the grid).
- **`/assets?type=models`** returns the whole catalogue at once (about 520 models): name, authors,
  category (`Furniture/Seating/Chairs`), `polycount`, dimensions in millimetres, downloads, date,
  thumbnail. No pages: filtering, sorting and paging happen **on our side** (`pageLocale`), and the
  catalogue is kept in memory for an hour.
- **`/search?q=…&type=models`** returns the matching identifiers, most relevant first, in any
  language.
- **`/files/{id}`**: every file, by format and resolution, with size and md5. glTF comes as
  `.gltf` + `.bin` + textures, not as `.glb`.
- **Early-access** models (publication date still to come) are left out.

## Common categories

One list of 18 categories for every source and for local models (`store-categories.js`). Each one
targets **one** Sketchfab category (its API takes only one) and zero, one or several Poly Haven
ones: "Furniture & home" groups `furniture-home` on one side, `furniture`, `containers-storage`,
`lighting` and `office-stationery` on the other. A test requires every category found at a source
to fall into exactly one common category. Rule: group when possible, otherwise add ("News &
Politics" has its own, "News & politics"). Each
result carries its common category, recorded in the attribution on download. Switching tabs keeps
the chosen category.

## "My models", the local library

First tab of the same window, opened by the "Model library" button of the top bar, next to the
version (the left menu no longer has a section for it). The entries (`src/local-library.js`, pure): the file, a title (the source's one if it
came from the store), the common category ("Uncategorised" for a hand import), the full attribution,
and the uses in the open project (`modelUsageLocations`). A file that is referred to but missing
shows up, flagged. Filters: text (title, file, author, Scenes), category, use, skeleton; sorted by name
or date.

**Rigged or static.** The number of bones is measured when the thumbnail is rendered (`os` in the
thumbnail metadata). A rigged model carries a joint icon on its thumbnail; the details say
"Skeleton: n bones" or "No skeleton". The "Rigged / Static" filter leaves out a model not measured
yet, which only shows under "Rigged and static". Nothing similar in the online tabs: Poly Haven does
not say, and Sketchfab will be looked at with the API.

Thumbnails (`src/model-thumbnails.js`): decoded apart from the panels' cache, prepared like a panel,
photographed at three quarters, released; kept in `Vignettes-modeles/` with the file's signature
(`vignettes-modeles.js`). A model from the store gets its source's thumbnail.

The details reuse the gestures of the rest of the application, injected by events.js: go to a place
(closes the window), Editor (opens the standalone Editor on this model, instead of the former
Skeleton…), Rename…, Delete, and right-click on a card. The window sits BEFORE the
other modals in the document: the ones it opens come in front of it.

## Chosen category and tags

In the details of a model in "My models", under the source: the **category** (one, from the common
list; it replaces the source's or "Uncategorised", "Automatic" hands it back; no
category is guessed from the name) and the user's
**tags** (several per model, created, renamed and deleted from the "+ Tags" menu, or from the "Tags" filter, next to the categories). The filter
keeps the models that have ALL the ticked tags. It all lives in `bibliotheque-modeles.json`,
next to the Modeles folder, and follows model renames and deletions. What decides is in
`bibliotheque-modeles.js` (pure); the interface asks for an operation (`bibliotheque:operation`) and
gets the new state back.

## The source contract

Three modules in `electron/bibliotheque/`, in CommonJS, tested under plain Node:

- `store-sources.js`: the **common format** of a result, the **license** table (what each one
  allows: attribution, commercial use, modification), the known **sources**, search parameters
  **cleaned** before they reach a source, and the **credit line**.
- `store-sketchfab.js`: the address of a search and of a download request, and the translation of
  responses into the common format. **No request** is made there.
- `store-polyhaven.js`: the same for Poly Haven, plus the page built on our side.

In the window, **one tab per source** (`SOURCES_STORE`, src/store-ui.js). Each source keeps its own
categories and licenses; a filter that means nothing there (license and commercial use for Poly
Haven) is hidden. A response that arrives after a tab change is ignored.

A source writes a module of that kind; the interface, attribution and file storage do not change.
`tests/fixtures/sketchfab-recherche.json`, `polyhaven-catalogue.json` (an extract) and
`polyhaven-recherche.json` are real responses: if a source changes its format, those are the files
to record again.

An **unknown license** is read as conservatively as possible: attribution required, neither
commercial use nor modification. **Age-restricted** and non-downloadable models are left out.

## What lives where

- **Network and token**, in the main process. The login token never goes through the interface; it
  is encrypted on disk (`safeStorage`).
- **The interface**, in the renderer: it receives already normalised results and never needs to know
  where they come from.
- **Storage**, through the existing import path (`model-store.js`): a downloaded model is an imported
  model like any other, with its real size, morphology and skeleton.

## Attribution

Each downloaded resource keeps its source, identifier, author and link, license and date,
and keeps them through renames and deletions. They live in `attributions-modeles.json`, next to the
Modeles folder (which only holds `.glb` files).

**Duplicates.** Each time the store opens, it reads that file again (`store:telecharges`) and keeps
only the entries whose file is still on disk (`telechargesPresents`, store-sources.js). A model
already there carries a tick on its thumbnail and its details disable "Download", giving the
file name. In simulation, the first two results count as already downloaded. The store shows "Models provided by
Sketchfab".

**Where to see it.** The details of a model in "My models" show its source, author and license
with their links. The left menu no longer lists models (the library opens from a top-bar
button): the details view is therefore what carries the attribution.

**In exports.** An exported Page, PNG or PDF alike, carries under its image (and under the
list of Panels if shown) a "3D model credits" section: for each VISIBLE model of the Page that has an
attribution (inside a Panel, neither out of its frame nor hidden behind
something else: a Panel that received a large Scene only credits what it shows; the decision is the
"Not visible" list's, see [non-visible.md](non-visible.md), and a measurement that fails credits in
doubt), its title, author, license, source, then the model's address and the license's. The
credits are written INSIDE the image, not in a `.txt` next to it that would be lost at the first
sending, and always, whatever the Panel descriptions setting: the licenses require it. CC0 models
are credited too; a model imported by hand has no known attribution and does not appear. Pure and
tested: `src/export-credits.js`; the attributions are read at export time (`store:telecharges`),
and a failure to read them does not stop the export.

## Signing in to Sketchfab

Downloading from Sketchfab requires the user's account. Storyboarder BD is registered with Sketchfab
as a **public client** using the **Authorization Code** grant (Sketchfab supports neither Implicit for
this app nor PKCE).

| File | What it holds |
|---|---|
| `electron/bibliotheque/sketchfab-auth.js` | The decisions, pure and tested: client ID, redirect URI, authorization address, reading the redirect, request bodies, session, refresh. |
| `electron/bibliotheque/sketchfab-session.js` | The input/output: opening the browser, the one-shot redirect server, token requests (`net.fetch`), encrypted storage. |
| `electron/main.js`, `electron/preload.js` | The `sketchfab:status`, `sketchfab:login`, `sketchfab:cancelLogin`, `sketchfab:logout` channels. |
| `src/store-ui.js` | The account line of the Sketchfab tab (`accountLineState`). |

**Flow**:
1. "Sign in", at the bottom of the Sketchfab tab, opens `https://sketchfab.com/oauth2/authorize/` in the
   user's **own browser** (`shell.openExternal`), with `response_type=code`, the client ID, the redirect
   URI `http://127.0.0.1:53682/sketchfab/retour` and a random `state`. The user's existing sign-ins,
   password manager and two-factor apply, as OAuth recommends for native apps.
2. For the duration of the sign-in only (five minutes at most), a one-shot server listens on
   `127.0.0.1:53682`, never on the network. It checks the `state`, answers with a page in the design
   system (`callbackPage`: "Signed in to Sketchfab, you can close this tab"), then closes. The account
   line offers "Cancel" meanwhile.
3. The code is exchanged at `https://sketchfab.com/oauth2/token/`, **without a client secret**.
4. The user's name comes from `https://api.sketchfab.com/v3/me`.
5. The session (`accessToken`, `refreshToken`, `expiresAt`, `user`) is encrypted with `safeStorage`
   into `sketchfab-session.bin` in the user data folder; without OS encryption, it stays in memory.
   It is refreshed five minutes before it expires (`accessToken()`), and forgotten if the refresh is
   refused.

**The interface never receives the token**: only `{ connected, user }`.

**Pitfalls**:
- **Never put the client secret Sketchfab issued in the code**: the app is a public client and its
  source is public (a test checks no `client_secret` appears).
- The redirect URI must match the registered one exactly; another port or path is refused by
  Sketchfab. If another program holds port 53682, the sign-in reports it.

## Downloading

Poly Haven needs no account; Sketchfab needs the user signed in (see the next subsection).

1. `store:poids` gives the size of each offered resolution (`optionsTelechargement`) (`planTelechargement`, from `/files/{id}`).
2. `store:telecharger` (main process) downloads the `.gltf` and each included file at the resolution
   chosen with the arrow of the "Download" button (**1k** by default, 2k or 4k; never 8k, too heavy for a panel; the
   choice is remembered), only
   from `dl.polyhaven.org`, checks every md5, refuses beyond 300 MB, then **packs** everything into a
   `.glb` (`gltf-glb.js`, no dependency). Progress comes back through `store:progression`.
3. The renderer **saves** the `.glb` through the import path (`rangerModele`, src/model-store.js):
   same sanitising, same collisions ("(2)"), same detection of an identical duplicate.
4. A model already there, downloaded again at **another resolution**, is **replaced** under the
   same name (`remplacerModele`): the panels that use it follow, and the cache is cleared to reread it.
5. `store:attribuer` records the entry (with its resolution) in `attributions-modeles.json` (validated again in the main
   process); renaming the model carries it along (`models:rename`). The tick appears and the Models
   section refreshes.

**3D preview** (Poly Haven has no embeddable viewer): "View in 3D" asks for the model at 1k
(`store:apercu`), in memory only, and shows it in `src/store-apercu-3d.js`, through the same chain as
the panels (GLTFLoader, `couleursPourAffichage3D`, default lighting), drawn on demand, with the
gestures of Sketchfab's viewer (left drag: turn; right drag: move, `deplacement3D`; wheel: zoom),
released when
going back to the image or leaving the details view. The main process keeps the models loaded during
the session (`memoireBornee`: six models, 80 MB): closing the store or switching tabs does not lose
them, and "Download" at 1k right after reuses them without the network. Nothing is written to disk
before "Download".

One download at a time; it carries on if the details view is closed. In simulation nothing is
downloaded (no recorded response contains files).

### From Sketchfab

1. Signed out, the button reads "Sign in and download": it signs in in the browser (`signIn`), then
   downloads. Meanwhile it offers "Cancel". The account line is hidden in a model's details view.
2. `store:telecharger` asks `sketchfabSession.accessToken()` (main process) and calls
   `GET https://api.sketchfab.com/v3/models/{uid}/download` with `Authorization: Bearer`.
3. The answer gives **signed, short-lived** links (`lienTelechargement`): the `.glb` when offered,
   else the glTF archive (`gltf.url`, a zip), unpacked and packed into a `.glb` in memory
   (`gltf-archive.js`: `fichiersDuZip`, sub-folders included, unsafe paths skipped, then
   `empaqueterGlb`). It is fetched **without** the token, refused beyond 300 MB, and the result must
   start with `glTF`.
4. **Texture quality** (#467): Sketchfab gives one `.glb`, textures at the author's size. The arrow
   offers 1k and 2k when smaller than the largest texture (`optionsSketchfab`, from
   `archives.glb.textureMaxResolution`), then "original" with its weight. A shrunk quality is made
   in the renderer after the download (`reduireTexturesGlb`, src/glb-reduction.js: canvas, halving
   steps, same image format, an image that would come out heavier is kept), and the file rewritten
   (`remplacerImages`, src/glb-images.js, pure). The quality is recorded with the attribution
   (`origine` included); a model downloaded before is the original. The "Heavy model" warning
   follows the chosen quality (`estLourd(r, choix)`): textures counted at most at its size, its weight
   when known; the faces always count. The details follow it too (`lignesDetails(r, lang, choix)`):
   textures at the chosen size, the chosen weight, or the downloaded one said to be shrunk afterwards.
5. The renderer saves and attributes it as for Poly Haven.

Errors (`erreurDemande`): 401 → `connexion` (the account line shows "Session expired"), 403 →
`interdit`, 404 → `introuvable`, 429 → `quota`; neither `.glb` nor glTF in the answer → `formatAbsent`; an unreadable archive →
`corrompu`.

**Licence warnings** (`avertissementsLicence`, from the licence code): NC ("not in a comic that is
sold, funded or monetised") and ND ("do not share an image where this model is posed, recoloured or
retouched") show as warnings in the store record and in the "My models" record.

**Credits**: each credit in an export gives the model's address, then the **author's profile**
(`auteur.url`), then the licence's (`lignesCredit`).

## Seeing the store without network

In development, `STORYBOARD_SIMULER_STORE` returns the recorded responses instead of calling
Sketchfab or Poly Haven, flagged by a yellow banner:

```
[Console]::OutputEncoding=[Text.Encoding]::UTF8; cd C:\WebProjects\Storyboarder; $env:STORYBOARD_SIMULER_STORE='1'; npm start
```

To go back to normal, close the terminal, or `Remove-Item Env:STORYBOARD_SIMULER_STORE`.

## The texture store

Same principles as for models: a source is a module that makes no request, tested on real
responses, and everything else only knows the common format (`type: 'texture'`).

**Sources** (all CC0, no account or key):

- **Poly Haven** (`store-textures-polyhaven.js`): `/assets?type=textures` returns all 869 textures
  at once; each has `categories` (an array), tags and its **real size** in mm. `/files/{id}` gives
  each map (Diffuse, nor_gl, Rough, AO) per resolution.
- **ambientCG** (`store-textures-ambientcg.js`): `api/v2/full_json?type=Material`, server-side pages
  (`limit`, `offset`, `q`, `category` as a list), 2,037 materials; one JPG zip per resolution (1K ≈ 7
  to 10 MB). The real size, in cm, is often missing (0).
- **cc0-textures.com**: an aggregator with no API, serving 4K zips only. It repeats
  Poly Haven and ambientCG under their former names; only ShareTextures is new there. Planned as a
  third source, limited to ShareTextures, scaled down to 1k on import.

**Materials and uses** (`texture-matieres.js`). A texture has one
or more **materials** (20: grass, dirt, sand, gravel, rock, snow, asphalt, paving, brick, concrete,
render, wood, parquet, tiles, marble, carpet, wallpaper, metal, roof tiles, foliage), recognised from
the source's categories, then from WHOLE words in its tags and name. The **uses** (11: outdoor
ground, road, path, low wall, fence, hedge, exterior wall, interior wall, interior floor, ceiling,
roof) follow from the materials, never from the texture itself: they say where the application
offers it. A texture with no material (fabric, leather, food…) is left out.

**Download**: nothing by default, only the texture chosen in the store, at the resolution
chosen on its page: **1k** by default, 2k optional, **4k only for a texture used by buildings** (a
wall seen up close in a panel exported large); never 8k. We keep colour, relief (OpenGL normal),
roughness, ambient occlusion and displacement when present (not DirectX normals). The ambientCG zip
is read in memory (`zip-lecture.js`) and only those maps come out.

**The window**: separate from the model store (requested),
opened by its own header button, just right of the model library. Three tabs ("My textures", Poly
Haven, ambientCG), filters by text, material and use, the next page loading near the bottom. The
detail page replaces the grid: materials, uses, real size of one tile, and the resolution choice
with its weight (1k ticked) before "Download". In "My textures", the page says whether the grain is
ready, flags a visible seam, and offers "Delete".

**Import a folder** (tile at the head of "My textures", requested): pick the folder holding a
texture's maps; the application recognises each by its name (`_Color`, `_Diffuse`, `_BaseColor`;
`_NormalGL` or `_Normal`; `_Roughness`; `_AO`; `_Displacement`, `_Height`) and ignores the rest. A
DirectX normal is never taken. Clear refusal if the colour is missing or two resolutions sit
together. Materials are guessed from the names; otherwise the texture is "unclassified" and its
page lets you tick its materials (uses follow). Real size unknown: 2 m. Grain baked large.

**Storage**: `<Projects>/Textures/<source>-<id>/` (`couleur.jpg`, `normal.jpg`, `rugosite.jpg`,
`ao.jpg`, `deplacement.jpg`, and the grain), plus an entry in `Textures/bibliotheque-textures.json`
(credit, materials, uses, real size, resolution, baking measures): "My textures".

**Baking** on download, not on first use: the baker
(`tools/bake-textures.mjs`, `cuireMatiere3D`, shipped with the application) produces the ground and
path grain, its natural tint and its nature. A texture that tiles badly is KEPT and flagged
(`raccordVisible`); a texture with neither displacement nor AO gets no grain and stays usable as a
building finish. The renderer never supplies an address: the source is read again by its id.

**On the Ground and paths**: a texture with a `sol` use
becomes a Ground material (the Ground section of a Panel or Scene, terrain zones); a texture whose
use is a path type (road, dirt path, low wall, fence, hedge) is chosen for a path of that type. The
choice is made through a **large square** (the current texture, its name, “Change”), in the Ground
section and in the path's window: a click opens the store in **“choose” mode** (`choisirTexture`),
on “My textures”, the use locked; a card applies it, an online texture is downloaded in 1k then
applied. **The bundled textures** (`src/textures-integrees.js`: the Ground materials, Neutral and
Water included, and the paths' original textures) are in “My textures”, with their origin (that of
`assets/textures/LICENSES.md`, which a test compares), their grain's weight and a 3D preview (colour:
the tinted grain; relief: a normal map drawn from its shades). A right-click on a “My textures” card
renames or deletes it; a bundled texture can be renamed (its name goes in the library's
`nomsIntegrees`) but not deleted. It shows in its natural colour (the tint measured at baking); another colour tints it,
like the shipped textures. Ground materials are ADDED to `GROUND_TYPE_DEFS` (flagged `importee`):
all the code that looked a material up by its id finds it unchanged. Grains are read through IPC
(`textures:image`) and served as blob URLs. The persisted id (`tex:<folder>`) is described in
[persisted-data.md](persisted-data.md). The detail page says how many times the texture is used in
the open Project.

