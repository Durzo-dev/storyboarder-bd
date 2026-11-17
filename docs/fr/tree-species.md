# Les essences d'arbres

La fiche de chaque essence d'arbre que l'application génère avec EZ-Tree (`src/tree-species.js`). Elle
dit à quoi l'arbre doit ressembler, d'après des photos de référence, et comment on l'obtient : le modèle EZ-Tree
de départ, les réglages, l'écorce et le feuillage dessiné.

**Règle : toute nouvelle essence a sa fiche ici, dans les deux langues, AVANT d'être réglée.** Un test le
vérifie (`tests/tree-species.test.mjs`) : chaque essence de `species.js` doit avoir sa section dans ce document
et dans `docs/en/tree-species.md`.

Ce que contient chaque fiche :

- **Silhouette** : hauteur adulte en ville, largeur de la couronne, forme (dôme, colonne, parasol…).
- **Tronc** : hauteur sous les branches, diamètre, port (droit, tordu), écorce (aspect, couleur).
- **Branches** : départ, angle, densité.
- **Feuilles** : forme, taille, disposition sur le rameau, couleurs (dessus et dessous), persistantes ou non.
- **Dans EZ-Tree** : le modèle de départ, les réglages qui comptent, l'écorce (Poly Haven, CC0), le feuillage
  dessiné (`species.js`).
- **Références** : les photos (Wikimedia Commons) qui ont servi au réglage.

## Comment l'application s'en sert

EZ-Tree (Dan Greenheck, MIT) est copié dans l'application, dans `src/vendor/ez-tree/`, adapté à son three r128
(sans vent, sans treillis). `src/ez-trees.js` génère une variante d'une essence une fois (3 variantes par essence,
`VARIANTS`) et chaque arbre de cette variante en est une copie, mise à sa hauteur. Chaque variante a trois niveaux de
détail (`SPECIES_LODS`, `generateLODs` d'EZ-Tree : l'arbre entier, puis environ 40 % de ses triangles à partir de
60 m, 20 % à partir de 150 m), tous maillés d'un même squelette (la même silhouette) et partageant ses deux matériaux ;
three passe de l'un à l'autre selon la distance de la caméra.

