# Formats des Tomes

*[English version](../en/formats.md)*

> Demandé par Valentin le 22 octobre 2026 (#453). Le code : `src/formats.js` (les décisions, testées
> sous Node), `src/formats-ui.js` (la modale), et la liste des formats d'un Tome dans
> `project-tree.js`.

## Les règles

- Les formats appartiennent au **Projet** : tous ses Tomes y puisent, et un Projet envoyé à
  quelqu'un emporte les siens.
- Un format se **crée** (nom, largeur, hauteur, en mm ou en px) et se **renomme**. Ses dimensions ne
  se modifient pas : les Cases des Tomes qui l'utilisent se déplaceraient.
- Un format **utilisé** par un Tome ne se supprime pas (l'infobulle du bouton dit lesquels) ; le
  dernier format non plus.
- Les quatre formats **intégrés** (Franco-Belge, Comics US, Webtoon vertical, Format personnalisé)
  ne sont que la liste de départ d'un Projet : renommables et supprimables comme les autres.

## Le geste

Dépliez un Tome dans le menu de gauche : sa liste de formats finit par **« Gérer les formats… »**,
qui ouvre la modale « Formats du projet ». Chaque format y montre ses dimensions, le nombre de Tomes
qui l'utilisent, « Renommer » et « Supprimer » ; dessous, la création. Tout se défait d'un Ctrl+Z.

## Les mm et les px

Une Planche est dessinée à une taille d'écran (`w`, `h`) et exportée multipliée par `scale`. La
section **Dimensions** d'une Case affiche ses côtés en mm : il faut donc savoir combien de px
d'écran font un mm imprimé, ce que donne `mmW`, la **largeur imprimée** du format (Franco-Belge :
550 px pour 220 mm, 2,5 px par mm).

- **En mm** (un album imprimé) : le plus grand côté fait 725 px à l'écran, comme le Franco-Belge,
  export ×4 ; `mmW` est la largeur saisie, et les mm affichés sont justes.
- **En px** (un webtoon, un écran) : la taille saisie est celle de l'export ; au-delà de 1000 px, la
  Planche est dessinée réduite et `scale` la rend à sa taille. Sans taille imprimée, les mm suivent
  l'équivalence écran de 96 dpi.

## Ce qui est persisté

Un champ **ajouté** au niveau du Projet, `formats` : `[{ key, nom?, unite, largeur, hauteur, w, h,
scale, mmW }]`. `nom` est absent tant qu'un format intégré n'a pas été renommé : il s'affiche alors
dans la langue de l'application.

Chaque Tome garde sa clé `format` **et sa copie** de `w`, `h`, `scale` : c'est ce que lisent le
dessin et les versions antérieures. Comme un format ne change pas de dimensions, la copie ne peut
pas se désaccorder.

**À la lecture**, un fichier sans `formats` reçoit les quatre formats intégrés. Un Tome dont la clé
est inconnue, ou dont les dimensions ne sont celles d'aucun format (un Tome passé en « Format
personnalisé » par l'import d'une planche, avant #453), reçoit le format de la liste à ses
dimensions, sinon un nouveau (« Format personnalisé 2 »…) : seule sa clé change.

## L'import d'une planche

Une planche importée qui n'a pas les proportions du Tome propose un format qui lui corresponde (cf.
[planche-importee.md](planche-importee.md)). Ce format rejoint ceux du Projet (« Planche importée »,
ou un existant aux mêmes dimensions) : le défaut d'avant #453, où rechoisir « Format personnalisé »
remettait le Tome à 480×660, a disparu avec lui.
