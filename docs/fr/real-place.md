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
| `src/vegetation-zones.js` | PUR. Les bois, vergers, landes et haies relevés par l'IGN (France), remplis d'arbres et d'arbustes intégrés (`readVegetation`, `fillVegetation`). La requête : `realplace:vegetation`. |
| `src/landmarks.js` | PUR. Les croix, calvaires, éoliennes, antennes-relais et clochers relevés par l'IGN (France, BD TOPO `construction_ponctuelle`) : `readLandmarks`. La requête : `realplace:landmarks`. |
| `src/realistic-textures.js` | PUR. Les textures du niveau « Réaliste » : pour chaque emplacement (enduit, pierre, brique, pavés, gravier, asphalte, route, muret) une texture Poly Haven par région (`REALISTIC_TEXTURES`), ce qu'un lieu traduit demande (`realisticNeeds`) et la substitution (`applyRealisticTextures`). |
| `src/soils.js` | PUR. La couleur de la terre nue (et, au niveau Réaliste, sa texture) d'après la carte des sols de l'INRAE (France) : `soilKindOf`, `readSoils`, `applySoils`. La requête : `realplace:soils`. |
| `src/hedge-reading.js` | PUR. Les haies que personne n'a cartographiées, lues sur les hauteurs du LiDAR : crêtes du MNH (`ridgeMask`), là où les classes du LiDAR le permettent (`hedgeMayStand`, `hedgeCells`), suivies en lignes (`readHedges`). La requête : `realplace:lidarClasses`. |
| `src/parcel-fences.js` | PUR. Les murs, clôtures et haies des jardins, le long des parcelles du cadastre, par des règles ; les murs que le LiDAR confirme à leur hauteur (`builtParcels`, `parcelFences`). Les parcelles viennent avec `realplace:extras`. |
| `src/bdtopo-extras.js` | PUR. Ce que la BD TOPO relève encore (France) : haies en ligne, terrains de sport, cimetières et leurs tombes, plans d'eau (`addExtras`). La requête : `realplace:extras`. |
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
  `width`). Aux niveaux « Détaillé » et « Réaliste » : une texture livrée d'une autre sorte quand OSM le dit
  (`pathTextureOf`, posée en `traceTexture`) : des pavés (`int:sol:paves`) sur une route ou un chemin dont le
  `surface` est sett, cobblestone ou paving_stones, du gravier (`int:sol:gravier`) sur un chemin de gravier,
  et la pierre de taille (`int:facade:pierre`) sur tout muret, sauf en brique, béton, bois, métal ou
  plastique (il garde les briques du muret).
- **Zones** (`zoneTypeOf`) : prairie, pelouse, forêt… → `herbe` ; parc, jardin, terrain de sport →
  `gazon` ; champs, vignes… → `terre` ; sable, plage → `sable` ; eau → `eau` ; parkings → `bitume`, place
  piétonne → `béton` (dallée) ; les deux suivent le `surface` d'OSM quand il nomme un des sols (asphalte,
  gravier… ; sett, cobblestone et paving_stones → `paves`, les pavés, que « Simple » garde en `béton`). `landuse=residential` et ses pareils sont trop vastes : ce n'est pas un sol. Le
  polygone devient un masque de Zone peinte en cases de 1 m (`maskOfPolygon`), `world` par
  `mondeDuMasque`.
- **Éléments** : `natural=tree` → `arbre`, `highway=street_lamp` → `lampadaire`, `traffic_sign` et
  `highway=stop|give_way` → `panneau_signalisation`, `natural=shrub` → `buisson`, `amenity=bench` → `banc`.
- **Sol** : `builtShare`, l'emprise des bâtiments sur celle de la zone ; à partir de 25 % (`BUILT_UP`), la
  zone est bâtie et le Sol de la Scène est `béton` (`ground`, posé en `panel.groundType`), sinon l'herbe
  par défaut. Parcs, jardins et autres Zones sont peints par-dessus.
