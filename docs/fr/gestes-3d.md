# Les gestes 3D : déplacer et tourner

*[English version](../en/gestes-3d.md)*

Tous les endroits où l'on déplace ou tourne quelque chose en 3D (la vue et les objets), avec leurs
commandes et ce qu'elles font (vitesse, pas, bornes). Les valeurs viennent du code (fichiers cités
en fin de page).

Unités : une unité du monde 3D est un **mètre**. « Un cran » de molette est un `deltaY` de 100.

## En bref

| Endroit | Tourner la vue | Déplacer la vue | Zoomer | Déplacer l'objet | Tourner l'objet |
|---|---|---|---|---|---|
| Store, modèle Sketchfab | visionneuse de Sketchfab | idem | idem | — | — |
| Store, aperçu 3D de l'application | glisser gauche | glisser droit | molette | — | — |
| Fenêtre d'Élément (aperçu) | — | — | molette | — | curseurs de la fenêtre |
| Éditeur de modèle | glisser gauche (dans le vide) | glisser droit | molette | — | glisser une articulation (pose) |
| Éditeur de bâtiment, plan | — (vue de dessus) | clic droit ou milieu maintenu | molette | glisser gauche | clic droit, clic droit maintenu, boutons, champs |
| Éditeur de bâtiment, aperçu 3D | glisser gauche | glisser droit | molette | — | — |
| Case, mode Caméra | glisser gauche | glisser droit, Ctrl + glisser, ou glisser milieu, ou flèches | molette | glisser gauche (l'Élément) | curseurs de la fenêtre |
| Scène | glisser gauche dans le vide | glisser droit, ou flèches | molette | glisser gauche (l'Élément) | curseurs de la fenêtre |

## Les réglages communs

**Gestes 3D**, dans la Configuration : deux curseurs de 25 à 200 %, par pas de 25 (100 % par
défaut), enregistrés dans les préférences de l'application (pas dans le Projet).

| Réglage | Valeur à 100 % | Ce que ça donne |
|---|---|---|
| Vitesse de rotation 3D | 0,0025 radian par pixel d'écran | 100 px de glisser ≈ 14° |
| Vitesse de déplacement 3D | 0,5 | le point visé suit la souris à la moitié de sa vitesse |

Ils s'appliquent à : l'aperçu 3D du store (et des textures, et des bâtiments de la bibliothèque),
l'aperçu 3D de l'éditeur de bâtiment, l'Éditeur de modèle (la vue), la caméra des Cases et des
Scènes. Ils **ne** s'appliquent **pas** : aux articulations de l'Éditeur de modèle, au mobilier
de l'éditeur de bâtiment, aux zooms, aux curseurs des fenêtres.

**La sensibilité d'une Case** (`camRotSensitivity`, `camPanSensitivity`, 1 par défaut) multiplie
en plus la rotation et le déplacement de SA caméra.

## Le store

### Modèle Sketchfab

L'aperçu est la **visionneuse de Sketchfab**, intégrée telle quelle : ses gestes sont les siens
(glisser gauche pour tourner, glisser droit pour déplacer, molette pour zoomer, double-clic pour
viser un point). L'application ne les règle pas, et le réglage « Gestes 3D » ne s'y applique pas.

### Aperçu 3D de l'application

Pour Poly Haven, « Mes modèles », un bâtiment de la bibliothèque, et une texture (sphère ou à plat,
avec la bascule en haut à droite) : `src/store-apercu-3d.js`. Ses gestes ont été copiés sur ceux de
Sketchfab, pour que tous les aperçus du store se manient pareil.

| Geste | Effet | Valeurs |
|---|---|---|
| Glisser gauche | tourner autour du modèle | vitesse commune ; inclinaison bornée à ±1,4 rad (≈ ±80°) |
| Glisser droit | déplacer le point visé | vitesse commune (le modèle suit la souris) |
| Molette | rapprocher, éloigner | distance × e^(Δ × 0,001), soit ×1,105 par cran ; de 0,25 à 4 fois la distance de cadrage |

Pas de clavier. Le dessin se fait à la demande (rien ne tourne en boucle).

## Les fenêtres d'Élément

La fenêtre d'un Personnage et celle d'un Objet ont un **aperçu**, que seule la molette touche :

| Geste | Effet | Valeurs |
|---|---|---|
| Molette sur l'aperçu | zoomer l'aperçu (pas l'Élément) | zoom commun (×1,105 par cran), de 0,2 à 6 |

L'**orientation** de l'Élément se règle par des curseurs, de −180° à 180° par degré, chacun avec un
**champ en degrés** à côté (`src/orientation-champs.js`), et « Remettre
droit » (Inclinaison et Bascule à zéro, la Rotation gardée) :

| Fenêtre | Premier curseur | Deuxième | Troisième |
|---|---|---|---|
| Personnage, Objet, Pièce | « Rotation » → `rotY` | « Inclinaison » → `rotX` | « Bascule » → `rotZ` |
| Bâtiment placé | « Rotation » → `rotY` | grisé | grisé |

Les mêmes noms, dans le même ordre, que l'éditeur de bâtiment.

La position se règle par des champs (profondeur, hauteur…), et la case « Collé au sol ».

## L'Éditeur de modèle

Il pose un Personnage, un Animal ou un modèle importé (`src/persona-editor.js`). Il ne change pas
l'orientation de l'Élément dans sa Case : il règle ses articulations.

| Geste | Effet | Valeurs |
|---|---|---|
| Glisser gauche dans le vide | tourner autour de la figure | vitesse commune, sans dépendre du zoom ; geste reconnu après 3 px |
| Clic gauche dans le vide, sans glisser | désélectionner l'articulation | |
| Glisser droit | déplacer la vue | vitesse commune |
| Molette | zoomer | zoom commun (×1,105 par cran), de 0,25 à 6 |
| Molette, une articulation choisie | passer au champ suivant de l'articulation | la vue ne zoome plus |
| Glisser une poignée (articulation) | la tourner | voir ci-dessous |
| Échap | fermer l'éditeur | |

**Tourner une articulation** : deux gestes, choisis selon la vue.
- **Glisser droit** quand l'axe de l'articulation se voit de côté : 0,5° par pixel (360 px = un
  demi-tour), le long de la direction où l'articulation tourne à l'écran.
- **Geste circulaire** quand l'axe pointe vers l'œil : l'angle parcouru par la souris autour de la
  poignée, cumulé d'une image à l'autre, ce qui évite l'inversion passé le demi-tour.

Dans les deux cas, l'angle est borné : ±180°, ou les limites de l'articulation pour un Animal
(un genou ne se plie que dans un sens). Pas d'aimant ni de pas.

## L'éditeur de bâtiment

### Le plan

La vue de dessus (`src/batiment-editeur-ui.js`). Sa vue ne tourne pas.

| Geste | Effet | Valeurs |
|---|---|---|
| Molette | zoomer vers le curseur | zoom commun (×1,105 par cran) |
| Ctrl + molette | zoomer, quand la molette sert à autre chose (voir plus bas) | |
| Clic droit ou milieu maintenu, dans le vide | déplacer la vue | suit la souris |
| Clic droit, rien de sélectionné | prendre l'outil Mur ; à l'outil Mur sans tracé, revenir à la Sélection | |
| ↑ / ↓, Page préc. / Page suiv. | changer de niveau | |
| V, N, D, H, E, B, P, Entrée, Suppr, Échap | outils, niveaux, fenêtres, finir un tracé, supprimer, quitter | |

### Le mobilier

Un élément posé dans une pièce (`src/batiment-mobilier.js`). À l'outil Sélection :

| Geste | Effet | Valeurs |
|---|---|---|
| Glisser gauche | le déplacer | il se colle à la face d'un mur à moins de 25 cm (deux murs dans un coin) ; **Alt** : sans aimant |
| Clic droit | un quart de tour | sens horaire vu de dessus |
| Clic droit maintenu | le tourner sur l'axe actif | Y : comme un bouton rotatif (l'angle parcouru autour de lui, cumulé) ; X : haut / bas, Z : gauche / droite, à 0,5° par pixel |
| … pendant ce geste | aimant tous les 90° (à moins de 6°) ; **Ctrl** : par 15° ; **Alt** : libre | |
| Molette (collé au sol) | le grandir ou le rétrécir | ×1,1 par cran, de ×0,2 à ×5 |
| Molette (décollé) | le monter ou le descendre | 5 cm par cran ; **Maj** : 1 cm |
| Suppr | le supprimer | |

Dans son menu : le **repère d'axes** (un clic sur X, Y ou Z choisit l'axe actif), les trois angles
à saisir en degrés, « Tourner de 90° », « Remettre droit » (l'orientation d'arrivée), le curseur
de taille (logarithmique, ×1 au milieu), l'élévation, « Collé au sol », « Peut traverser les
murs ». Sans cette dernière, un geste qui le fait entrer dans un mur le met en **rouge**, et il
revient à sa place au relâcher ; un geste d'un coup (bouton, cran, champ) est simplement refusé.

### Les escaliers

| Geste | Effet | Valeurs |
|---|---|---|
| Outil Escalier : appui puis tirer | poser le pied, puis orienter | par 15° |
| Outil Escalier : clic droit | un quart de tour de l'escalier à poser | |
| Outil Escalier : molette | changer de type | Ctrl + molette : zoomer |
| Sélection : glisser | le déplacer | il se colle aux murs à moins de 15 px d'écran ; **Alt** : sans aimant |
| Sélection : R | un quart de tour | décalé au besoin pour tenir |
| Suppr | le supprimer | |

### Les ouvertures

| Geste | Effet | Valeurs |
|---|---|---|
| Outil Ouverture : survol d'un mur, clic | la poser | |
| Outil Ouverture : clic droit | changer le sens d'ouverture d'une porte | quatre positions |
| Outil Ouverture : molette | changer de type | Ctrl + molette : zoomer |
| Sélection : glisser | la faire glisser le long de son mur | |
| Sélection : molette | la monter ou la descendre | 5 cm par cran ; **Maj** : 1 cm ; les crans rapprochés (moins de 0,8 s) font une seule annulation |

Un **angle de mur** se tire avec ses murs (**Alt** : sans aimant).

### L'aperçu 3D de l'éditeur

Les mêmes gestes et les mêmes valeurs que l'aperçu 3D du store (glisser gauche, glisser droit,
molette). Ses boutons : coupe au niveau courant, réduire, agrandir.

