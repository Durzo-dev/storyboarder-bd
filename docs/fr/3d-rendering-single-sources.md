# Rendu 3D : les sources uniques

*[English version](../en/3d-rendering-single-sources.md)*

## La règle

Un Élément 3D est décrit à plusieurs endroits à la fois : la géométrie qui le dessine, le trou découpé
pour lui, sa boîte de sélection à l'écran, la cible de la caméra. **Chaque valeur a une seule fonction
qui la calcule**, et tous ces endroits l'appellent. Deux calculs séparés de la même valeur s'accordent
le jour où on les écrit, puis divergent, souvent partiellement (bonne position horizontale, mauvaise
verticale), ce qui rend l'écart invisible jusqu'à ce qu'on déplace l'Élément.

## Les fonctions qui font autorité

| Question | Fonction | Fichier |
|---|---|---|
| Où est une Parois posée sur un Tracé mur ? | `wallOpeningWorldPosOnTracé3D` | `scene3d.js` |
| …et son **centre** (boîte, caméra) ? | `tracéOpeningWorldCenter3D` | `scene3d.js` |
| Quelle taille fait cette Parois ? | `tracéOpeningSize3D` | `scene3d.js` |
| Quelle échelle pour son rig ? | `tracéOpeningRigScale3D` | `scene3d.js` |
| Quelle hauteur fait un Tracé mur ? | `tracéWallHeight3D` | `scene3d.js` |
| Quelle épaisseur ? | `tracéWallThickness3D` | `scene3d.js` |
| Où est le trou à découper ? | `tracéOpeningHole3D` | `scene3d.js` |
| Point et tangente sur un Tracé | `tracéFrameAtFrac3D` | `scene3d.js` |
| Épaisseur des Murs de l'ancien outil Construire | `BUILD_WALL_THICKNESS_RATIO_3D` | `constants.js` |

**Aucune de ces valeurs ne se recalcule à la main.** Si une formule est nécessaire ailleurs, on appelle
la fonction ; si elle ne convient pas, on la modifie, au seul endroit où elle vit.

Points à connaître :
- la marche le long du chemin sert au rendu **et** à la caméra : sans elle, la caméra centrerait sur
  des coordonnées stockées périmées ;
- la travée verticale d'une Parois (hauteur du mur moins celle de la Parois) vaut pour le rig **et**
  pour le trou ;
- la taille d'une Parois est indépendante en largeur et en hauteur (`tracéOpeningSize3D`), jamais une
  échelle uniforme tirée de la hauteur ;
- la hauteur par défaut d'un Tracé mur ne s'écrit qu'à un endroit, lu par `tracéWallHeight3D`.

## Trouver un écart

- **Mesurer avant de corriger** : un script jetable qui importe les vrais modules (avec
  `tests/helpers/dom-stub.mjs`) et affiche les valeurs de chaque endroit sur une plage de paramètres ;
  un écart qui grandit avec un paramètre désigne la copie fautive.
- **Le test par mutation** (cf. [testing-method.md](testing-method.md)).

## Les invariants verrouillés par les tests

`tests/scene3d.test.mjs` contient une suite d'**invariants** qui balaie les deux fractions
(`wallAlongFrac`, `wallYFrac`) sur trois formes de muret (droit, coudé, boucle) et vérifie que le trou,
la Parois, la boîte de rendu, la caméra et le tableau désignent tous le même endroit.

Quand on ajoute une valeur dérivée d'une autre, l'ajouter aussi à ces invariants.

## Le même principe hors 3D

La version de l'application vit dans quatre fichiers ; `tools/bump-version.mjs` les tient d'accord et
`tests/version.test.mjs` l'exige (cf. [versioning.md](versioning.md)).
