# Données enregistrées : ce qui ne se renomme jamais

*[English version](../en/persisted-data.md)*

> **La règle la plus importante du dépôt.** Une infraction ne casse ni la compilation ni un test, et
> ne se voit pas à l'écran : elle rend illisibles les fichiers déjà enregistrés chez les utilisateurs.

Un Projet est sérialisé en JSON par `serializeProject()` (`src/io.js`). Tout ce qui finit dans ce JSON
fait partie du **format de fichier** : ajouter est permis ; retirer ou renommer ne l'est pas. Les
mêmes règles valent pour les autres fichiers de l'application (bâtiments, correspondances de
squelette, réglages). `tests/persisted-format.test.mjs` confronte le code aux listes de cette note.

## 1. Les noms de champs

**Niveau projet** : `projectName`, `tomes`, `formats`, `scenes`, `currentTomeIndex`,
`currentPageIndex`, `poses`.

**Chapitres** (`src/chapitres.js`) : `chapitres` sur un Tome (`[{ id, nom }]`, dans l'ordre) et
`chapitreId` sur une Planche (absent : directement sous le Tome). `pages` reste la liste à plat dont
l'ordre fait la numérotation. À la lecture, les Planches d'un chapitre sont rendues contiguës, celles
sans chapitre en tête.

**Planches importées** (cf. [planche-importee.md](planche-importee.md)) : `importee` sur une Planche
(`{ largeur, hauteur }`, plus `imageAnchorX`, `imageAnchorY`, `imageZoom` pour le cadrage), et sur ses
Cases `regionImage` (`{ x, y, w, h }` en fractions de l'image), `imageFile`, et `pointsImage` (les
quatre coins, en fractions) pour une Case déformée. La place d'une Case (`x`, `y`, `w`, `h`, `pts`)
est recalculée à chaque dessin et reste écrite.

**Formats** (cf. [formats.md](formats.md)) : `formats` au niveau projet
(`[{ key, nom?, unite, largeur, hauteur, w, h, scale, mmW }]`). Chaque Tome garde sa clé `format` et
sa copie de `w`, `h`, `scale`. Un fichier sans `formats` reçoit les quatre formats intégrés ; un Tome
dont les dimensions ne correspondent à aucun format en reçoit un à ses dimensions.

**Fichiers de bâtiment** (cf. [building-editor.md](building-editor.md)) :
`<dossier de Projets>/Batiments/*.batiment.json`, un format à part, versionné (`version: 1`). Un champ
inconnu y est gardé à la lecture.

**Bâtiments placés** : un `objet3d` d'`objType: 'batiment'` qui embarque sa copie du bâtiment dans
`batiment`, et `batimentSource` (le fichier d'origine, informatif). Une version qui ignore ce type le
dessine comme un objet inconnu, sans perdre le champ.

**Éléments** : `pieceId`, `pieceLabel`, `altPieceId`, `pieceFloorType`, `objType`, `caseNumber`,
`batimentNames`, `batimentRotY`, `wallSide`, `modelFile`, `afficherMaillagesEgares`.

**Coordonnées monde** : `wxFloor`, `wyFloor`, `wzFloor`, `realHeightFloor`, `realLenFloor`.
`realHeightFloor` est la taille enregistrée ; le pourcentage du curseur « Taille réelle » n'est
stocké nulle part, il est recalculé à l'ouverture de la fiche (`getPersonaScalePercent`).

**Parois sur un support** : `wallYFrac`, `wallAlongFrac`, `magnetWallId`, `wallHeight`.

**Caméra d'une Case** : `camWx`, `camWy`, `camWz`, `camDist`, `camRotX`, `camRotY`.

**Textures et couleurs** : `groundType` (le Sol d'une Case ou d'une Scène), `terrainType` (une Zone de
terrain) et `traceTexture` (un Tracé ; absent : la texture de son type) valent soit un identifiant de
matière intégrée, soit `tex:<dossier>`, le dossier de la texture dans `Textures/`. `groundColor` et
`terrainColor` (`#rrggbb`) teintent la texture ; absents, couleur naturelle ; changer de texture les
retire. `marquage: false` sur une route retire la ligne blanche. Une texture introuvable fait
retomber le Sol sur la première matière et le Tracé sur sa texture d'origine, et l'identifiant est
gardé : la texture revient dès qu'elle est retéléchargée.

**Polices de Bulles** : `bulleFont`, `bulleGras`, `bulleItalique` (booléens, absents = faux). Une
police retirée de l'application reste écrite telle quelle ; à la lecture, `policeDeBulle`
(`src/constants.js`, table `POLICES_BULLES_RETIREES`) la dessine avec sa remplaçante. Le nom n'est
réécrit que si l'utilisateur choisit une autre police.

Certains noms sont en français, d'autres en anglais, quelques-uns maladroits (`batimentNames`) : un
nom de champ enregistré est un identifiant de format, pas de la nomenclature.

### `poses` : une copie des poses utilisées

La bibliothèque de poses appartient à l'**application** (`settings.json`, clé `poseLibrary`). Le
fichier projet ne porte qu'une **copie des poses qu'il utilise** (`[{ id, name, skeleton, joints }]`),
pour rester lisible sur une machine qui ne les a pas. À l'ouverture, ces poses sont fusionnées dans la
bibliothèque (ids inconnus seulement).

Les six poses de base sont semées au premier lancement avec leur clé comme `id` (`'assis'`,
`'debout'`…) ; `POSE_3D` sert de filet pour une pose de base supprimée. Aucun Personnage ne
**dépend** de `poses` : appliquer une pose copie ses angles dans `joints3d`. `normalizePoses3D`
(`io.js`) lit le champ avec tolérance (absent, nul ou malformé : liste vide).

### `modelFile` : un nom de fichier, pas un chemin

Un modèle importé est un `objet3d` d'`objType: 'modele'` dont `modelFile` est le **nom d'un fichier**
de `<dossier de Projets>/Modeles`, jamais un chemin absolu.
- **Le fichier peut manquer** : le modèle s'affiche en boîte de remplacement, l'Élément n'est jamais
  supprimé (cf. § 6).
- **Les modèles suivent les Projets** : ils sont dans le dossier choisi pour les Projets.
- **Renommer un modèle** réécrit `modelFile` dans tous les Éléments du Projet ouvert et dans sa pile
  d'annulation, et déplace sa correspondance de squelette. Les autres Projets sont mis à jour à leur
  ouverture : chaque renommage est noté dans `settings.json` (`modelRenames`), et
  `proposerRepointageModeles` propose la mise à jour si le fichier cité a disparu **et** que son
  successeur existe.

### Le fichier de correspondances de squelette

Rangé à côté du dossier `Modeles`, indexé par nom de fichier (`SKELETON_MAP_FORMAT = 1`). Une entrée :

| clé | qui l'écrit | forme |
|---|---|---|
| `os` | un humanoïde | `{ emplacement: nomDOs }`, liste fermée de dix-huit |
| `roles` | toute autre morphologie | `{ role: nomDOs }`, la liste venant de l'archétype |
| `membres` | les chaînes cochées ou renommées | `[{ racine, nom, retenu }]` |
| `morphologie` | le sélecteur | une clé d'`ARCHETYPES_3D` |
| `valide` | « j'ai vu cet écran » | booléen |
| `empreinte` | l'enregistrement | `"49-ebfba2f4"` : le nombre d'os puis un condensé |

- `empreinte` identifie **le squelette** dont parle l'entrée, pour qu'un autre fichier puisse demander
  « est-ce le même ? » sans décoder le `.glb`. Elle ne crée jamais une entrée à elle seule.
- `os` et `roles` peuvent être **stockés** ensemble ; un seul est **lu**, selon la morphologie. Écrire
  l'un n'efface jamais l'autre.
- `roles` vit à côté de `os` au lieu de l'élargir : une version qui filtre `os` sur ses dix-huit
  emplacements perdrait sinon les clés en silence.

### `skeletonPose3d` : emplacements et os

La pose d'un modèle importé est un dictionnaire `{ clé: {x, y, z} }` en radians. Une clé est :
- un **emplacement** humanoïde (`tete`, `avantbras_g`, `cuisse_d`), liste fermée de dix-huit ;
- ou un **os**, préfixé `os:` (`os:Bone_L_078`), le nom de l'os tel que three le voit.

Le préfixe empêche un os nommé `tete` d'écraser l'emplacement. Un humanoïde écrit des emplacements, une
créature des os ; une clé qui ne désigne rien reste inerte. Une clé d'os est relue **sans être
vérifiée** : le `.glb` n'est pas forcément décodé quand le Projet s'enregistre.

## 2. Les valeurs discriminantes

Les chaînes qui reconnaissent la nature d'un objet sont aussi figées que les noms de champs :

```
type      : 'perso' | 'objet3d' | 'panel' | 'tracé' | 'terrain' | 'bulle'
objType   : 'mur' | 'mur_coin' | 'dalle' | 'fenetre_ouverte' | 'porte_ouverte' | 'modele' | 'batiment' | …
tracéType : 'muret' | 'cloture' | 'haie' | 'barriere' | 'route' | 'chemin' | 'terrain' | 'riviere'
wallSide  : 'avant' | 'arriere'
état porte/fenêtre : 'gauche' | 'droite' | 'fermee'
```

`'tracé'` a son accent, `'cloture'`, `'barriere'` et `'fermee'` n'en ont pas : c'est ainsi dans les
fichiers.

## 3. Les ids DOM

Un id d'`index.html` lie le HTML au JS qui le cherche : un `getElementById(...)` qui rend `null` au
démarrage interrompt le chargement d'`events.js` entier, et plus aucun bouton ne répond. Un id peut
être renommé, mais **dans le même commit** dans `index.html`, dans tous les `getElementById` /
`querySelector` de `src/`, et dans les tables de sélecteurs de `src/i18n.js`.

## 4. Les classes CSS et les textes affichés

Une classe CSS lie `style.css` au JS qui la pose ou la teste : la renommer des deux côtés. Les
libellés visibles passent par `src/i18n.js` et le `tr(en, fr)` des modules, jamais en dur.

## 5. Si un renommage est vraiment nécessaire : une migration

`migratePanelWorldCoords` et `migrateElementWxFloor` (`src/io.js`) en sont les modèles :
1. le nouveau champ est écrit à la sauvegarde ;
2. au chargement, si l'ancien est présent et le nouveau absent, on convertit ;
3. l'ancien champ reste **lu** indéfiniment.

## 6. Un fichier illisible ne détruit pas celui qui est ouvert

`applyProjectData` valide la forme des données (`validateProjectShape`) **avant d'écrire quoi que ce
soit** dans `S`.
- **Refusé** : une valeur présente et du mauvais type là où le chargement itère (`tomes`, `scenes`,
  `pages`, `objects`). Le Projet ouvert reste intact, et sa sauvegarde automatique reprend.
- **Toléré** : absent, `null`, ou seulement absurde (un index hors bornes, un nom nul).
- **Jamais réparé en silence** : ramener une liste malformée à `[]` ouvrirait un Projet vide que la
  sauvegarde automatique écrirait par-dessus le vrai fichier.

`tests/persisted-format.test.mjs` vérifie aussi que le refus a lieu avant la première écriture.

## Pièges

- **`tracé` ne se traduit pas**, ni dans les données, ni dans les identifiants, ni en commentaire.
- **Toute clé d'une entrée de correspondances doit être nommée dans `normaliserFichier`** : la fonction
  reconstruit l'entrée clé par clé, et une clé oubliée disparaît à la première réécriture.
- **Ne pas incrémenter un numéro de format pour un ajout** (`SKELETON_MAP_FORMAT`,
  `VERSION_BATIMENT`) : une version antérieure rejetterait le fichier entier, alors qu'elle ignore une
  clé inconnue.
- **Ne jamais supprimer un Élément dont le fichier manque** : une absence passagère (disque non monté)
  deviendrait une perte définitive à la sauvegarde automatique suivante.
