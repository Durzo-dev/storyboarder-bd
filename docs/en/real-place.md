# A Scene from a real place

*[Version française](../fr/real-place.md)*

Building a Scene from OpenStreetMap: buildings, roads, paths, walls, rivers, grounds, trees and lamps.
The translator exists (#457b-2); the import screen comes with #457b-4.

## What lives where

| File | Role |
|---|---|
| `src/osm-scene.js` | PURE. The OSM translator: an Overpass extract (`out geom`) becomes buildings, paths, Zones and Elements, in metres. |
| `tests/osm-scene.test.mjs` | Its tests, on two real extracts (`tests/fixtures/osm-eguisheim.json`, `osm-paris-mouffetard.json`). |

## The translator

`translateOsm(data, { centre, halfSize, rules, translate })` → `{ buildings, paths, zones, elements, skipped, attribution }`.

- **Frame**: local metres around `centre` (equirectangular projection), x to the east, z to the
  SOUTH (north is up in the top view). The zone is a square of at most `ZONE_SIDE_MAX` = 400 m.
- **Buildings** (closed ways with `building`): the footprint is cleaned (`cleanFootprint`: closing
  point, points closer than 30 cm, near-straight corners), centred on its bounding box, then built with
  the building editor's own functions: `creerBatiment`, `ajouterEtage` per level, `ajouterContour` and
  `actualiserPieces` per level, `fixerToit` on the top level, `ajouterOuverture`. Levels from
  `building:levels`, else `height` / 2.8 m, else a default per type (`DEFAULT_RULES`, France). Roof from
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

## Pitfalls

- **The fixtures' geometry is `[lat, lon]`** (compacted); Overpass gives `{lat, lon}`. The translator
  reads both.
- **Overpass refused the browser pane** with a 406 (11 Nov. 2026): the fixtures come from the OSM API
  (`/api/0.6/map`), compacted to the Overpass shape. The import (#457b-4) queries Overpass from the
  main process, with its User-Agent.
