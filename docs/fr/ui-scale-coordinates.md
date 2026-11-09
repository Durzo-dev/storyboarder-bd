# Pixels d'écran et pixels zoomés

*[English version](../en/ui-scale-coordinates.md)*

## La règle

**Une coordonnée d'écran ne s'écrit jamais telle quelle dans un élément zoomé.** Soit on la convertit
une fois, à un seul endroit, soit on ne zoome pas l'élément.

## Les deux repères

La taille de l'interface est appliquée par `zoom: var(--echelle-ui)` sur les conteneurs : `header`,
`.sidebar`, `.right-panel`, `.modal-box`, `.context-menu`, et les panneaux de l'Éditeur de modèle.
L'application a donc deux repères, et rien ne dit auquel un nombre appartient :

| d'où vient le nombre | ce que c'est |
|---|---|
| `e.clientX` / `e.clientY` d'un événement souris | pixels d'écran |
| `getBoundingClientRect()`, n'importe quel champ | pixels d'écran, zoom compris |
| `window.innerWidth` / `innerHeight` | pixels d'écran |
| `style.left` / `style.top` sur un élément zoomé | **pixels zoomés**, multipliés par le facteur |

Au cran « Très grande » (facteur 1,3), un `.context-menu` en `left:200px` se rend à 260 px.

## Les menus flottants : convertir une fois

`placerMenuFlottant3D` (`src/ui-scale.js`) place un menu à partir de son **ancre** (le curseur, ou
l'entrée qui ouvre un sous-menu), jamais de la position courante du menu :
1. il recadre dans la fenêtre **en pixels d'écran** (la fenêtre n'est pas zoomée) ;
2. puis il convertit en pixels zoomés pour `style.left` / `style.top`.

Appelée dix fois avec la même ancre, elle rend dix fois la même réponse.

## L'infobulle : ne pas zoomer

Ce qui doit se poser exactement sur autre chose sort des conteneurs zoomés. L'infobulle est
`position:fixed` hors de ces conteneurs, sa taille suit le réglage par des
`calc(… * var(--echelle-ui))`, et sa position reste en pixels d'écran.

## Tester

Les tests de `src/ui-scale.js` tiennent l'arithmétique, la conversion de repère, le recadrage et
l'indépendance à tout état courant. Le comportement de `zoom` lui-même relève du navigateur : il se
vérifie à l'écran, au cran « Très grande », en ouvrant un menu contextuel et un sous-menu près du bord
droit de la fenêtre.

## Pièges

- **Ne jamais relire la position d'un menu pour la réécrire** : chaque passage la remultiplierait par
  le facteur, jusqu'à sortir le menu de l'écran.
- **Recadrer avant de convertir** : recadrer après ramènerait le menu trop tôt et laisserait un blanc
  à droite, d'autant plus large que l'interface est grande.
