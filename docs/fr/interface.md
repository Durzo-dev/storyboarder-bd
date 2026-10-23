# Règles d'interface

*[English version](../en/interface.md)*

> Les règles visuelles et d'interaction posées par l'utilisateur au fil des retours, surtout pendant
> l'éditeur de bâtiment (#454). Elles étaient éparpillées dans les commentaires de `src/style.css` et
> dans les conversations ; ce document les rassemble. Celles qui se vérifient sont tenues par
> `tests/interface.test.mjs`. La source de vérité des valeurs reste `src/style.css` : si un chiffre
> d'ici et la feuille divergent, c'est la feuille qui fait foi et ce document qui est en retard.

## Couleurs

### Un bouton dit ce qu'il fait par sa couleur (#398)

| Couleur | Classe | Rôle | Exemples |
|---|---|---|---|
| Orange | `.full-btn` | valider, ou **créer** quelque chose | Enregistrer, Appliquer, Ajouter un étage, Dupliquer l'étage |
| Gris | `.nav-btn` | naviguer, ou agir sans rien créer | Annuler, Quitter, Recadrer, Tourner de 90° |
| Rouge | `.delete-btn` | supprimer | Supprimer l'escalier |
| Jaune | `.edit-btn` | renommer, éditer | Renommer |

- Un bouton **désactivé** est gris foncé quelle que soit sa classe : il n'annonce pas par sa couleur
  ce qu'il ne peut pas faire.
- Le survol d'un bouton gris n'est **jamais orange** : l'orange promet une création ou une
  validation.
- La couleur ne porte jamais seule le sens : le libellé ou l'infobulle le dit aussi (daltonisme,
  cf. [colour-accessibility.md](colour-accessibility.md)).

### Tout passe par les jetons

Aucune couleur d'interface n'est écrite en dur : `--paper`, `--ink`, `--accent`, `--danger`… Les
quatre rendus (Sombre, Clair, et le contraste renforcé de chacun) redéfinissent les mêmes jetons.
Une valeur ajoutée en dur est fausse dans trois thèmes sur quatre.

## Espacements

### Les quatre écarts

| Écart | Entre |
|---|---|
| 14 px | deux sections (`.side-section`), et entre la dernière section et les boutons du bas |
| 10 px | deux sous-sections, et entre une sous-section et le champ qui la suit |
| 8 px | deux rangées d'une même sous-section (son `gap`, rien d'autre) |
| 6 px | deux boutons voisins ou empilés |

- Dans une sous-section, **seul le `gap` espace** : les marges propres des rangées (choix, cases,
  champs) y sont mises à zéro. Une marge en plus se voit tout de suite comme un trou.
- Un écart se règle **au-dessus et au-dessous d'un élément de la même façon** : un champ entre deux
  blocs a le même vide de chaque côté.
- ⚠️ Deux marges verticales voisines se **confondent** au lieu de s'additionner : la plus grande
  seule compte. Viser un écart en additionnant deux marges donne la plus grande des deux.

## Structure d'un menu de droite

### Un seul menu, une section qui s'ajoute

- Un éditeur a **un seul menu** : ses sections permanentes restent (pour l'éditeur de bâtiment :
  Bâtiment, Niveaux, Pièces).
- Une **section contextuelle** s'ajoute au besoin : ce qu'on va poser avec l'outil pris, ou ce qui
  est sélectionné. Pas de menu propre à chaque outil.
- Les boutons de sortie (Enregistrer, Recadrer, Quitter) restent **toujours** en bas.
- Pas de bouton « Fermer l'outil » : on quitte un outil par un nouveau clic sur son bouton, ou par
  Échap.
- Un élément sans réglage propre (un mur, une pièce) n'a **pas** de section : le sélectionner laisse
  le menu tel quel.

### Sous-sections

Un regroupement à l'intérieur d'une section (Type, Marches, Dimensions) : un **creux** (`--creux`),
un titre de 13 px en `--ink-mid`, un cran sous le titre de section. On y regroupe ce qui se décide
ensemble.

### Commandes

- Une section « Commandes » dit ce qu'on peut faire **selon l'outil et la sélection**.
- **Une action par ligne**, sous la forme « Geste : effet. », sans ligne vide entre elles.
- Des phrases courtes : une ligne qui passe à la ligne est trop longue.

### Pas de message d'état dans un menu

- Un geste refusé ne produit **aucun message** : l'aperçu était déjà rouge.
- Une réussite non plus : l'état du bouton suffit (« Enregistrer » se grise, son infobulle dit sous
  quel nom).
- Un échec qui demande l'attention (un enregistrement impossible) ouvre une **modale**.

## Choix et icônes

### Des pictogrammes plutôt que des mots

- Un choix entre formes ou variantes s'affiche en **icônes au trait** (`currentColor`), **sans
  libellé** : le nom est dans l'infobulle.
- L'icône est dessinée dans la vue où la différence se lit :
  - **de dessus** pour ce qui se lit sur le plan (forme d'un escalier, rampe, gestes d'une porte) ;
  - **de face** pour les ouvertures (porte, fenêtre, baie, passage, battants, arche) ;
  - **de profil** pour les marches (pleines ou ouvertes).
- Le choix actif est **orange** : bordure `--accent`, fond `--accent-soft`.
- Une case à cocher devient deux icônes quand les deux états se dessinent (Pleines / Ouvertes,
  Pleine / Vitrée).
- Un choix qui ne change rien de visible pour ce type n'est **pas proposé** (le nombre de battants
  d'une baie coulissante, le remplissage d'une fenêtre).

Les icônes vivent dans `src/batiment-icones.js`.

### Infobulles

- Une infobulle **nomme** : elle ne dépend pas du contexte (pas de « Déplacera l'escalier de
  207 cm »).
- **Seule exception : un choix impossible**. Il est grisé, non cliquable, et son infobulle donne la
  raison. Vaut aussi pour un outil (l'outil Escalier sans niveau au-dessus).
- Un raccourci clavier s'écrit entre parenthèses à la fin : « Ajouter un niveau vide en haut (N) ».

## Gestes

### Les mêmes gestes d'un outil à l'autre

| Geste | Effet pendant une pose |
|---|---|
| Clic | poser, **sélectionner** ce qui est posé, et prendre l'outil Sélection |
| Clic droit | tourner, ou changer le sens |
| Molette | changer de type |
| Ctrl + molette | zoomer (quand la molette change le type) |
| Alt maintenu | poser sans aimant |
| Échap | désélectionner, puis quitter l'outil, puis fermer l'éditeur |

- Un éditeur vide s'ouvre sur l'outil qui le remplit (l'outil Mur), et un nouvel étage aussi.
- Un clic **n'importe où** dans une ligne de liste la choisit ; le clic droit ouvre son menu
  (Renommer, Supprimer).

### Modales

- **Jamais deux modales d'affilée** : on les fusionne en une.
- Une modale qui bloque **liste ce qui bloque, avec la raison**, et propose de le résoudre.
- Ses boutons sont **courts** : « Supprimer », pas « Supprimer le niveau et l'escalier ».

## Mots

### Libellés

- Courts : un libellé qui passe à la ligne est trop long.
- Un terme technique qui n'est pas clair est **remplacé** et expliqué en infobulle : « Hauteur
  d'allège » est devenu « Élévation » (« Distance entre le sol et le bas de l'ouverture »).
- Les noms de l'application gardent leur majuscule : Projet, Tome, Planche, Case, Bulle, Scène,
  Élément.