## Les Cases

### La Case, hors mode Caméra

Glisser une Case la déplace ou la redimensionne sur la Planche (la mise en page). Le clic droit
maintenu fait défiler la Planche ; un clic droit ouvre le menu contextuel.

### Le mode Caméra

On y entre par la touche **C** ou le menu contextuel « Caméra ».

| Geste | Effet | Valeurs |
|---|---|---|
| Glisser gauche | tourner la caméra | vitesse commune × sensibilité de la Case ; inclinaison bornée à ±85° |
| Glisser droit, Ctrl + glisser gauche, ou glisser milieu | déplacer la caméra ; sans bouger, le clic droit ouvre le menu | vitesse commune × distance × sensibilité |
| Molette | avancer, reculer, vers le curseur | zoom commun (×1,105 par cran) ; distance de 0,3 à 6 000 ; au plus près, elle passe à travers |
| Flèches, ou W A S D | déplacer la caméra | 4 % de la distance par appui × sensibilité |

Les mouvements de la caméra sont **lissés** (elle rejoint sa cible en quelques images).

### Les Éléments dans une Case

| Geste | Effet | Valeurs |
|---|---|---|
| Glisser gauche un Élément | le déplacer dans le plan face à la caméra | suit la vraie caméra (un rayon) ; il ne passe pas sous le sol |
| Molette, un Élément choisi | l'avancer ou le reculer le long de l'axe de la caméra | 0,72 m par cran |
| Clic droit maintenu sur l'Élément choisi | le tourner autour de la verticale | selon la caméra au début du geste (`rotation-objet-3d.js`) : de face (moins de 45° de plongée), un plateau tournant, glisser horizontal à 0,5°/px ; de biais ou de dessus, un bouton rotatif, l'angle que la souris parcourt autour de lui, cumulé (le glisser en ligne s'y inversait à mi-tour, signalé) ; aimant 90° (6°), Ctrl par 15°, Alt libre, Maj cinq fois plus fin ; sans bouger, le menu |
| R | un quart de tour, horaire vu de dessus | |
| Les curseurs de sa fenêtre | les trois angles | ±180°, par degré, champ en degrés |

Une ouverture aimantée à un mur suit son mur ; déplacer un mur emporte ses ouvertures.

## Les Scènes

Une Scène n'a plus de mode Caméra : ses gestes de caméra sont toujours actifs.

| Geste | Effet | Valeurs |
|---|---|---|
| Glisser gauche dans le vide | tourner la caméra | vitesse commune ; geste reconnu après 3 px (un simple clic sélectionne la Scène) |
| Glisser gauche à côté de l'Élément choisi | tourner AUTOUR de lui | un simple clic le désélectionne |
| Clic droit maintenu | déplacer la caméra | vitesse commune ; sans bouger, le menu contextuel s'ouvre au relâcher |
| Molette | zoomer vers le curseur | zoom commun (×1,105 par cran) |
| Flèches, ou W A S D (rien de choisi) | déplacer la caméra | 4 % de la distance par appui |
| Glisser gauche un Élément, molette | comme dans une Case | |

## Ce qui n'a pas de geste 3D

Le Lecteur, les vignettes, la fenêtre des Polices. L'image d'une Case a ses propres gestes
(molette : zoomer l'image ; glisser : son ancrage), en 2D.

## La grammaire commune

- **La vue** (aperçus, Éditeur de modèle, aperçu du bâtiment, Cases en mode Caméra, Scènes) : glisser
  gauche pour tourner, glisser droit pour déplacer, molette pour zoomer. Vitesses communes
  (`VITESSE_ROTATION_3D`, `VITESSE_DEPLACEMENT_3D`), réglables dans la Configuration.
- **Un seul zoom** : `facteurDeZoom3D` (`utils.js`), proportionnel à la molette (×1,105 par cran) ;
  `deltaMolette3D` ramène lignes et pages en pixels et compte Maj + molette. Ctrl + molette zoome
  toujours. La taille d'un élément du bâtiment garde des crans de ×1,1 : c'est une propriété, pas une
  vue.
- **La molette agit sur ce qui est choisi** quand quelque chose l'est (profondeur d'un Élément, champ
  d'une articulation, hauteur d'une ouverture, taille d'un meuble) ; sinon elle zoome.
- **Tourner un objet** : clic droit maintenu sur l'objet choisi, R pour un quart de tour. Un seul
  moteur (`rotation-objet-3d.js`) : plateau tournant de face, bouton rotatif de biais ou de dessus ;
  aimant 90° (à 6°), Ctrl par 15°. Vitesse : « Vitesse de rotation des objets »
  (`degresParPixelObjet3D`).
- **Modificateurs** : Alt retire l'aimant ; Maj affine ; Ctrl donne des pas de 15°.
- **Un seuil de 3 px** sépare un clic d'un glisser.
- **Suppr** supprime ce qui est choisi ; **Échap** désélectionne, puis quitte.
- **Les orientations** se nomment partout Rotation (`rotY`), Inclinaison (`rotX`), Bascule (`rotZ`), avec
  un champ en degrés et « Remettre droit ».
- **Des Commandes** en tête du menu d'une Case, de son mode Caméra et d'une Scène (`commandes-3d.js`),
  et des infobulles sur les aperçus.

## Écarts connus

- **Le bouton droit** déplace la vue partout, sauf sur un objet choisi, où il le tourne ; dans une Case
  hors mode Caméra, il fait défiler la Planche.
- **Le quart de tour** : R pour un escalier ou un Élément, clic droit ou bouton pour un élément du
  bâtiment.
- **Les aimants d'angle** n'existent pas sur une articulation ni dans les fenêtres.
- **Le sens des rotations au glisser** : l'aperçu du store retranche le glisser horizontal à son angle,
  l'Éditeur de modèle et la caméra des Cases l'ajoutent ; à vérifier à l'écran que « glisser vers la
  droite » tourne partout dans le même sens.

## Sources

- `src/utils.js` : les vitesses communes (`VITESSE_ROTATION_3D`, `VITESSE_DEPLACEMENT_3D`,
  `deplacement3D`), les gestes d'articulation (`POSE_DRAG_DEG_PER_PX`, `straightDragDegrees3D`,
  `accumulateSweepDegrees3D`, `dragJointStep3D`).
- `src/store-apercu-3d.js` : l'aperçu 3D du store (`orbite3D`, `zoom3D`, `cadrage3D`).
- `src/modals.js` : les aperçus des fenêtres d'Élément ; `src/index.html` et `src/events.js` : leurs
  curseurs d'orientation.
- `src/persona-editor.js` : l'Éditeur de modèle.
- `src/batiment-editeur-ui.js`, `src/batiment-mobilier.js`, `src/batiment-escaliers.js`,
  `src/batiment-ouvertures.js` : l'éditeur de bâtiment.
- `src/events.js` : les Cases et les Scènes (molette, `panelCamRotate`, `panelCamPan`, `move`,
  flèches, touche C).
