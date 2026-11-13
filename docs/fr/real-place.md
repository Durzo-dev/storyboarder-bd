# Une Scène depuis un lieu réel

*[English version](../en/real-place.md)*

Construire une Scène d'après OpenStreetMap : bâtiments, routes, chemins, murets, rivières, sols, arbres
et lampadaires. « Nouvelle scène » ouvre un choix : « Création manuelle » (une Scène vide) ou « Depuis un lieu existant ».

## Où vit quoi

| Fichier | Rôle |
|---|---|
| `src/osm-scene.js` | PUR. Le traducteur OSM : un extrait Overpass (`out geom`) devient bâtiments, Tracés, Zones et Éléments, en mètres. |
| `src/real-place-sources.js` | PUR. Les sources par pays : fournisseurs de relief (le meilleur d'abord) et règles des bâtiments, avec un repli mondial. |
| `src/geo-local.js` | PUR. Des mètres locaux autour d'un centre géographique (`projector`). |
| `src/building-survey.js` | PUR. La BD TOPO de l'IGN (France) lue et appariée aux bâtiments OSM : hauteurs, pente du toit, matériaux. |
| `src/height-reading.js` | PUR. Les hauteurs du LiDAR de l'IGN (MNH, 50 cm) : l'égout et le toit réels de chaque bâtiment (plat ou en pente, pente, faîtage, deux ou quatre pans), la hauteur de chaque arbre. |
| `src/aerial-reading.js` | PUR. La vue aérienne lue mètre par mètre : la classe d'un pixel, le vrai sol des Zones, les arbres manquants, les pelouses des cours, le matériau des toits. |
| `src/aerial-photo.js` | PUR. La vue aérienne d'une zone (France), à LIRE pendant l'import, jamais montrée ni gardée : la photo à demander (`aerialPhotoPlan`), son crédit. La requête : `realplace:aerialPhoto` (le WMS de la Géoplateforme, `ORTHOIMAGERY.ORTHOPHOTOS`, un JPEG ; une réponse qui n'est pas un JPEG est une erreur). |
| `src/real-place-import.js` | PUR. La traduction et les altitudes devenues le contenu d'une Scène (`sceneContentOf` : objets Tracés et Zones, relief, crédits). |
| `src/real-place-ui.js` | La fenêtre d'une Scène neuve : le choix, puis recherche, carte (tuiles OpenStreetMap), taille de la zone, import avec sa progression. |
| `electron/bibliotheque/real-place.js` | Le réseau (processus principal) : Nominatim, Overpass (avec miroirs), altitudes, tuiles ; identifié par le User-Agent de l'application. |
| `src/real-place-lay.js` | Pose le contenu dans une Scène neuve (`layRealPlace`) : les objets à leur place, sur le Sol, la zone cadrée de dessus. |
| `src/events.js` (`cablerLieuReel`, `creerScene`) | L'appelle sur une Scène neuve, en une seule étape d'annulation, puis ouvre la Scène. |
| `tests/osm-scene.test.mjs`, `tests/real-place-sources.test.mjs`, `tests/real-place-import.test.mjs`, `tests/real-place-lay.test.mjs` | Leurs tests, sur des extraits réels et de vraies réponses d'altimétrie ; le dernier rend la Scène posée avec le vrai code 3D. |

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
  publics, à deux pans sinon ; un toit plat sans couverture connue est gris (`#8f8b84`, gravillons ou
  bitume), et le rendu dessine la dalle du niveau le plus haut dans la couverture du toit plat
  (batiment-3d.js). Des fenêtres sur chaque mur de 2 m ou plus (une tous les 2,6 m) ; une
  porte à chaque entrée cartographiée dans OSM sur le contour (nœuds `entrance=*` à moins de 1,5 m,
  `doorsOf` : sur le mur du rez-de-chaussée où elle se trouve, à sa place, une porte de garage de 2,4 m), sinon
  une porte sur le mur du rez-de-chaussée (1,5 m ou plus) le plus proche d'une route ou d'un chemin. Une
  emprise que l'éditeur refuse (qui se croise) est écartée. Chaque bâtiment vient avec son centre (`x`,
  `z`) : l'import le pose en Élément bâtiment (`creerElementBatiment`, `wxFloor`/`wzFloor`).
- **Tracés** (`pathKindOf`) : les routes `highway` → `route` (largeur selon le type ; une ligne centrale
  (`markingOf`) à partir de 2 voies, aucune à 1 voie ou en sens unique, sinon seulement sur les grands
  axes : autoroute à tertiaire et leurs bretelles), trottoirs cartographiés (`footway=sidewalk`) → `trottoir`, et les balises `sidewalk` d'une route
  (`sidewalkSides`) donnent un `trottoir` à côté d'elle de chaque côté (`offsetPolyline`, 1,8 m sauf
  `sidewalk:width`) ; autres sentiers, pistes, escaliers → `chemin` ;
  `barrier` → `muret`, `cloture`, `haie`, `barriere` ; `waterway` → `riviere`. Une balise `width` l'emporte.
  Les tunnels sont écartés. Découpés à la zone (`clipPolyline`). `world` est celui d'un Tracé (`pts`,
  `width`).
