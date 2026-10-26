# Notes internes

*[English version](../en/README.md)*

Documentation de contributeur. Ce qui s'adresse à l'utilisateur est dans le
[README](../../README.fr.md) et dans le manuel intégré (`src/help-content.js`).

## À lire avant de toucher au code

| Document | Ce qu'il évite |
|---|---|
| [**persisted-data.md**](persisted-data.md) | Rendre illisibles tous les fichiers projet existants, sans que rien ne le signale. |
| [**3d-rendering-single-sources.md**](3d-rendering-single-sources.md) | Réintroduire la duplication qui a produit cinq bugs successifs dans le rendu 3D. |
| [**imported-skeletons.md**](imported-skeletons.md) | Supposer une convention d'os que les fichiers réels ne respectent pas. |

Ces deux-là ne sont pas des recommandations de style : une infraction coûte des données ou une
régression difficile à retrouver.

## Pour comprendre le code

| Document | Sujet |
|---|---|
| [3d-reference-frames.md](3d-reference-frames.md) | Constantes du monde, coordonnées canvas vs monde, orientation, échelles des rigs. |
| [architecture.md](architecture.md) | Règles de modules, imports circulaires, état partagé, nomenclature. |
| [testing-method.md](testing-method.md) | Test par mutation, extraction pour rendre testable, ce qui est hors de portée. |
| [pose-library.md](pose-library.md) | Poses : où elles vivent, enregistrer, supprimer, restaurer, fusion à l'ouverture. |
| [rendering-performance.md](rendering-performance.md) | Coût mesuré du chemin de dessin, ce que l'audit avait faux, comment refaire la mesure. |
| [ground-textures.md](ground-textures.md) | Densité de texels, les trois échelles du Sol, ce qu'une photographie carrelable ne peut pas porter, et la mémoire GPU. |

## Procédures

| Document | Sujet |
|---|---|
| [versioning.md](versioning.md) | Politique `major.minor.correctif`, hooks git, tags. |
| [missing-resources.md](missing-resources.md) | Ressources introuvables : pourquoi un Projet perd ses modèles et images d'une installation à l'autre, la modale qui l'explique, et sa simulation (tâche #443). |
| [updates.md](updates.md) | Mises à jour intégrées : l'attestation signée, le bail de quatorze jours hors ligne, publier une version, la rendre obligatoire (tâche #442). |

## Conception en cours

