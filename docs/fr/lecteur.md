# Le Lecteur

*[English version](../en/lecteur.md)*

Demandé par Valentin en octobre 2026 : lire un Tome ou un Chapitre à la suite, comme un album, sans
quitter l'application. Clic droit sur un Tome (« Lire ce tome ») ou un Chapitre (« Lire ce
chapitre ») ; la lecture commence à la Planche affichée si elle en fait partie.

## Ce qu'il fait

Le Lecteur prend la place de la Planche (même emprise que l'Éditeur de modèle) : la page au centre,
son menu à droite, un bandeau de miniatures en bas.

**Le menu** porte en titre le Tome (et le Chapitre), et dessous la position : « Planche 1 · 1&2/9 »
donne le numéro de la première Planche montrée, puis les RANGS des Planches à l'écran dans ce qu'on
lit (deux en double page, sans la page blanche), sur le total. Le bouton de fermeture est à côté du
titre, comme dans les autres menus de droite.

**Tourner les pages.** Tout l'espace à gauche de la page et tout l'espace à droite sont cliquables
(au moins 64 px quand la page remplit la largeur) ; la flèche est à 32 px de la page, au même écart
des deux côtés. Le côté où il n'y a plus de page ne montre pas de zone. Au clavier : ← → (en manga,
la gauche avance), Page préc. / Page suiv., Origine et Fin ; Espace lance ou arrête le défilement
automatique ; F bascule le plein écran (le menu disparaît) ; Échap quitte le plein écran, puis le
Lecteur. Pendant la lecture, les autres raccourcis de la Planche (E, C, T, WASD, [ ]) sont avalés,
pour ne pas agir sur ce qui est caché dessous. Cliquer une Planche, une Scène, un ajout ou l'Éditeur
dans le menu de gauche ou le bandeau ferme le Lecteur ; déplier un Tome ou un Chapitre, non.

**Les options** (retenues, `lecteur:options`) :

- une ou deux pages ; en double page, première page à droite ou à gauche (une page blanche comble le
  vide, de la couleur du fond, donc invisible) ;
- page entière ou largeur ;
- **vue livre**, cochée par défaut : chaque page a son ombre, la double page une ombre de reliure, et
  avancer ou reculer d'un cran TOURNE la page autour de la reliure. Décochée, les pages sont collées
  à plat, sans effet ni animation. Un saut (miniature, Origine, Fin) ne tourne rien ;
- vue guidée case par case, à la manière du « Guided View » de Comixology : la vue glisse de Case en
  Case dans l'ordre de leurs numéros, puis passe à la Planche suivante (une page, sans vue livre) ;
- lecture vers la gauche ou vers la droite (BD) ;
- défilement automatique : sa vitesse (1 à 60 secondes par page, ou par case en vue guidée), puis le
  bouton Lecture ; il s'arrête seul à la dernière page ;
- fond sombre, gris ou clair ; bandeau de miniatures ; plein écran.

## Où vit quoi

- `src/lecteur.js` : les décisions, pures et testées. Les étalements (quelle page à gauche, laquelle à
  droite, où mettre la page blanche selon le sens et la page de départ), le sens des flèches et des
  bords, le côté qui tourne en vue livre (`coteQuiTourne`), les étapes de la vue guidée et leur
  cadrage.
- `src/lecteur-ui.js` : l'écran, le menu, les miniatures, le clavier, le plein écran, et l'animation
  de page tournée (`tournerLaPage` : une feuille à deux faces pivote autour de la reliure, l'ancienne
  page au recto, celle qui arrive au verso ; un cache garde l'ancienne page de l'autre côté jusqu'à ce
  que la feuille passe la verticale).
- `rendrePlancheEnImage` (draw.js) : une Planche dessinée à part, par le même `drawContent` que
  l'export, après le chargement de ses modèles et images.

## Taille et plein écran

Passer en plein écran envoie plusieurs changements de taille d'affilée. Les redessiner un par un
faisait deux ou trois sauts visibles (chaque dessin, asynchrone, arrivait à une taille déjà
dépassée). Désormais chaque changement RECALE ce qui est à l'écran, sans redessiner (la transition
de la vue guidée est coupée le temps du recalage), et le dessin à la bonne définition vient une
seule fois, un quart de seconde après que la taille s'est stabilisée.

## Coût

Chaque Planche est dessinée à la demande, à la hauteur affichée, et gardée le temps de la lecture
(seize au plus). Les miniatures sont tirées des grands dessins quand ils existent, sinon préparées
une à une en arrière-plan. Dessiner une Planche hors de l'écran refait ses rendus 3D à cette taille :
revenir ensuite à la Planche coûte un rendu de plus.

## Plus tard

La lecture verticale continue, comme les webtoons (#451 dans TACHES.md).
