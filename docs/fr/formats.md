# Formats des Tomes

*[English version](../en/formats.md)*

## Rôle

Les formats (dimensions d'une Planche) appartiennent au **Projet** : tous ses Tomes y puisent, et un
Projet envoyé à quelqu'un emporte les siens.

## Fichiers

- `src/formats.js` : les décisions (création, renommage, suppression, relecture), testées sous Node.
- `src/formats-ui.js` : la modale « Formats du projet ».
- `src/project-tree.js` : la liste des formats d'un Tome dans le menu de gauche, qui finit par
  « Gérer les formats… ».

## Les règles

- Un format se **crée** (nom, largeur, hauteur, en mm ou en px) et se **renomme**. Ses dimensions ne
  se modifient pas : les Cases des Tomes qui l'utilisent se déplaceraient.
- Un format **utilisé** par un Tome ne se supprime pas (l'infobulle du bouton dit lesquels) ; le
  dernier format non plus.
- Les quatre formats **intégrés** (Franco-Belge, Comics US, Webtoon vertical, Format personnalisé)
  sont la liste de départ d'un Projet, renommables et supprimables comme les autres.
- Tout se défait d'un Ctrl+Z.

## Les mm et les px

Une Planche est dessinée à une taille d'écran (`w`, `h`) et exportée multipliée par `scale`. La section
**Dimensions** d'une Case affiche ses côtés en mm grâce à `mmW`, la **largeur imprimée** du format
(Franco-Belge : 550 px pour 220 mm, soit 2,5 px par mm).

- **En mm** (album imprimé) : le plus grand côté fait 725 px à l'écran, export ×4 ; `mmW` est la
  largeur saisie.
- **En px** (webtoon, écran) : la taille saisie est celle de l'export ; au-delà de 1000 px, la Planche
  est dessinée réduite et `scale` la rend à sa taille. Les mm suivent alors l'équivalence de 96 dpi.

## Données

`formats` au niveau du Projet : `[{ key, nom?, unite, largeur, hauteur, w, h, scale, mmW }]`. `nom`
est absent tant qu'un format intégré n'a pas été renommé : il s'affiche alors dans la langue de
l'application.

Chaque Tome garde sa clé `format` **et sa copie** de `w`, `h`, `scale`, que lit le dessin. Un format ne
changeant pas de dimensions, la copie ne peut pas se désaccorder.

**À la lecture**, un fichier sans `formats` reçoit les quatre formats intégrés. Un Tome à la clé
inconnue, ou aux dimensions d'aucun format, reçoit le format de la liste à ses dimensions, sinon un
nouveau (« Format personnalisé 2 »…) : seule sa clé change.

## L'import d'une planche

Une planche importée qui n'a pas les proportions du Tome propose un format qui lui corresponde (cf.
[planche-importee.md](planche-importee.md)). Ce format rejoint ceux du Projet (« Planche importée », ou
un format existant aux mêmes dimensions).
