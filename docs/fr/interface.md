# Règles d'interface

*[English version](../en/interface.md)*

> Les règles visuelles et d'interaction de toute l'application, posées par l'utilisateur au fil des
> retours (convention des boutons #398, accessibilité #409, taille de l'interface #410, éditeurs,
> store, éditeur de bâtiment #454…). Elles étaient éparpillées dans les commentaires de
> `src/style.css` et dans les conversations ; ce document les rassemble. Celles qui se vérifient sont tenues par
> `tests/interface.test.mjs`. La source de vérité des valeurs reste `src/style.css` : si un chiffre
> d'ici et la feuille divergent, c'est la feuille qui fait foi et ce document qui est en retard.
>
> Le **système de design** (jetons des quatre rendus, typographie, écarts, rayons, contrôles, et
> chaque écran : en-tête, menus de gauche et de droite, menus contextuels, modales, store, éditeurs,
> Lecteur) est une page générée depuis le code : [design-system.html](../design-system.html), par
> `node tools/design-system.mjs`, que le hook pre-commit lance à chaque commit. Un test vérifie
> qu'elle est à jour.

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
- **Ce qui informe n'est pas orange** (#460b) : une pastille d'information (dimensions, avancement,
  licence, compte, numéro) est neutre, `--ink-mid` sur `--creux`. L'orange y revient seulement quand
  sa ligne est active.
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

## Écrans

### En-tête

- Le nom de l'application à gauche, puis des **boutons ronds** d'accès aux écrans (bâtiment,
  modèle, bibliothèque, polices, annuler, sauvegarder, configuration, manuel).
- Chaque bouton rond a une infobulle avec son raccourci ; il **s'allume** quand son écran est ouvert.

### Menu de gauche

- Le **nom du Projet** en tête (un clic ouvre la modale Projet), puis une carte par liste : Tomes,
  Scènes, Images. Chaque carte se replie par son titre.
- Les lignes sont des pavés bordés ; la ligne **active** est marquée d'orange (bord, et fond
  orange léger pour une Planche). Clic droit : son menu. Glisser : réordonner, l'endroit d'insertion marqué d'un trait orange.
- Les ajouts secondaires (« Ajouter une planche », « Ajouter un chapitre ») sont des boutons en
  pointillés ; l'ajout principal (« Nouveau tome ») est le bouton orange en bas de la carte.
- Un **pied de page fixe** dit depuis quand le Projet est enregistré.

### Menu de droite de l'application

- Il suit ce qui est choisi : Planche, Case, Bulle ; la Caméra ; le Manuel quand rien ne l'est.
- En-tête centré avec sa croix de fermeture ronde ; sections repliables d'un clic sur leur titre.
- Un réglage est un **bloc** : libellé en capitales au-dessus, champ pleine largeur dessous. Dans le
  panneau droit, un bloc n'est pas en retrait.
- Les cases à cocher du panneau ont une seule apparence (case, puis libellé en casse normale).

### Éditeurs et Lecteur

- L'Éditeur de modèle, l'éditeur de bâtiment et le Lecteur **recouvrent la zone centrale**, pas la
  fenêtre : l'en-tête et le menu de gauche restent visibles.
- Leur menu de droite est construit avec les mêmes sections que celui de l'application, et leurs
  actions de sortie (Appliquer, Enregistrer, Quitter) sont toujours en bas.
- Dans l'Éditeur de modèle, un groupe d'articulations est une carte repliable sur fond creux ; une
  chaîne dans une ancre est séparée de la suivante par un filet.

### Modales

- Un **voile sombre**, une boîte en papier foncé de rayon 10 px, un titre en 14,5 px gras.
- **Une seule zone défile** : la boîte. Les longues modales (un Élément) se découpent en sections
  repliables sur fond creux, plutôt qu'en zones à hauteur plafonnée.
- Les actions sont **en bas à droite** : Annuler en gris, puis l'action dans sa couleur.
- Un champ n'est pas collé au titre ; l'écart entre deux champs (14 px) vient de la marge basse du
  champ qui précède. Une ligne d'erreur, quand le champ en a une, se place dessous.
- Une modale longue a une croix ronde en haut à droite ; Échap la ferme.
- **Modale Projet** : ses boutons gardent un fond uniforme, et la couleur du rôle n'apparaît
  qu'**au survol**. C'est le premier écran de l'application ; quatre couleurs de fond en feraient un
  arc-en-ciel.

### Onglets

