# L'Éditeur de bâtiment

*[English version](../en/building-editor.md)*

## Rôle

L'Éditeur de bâtiment construit un bâtiment en vue de dessus, niveau par niveau : murs, ouvertures,
pièces, escaliers, toits, revêtements et mobilier fixe, avec un aperçu 3D. Un bâtiment est un
**Modèle** : il s'enregistre dans la bibliothèque (`<dossier de Projets>/Batiments/`) et se place
dans une Case ou une Scène, où il devient une **copie indépendante** embarquée dans l'Élément.

On ouvre l'éditeur par le bouton du bandeau, par « Créer un bâtiment » au clic droit d'une Scène, ou
par « Modifier » sur un bâtiment placé (on retouche alors sa copie). C'est un écran central unique,
comme le Lecteur : l'ouvrir ferme l'Éditeur de modèle et le Lecteur.

## Fichiers

Tout ce qui décide est **pur** (sans DOM ni three) et testé sous Node ; l'écran et le rendu ne font
que dessiner et relayer les gestes.

| Fichier | Ce qu'il porte |
|---|---|
| `src/batiment.js` | Le format : créer, relire (`normaliserBatiment`), écrire, nommer les fichiers. |
| `src/batiment-niveaux.js` | Les niveaux : étages, sous-sols, élévations déduites, duplication. |
| `src/batiment-trace.js` | Le tracé des murs : aimantation, jonctions en T, rectangles, déplacement de sommets. |
| `src/batiment-geometrie.js` | La forme des murs jonctions comprises (onglets), et leur découpe aux ouvertures. |
| `src/batiment-pieces.js` | Les pièces, déduites des murs (faces du graphe), îlots, cours. |
| `src/batiment-ouvertures.js` | Portes, fenêtres, baies, passages : placement et retouches. |
| `src/batiment-escaliers.js` | Escaliers droits, en L, en U : marches, trémie, validité, aimantation. |
| `src/batiment-toits.js` | Les toits par niveau : forme couverte, pans, bordures. |
| `src/batiment-squelette.js` | Le squelette droit pondéré, pour les toits des formes en L, T, U. |
| `src/batiment-cours.js` | Une cour (pièce devenue vide) prolongée aux étages du dessus. |
| `src/batiment-revetements.js` | Les revêtements (texture, couleur) des murs, sols, plafonds et façade. |
| `src/batiment-mobilier.js` | Les meubles fixes posés dans l'éditeur. |
| `src/batiment-plan.js` | La vue de dessus : repère, grille, zoom, cadrage. |
| `src/batiment-3d.js` | Le constructeur 3D, partagé par l'aperçu, les vignettes et les Cases. |
| `src/batiment-element.js` | Le bâtiment placé : l'Élément, son encombrement, ses masques et sa coupe. |
| `src/batiment-murs-devant.js` | Les murs entre la caméra et l'intérieur, masqués à la demande. |
| `src/batiment-pose-ui.js` | « Poser dans ce bâtiment » depuis la fiche d'un Personnage ou d'un Objet. |
| `src/batiment-store.js`, `src/batiment-bibliotheque.js`, `src/batiment-vignettes.js` | La bibliothèque : lire, écrire, renommer, lister avec les modèles, vignettes. |
| `src/batiment-icones.js` | Les pictogrammes SVG des réglages. |
| `src/batiment-editeur-ui.js` | L'écran : vue de dessus, aperçu 3D, menu, outils, annulation. |
| `electron/main.js` (`batiments:*`) | Les entrées-sorties disque, dans `Batiments/`. |

## Données

**Unités et repère** : des **mètres**, dans le repère du bâtiment (x vers la droite, z vers le bas en
vue de dessus, y vers le haut en 3D, origine libre). C'est l'Élément placé qui convertit vers la Scène.

**Le fichier** `*.batiment.json` (`VERSION_BATIMENT = 1`) :

```
{ version, nom,
  niveaux:    [{ id, nom, elevation, hauteur, dalle, toit? }]
  murs:       [{ id, niveauId, a:{x,z}, b:{x,z}, epaisseur, hauteurPropre?, revetement? }]
  ouvertures: [{ id, murId, type, le, y, largeur, hauteur, battants, coulissant, vitre, sens,
                 charniere, dessus }]
  escaliers:  [{ id, niveauId, type, depart:{x,z}, angle, largeur, sens, contremarches, rampe }]
  pieces:     [{ id, niveauId, nom, repere, vide?, murs?, sol?, plafond? }]
  elements:   [{ id, niveauId, modelFile, nom, x, z, rotY, echelle, dims, base, colle?, y? }]
  facade?, toit }
```