- **Zones** (`zoneTypeOf`) : prairie, pelouse, forêt… → `herbe` ; parc, jardin, terrain de sport →
  `gazon` ; champs, vignes… → `terre` ; sable, plage → `sable` ; eau → `eau` ; parkings → `bitume`, place
  piétonne → `béton` (dallée) ; les deux suivent le `surface` d'OSM quand il nomme un des sols (asphalte,
  pavés, gravier…). `landuse=residential` et ses pareils sont trop vastes : ce n'est pas un sol. Le
  polygone devient un masque de Zone peinte en cases de 1 m (`maskOfPolygon`), `world` par
  `mondeDuMasque`.
- **Éléments** : `natural=tree` → `arbre`, `highway=street_lamp` → `lampadaire`, `traffic_sign` et
  `highway=stop|give_way` → `panneau_signalisation`, `natural=shrub` → `buisson`, `amenity=bench` → `banc`.
- **Sol** : `builtShare`, l'emprise des bâtiments sur celle de la zone ; à partir de 25 % (`BUILT_UP`), la
  zone est bâtie et le Sol de la Scène est `béton` (`ground`, posé en `panel.groundType`), sinon l'herbe
  par défaut. Parcs, jardins et autres Zones sont peints par-dessus.
- **Écartés** : les relations (multipolygones), comptées dans `skipped.relations` ; les chemins illisibles
  ou hors zone.
- **Attribution** : `OSM_ATTRIBUTION` (« © OpenStreetMap contributors, ODbL »), à montrer dans les crédits
  de l'export.

Le sol sous les bâtiments n'a besoin de rien : le relief rendu y est déjà aplani (`reliefEffectif3D`).

## L'import

