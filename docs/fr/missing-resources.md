# Ressources introuvables

*[English version](../en/missing-resources.md)*

Ce que fait l'application quand un Projet ouvert cite des modèles 3D, des images de Case ou des
polices qu'elle ne trouve pas, et comment le voir sans casser un vrai Projet.

## Pourquoi cela arrive

Les modèles et les images ne sont pas rangés à côté du fichier du Projet, mais dans les dossiers
`Modeles` et `Images` du **dossier des Projets** réglé dans la Configuration. Ce dossier diffère selon
le lancement :
- avec `npm start`, c'est `Projets` à la racine du dépôt ;
- une fois installée, c'est `Documents\Storyboarder BD\Projets`, et la version installée a ses propres
  réglages.

Une police ajoutée est un nom de famille, pas un fichier : elle manque si elle n'est ni intégrée ni
dans `Polices` (renommages suivis, cf. [polices.md](polices.md)) ; `policeDisponible` en décide.

## Ce que fait l'application

Après l'ouverture d'un Projet, et **après** le repointage des modèles renommés,
`src/missing-resources.js` compare ce que le Projet cite (toutes les Planches de tous les Tomes, et les
Scènes) aux **listes** des dossiers. L'état des caches n'est pas consulté : un fichier présent mais
illisible n'est pas un problème de dossier.

S'il manque quelque chose, la modale « Ressources introuvables » dit :
- combien de modèles, d'images et de polices manquent, et que rien n'est retiré du Projet ;
- où l'application a cherché (chemins complets) ;
- quels fichiers, huit par catégorie, puis « et N autre(s) » ;
- comment corriger : choisir le bon dossier dans la Configuration (un bouton l'ouvre), copier les
  fichiers, ou rajouter la police depuis « Mes polices » ;
- un indice si le Projet est enregistré ailleurs que dans le dossier des Projets.

Changer de dossier (« Choisir... » ou « Dossier par défaut ») oublie les fichiers déclarés
introuvables, relance le préchargement et refait la vérification : la modale se met à jour ou
disparaît, sans redémarrer.

## Voir la modale sans casser un Projet

En développement seulement, la variable `STORYBOARD_SIMULER_RESSOURCES` ouvre la modale au démarrage
avec des données factices (trois modèles et onze images manquants, un Projet rangé ailleurs) ; les
chemins de recherche sont les vrais.

```
[Console]::OutputEncoding=[Text.Encoding]::UTF8; cd C:\WebProjects\Storyboarder; $env:STORYBOARD_SIMULER_RESSOURCES='1'; npm start
```

La variable reste posée dans ce terminal, ce que signale un bandeau jaune. Pour revenir à la normale,
fermer le terminal, ou :

```
[Console]::OutputEncoding=[Text.Encoding]::UTF8; Remove-Item Env:STORYBOARD_SIMULER_RESSOURCES; cd C:\WebProjects\Storyboarder; npm start
```

Sans simulation : régler un dossier des Projets vide dans la Configuration, rouvrir le Projet, puis
revenir avec « Dossier par défaut ».
