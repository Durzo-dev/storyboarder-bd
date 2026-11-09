# « Non visible » : hors du cadre, ou caché

*[English version](../en/non-visible.md)*

## Rôle

La liste des Éléments d'une Case range en bas, sous « Non visible », ceux qu'on ne voit pas dans la
Case : hors du cadre, ou entièrement cachés (derrière un mur, par exemple). Les crédits des exports
s'appuient sur la même décision : un Élément non visible n'est pas crédité.

## Le principe : un rendu d'identifiants

Après le rendu normal d'une Case, la même scène est rendue une seconde fois, petite (le rectangle de la
Case fait au plus 192 pixels), avec la même caméra : chaque Élément peint d'une couleur unique, tout le
reste en noir, sans éclairage ni brouillard. On compte les pixels de chaque couleur dans le rectangle
de la Case : un Élément est visible s'il lui en reste au moins un. Hors-cadre, visibilité partielle et
occultation se règlent d'un coup, avec la vraie géométrie.

`src/visibilite-3d.js` porte les couleurs, le comptage et la décision (purs et testés) et la passe
WebGL. `renderPanelSceneUncached3D` (`scene3d.js`) la lance juste après le rendu, sur la scène encore
en place.

## Ce que la mesure ignore

- **Ce qui est transparent ne cache rien** : un maillage dont tous les matériaux laissent voir à
  travers (opacité sous 0,95, ou transmission) est retiré du rendu d'identifiants.
- **Les Bulles ne cachent rien** : elles sont dessinées en 2D par-dessus la Case.
- **La forme de la Case est son rectangle** : une Case oblique compte un peu plus que ce qu'elle
  montre, ce qui ne peut que déclarer visible à tort, jamais l'inverse.

## Dans le doute, visible

Un Élément qu'on n'a pas pu mesurer (rig pas encore chargé, mesure pas encore faite, échec WebGL)
n'est **pas** déclaré non visible : on retombe sur le test géométrique de la boîte projetée, qui ne se
trompe que dans le sens prudent. Un crédit manquant enfreindrait une licence.

## Quand la mesure a lieu

- **Liste latérale** : elle demande la mesure de la Case sélectionnée. La première fois, un dessin de
  plus est programmé ; ensuite chaque rendu de cette Case la mesure. Seules les huit dernières Cases
  demandées le sont.
- **Export** : toutes les Cases de la Planche sont mesurées pendant son dessin, et la Planche est
  dessinée **avant** le calcul des crédits (`exportPage`, `draw.js`).
- **Un échec est noté, pas réessayé** : réessayer redemanderait un rendu à chaque image.

Le coût : un rendu de plus à basse résolution et une lecture de pixels, pour les Cases mesurées
seulement.
