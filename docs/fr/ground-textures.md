# Les textures du Sol

*[English version](../en/ground-textures.md)*

## Rôle

Le Sol d'une Case ou d'une Scène, ses Zones de terrain et ses Tracés portent des matières : des grains
photographiés, cuits à la construction, posés en tuiles, mélangés à plusieurs échelles et pavés pour
casser la répétition. L'eau et le ciel, eux, sont calculés.

## Fichiers

| Fichier | Ce qu'il porte |
|---|---|
| `src/constants.js` | `GROUND_TYPE_DEFS` (les matières, leur tuile et leur `repeat`), `echellesSansTrou3D`. |
| `src/textures-integrees.js`, `src/textures-utilisateur.js` | Les matières livrées et celles de « Mes textures ». |
| `src/ground-tiling-3d.js` | Le pavage anti-répétition (shader). |
| `src/ground-water-3d.js` | L'eau calculée (shader). |
| `src/sky-3d.js` | Le ciel calculé. |
| `src/scene3d.js` | La brume du lointain (`brumeDuLointain3D`, `distanceAuBordDuSol3D`). |
| `tools/bake-textures.mjs` | Le cuiseur des grains (`npm run bake-textures`). |

## Densité de texels

La densité se mesure en **px/m** (pixels de texture par mètre de surface ; une unité monde = 1 m). Ce
qui se voit n'est pas la densité, c'est son **incohérence** : toutes les matières photographiées sont
donc à la même densité, **256 px/m** (grain de 1024² sur une tuile de 4 m, `repeat` 3000). Seule
exception, notée `motifTailleReelle` : le carrelage, dont la dalle doit faire sa taille réelle (60 cm,
`repeat` 4700).

Les modèles 3D sont en aplats, sans texture : un Sol photographique ne peut pas avoir leur netteté à
toute distance.

## Trois échelles, et le pavage

- La même texture est échantillonnée à **trois échelles** éloignées, fondues ensemble : la grande porte
  ce qui se voit de loin, la petite le détail de près. `echellesSansTrou3D` vérifie que deux échelles
  voisines se touchent (le plus gros motif de l'une atteint le plus fin de la suivante).
- Une texture carrelable est uniforme à grande échelle par construction : c'est la **couche large** qui
  porte la variation lointaine.
- **Le pavage** (`ground-tiling-3d.js`) échantillonne dans des cellules d'une grille triangulaire, chacune
  décalée et tournée au hasard, et mêle trois échantillons par pixel. Il supprime la période de la tuile
  (le quadrillage visible au dézoom). L'échantillonnage passe par `textureGrad` avec les dérivées de la
  coordonnée d'origine (pas de couture de mipmap), et le mélange préserve le contraste.

## Cuire une matière

Le cuiseur lit, dans `assets/textures/sources/<matière>/` (hors dépôt), **trois cartes** :
- l'albédo (`Color`, `Diff`, `Albedo`, `BaseColor`) ;
- le relief : le déplacement (`Displacement`, `Disp`, `Height`) **ou** l'occlusion ambiante, jamais les
  deux ;
- la normale en convention **OpenGL** (`NormalGL`, `nor_gl`).

Un seul jeu par dossier ; `.jpg`, `.jpeg`, `.png` seulement (pas d'EXR). Une source 1K suffit. Les
grains du Sol sortent en 1024² (`TAILLE_GRAIN_SOL`), ceux des Bulles en 512² (`TAILLE_GRAIN`) ; les
décisions du cuiseur (normalisation du contraste, nature, couture, motif) se prennent sur la version
réduite à 512.

Le rapport de cuisson donne une ligne **`tuile`** : la part du contraste qui vit à l'échelle de la tuile,
celle qui survit à la distance. Elle doit tomber **entre 0,05 et 0,18** : en dessous, la matière se
moyenne en aplat de loin ; au-dessus, des taches reviennent. Elle ne se prédit pas : il faut cuire et la
lire.

## Mémoire graphique

Un grain se décode en mémoire graphique : 1024 × 1024 × 4 octets, plus un tiers pour les mipmaps. La
couche macro, en niveaux de gris, ne sert que d'occlusion. Une `DataTexture` naît en filtrage `Nearest`
sans mipmap, contrairement à une `CanvasTexture` : le préciser à la création.

## L'eau

Calculée par pixel (`ground-water-3d.js`) : couleur du bleu profond au turquoise de sous-surface sur les
crêtes, écume au sommet, reflet du ciel de la Case selon Fresnel. Les vagues sont des **normales**
(quatorze trains sinusoïdaux de 12 m à 12 cm, sur un plan légèrement déformé), pas de la géométrie. Une
vague plus courte que `EAU_PIXELS_MIN` pixels s'efface (mipmap analytique). Elles ne s'animent pas.

## Le ciel

Calculé dans les trois modes (`sky-3d.js`) : soleil et lune dans la direction exacte de la lumière de la
scène, nuages approchant le volume (Beer-Lambert, liseré face au soleil). Un détail plus petit que trois
pixels s'efface. L'horizon du ciel descend jusqu'au bord visible du Sol.

## Le lointain

Le plan lointain de la caméra est reculé au-delà du coin le plus lointain du Sol : il ne le coupe jamais.
Le Sol se fond dans la couleur de l'horizon du ciel avant son bord (`brumeDuLointain3D`), seulement
au-delà du contenu de la Case ; la brume est retirée après le rendu, comme le ciel.

## Pièges

- **Ne pas faire suivre la densité à la distance de la caméra** : la répétition glisserait à chaque cran
  de molette.
- **Ne pas mettre d'occlusion et de déplacement dans le même dossier** : le cuiseur refuse.
- **Normale DirectX** : elle inverserait le relief ; seule la GL est lue.
