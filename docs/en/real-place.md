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
| `src/height-reading.js` | PURE. The IGN LiDAR's heights (MNH, 50 cm): each building's real eaves and roof (flat or pitched, pitch, ridge, two or four slopes), each tree's height. |
| `src/aerial-reading.js` | PURE. The aerial photo read metre by metre: the class of a pixel, the Zones' real grounds, the missing trees, the courtyards' lawns, the roofs' materials. |
| `src/aerial-photo.js` | PURE. The aerial photo of a zone (France), to be READ at the import, never shown nor kept: the photo to ask (`aerialPhotoPlan`), its credit. The request: `realplace:aerialPhoto` (the Géoplateforme's WMS, `ORTHOIMAGERY.ORTHOPHOTOS`, one JPEG; an answer that is not a JPEG is an error). |
| `src/vegetation-zones.js` | PURE. The woods, orchards, heaths and hedges the IGN surveys (France), filled with built-in trees and shrubs (`readVegetation`, `fillVegetation`). The request: `realplace:vegetation`. |
| `src/landmarks.js` | PURE. The crosses, calvaries, wind turbines, relay masts and bell towers the IGN surveys (France, BD TOPO `construction_ponctuelle`): `readLandmarks`. The request: `realplace:landmarks`. |
| `src/soils.js` | PURE. The bare earth's colour (and, « Realistic », its texture) from the INRAE's soil map (France): `soilKindOf`, `readSoils`, `applySoils`. The request: `realplace:soils`. |
| `src/bdtopo-extras.js` | PURE. What else the BD TOPO surveys (France): hedges as lines, sports grounds, cemeteries and their graves, water surfaces (`addExtras`). The request: `realplace:extras`. |
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
  vineyard… → `terre`; sand, beach → `sable`; water → `eau`; parking → `bitume`, a pedestrian square →
  `béton` (paved); both follow the OSM `surface` when it names one of the grounds (asphalt, sett, gravel…).
  `landuse=residential` and the like are too wide: not a ground. The polygon becomes a painted Zone mask
  of 1 m cells (`maskOfPolygon`), `world` from `mondeDuMasque`.
- **Elements**: `natural=tree` → `arbre`, `highway=street_lamp` → `lampadaire`, `traffic_sign` and
  `highway=stop|give_way` → `panneau_signalisation`, `natural=shrub` → `buisson`, `amenity=bench` → `banc`.
- **Ground**: `builtShare`, the buildings' ground area over the zone's; from 25 % (`BUILT_UP`) the zone is
  built up and the Scene's Ground is `béton` (`ground`, laid as `panel.groundType`), otherwise the default
  grass. Parks, gardens and other Zones are painted over it.
- **Building multipolygons** (relations with `building` and `type=multipolygon`, fetched with their geometry):
  their member ways joined into closed rings (`ringsOf`); each outer ring is a building with the relation's
  tags, its inner rings its COURTYARDS (6 m² or more, 50 cm from the outline at least: `courtyardsOf` draws their
  walls on every level and makes their room a void, `vide`, as the editor's courtyards; the roof goes round
  them). A building with courtyards is not cut into parts by height. The BD TOPO's inner rings (`holes`,
  `readBdTopo`) are the courtyards of a building added from the survey. The LiDAR's reading leaves them aside,
  and a roof climbs to the middle of a wing (`roofHalfSpan`), not of the block. A ground mapped as a
  multipolygon (`landuse` relations: Eguisheim's vineyards) becomes a Zone per outer ring, its inner rings'
  cells cleared.
- **Skipped**: other relations, counted in `skipped.relations`; invalid or outside ways.
- **Attribution**: `OSM_ATTRIBUTION` ("© OpenStreetMap contributors, ODbL"), to show in the export credits.

The ground under buildings needs nothing: the rendered relief is already flattened there
(`reliefEffectif3D`).

## The import

1. The window: "New scene" (`ouvrirNouvelleScene`) shows the choice; "Manual creation" calls
   `creerSceneManuelle` (events.js: an empty Scene, opened). "From an existing place" shows search (Enter: Nominatim, `realplace:search`; while typing, from three letters after a 350 ms pause, suggestions from the IGN's completion service and Photon asked at once, `realplace:suggest`, merged as they come; Nominatim forbids auto-complete) or a click on the map (tiles `realplace:tile`, cached for
   the session), the zone's size (100 to 400 m), the level of detail (`DETAIL_LEVELS`: « Simple », the volumes from OSM,
   default roofs, roads, paths, grounds, relief, trees and lamps; « Detailed », also the IGN survey in France,
   the materials, pavements, road signs, shrubs, benches and the street furniture (`furnitureOf`: fountains,
   bollards, litter bins, bus shelters turned to face their street; the rows of trees, one every 8 m; a
   tree's `height`, its object scaled to it); « Realistic », also the facades
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
   contributor. In France (Detailed and Realistic), before the translation, the LiDAR's heights
   (`lireLesHauteurs`, height-reading.js; `realplace:heightGrid`: the Géoplateforme's WMS, layer
   `IGNF_LIDAR-HD_MNH_ELEVATION.ELEVATIONGRIDCOVERAGE.WGS84G`, raw floats `image/x-bil;bits=32`, one per 50 cm,
   row by row from the north; a grid of the wrong size is an error; never kept), given to `translateOsm`
   (`heights`): for each building `roofFromHeights` (the 10th and 95th percentiles of what stands above 2 m
   in its footprint: eaves and top; under 1.2 m of rise, flat; otherwise the median slope of its core, its
   1 m edge aside, as the pitch; the main slope's axis by doubled angles, the ridge across it; hipped when
   the slopes across it weigh 12 % or more and the footprint is nearly convex, an L or a U reading alike),
   passed as the survey's `lidar`: it comes BEFORE the tags and the survey (`levelsOf`: OSM's count of levels
   kept, their height from the measured eaves; `roofOf`, `surveyedRoof`; the ridge's `sens` by `ridgeSense`).
   The measured pitch is lowered when, climbing to the middle of the roof's widest part, it would rise above the
   measured roof (top over eaves; `pitchWithin`): a block's median slope spread over 48 m made a roof as high
   as the building. With nothing measured, the country's pitch is lowered likewise so a roof rises 6 m at most
   (`MAX_GUESSED_RISE`).
   After the aerial reading, every tree takes its measured height (`treeHeightAt`: the highest within 2 m,
   3 to 40 m). Credit: « © IGN, LiDAR HD ». Still at « Realistic », in France, the aerial photo READ (`lireLaVueAerienne`,
   aerial-reading.js; never shown nor kept): fetched (`realplace:aerialPhoto`), decoded in memory, each metre
   classed (`classGrid`: the most frequent class of its pixels, `classOfPixel`: vegetation by green excess, a
   canopy dark and a lawn light, shadow, tiles, light, asphalt, grey; calibrated on the Écusson by painting
   the classes over the photo), then `readAerialPhoto` on the translation: each Zone's real ground
   (`groundOfZone`: green → grass, light → paving, never asphalt (a shaded paving looks alike); shadows and roofs aside, 40 % of the
   Zone seen at least; water never), the trees OSM lacks (`missingTrees`: canopies of 8 m² or more outside the
   buildings and 3 m from a mapped tree, one tree per 35 m² crown, spread; 300 at most), the lawns no Zone
   covers (`lawnMask`: 25 m² or more, one more painted Zone), the roofs no source describes (`roofOfBuilding` on the roof's
   core, its edge aside: tiles at 55 %, grey at 65 % → `roofFinishRead`: tiles, or zinc's grey; a flat roof
   keeps its grey; `roofKnown`, set by translateOsm, keeps a roof OSM or the survey describes). Its credit
   when something was read. Then the relief: in France first the LiDAR HD's terrain model at 1 m (`terrainPlan`, one
   grid `realplace:terrainGrid`, the WMS-R's `IGNF_LIDAR-HD_MNT_ELEVATION`, each cell centred on a metre;
   `reliefFromTerrain`; more than 20 % without data, not covered: the next way; credit « © IGN, LiDAR HD
   (MNT) »), its banks and ditches kept; otherwise `planRelief` for the country, its requests sent by
   `realplace:altitudes` (only to `ALTITUDE_HOSTS`, at the provider's rate), `assemble`; on failure the next
   provider, and with none a flat Ground.
   Before the models, every element stands clear of the buildings and of the paths that bar the way
   (`clearOfObstacles`, placement-clearance.js: footprints kept on the translated buildings as `footprint`;
   roads, rivers, low walls, fences, hedges and barriers, their half width; footpaths (`chemin`) too,
   pavements none): pushed to the nearest place 1 m clear for a tree, 0.4 m for anything else (a street lamp may stand against a
   facade: `AGAINST_BUILDINGS`), and left out when that
   place is more than 4 m away.
   After the bank, our generated trees' crowns (`fitCrowns`; `crownOf`, ez-trees.js: the outline of its leaves
   seen from above and where it starts) are kept out of the buildings taller than where the crown starts: the
   tree turned (8 turns), else moved up to 4 m (its trunk still clear), else another variant grown (8 tried),
   turned and moved likewise; none fitting, it is left as it was. A generated tree's rig is centred on its trunk
   (an invisible box as wide each side), so the trunk stands where the tree is. A move never brings a tree
   closer than 2.5 m (`TREE_GAP_M`) to another, and once the trees are placed, `spaceTrees` leaves out any
   tree closer than that to one already kept (in the order of the elements): two trees mapped twice, or a
   tree row sampled over mapped trees, no longer share a trunk.
   In France, at the « Detailed » and « Realistic » levels, the planted areas: `realplace:vegetation` (the
   BD Forêt v2's `formation_vegetale`, its `essence` and `tfv`, and the BD TOPO's `zone_de_vegetation`, its
   `nature`; WFS, no key, in longitude and latitude), `readVegetation` (`kindOfEssence`: « Chênes décidus » →
   broadleaved Quercus, « Pin sylvestre » → conifers Pinus, « Sapin, épicéa » → Abies or Picea, a heath →
   shrubs, a felled forest → nothing; `kindOfNature`: forests, wood, poplars, orchard (Malus, Prunus, Pyrus),
   heath, hedge; vines left to #481), then `fillVegetation`: each area filled on a jittered grid (`AREA_KINDS`:
   6 to 13 m apart, rows for orchards and poplars, 2.5 m for a hedge's shrubs; an orchard's trees 4 m high
   when nothing measured), the same at each import, 3 m from the trees already there, within the zone; a
   BD TOPO forest inside a BD Forêt one left to it; 350 trees and 150 shrubs at most (spread when there are
   more places). Each is an element like OSM's, its kind known (`kindKnown`), its genus when the essence says
   it (« Chênes sempervirents »: the holm oak by its species, `taxon`), `filled`: one of our EZ-Tree species when
   its genus has one (a few variants generated once, every tree a clone with its levels of detail), else the
   built-in tree; never a model of the bank or of the stores (hundreds of models would sink the render). Credit when a BD Forêt forest was filled: « © IGN, BD Forêt® v2 ».
   With them, the farm plots (`farm-plots.js`): the RPG, the parcels declared to the CAP
   (`RPG.LATEST:parcelles_graphiques`, its `code_group` and `code_cultu`, same request). `groundOfPlot`: each crop
   group a ground (`PLOT_GROUNDS`: cereals earth tinted golden, rape and sunflower a green crop, meadows grass,
   fallows dry grass, vegetables tilled earth; vines earth with their rows, `vines`: { angle }, the parcel's
   longest side, `vineRowAngle`, as for an OSM `landuse=vineyard` at « Detailed » and « Realistic », and for the BD
   TOPO's « Vigne » areas, `readBdTopoVines`, laid after the RPG's where it has none); `addPlotGrounds`: each parcel a
   Zone of its ground, its cells taken from OSM's earth and grass Zones under it (one Zone per cell: two flat Zones on
   one cell would flicker), left where another ground holds them; the slivers between two parcels a few centimetres
   apart given to a plot around them. Orchards, olive groves and nut groves (the RPG's, the BD TOPO's « Verger »,
   OSM's `landuse=orchard`) are Zones with `orchard` (`orchardOf`: their rows' direction, a species of their genera,
   the nut by its crop, NOX a walnut; `ORCHARD_KINDS`: rows 5 × 3.5 m for an orchard, 7 × 6 for olives, 9 × 8 for
   nuts): their trees are not Elements but drawn at render time by orchard-3d.js (`orchardTrees`: in rows, on the
   Zone's cells, never within 1.5 m of a Trace, at most 1 500 a Zone), copies of three LIGHT variants of the species
   (ez-trees.js `lightenOptions`: one level of twigs less, fewer sections, half the leaves, larger, one plane:
   about 1 800 triangles for an apple tree against 12 000). When the forests' budget is exceeded the grid is made
   wider. Credit: « © IGN, RPG ».
   A field of cereals, maize, rape or sunflowers (the RPG's groups 1, 3, 4; 2; 5; 6: `cropOfGroup`) is a Zone with
   `crop` ({ kind, angle }); crops-3d.js draws its crop standing at render time (`cropCards`: rows of the kind's
   spacing, `CROP_KINDS`, on the Zone's cells, 0.3 m off the Traces, 25 000 to 40 000 a field), copies of one card
   (crossed planes, `cropCardGeometry`) bearing a clump DRAWN in high summer (ripe wheat with its grains and awns,
   maize in tassel, sunflowers in flower, rape in four-petalled flowers; `drawCropPicture`, 512 × 1024), lit as the
   ground (normals up), one InstancedMesh a part and field. A closed stand (wheat, rape) has its cards scattered and
   turned at random, three planes each, and a level card at its ears' height (`canopy`, `drawCropTop`): from above,
   ears and flowers, no squares of bare earth. Every field's plants, a vineyard's stocks and an orchard's trees keep
   out of the buildings (scene3d.js `_plantsAvoid3D`: their ground floor's footprints, with the Traces' margin); a
   building moved or a Trace drawn redraws them. Measured in the Beauce (300 m, 8 fields): first render about 5.7 s.
   A vineyard's stocks are not Elements: at render time `vineStocks` (vineyard.js) lays them in rows 2.2 m apart, one
   every 1.1 m, on the Zone's own cells, never within 0.6 m of a road, path, pavement, wall, hedge, fence, barrier or
   river crossing it (`onTraces`, `VINE_OBSTACLES`; a Trace drawn across it redraws it), at most 8 000 (the step along the rows widened), and `vineyard3D`
   (vineyard-3d.js) draws them as copies of three stocks it BUILDS as a vineyard trains them (`buildVineStock`, about
   260 triangles: a twisted trunk up to the fruiting wire, two arms along the row, shoots up between the wires, leaf
   cards out of the row's plane, cut out at 0.2 rather than 0.5: from afar their mipmaps fell under 0.5 and the rows
   lost their leaves; the « Vigne » species gives its bark and leaves), one InstancedMesh per part and
   variant, its posts (`vineRuns`: at a run's ends and every 5 stocks, between two stocks) as copies, its three wires
   (`VINE_WIRES`, 0.6, 1.0, 1.4 m) as lines following the ground, each on the Ground (`GROUND_Y_DEFAULT_3D`, −3) at the relief's lowest height round its foot,
   a few centimetres in; their geometry and materials are shared (`userData.shared`: never
   disposed with the Zone). Measured at Eguisheim (200 m, 17 vineyard Zones): first render about 5 s (the vines
   generated), then about 1.6 s.
   After the aerial reading, the bare earth (France, « Detailed » and « Realistic », Zones of `terre`):
   `realplace:soils` (WFS `INRA.CARTE.SOLS:geoportail_vf`, its `ger_nom` and `nom_ucs`), `readSoils`,
   `soilKindOf` (the description's words first, sand, chalk, a volcanic rock, stones, red earth; else the
   soil group: CALCOSOL → chalky, BRUNISOL → brown, LUVISOL → loamy, FLUVIOSOL → alluvial, REDUCTISOL → wet,
   ANDOSOL → volcanic…), `applySoils`: each Zone takes the colour (`terrainColor`, `SOIL_KINDS`) of the soil
   most of its cells stand on. At « Realistic », each kind's Poly Haven texture (chosen by hand,
   `SOIL_KINDS.polyhaven`, CC0) is taken from « My textures », or downloaded there (1k), and laid on those
   Zones instead of the tint (`textureDeLaTerre`); credit « Bare earth: Poly Haven textures (CC0) ».
   Then the BD TOPO's extras (France, « Detailed » and « Realistic »): `realplace:extras` (WFS `haie`,
   `terrain_de_sport`, `cimetiere`, `surface_hydrographique`; `HAIES.BOCAGES:haie` holds the same hedges and
   `detail_orographique` only names, both left out), `addExtras`: a hedge as a `haie` Path (clipped to the zone,
   its surveyed `hauteur` as its `wallHeight` and its `largeur`), unless an OSM hedge runs within 3 m or the
   vegetation filled it as shrubs; a sports ground as a Zone (`SPORTS_GROUNDS`: tennis and multi-sports concrete,
   a large ground lawn, a running track red earth, a tint the soil map leaves), a cemetery as gravel with rows
   of graves (`gravesOf`: 3 m apart, 1.6 m along a row, as its longest side, 1.5 m inside its wall, 200 at most,
   none where OSM has graves), a water surface as water; an area whose middle an OSM Zone of the same ground
   holds is OSM's.
   Then the landmarks: `realplace:landmarks` (WFS `BDTOPO_V3:construction_ponctuelle`), `readLandmarks`:
   Croix → `croix`, Calvaire → `calvaire`, Eolienne → `eolienne`, Antenne → `antenne`, Clocher → `clocher`
   (the others left out), their surveyed `hauteur` kept within reason, one OSM already maps (the same object
   within 10 to 40 m) not added twice. OSM's own: `historic=wayside_cross` and `man_made=cross` (a calvary
   when its name says so), `generator:source=wind`, a communication `mast` or `tower` (`furnitureOf`). A bell
   tower stands within its church, rising out of its roof (the clearance leaves it there, `AGAINST_BUILDINGS`).
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
