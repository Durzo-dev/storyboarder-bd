# Le Lecteur

*[English version](../en/lecteur.md)*

Demandé par Valentin en octobre 2026 : lire un Tome ou un Chapitre à la suite, comme un album, sans
quitter l'application. Clic droit sur un Tome ou un Chapitre → « Lire ».

## Ce qu'il fait

Le Lecteur prend la place de la Planche (même emprise que l'Éditeur de modèle) : la page au centre,
son menu à droite, un bandeau de miniatures en bas. On tourne les pages par un clic sur le bord
gauche ou droit, ou par les flèches ; Espace lance ou arrête le défilement automatique, F passe en
plein écran (barre et menu masqués), Origine et Fin vont aux extrémités, Échap sort (du plein écran
d'abord). Pendant la lecture, les raccourcis de la Planche sont avalés, pour ne pas agir sur ce qui
est caché dessous.

Le menu : une ou deux pages ; lecture vers la droite (BD) ou vers la gauche (manga) ; en double page,
première page à droite ou à gauche (une page blanche comble le vide) ; vue livre (cochée par
défaut : la page se tourne autour de la reliure, ombre portée et ombre de reliure en double page ;
décochée, les pages sont collées à plat, sans effet) ; défilement automatique et sa
vitesse (secondes par page, ou par case en vue guidée) ; vue guidée case par case (à la manière du
« Guided View » de Comixology, dans l'ordre des numéros de Case) ; page entière ou largeur ; fond
sombre, gris ou clair ; bandeau de miniatures. Les options sont retenues (`lecteur:options`).

## Où vit quoi

- `src/lecteur.js` : les décisions, pures et testées. Les étalements (quelle page à gauche, laquelle à
  droite, où mettre la page blanche selon le sens et la page de départ), le sens des flèches et des
  bords (en manga, la gauche avance), les étapes de la vue guidée et leur cadrage.
- `src/lecteur-ui.js` : l'écran, le menu, les miniatures, le clavier et le plein écran.
- `rendrePlancheEnImage` (draw.js) : une Planche dessinée à part, par le même `drawContent` que
  l'export, après le chargement de ses modèles et images.

## Coût

Chaque Planche est dessinée à la demande, à la hauteur affichée, et gardée le temps de la lecture
(seize au plus). Les miniatures sont tirées des grands dessins quand ils existent, sinon préparées
une à une en arrière-plan. Dessiner une Planche hors de l'écran refait ses rendus 3D à cette taille :
revenir ensuite à la Planche coûte un rendu de plus.
