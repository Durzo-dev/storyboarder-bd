# Une Scène depuis un lieu réel

*[English version](../en/real-place.md)*

Construire une Scène d'après OpenStreetMap : bâtiments, routes, chemins, murets, rivières, sols, arbres
et lampadaires. Le traducteur existe ; l'écran d'import, pas encore.

## Où vit quoi

| Fichier | Rôle |
|---|---|
| `src/osm-scene.js` | PUR. Le traducteur OSM : un extrait Overpass (`out geom`) devient bâtiments, Tracés, Zones et Éléments, en mètres. |
| `src/real-place-sources.js` | PUR. Les sources par pays : fournisseurs de relief (le meilleur d'abord) et règles des bâtiments, avec un repli mondial. |
| `src/geo-local.js` | PUR. Des mètres locaux autour d'un centre géographique (`projector`). |
| `tests/osm-scene.test.mjs`, `tests/real-place-sources.test.mjs` | Leurs tests, sur des extraits réels et de vraies réponses d'altimétrie. |

## Le traducteur

`translateOsm(data, { centre, halfSize, country, rules, translate })` → `{ buildings, paths, zones, elements, skipped, attribution }`.

- **Repère** : des mètres locaux autour de `centre` (projection équirectangulaire), x vers l'est, z vers
  le SUD (le nord en haut en vue de dessus). La zone est un carré de `ZONE_SIDE_MAX` = 400 m au plus.
- **Bâtiments** (chemins fermés portant `building`) : l'emprise est nettoyée (`cleanFootprint` : point de
  fermeture, points à moins de 30 cm, angles presque plats), centrée sur sa boîte, puis construite avec
  les fonctions mêmes de l'éditeur de bâtiments : `creerBatiment`, `ajouterEtage` par niveau,
  `ajouterContour` et `actualiserPieces` par niveau, `fixerToit` sur le niveau du haut,
  `ajouterOuverture`. Niveaux d'après `building:levels`, sinon `height` / la hauteur d'un niveau, sinon une
  valeur par type (les règles du pays, `rulesFor`). Toit d'après `roof:shape`, sinon plat pour les commerces et bâtiments
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

## Les sources par pays

`rulesFor(pays)` (code ISO) : les règles des bâtiments (hauteur d'un niveau, niveaux par type, types à
toit plat, pente). France : niveaux de 2,8 m, toits à 35° ; le monde : 3 m, 30°. `translateOsm` prend
`country` (`fr` par défaut).

`planRelief({ centre, halfSize, country, step = 5, providerIndex = 0 })` → `{ provider, fallbacks,
requests, assemble(answers) }` :
- la zone est échantillonnée tous les `step` mètres, pas plus fin que la moitié de la résolution du
  fournisseur, ligne par ligne depuis le coin nord-ouest ;
- `requests` : ce qu'il faut envoyer (`url`, `method`, `body`, `count`), au plus `maxPoints` par requête ;
- `assemble(answers)` (un JSON par requête, dans l'ordre) → `{ x0, z0, nx, nz, altitudes, provider,
  missing }` : des altitudes tous les mètres sur la zone (401 × 401 au plus), par interpolation
  bilinéaire ; un point sans donnée prend la moyenne des autres ; null si une réponse est illisible
  (l'import planifie alors avec `providerIndex + 1`).

| Fournisseur | Pays | Résolution | Limites | Requête |
|---|---|---|---|---|
| IGN Géoplateforme, RGE ALTI® (`ign`) | `fr` | 1 m | 5 000 points par requête, 5 requêtes/s, sans clé ; -99999 hors couverture | POST JSON (5 000 points ne tiennent pas dans une adresse) |
| Open-Meteo, Copernicus DEM GLO-90 (`openMeteo`) | tous (repli) | 90 m | supposé 100 points par requête, 1 requête/s | GET |

Un pays s'ajoute par une entrée dans `COUNTRIES` (ses fournisseurs, le meilleur d'abord, et ses règles).

## Pièges

- **La géométrie des données de test est `[lat, lon]`** (compactée) ; Overpass donne `{lat, lon}`. Le
  traducteur lit les deux.
- **Overpass peut refuser un navigateur** (erreur HTTP 406) : les données de test
  viennent de l'API OSM (`/api/0.6/map`), compactées à la forme d'Overpass. L'import doit interroger
  Overpass depuis le processus principal, avec son User-Agent.
- **La taille des lots d'Open-Meteo et ses conditions d'usage gratuit** (non commercial) sont des
  hypothèses à vérifier auprès du service avant de s'y fier.
- **Attribution** : chaque fournisseur a son `attribution`, à montrer avec celle d'OSM dans les crédits.
