# Une Scène depuis un lieu réel

*[English version](../en/real-place.md)*

Construire une Scène d'après OpenStreetMap : bâtiments, routes, chemins, murets, rivières, sols, arbres
et lampadaires. Le traducteur existe (#457b-2) ; l'écran d'import arrive avec #457b-4.

## Où vit quoi

| Fichier | Rôle |
|---|---|
| `src/osm-scene.js` | PUR. Le traducteur OSM : un extrait Overpass (`out geom`) devient bâtiments, Tracés, Zones et Éléments, en mètres. |
| `tests/osm-scene.test.mjs` | Ses tests, sur deux extraits réels (`tests/fixtures/osm-eguisheim.json`, `osm-paris-mouffetard.json`). |

## Le traducteur

`translateOsm(data, { centre, halfSize, rules, translate })` → `{ buildings, paths, zones, elements, skipped, attribution }`.

- **Repère** : des mètres locaux autour de `centre` (projection équirectangulaire), x vers l'est, z vers
  le SUD (le nord en haut en vue de dessus). La zone est un carré de `ZONE_SIDE_MAX` = 400 m au plus.
- **Bâtiments** (chemins fermés portant `building`) : l'emprise est nettoyée (`cleanFootprint` : point de
  fermeture, points à moins de 30 cm, angles presque plats), centrée sur sa boîte, puis construite avec
  les fonctions mêmes de l'éditeur de bâtiments : `creerBatiment`, `ajouterEtage` par niveau,
  `ajouterContour` et `actualiserPieces` par niveau, `fixerToit` sur le niveau du haut,
  `ajouterOuverture`. Niveaux d'après `building:levels`, sinon `height` / 2,8 m, sinon une valeur par
  type (`DEFAULT_RULES`, France). Toit d'après `roof:shape`, sinon plat pour les commerces et bâtiments
  publics, à deux pans sinon. Des fenêtres sur chaque mur de 2 m ou plus (une tous les 2,6 m) ; une
  porte sur le mur du rez-de-chaussée (1,5 m ou plus) le plus proche d'une route ou d'un chemin. Une
  emprise que l'éditeur refuse (qui se croise) est écartée. Chaque bâtiment vient avec son centre (`x`,
  `z`) : l'import le pose en Élément bâtiment (`creerElementBatiment`, `wxFloor`/`wzFloor`).
- **Tracés** (`pathKindOf`) : les routes `highway` → `route` (largeur selon le type, sans marquage pour
  les rues piétonnes, de service et de rencontre), trottoirs, sentiers, pistes, escaliers → `chemin` ;
  `barrier` → `muret`, `cloture`, `haie`, `barriere` ; `waterway` → `riviere`. Une balise `width` l'emporte.
  Les tunnels sont écartés. Découpés à la zone (`clipPolyline`). `world` est celui d'un Tracé (`pts`,
  `width`).
- **Zones** (`zoneTypeOf`) : prairie, pelouse, forêt… → `herbe` ; parc, jardin, terrain de sport →
  `gazon` ; champs, vignes… → `terre` ; sable, plage → `sable` ; eau → `eau` ; parkings et places
  piétonnes → `bitume`. `landuse=residential` et ses pareils sont trop vastes : ce n'est pas un sol. Le
  polygone devient un masque de Zone peinte en cases de 1 m (`maskOfPolygon`), `world` par
  `mondeDuMasque`.
- **Éléments** : `natural=tree` → `arbre`, `highway=street_lamp` → `lampadaire`.
- **Écartés** : les relations (multipolygones), comptées dans `skipped.relations` ; les chemins illisibles
  ou hors zone.
- **Attribution** : `OSM_ATTRIBUTION` (« © OpenStreetMap contributors, ODbL »), à montrer dans les crédits
  de l'export.

Le sol sous les bâtiments n'a besoin de rien : le relief rendu y est déjà aplani (`reliefEffectif3D`).

## Pièges

- **La géométrie des données de test est `[lat, lon]`** (compactée) ; Overpass donne `{lat, lon}`. Le
  traducteur lit les deux.
- **Overpass a refusé le navigateur intégré** par une erreur 406 (11 nov. 2026) : les données de test
  viennent de l'API OSM (`/api/0.6/map`), compactées à la forme d'Overpass. L'import (#457b-4) interroge
  Overpass depuis le processus principal, avec son User-Agent.
