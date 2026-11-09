# L'Éditeur de modèle

*[English version](../en/model-editor.md)*

## Rôle

L'Éditeur de modèle pose un seul Personnage, Animal ou modèle importé articulé : réglage fin des
articulations par curseurs et par poignées sur le canevas, et bibliothèque de poses. Il occupe la zone
centrale ; l'en-tête et le menu de gauche restent utilisables, et naviguer ailleurs le quitte
(`clicQuitteLEditeur3D`).

## Les deux entrées

- **Autonome** (bouton du bandeau) : un modèle de la bibliothèque, sans cible. On y enregistre des
  poses ; le bouton « Appliquer » est **absent**.
- **Depuis la fiche** d'un Personnage, d'un Animal ou d'un modèle importé (section Modèle 3D) :
  l'Élément avec ses réglages. « Appliquer » écrit dans le **brouillon** de la fiche
  (`S.modalDraftJoints`), ferme l'éditeur et rend la main à la fiche ; c'est l'enregistrement de la
  fiche (`descModalSave`) qui modifie l'Élément. Quitter sans appliquer ne change rien.

## Fichiers

| Fichier | Ce qu'il porte |
|---|---|
| `src/persona-editor.js` | L'éditeur : ouverture, brouillon, caméra, curseurs, poignées, poses, câblage (`wirePersonaEditor`). |
| `src/utils.js` | Les décisions pures : poses (`makePose3D`, `renamePose3D`, `deletePose3D`), curseurs (`poseSliderSpecs3D`), gestes d'articulation (`straightDragDegrees3D`, `accumulateSweepDegrees3D`). |
| `src/rig3d.js` | Les rigs, `getEffectiveJoints`, `cloneJoints`, les groupes de curseurs d'un modèle importé. |
| `src/skeleton-pose.js`, `src/pose-bridge.js`, `src/skeleton-retarget.js` | La pose d'un modèle importé (os, rôles, report d'une pose humanoïde). |
| `src/scene3d.js` | `renderModelForEditor3D`, le rendu par le renderer partagé. |

## Le brouillon

Tout opère sur un brouillon (`S.personaEditorDraft`), jamais sur l'Élément. Les valeurs font foi :
`getEffectiveJoints(o)` rend `o.joints3d`, sinon la pose de base nommée par `o.position`. Appliquer une
pose **copie ses angles** dans `joints3d` ; `position` n'est qu'une référence d'affichage (la clé d'une
pose de base, ou l'id d'une pose enregistrée). La bibliothèque et l'étiquette (`positionLabel`) sont
décrites dans [pose-library.md](pose-library.md).

## Les gestes

Clic gauche maintenu dans le vide : tourner la vue ; clic droit maintenu : la déplacer ; molette :
zoomer. Sur une poignée, le clic gauche règle l'articulation : glisser droit quand l'axe se voit de
côté, geste circulaire quand il pointe vers l'œil. Valeurs dans [gestes-3d.md](gestes-3d.md). Le
cadrage d'ouverture a une seule définition, `resetPersonaEditorCamera`, appelée par
`openPersonaEditor`.

## Données d'une pose

`poses: [{ id, name, skeleton, joints }]` : `joints` est ce que produit `cloneJoints`, `skeleton` le
type de squelette (humain, type d'animal), pour ne jamais appliquer une pose à un squelette qui n'est
pas le sien. Une pose ne contient que des articulations (ni émotion ni mains). `lieFlat` (allongé) vit
dans les valeurs d'articulations.

## Pièges

- **Ne jamais écrire « inconnue » dans `position`** : l'étiquette se calcule à l'affichage ; garder
  l'id permet au Projet de se réparer dès qu'il retrouve sa bibliothèque.
- **Un `<select>` vide sa valeur** si elle est absente de ses options : une pose inconnue reçoit une
  option synthétique, sinon la sauvegarde écrirait `''`.
- **`POSE_3D` est complété à l'exécution** par `draw.js` (`allonge`, `vaincu`) : ne jamais filtrer la
  liste des poses sur sa présence dans `POSE_3D`, et passer la table en paramètre.
- **`resyncIdCounter` (`io.js`) doit visiter `poses`** : sinon une pose neuve pourrait reprendre l'id
  d'une autre.
- **L'éditeur recouvre l'application** : les écouteurs clavier de `window` tournent derrière lui. Un
  nouvel écran par-dessus doit être ajouté aux gardes d'`io.js` (Échap ouvrirait sinon le menu Projet).
