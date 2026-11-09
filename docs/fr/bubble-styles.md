# Les Bulles

*[English version](../en/bubble-styles.md)*

## Rôle

Une Bulle est une combinaison **libre** d'axes graphiques, dont aucun n'implique les autres : la forme,
le trait, le remplissage, la queue, le texte, les particules. Toute forme se combine avec toute queue.
Les styles enregistrés sont des préréglages de ces axes, nommés par leur apparence (« Ovale à
couronne »), jamais par un registre (« Pensée »).

## Fichiers

Chaque axe a un module **pur** (décision, testée sous Node) ; le dessin est dans `src/draw.js`
(`drawBubble`, chemin commun à l'écran et à l'export).

| Fichier | Ce qu'il porte |
|---|---|
| `src/bubble-shape.js` | Le registre des formes et leur contrat (contour, zone du texte, queue par défaut). |
| `src/bubble-tail.js` | Le registre des queues : triangle, éclair, cheveu, ronds, aucune. |
| `src/bubble-style.js` | Le remplissage (opacité) et le trait (motif, régularité, tremblé). |
| `src/bubble-texture.js` | Les textures de remplissage : piles de couches, grains. |
| `src/bubble-grain.js` | La moitié impure des textures : chargement des grains, motifs de canevas. |
| `src/bubble-particle.js` | Les particules semées autour du bord (tache, flamme). |
| `src/bubble-merge.js` | La fusion de Bulles en une Bulle à plusieurs lobes. |
| `src/bubble-library.js` | La bibliothèque de styles. |
| `src/cyclic-noise.js` | Le bruit cyclique partagé (trait tremblé, silhouette de la tache), à graine stable. |

## Les axes et leurs valeurs

| Axe | Champ | Valeurs (clés enregistrées) |
|---|---|---|
| Forme | `bulleShape` | `ovale` (défaut), `facette`, `rect` (rectangle **arrondi**), `rectnet` (angles vifs), `octogone`, `etoile`, `ecu`, `tache` |
| Queue | `tailShape`, `tailVisible`, `tailMirror`, `tailAngle`, `tailLen` | `triangle` (défaut), `eclair`, `cheveu`, `ronds`, `aucune` |
| Trait | `bulleBorderVisible`, `bulleBorderWidth`, `bulleBorderColor`, `bulleBorderDash`, `bulleBorderRegularity` | motif `plein`, `pointille`, `tirets`, `epine` ; régularité `net`, `tremble` |
| Remplissage | `bulleColor`, `bulleFillOpacity`, `bulleTexture` | texture `aucune` (défaut), `papier`, `glace`, `lave`, `nuit-etoile` |
| Particules | `bulleParticule` | `aucune` (défaut), `tache`, `flamme` |
| Texte | `bulleFont`, `bulleFontScale`, `bulleGras`, `bulleItalique`, `bulleTextColor`, `bulleTextOutlineColor`, `bulleTextOutlineScale`, `bullePadding` | cf. [polices.md](polices.md) |
| Fusion | `bulleFusionnable`, `bulleGroupe`, `bulleAvantFusion` | |

**Défauts et compatibilité** : un champ absent prend sa valeur par défaut (une Bulle sans
`bulleShape` est un ovale). `bulleFillOpacity` à `0` vaut 0 (fond invisible), seul `null` vaut 1.

**Clés retirées, qui migrent** : `ALIAS_FORME` (`dents` et `epines` → `etoile`, `bande` → `rect`) et
`ALIAS_TEXTURE` (`fondus` → `nuit-etoile`). Une clé **inconnue** lève une erreur au lieu de retomber
en silence sur le défaut.

## Le contrat d'une forme

Une forme fournit, dans le registre de `bubble-shape.js` :

| Fonction | Ce qu'elle rend | Qui s'en sert |
|---|---|---|
| `pointDuContour(o, theta)` | le point du contour dans la direction `theta` | l'ancrage de la queue, le glisser de sa pointe |
| `pointsDuContour(o)` | les points du contour, ou `null` si la forme est lisse | le tracé continu qui saute l'arc sous la queue |
| `encartInterieur(o)` | la zone où le texte s'inscrit | la mise en page du texte et `bullePadding` |
| `queueParDefaut(o)` | si une Bulle de cette forme naît avec une queue | la création ; `tailVisible`, dès qu'il existe, l'emporte |

