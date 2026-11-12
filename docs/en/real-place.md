# A Scene from a real place

*[Version française](../fr/real-place.md)*

Building a Scene from OpenStreetMap: buildings, roads, paths, walls, rivers, grounds, trees and lamps.
"New scene" opens a choice: "Manual creation" (an empty Scene) or "From an existing place".

## What lives where

| File | Role |
|---|---|
| `src/osm-scene.js` | PURE. The OSM translator: an Overpass extract (`out geom`) becomes buildings, paths, Zones and Elements, in metres. |
| `src/real-place-sources.js` | PURE. The sources per country: relief providers (best first) and building rules, with a world fallback. |
| `src/geo-local.js` | PURE. Local metres around a geographic centre (`projector`). |
| `src/building-survey.js` | PURE. The IGN BD TOPO (France) read and matched to the OSM buildings: heights, roof pitch, materials. |
| `src/real-place-import.js` | PURE. The translation and the altitudes turned into a Scene's content (`sceneContentOf`: Path and Zone objects, relief, credits). |
| `src/real-place-ui.js` | The new Scene's window: the choice, then search, map (OpenStreetMap tiles), zone size, import with its progress. |
| `electron/bibliotheque/real-place.js` | The network (main process): Nominatim, Overpass (with mirrors), altitudes, tiles; identified by the application's User-Agent. |
| `src/real-place-lay.js` | Lays the content in a new Scene (`layRealPlace`): objects at their place, on the Ground, the zone framed from above. |
| `src/events.js` (`cablerLieuReel`, `creerScene`) | Calls it on a new Scene, in one undo step, then opens the Scene. |
| `tests/osm-scene.test.mjs`, `tests/real-place-sources.test.mjs`, `tests/real-place-import.test.mjs`, `tests/real-place-lay.test.mjs` | Their tests, on real extracts and real altimetry answers; the last one renders the laid Scene with the real 3D code. |

## The translator

`translateOsm(data, { centre, halfSize, country, rules, translate })` → `{ buildings, paths, zones, elements, skipped, attribution }`.

- **Frame**: local metres around `centre` (equirectangular projection), x to the east, z to the
  SOUTH (north is up in the top view). The zone is a square of at most `ZONE_SIDE_MAX` = 400 m.