- **Multipolygones de bâtiments** (relations `building` et `type=multipolygon`, demandées avec leur
  géométrie) : leurs chemins membres raccordés en anneaux fermés (`ringsOf`) ; chaque anneau extérieur est un
  bâtiment portant les balises de la relation, ses anneaux intérieurs ses COURS (6 m² ou plus, à 50 cm au moins
  du contour : `courtyardsOf` en trace les murs à chaque niveau et fait de leur pièce un vide, `vide`, comme
  les cours de l'éditeur ; le toit en fait le tour). Un bâtiment à cours n'est pas coupé en parties par les
  hauteurs. Les anneaux intérieurs de la BD TOPO (`holes`, `readBdTopo`) sont les cours d'un bâtiment ajouté
  d'après le relevé. La lecture du LiDAR les laisse de côté, et un toit monte jusqu'au milieu d'une aile
  (`roofHalfSpan`), pas de l'îlot. Un sol mappé en multipolygone (relations `landuse` : les vignes d'Eguisheim)
  devient une Zone par anneau extérieur, les cases de ses anneaux intérieurs vidées.
- **Écartés** : les autres relations, comptées dans `skipped.relations` ; les chemins illisibles ou hors zone.
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
   les codes de matériaux du cadastre (`wallFinishOf`, `roofFinishOf` : pierre de taille (la pierre livrée,
   `int:facade:pierre`), brique (les briques du muret, rougies par `BRICK_TINT`), bois, tuiles (canal au sud
   de 46° N, plates au nord), ardoise, métal, béton ; tout autre mur, d'OSM ou du relevé (rien de connu, une
   couleur seule, béton, parpaing), l'enduit livré (`int:facade:enduit`), teinté de sa couleur ; seuls les
   colombages gardent l'enduit uni). Sans réponse : OSM seul. Au niveau
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
   `surveyedRoof` ; le `sens` du faîtage par `ridgeSense` ; la pente mesurée abaissée quand,
   montée jusqu'au milieu de la partie la plus large du toit, elle irait plus haut que le toit mesuré, sommet moins égout,
   `pitchWithin` : la pente médiane d'un îlot étalée sur 48 m faisait un toit aussi haut que l'immeuble ; sans
   mesure, la pente du pays abaissée de même pour qu'un toit ne monte pas de plus de 6 m, `MAX_GUESSED_RISE`).
   Après la lecture aérienne, chaque arbre prend sa
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
   quand quelque chose en a été lu. Puis le relief : en France d'abord le modèle de terrain du LiDAR HD à 1 m (`terrainPlan`,
   une grille `realplace:terrainGrid`, l'`IGNF_LIDAR-HD_MNT_ELEVATION` du WMS-R, chaque cellule centrée sur un
   mètre ; `reliefFromTerrain` ; plus de 20 % sans donnée, pas couvert : la voie suivante ; crédit « © IGN,
   LiDAR HD (MNT) »), ses talus et fossés gardés ; sinon `planRelief` pour le pays, ses requêtes envoyées
   par `realplace:altitudes` (seulement vers `ALTITUDE_HOSTS`, au rythme du fournisseur), `assemble` ; en cas
   d'échec le fournisseur suivant, et sans aucun un Sol plat.
   Avant les modèles, chaque élément est écarté des bâtiments et des tracés qui barrent le passage
   (`clearOfObstacles`, placement-clearance.js : emprises gardées sur les bâtiments traduits, `footprint` ; routes,
   rivières, murets, clôtures, haies et barrières, leur demi-largeur ; les chemins aussi, les trottoirs
   jamais) : poussé à l'endroit le plus proche, à 1 m d'écart pour un arbre, 0,4 m pour le reste (un lampadaire peut être
   contre une façade : `AGAINST_BUILDINGS`), et retiré
   quand cet endroit est à plus de 4 m.
   Après la banque, la couronne de nos arbres générés (`fitCrowns` ; `crownOf`, ez-trees.js : le contour de ses
   feuilles vu de dessus et la hauteur où elle commence) est écartée des bâtiments plus hauts que le bas de la
   couronne : l'arbre tourné (8 orientations), sinon déplacé de 4 m au plus (son tronc toujours dégagé), sinon une
   autre variante générée (8 essayées), tournée et déplacée de même ; aucune ne convient : laissé tel quel. Le rig
   d'un arbre généré est centré sur son tronc (une boîte invisible aussi large de chaque côté) : le tronc est là
   où est l'arbre. Un déplacement n'amène jamais un arbre à moins de 2,5 m (`TREE_GAP_M`) d'un autre, et une
   fois les arbres placés, `spaceTrees` retire tout arbre à moins de cette distance d'un arbre déjà gardé (dans
   l'ordre des éléments) : deux arbres cartographiés deux fois, ou une rangée d'arbres échantillonnée sur des
   arbres cartographiés, ne partagent plus un tronc.
   En France, aux niveaux « Détaillé » et « Réaliste », les zones plantées : `realplace:vegetation` (la
   `formation_vegetale` de la BD Forêt v2, son `essence` et sa `tfv`, et la `zone_de_vegetation` de la BD TOPO, sa
   `nature` ; WFS, sans clé, en longitude et latitude), `readVegetation` (`kindOfEssence` : « Chênes décidus » →
   feuillus Quercus, « Pin sylvestre » → conifères Pinus, « Sapin, épicéa » → Abies ou Picea, une lande →
   arbustes, une forêt sans couvert → rien ; `kindOfNature` : forêts, bois, peupleraie, verger (Malus, Prunus,
   Pyrus), lande, haie ; les vignes laissées à #481), puis `fillVegetation` : chaque zone remplie sur une grille
   décalée (`AREA_KINDS` : 6 à 13 m d'écart, en rangs pour les vergers et les peupleraies, 2,5 m pour les arbustes
   d'une haie ; les arbres d'un verger hauts de 4 m sans mesure), pareille à chaque import, à 3 m des arbres déjà
   là, dans la zone ; une forêt de la BD TOPO dans une forêt de la BD Forêt laissée à celle-ci ; 350 arbres et 150
   arbustes au plus (répartis quand il y a plus de places). Chacun est un élément comme ceux d'OSM, son type connu
   (`kindKnown`), son genre quand l'essence le dit (« Chênes sempervirents » : le chêne vert par son espèce,
   `taxon`), `filled` : une de nos essences EZ-Tree quand son genre en a une (quelques variantes générées une fois,
   chaque arbre un clone avec ses niveaux de détail), sinon l'arbre intégré ; jamais un modèle de la banque ni des
   stores (des centaines de modèles noieraient le rendu). Crédit quand une forêt de la BD Forêt a été remplie :
   « © IGN, BD Forêt® v2 ».
   Avec elles, les parcelles agricoles (`farm-plots.js`) : le RPG, les parcelles déclarées à la PAC
   (`RPG.LATEST:parcelles_graphiques`, son `code_group` et son `code_cultu`, même requête). `groundOfPlot` : chaque
   groupe de cultures un sol (`PLOT_GROUNDS` : céréales en terre teintée dorée, colza et tournesol une culture verte,
   prairies en herbe, jachères en herbe sèche, légumes en terre labourée ; vignes en terre avec leurs rangs, `vines` : { angle }, le plus
   long côté de la parcelle, `vineRowAngle`, comme pour un `landuse=vineyard` d'OSM en « Détaillé » et « Réaliste », et
   pour les zones « Vigne » de la BD TOPO, `readBdTopoVines`, posées après le RPG là où il n'en a pas) ;
   `addPlotGrounds` : chaque parcelle une Zone de son sol, ses cases prises aux Zones de terre et d'herbe d'OSM
   dessous (une Zone par case : deux Zones plates sur une case scintilleraient), laissées là où un autre sol les
   tient ; les interstices entre deux parcelles à quelques centimètres donnés à une parcelle voisine. Vergers,
   oliveraies et noyeraies (ceux du RPG, les « Verger » de la BD TOPO, les `landuse=orchard` d'OSM) sont des Zones avec
   `orchard` (`orchardOf` : le sens de leurs rangs, une essence de leurs genres, la noix par sa culture, NOX un noyer ;
   `ORCHARD_KINDS` : rangs de 5 × 3,5 m pour un verger, 7 × 6 pour les oliviers, 9 × 8 pour les noyers) : leurs arbres
   ne sont pas des Éléments mais dessinés au rendu par orchard-3d.js (`orchardTrees` : en rangs, sur les cases de la
   Zone, jamais à moins de 1,5 m d'un Tracé, 1 500 au plus par Zone), en copies de trois variantes LÉGÈRES de l'essence
   (ez-trees.js `lightenOptions` : un niveau de rameaux de moins, moins de sections, moitié moins de feuilles, plus
   grandes, en un plan : environ 1 800 triangles pour un pommier contre 12 000), leurs feuilles découpées à 0,2 (à 0,5 leurs mipmaps
   vidaient les couronnes de loin). Budget des forêts dépassé : la grille
   s'élargit. Crédit : « © IGN, RPG ».
   Un champ de céréales, de maïs, de colza ou de tournesols (groupes du RPG 1, 3, 4 ; 2 ; 5 ; 6 : `cropOfGroup`) est
   une Zone avec `crop` ({ kind, angle }) ; crops-3d.js dessine sa culture debout au rendu (`cropCards` : rangs à
   l'écart de la culture, `CROP_KINDS`, sur les cases de la Zone, à 0,3 m des Tracés, 25 000 à 40 000 par champ), en
   copies d'une carte (plans croisés, `cropCardGeometry`) portant une touffe DESSINÉE en plein été (blé mûr avec ses
   grains et ses barbes, maïs en fleur, tournesols en fleur, colza en fleurs à quatre pétales ; `drawCropPicture`,
   512 × 1024), éclairée comme le sol (normales vers le haut), un InstancedMesh par partie et par champ. Un couvert
   fermé (blé, colza) a ses cartes dispersées et tournées au hasard, trois plans chacune, et une carte à plat à la
   hauteur des épis (`canopy`, `drawCropTop`) : vu de haut, des épis et des fleurs, aucun carré de terre nue. De près,
   le blé et le colza ont un second niveau de détail (`near`) : le champ découpé en carrés de 30 m (`CROP_TILE_M`),
   chacun un THREE.LOD dont le niveau proche, de petites cartes de quelques plantes dessinées en grand (chaque tige,
   chaque grain, chaque pétale), est construit la première fois que la caméra s'en approche à 40 m environ
   (`NEAR_M`). Les deux faces d'une carte sont éclairées pareil (`bothSidesLit` : le retournement de la face arrière
   par three retiré). Les
   plantes d'un champ, les ceps d'une vigne et les arbres d'un verger restent hors des bâtiments (scene3d.js
   `_plantsAvoid3D` : les emprises de leur rez-de-chaussée, avec la marge des Tracés) ; un bâtiment déplacé ou un Tracé
   dessiné les redessine. Mesuré en Beauce (300 m, 8 champs) : premier rendu environ 5,7 s.
   Les ceps d'une vigne ne sont pas des Éléments : au rendu, `vineStocks` (vineyard.js) les pose en rangs à 2,2 m, un
   tous les 1,1 m, sur les cases de la Zone, jamais à moins de 0,6 m d'une route, d'un chemin, d'un trottoir, d'un
   muret, d'une haie, d'une clôture, d'une barrière ou d'une rivière qui la traverse (`onTraces`, `VINE_OBSTACLES` ; un
   Tracé dessiné à travers la redessine), 8 000 au plus (le pas le long des rangs élargi), et `vineyard3D`
   (vineyard-3d.js) les dessine en copies de trois ceps qu'il CONSTRUIT comme on taille une vigne (`buildVineStock`,
   environ 260 triangles : un tronc tordu jusqu'au fil porteur, deux bras le long du rang, des rameaux montant entre
   les fils, des feuilles en cartes hors du plan du rang, découpées à 0,2 et non 0,5 : de loin leurs mipmaps passaient
   sous 0,5 et les rangs perdaient leurs feuilles ; l'essence « Vigne » donne l'écorce et les feuilles), un
   InstancedMesh par partie et variante, ses piquets (`vineRuns` : aux bouts d'un rang et tous les 5 ceps, entre deux
   ceps) en copies, ses trois fils (`VINE_WIRES`, 0,6, 1,0, 1,4 m) en lignes qui suivent le sol, chacun sur le Sol (`GROUND_Y_DEFAULT_3D`, −3) à la hauteur la plus basse du relief autour
   de son pied, enfoncé de quelques centimètres ; leur géométrie et leurs matériaux sont partagés
   (`userData.shared` : jamais libérés avec la Zone). Mesuré à Eguisheim (200 m, 17 Zones de vigne) : premier rendu
   environ 5 s (les vignes générées), puis environ 1,6 s.
   Après la lecture aérienne, la terre nue (France, « Détaillé » et « Réaliste », Zones de `terre`) :
   `realplace:soils` (WFS `INRA.CARTE.SOLS:geoportail_vf`, son `ger_nom` et son `nom_ucs`), `readSoils`,
   `soilKindOf` (les mots de la description d'abord : sable, calcaire, roche volcanique, cailloux, terre
   rouge ; sinon le groupe de sol : CALCOSOL → calcaire, BRUNISOL → brun, LUVISOL → limoneux, FLUVIOSOL →
   alluvial, REDUCTISOL → humide, ANDOSOL → volcanique…), `applySoils` : chaque Zone prend la couleur
   (`terrainColor`, `SOIL_KINDS`) du sol où se tiennent la plupart de ses cases. Au niveau « Réaliste », la
   texture Poly Haven de chaque sorte (choisie à la main, `SOIL_KINDS.polyhaven`, CC0) est prise dans « Mes
   textures », ou téléchargée (1k), et posée sur ces Zones à la place de la teinte (`textureDeLaTerre`, par
   `textureDuStore`) ; crédit « Terre nue : textures Poly Haven (CC0) ».
   Au niveau « Réaliste », après les modèles 3D, l'étape « Textures (Poly Haven) » : `realisticNeeds` liste les
   emplacements que le lieu emploie (la texture livrée d'une façade, d'une Zone, d'un Tracé : `facadeSlot`,
   `zoneSlot`, `pathSlot` ; une route sans texture à elle est l'emplacement `road`), chacun avec la texture
   Poly Haven de sa région (au sud de 46° N ou au nord), sans celles qui SONT la source d'une texture livrée
   (`PROVENANCE`) ; chacune est prise dans « Mes textures » ou téléchargée (1k, `textureDuStore`, qui refuse une
   texture qui ne sert pas les usages de l'emplacement), puis `applyRealisticTextures` les pose : un enduit
   garde sa couleur (elle teinte le plâtre), une façade de brique perd seulement `BRICK_TINT`. Sans réseau : les
   textures livrées restent. Crédit « Façades, sols et tracés : textures Poly Haven (CC0) ».
   Puis le reste de la BD TOPO (France, « Détaillé » et « Réaliste ») : `realplace:extras` (WFS `haie`,
   `terrain_de_sport`, `cimetiere`, `surface_hydrographique` ; `HAIES.BOCAGES:haie` porte les mêmes haies et
   `detail_orographique` seulement des noms, tous deux laissés), `addExtras` : une haie en Tracé `haie` (coupée à
   la zone, sa `hauteur` relevée en `wallHeight`, sa `largeur`), sauf si une haie OSM passe à 3 m ou que la
   végétation l'a déjà remplie d'arbustes ; un terrain de sport en Zone (`SPORTS_GROUNDS` : tennis et
   multisports en béton, grand terrain en gazon, piste en terre rouge, teinte que la carte des sols laisse), un
   cimetière en gravier avec des rangées de tombes (`gravesOf` : 3 m entre rangées, 1,6 m le long d'une rangée,
   dans le sens de son plus long côté, à 1,5 m de son mur, 200 au plus, aucune là où OSM a des tombes), un plan
   d'eau en eau ; une zone dont le milieu est déjà dans une Zone OSM du même sol est celle d'OSM.
   Puis les haies que personne n'a cartographiées (France, « Détaillé » et « Réaliste », avec les hauteurs) : la
   carte des classes du LiDAR sur la grille des hauteurs (`realplace:lidarClasses`, WMS `IGNF_LIDAR-HD_CLASS`,
   servie seulement en Web Mercator : le processus principal convertit l'emprise ; un PNG, décodé en mémoire puis
   jeté, `classesDuLidar`), `hedgeCells` : là où une haie peut se tenir (végétation, sol, sursol pérenne ; pas un
   bâtiment, ni ce que le LiDAR n'a pas su nommer, une voiture garée) ; puis `readHedges` : les CRÊTES du MNH
   (de `MIN_RISE` 0,5 à `MAX_RISE` 5 m, sous 70 % de cette hauteur à 3 m des deux côtés, selon l'une de quatre
   directions), hors des contours des bâtiments et 0,5 m autour, des routes (1 m de plus : les voitures garées)
   et des tracés et clôtures connus (`obstaclesOf`) ; les cases réunies, chaque partie suivie par son plus long
   chemin, puis le plus long dans ce qui reste (les cases à 3 m d'un chemin sont prises), gardées dès
   `MIN_LENGTH` 10 m, 200 au plus : chacune un Tracé `haie` (`source: 'lidar'`, sa hauteur médiane en
   `wallHeight`, sa largeur de 0,8 à 3 m). Les murs ne sont pas lus : le LiDAR voit la plupart en végétation ou en
   sol, et ni les murs de soutènement ni les clôtures ; une crête douteuse est une haie. Sans la carte des
   classes : les hauteurs seules ; `wallCells` (le sol et le sursol pérenne de la carte) est gardé pour la suite.
   Puis les limites des jardins (France, « Détaillé » et « Réaliste ») : les parcelles du cadastre (`parcels` de
   `realplace:extras`, WFS `CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle`), `builtParcels` : la parcelle d'une
   habitation porte un bâtiment de `HOUSE_MAX` 400 m² au plus, rien de plus grand, et fait `PARCEL_MAX` 3 000 m² au
   plus (le parking d'un magasin, une école, une ferme restent ouverts) ; `dense` quand ses bâtiments en couvrent
   la moitié (un centre ancien). `parcelFences` clôt chaque parcelle d'habitation SUR TOUT SON TOUR, en lisant sa
   limite tous les mètres : ouverte là où une route ou un chemin la traverse (à moins de 75 % de sa
   demi-largeur) ; rien à moins de 2,5 m du contour d'un bâtiment ni à moins de 2 m d'un mur, d'une haie ou d'une
   clôture déjà là (OSM, BD TOPO, lue sur le LiDAR) ; une limite partagée avec une autre parcelle d'habitation est
   posée une fois ; à moins de la demi-largeur d'une route + 4 m, sa FAÇADE ; ailleurs (un voisin, un champ, un
   terrain vide), un CÔTÉ. Les tronçons suivent chacun un côté du contour et se rejoignent bout à bout, et
   rejoignent le mur du bâtiment ou le Tracé connu voisin (à 4 m au plus). Un côté qui a déjà un mur, une haie ou
   une clôture est complété avec, à sa hauteur. Sinon : d'une parcelle dense, un mur de pierre de 2 m
   (`int:facade:pierre`) ; en façade, un muret d'enduit de 0,9 m (`int:facade:enduit`) ouvert de 3 m devant la
   maison (dès 8 m) ; un côté, une clôture de 1,5 m ou une haie de 1,8 m (tirée du rang de la parcelle, la même à
   chaque import). Le LiDAR d'abord : un tronçon relevé de 0,6 à 3 m sur 60 % de sa longueur sur `wallCells` est
   un mur à sa hauteur médiane (`source: 'lidar'`). 400 morceaux au plus. Sans parcelles : rien de tout cela.
   Puis les petits ouvrages : `realplace:landmarks` (WFS `BDTOPO_V3:construction_ponctuelle`), `readLandmarks` :
   Croix → `croix`, Calvaire → `calvaire`, Eolienne → `eolienne`, Antenne → `antenne`, Clocher → `clocher` (les
   autres laissés de côté), leur `hauteur` relevée gardée quand elle est vraisemblable, un ouvrage qu'OSM a déjà
   (le même objet à 10 à 40 m) pas ajouté deux fois. Ceux d'OSM : `historic=wayside_cross` et `man_made=cross`
   (un calvaire quand son nom le dit), `generator:source=wind`, un `mast` ou une `tower` de télécommunication
   (`furnitureOf`). Un clocher se dresse dans son église et sort de son toit (l'écart à la pose le laisse là,
   `AGAINST_BUILDINGS`).
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
