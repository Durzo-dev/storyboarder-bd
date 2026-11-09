# Les squelettes importés

*[English version](../en/imported-skeletons.md)*

## Rôle

Un modèle importé articulé (`.glb` avec squelette) se pose comme un Personnage : il faut reconnaître
quel os joue quel rôle, dans des fichiers dont les conventions de nommage, les rotations de repos et
les axes n'ont rien de commun. Cette note décrit comment l'application le fait, pour un humanoïde comme
pour une créature (quadrupède, ailé, serpent…).

## Fichiers

| Fichier | Ce qu'il porte |
|---|---|
| `src/skeleton-map.js` | La reconnaissance : les dix-huit emplacements humanoïdes (`SLOTS`), `inferSkeletonMap`, les chaînes (`membresDuSquelette3D`), la morphologie suggérée (`archetypeSuggere3D`), les lignes de l'écran de correspondance. |
| `src/skeleton-store.js` | Ranger et relire les correspondances, et fusionner ce que l'utilisateur a corrigé avec ce que la reconnaissance propose. |
| `src/archetype-roles.js` | Les rôles de chaînes par archétype, et leur proposition automatique (`propositionDeRoles3D`). |
| `src/skeleton-pose.js` | La pose d'un squelette importé : clés, angles, composition avec la rotation de repos, groupes de curseurs. |
| `src/skeleton-retarget.js` | Traduire un geste d'un corps à l'autre par la géométrie des os. |
| `src/pose-bridge.js` | Le passage entre les poses du Personnage intégré et les emplacements d'un modèle importé. |
| `src/constants.js` | `ARCHETYPES_3D`, `ANIMAL_ARCHETYPES_3D`, `ANIMAL_JOINT_DEFS`. |

## Reconnaître les os

- **Le nom donne le côté**, pas le rôle : « Left », « _L », « _l_ » se reconnaissent dans toutes les
  conventions rencontrées (`coteDuNom`). Le rôle d'un os ne se lit pas dans son nom (« Left_leg » peut
  être la cuisse, « Left_elbow » l'avant-bras) : un os mal attribué est pire qu'un os manquant.
- **La structure donne le rôle** : la hiérarchie, les longueurs, la position par rapport au corps.
- **Le repère du corps** (haut, devant, gauche) se dérive de la géométrie du squelette, sans lire de nom
  (`repereDuCorpsPourFichier3D`).
- **Les os d'échafaudage** (racines, contrôleurs, os d'effets d'un modèle de jeu) sont écartés des
  candidats (`estEchafaudage3D`).

## Morphologies et archétypes

La morphologie d'un modèle est une clé d'`ARCHETYPES_3D` : `humanoide`, `bipede_queue`, `quadrupede`,
`bipede_aile`, `quadrupede_aile`, `centaure`, `arachnide`, `radial`, `serpentin`, `complexe`.
`archetypeSuggere3D` en propose une, avec son origine (le nom des chaînes, ou la structure seule) ; ce
n'est jamais un verdict : l'utilisateur peut en changer, et « Complexe » donne l'écran générique où
chaque chaîne se coche et se nomme à la main. Les Animaux intégrés ont chacun la leur
(`ANIMAL_ARCHETYPES_3D`).

- **Humanoïde** : dix-huit emplacements (`tete`, `avantbras_g`, `cuisse_d`…), correspondance stockée
  dans `os`.
- **Autre morphologie** : le squelette est décomposé en **chaînes** (membres) ; chaque chaîne reçoit un
  **rôle** d'archétype (patte avant gauche, aile, queue…), correspondance stockée dans `roles`. Les
  rôles reprennent les identifiants d'articulation des Animaux intégrés (`ANIMAL_JOINT_DEFS`) ; la tête
  se cherche sur le tronc.

## La correspondance

- Elle appartient au **fichier**, pas à l'Élément ni au Projet : rangée à côté du dossier `Modeles`,
  indexée par nom de fichier, elle vaut pour tous les exemplaires du modèle. Elle ne voyage pas avec un
  Projet transmis (le `.glb` non plus).
- Elle mémorise des **noms d'os**, jamais des indices de nœud (un réexport renumérote tout).
- Ce que l'utilisateur a corrigé **prime** sur la reconnaissance ; le reste vient d'elle.
- Une correspondance peut resservir à un **autre fichier** au même squelette : l'`empreinte` (nombre
  d'os et condensé) le reconnaît (`correspondancesApplicables3D`).
- Le format (clés `os`, `roles`, `membres`, `morphologie`, `valide`, `empreinte`) est dans
  [persisted-data.md](persisted-data.md).

L'écran de correspondance (« Tableau de correspondance », depuis l'Éditeur de modèle) montre la même
chose que les curseurs : les emplacements ou les chaînes et leurs rôles, avec la proposition et ce qui
a été corrigé.

## Poser un squelette

- **Les rotations de repos ne sont pas nulles** : dans un fichier réel, presque tous les os sont déjà
  tournés au repos. Une pose s'applique donc **par-dessus** la rotation de repos
  (`orientationFinale`), jamais à sa place.
- **La pose** est un dictionnaire `skeletonPose3d` : `{ clé: {x, y, z} }` en radians, la clé étant un
  emplacement ou un os préfixé `os:` (`PREFIXE_OS_3D`). Angles bornés à ±180° ; le bassin n'est pas
  posable (`SLOTS_NON_POSABLES`).
- **Les curseurs** viennent de la morphologie : emplacements pour un humanoïde, chaînes et rôles pour
  une créature (`groupesPosablesMembres3D`, `clesARecolter3D`).
- **Une pose de la bibliothèque** (vocabulaire du Personnage intégré : `lElbow`…) est traduite vers les
  emplacements par `pose-bridge.js`, et vers les axes réels de chaque os par `skeleton-retarget.js`,
  qui mesure la direction des os au lieu de supposer un axe (les fichiers alignent leurs os sur +Y,
  ±X ou +Z selon l'exportateur).
- **« Allongé »** est un geste du corps entier, porté par l'intention (`joints3d`, `position`), pas par
  un angle d'os.

## Devant et cadrage

- Le Personnage intégré regarde vers −Z (`rotY: Math.PI` à sa création), un modèle importé vers +Z
  (`rotY: 0`). L'Éditeur de modèle ouvre sa caméra du côté du devant mesuré (`orbiteDeFace3D`).
- La boîte de cadrage n'unit que les os qui déforment quelque chose (cf.
  [imported-models-display.md](imported-models-display.md)).

## Tester

`tests/skeleton-*.test.mjs`, sur des squelettes relevés dans de vrais fichiers (humanoïdes et créatures, `tests/fixtures/squelette-*.json`).
Ce que les tests ne disent pas (un membre qui part de travers, un modèle vu de dos) se vérifie à l'écran
dans l'Éditeur de modèle, sur chaque morphologie.

## Pièges

- **Ne jamais déduire un rôle d'un nom d'os.**
- **Toute clé d'une entrée de correspondance doit être nommée dans `normaliserFichier`** (cf.
  [persisted-data.md](persisted-data.md)).
- **Trois fabricants d'Élément** alimentent le rig d'un modèle importé : la Case, l'aperçu de la fiche
  (`drawObjectPreview`) et l'Éditeur (`dessinerModeleDansEditeur`). Un champ ajouté doit arriver aux
  trois ; un test dérive la liste des champs lus par `ensureObjectRigEntry3D`.
- **Ne pas coder le devant en dur** : il se mesure par fichier.
