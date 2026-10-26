# Les gestes 3D : déplacer et tourner

*[English version](../en/gestes-3d.md)*

> Un relevé, fait dans le code le 26 octobre 2026 (v1.11.163), de TOUS les endroits où l'on déplace
> ou tourne quelque chose en 3D : la vue (la caméra) et les objets (un modèle, un élément, un
> escalier). Pour chacun : les commandes (souris, clavier, boutons), et ce qu'elles font (vitesse,
> pas, bornes). Il se termine par les points communs, les différences, et des recommandations pour
> homogénéiser. Les valeurs viennent du code (fichiers cités en fin de page) ; ce qui demande une
> vérification à l'écran est marqué **à vérifier**.
>
> Unités : une unité du monde 3D est un **mètre**. « Un cran » de molette est un `deltaY` de 100,
> la valeur courante d'une souris à molette crantée sous Windows.

## En bref

| Endroit | Tourner la vue | Déplacer la vue | Zoomer | Déplacer l'objet | Tourner l'objet |
|---|---|---|---|---|---|
| Store, modèle Sketchfab | visionneuse de Sketchfab | idem | idem | — | — |
| Store, aperçu 3D de l'application | glisser gauche | glisser droit | molette | — | — |
| Fenêtre d'Élément (aperçu) | — | — | molette | — | curseurs de la fenêtre |
| Éditeur de modèle | glisser gauche (dans le vide) | glisser droit | molette | — | glisser une articulation (pose) |
| Éditeur de bâtiment, plan | — (vue de dessus) | clic droit ou milieu maintenu | molette | glisser gauche | clic droit, clic droit maintenu, boutons, champs |
| Éditeur de bâtiment, aperçu 3D | glisser gauche | glisser droit | molette | — | — |
| Case, mode Caméra | glisser gauche | Ctrl + glisser, ou glisser milieu, ou flèches | molette | glisser gauche (l'Élément) | curseurs de la fenêtre |
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
| Molette sur l'aperçu | zoomer l'aperçu (pas l'Élément) | ×1,08 par cran, de 0,2 à 6 |

L'**orientation** de l'Élément se règle par des curseurs, de −180° à 180° par degré :

| Fenêtre | Premier curseur | Deuxième | Troisième |
|---|---|---|---|
| Personnage | « Rotation horizontale » → `rotY` | « Inclinaison » → `rotX` | « Roulis » → `rotZ` |
| Objet | « Rotation horizontale » → **`rotX`** | « Inclinaison » → **`rotY`** | « Roulis » → `rotZ` |
| Pièce | « Rotation horizontale » → `rotY` | → `rotX` | → `rotZ` |
| Bâtiment placé | « Rotation horizontale » → `rotY` | grisé | grisé |

**Incohérence relevée** : dans la fenêtre d'un Objet, « Rotation horizontale » règle `rotX` et
« Inclinaison » règle `rotY`. Le rendu tourne un Élément autour de la verticale avec `rotY` : les
deux libellés y sont donc vraisemblablement inversés (**à vérifier** à l'écran).

La position se règle par des champs (profondeur, hauteur…), et la case « Collé au sol ».

## L'Éditeur de modèle

Il pose un Personnage, un Animal ou un modèle importé (`src/persona-editor.js`). Il ne change pas
l'orientation de l'Élément dans sa Case : il règle ses articulations.

| Geste | Effet | Valeurs |
|---|---|---|
| Glisser gauche dans le vide | tourner autour de la figure | vitesse commune, sans dépendre du zoom ; geste reconnu après 3 px |
| Clic gauche dans le vide, sans glisser | désélectionner l'articulation | |
| Glisser droit | déplacer la vue | vitesse commune |
| Molette | zoomer | ×1,12 par cran (quelle que soit la molette), de 0,25 à 6 |
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
| Molette | zoomer vers le curseur | × e^(−Δ × 0,0015), soit ×1,16 par cran |
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
| Ctrl + glisser gauche, ou glisser milieu | déplacer la caméra | vitesse commune × distance × sensibilité |
| Molette | avancer, reculer, vers le curseur | ×1,08 par cran ; distance de 0,3 à 6 000 ; au plus près, elle passe à travers |
| Flèches, ou W A S D | déplacer la caméra | 4 % de la distance par appui × sensibilité |

Les mouvements de la caméra sont **lissés** (elle rejoint sa cible en quelques images).

### Les Éléments dans une Case

| Geste | Effet | Valeurs |
|---|---|---|
| Glisser gauche un Élément | le déplacer dans le plan face à la caméra | suit la vraie caméra (un rayon) ; il ne passe pas sous le sol |
| Molette, un Élément choisi | l'avancer ou le reculer le long de l'axe de la caméra | 0,72 m par cran |
| Tourner | seulement par les curseurs de sa fenêtre | ±180°, par degré |

Une ouverture aimantée à un mur suit son mur ; déplacer un mur emporte ses ouvertures.

## Les Scènes

Une Scène n'a plus de mode Caméra : ses gestes de caméra sont toujours actifs.

| Geste | Effet | Valeurs |
|---|---|---|
| Glisser gauche dans le vide | tourner la caméra | vitesse commune ; geste reconnu après 3 px (un simple clic sélectionne la Scène) |
| Glisser gauche à côté de l'Élément choisi | tourner AUTOUR de lui | un simple clic le désélectionne |
| Clic droit maintenu | déplacer la caméra | vitesse commune ; sans bouger, le menu contextuel s'ouvre au relâcher |
| Molette | zoomer vers le curseur | ×1,08 par cran |
| Flèches, ou W A S D (rien de choisi) | déplacer la caméra | 4 % de la distance par appui |
| Glisser gauche un Élément, molette | comme dans une Case | |

## Ce qui n'a pas de geste 3D

Le Lecteur, les vignettes, la fenêtre des Polices. L'image d'une Case a ses propres gestes
(molette : zoomer l'image ; glisser : son ancrage), en 2D.

## Points communs

- **Une grammaire de vue partagée** par l'aperçu du store, l'Éditeur de modèle, l'aperçu de
  l'éditeur de bâtiment et les Scènes : glisser gauche pour tourner, glisser droit pour déplacer,
  molette pour zoomer, venue de Sketchfab.
- **Une vitesse commune** de rotation et de déplacement de la vue (0,0025 rad/px et 0,5), réglable
  dans la Configuration.
- **La molette agit sur ce qui est choisi** quand quelque chose l'est : la profondeur d'un Élément
  (Case), le champ d'une articulation (Éditeur de modèle), la hauteur d'une ouverture, la taille ou
  l'élévation d'un élément (éditeur de bâtiment) ; sinon elle zoome.
- **Alt retire l'aimant** partout où il y en a un (éditeur de bâtiment : tracer, poser, déplacer,
  tourner).
- **Maj affine** (1 cm au lieu de 5) ; **Ctrl** donne des pas de 15° ou rend le zoom à la molette.
- **Un seuil de 3 px** sépare un clic d'un glisser (Éditeur de modèle, Scènes).
- **Suppr** supprime ce qui est choisi ; **Échap** désélectionne, puis quitte.

## Différences et incohérences

1. **Le bouton droit** : il déplace la vue partout, SAUF sur un élément de l'éditeur de bâtiment, où
   il le tourne. Dans une Case hors mode Caméra, il fait défiler la Planche. Le même geste n'a pas le
   même sens d'un écran à l'autre.
2. **Déplacer la caméra d'une Case** se fait au Ctrl + glisser gauche ou au glisser milieu, alors que
   les Scènes et les aperçus le font au glisser droit.
3. **Cinq zooms différents** : ×1,105 (aperçus), ×1,08 (Cases, Scènes, fenêtres), ×1,12 (Éditeur de
   modèle), ×1,16 (plan du bâtiment), et ×1,1 pour la taille d'un élément. Certains suivent la
   molette (`e^Δ`), d'autres comptent des crans fixes : une molette sans crans (pavé tactile) ne se
   comporte pas pareil partout.
4. **Deux vitesses de rotation** : la vue tourne à 0,14° par pixel (réglable), une articulation ou
   un élément à 0,5° par pixel (non réglable), trois fois et demie plus vite.
5. **Tourner un objet** n'a pas de geste dans les Cases et les Scènes (curseurs seulement), alors
   que l'éditeur de bâtiment en a quatre (clic droit, clic droit maintenu, boutons, champs) et
   l'Éditeur de modèle un (pour les articulations).
6. **Les aimants d'angle** : 90° (6°) et Ctrl 15° sur un élément du bâtiment ; 15° seulement à la
   pose d'un escalier ; aucun sur une articulation ni dans les fenêtres.
7. **Les libellés de l'orientation** : « Roulis » dans les fenêtres, « Bascule » dans l'éditeur de
   bâtiment ; et la fenêtre d'un Objet relie vraisemblablement « Rotation horizontale » au mauvais
   axe (**à vérifier**).
8. **Le quart de tour** : R pour un escalier, clic droit ou bouton pour un élément, rien ailleurs.
9. **Le sens des rotations au glisser** : l'aperçu du store retranche le glisser horizontal à son
   angle, l'Éditeur de modèle et la caméra des Cases l'ajoutent. Les repères n'étant pas les mêmes,
   le résultat à l'écran peut être identique : **à vérifier** que « glisser vers la droite » tourne
   partout dans le même sens.
10. **La préférence « Gestes 3D »** ne couvre ni les articulations ni le mobilier.

## Recommandations

**1. Une grammaire de vue, partout où il y a une caméra libre.** Glisser gauche dans le vide :
tourner ; glisser droit : déplacer ; molette : zoomer ; flèches : déplacer par pas. Le mode Caméra
d'une Case passerait au glisser droit (Ctrl + glisser et le glisser milieu restant des alternatives),
comme les Scènes et les aperçus.

**2. Une grammaire d'objet, partout où l'on manipule un objet.** Clic gauche : choisir ; glisser
gauche : déplacer ; **clic droit maintenu SUR l'objet choisi : le tourner** (dans le vide, il
reste le déplacement de la vue) ; clic droit bref sur lui : un quart de tour ; R : un quart de tour ;
molette sur lui : sa propriété (profondeur, taille, hauteur) ; Suppr ; Échap. C'est déjà l'éditeur
de bâtiment, sans le conflit du point 1 de la liste précédente : le bouton droit ne tourne que ce
qui est choisi. Les Éléments des Cases et des Scènes y gagneraient enfin un geste de rotation.

**3. Un seul moteur de rotation d'objet**, celui des articulations, qui a fait ses preuves : glisser
droit à vitesse fixe quand l'axe se voit de côté, geste circulaire cumulé quand il pointe vers
l'œil. Il remplacerait les règles propres au mobilier (bouton rotatif pour Y, linéaire pour X et Z)
par une règle qui marche dans toutes les vues (de dessus, de face, en 3D). L'axe actif se choisit
dans un repère, comme dans l'éditeur de bâtiment.

**4. Des modificateurs qui veulent dire la même chose partout.** Alt : sans aimant. Ctrl : par pas
(15° pour un angle) ; Ctrl + molette : toujours zoomer. Maj : plus fin (1 cm, 1°). Et des aimants
d'angle partout où l'on tourne un objet : 90° à moins de 6°.

**5. Des valeurs communes, en un seul endroit** (comme `VITESSE_ROTATION_3D` aujourd'hui) : un
zoom unique proportionnel à la molette (×1,1 par cran, `e^(Δ × 0,001)`), vers le curseur quand la
vue le permet ; une vitesse de rotation d'objet (0,5°/px) ajoutée aux réglages « Gestes 3D ».

**6. Des fenêtres alignées sur l'éditeur de bâtiment** : les mêmes noms (Rotation, Inclinaison,
Bascule), dans le même ordre, sur les mêmes axes (corriger la fenêtre d'un Objet), avec un champ en
degrés à côté de chaque curseur et « Remettre droit ».

**7. Des Commandes partout** : chaque écran qui a des gestes 3D les liste, comme le menu de
l'éditeur de bâtiment (« Geste : effet. »), y compris les aperçus (une infobulle sur l'aperçu).

**Un découpage possible**, du moins risqué au plus long : corriger les libellés de la fenêtre d'un
Objet (6) ; unifier les zooms et les modificateurs (4, 5) ; le glisser droit pour la caméra des
Cases (1) ; le geste de rotation des Éléments dans les Cases et les Scènes, avec le moteur des
articulations (2, 3) ; enfin les Commandes partout (7).

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
