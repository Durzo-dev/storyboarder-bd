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
  (taille 8, 12 par rameau). Écorce `bark_platanus` (la vraie). Feuillage `leafTwig` forme `plane`, verts
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