Les contours courbes (écu, tache) sont **échantillonnés** en points rapprochés : l'intersection d'un
rayon avec eux est exacte. La tache a un contour **par Bulle**, tiré de son identifiant
(`cyclic-noise.js`) : il est le même à l'écran et à l'export. Sa zone de texte est calculée sur ce
contour-ci, pas une fraction fixe.

L'ovale garde la boîte entière comme zone de texte : le texte peut légèrement dépasser la courbe près
des coins.

## Les queues

`bubble-tail.js` décrit chaque queue par rapport au contour de la forme, sans dépendre d'elle. Le
cheveu peut s'inverser (`tailMirror`, `queuePeutSInverser3D`). Les ronds sont une chaîne de trois
cercles décroissants (`RONDS_*`).

## Textures et particules

- **Une texture** est une pile de couches, tracées dans le chemin de la Bulle rentré vers son centre,
  plus un **grain** (une image photographiée, teintée) chargé par `bubble-grain.js`. Une texture peut
  **imposer** sa couleur (la fiche masque alors le sélecteur) ou seulement la **suggérer**.
- **Les particules** sont une nuée répartie autour du bord, pas un motif du trait : elles se cumulent
  avec n'importe quel trait (tremblé et moucheté, par exemple).

## La fusion

Deux Bulles **fusionnables** qui se touchent (`bullesEnContact3D`) peuvent n'en faire qu'une : un
contour unique, et autant de zones de texte que de **lobes**. Un groupe porte N lobes. La Bulle
**sélectionnée** impose son apparence aux autres ; `CHAMPS_PROPRES_AU_LOBE` liste ce qui reste propre à
chaque lobe (place, texte, groupe). « Séparer les bulles » rend à chaque lobe son état d'avant
(`bulleAvantFusion`).

## Les styles enregistrés

- Un style est tout ce que porte une Bulle, **sauf** `CHAMPS_HORS_STYLE` (les champs propres au lobe,
  `tailAngle`, `tailLen`) : la liste exclut au lieu d'énumérer, si bien qu'un axe ajouté entre dans
  les styles sans rien changer ici.
- La bibliothèque est un réglage de l'**application** (`settings.json`, clé `bulleStyles`), partagée
  entre Projets, hors de `S` et de l'annulation.
- Une Bulle garde une **copie** des valeurs, jamais une référence : modifier un style ne repeint pas les
  planches déjà faites. `styleCorrespondant3D` dit si une Bulle suit encore un style.

## Dessin et empilement

- Une Bulle n'est **jamais découpée** par sa Case : elle peut déborder sur le blanc inter-cases.
- Les Bulles sont dessinées dans une passe à part, **devant toutes les Cases**, quel que soit l'ordre
  des objets.
- L'export a la taille de la Planche : ce qui sort de la Planche est coupé.

## Étendre

- **Une forme** : une clé (jamais réutiliser une clé existante), une entrée dans `REGISTRE` avec ses
  quatre fonctions, son libellé et son icône ; les tests croisent toutes les formes avec toutes les
  queues.
- **Une texture, une particule** : une entrée dans leur registre ; une clé retirée va dans la table
  d'alias.

## Tester

`tests/bubble-*.test.mjs`, `tests/apercu-bulle.test.mjs`, `tests/bulle-gras-italique.test.mjs`. Ce que
les tests ne voient pas (un texte qui sort de sa forme, une forme qui ne ressemble pas à ce qu'elle
doit être) se vérifie en **rendant les Bulles en image** et en les regardant.

## Pièges

- **`rect` est le rectangle arrondi**, `rectnet` l'angle vif : la clé `rect` ne change plus de sens.
- **Écrire `tailVisible != null`**, pas `!== false` : un « oui » explicite doit l'emporter sur le défaut
  de la forme.
- **Ne pas mettre de `clip()` sur le dessin des Bulles**, et ne pas fondre leur passe dans la boucle
  des objets.
- **Une graine instable** ferait changer la tache de forme à chaque rendu.
