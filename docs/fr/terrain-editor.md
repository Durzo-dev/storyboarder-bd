# L'Éditeur de terrain (#462)

*[English version](../en/terrain-editor.md)*

Façonner le sol d'une Scène : relief, Zones, Tracés, eau. Décidé avec Durzo du 2 au 4 novembre
2026 ; livré en 1.16.0.

## Où vit quoi

| Fichier | Rôle |
|---|---|
| `src/terrain-editeur-ui.js` | L'éditeur : ouverture (une Scène seulement), outils, menus, plan, aperçu 3D, validation. |
| `src/terrain-plan.js` | PUR. Le plan en mètres (zones, tracés, bâtiments, éléments), son cadrage, le toucher, déplacer et tourner une Zone. |
| `src/terrain-relief.js` | PUR. La grille de hauteurs, le pinceau, les rivières, les Zones relevées ou en pente, le profil « franchissant » des routes. |
| `src/terrain-zone-pinceau.js` | PUR. Les Zones peintes : un masque de cases de 50 cm. |
| `src/scene3d.js` | Le rendu : `reliefEffectif3D`, `poserRelief3D`, `draperSurLeRelief3D`, l'eau, `rendreSceneVueLibre3D`. |

## Les données ajoutées (champs AJOUTÉS : un fichier ancien se lit tel quel)

- **`panel.relief`** (le canevas de la Scène, et une Case qui la charge) : `{ pas, x0, z0, nx, nz, h, v }`,
  hauteurs en mètres au pas de 1 m, ligne par ligne en z. Absent : Sol plat.
- **Tracé `terrain`** (Zone) : `world.masque` `{ pas, x0, z0, nx, nz, plein }` pour une Zone peinte
  (le rectangle englobant reste dans `world`) ; `hauteurZone`, `penteZone` (degrés), `sensPente`
  (degrés) ; `niveauEau` quand `terrainType === 'eau'`.
- **Tracé `riviere`** : `world.pts`, `world.width`, `profondeur`.

## Les décisions qui comptent

- **Rien n'est appliqué avant « Valider ».** L'éditeur travaille sur la Scène (l'aperçu et les
  réglages en ont besoin) mais garde son état de départ ; quitter sans valider le remet ; valider fait
  UNE annulation de l'application. Pendant l'édition, `snapshot()` alimente l'historique de l'éditeur,
  et la sauvegarde automatique attend.
- **Le relief rendu = le relief peint, relevé par les Zones, creusé par les rivières, aplani sous les
  bâtiments** (`reliefEffectif3D`), recalculé à chaque rendu. Il prend la matière MÊME du Sol (une copie
  changeait la couleur) ; le Sol plat est percé dessous par un masque au pochoir SANS test de
  profondeur (avec, il luttait avec le relief presque plat : moiré).
- **Le relief et les dessins drapés ne projettent jamais d'ombre** : `marquerProjectionDOmbre3D` les
  reconnaît à `userData.relief` / `userData.dessinAuSol`, pas à leur hauteur (sinon acné d'ombre).
- **La hauteur d'un point suit les triangles du maillage** (diagonale (i+1, j)–(i, j+1)), pas une
  interpolation bilinéaire : sinon ce qui est posé dessus passe dessous.
- **Performance** : pendant un coup de pinceau, les Tracés sont figés (`figerLesTraces3D`) et l'aperçu
  bridé à 8 images/s : 665 → 2 ms par image mesurés.
- **Les boutons et listes du menu sont construits une fois et seulement remis à jour** : le menu est
  repassé à chaque dessin, et un bouton remplacé entre l'appui et le relâcher perd le clic (le défaut
  du #459a, revenu ici deux fois).
