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
(sans vent, sans treillis, sans textures à lui). `src/ez-trees.js` génère une variante d'une essence une fois
(3 variantes par essence, `VARIANTS`) et chaque arbre de cette variante en est une copie, mise à sa hauteur.

À la création d'une Scène depuis un lieu (niveaux Détaillé et Réaliste), un arbre dont le genre est celui d'une
essence (étiquettes OSM, sinon tiré de la flore) reçoit cette essence (`essence`), une variante tirée de sa place
et, sans hauteur mesurée, la hauteur habituelle de l'essence (±15 %). Il ne prend aucun modèle de la banque ni des
stores.

Une écorce est une photo de Poly Haven (`bark`, livrée en `assets/textures/ecorce-*.jpg`) ou dessinée par le code
(`barkDrawn`, celle du bouleau : pas de photo d'écorce de bouleau blanc là-bas) ; `barkGain` éclaircit une écorce plus
sombre que la vraie (sa teinte multipliée par le gain). Les écorces en photo arrivent après le premier dessin (une image
chacune). ⚠️ L'image d'une
Case est gardée en cache selon une signature de ce qu'elle montre : `barkSettled(essence)` y entre, pour qu'une Case
dessinée avant l'arrivée de l'écorce de ses arbres soit redessinée une fois celle-ci arrivée (ou constatée absente).
Sans cela, la première Case gardait des branches dessinées d'une texture vide : transparentes, blanc uni sur la page.

## Les mises à jour d'EZ-Tree

`node tools/ez-tree/check-update.mjs` dit si une version plus récente d'EZ-Tree est sortie. Elle est proposée à
Durzo, puis, si elle est acceptée :

1. Reporter les changements de son `src/lib/` dans `src/vendor/ez-tree/ez-tree.js` (et `presets.js`), en gardant
   les adaptations listées en tête du fichier, et mettre à jour `EZ_TREE_VERSION`.
2. Mesurer les empreintes de ses modèles avec la nouvelle version, dans un navigateur, et les reporter dans
   `tests/ez-tree.test.mjs` : le test vérifie que la copie fait pousser les mêmes arbres qu'EZ-Tree.
3. Revoir nos essences : un changement de croissance change leurs silhouettes.

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
  d'épicéa) : 14 branches dès 60 %, horizontales (88°), longues de 34, à peine relevées (force 0,004), 5 rameaux
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
- **Dans EZ-Tree** : départ « Pine Large », branches sur deux niveaux : 22 branches dès 12 %, horizontales (88°),
  longues de 40, un peu retombantes (−0,004), 10 rameaux horizontaux chacune (88°) ; feuilles taille 4, 22, à plat (80°). Écorce `chinese_cedar_bark`
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
- **Dans EZ-Tree** : départ « Aspen Large », trois niveaux : un tronc épais (30, épais de 2,6) pour que la traction vers
  le BAS (force −0,05) ne courbe que les parties fines (EZ-Tree courbe une section selon la force divisée par son
  rayon) : 10 branches dès 40 %, angle 55, longues de 30, 12 rameaux chacune, longs de 28, pendants ; feuilles
  taille 5,5, 24. Écorce `bark_willow` teintée (`#d4d0c4`),
  éclaircie (gain 1,8). Feuillage forme `lance`, `#8fb25a` à `#9bbd63`, revers `#b6c99a`.
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
- **Dans EZ-Tree** : départ « Pine Medium » ; droit, un peu retombant (−0,01), 50 branches ; feuillage léger
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