Le store et la Configuration ont des onglets : un texte, l'actif **souligné d'orange**. Les pages
d'une modale à onglets ont la hauteur de la plus longue : la modale ne change pas de taille d'un
onglet à l'autre.

### Menus contextuels

- Fond `--white`, rayon 8 px, ombre portée ; une entrée = un **emoji** puis un libellé de 12,5 px.
- Un sous-menu s'annonce par ▶ à droite. Supprimer vient en dernier.

### Store et fenêtre des polices

- Un onglet par source, les filtres en haut, la mention des licences en bas : **seule la grille
  défile**.
- Une carte : vignette, nom, auteur, badge de licence (orange si l'usage commercial est permis,
  gris sinon), poids. La tuile d'import est une carte en pointillés.
- La **fiche remplace la grille** au lieu de s'ouvrir par-dessus ; la fenêtre des polices fait de
  même.

### Bandeaux d'information

Une **information** (le bandeau de reprise) est en **bleu**, pas dans une couleur d'action : la
couleur dit la nature du bandeau, pas la conséquence d'un bouton.

## Accessibilité

### Thèmes et contraste

- Quatre rendus : Sombre, Clair, et le **contraste renforcé** de chacun (un modificateur qui se
  cumule, pas un cinquième thème). Les valeurs sont **mesurées** : 4,5:1 pour le texte, 7:1 en
  contraste renforcé ; un test rejoue le calcul.
- Trois jetons de filet : `--line` encadre (décoratif), `--line-strong` sépare dans un bloc,
  `--bord-actif` borde ce qui se clique ou se saisit (3:1 minimum).
- Le texte sur un bouton coloré a son propre jeton (`--sur-accent`, `--sur-danger`, `--sur-warn`).
- La **bague de focus** (`--focus`) épouse la forme du champ.
- Les fonds d'aperçu 3D (`--fond-3d`) restent clairs dans les quatre thèmes ; les ascenseurs sont
  stylés partout de la même façon.

### Taille de l'interface

Un réglage agrandit l'interface (`--echelle-ui`) : en-tête, menus, modales et menus contextuels.
**La Planche n'est pas agrandie**, ni le voile des modales : seulement ce qui se lit.

## Choix et icônes

### Des pictogrammes plutôt que des mots

- Un choix entre formes ou variantes s'affiche en **icônes au trait** (`currentColor`), **sans
  libellé** : le nom est dans l'infobulle.
- L'icône est dessinée dans la vue où la différence se lit :
  - **de dessus** pour ce qui se lit sur le plan (forme d'un escalier, rampe, gestes d'une porte) ;
  - **de face** pour les ouvertures (porte, fenêtre, baie, passage, battants, arche) ;
  - **de profil** pour les marches (pleines ou ouvertes).
- Le choix actif est **orange** : bordure `--accent`, fond `--accent-soft`.
- **Types et options** : les types (porte, fenêtre…) sont de grandes tuiles ; les options d'un type
  (battants, pleine ou vitrée, côté où tourne un escalier) viennent sous un filet, en sélecteurs
  segmentés compacts. À nombre égal, une option reste plus petite qu'un type, et sa forme la
  distingue d'un type sans avoir à comparer les tailles.
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

## Harmonisations prévues (#460)

Relevées en analysant le système de design ; à faire plus tard. Une fois tranchée, chaque règle
rejoint ce document avec son test.

- **#460a** ✅ Curseurs et cases à cocher natifs à l'orange : `accent-color: var(--accent)` sur `<body>`.
- **#460b** ✅ L'orange servait aussi à informer (pastilles de dimensions et d'avancement, badges de
  licence, numéros de niveau) : passer à une pastille neutre.
- **#460c** ✅ Un seul composant de choix, `.choix` (éditeur de bâtiment, Lecteur), avec ses variantes
  `.choix-types`, `.choix-options` et `.choix-bascules`.
- **#460d** Trois styles de ligne active et deux traits de dépôt : n'en garder qu'un de chaque.
- **#460e** Deux mises en page de champ (libellé au-dessus ou à gauche) : trancher la règle.
- **#460f** Deux vocabulaires de section (panneaux, modale d'un Élément) : une seule hiérarchie.
- **#460g** Deux composants d'onglets (store, Configuration) : les fusionner.
- **#460h** Deux états vides : les fusionner.
- **#460i** 22 tailles de texte : passer à six.
- **#460j** 11 rayons : passer à trois.
- **#460k** Icônes : une seule famille au trait (en-tête, menus contextuels).
