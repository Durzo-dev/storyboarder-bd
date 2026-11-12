# Performance du dessin

*[English version](../en/rendering-performance.md)*

## Rôle

Comment une Planche se dessine, ce qui évite de refaire le travail, ce que coûtent les postes connus, et
comment mesurer avant de corriger. Les campagnes de mesure détaillées sont dans la documentation privée
du mainteneur.

## Le chemin du dessin

- **`scheduleDrawCurrentPage`** (`src/draw.js`) regroupe les demandes de redessin en une seule image ;
  les chemins chauds (glisser, molette) passent par lui, ce que `tests/events.test.mjs` vérifie.
- **`drawCurrentPage`** dessine la Planche affichée ; l'export passe par le même `drawContent`.
- **Le rendu 3D d'une Case** (`renderPanelScene3D`) est l'essentiel du coût. Une Case garde son image
  tant que sa **signature** (`computePanelSceneSignature3D` : Éléments, caméra, éclairage, Sol…) ne
  change pas. La signature est calculée à chaque appel ; un réglage qui n'y entre pas ne redessine rien.
- **Le renderer est unique et hors écran**, plafonné à `PANEL_SCENE_RENDER_MAX_PX` (1400 px) : chaque
  consommateur le redimensionne, rend, puis recopie dans un canevas 2D.

## Le cache des images de Case

Les images rendues sont gardées dans une liste de récence, sous un **plafond en octets** (« Planches en
mémoire » dans la Configuration, `PLAFOND_CACHE_MO_DEFAUT` = 300 Mo, jusqu'à `PLAFOND_CACHE_MO_MAX` =
900 Mo). Un plafond en octets plutôt qu'en nombre de Planches, parce qu'une Planche coûte de 36 à 67 Mo
selon sa charge, environ le triple à la plus grande taille d'interface. La Planche affichée n'est
jamais évincée : 0 garde seulement celle-là.

## Ordres de grandeur

| Poste | Coût |
|---|---|
| `drawCurrentPage` sur une Planche chargée (8 Cases) | médiane ~8 ms, p95 ~14 ms par image |
| Rendu d'une Case | médiane ~13 ms ; au pire quelques centaines de ms (première image, rigs construits) |
| Une image de Case, même 6000×4000 | négligeable au dessin ; ~92 Mo de mémoire décodée |
| Une source de lumière posée, par image | négligeable ; ~30 ms à la première rencontre d'un nombre de lumières |
| Ombre du soleil | ~1 ms par image ; la résolution (1024 à 4096) ne change presque pas le temps |
| Huit sources qui projettent | ~3,9 ms par image ; une compilation à la première rencontre |

Les compilations GLSL sont payées **une fois par configuration et par session** : le nombre de lumières
et d'ombres entre dans la clé du programme. Déplacer ou recolorer ne recompile rien.

## Beaucoup de bâtiments (un lieu réel)

- **Un bâtiment placé est regroupé par matière** (`mergeByMaterial3D`, merge-meshes-3d.js, appelé par
  `buildPropRig3D`) : ses maillages simples deviennent un maillage par matière, dans le repère du
  bâtiment ; un bâtiment coûte quelques appels de dessin au lieu d'environ 300. Mêmes triangles, matières
  et boîte. Gardés à part : maillages articulés, instanciés ou multi-matières, maillages ou ancêtres
  porteurs de userData (masque du Sol, mobilier), un ordre de rendu, une couche, un ancêtre masqué. Un
  bâtiment coupé à un niveau, avec des parties masquées ou ses murs de devant retirés reste en morceaux
  (ces réglages le reconstruisent souvent). Les groupes vides sont retirés.
- **La menuiserie partage une boîte unité** (`boiteUnite`, batiment-3d.js), mise à l'échelle de chaque
  pièce : une géométrie de boîte neuve par montant, vitre et appui coûtait un tiers de la construction d'un
  bâtiment.
- **Le relief effectif est gardé d'une image à l'autre** (`reliefEffectif3D`, voir terrain-editor.md).
- Mesuré sur l'Écusson de Montpellier (300 bâtiments, avant les deux) : 78 000 appels de dessin et
  1,6 M de triangles par image ; 1,6 à 2,3 s par image en bougeant la caméra, 11,9 s à l'ouverture.
  Après : 1 723 appels de dessin, environ 21 ms par image, 2,8 s à l'ouverture (dont 2,2 s de construction
  des bâtiments).

## Mesurer

**La sonde de l'application** (`src/perf-probe.js`), dans la console (F12) : `sonde.demarrer()`,
reproduire le ralentissement, `sonde.rapport()` (un tableau, et une synthèse d'une ligne en tête),
`sonde.arreter()`. Elle :
- est éteinte par défaut (un test de booléen par appel) ;
- **agrège sans journaliser** : un `console.log` par image coûte plus que ce qu'on mesure ;
- tient les **comptes et totaux exacts** à part de l'échantillon borné qui sert aux quantiles ;
- relève les images lentes (plus de `IMAGE_LENTE_MS`, 50 ms) et compte les **programmes de shader
  neufs** (une compilation coûte des dizaines de millisecondes d'un coup) ;
- dit pourquoi un rapport est vide (« jamais démarrée » n'est pas « rien à signaler »).

Rapporter la **médiane** à côté de la moyenne : la première image construit tous les rigs. Un nouveau
poste se mesure avec `sondeDebut()` / `sondeFin(nom, t0)`.

**Une sonde WebGL** (coût GPU), dans un vrai navigateur :
- une cible de rendu **hors écran**, jamais le tampon d'affichage ;
- `readPixels` après chaque rendu (`gl.finish()` ne synchronise rien sous ANGLE) ;
- un `define` unique par essai, sinon le cache de programmes de Chromium répond à la place du GPU ;
- des matériaux gardés en vie entre les essais ;
- **un témoin qui doit bouger** (une charge connue), vérifié avant de croire un chiffre ; et, pour un
  effet visuel, compter les **pixels changés** : un travail qui coûte peut ne rien produire.

## Pièges

- **Ne pas optimiser sur une lecture du code** : mesurer d'abord.
- **Ne pas réduire les images à l'import** : le dessin ne coûte rien, et le zoom du recadrage
  deviendrait flou.
- **Ne pas fixer le cache en nombre de Planches** : le bon nombre dépend de la machine et de l'écran.