| Document | Sujet |
|---|---|
| [model-editor.md](model-editor.md) | Éditeur de modèle : décisions arrêtées et découpage (tâches #229 à #237). |
| [creature-rigs.md](creature-rigs.md) | Rigs non humanoïdes : corpus, défauts mesurés, hypothèses démenties, archétypes, plan (tâches #358 à #377). |
| [archetype-roles.md](archetype-roles.md) | Rôles de chaînes : ce qu'une pose peut viser, listes par archétype, décisions arrêtées (tâches #378 et #375). |
| [archetype-poses.md](archetype-poses.md) | Poses par archétype : les trois vocabulaires, ce qui a été mesuré, ce qui a été infirmé, décisions prises (tâches #375 à #402). |
| [building-research.md](building-research.md) | La construction de bâtiments dans les jeux (Les Sims, inZOI, Valheim, Tiny Glade…) et les logiciels d'architecture (Sweet Home 3D, Revit, Archicad…) : ce qu'on en retient, recommandations, modèle de données des niveaux (tâche #455). |
| [formats.md](formats.md) | Les formats des Tomes : propres au Projet, créés, renommés, supprimés s'ils sont inutilisés ; les mm et les px ; le champ ajouté. |
| [planche-importee.md](planche-importee.md) | Les Planches importées : une image de planche, ses Cases détectées puis vérifiées, le cadrage de l'ensemble, ce qui est verrouillé, les champs ajoutés. |
| [panel-images.md](panel-images.md) | Une image dans une Case à la place d'une scène 3D : décisions arrêtées, ce que le code fournit déjà, ce qui reste à mesurer (tâches #403a à #403d). |
| [colour-accessibility.md](colour-accessibility.md) | La couleur qui dépeint contre celle qui signale, collisions mesurées par déficience, pourquoi un thème n'est pas le remède principal (tâches #409a à #409d). |
| [interface.md](interface.md) | Les règles d'interface posées au fil des retours : couleur des boutons, les quatre écarts, un seul menu avec section contextuelle, Commandes, icônes sans libellé, infobulles, gestes de pose, modales, libellés (tâche #454). |
| [lighting.md](lighting.md) | Éclairage d'une Case et d'une Scène : ce que « désactivé » doit vouloir dire, le modèle de données, pourquoi soleil et ambiance bougent ensemble, le hors-périmètre (tâches #414a à #414g). |
| [positioned-lights.md](positioned-lights.md) | Les sources de lumière posées dans une Scène : pourquoi une lumière est un `objet3d` et non un type neuf (70 sites mesurés), les champs persistés, la fuite de la scène partagée, les quatre exclusions voulues (tâche #420). |
| [cast-shadows.md](cast-shadows.md) | Les ombres portées : ce que coûtent le soleil (1,0 ms) et huit sources qui projettent (3,9 ms), les 2 004 ms de compilation qui ont écarté la seconde, et pourquoi une ombre étalée sur le Sol de 12 000 unités change 0,00 % des pixels (tâche #422). |
| [bubble-styles.md](bubble-styles.md) | Le vocabulaire graphique des Bulles : les six axes dont une bulle est faite, pourquoi une même forme ne porte pas le même sens selon l'œuvre (la queue en éclair, mesurée sur quatre), pourquoi le nuage de pensée a disparu des douze œuvres relevées, et le statut du corpus en trois niveaux (tâche #424). |
| [ui-scale-coordinates.md](ui-scale-coordinates.md) | Pixels d'écran contre pixels zoomés : pourquoi `zoom` coupe l'application en deux repères, les 137 px mesurés, pourquoi un recadrage expulsait les menus de l'écran, et la règle qui en découle (tâche #417). |
| [imported-models-display.md](imported-models-display.md) | L'affichage des modèles importés : l'audit qui a suivi le canard orange, les sept corrections (couleurs, métaux, émission, lumières du fichier, import d'un `.gltf`, compressions), et ce qui reste ignoré en connaissance de cause. |
| [asset-store.md](asset-store.md) | Le store de ressources : périmètre, ce que l'API Sketchfab permet (relevé le 5 octobre 2026), le contrat commun des sources, l'attribution, le découpage (tâches #444 à #446). |
| [store-guide.md](store-guide.md) | Faire un store : les règles communes aux stores de modèles et de textures (fenêtre, cartes, vignettes recadrées, fiche, téléchargement, classement), comment ajouter une source, une liste de contrôle, avec des maquettes. |
| [gestes-3d.md](gestes-3d.md) | Les gestes 3D, relevés partout (store, fenêtres, Éditeur de modèle, éditeur de bâtiment, Cases, Scènes) : commandes, vitesses, pas et bornes ; points communs, incohérences, recommandations pour homogénéiser. |
| [lecteur.md](lecteur.md) | Le Lecteur d'un Tome ou d'un Chapitre : ce qu'il fait, ses options (une ou deux pages, sens, page blanche, défilement, vue guidée), où vit quoi, et ce que coûte un dessin hors écran. |
| [polices.md](polices.md) | Les polices : soixante-cinq intégrées (dont cinquante-cinq de DaFont, choisies par licence), et pourquoi complètes ; le gras et l'italique, vrais ou simulés ; la fenêtre des Polices ; l'import d'un fichier (ce qu'on y lit, l'index, les renommages qui ne réécrivent aucun Projet) (tâche #423). |
| [non-visible.md](non-visible.md) | « Non visible » : le rendu d'identifiants qui dit si un Élément est hors du cadre ou caché, ce qu'il ne voit pas exprès, le doute qui profite à la visibilité, et quand il a lieu (tâche #449). |

---

Chaque document existe en deux langues, **un dossier par langue** : `docs/en/nom.md` et
`docs/fr/nom.md`, même nom de base. La version française est celle dans laquelle les décisions ont
été prises ; les deux sont tenues d'accord, et `tests/docs.test.mjs` refuse un document sans sa
contrepartie, un lien mort, ou une section ajoutée d'un seul côté.

Le code et ses commentaires sont en anglais (voir [architecture.md](architecture.md#langue)).