- **Buildings** (closed ways with `building`): the footprint is cleaned (`cleanFootprint`: closing
  point, points closer than 30 cm, near-straight corners), centred on its bounding box, then built with
  the building editor's own functions: `creerBatiment`, `ajouterEtage` per level, `ajouterContour` and
  `actualiserPieces` per level, `fixerToit` on the top level, `ajouterOuverture`. Levels from
  `building:levels`, else `height` / the level height, else a default per type (the country's rules, `rulesFor`). Roof from
  `roof:shape`, else flat for commercial and public types, gabled otherwise; a flat roof with no known
  covering is grey (`#8f8b84`, gravel or bitumen), and the renderer draws the highest level's slab in the
  flat roof's covering (batiment-3d.js). Windows on every wall of
  2 m or more (one per 2.6 m); doors at the OSM entrances on the outline (`entrance=*` nodes within 1.5 m,
  `doorsOf`: on the ground-floor wall they stand on, where they stand, a garage door 2.4 m wide), else one on
  the ground-floor wall (1.5 m or more) nearest a road or path.
  A footprint the editor refuses (crossing itself) is skipped. Each building comes with its centre
  (`x`, `z`): the importer places it as a building Element (`creerElementBatiment`, `wxFloor`/`wzFloor`).
- **Paths** (`pathKindOf`): `highway` roads → `route` (width by type; a centre line (`markingOf`) with 2
  lanes or more, none with 1 or one-way, else only on main roads: motorway to tertiary and their links), pavements (`footway=sidewalk`) → `trottoir`, and a road's `sidewalk` tags (`sidewalkSides`) give a
  `trottoir` beside it on each side (`offsetPolyline`, 1.8 m unless `sidewalk:width`); other footways, paths, tracks, steps → `chemin`; `barrier` → `muret`, `cloture`,
  `haie`, `barriere`; `waterway` → `riviere`. A `width` tag wins. Tunnels are skipped. Clipped to the zone
  (`clipPolyline`). `world` is the Path's own (`pts`, `width`).
- **Zones** (`zoneTypeOf`): grass, meadow, forest… → `herbe`; park, garden, pitch → `gazon`; farmland,
  vineyard… → `terre`; sand, beach → `sable`; water → `eau`; parking and pedestrian squares → `bitume`.
  `landuse=residential` and the like are too wide: not a ground. The polygon becomes a painted Zone mask
  of 1 m cells (`maskOfPolygon`), `world` from `mondeDuMasque`.
- **Elements**: `natural=tree` → `arbre`, `highway=street_lamp` → `lampadaire`, `traffic_sign` and
  `highway=stop|give_way` → `panneau_signalisation`, `natural=shrub` → `buisson`, `amenity=bench` → `banc`.
- **Ground**: `builtShare`, the buildings' ground area over the zone's; from 25 % (`BUILT_UP`) the zone is
  built up and the Scene's Ground is `béton` (`ground`, laid as `panel.groundType`), otherwise the default
  grass. Parks, gardens and other Zones are painted over it.
- **Skipped**: relations (multipolygons), counted in `skipped.relations`; invalid or outside ways.
- **Attribution**: `OSM_ATTRIBUTION` ("© OpenStreetMap contributors, ODbL"), to show in the export credits.

The ground under buildings needs nothing: the rendered relief is already flattened there
(`reliefEffectif3D`).

## The import

1. The window: "New scene" (`ouvrirNouvelleScene`) shows the choice; "Manual creation" calls
   `creerSceneManuelle` (events.js: an empty Scene, opened). "From an existing place" shows search (Enter: Nominatim, `realplace:search`; while typing, from three letters after a 350 ms pause, suggestions from the IGN's completion service and Photon asked at once, `realplace:suggest`, merged as they come; Nominatim forbids auto-complete) or a click on the map (tiles `realplace:tile`, cached for
   the session), the zone's size (100 to 400 m), the level of detail (`DETAIL_LEVELS`: « Simple », the volumes from OSM,
   default roofs, roads, paths, grounds, relief, trees and lamps; « Detailed », also the IGN survey in France,
   the materials, pavements, road signs, shrubs and benches; « Realistic », also the facades
   (`facadeStyleOf`, facade-style.js: shutters on a house or a block of four levels or fewer, a stone surround
   on a dwelling's openings, shop windows on the street side of a building holding a shop or a café, the
   region's colours (Alsace, the South, elsewhere) drawn by the building's id); what it brings is said under the row), "Create the scene". During the import, the zone's options give way
   to the progress: the step under way (« step n/7 ») centred, its detail (server, bytes) centred under it
   (fading out when there is none), the bar; only « Cancel » remains; after a failure
   the main button reads « Try again »; closing the window empties the search field. The steps (`IMPORT_STEPS`, `importProgress`: map data, country, buildings, relief, scene, then the Scene's
   building: buildings n / N, relief roads and grounds); the relief's requests are sent one by one so the bar
   follows them. « Cancel », the cross or Esc during the import (`annulerOuFermer`) close the window at once:
   the requests under way are aborted in the main process (`realplace:abort`, `abortImport`), each step
   checks it is still its window's (`moi`), and a Scene being built is removed.
2. The extract: `realplace:osm` with the zone's bounding box; Overpass servers in order (`OVERPASS`: the
   public instances without key or limit first, the overloaded main instance last), the first that answers
   completely (an answer ending with a runtime-error `remark` is incomplete, and the next server is asked);
   cached. The servers race, staggered (`overpassRace`): the first is asked; after 20 s without a good answer
   (`HEDGE_AFTER_MS`), or as soon as it fails, the next one too; the first complete answer wins and the others
   are stopped; a server that failed in the session is asked last (`overpassOrder`). All failed:
   `busy`, or `network` when none could be reached. The answer is read as a stream: `realplace:osmProgress` sends the server
   asked and the bytes received (every 200 ms at most), and the window shows them under the steps with the
   seconds spent (`downloadDetail`). Each attempt is logged (`[real-place] overpass <host>`: outcome,
   duration, size). The country: the chosen place's, else `realplace:country` (Nominatim reverse).
