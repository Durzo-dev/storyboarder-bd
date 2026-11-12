# L'Éditeur de terrain

*[English version](../en/terrain-editor.md)*

Façonner le sol d'une Scène : relief, Zones, Tracés, eau.

## Où vit quoi

| Fichier | Rôle |
|---|---|
| `src/terrain-editeur-ui.js` | L'éditeur : ouverture (une Scène seulement), outils, menus, plan, aperçu 3D, validation. |
| `src/terrain-plan.js` | PUR. Le plan en mètres (zones, tracés, bâtiments, éléments), son cadrage, le toucher, déplacer et tourner une Zone. |
| `src/terrain-relief.js` | PUR. La grille de hauteurs, le pinceau, les rivières, les Zones relevées ou en pente, le profil « franchissant » des routes. |
| `src/terrain-zone-pinceau.js` | PUR. Les Zones peintes : un masque de cases de 50 cm. |
| `src/scene3d.js` | Le rendu : `reliefEffectif3D`, `poserRelief3D`, `draperSurLeRelief3D`, l'eau, `rendreSceneVueLibre3D`. |

## Les données ajoutées

Des champs ajoutés : un fichier ancien se lit tel quel.

- **`panel.relief`** (le canevas de la Scène, et une Case qui la charge) : `{ pas, x0, z0, nx, nz, h, v }`,
  hauteurs en mètres au pas de 1 m, ligne par ligne en z, entre `HAUTEUR_MIN` et `HAUTEUR_MAX` (±300 m ;
  tout ancien Projet y tient). Absent : Sol plat. `altitude`
  facultative : l'altitude réelle (mètres au-dessus de la mer) du niveau 0 de la grille, pour un relief
  tiré d'un lieu réel (posée par l'import) ; les hauteurs restent relatives à elle, l'altitude
  réelle d'un point vaut `altitude` + hauteur. Gardée par toute opération qui refait la grille.
- **Tracé `terrain`** (Zone) : `world.masque` `{ pas, x0, z0, nx, nz, plein }` pour une Zone peinte
  (le rectangle englobant reste dans `world`) ; `hauteurZone`, `penteZone` (degrés), `sensPente`
  (degrés) ; `niveauEau` quand `terrainType === 'eau'`.
- **Tracé `riviere`** : `world.pts`, `world.width`, `profondeur`.
- **Tracé `trottoir`** : `world.pts`, `world.width` (2 m par défaut) ; dessiné en dalle de `TROTTOIR_BORDURE_M` (0,14 m) de haut, sa bordure des deux côtés, dans le grain béton du Sol, plus clair.

## Les règles qui comptent

- **Rien n'est appliqué avant « Valider ».** L'éditeur travaille sur la Scène (l'aperçu et les
  réglages en ont besoin) mais garde son état de départ ; quitter sans valider le remet ; valider fait
  UNE annulation de l'application. Pendant l'édition, `snapshot()` alimente l'historique de l'éditeur,
  et la sauvegarde automatique attend.
- **Le relief rendu = le relief peint, relevé par les Zones, creusé par les rivières, aplani sous les
  bâtiments, entaillé sous les routes et chemins** (`reliefEffectif3D`), recalculé à chaque rendu. Une route
  est drapée par son axe (`profilFranchissant`), donc de niveau sur sa largeur : `cutUnderRoads` descend
  chaque point de la grille à moins d'une demi-largeur (plus 0,5 m et une case et demie) à 10 cm sous la
  route, et le drapé reprend le même profil. L'entaille est gardée par Case tant que ni le relief ni les
  lignes ne changent, et tout le relief effectif est gardé par Case tant que relief, Zones, rivières, routes
  et bâtiments sont inchangés (`_reliefsEffectifs3D`, clé faite de leurs réglages et de leur `world` /
  `batiment` par identité, jamais de la caméra) : aplanir sous des centaines de bâtiments à chaque image
  coûtait environ 1 s par image sur un centre-ville. Il prend la matière même du Sol ; le Sol plat est
  percé dessous par un masque au pochoir sans test de profondeur (avec, il lutterait avec le relief
  presque plat : moiré).
- **Le relief et les dessins drapés ne projettent jamais d'ombre** : `marquerProjectionDOmbre3D` les
  reconnaît à `userData.relief` / `userData.dessinAuSol`, pas à leur hauteur (sinon acné d'ombre).
- **La hauteur d'un point suit les triangles du maillage** (diagonale (i+1, j)–(i, j+1)), pas une
  interpolation bilinéaire : sinon ce qui est posé dessus passe dessous.
- **Performance** : pendant un coup de pinceau, les Tracés sont figés (`figerLesTraces3D`) et l'aperçu
  bridé à 8 images/s.
- **Les boutons et listes du menu sont construits une fois et seulement remis à jour** : le menu est
  repassé à chaque dessin, et un bouton remplacé entre l'appui et le relâcher perd le clic.
