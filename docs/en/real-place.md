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
| `src/real-place-import.js` | PURE. The translation and the altitudes turned into a Scene's content (`sceneContentOf`: Path and Zone objects, relief, credits). |
| `src/real-place-ui.js` | The new Scene's window: the choice, then search, map (OpenStreetMap tiles), zone size, import with its progress. |
| `electron/bibliotheque/real-place.js` | The network (main process): Nominatim, Overpass (with mirrors), altitudes, tiles; identified by the application's User-Agent. |
| `src/events.js` (`cablerLieuReel`, `creerScene`) | Lays the content in a new Scene, in one undo step. |
| `tests/osm-scene.test.mjs`, `tests/real-place-sources.test.mjs` | Their tests, on real extracts and real altimetry answers. |

## The translator

`translateOsm(data, { centre, halfSize, country, rules, translate })` → `{ buildings, paths, zones, elements, skipped, attribution }`.

- **Frame**: local metres around `centre` (equirectangular projection), x to the east, z to the
  SOUTH (north is up in the top view). The zone is a square of at most `ZONE_SIDE_MAX` = 400 m.
- **Buildings** (closed ways with `building`): the footprint is cleaned (`cleanFootprint`: closing
  point, points closer than 30 cm, near-straight corners), centred on its bounding box, then built with
  the building editor's own functions: `creerBatiment`, `ajouterEtage` per level, `ajouterContour` and
  `actualiserPieces` per level, `fixerToit` on the top level, `ajouterOuverture`. Levels from
  `building:levels`, else `height` / the level height, else a default per type (the country's rules, `rulesFor`). Roof from
  `roof:shape`, else flat for commercial and public types, gabled otherwise. Windows on every wall of
  2 m or more (one per 2.6 m); a door on the ground-floor wall (1.5 m or more) nearest a road or path.
  A footprint the editor refuses (crossing itself) is skipped. Each building comes with its centre
  (`x`, `z`): the importer places it as a building Element (`creerElementBatiment`, `wxFloor`/`wzFloor`).
- **Paths** (`pathKindOf`): `highway` roads → `route` (width by type, no marking on pedestrian, service
  and living streets), footways, paths, tracks, steps → `chemin`; `barrier` → `muret`, `cloture`,
  `haie`, `barriere`; `waterway` → `riviere`. A `width` tag wins. Tunnels are skipped. Clipped to the zone
  (`clipPolyline`). `world` is the Path's own (`pts`, `width`).
- **Zones** (`zoneTypeOf`): grass, meadow, forest… → `herbe`; park, garden, pitch → `gazon`; farmland,
  vineyard… → `terre`; sand, beach → `sable`; water → `eau`; parking and pedestrian squares → `bitume`.
  `landuse=residential` and the like are too wide: not a ground. The polygon becomes a painted Zone mask
  of 1 m cells (`maskOfPolygon`), `world` from `mondeDuMasque`.
- **Elements**: `natural=tree` → `arbre`, `highway=street_lamp` → `lampadaire`.
- **Skipped**: relations (multipolygons), counted in `skipped.relations`; invalid or outside ways.
- **Attribution**: `OSM_ATTRIBUTION` ("© OpenStreetMap contributors, ODbL"), to show in the export credits.

The ground under buildings needs nothing: the rendered relief is already flattened there
(`reliefEffectif3D`).

## The import

1. The window: "New scene" (`ouvrirNouvelleScene`) shows the choice; "Manual creation" calls
   `creerSceneManuelle` (events.js: an empty Scene, opened). "From an existing place" shows search (Nominatim, `realplace:search`) or a click on the map (tiles `realplace:tile`, cached for
   the session), the zone's size (100 to 400 m), "Create the scene". During the import, a bar and the list
   of steps (`IMPORT_STEPS`, `importProgress`: map data, country, buildings, relief, scene); the relief's
   requests are sent one by one so the bar follows them.
2. The extract: `realplace:osm` with the zone's bounding box; Overpass servers in order (`OVERPASS`), the
   first that answers; cached. The country: the chosen place's, else `realplace:country` (Nominatim reverse).
3. `translateOsm` with the country's rules, then the relief: `planRelief` for the country, its requests sent by
   `realplace:altitudes` (only to `ALTITUDE_HOSTS`, at the provider's rate), `assemble`; on failure the next
   provider, and with none a flat Ground.
4. `sceneContentOf`: Zones and Paths (`pathObject`, `zoneObject`, named by `nomDuTrace`), the relief
   (`reliefDepuisAltitudes`: base at the middle of the range, edges blended to 0 over 20 m to meet the flat
   Ground), the credits.
5. `creerScene` (events.js): one snapshot, `createScene`, the relief and `creditsDuLieu` on the canvas, the
   Paths (`tracéUpdateScreenPts`), the buildings (`creerElementBatiment`), trees and lamps
   (`objetIntegreNeuf`, the same construction as « Add »), each placed by `wxFloor`/`wzFloor`; the camera
   frames the zone (`distanceCameraPourPremierElement3D`).

**Credits**: `panel.creditsDuLieu` (a list of lines) on the Scene's canvas; `loadSceneIntoPanel` copies it to
the Panel; the export draws them once each (`creditsDuLieu`, export-credits.js) after the model credits.

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

- **An imported Element keeps the depth `o.z = 0`.** An Element's size is its 2D size seen at its depth, a
  perspective made for a few metres in front of the camera (30 m): at the place's north-south position
  (±200 m), a building shrank to nothing or grew out of scale. Its place is `wxFloor`/`wzFloor`.

- **The fixtures' geometry is `[lat, lon]`** (compacted); Overpass gives `{lat, lon}`. The translator
  reads both.
- **Overpass may refuse a browser** (an HTTP 406): the fixtures come from the OSM API
  (`/api/0.6/map`), compacted to the Overpass shape. The import is to query Overpass from the
  main process, with its User-Agent.
- **Open-Meteo's batch size and terms of free use** (non-commercial) are assumptions to check against
  the service before relying on it.
- **Attribution**: each provider has its `attribution`, to show with OSM's in the export credits.
