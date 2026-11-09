# Notes internes

*[English version](../en/README.md)*

Documentation de contributeur. Ce qui s'adresse à l'utilisateur est dans le
[README](../../README.fr.md) et dans le manuel intégré (`src/help-content.js`).

## Ce que contient ce dossier

Ces notes décrivent **comment le code fonctionne aujourd'hui**, pour qu'un développeur qui découvre
le projet puisse le comprendre, le modifier et le reprendre. Elles ne racontent pas comment on en est
arrivé là : ni dates, ni historique, ni essais abandonnés, ni comptes rendus de décision. Ce
« pourquoi » vit dans la documentation privée du mainteneur.

Une note se met à jour **dans le même commit** que le code qu'elle décrit.

### Gabarit d'une note

1. **Rôle** : ce que fait cette partie, en quelques lignes.
2. **Fichiers** : les modules, et ce que chacun porte.
3. **Données** : formats, champs enregistrés, unités.
4. **Déroulé** : qui appelle quoi, dans quel ordre.
5. **Étendre** : comment ajouter un cas (un type, une source, une option).
6. **Tester** : les tests qui couvrent cette partie, et ce qui se vérifie à l'écran.
7. **Pièges** : ce qu'il ne faut pas faire, une phrase chacun, avec sa conséquence.

Une section sans objet est omise.

## À lire avant de toucher au code

| Note | Sujet |
|---|---|
| [persisted-data.md](persisted-data.md) | Les données enregistrées : ce qui ne se renomme jamais, la relecture, les champs ajoutés. |
| [architecture.md](architecture.md) | Où va quoi, les canaux IPC, les imports circulaires, l'état partagé, la nomenclature. |
| [3d-rendering-single-sources.md](3d-rendering-single-sources.md) | Le rendu 3D : une seule source par calcul. |
| [imported-skeletons.md](imported-skeletons.md) | Les squelettes des modèles importés : conventions d'os, correspondances. |

## Méthode et procédures

| Note | Sujet |
|---|---|
| [testing-method.md](testing-method.md) | Écrire et organiser les tests, rendre testable, ce qui reste hors de portée. |
| [versioning.md](versioning.md) | Numéros de version, hooks git, tags, publication. |
| [updates.md](updates.md) | Les mises à jour intégrées : attestation signée, version obligatoire, publication. |
| [missing-resources.md](missing-resources.md) | Les ressources introuvables d'un Projet et la fenêtre qui les explique. |

## Interface

| Note | Sujet |
|---|---|
| [interface.md](interface.md) | Les règles d'interface : boutons, menus, Commandes, icônes, infobulles, modales, libellés. |
| [ui-scale-coordinates.md](ui-scale-coordinates.md) | Taille de l'interface : pixels d'écran et pixels zoomés. |
| [colour-accessibility.md](colour-accessibility.md) | Couleur qui dépeint, couleur qui signale, et les déficiences de la vision des couleurs. |
| [gestes-3d.md](gestes-3d.md) | Les gestes 3D de chaque écran : commandes, vitesses, pas, bornes. |
| [store-guide.md](store-guide.md) | Faire un store : fenêtre, cartes, fiche, téléchargement, ajout d'une source. |

## Pages, Cases et Bulles

| Note | Sujet |
|---|---|
| [formats.md](formats.md) | Les formats des Tomes. |
| [planche-importee.md](planche-importee.md) | Les Planches importées et leurs Cases détectées. |
| [panel-images.md](panel-images.md) | Une image dans une Case à la place d'une scène 3D. |
| [lecteur.md](lecteur.md) | Le Lecteur d'un Tome ou d'un Chapitre. |
| [bubble-styles.md](bubble-styles.md) | Les Bulles : formes, pointes, bordures, styles. |
| [polices.md](polices.md) | Les polices intégrées et importées, gras et italique, la fenêtre des Polices. |
| [non-visible.md](non-visible.md) | « Non visible » : savoir si un Élément est hors du cadre ou caché. |

## 3D : repères, rendu, lumière

| Note | Sujet |
|---|---|
| [3d-reference-frames.md](3d-reference-frames.md) | Constantes du monde, coordonnées canvas et monde, orientation, échelles. |
| [rendering-performance.md](rendering-performance.md) | Le coût du dessin et comment le mesurer. |
| [lighting.md](lighting.md) | L'éclairage d'une Case et d'une Scène. |
| [positioned-lights.md](positioned-lights.md) | Les sources de lumière posées dans une Scène. |
| [cast-shadows.md](cast-shadows.md) | Les ombres portées. |
| [ground-textures.md](ground-textures.md) | Les textures du Sol : échelles, densité, mémoire. |
| [imported-models-display.md](imported-models-display.md) | L'affichage des modèles importés : matières, lumières, formats. |

## Personnages et modèles

| Note | Sujet |
|---|---|
| [model-editor.md](model-editor.md) | L'Éditeur de modèle. |
| [pose-library.md](pose-library.md) | La bibliothèque de poses. |
| [creature-rigs.md](creature-rigs.md) | Les rigs non humanoïdes et leurs archétypes. |
| [archetype-roles.md](archetype-roles.md) | Les rôles de chaînes, par archétype. |
| [archetype-poses.md](archetype-poses.md) | Les poses par archétype. |
| [asset-store.md](asset-store.md) | Le store de ressources et ses sources. |

## Éditeurs

| Note | Sujet |
|---|---|
| [building-editor.md](building-editor.md) | L'Éditeur de bâtiment : format, niveaux, murs, pièces, ouvertures, escaliers, toits. |
| [terrain-editor.md](terrain-editor.md) | L'Éditeur de terrain : relief, Zones, eau, rivières. |

---

Chaque note existe en deux langues, **un dossier par langue** : `docs/en/nom.md` et `docs/fr/nom.md`,
même nom de base. Les deux sont tenues d'accord, et `tests/docs.test.mjs` refuse une note sans sa
contrepartie, un lien mort, ou une section ajoutée d'un seul côté. Pour la langue du code, voir
[architecture.md](architecture.md#langue).