1. La fenêtre : « Nouvelle scène » (`ouvrirNouvelleScene`) montre le choix ; « Création manuelle » appelle
   `creerSceneManuelle` (events.js : une Scène vide, ouverte). « Depuis un lieu existant » montre une recherche (Entrée : Nominatim, `realplace:search` ; pendant la frappe, dès 3 lettres après 350 ms de pause, les suggestions du service de complétion de l'IGN et de Photon interrogés ensemble, `realplace:suggest`, fusionnées à mesure ; Nominatim interdit l'autocomplétion) ou un clic sur la carte (tuiles `realplace:tile`,
   gardées pendant la session), la taille de la zone (100 à 400 m), le niveau de détail (`DETAIL_LEVELS` : « Simple », les volumes d'OSM,
   toits par défaut, routes, chemins, sols, relief, arbres et lampadaires ; « Détaillé », en plus le relevé
   de l'IGN en France, les matériaux, trottoirs, panneaux, buissons, bancs et le mobilier urbain (`furnitureOf` : fontaines,
   bornes, poubelles, abribus tournés vers leur rue ; les alignements d'arbres, un tous les 8 m ; la
   `height` d'un arbre, son objet mis à cette taille) ; « Réaliste », en plus les
   façades (`facadeStyleOf`, facade-style.js : volets sur une maison ou un immeuble de quatre niveaux au plus,
   encadrement de pierre sur les ouvertures d'un logement, vitrines côté rue d'un bâtiment qui abrite un
   commerce ou un café, couleurs de la région (Alsace, Sud, ailleurs) tirées par l'identifiant du bâtiment) ;
   ce qu'il apporte est dit sous la ligne), « Créer la scène ». Pendant l'import, les options de la zone
   laissent la place à la progression : l'étape en cours (« étape n/7 ») centrée, son détail (serveur,
   octets) centré dessous (en fondu quand il n'y en a pas), la barre ; seul « Annuler » reste ;
   après un échec le bouton principal devient « Réessayer » ; fermer la fenêtre vide le champ de recherche.
   Les étapes (`IMPORT_STEPS`, `importProgress` : données de la carte, pays, bâtiments,
   relief, scène, puis la construction de la Scène : bâtiments n / N, relief, routes et sols) ; les requêtes
   du relief partent une à une pour que la barre les suive. « Annuler », la croix ou Échap pendant l'import
   (`annulerOuFermer`) ferment la fenêtre aussitôt : les requêtes en cours sont interrompues dans le
   processus principal (`realplace:abort`, `abortImport`), chaque étape vérifie qu'elle est encore celle de
   sa fenêtre (`moi`), et une Scène en construction est retirée.
2. L'extrait : `realplace:osm` avec l'emprise de la zone ; les serveurs Overpass dans l'ordre (`OVERPASS` : les
   instances publiques sans clé ni limite d'abord, l'instance principale, surchargée, en dernier), le premier
   qui répond en entier (une réponse finie par une `remark` d'erreur d'exécution est incomplète, et le
   serveur suivant est interrogé) ; gardé en mémoire. Tous en échec : `busy`, ou `network` quand aucun n'a
   pu être joint. Les serveurs font la course, en décalé (`overpassRace`) : le premier est interrogé ; après 20 s sans
   bonne réponse (`HEDGE_AFTER_MS`), ou dès qu'il échoue, le suivant aussi ; la première réponse complète
   l'emporte et les autres sont arrêtés ; un serveur en échec dans la session passe en dernier
   (`overpassOrder`). La réponse est lue en flux : `realplace:osmProgress` envoie le
   serveur interrogé et les octets reçus (toutes les 200 ms au plus), et la fenêtre les montre sous les
   étapes avec les secondes écoulées (`downloadDetail`). Chaque tentative est journalisée
   (`[real-place] overpass <hôte>` : résultat, durée, taille). Le pays : celui du lieu choisi, sinon `realplace:country` (Nominatim
   inverse).
3. En France, les bâtiments relevés par l'IGN : `realplace:bdtopo` (WFS `BDTOPO_V3:batiment`, sans clé, seules
   les propriétés lues), `readBdTopo`, puis `translateOsm` avec les règles du pays et ce `survey`. Chaque
   bâtiment OSM prend le bâtiment relevé dont le contour contient son centre de gravité, d'aire comparable
   (0,4 à 2,5 fois) (`matchSurvey`) ; un bâtiment relevé qu'aucun bâtiment OSM ne contient est ajouté
   (`buildingTypeOf` d'après son usage). Là où OSM ne dit rien, le relevé décide : les niveaux d'après la
   hauteur à l'égout (`hauteur`, du sol au point le plus bas du toit), le toit plat sous 0,5 m de montée,
   sinon sa pente sur la demi-largeur étroite (`surveyedRoof`), les revêtements de façade et de toit d'après
   les codes de matériaux du cadastre (`wallFinishOf`, `roofFinishOf` : pierre de taille (le grain de pierre teinté clair), bois, tuiles
   (canal au sud de 46° N, plates au nord), ardoise, métal, béton ; colombages et murs enduits gardent l'enduit uni). Sans réponse : OSM seul. Au niveau
   « Réaliste », la couleur des façades d'après les photos de rue (`couleursDesFacades`, facade-colour.js) :
   les photos Panoramax de la zone (`realplace:streetPhotos`, sans clé, 500 au plus), pour chaque bâtiment la
   photo qui voit le mieux un de ses murs du rez-de-chaussée (`bestView` : de 4 à 35 m, à moins de 75° de face (les photos d'une rue en voient les façades de biais),
   le mur dans le champ d'une photo plate, aucune autre emprise sur la ligne de vue), chaque photo téléchargée
   une fois (`realplace:streetPhoto`, seulement depuis les hôtes donnés par la recherche ; 60 au plus, les plus
   utiles d'abord), 35 points de la partie centrale du mur projetés dedans (`samplePoints` : équirectangulaire
   pour un 360°, perspective sinon, caméra à 2,5 m), la moyenne de 5 × 5 pixels en chacun, et la médiane de ce
   qui reste une fois écartés le sombre, le ciel, le vert et les reflets (`wallColour` ; rien sous 10 points ou
   30 %, ni un résultat vif ou sombre), ramenée à la plus proche des couleurs de façade d'une rue
   (`FACADE_COLOURS` : enduits, pierres, briques, d'abord par la teinte : le bleu d'une façade à l'ombre devient
   un gris) : la façade du bâtiment la prend, sa texture gardée. Le crédit nomme l'instance et la licence, jamais
   le contributeur. En France (Détaillé et Réaliste), avant la traduction, les hauteurs du LiDAR
   (`lireLesHauteurs`, height-reading.js ; `realplace:heightGrid` : le WMS de la Géoplateforme, couche
   `IGNF_LIDAR-HD_MNH_ELEVATION.ELEVATIONGRIDCOVERAGE.WGS84G`, flottants bruts `image/x-bil;bits=32`, un par
   50 cm, ligne par ligne depuis le nord ; une grille de la mauvaise taille est une erreur ; jamais gardée),
   données à `translateOsm` (`heights`) : pour chaque bâtiment `roofFromHeights` (les 10e et 95e centiles de
   ce qui dépasse 2 m dans son emprise : égout et sommet ; sous 1,2 m d'écart, plat ; sinon la pente médiane
   de son cœur, son bord de 1 m à part ; l'axe de la pente principale par angles doublés, le faîtage en
   travers ; quatre pans quand les pentes en travers pèsent 12 % ou plus et que l'emprise est presque
   convexe, un L ou un U se lisant pareil), passé comme `lidar` du relevé : il passe AVANT les balises et le
   relevé (`levelsOf` : le nombre de niveaux d'OSM gardé, leur hauteur d'après l'égout mesuré ; `roofOf`,
   `surveyedRoof` ; le `sens` du faîtage par `ridgeSense`). Après la lecture aérienne, chaque arbre prend sa
   hauteur mesurée (`treeHeightAt` : le plus haut à 2 m, de 3 à 40 m). Crédit : « © IGN, LiDAR HD ».
   Toujours en « Réaliste », en France, la vue aérienne LUE (`lireLaVueAerienne`,
   aerial-reading.js ; jamais montrée ni gardée) : téléchargée (`realplace:aerialPhoto`), décodée en mémoire,
   chaque mètre classé (`classGrid` : la classe la plus fréquente de ses pixels, `classOfPixel` : végétation
   par l'excès de vert, une canopée sombre et une pelouse claire, ombre, tuiles, clair, asphalte, gris ;
   calibré sur l'Écusson en peignant les classes sur la photo), puis `readAerialPhoto` sur la traduction : le
   vrai sol de chaque Zone (`groundOfZone` : vert → pelouse, clair → dallage, jamais d'asphalte (un dallage à l'ombre lui ressemble) ;
   ombres et toits à part, 40 % de la Zone vus au moins ; jamais l'eau), les arbres absents d'OSM
   (`missingTrees` : canopées de 8 m² ou plus hors des bâtiments et à 3 m d'un arbre cartographié, un arbre
   par couronne de 35 m², répartis ; 300 au plus), les pelouses qu'aucune Zone ne couvre (`lawnMask` : 25 m² ou plus, une
   Zone peinte de plus), les toits qu'aucune source ne décrit (`roofOfBuilding` sur le cœur du toit, son bord
   à part : tuiles à 55 %, gris à 65 % → `roofFinishRead` : tuiles, ou le gris du zinc ; un toit plat garde
   son gris ; `roofKnown`, posé par translateOsm, garde un toit qu'OSM ou le relevé décrit). Son crédit
   quand quelque chose en a été lu. Puis le relief : `planRelief` pour le pays, ses requêtes envoyées
   par `realplace:altitudes` (seulement vers `ALTITUDE_HOSTS`, au rythme du fournisseur), `assemble` ; en cas
   d'échec le fournisseur suivant, et sans aucun un Sol plat.
4. `sceneContentOf` : Zones et Tracés (`pathObject`, `zoneObject`, nommés par `nomDuTrace`), le relief
   (`reliefDepuisAltitudes` : base au milieu de l'étendue, bords ramenés à 0 sur 20 m pour rejoindre le Sol
   plat), les crédits.
5. `creerScene` (events.js) : un seul instantané, `createScene`, puis `layRealPlace` (real-place-lay.js) : le
   relief et `creditsDuLieu` sur le canevas, les Tracés (`tracéUpdateScreenPts`), les bâtiments
   (`creerElementBatiment`), arbres et lampadaires (`objetIntegreNeuf`, la même construction qu'« Ajouter »),
   chacun placé par `wxFloor`/`wzFloor` et posé sur le Sol (`applyGroundMagnetY`) ; la caméra, de dessus, à
   la distance où la zone remplit la vue avec 10 % de marge (le champ de vision est fixe : la hauteur de la
   page vue à 30 m). Elle rend la Scène, sans l'ouvrir.
6. `construireScene` (events.js) : `buildScene` (scene-loading.js) marque la Case en construction (un rendu ne
   dessine alors que les bâtiments déjà construits et n'aplanit pas le sol dessous ; la signature de la Case
   est l'étape atteinte), puis `openScene(id, { progressif: false })` l'ouvre derrière la fenêtre ; les bâtiments sont
   construits par tranches d'environ 40 ms, la fenêtre montrant leur compte et la Scène redessinée toutes les
   300 ms à mesure qu'elle se remplit, puis vient le premier rendu
   complet. Annulé : la Scène est retirée et on revient où l'on était (`retourApresChargement`).

**Ouvrir une grosse Scène existante** (`PROGRESSIVE_FROM`, 20 bâtiments placés ou plus) : `openScene` demande
`ouvrirSceneProgressivement` avant son premier rendu ; le même `buildScene`, derrière un voile translucide sur la
Scène (`#sceneLoading`, dans `main`) avec un encart en bas (barre, les deux étapes, « Annuler », qui ferme la
Scène et ramène où l'on était). Une Scène plus petite s'ouvre aussitôt, comme avant.

**Crédits** : `panel.creditsDuLieu` (une liste de lignes) sur le canevas de la Scène ; `loadSceneIntoPanel` la
recopie dans la Case ; l'export les dessine une fois chacune (`creditsDuLieu`, export-credits.js) après les
crédits des modèles. Les lignes : OpenStreetMap, la BD TOPO de l'IGN quand un bâtiment relevé a servi
(`surveyAttribution`), le fournisseur du relief.

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

- **Une altitude peut être absurde sans être « sans donnée ».** Quelques points de l'IGN à Montpellier sont
  arrivés environ 2 500 m sous la ville (pas -99999) : la base du relief (le milieu de l'étendue) est tombée à
  -1 233 m et la ville s'est dressée sur une falaise de 300 m. Un point sous -450 m ou au-dessus de 9 000 m, ou
  à plus de 600 m de la médiane de la zone, est traité comme manquant (`OUTLIER_METRES`, real-place-sources.js).
  L'import note l'étendue du relief au journal (`[real-place] relief:`).

- **Un Élément importé garde la profondeur `o.z = 0`.** La taille d'un Élément est sa taille 2D vue à sa
  profondeur, une perspective faite pour quelques mètres devant la caméra (30 m) : à la position nord-sud du
  lieu (±200 m), un bâtiment rétrécissait à rien ou grandissait hors d'échelle. Sa place est
  `wxFloor`/`wzFloor`.

- **La page d'une Scène n'a pas de taille à elle.** La taille est celle de la Scène (`scene.w`, `scene.h`),
  que l'application lit par `currentPage()`. Tout cadre 2D fait sur la page nue vaut NaN, et l'Élément n'est
  pas dessiné : `layRealPlace` donne aux constructeurs la même vue que `currentPage()`.

- **La géométrie des données de test est `[lat, lon]`** (compactée) ; Overpass donne `{lat, lon}`. Le
  traducteur lit les deux.
- **Overpass peut refuser un navigateur** (erreur HTTP 406) : les données de test
  viennent de l'API OSM (`/api/0.6/map`), compactées à la forme d'Overpass. L'import doit interroger
  Overpass depuis le processus principal, avec son User-Agent.
- **La taille des lots d'Open-Meteo et ses conditions d'usage gratuit** (non commercial) sont des
  hypothèses à vérifier auprès du service avant de s'y fier.
- **Attribution** : chaque fournisseur a son `attribution`, à montrer avec celle d'OSM dans les crédits.
