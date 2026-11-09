# Les ombres portées

*[English version](../en/cast-shadows.md)*

## Rôle

Le soleil d'une Case peut projeter des ombres, et chaque source de lumière posée aussi, sur demande.
Elles s'affichent à l'écran et à l'export (même `drawContent`).

## Fichiers

- `src/shadows-3d.js` : les décisions pures : champ visible d'une Case, boîte d'ombre du soleil,
  accrochage, caméra d'ombre d'une source, ce qui projette.
- `src/rig3d.js`, `src/scene3d.js` : la pose sur la scène partagée (`appliquerOmbresDeCase3D`,
  `marquerProjectionDOmbre3D`).
- `src/lighting-3d.js` (champ `ombresPortees`), `src/light-source-3d.js` (champ `projetteOmbre`).

## Deux interrupteurs, hiérarchiques

- **La Case** : « Ombres portées » dans la section Lumière (`lumiere.ombresPortees`, absent = éteint),
  quel que soit le mode. Il se transmet d'une Scène à ses Cases avec le reste de l'éclairage.
- **Chaque source posée** : « Projette une ombre » dans sa fiche (`projetteOmbre`, décoché par défaut).
  Cochée sur une Case sans ombres, elle ne fait rien, et un indice sous la case le dit.

Côté rendu : `shadowMap.enabled` (le renderer) suit les **deux** sortes de projeteurs ; `castShadow`
appartient à chaque lumière.

## L'ombre du soleil

Une `DirectionalLight` rend son ombre depuis une caméra orthographique, dont la boîte doit être cadrée
sur **ce que la Case regarde** : le Sol fait 12 000 unités, et une boîte à sa taille ne donnerait aucune
ombre visible.

- **La boîte** couvre la sphère englobante du tronc de vision (`sphereTroncDeVision3D`), centrée au
  centre de gravité du tronc, jusqu'à `PROFONDEUR_OMBRE_CAMDIST` (4) fois la distance d'orbite.
- **La cible** de la lumière suit le centre d'orbite de la Case, et la caméra d'ombre est placée hors du
  volume qu'elle regarde.
- **L'accrochage** : le rayon est arrondi au palier supérieur par doublements (`PALIER_RAYON_OMBRE`), et
  le centre à un multiple entier de texel, dans le repère de la lumière (`repereOmbreSoleil3D`,
  `centreAccrocheOmbre3D`). Zoomer dans un même palier ne change donc ni la grille ni l'ombre.
- **Résolution** : `RESOLUTION_OMBRE_SOLEIL` = 4096. `ombreSoleilSeraVisible3D` dit si un texel reste
  plus petit que ce qui projette (`TAILLE_TEXEL_MAX`).

## L'ombre d'une source posée

Une carte **cubique** (six passes de profondeur par image), de `RESOLUTION_OMBRE_SOURCE` = 512.
`cameraOmbreSource3D` fixe ses plans : le proche à `NEAR_OMBRE_SOURCE`, l'éloigné à la portée de la
source, ou, à portée nulle, dérivé du champ visible de la Case.

## Qui projette, qui reçoit

- Tout matériau éclairé **reçoit**.
- Projette tout ce qui dépasse du sol : un objet dont le **sommet** est à moins de
  `EPAISSEUR_MIN_PROJETEUR` (2 cm) du sol (`estUnDessinAuSol3D` : chemins, routes, zones) reçoit mais ne
  projette pas. Le critère lit le sommet, pas la base (une haie posée à 2 cm du sol projette).

## Le cycle d'un rendu

L'état de repos des ombres est **éteint**. Le rendu d'une Case les allume pour lui, puis les repose en
partant : un aperçu (fiche, Éditeur de modèle), qui partage le renderer, n'hérite jamais de l'état
d'une Case. `marquerProjectionDOmbre3D` est appelé **après** la construction des rigs de la Case, pour
que les rigs créés pendant ce rendu projettent aussi.

## Coût

Le soleil coûte environ 1 ms par image ; huit sources qui projettent, environ 3,9 ms. Chaque combinaison
(nombre de sources, nombre d'ombres) rencontrée pour la première fois déclenche une compilation GLSL :
cocher l'ombre d'une source peut figer l'application un instant. Mesures dans
[rendering-performance.md](rendering-performance.md).

## Pièges

- **Cadrer la boîte sur la Case**, jamais sur le Sol, et la **déplacer** avec l'orbite (sa cible).
- **Ne pas faire suivre le rayon en continu** : la grille d'ombre changerait à chaque cran de molette, et
  les contours rampent.
- **Poser `castShadow` après la construction des rigs** : sinon la première image d'une Case, mise en
  cache, n'a pas d'ombre.
- **Mesurer une ombre avec un témoin** (une seconde surface qui reçoit) : un maillage isolé ne montre
  jamais rien.