3. In France, the IGN's surveyed buildings: `realplace:bdtopo` (WFS `BDTOPO_V3:batiment`, no key, only the
   properties read), `readBdTopo`, then `translateOsm` with the country's rules and that `survey`. Each OSM
   building takes the surveyed building whose outline holds its centre of mass, of a comparable area (0.4
   to 2.5 times) (`matchSurvey`); a surveyed building no OSM building holds is added (`buildingTypeOf` from
   its use). Where OSM says nothing, the survey decides: levels from the eaves height (`hauteur`, ground to
   lowest point of the roof), the roof flat under 0.5 m of rise, else its pitch over half the narrow width
   (`surveyedRoof`), the facade and roof finishes from the land-registry material codes (`wallFinishOf`,
   `roofFinishOf`: dressed stone (the stone grain tinted pale), wood, tiles (barrel tiles south of 46° N, flat
   tiles north of it), slate, metal, concrete; half-timbered and rendered walls keep the
   plain render). Without an answer: OSM alone. At the « Realistic » level, the facades' colours from street
   photos (`couleursDesFacades`, facade-colour.js): Panoramax's photos of the zone (`realplace:streetPhotos`,
   no key, at most 500), for each building the photo that best sees one of its ground-floor walls (`bestView`:
   4 to 35 m, at most 75° from facing it (a street's photos see its facades at a slant), the wall in a flat photo's field, no other outline across the sight
   line), each photo fetched once (`realplace:streetPhoto`, only from the hosts the search gave; 60 at most, the
   most useful first), 35 points of the wall's middle part projected into it (`samplePoints`: equirectangular
   for a 360°, perspective otherwise, camera at 2.5 m), the mean of 5 × 5 pixels at each, and the median of
   what is left once dark, sky, green and glare are set aside (`wallColour`; none under 10 points or 30 %, nor a
   vivid or dark result), brought to the nearest of the street's facade colours (`FACADE_COLOURS`: renders,
   stones, bricks, by hue first: a shaded facade's blue cast becomes a grey): the building's facade takes it, its texture kept. The credit names the instance and the licence, never the
   contributor. Then the relief: `planRelief` for the country, its requests sent by
   `realplace:altitudes` (only to `ALTITUDE_HOSTS`, at the provider's rate), `assemble`; on failure the next
   provider, and with none a flat Ground.
4. `sceneContentOf`: Zones and Paths (`pathObject`, `zoneObject`, named by `nomDuTrace`), the relief
   (`reliefDepuisAltitudes`: base at the middle of the range, edges blended to 0 over 20 m to meet the flat
   Ground), the credits.
5. `creerScene` (events.js): one snapshot, `createScene`, then `layRealPlace` (real-place-lay.js): the relief
   and `creditsDuLieu` on the canvas, the Paths (`tracéUpdateScreenPts`), the buildings
   (`creerElementBatiment`), trees and lamps (`objetIntegreNeuf`, the same construction as « Add »), each
   placed by `wxFloor`/`wzFloor` and set on the Ground (`applyGroundMagnetY`); the camera, from above, at the
   distance where the zone fills the view with a 10 % margin (the field of view is fixed: the page's height
   seen at 30 m). It returns the Scene, unopened.
6. `construireScene` (events.js): `buildScene` (scene-loading.js) marks the Panel as being built (a render then
   draws only the buildings already built and does not flatten the ground under them; the Panel's
   signature is the step reached), then `openScene(id, { progressif: false })` opens it behind the window; the buildings are built
   in slices of about 40 ms, the window showing their count and the Scene drawn every 300 ms as it grows, then the first complete render. Cancelled: the
   Scene is removed and one goes back where one was (`retourApresChargement`).

**Opening an existing large Scene** (`PROGRESSIVE_FROM`, 20 placed buildings or more): `openScene` asks
`ouvrirSceneProgressivement` before its first render; the same `buildScene`, behind a translucent veil over the
Scene (`#sceneLoading`, in `main`) with a card at the bottom (bar, the two steps, « Cancel », which closes the
Scene and goes back where one was). A smaller Scene opens at once, as before.

**Credits**: `panel.creditsDuLieu` (a list of lines) on the Scene's canvas; `loadSceneIntoPanel` copies it to
the Panel; the export draws them once each (`creditsDuLieu`, export-credits.js) after the model credits.
The lines: OpenStreetMap, the IGN BD TOPO when a surveyed building was used (`surveyAttribution`), the
relief's provider.

## The sources per country

`rulesFor(country)` (ISO code): the building rules (level height, levels per type, flat-roof types, roof
pitch). France: 2.8 m levels, 35° roofs; the world: 3 m, 30°. `translateOsm` takes `country` (`fr` by
default).

`planRelief({ centre, halfSize, country, step = 5, providerIndex = 0 })` → `{ provider, fallbacks,
requests, assemble(answers) }`:
- the zone is sampled every `step` metres, no finer than half the provider's resolution, row by row
  from the north-west corner;
- `requests`: what to send (`url`, `method`, `body`, `count`), at most `maxPoints` per request;
- `assemble(answers)` (one JSON per request, in order) → `{ x0, z0, nx, nz, altitudes, provider,
  missing }`: altitudes every metre over the zone (at most 401 × 401), by bilinear interpolation; a
  point without data takes the mean of the others; null if an answer is unreadable (the import then
  plans with `providerIndex + 1`).

| Provider | Countries | Resolution | Limits | Request |
|---|---|---|---|---|
| IGN Géoplateforme, RGE ALTI® (`ign`) | `fr` | 1 m | 5,000 points per request, 5 requests/s, no key; -99999 outside coverage | POST JSON (5,000 points do not fit in an address) |
| Open-Meteo, Copernicus DEM GLO-90 (`openMeteo`) | all (fallback) | 90 m | assumed 100 points per request, 1 request/s | GET |

A country is added by an entry in `COUNTRIES` (its providers, best first, and its rules).

## Pitfalls

- **An altitude can be nonsense without being « no data ».** A few IGN samples in Montpellier came some 2,500 m
  under the town (not -99999): the relief's base (middle of the range) fell to -1,233 m and the town stood on a
  300 m cliff. A sample under -450 m or over 9,000 m, or more than 600 m from the zone's median, is treated as
  missing (`OUTLIER_METRES`, real-place-sources.js). The import logs the relief's range (`[real-place] relief:`).

- **An imported Element keeps the depth `o.z = 0`.** An Element's size is its 2D size seen at its depth, a
  perspective made for a few metres in front of the camera (30 m): at the place's north-south position
  (±200 m), a building shrank to nothing or grew out of scale. Its place is `wxFloor`/`wzFloor`.

- **A Scene's page has no size of its own.** The size is the Scene's (`scene.w`, `scene.h`), and the
  application reads it through `currentPage()`. Every 2D frame made against the bare page is NaN, and the
  Element is not drawn: `layRealPlace` gives the builders the same view as `currentPage()`.

- **The fixtures' geometry is `[lat, lon]`** (compacted); Overpass gives `{lat, lon}`. The translator
  reads both.
- **Overpass may refuse a browser** (an HTTP 406): the fixtures come from the OSM API
  (`/api/0.6/map`), compacted to the Overpass shape. The import is to query Overpass from the
  main process, with its User-Agent.
- **Open-Meteo's batch size and terms of free use** (non-commercial) are assumptions to check against
  the service before relying on it.
- **Attribution**: each provider has its `attribution`, to show with OSM's in the export credits.