- **Niveaux** : `elevation` est le dessus du plancher, `hauteur` la hauteur sous plafond, `dalle`
  l'épaisseur du plancher, sous l'élévation. Les élévations se **déduisent** (`recalerNiveaux`) ; le
  rez-de-chaussée reste à 0, les sous-sols ont une élévation négative.
- **Murs** : un mur par niveau ; deux murs ne se touchent que par leurs bouts.
- **Ouvertures** : rattachées à un mur ; `le` est la fraction de la longueur du mur où tombe leur
  centre, `y` la hauteur d'allège. Types : `porte`, `fenetre`, `baie`, `passage`.
- **Pièces** : seuls le nom, le `repere` (un point intérieur) et les revêtements sont gardés ; la forme
  se recalcule. `vide: true` fait une cour.
- **Toits** : un par niveau (`niveau.toit`, absent = plat) : `{ type, pente, debord, sens, bordure,
  revetement }`. Le champ `toit` au niveau du bâtiment est relu et gardé, mais n'est pas dessiné.
- **Revêtements** : `{ texture: 'int:<id>' | 'tex:<dossier>' | null, couleur: '#rrggbb' | null }`.

Une valeur illisible prend sa valeur par défaut, un mur illisible est écarté, un champ inconnu est
gardé tel quel. Les règles communes aux fichiers sont dans [persisted-data.md](persisted-data.md).

**Le bâtiment placé** : un Élément `type: 'objet3d'`, `objType: 'batiment'`, qui embarque le bâtiment
entier dans `batiment`, et `batimentSource` (le fichier d'origine, informatif). Ses réglages
d'affichage (niveau de coupe, éléments masqués, murs de devant) sont dans `affichage`.

## Déroulé

1. **Tracer** : l'écran convertit le pointeur en mètres (`batiment-plan.js`), `aimanter` propose le
   point retenu (sommets, guides, angle par pas de 15°, longueur au centimètre ; Alt coupe tout), puis
   `ajouterMur` l'insère. Un mur qui finit au milieu d'un autre le coupe en deux (`couperMur`) ; un mur
   qui en croise un autre est refusé (`croiseUnMur`).
2. **Pièces** : après chaque modification, `actualiserPieces` parcourt les faces fermées du réseau des
   axes et réattribue noms et revêtements par le `repere`.
3. **Toute modification** passe par `modifier(b => …)` dans l'écran : une étape d'annulation (200 au
   plus), puis actualisation des pièces, redessin de la vue de dessus et de l'aperçu.
4. **3D** : `construireBatiment3D` extrude les polygones de `polygonesDesMurs`, les tranche aux
   ouvertures, pose sols, menuiseries, escaliers, toits et meubles. Le même constructeur sert à
   l'aperçu, aux vignettes et aux Cases.
5. **Enregistrer** : `ecrireBatiment` puis le pont `batiments:write`. **Placer** :
   `creerElementBatiment` copie le bâtiment dans un nouvel Élément.

## Étendre

- **Un type d'ouverture** : l'ajouter à `TYPES_D_OUVERTURE` et `DEFAUTS_OUVERTURE` (`batiment.js`),
  son dessin dans `batiment-3d.js` et la vue de dessus, son icône dans `batiment-icones.js`.
- **Un type de toit** : `TYPES_TOIT` et `geometrieDuToit` (`batiment-toits.js`), puis l'icône.
- **Un champ** : l'ajouter, ne jamais en renommer un ; le relire dans `normaliserBatiment` avec une
  valeur par défaut.

## Tester

`tests/batiment*.test.mjs` couvrent le format, le tracé, les pièces, les ouvertures, les niveaux et
sous-sols, les escaliers, les toits, les cours, les revêtements, le mobilier, les murs de devant, la
pose et la bibliothèque. À l'écran : tracer un rectangle et une cloison, vérifier les deux pièces,
poser une porte, ajouter un étage et un escalier, changer le toit, enregistrer, placer dans une Scène.

## Pièges

- **Ne pas faire toucher deux murs ailleurs qu'à leurs bouts** : les pièces ne se déduisent plus.
  Passer par `ajouterMur`, qui coupe le mur touché.
- **Ne pas régler une élévation à la main** : elle est écrasée par `recalerNiveaux`.
- **Ne pas dessiner un bâtiment avec un autre constructeur que `construireBatiment3D`** : le bâtiment
  placé ne serait plus celui de l'aperçu.
- **Ne pas lier un bâtiment placé à son fichier** : c'est une copie, retoucher le fichier ne doit pas
  le changer.
- **Ne pas créer un renderer par vignette** : les contextes WebGL s'épuisent ; `batiment-vignettes.js`
  en garde un seul.
