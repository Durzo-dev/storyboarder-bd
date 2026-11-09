# Image dans une Case

*[English version](../en/panel-images.md)*

## Rôle

Une Case porte **soit une image, soit de la 3D, jamais les deux** : un croquis scanné, une référence
photographique, une case dessinée à la main. L'image couvre la Case en gardant ses proportions, et se
recadre (déplacement, zoom).

## Fichiers

| Fichier | Ce qu'il porte |
|---|---|
| `src/image-store.js` | Les décisions : nommage, collisions, `casePorteUneImage3D`, champs du cadrage. |
| `src/image-library.js` | La section Images du menu de gauche : usages, renommage, suppression du disque. |
| `src/draw.js` | Le dessin dans `drawContent` (écran et export), `ancrageApresGlissement3D` (recadrage). |
| `src/events.js`, `src/sidebar.js` | Menus contextuels, mode de recadrage, molette, sections Image et Cadrage. |
| `electron/main.js` (`images:*`) | Les entrées-sorties, dans `<dossier de Projets>/Images`. |

## Données

Sur la Case, des champs ajoutés :
- `imageFile` : le **nom** du fichier dans `<dossier de Projets>/Images`, jamais un chemin ;
- `imageAnchorX`, `imageAnchorY` : le cadrage, en **fraction** du jeu disponible (0 à 1, 0,5 = centré).
  Une fraction reste juste quand la Case ou l'image change de taille, et rester dans [0, 1] garantit
  qu'aucune bande vide n'apparaît ;
- `imageZoom` : de 1 (le cadrage couvrant) à 4.

Absents = centré, 1×. « Recentrer » **supprime** les trois champs : un Projet recentré est identique à
un Projet jamais recadré.

## Les règles

- **Exclusivité tenue en amont** : une Case qui contient des Éléments ne propose pas « Insérer une
  image » (on la vide d'abord) ; une Case à image n'accepte ni Élément, ni Scène chargée, ni modèle
  importé. Le menu contextuel retire « Ajouter », « Charger une Scène » et « Importer un Modèle ».
- **Interdit sur le canevas d'une Scène** (`isLockedScenePanel`) : une Scène est un décor 3D.
- **Le fichier est copié** dans le dossier `Images`, comme un modèle importé ; la Case n'en garde que
  le nom. Formats : PNG, JPG, WebP (`sanitizeImageName` garde l'extension d'origine, en minuscules).
- **Détacher n'efface pas** : « Retirer l'image » et « Vider la Case » détachent l'image sans
  confirmation (Ctrl+Z la rend, cadrage compris) ; le fichier reste. Supprimer du disque se fait dans
  la section Images, après confirmation.
- **Un fichier manquant ne vide pas la Case** : elle affiche « Image introuvable » et redevient normale
  si le fichier revient.
- **Les Bulles restent** : ce sont des objets de Planche, pas de la Case.
- **Le menu de droite** d'une Case à image perd Sol et Éléments, et gagne les sections **Image**
  (le fichier, changer, retirer) et **Cadrage** (zoom, recentrer).

## Le recadrage

- **Le mode « Déplacer l'image »** (clic droit ou section Cadrage) : tirer déplace l'image dans sa
  Case. On en sort par Échap, un clic hors de la Case, ou la disparition de son objet ; relâcher le
  bouton n'en sort pas. Le mode se voit (bordure pointillée, curseur main).
- **Clic droit maintenu** sur une Case à image sélectionnée : même glisser, sans mode. Au-delà de
  3 pixels de mouvement, le menu contextuel ne s'ouvre pas.
- **La molette** zoome si la Case est sélectionnée **et** sous le curseur ; elle partage pas, bornes et
  sens avec le curseur de zoom et la molette de la Caméra.
- **« Recentrer »** n'apparaît que si le cadrage a été touché.

L'arithmétique du glisser est une fonction pure, `ancrageApresGlissement3D`.

## La section Images

Jumelle de la section Modèles : deux groupes (« dans des Cases », « inutilisées » ; une image ne vit
jamais dans une Scène). Chaque endroit listé est cliquable et mène à sa Case. Renommer une image
réécrit `imageFile` dans le Projet **ouvert** seulement : il n'y a pas, comme pour les modèles, de
journal qui répare les autres Projets à leur ouverture.

## Coût

Dessiner une image ne coûte rien de mesurable, même très grande ; le coût réel est la mémoire de
l'image décodée (environ 92 Mo pour 6000×4000). Les images ne sont pas réduites à l'import. Détails dans
[rendering-performance.md](rendering-performance.md).

## Tester

`tests/image-store.test.mjs` et `tests/image-library.test.mjs`. À l'écran : insérer une image dans une
Case vide, recadrer (mode, clic droit maintenu, molette), recentrer, vider la Case puis Ctrl+Z,
supprimer le fichier du disque et vérifier « Image introuvable ».