À la création d'une Scène depuis un lieu (niveaux Détaillé et Réaliste), un arbre dont le genre est celui d'une
essence (étiquettes OSM, sinon tiré de la flore) reçoit cette essence (`essence`), une variante tirée de sa place
et, sans hauteur mesurée, la hauteur habituelle de l'essence (±15 %). Il ne prend aucun modèle de la banque ni des
stores. Chaque genre de la table de la flore (`GENERA`, flora.js) a une essence : une essence vaut pour plusieurs
genres d'une même forme (sa liste `genus`, nommée sur sa fiche). Un arbuste ou un buisson sans genre prend la
doublure de son type (`typeDefault` : l'arbuste persistant, la ronce) ; un arbre ou un conifère sans genre n'en
prend aucune (la banque).
La banque ne garde aucune plante qu'un import ne pourrait plus choisir (un test y veille) : les plantes retirées sont
listées dans `RETIRED_BANK_PLANTS` (model-bank.js), et au chargement d'un Projet chaque Élément qui en montre encore
une devient l'arbre EZ-Tree de son essence (`retireBankPlant` : sa hauteur et son centre gardés).

Une écorce est une photo de Poly Haven (`bark`, livrée en `assets/textures/ecorce-*.jpg`) ou dessinée par le code
(`barkDrawn`, celle du bouleau : pas de photo d'écorce de bouleau blanc là-bas) ; `barkGain` éclaircit une écorce plus
sombre que la vraie (sa teinte multipliée par le gain). Les écorces en photo arrivent après le premier dessin (une image
chacune). ⚠️ L'image d'une
Case est gardée en cache selon une signature de ce qu'elle montre : `barkSettled(essence)` y entre, pour qu'une Case
dessinée avant l'arrivée de l'écorce de ses arbres soit redessinée une fois celle-ci arrivée (ou constatée absente).
Sans cela, la première Case gardait des branches dessinées d'une texture vide : transparentes, blanc uni sur la page.
Tant que l'image n'est pas arrivée, les branches d'un arbre prennent la couleur unie de l'écorce (sans texture), et
son arrivée donne la texture à tous les matériaux en attente : jamais la texture vide.

⚠️ Les feuilles sont DÉCOUPÉES (alphaTest) et écrivent un alpha de 1 là où elles sont dessinées (`opaqueCutout`).
L'image 3D d'une Case est posée sur la page : des feuilles écrivant l'alpha de leurs mipmaps (0,66 à 0,8 à 30 m)
laissaient voir la page blanche, les couronnes pâles de loin.

## Les mises à jour d'EZ-Tree

`node tools/ez-tree/check-update.mjs` dit si une version plus récente d'EZ-Tree est sortie. Elle est proposée à
Durzo, puis, si elle est acceptée :

1. Reporter les changements de son `src/lib/` dans `src/vendor/ez-tree/ez-tree.js` (et `presets.js`), en gardant
   les adaptations listées en tête du fichier, et mettre à jour `EZ_TREE_VERSION`.
2. Mesurer les empreintes de ses modèles avec la nouvelle version (son propre `src/lib/`, assemblé avec esbuild et
   lancé sous Node avec le three qu'il demande), et les reporter dans `tests/ez-tree.test.mjs` : le test vérifie que
   la copie fait pousser les mêmes arbres qu'EZ-Tree, au bit près. Une version d'EZ-Tree paraît dans les étiquettes
   GitHub avant npm (la 2.0.0 : pas sur npm), que `check-update.mjs` lit aussi.
3. Revoir nos essences : un changement de croissance change leurs silhouettes (2.0.0 : sa force de croissance tire
   désormais vraiment vers le ciel, nos petites forces ont donc été mises à 0 sur le pin, le cèdre et le mélèze).
4. Reporter NOS AJOUTS (listés en tête du fichier, marqués « Ours (#485) » dans le code) : `branch.droop`,
   `branch.terminal`, `leaves.hang` et `fronds` (la couronne d'un palmier : rubans pliés, bases de palmes, un stipe
   sans pointe), neutres par défaut (les empreintes se mesurent sans eux), et testés dans `tests/ez-tree.test.mjs`.
   Ils sont destinés à une pull request chez EZ-Tree ; une fois chez EZ-Tree, ils sont les siens.

## Platane commun (*Platanus × hispanica*)

- **Silhouette** : 20 à 30 m en ville (souvent taillé plus bas), couronne large et ample, aussi large que haute
  ou presque.
- **Tronc** : haut et droit, 0,6 à 1,5 m de diamètre. Écorce qui se détache par plaques : marbrures vert-gris,
  crème et beige, typiques.
- **Branches** : grosses charpentières qui montent en biais (40 à 50°), puis s'étalent.
- **Feuilles** : palmées, 3 à 5 lobes pointus, sinus marqués, quelques dents ; 12 à 25 cm ; alternes ; vert
  moyen dessus, plus clair dessous. Caduques.
- **Dans EZ-Tree** : départ « Oak Large » ; tronc long (60), angle 40, 8 branches, rayon 3,4 ; feuillage dense
  (taille 5,5, 20 par rameau). Écorce `bark_platanus` (la vraie), éclaircie (gain 1,6 : la vraie est pâle et marbrée). Feuillage `leafTwig` forme `plane`, verts
  `#4f8a3e` à `#5a9445`.
- **Références** : Commons, « Fallen leaf of Platanus x hispanica (1).jpg », « Leafless London plane tree
  (Platanus × hispanica) », « Plane trees in Sóller being pruned ».

## Tilleul (*Tilia cordata*, *T. platyphyllos*)

- **Silhouette** : 15 à 25 m, couronne en dôme ovale, dense.
- **Tronc** : droit, 0,4 à 1 m. Écorce gris-brun, sillons longitudinaux fins et réguliers.
- **Branches** : nombreuses, montantes puis arquées vers l'extérieur.
- **Feuilles** : en cœur, base asymétrique, pointe allongée, bord finement denté ; 5 à 10 cm ; alternes ; vert
  moyen. Caduques.
- **Dans EZ-Tree** : départ « Ash Large » ; angles 50 et 45, poussée vers le haut 0,025 ; feuillage (taille 5,
  12). Écorce `tree_bark_03` teintée gris (`#d8d4cc`). Feuillage forme `linden`, verts `#4e8a35` à `#5c9a3f`.
- **Références** : Commons, « 2020 year. Herbarium. Tilia cordata », « Tilia platyphyllos(01).jpg »,
  « Tilia cordata bark beentree.jpg ».

## Cyprès de Provence (*Cupressus sempervirens*)

- **Silhouette** : 15 à 25 m, colonne étroite et pointue « en flamme », 6 à 10 fois plus haute que large.
- **Tronc** : droit, peu visible sous le feuillage. Écorce brun-gris, fibreuse, en lanières.
- **Branches** : très nombreuses, serrées contre le tronc, dressées (15 à 20°).
- **Feuilles** : ni feuilles ni aiguilles : des **écailles** de 1 mm, serrées sur des rameaux aplatis qui se
  ramifient en éventail. Vert sombre, pointes plus claires. Persistantes.
- **Dans EZ-Tree** : départ « Pine Medium » ; tronc long (70), angle 16, branches courtes (13) et nombreuses
  (80) dès le bas, forte poussée vers le haut (0,08). Écorce `chinese_cedar_bark`. Feuillage `cypressSpray` :
  rameaux ramifiés trois fois, couverts d'écailles, verts `#2f4f27` à `#456d33`, pointes `#7d9a44`.
- **Références** : Commons, « Mediterranean Cypress (Cupressus sempervirens) foliage », « Tuscany - Cypress
  Trees (5698663059).jpg », « Cypress tree alley at sunset in Asciano, Tuscany ».

## Olivier (*Olea europaea*)

- **Silhouette** : 4 à 8 m, couronne large et arrondie, plus large que haute sur les vieux sujets.
- **Tronc** : court (1 à 2 m sous les branches), épais, tordu, souvent creux ou fendu. Écorce grise, très
  crevassée.
- **Branches** : quelques grosses charpentières tordues, ouvertes (55 à 60°).
- **Feuilles** : lancéolées, étroites (1 cm sur 4 à 8 cm), opposées par paires ; vert-gris sombre dessus,
  argentées dessous. Persistantes.
- **Dans EZ-Tree** : départ « Oak Small » ; tronc court (18) et épais (3), branches à mi-hauteur (départ 0,5),
  noueuses (0,3 à 0,35) et tordues (0,5), angle 58 ; feuillage léger pour laisser voir le tronc (taille 4,5,
  16, départ 0,3). Écorce `bark_willow_02` teintée gris (`#cfcabd`). Feuillage forme `olive` par paires,
  `#55634a` à `#5f6d50`, dessous `#b3bba4`.
- **Références** : Commons, « Olea europaea FruitsandLeaves 2009December13 DehesaBoyalPuertollano »,
  « Portuguese Olive Grove - Apr 2011.jpg », « Old olive tree (Olea europaea) ».

## Érable plane (*Acer platanoides*, et les érables des villes)

- **Silhouette** : 12 à 20 m, couronne dense, ronde à ovale, souvent large des deux tiers de sa hauteur.
- **Tronc** : droit, court sous la couronne (2 à 3 m), 0,4 à 0,8 m. Écorce gris-brun, fines crêtes régulières.
- **Branches** : nombreuses, montant à 50-60°, la couronne commençant bas.
- **Feuilles** : palmées, cinq lobes pointus à quelques grandes dents, sinus arrondis ; 10 à 18 cm ; opposées ; vert
  moyen ; jaunes à orange à l'automne. Caduques.
- **Dans EZ-Tree** : départ « Ash Medium » ; angle 55, 8 branches de 5, peu noueuses (0,12), départ à 30 % ;
  feuillage dense (taille 4,5, 18). Écorce `trident_maple_bark` teintée gris (`#d6d0c6`). Feuillage forme `maple`,
  opposé, `#4f8b3b` à `#5d9a44`.
- **Références** : Commons, catégorie « Acer platanoides » (port, feuilles, écorce).

## Chêne pédonculé (*Quercus robur*, *Q. petraea*)

- **Silhouette** : 20 à 30 m, couronne large et irrégulière, plus large que haute quand il pousse seul.
- **Tronc** : épais (0,8 à 1,5 m), court, souvent fourchu. Écorce grise, profondément crevassée en longues plaques.
- **Branches** : grosses charpentières tortueuses, presque à l'horizontale (60 à 70°).
- **Feuilles** : obovales, quatre ou cinq lobes arrondis de chaque côté, pétiole court ; 7 à 14 cm ; alternes,
  groupées au bout des rameaux ; vert sombre ; brunes à l'automne, souvent gardées l'hiver. Caduques.
- **Dans EZ-Tree** : départ « Oak Large » ; tronc épais (3,6), angle 65, branches noueuses (0,25), tronc 40 ;
  feuilles taille 6, 14. Écorce `jolcham_oak_bark_01`. Feuillage forme `oak`, `#3f6f2f` à `#4a7a35`.
- **Références** : Commons, catégories « Quercus robur » (port, feuilles) et « Quercus robur (bark) ».

## Marronnier d'Inde (*Aesculus hippocastanum*)

- **Silhouette** : 15 à 25 m, grand dôme dense, les branches basses retombant puis remontant à leur pointe.
- **Tronc** : droit, 0,6 à 1 m. Écorce brun-rouge à grise, s'écaillant en fines plaques.
- **Branches** : fortes, montant à 45°, puis retombantes.
- **Feuilles** : composées palmées, cinq à sept folioles obovales dentées partant d'un point ; 20 à 30 cm ; opposées ;
  vert sombre ; brunissant tôt à l'automne. Fleurs blanches en chandelles en mai. Caduques.
- **Dans EZ-Tree** : départ « Oak Large » ; angle 45, branches alourdies (force −0,02), tronc 45 ; feuilles taille
  7, 16. Écorce `bark_brown_02` teintée (`#e0d8cc`). Feuillage forme `chestnut` (sept folioles), opposé, `#3f7a33`
  à `#4b8a3a`.
- **Références** : Commons, catégorie « Aesculus hippocastanum » (port, feuilles, fleurs).

## Frêne commun (*Fraxinus excelsior*)

- **Silhouette** : 20 à 30 m, haut, couronne légère et ouverte où passe le ciel.
- **Tronc** : haut et droit, 0,5 à 1 m. Écorce gris pâle, lisse jeune, puis en fin réseau de losanges.
- **Branches** : montantes (30 à 40°), leurs pointes relevées, dès mi-hauteur.
- **Feuilles** : composées pennées, 9 à 13 folioles lancéolées dentées ; 20 à 35 cm ; opposées ; vert clair ; tombant
  vertes ou jaune pâle. Bourgeons noirs. Caduques.
- **Dans EZ-Tree** : départ « Ash Large » ; angle 35, branches à partir de 45 % ; feuillage léger (taille 5, 16).
  Écorce `bark_brown_01` teintée gris (`#cfcfc8`). Feuillage : folioles forme `lance` par paires opposées,
  `#5a9445` à `#66a04d`.
- **Références** : Commons, catégorie « Fraxinus excelsior » (port, feuilles, écorce).

## Cerisier (*Prunus avium*, *P. serrulata*, et les pruniers)

- **Silhouette** : 6 à 12 m en ville, ronde à évasée, ouverte.
- **Tronc** : court, 0,2 à 0,5 m. Écorce brun-rouge luisante, barrée de lenticelles horizontales, se détachant en
  anneaux.
- **Branches** : peu nombreuses, montantes (40°), puis étalées.
- **Feuilles** : ovales, pointe effilée, finement dentées ; 6 à 15 cm ; alternes ; vert moyen ; orange-rouge à
  l'automne. Floraison blanche ou rose au printemps (pour #483). Caduques.
- **Dans EZ-Tree** : départ « Oak Small » ; angle 40, branches 12 ; feuilles taille 4, 22 (2,2 laissait la couronne nue). Écorce `sakura_bark`.
  Feuillage forme `ovate`, `#4c7f37` à `#578c3f`.
- **Références** : Commons, catégories « Prunus avium » et « Prunus serrulata » (port, écorce).

## Micocoulier (*Celtis australis*)

- **Silhouette** : 15 à 25 m, couronne large et ronde, dense ; l'arbre des rues du Midi.
- **Tronc** : droit, 0,4 à 0,8 m. Écorce grise et lisse toute sa vie, comme celle d'un hêtre.
- **Branches** : nombreuses, montant à 45-55°, fines, un peu retombantes au bout.
- **Feuilles** : en lance, la pointe très effilée, dentées, la base dissymétrique ; 5 à 15 cm ; alternes ; vert
  sombre, rêches dessus ; jaune pâle à l'automne. Caduques.
- **Dans EZ-Tree** : départ « Ash Medium » ; angle 50, 9 branches, peu tortueuses (0,15) ; feuilles taille 8, 22.
  Écorce `chinese_hackberry_bark` (celle d'un micocoulier) teintée gris (`#dcdad2`). Feuillage forme `lance`,
  `#4d7a3c` à `#56853f`.
- **Références** : Commons, catégorie « Celtis australis » (port, feuilles, écorce).

## Pin (*Pinus sylvestris*, *P. pinaster*)

- **Silhouette** : 20 à 35 m, un haut fût nu sous une couronne haute, irrégulière, aplatie avec l'âge.
- **Tronc** : droit ou un peu courbé, 0,4 à 1 m. Écorce en plaques profondes, gris-brun en bas, rouge orangé en
  haut (pin sylvestre).
- **Branches** : en étages, presque horizontales (80 à 90°), seulement dans le tiers ou les deux cinquièmes du haut.
- **Feuilles** : aiguilles par deux, 4 à 7 cm (sylvestre, vert bleuté) ou 10 à 25 cm (maritime, plus sombre), en
  touffes au bout des rameaux. Persistantes.
- **Dans EZ-Tree** : départ « Pine Large », mais avec des branches sur deux niveaux (le modèle est un cône
  d'épicéa) : 14 branches dès 60 %, horizontales (88°), longues de 34, un tronc droit (tortuosité 0,01), sans force de croissance (celle d'EZ-Tree 2 tire vraiment vers le
  ciel : 0,004 redressait les branches fines), 5 rameaux
  chacune ; feuilles taille 4,5, 24. Écorce `pine_bark`. Feuillage `needleTuft` (aiguilles par deux, en touffes),
  `#5a8442` à `#73a056`.
- **Références** : Commons, catégories « Pinus sylvestris » et « Pinus pinaster » (port, aiguilles, écorce).

## Peuplier (*Populus nigra*, sa colonne « Italica », et les peupliers hybrides)

- **Silhouette** : 25 à 30 m, étroite : une colonne (peuplier d'Italie) ou un ovale haut (les hybrides des
  peupleraies).
- **Tronc** : droit, haut, 0,5 à 1 m. Écorce grise, profondément crevassée en long.
- **Branches** : très montantes (20 à 30°), tout le long du tronc.
- **Feuilles** : un triangle (deltoïde), base large et droite, pointe aiguë, finement dentées, long pétiole aplati
  (elles tremblent) ; 5 à 10 cm ; alternes ; vert vif ; jaunes à l'automne. Caduques.
- **Dans EZ-Tree** : départ « Aspen Large » ; branches dès 30 %, angle 28, 14 branches longues de 24 ; feuilles taille 6, 20, dès
  10 %. Écorce `bark_willow` teintée gris (`#d4d4cc`), éclaircie (gain 2,2). Feuillage forme `delta`, `#5b8f42` à `#66994a`.
- **Références** : Commons, catégories « Populus nigra » et « Populus nigra 'Italica' » (port, feuilles).

## Robinier (*Robinia pseudoacacia*)

- **Silhouette** : 12 à 25 m, couronne légère et ouverte, irrégulière, souvent penchée ; en fourrés sur les friches.
- **Tronc** : souvent fourchu, tordu, 0,3 à 0,8 m. Écorce gris-brun, épaisse, en côtes profondes entrecroisées.
- **Branches** : en zigzag, épineuses, montant à 50-60°.
- **Feuilles** : composées pennées, 9 à 19 petites folioles ovales à bout arrondi ; 15 à 30 cm ; alternes ; vert
  jaune clair ; jaunes à l'automne. Fleurs blanches parfumées en grappes pendantes en mai. Caduques.
- **Dans EZ-Tree** : départ « Aspen Medium » ; tronc épais de 1,5, angle 55, tortueux (0,05 tronc, 0,25 branches), branches 12 ;
  feuilles taille 6,5, 18. Écorce `japanese_camphor_bark` (côtes étroites, crevasses profondes). Feuillage :
  folioles forme `ovate` par paires opposées, `#6a9a4a` à `#76a653`.
- **Références** : Commons, catégorie « Robinia pseudoacacia » (port, feuilles, écorce).

## Charme (*Carpinus betulus*)

- **Silhouette** : 10 à 20 m, ronde à ovale, dense ; aussi taillé en haies et en charmilles.
- **Tronc** : court, cannelé (comme musclé), 0,3 à 0,6 m. Écorce grise et lisse, striée plus clair.
- **Branches** : fines, nombreuses, montant à 40-50°.
- **Feuilles** : ovales, pointues, doublement dentées, plissées le long de leurs nervures parallèles ; 5 à 10 cm ;
  alternes ; vert moyen ; jaunes puis brunes, gardées l'hiver sur les haies. Caduques.
- **Dans EZ-Tree** : départ « Oak Medium » ; angle 45, 8 branches ; feuilles taille 7, 20. Écorce
  `chinese_hackberry_bark` teintée gris (`#c8c8c2`). Feuillage forme `ovate`, `#4f8a3a` à `#5a9642`.
- **Références** : Commons, catégorie « Carpinus betulus » (port, feuilles, écorce).

## Pommier / poirier (*Malus domestica*, *Pyrus communis*, et les pommiers et poiriers d'ornement)

- **Silhouette** : 4 à 10 m (vergers : 3 à 6 m, taillés), un tronc court sous une couronne large, basse et ronde
  (celle du poirier plus étroite et plus haute).
- **Tronc** : court (1 à 2 m), 0,2 à 0,4 m. Écorce gris-brun, s'écaillant en petites plaques (pommier) ou en
  carrés (poirier).
- **Branches** : peu nombreuses, étalées (55°), tortueuses, alourdies par les fruits.
- **Feuilles** : ovales, finement dentées, celles du pommier duveteuses et plus pâles dessous ; 5 à 10 cm ;
  alternes ; vert moyen. Fleurs blanches ou roses en avril, fruits à l'automne (pour #485). Caduques.
- **Dans EZ-Tree** : départ « Oak Small » ; angle 55, 6 branches, tortueuses (0,3), un peu alourdies (force
  −0,01) ; feuilles taille 4,2, 22. Écorce `japanese_zelkova_bark` (écailleuse) teintée (`#d8d0c4`). Feuillage
  forme `ovate`, `#557f3c` à `#5f8b44`, quelques feuilles montrant leur revers pâle (`#9db089`).
- **Références** : Commons, catégories « Malus domestica » et « Pyrus communis » (port, feuilles, écorce).

## Bouleau (*Betula pendula*)

- **Silhouette** : 15 à 25 m, élancé, ovale étroit, léger ; les rameaux pendant au bout.
- **Tronc** : droit, mince (0,2 à 0,5 m). Écorce blanche, se détachant en lanières de papier, marquée de losanges
  noirs ; sombre et crevassée au pied.
- **Branches** : montantes (30°), fines, les rameaux pleureurs.
- **Feuilles** : triangulaires-ovales, pointues, doublement dentées ; 3 à 7 cm ; alternes ; vert clair ; jaune d'or
  à l'automne. Caduques.
- **Dans EZ-Tree** : départ « Aspen Medium » ; angle 32, à peine relevé (force 0,006) ; feuilles taille 3,6, 22.
  Écorce DESSINÉE (`birchBark` : blanc craie, lenticelles sombres en travers du tronc, quelques plaques noires ; pas d'écorce de bouleau blanc chez Poly Haven). Feuillage forme
  `delta`, petite, `#6c9c48` à `#78a852`.
- **Références** : Commons, catégorie « Betula pendula » (port, feuilles, écorce).

## Hêtre (*Fagus sylvatica*)

- **Silhouette** : 25 à 40 m en forêt (un haut fût net), un large dôme isolé, les branches jusqu'au sol.
- **Tronc** : droit, 0,6 à 1,5 m. Écorce gris argenté, lisse toute sa vie.
- **Branches** : fortes, montant à 50-60°, les rameaux en éventails plats.
- **Feuilles** : ovales, le bord ondulé et cilié, 7 à 10 paires de nervures parallèles ; 5 à 10 cm ; alternes ;
  vert vif luisant ; cuivrées à l'automne. Caduques.
- **Dans EZ-Tree** : départ « Oak Large » ; tronc 50, épais de 3 ; angle 55 ; feuilles taille 6,5, 18. Écorce
  `japanese_sycamore` (lisse) teintée gris (`#b4b8bc`). Feuillage forme `ovate`, `#4d8a35` à `#58963e`.
- **Références** : Commons, catégorie « Fagus sylvatica » (port, feuilles, écorce).

## Châtaignier (*Castanea sativa*)

- **Silhouette** : 20 à 30 m, un large dôme, massif ; en taillis dans beaucoup de forêts (plusieurs troncs d'une
  souche).
- **Tronc** : épais (1 à 2 m), court. Écorce gris-brun, en longues côtes qui tournent autour du tronc.
- **Branches** : grosses, étalées à 60°.
- **Feuilles** : longues et étroites (en lance), une dent aiguë au bout de chacune de leurs nombreuses nervures
  parallèles ; 10 à 25 cm ; alternes ; vert sombre luisant ; jaune-brun à l'automne. Bogues à l'automne (pour
  #485). Caduques.
- **Dans EZ-Tree** : départ « Oak Large » ; tronc épais (3,8), vrillé (0,3), angle 60, tortueux (0,2) ; feuilles
  taille 6, 14. Écorce `metasequoia_bark` (longs sillons). Feuillage forme `serrate`, `#4b8233` à `#56903b`.
- **Références** : Commons, catégorie « Castanea sativa » (port, feuilles, écorce).

## Sapin / épicéa (*Abies alba*, *Picea abies*)

- **Silhouette** : 30 à 50 m, un cône étroit et pointu, les branches jusqu'en bas ; la cime du sapin aplatie avec
  l'âge.
- **Tronc** : droit, 0,5 à 1,5 m, jusqu'à la cime. Écorce grise et lisse (sapin) ou brun-rouge en petites écailles
  (épicéa).
- **Branches** : en étages, horizontales, celles de l'épicéa retombantes puis relevées au bout.
- **Feuilles** : aiguilles courtes (1 à 3 cm), celles du sapin plates, en deux peignes, deux lignes blanches
  dessous, celles de l'épicéa tout autour du rameau ; vert sombre. Persistantes.
- **Dans EZ-Tree** : départ « Pine Medium » (son cône), droit et régulier (tortuosité 0,01 et 0,03, sans poussée ni torsion) ; feuilles taille 4. Écorce `knotted_pine_bark` teintée gris
  (`#b8b4ac`). Feuillage `firSpray` (un rameau plat ramifié deux fois, aiguilles en peigne des deux côtés),
  `#4a7444` à `#618c58`, quelques-unes montrant leur revers pâle (`#7f9f7a`).
- **Références** : Commons, catégories « Abies alba » et « Picea abies » (port, rameaux, écorce).


## Sophora (*Styphnolobium japonicum*, autrefois *Sophora japonica*)

- **Silhouette** : 10 à 20 m, un large dôme arrondi, souvent aussi large que haut ; léger, aéré.
- **Tronc** : court, 0,4 à 0,8 m, souvent penché. Écorce gris-brun, profondément côtelée, comme celle du robinier.
- **Branches** : étalées à 45-60°, tortueuses ; jeunes rameaux verts.
- **Feuilles** : composées pennées, 9 à 17 petites folioles ovales (3 à 5 cm) par paires opposées ; vert moyen,
  plus pâles dessous ; jaunes à l'automne. Grappes de fleurs crème en août. Caduques.
- **Dans EZ-Tree** : départ « Ash Medium » ; angle 50, 9 branches, branches tortueuses (0,2) ; feuilles taille 6,
  20. Écorce `japanese_camphor_bark` teintée gris (`#c8c4bc`). Feuillage : folioles forme `ovate` par paires
  opposées, `#4f8a3a` à `#5a9643`.
- **Références** : Commons, catégorie « Styphnolobium japonicum » (port, feuilles, écorce).

## Orme (*Ulmus minor*, *U. laevis*, *U. × hollandica*, et les hybrides résistants)

- **Silhouette** : 15 à 25 m, couronne ovale à évasée en vase, dense ; en ville surtout des sujets jeunes ou hybrides.
- **Tronc** : droit, 0,5 à 1 m. Écorce gris-brun, profondément crevassée en réseau.
- **Branches** : montant raide (30-40°) puis s'arquant.
- **Feuilles** : ovales, doublement dentées, la base dissymétrique ; 5 à 10 cm ; alternes ; vert sombre, rêches ;
  jaunes à l'automne. Caduques.
- **Dans EZ-Tree** : départ « Oak Medium » ; tronc 40, branches dès 22 %, angle 42, longues de 24, légère poussée
  vers le haut (0,01) ; feuilles taille 6, 22. Écorce `bark_brown_01` teintée gris (`#bcb8b0`). Feuillage forme `serrate`, `#3f7030` à `#4a7c38`.
- **Références** : Commons, catégories « Ulmus minor » et « Ulmus laevis » (port, feuilles, écorce).

## Aulne (*Alnus glutinosa*, *A. cordata*)

- **Silhouette** : 10 à 20 m, conique jeune puis ovale ; le long des rivières, et en ville (aulne de Corse).
- **Tronc** : droit, souvent plusieurs, 0,3 à 0,6 m. Écorce gris foncé à noire, fissurée en plaques.
- **Branches** : nombreuses, presque horizontales (55-70°), courtes.
- **Feuilles** : arrondies, la pointe obtuse ou échancrée, dentées ; 4 à 10 cm ; alternes ; vert sombre luisant ;
  elles tombent vertes. Petits cônes noirs gardés l'hiver. Caduques.
- **Dans EZ-Tree** : départ « Ash Medium » ; branches dès 25 %, angle 55, 12 branches longues de 16 ; feuilles
  taille 5, 18. Écorce `tree_bark_03` teintée gris foncé (`#8c8880`). Feuillage forme `linden` (arrondie),
  `#365f2a` à `#3f6a30`.
- **Références** : Commons, catégories « Alnus glutinosa » et « Alnus cordata » (port, feuilles, écorce).

## Noisetier (*Corylus avellana*, et le noisetier de Byzance *C. colurna* des rues)

- **Silhouette** : un arbuste de 3 à 6 m, de nombreuses tiges partant du sol, étalées en éventail (le noisetier de
  Byzance des rues est un arbre, conique, comme un tilleul).
- **Tronc** : pas de tronc : des tiges de 5 à 15 cm, lisses, brun luisant, barrées de lenticelles.
- **Branches** : les tiges montant raide, s'arquant au sommet.
- **Feuilles** : arrondies, base en cœur, une courte pointe, doublement dentées, douces ; 6 à 12 cm ; alternes ;
  vert moyen ; jaunes à l'automne. Chatons en fin d'hiver. Caduques.
- **Dans EZ-Tree** : départ « Bush 1 » (tiges partant du sol) ; angle 18, 9 tiges ; feuilles taille 4, 16. Écorce
  `sakura_bark` (lisse, barrée) teintée (`#b8a898`). Feuillage forme `linden`, `#55893f` à `#609547`.
- **Références** : Commons, catégories « Corylus avellana » et « Corylus colurna » (port, feuilles).

## Cèdre (*Cedrus atlantica*, *C. libani*, *C. deodara*)

- **Silhouette** : 20 à 30 m, conique jeune, puis large, en ÉTAGES plats (le cèdre du Liban en plateau) ;
  bleuté (de l'Atlas) ou vert.
- **Tronc** : massif, 1 à 2 m, souvent fourchu. Écorce gris foncé, craquelée en petites plaques carrées.
- **Branches** : dès le bas, HORIZONTALES et longues, en étages, les rameaux étalés à plat.
- **Feuilles** : aiguilles de 2 à 3 cm en touffes de 20 à 40 sur des rameaux courts ; vert bleuté à vert sombre.
  Persistantes.
- **Dans EZ-Tree** : départ « Pine Large », branches sur deux niveaux : 18 branches dès 12 %, horizontales (88°),
  longues de 40, un tronc droit (tortuosité 0,005), sans force de croissance, 7 rameaux horizontaux chacune (88°) ;
  feuilles taille 4,5, 12, à plat (80°) : une couronne plus légère, ses étages visibles. Écorce `chinese_cedar_bark`
  teintée gris (`#a8a49c`). Feuillage `needleTuft`, vert bleuté `#4c6a5a` à `#62806c`.
- **Références** : Commons, catégories « Cedrus atlantica », « Cedrus libani » et « Cedrus deodara » (port,
  aiguilles, écorce).

## Févier (*Gleditsia triacanthos*, surtout 'Inermis', sans épines)

- **Silhouette** : 12 à 20 m, une large couronne ouverte, très légère : son ombre est tamisée.
- **Tronc** : droit, 0,4 à 0,8 m. Écorce gris-brun foncé, en longues plaques (épines en bouquets sur la forme
  sauvage).
- **Branches** : très étalées (55-70°), rameaux en zigzag.
- **Feuilles** : pennées ou bipennées, 20 à 30 minuscules folioles (2 à 3 cm) ; vert clair vif ; jaune d'or à
  l'automne. Longues gousses tordues. Caduques.
- **Dans EZ-Tree** : départ « Ash Medium » ; angle 60, 6 branches, branches tortueuses (0,18) ; feuillage léger
  (taille 5,5, 14). Écorce `japanese_camphor_bark` teintée foncé (`#9c9890`). Feuillage : minuscules folioles
  forme `ovate` par paires (13), `#7aa84a` à `#86b453`.
- **Références** : Commons, catégorie « Gleditsia triacanthos » (port, feuilles, écorce).

## If (*Taxus baccata*)

- **Silhouette** : 5 à 15 m, un large cône ou dôme dense, très sombre ; souvent taillé (haies, topiaires).
- **Tronc** : court, cannelé, souvent plusieurs. Écorce fine, brun-rouge, s'écaillant en lanières.
- **Branches** : dès le sol, étalées, denses.
- **Feuilles** : aiguilles plates de 2 à 3 cm, sur deux rangs le long du rameau, vert sombre luisant dessus, plus
  pâles dessous. Fruits rouges (arilles). Persistantes.
- **Dans EZ-Tree** : départ « Bush 3 » (un buisson persistant) ; tronc 12, épais de 1,2 ; angle 40, branches longues de 10 puis 6 ;
  feuilles taille 3,6, 6 par rameau. Écorce `chinese_cedar_bark` teintée brun-rouge (`#d09a80`). Feuillage `firSpray`, sombre `#2a4526` à
  `#385a32`, revers `#5e7a50`.
- **Références** : Commons, catégorie « Taxus baccata » (port, rameaux, écorce).

## Saule pleureur (*Salix babylonica*, *S. × sepulcralis*, et le saule blanc *S. alba*)

- **Silhouette** : 10 à 15 m, un large dôme dont les rameaux PENDENT jusqu'au sol, au bord de l'eau.
- **Tronc** : court, épais, 0,5 à 1 m. Écorce gris-brun, profondément côtelée en réseau.
- **Branches** : montantes, puis retombant en arc ; de longs rameaux fins pendant droit.
- **Feuilles** : lances étroites de 8 à 15 cm, finement dentées ; vert-jaune clair dessus, gris-blanc dessous.
  Caduques, parmi les premières à sortir et les dernières à tomber.
- **Dans EZ-Tree** : départ « Aspen Large », avec nos deux ajouts à EZ-Tree (`droop`, `leaves.hang`, voir « Les
  mises à jour d'EZ-Tree ») : un tronc court et épais (16, épais de 2,6), sans force de croissance ; 13
  charpentières dès 30 %, angle 50, longues de 34, ARQUÉES (droop 0,1), la flèche réduite à 0,3 d'une charpentière
  (`terminal` : elle dépassait du dôme, vu) ; 11 rameaux chacune, partant de côté (75°), longs de 22, PENDANTS
  aussitôt (droop 0,55) ; feuilles pendantes (hang 0,92), taille 8,5, 13 par rameau. Écorce `bark_willow` teintée (`#d4d0c4`), éclaircie
  (gain 1,8). Feuillage : une lanière pendante de 18 feuilles étroites (`lance`), `#8fb25a` à `#9bbd63`, revers
  `#b6c99a`.
- **Références** : Commons, catégories « Salix babylonica » et « Salix × sepulcralis » (port, feuilles).

## Yeuse — chêne vert (*Quercus ilex*, et le chêne-liège *Q. suber*)

- **Silhouette** : 8 à 15 m en ville, un dôme arrondi et dense, vert-gris sombre toute l'année (le Midi).
- **Tronc** : court, 0,4 à 1 m, souvent penché. Écorce presque noire, craquelée en petites plaques carrées (celle
  du chêne-liège : un liège épais et pâle).
- **Branches** : nombreuses, étalées, descendant bas sur le tronc.
- **Feuilles** : petites, coriaces, ovales à lancéolées, 3 à 7 cm, entières ou épineuses (jeunes pousses) ; vert
  sombre dessus, feutrées de gris dessous. Persistantes.
- **Dans EZ-Tree** : départ « Oak Small » ; tronc 20, épais de 2 ; angle 55, 7 branches, branches tortueuses
  (0,12) ; feuillage dense (taille 5, 30). Écorce `chinese_hackberry_bark` teintée foncé (`#8a8682`). Feuillage
  forme `ovate`, petite, `#34502c` à `#3c5a32`, revers `#8c9a80`. Choisi par son espèce (`taxa` : « Quercus ilex »,
  « Quercus suber », « Quercus coccifera » d'OSM), le genre seul donnant le chêne caduc.
- **Références** : Commons, catégories « Quercus ilex » et « Quercus suber » (port, feuilles, écorce).

## Pignon — pin parasol (*Pinus pinea*)

- **Silhouette** : 12 à 20 m, un haut tronc nu sous une couronne en PARASOL, plate et large ; le Midi et les côtes.
- **Tronc** : droit ou penché, 0,5 à 1 m. Écorce brun-rouge en crevasses profondes entre de longues plaques plates.
- **Branches** : seulement en haut, montant à 40-50° du tronc puis s'étalant à l'horizontale.
- **Feuilles** : aiguilles par deux, 10 à 20 cm, raides ; vert vif à vert-gris. Gros cônes ronds. Persistantes.
- **Dans EZ-Tree** : départ « Pine Large », branches sur deux niveaux : 16 branches dès 72 %, angle 74, longueur 170 :
  la branche d'un conifère vaut cela fois la part de tronc au-dessus d'elle (EZ-Tree), d'où des branches longues en
  bas de la couronne et courtes en haut, un parasol, sans branche terminale qui le dépasse ; 12 rameaux chacune ;
  feuilles taille 5, 30, dès 20 %. Écorce `pine_bark`, éclaircie (gain
  1,2). Feuillage `needleTuft`, `#4f7a3c` à `#669250`. Son propre type (`pin_parasol`, « Pinus pinea » d'OSM).
- **Références** : Commons, catégorie « Pinus pinea » (port, aiguilles, écorce).

## Douglas (*Pseudotsuga menziesii*)

- **Silhouette** : 30 à 50 m, un cône régulier et étroit, la cime pointue ; forêts plantées (BD Forêt).
- **Tronc** : très droit, 0,6 à 1,5 m. Écorce lisse à poches de résine jeune, puis épaisse, liégeuse, profondément
  crevassée, brun-rouge.
- **Branches** : horizontales, en verticilles, un peu retombantes au bout.
- **Feuilles** : aiguilles plates et souples de 2 à 3 cm, tout autour du rameau, parfumées ; vertes à vert bleuté.
  Cônes aux bractées à trois pointes. Persistantes.
- **Dans EZ-Tree** : départ « Pine Large » (son cône), droit (tortuosité 0,01, sans poussée) ; feuilles taille 3,5.
  Écorce `knotted_pine_bark` teintée brun-rouge (`#b0a090`). Feuillage `firSpray`, `#3e6838` à `#517e4b`.
- **Références** : Commons, catégorie « Pseudotsuga menziesii » (port, rameaux, écorce).

## Mélèze (*Larix decidua*, *L. kaempferi*)

- **Silhouette** : 20 à 35 m, un cône étroit et ouvert, léger : la montagne (BD Forêt) et les plantations.
- **Tronc** : droit, 0,5 à 1 m. Écorce gris-brun, puis épaisse, écailleuse, rouge sous les écailles.
- **Branches** : horizontales, les rameaux un peu pendants.
- **Feuilles** : aiguilles souples de 2 à 4 cm en touffes de 30 à 40, vert clair VIF ; jaune d'or à l'automne, puis
  NUES (le seul de nos conifères à les perdre).
- **Dans EZ-Tree** : départ « Pine Medium » ; droit, sans force de croissance (−0,01 courbait son tronc avec EZ-Tree 2), 50 branches ; feuillage léger
  (taille 3, 14). Écorce `pine_bark` teintée (`#c0a898`). Feuillage `needleTuft`, clair `#7aa858` à `#86b462`.
- **Références** : Commons, catégories « Larix decidua » et « Larix kaempferi » (port, aiguilles, écorce).

## Noyer (*Juglans regia*, *J. nigra*)

- **Silhouette** : 15 à 25 m, une large couronne ronde, ouverte ; dans les champs, les vergers (RPG) et les villages.
- **Tronc** : court, épais, 0,5 à 1,5 m. Écorce gris argenté, lisse jeune, puis profondément fissurée.
- **Branches** : peu nombreuses, épaisses, très étalées (60°).
- **Feuilles** : pennées, 5 à 9 grandes folioles (6 à 15 cm), la terminale la plus grande ; vert clair, bronze
  jeunes ; tombent tôt, sans couleur. Caduques.
- **Dans EZ-Tree** : départ « Oak Large » ; tronc 30, épais de 3,2 ; angle 60, 7 branches ; feuilles taille 7, 14.
  Écorce `tree_bark_03` teintée gris (`#c8c4bc`). Feuillage : grandes folioles forme `ovate` par paires opposées,
  `#5a8a3e` à `#659647`.
- **Références** : Commons, catégories « Juglans regia » et « Juglans nigra » (port, feuilles, écorce).

## Magnolia (*Magnolia grandiflora*, et le caduc *M. × soulangeana*)

- **Silhouette** : 6 à 15 m, un large cône à dôme dense (le magnolia persistant des squares).
- **Tronc** : court, 0,3 à 0,6 m. Écorce grise, lisse.
- **Branches** : dès le bas, montant à 40-50°.
- **Feuilles** : grandes, coriaces, ovales, 12 à 25 cm ; vert sombre luisant dessus, feutrées de roux dessous
  (grandiflora). Grandes fleurs blanches. Persistantes (grandiflora) ou caduques (soulangeana, fleurs roses avant
  les feuilles).
- **Dans EZ-Tree** : départ « Oak Small » ; angle 45, 6 branches ; feuilles taille 5, 18. Écorce `sakura_bark`
  teintée gris (`#a8a8a4`). Feuillage : grandes feuilles forme `ovate`, sombres `#2f5428` à `#386030`, revers roux
  `#6b6a45`.
- **Références** : Commons, catégories « Magnolia grandiflora » et « Magnolia × soulangeana » (port, feuilles).

## Liquidambar (*Liquidambar styraciflua*)

- **Silhouette** : 15 à 25 m, un cône régulier, puis ovale ; planté dans les rues et les parkings pour son automne.
- **Tronc** : droit, 0,4 à 0,8 m. Écorce gris-brun, profondément sillonnée ; ailes liégeuses sur les rameaux.
- **Branches** : sur une flèche droite, montant à 40°, courtes.
- **Feuilles** : en étoile, 5 à 7 lobes pointus, comme celles d'un érable mais ALTERNES ; 10 à 15 cm ; vert
  luisant ; rouges, pourpres et orangées à l'automne. Fruits en boules hérissées. Caduques.
- **Dans EZ-Tree** : départ « Ash Medium » ; tronc 50, branches dès 25 %, angle 40, 12 branches longues de 16 ;
  feuilles taille 5, 16. Écorce `japanese_zelkova_bark` teintée (`#b0a89c`). Feuillage forme `maple`, `#4a8236` à
  `#558e3e`.
- **Références** : Commons, catégorie « Liquidambar styraciflua » (port, feuilles, automne).

## Tulipier (*Liriodendron tulipifera*)

- **Silhouette** : 20 à 35 m, élancé, couronne ovale étroite jeune, puis large ; parcs et avenues.
- **Tronc** : très droit, 0,6 à 1,2 m. Écorce grise, en côtes régulières entrecroisées.
- **Branches** : sur une flèche droite, montant à 35-45°.
- **Feuilles** : quatre lobes, la pointe COUPÉE NET comme échancrée ; 10 à 20 cm ; long pétiole ; vert clair ;
  jaune vif à l'automne. Fleurs en tulipe vertes et orange. Caduques.
- **Dans EZ-Tree** : départ « Ash Large » ; branches dès 30 %, angle 38, 12 branches ; feuilles taille 6, 14.
  Écorce `tree_bark_03` teintée gris (`#b8b4ac`). Feuillage : forme `tulip` (dessinée pour lui), `#5a923e` à
  `#669e47`.
- **Références** : Commons, catégorie « Liriodendron tulipifera » (port, feuilles, écorce).


## Palmier — palmier à éventails (*Trachycarpus fortunei*, *Chamaerops humilis*, *Washingtonia*, *Livistona*, *Sabal*)

- **Silhouette** : 3 à 12 m (le Washingtonia jusqu'à 20), un seul stipe élancé (le Chamaerops souvent en touffe)
  sous une tête ronde d'éventails raides ; jardins, squares et fronts de mer du Midi et de la côte Atlantique.
- **Tronc** : un « stipe », sans branche, 0,15 à 0,3 m, égal du pied à la cime ; gainé de FIBRES brun foncé et des
  bases des vieilles feuilles (Trachycarpus), annelé une fois nu.
- **Feuilles** : en ÉVENTAIL (palmées), 0,5 à 1 m de large, fendues en 30 à 50 segments raides et plissés, leurs
  pointes retombantes ; sur un long pétiole fin ; vert sombre dessus, grisâtres dessous. Les vieilles pendent sous la
  couronne avant de tomber. Persistantes.
- **Dans EZ-Tree** : notre ajout `fronds` (« Les mises à jour d'EZ-Tree ») : un tronc sans branche (niveaux 0, long
  de 30, épais de 0,9, presque sans effilement, sans pointe à son sommet) et 26 palmes sortant de l'intérieur de sa
  cime, longues de 13, larges de 11, levées de 0 à 85°, un peu courbées (droop 0,09), tournées pour se présenter de
  face (turn 70), plissées (fold 0,35) ; 36 bases de vieilles palmes (`boots`) sur 5 rayons de stipe, longues de 0,22
  d'une palme. Stipe DESSINÉ (`palmBark`, fibreux). Palme DESSINÉE (`palmFrond` : une large gaine brune, un pétiole nu,
  puis 38 segments étroits fendus au-delà de leur moitié, éclairés un sur deux comme des plis, leurs pointes
  retombantes), `#3f6e3a` à `#487a42`.
- **Références** : Commons, catégories « Trachycarpus fortunei », « Chamaerops humilis » et « Washingtonia
  robusta » (port, feuilles, stipe).

## Dattier — palmier dattier (*Phoenix canariensis*, *P. dactylifera*, et les palmiers pennés *Butia*, *Syagrus*)

- **Silhouette** : 8 à 15 m, un stipe ÉPAIS et droit sous une couronne ronde et dense de longues palmes arquées, les
  plus vieilles pendantes ; le palmier des Canaries des avenues de la Côte d'Azur.
- **Tronc** : 0,6 à 1 m (P. canariensis), droit, gris-brun, couvert des cicatrices en losange des anciennes bases de
  feuilles, en anneaux ; souvent un « ananas » de ces bases sous la couronne.
- **Feuilles** : pennées, 4 à 6 m, 150 à 200 folioles étroites et raides de chaque côté, inclinées vers l'avant, les
  plus basses changées en épines ; vert sombre (canariensis) à vert-gris (dactylifera). Persistantes.
- **Dans EZ-Tree** : notre ajout `fronds` : un tronc sans branche (niveaux 0, long de 30, épais de 2,2) et 40 palmes
  à sa cime, longues de 21, larges de 6, levées de −20 à 72°, arquées (droop 0,12) sur 12 segments, pliées en V
  (fold 0,55) ; 70 bases de vieilles palmes (`boots`, l'« ananas ») sur 2,2 rayons de stipe, longues de 0,16 d'une
  palme. Stipe DESSINÉ (`palmBark`, annelé, cicatrices en losange). Palme DESSINÉE (`palmFrond`, pennée : une large
  gaine, un pétiole épineux, un rachis qui s'affine, des folioles étroites et courbes inclinées vers l'avant, leur
  pli éclairé).
- **Références** : Commons, catégories « Phoenix canariensis » et « Phoenix dactylifera » (port, feuilles, stipe).

## Catalpa / paulownia (*Catalpa bignonioides*, *Paulownia tomentosa*)

- **Silhouette** : 10 à 15 m, un large dôme bas, souvent plus large que haut, sur un tronc court.
- **Tronc** : court, 0,4 à 0,8 m. Écorce gris-brun, mince, en petites écailles.
- **Branches** : peu nombreuses et épaisses, étalées (55 à 65°), tortueuses.
- **Feuilles** : de TRÈS GRANDS cœurs (20 à 30 cm, jusqu'à 40 pour le paulownia), douces, vert clair, par deux ou
  trois. Longues gousses en haricot (catalpa) ou capsules en œuf (paulownia). Caduques.
- **Dans EZ-Tree** : départ « Oak Medium » ; tronc 18, branches dès 40 %, angle 58, 6 branches, noueuses 0,12 ;
  feuilles taille 4,4, 13. Écorce `japanese_camphor_bark` teintée (`#b0a89c`). Feuillage forme `linden`, grande (80),
  par paires, `#6a9a3e` à `#76a647`. Vaut aussi pour *Paulownia*.
- **Références** : Commons, catégories « Catalpa bignonioides » et « Paulownia tomentosa » (port, feuilles).

## Ginkgo (*Ginkgo biloba*)

- **Silhouette** : 15 à 25 m, étroit et irrégulier jeune (une colonne lâche), plus large avec l'âge.
- **Tronc** : droit, 0,4 à 0,8 m. Écorce gris-brun, sillonnée.
- **Branches** : montantes (40°), avec de courts rameaux chargés de feuilles.
- **Feuilles** : des ÉVENTAILS de 5 à 8 cm, le bord ondulé souvent échancré au milieu, sur un long pétiole ; vert
  clair ; jaune d'or à l'automne. Caduques.
- **Dans EZ-Tree** : départ « Aspen Medium » ; branches dès 22 %, angle 42, 10 branches, 1,5 × plus longues ;
  feuilles taille 4,5, 18. Écorce `tree_bark_03` teintée (`#b4aca0`). Feuillage forme `fan` (dessinée pour lui),
  `#7aa648` à `#86b251`.
- **Références** : Commons, catégorie « Ginkgo biloba » (port, feuilles).

## Eucalyptus (*Eucalyptus globulus*, *E. gunnii*, *E. camaldulensis*)

- **Silhouette** : 20 à 40 m, haut et ouvert, la couronne irrégulière, légère.
- **Tronc** : haut, droit, LISSE, crème pâle à gris, perdant son écorce en longues lanières.
- **Branches** : montantes (40°), peu nombreuses, les rameaux pendants.
- **Feuilles** : adultes en faucilles étroites de 10 à 25 cm, PENDANTES, gris-vert à vert bleuté, coriaces ;
  aromatiques. Persistantes.
- **Dans EZ-Tree** : départ « Aspen Large » ; branches dès 30 %, angle 40, 1,4 × plus longues, noueuses 0,15 ;
  feuilles taille 6, 24, pendantes (0,5). Écorce `japanese_sycamore` (lisse, pâle) éclaircie (`barkGain` 1,5).
  Feuillage forme `lance`, étroite, gris-vert `#7f9a7a` à `#8aa584`.
- **Références** : Commons, catégories « Eucalyptus globulus » et « Eucalyptus camaldulensis » (port, écorce).

## Figuier / mûrier (*Ficus carica*, *Morus alba*, *M. nigra*, *M. kagayamae* des rues)

- **Silhouette** : 5 à 10 m, bas et étalé, souvent plusieurs troncs, plus large que haut.
- **Tronc** : court, souvent penché, gris lisse (figuier) ou brun orangé et sillonné (mûrier).
- **Branches** : épaisses, très étalées (70°).
- **Feuilles** : grandes, 3 à 5 lobes profonds (figuier, rêches), ou en cœur à lobées (mûrier, luisantes) ; 10 à
  25 cm ; vert moyen à foncé. Caduques. Figues, mûres.
- **Dans EZ-Tree** : départ « Oak Small » ; tronc 9, angle 70, 6 branches ; feuilles taille 6, 12. Écorce
  `japanese_sycamore` teintée (`#c0bab0`). Feuillage forme `maple` (larges lobes), grande (88), `#4f7f36` à `#5a8b3e`.
- **Références** : Commons, catégories « Ficus carica » et « Morus alba » (port, feuilles).

## Gainier — arbre de Judée / lilas des Indes (*Cercis siliquastrum*, *Lagerstroemia indica*)

- **Silhouette** : 5 à 10 m, un petit arbre souvent à plusieurs troncs, une couronne arrondie et ouverte.
- **Tronc** : court, souvent tortueux ; gris foncé (arbre de Judée) ou lisse, marbré gris et rose, s'exfoliant
  (lilas des Indes).
- **Branches** : montantes puis étalées (45°), en zigzag.
- **Feuilles** : en rein, arrondies (arbre de Judée, 7 à 12 cm) ou petits ovales (lilas des Indes) ; vert moyen.
  Fleurs roses sur le bois nu au printemps (arbre de Judée), en panicules l'été (lilas des Indes). Caduques.
- **Dans EZ-Tree** : départ « Oak Small » ; tronc 6, angle 45, 7 branches, noueuses 0,16 ; feuilles taille 4,5, 16.
  Écorce `sakura_bark` teintée (`#9c948c`). Feuillage forme `linden`, `#5d8f3c` à `#679a44`.
- **Références** : Commons, catégories « Cercis siliquastrum » et « Lagerstroemia indica » (port, fleurs).

## Séquoia / cryptomeria (*Sequoiadendron giganteum*, *Sequoia sempervirens*, *Metasequoia glyptostroboides*, *Cryptomeria japonica*)

- **Silhouette** : 25 à 50 m dans les parcs, un haut cône dense, arrondi au sommet avec l'âge.
- **Tronc** : TRÈS large à la base, s'effilant ; écorce épaisse, tendre, fibreuse, brun-rouge (rouille pour le
  métaséquoia).
- **Branches** : courtes, retombantes puis relevées au bout, tout le long du tronc.
- **Feuilles** : des écailles plaquées sur les rameaux (séquoia géant, cryptomeria) ou des aiguilles plates sur deux
  rangs (séquoia à feuilles d'if, métaséquoia, caduc : roux à l'automne) ; vert bleuté à vert foncé.
- **Dans EZ-Tree** : départ « Pine Large » ; tronc 1,6 × plus épais, droit (noueux 0,005), sans force de croissance,
  branches 0,6 × plus longues ; feuilles taille 3,5, 1,2 × plus nombreuses. Écorce `metasequoia_bark` teintée rouge
  (`#e0a080`). Feuillage `firSpray`, `#3f6436` à `#4f7a42`.
- **Références** : Commons, catégories « Sequoiadendron giganteum », « Metasequoia glyptostroboides » et
  « Cryptomeria japonica » (port, écorce).

## Araucaria (*Araucaria araucana*, *A. heterophylla*)

- **Silhouette** : 10 à 25 m, un haut tronc nu puis des ÉTAGES de longues branches horizontales, un dôme au sommet
  avec l'âge.
- **Tronc** : droit, cylindrique, écorce grise cerclée des cicatrices des anciennes branches.
- **Branches** : en verticilles de 5 à 7, horizontales, longues, relevées au bout, peu de rameaux (des « cordes »).
- **Feuilles** : des triangles raides imbriqués, piquants, vert foncé luisant, couvrant entièrement les branches.
  Persistantes.
- **Dans EZ-Tree** : départ « Pine Medium », deux niveaux : 28 branches dès 45 % (un tronc nu dessous),
  horizontales (84°), longueur 48, fines et effilées ; une force de croissance vers le haut (0,012) relève leurs bouts
  fins : les pointes se redressent, en candélabre ; 3 rameaux courts chacune ; feuilles taille 3,4, 10, à partir du
  quart de la branche. Écorce `knotted_pine_bark` teintée grise (`#9a948c`). Feuillage DESSINÉ (`scaleRope`) : des
  rameaux épais couverts d'écailles triangulaires imbriquées, `#2c4a26` à `#3c6036`.
- **Références** : Commons, catégories « Araucaria araucana » et « Araucaria heterophylla » (port).

## Laurier — arbuste persistant : laurier, houx, troène… (*Laurus*, *Ilex*, *Ligustrum*, *Buxus*, *Euonymus*, *Phillyrea*, *Photinia*, *Pittosporum*, *Myrtus*, *Nerium*, *Pistacia*, *Arbutus*, *Viburnum*)

- **Silhouette** : 1 à 6 m, DENSE et arrondi, de nombreuses tiges, feuillu jusqu'au sol (haies, jardins, bords de
  route).
- **Tronc** : des tiges partant du sol, lisses, grises à brunes (rouge et s'exfoliant pour l'arbousier).
- **Branches** : montantes (25°), puis étalées, denses.
- **Feuilles** : ovales ou lancéolées, CORIACES, vert foncé luisant dessus, plus pâles dessous ; 3 à 12 cm (étroites
  pour le laurier-rose, piquantes pour le houx, minuscules pour le buis). Persistantes. La doublure d'un arbuste sans
  genre (`typeDefault`).
- **Dans EZ-Tree** : départ « Bush 1 » (tiges partant du sol) ; angle 24, 11 tiges, rameaux à 45° ; feuilles taille
  3, 20. Écorce `sakura_bark` teintée foncée (`#8c8478`). Feuillage forme `ovate`, foncé `#2f5a28` à `#386630`,
  dessous plus clairs.
- **Références** : Commons, catégories « Laurus nobilis », « Ilex aquifolium », « Ligustrum » et « Nerium oleander »
  (port, feuilles).

## Lavande / bruyère, sous-arbrisseaux (*Lavandula*, *Thymus*, *Salvia*, *Rosmarinus*, *Calluna*, *Erica*, *Cistus*)

- **Silhouette** : 0,3 à 1 m, une touffe basse et arrondie, ses tiges montant d'une même base.
- **Tronc** : aucun : des tiges ligneuses à la base.
- **Branches** : de fines tiges dressées, nombreuses.
- **Feuilles** : étroites, petites, gris-vert (lavande, romarin, thym) ou en écailles (bruyère) ; fleurs au bout des
  tiges : épis violets (lavande), clochettes pourpres à roses (bruyère). Persistantes.
- **Dans EZ-Tree** : départ « Bush 2 » ; 14 tiges à 30° ; feuilles taille 4, 9. Feuillage DESSINÉ (`bushSprig`) :
  tiges `#7e9070`, feuilles étroites gris-vert `#93a68a`, épis violets `#8a74b8`.
- **Références** : Commons, catégories « Lavandula angustifolia », « Calluna vulgaris » et « Cistus » (port).

## Genêt / ajonc (*Spartium junceum*, *Genista*, *Cytisus scoparius*, *Ulex europaeus*)

- **Silhouette** : 1 à 3 m, une touffe de baguettes vertes dressées, aérée.
- **Tronc** : aucun : des tiges partant du sol.
- **Branches** : vertes, comme des joncs, très dressées (20°), presque sans feuilles (ajonc : des épines).
- **Feuilles** : rares et minuscules, vite tombées : les tiges vertes font leur travail. Une masse de fleurs JAUNES
  en papillon au printemps.
- **Dans EZ-Tree** : départ « Bush 2 » ; 12 tiges à 22° ; feuilles taille 4,2, 9. Feuillage DESSINÉ (`bushSprig`) :
  baguettes vertes `#4f7a34`, fleurs jaunes `#e8c62a`, sans feuilles.
- **Références** : Commons, catégories « Spartium junceum » et « Ulex europaeus » (port, fleurs).

## Ronce / rosier (*Rubus*, *Rosa*, *Ruscus*)

- **Silhouette** : 0,5 à 2 m, un fourré emmêlé, ses longues tiges retombant en arc jusqu'au sol.
- **Tronc** : aucun : des tiges épineuses arquées.
- **Branches** : arquées (50°), pendantes au bout, entrecroisées.
- **Feuilles** : composées, 3 à 7 folioles dentées, vert foncé dessus ; fleurs blanches à roses, mûres ou cynorhodons.
  Caduques à semi-persistantes. La doublure d'un buisson sans genre (`typeDefault`).
- **Dans EZ-Tree** : départ « Bush 1 » ; angle 50, 10 tiges, noueuses 0,2, retombantes (0,25) ; feuilles taille 3,6,
  22. Écorce `sakura_bark` teintée (`#8a6a5a`). Feuillage forme `ovate`, par paires, `#3f6a30` à `#4a7638`.
- **Références** : Commons, catégories « Rubus fruticosus » et « Rosa canina » (port).

## Vigne (*Vitis vinifera*)

- **Silhouette** : un cep de 1 à 1,8 m, taillé chaque hiver : un court tronc tordu, puis une masse de rameaux
  palissés le long des fils de son rang ; les rangs (2 à 2,5 m d'écart, un cep tous les 1 à 1,2 m) forment de bas
  murs verts.
- **Tronc** : 0,4 à 0,8 m, noueux et tordu, écorce gris-brun s'exfoliant en longues lanières.
- **Branches** : les rameaux de l'année, montants (35 à 40°), fins et souples, avec des vrilles.
- **Feuilles** : à cinq lobes, 10 à 20 cm, dentées, vert moyen ; jaunes à rouges à l'automne. Grappes en fin d'été.
  Caduques.
- **Dans EZ-Tree** : pas l'arbre d'un Élément : le cep d'une vigne, dont vineyard-3d.js CONSTRUIT la FORME (un tronc,
  deux bras sur le fil, des rameaux entre les fils : EZ-Tree pousse autour d'un tronc et ne sait pas la palisser) ; la
  génération d'EZ-Tree en donne les MATÉRIAUX, cette écorce et ces feuilles (l'arbre lui-même, léger : 472
  triangles). Départ « Aspen Small », deux niveaux : un tronc (rayon 1,5, noueux 0,22), 9 rameaux dès 40 %, angle 38,
  longueur 7 ; feuilles taille 5,2, 7, en un seul plan. Écorce `bark_willow` teintée (`#b09078`, gain 1,4). Feuillage
  forme `maple` (cinq lobes), grande (96), `#5d8a3a` à `#68953f`.
- **Références** : Commons, catégories « Vitis vinifera » et « Vineyards in France » (ceps, rangs, feuilles).

## Genres rattachés à une essence existante

D'une forme assez proche pour partager sa fiche : *Zelkova* l'orme, *Sorbus* le frêne, *Tsuga* le Douglas,
*Juniperus* l'if ; les pennés *Ailanthus*, *Melia* et *Koelreuteria* le sophora, *Albizia* et *Jacaranda* le
févier ; les arbustes caducs *Cornus*, *Crataegus*, *Sambucus* et *Rhamnus* le noisetier.
