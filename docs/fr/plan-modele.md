# Un modèle appris pour lire les plans : étude (#456)

*[English version](../en/plan-modele.md)*

> **ABANDONNÉ le 8 novembre 2026 (décision de Durzo).** Essayé dans l'application, le résultat
> reste trop peu fiable sur de vrais plans : trop de corrections à la main pour que l'import vaille
> la peine. L'import de plan a donc été **entièrement retiré** du code : l'écran, le bouton, les
> modules, le modèle et sa dépendance. Ce document et [plan-sources.md](plan-sources.md) en gardent
> la trace, **pour y revenir si le modèle s'améliore**.

## Bilan, et comment y revenir

**Ce qui existait** (dernier état : commit `a7ed951`, version 1.16.28) :
- `src/plan-feuille.js` : le redressement d'une photo prise de biais ;
- `src/plan-murs.js` : la détection des murs par règles (poché, trait, bandes par direction) ;
- `src/plan-vecteurs.js` : les murs vectorisés, puis le bâtiment de l'éditeur ;
- `src/plan-ouvertures.js` : les trous, les arcs de porte, les vitrages, les raccords, et
  `ouverturesDesMasques` pour un modèle ;
- `src/plan-echelle.js` : les unités (dont toise et pied du roi), l'estimation et l'échelle en deux
  points ;
- `src/plan-modele.js` : le greffon du modèle (ONNX Runtime Web 1.22.0) ;
- `src/plan-import-ui.js` : l'écran d'import, ouvert par un bouton à gauche des outils de l'Éditeur
  de bâtiment ;
- leurs tests, et le modèle dans `assets/modeles/plans/` avec ses licences.

**Pour tout restaurer** :
`git checkout a7ed951 -- src/plan-echelle.js src/plan-feuille.js src/plan-import-ui.js src/plan-modele.js src/plan-murs.js src/plan-ouvertures.js src/plan-vecteurs.js tests/plan-echelle.test.mjs tests/plan-feuille.test.mjs tests/plan-modele.test.mjs tests/plan-murs.test.mjs tests/plan-ouvertures.test.mjs tests/plan-vecteurs.test.mjs assets/modeles`.
Il faut ensuite rebrancher à la main, d'après ce même commit :
- le bouton `#batimentImporterPlan`, `poserLePlan` et `importerUnPlan` (`src/batiment-editeur-ui.js`) ;
- la modale `#planImportModal` (`src/index.html`), ses styles (`src/style.css`) et ses libellés
  (`src/i18n.js`) ;
- `initImportDePlan` (`src/events.js`) et `tests/modal-stack.test.mjs` ;
- `npm install onnxruntime-web@1.22.0` et ses trois fichiers dans `build.files`.

Les bancs d'essai (`plans-test/`, hors git) restent sur le disque de Durzo.

**Où on en était** :
- sur le banc, le modèle a beaucoup amélioré les chiffres (voir « L'intégration ») ;
- sur les vrais plans, c'est encore loin d'un résultat qu'on n'aurait pas à reprendre ;
- l'échelle restait estimée, à environ 30 % près ;
- les plans anciens et le PDF n'étaient pas commencés.

**Ce qui justifierait d'y revenir** :
- une nouvelle version de Floorplan Studio (la v0.1.0 date du 1er novembre 2026 ; sur GitHub,
  **Watch → Custom → Releases** prévient de chaque sortie) ;
- un autre modèle, de préférence à licence plus ouverte (voir « Autres modèles ») ;
- ou l'entraînement de notre propre modèle (voir l'estimation plus bas).

Dans tous les cas, on le note d'abord sur le banc CubiCasa (`modele_banc.sh test`), puis sur les
plans de Durzo, avant de rebrancher l'écran.

> Demandée par Durzo le 8 novembre 2026, après la notation de nos règles sur CubiCasa5K : les
> règles écrites à la main plafonnaient (portes et fenêtres autour de 20 %). Question posée :
> faut-il un modèle appris (apprentissage automatique), à quel prix, sous quelle licence ? Contrainte
> de Durzo : Storyboarder n'est pas fait pour être vendu, mais le modèle doit pouvoir être
> **débranché et retiré facilement** si cela changeait.

## En bref

- **Pas besoin d'entraîner nous-mêmes.** Un modèle déjà entraîné existe et convient. Il s'agit de
  *Floorplan Studio* : un SegFormer-B0 de 3,7 millions de paramètres, entraîné sur les **vraies
  images** de CubiCasa5K, dans un fichier ONNX de 15 Mo prévu pour tourner dans un navigateur.
- **Il fait beaucoup mieux que nos règles.** Mesuré sur 60 plans de la partie « test » officielle de
  CubiCasa5K, que le modèle n'a jamais vus :

| Mesure | Nos règles | Le modèle |
|---|---|---|
| Murs, F1 (précision, rappel) | 0,617 (0,70, 0,64) | **0,805** (0,90, 0,73) |
| Portes retrouvées / justes | 23,5 % / 23,5 % | **80 % / 73 %** |
| Fenêtres retrouvées / justes | 19 % / 16 % | **73 % / 77 %** |
| Temps de calcul, processeur, un fil | environ 1 s | **0,2 s** |

- **Il tient sur nos plans** : maison, bureaux (mur courbe et façade en biais compris), immeuble,
  annonces en couleur, photo redressée. Sur les châteaux anciens, il est passable.
- **Licence** : le code du projet est sous MIT. Les **poids** restent sous les restrictions **non
  commerciales** de CubiCasa5K (CC BY-NC 4.0) et du modèle de départ de NVIDIA (SegFormer). C'est
  compatible avec un Storyboarder non vendu, à condition de pouvoir tout retirer : c'est
  l'architecture proposée plus bas.
- **Coût** dans l'application : environ 15 Mo pour le modèle, plus environ 10 Mo pour le moteur
  d'exécution (ONNX Runtime Web, MIT).

## Ce qui a été examiné

**Les modèles existants**

| Projet | Ce que c'est | Pourquoi oui ou non |
|---|---|---|
| [Floorplan Studio](https://github.com/ajayfjfj/floorplan-studio) | SegFormer-B0, 5 classes (fond, pièce, mur, porte, fenêtre), ONNX, 15 Mo | **Retenu.** Entraîné sur les images réelles, évalué sur 400 plans jamais vus, déjà prévu pour le navigateur. |
| [floorplan-to-3d](https://huggingface.co/Yytsi/floorplan-to-3d-walls) | U-Net ResNet-34, 98 Mo, MIT | **Écarté.** Entraîné sur les annotations RENDUES en image (les murs y sont déjà tracés), et non sur les images : son score de 0,98 ne dit rien des vrais plans. |
| CubiCasa5K, DeepFloorplan, Raster-to-Vector | Modèles de recherche (2017-2019) | Plus lourds, PyTorch ou TensorFlow, sans export prêt pour le navigateur. |

**Les jeux de données**, si l'on devait un jour entraîner le nôtre. Aucun n'est clairement
utilisable commercialement :
- CubiCasa5K : CC BY-NC 4.0 ;
- FloorPlanCAD : CC BY-NC 4.0 ;
- ResPlan : licence contradictoire selon la source ;
- RPLAN, ZInD : non vérifiés.

Un modèle « commercial » demanderait donc d'annoter nos propres plans.

**L'entraînement chez nous** n'est pas réaliste. Mon environnement n'a ni carte graphique ni
PyTorch, et il est hors réseau. Ce n'est pas nécessaire tant que le modèle existant suffit.

## Les mesures, et leurs limites

- **Banc** : `plans-test/banc/modele_noter.py`, avec la même notation que nos règles
  (`cubicasa_noter.py`). Les plans sont tirés de la partie « test » officielle, pour ne pas évaluer
  le modèle sur ce qu'il a appris.
- **Préparation de l'image** : reproduite à l'identique de la page d'origine (`app.js`,
  `inference-worker.js`) :
  - l'image est réduite dans un carré blanc de 512 px ;
  - elle est normalisée (moyenne et écart type ImageNet) ;
  - la sortie fait 128 × 128 sur 5 classes, puis est agrandie à la taille de l'image.
- **Limite connue** : CubiCasa5K est surtout fait de plans finlandais. Les plans à la main, les
  scans très anciens et les styles très différents sont hors de son domaine. L'auteur le dit, et
  nos châteaux le confirment.
- **La chaîne complète**, mesurée au moment de l'intégration (voir plus bas).

## L'intégration (#456g, 8 novembre 2026)

Décidée par Durzo : le modèle est intégré, et nos règles restent **en secours** quand il est absent.

**La chaîne complète, mesurée.** Le modèle lit le plan, puis nos étapes prennent le relais :
vectorisation, raccords, ouvertures, pièces de l'éditeur. Les 60 plans de la partie test de
CubiCasa5K ont été notés avec `plans-test/banc/modele_banc.sh test`, et la préparation et le décodage
sont ceux de `src/plan-modele.js` (`JS=1`).

| Mesure | Règles | Modèle + notre chaîne |
|---|---|---|
| Murs, F1 (précision, rappel) | 0,617 | **0,875** (0,80, 0,97) |
| Portes trouvées / justes | 23,5 % / 23,5 % | **80 % / 79 %** |
| Fenêtres trouvées / justes | 19 % / 16 % | **71 % / 84 %** |
| Pièces fermées / annotées | — | 82 % |

Les murs vectorisés font mieux que le masque brut (0,805), parce qu'ils passent devant les baies.

**Trois choix, tirés du banc** :
- **les murs sont pris sur « mur, porte ou fenêtre » réunis**. Les baies sont dans le mur : il reste
  continu, et les pièces se ferment. Chaque masse de porte ou de fenêtre est ensuite posée sur le mur
  qu'elle traverse (`ouverturesDesMasques`, dans `src/plan-ouvertures.js`). Le côté et la charnière
  d'une porte se lisent sur son arc dans l'encre, quand il est dessiné ;
- **une porte est retenue dès que le modèle lui donne 30 %**, même si le mur l'emporte. Sur le plan
  de test n° 2, cela trouve deux fois plus de portes, et CubiCasa n'y perd rien (à 20 %, la
  précision tombait à 76 %) ;
- **un trou restant n'est refermé que s'il fait au plus 3 épaisseurs de mur**, contre 12 avec les
  règles. Les baies sont déjà dans le masque, et une limite plus large jetait des « murs » à travers
  les couloirs.

**Le moteur** : ONNX Runtime Web 1.22.0 (MIT), WASM, un seul fil. Plusieurs fils demanderaient
l'isolation d'origine, que la fenêtre n'a pas. Il tourne dans la page et non dans un *Web Worker*,
car un plan se lit en moins d'une seconde, pendant que l'écran affiche « Lecture du plan… ». Un
*Worker* reste possible si cela gêne. Le modèle et le moteur sont chargés à la première lecture,
puis gardés en mémoire.

## Débrancher le modèle

Si Storyboarder devait un jour être vendu, ou si la licence posait question :

1. supprimer le dossier `assets/modeles/plans/` ;
2. `npm uninstall onnxruntime-web`, puis retirer ses trois lignes `node_modules/onnxruntime-web/…`
   de `build.files` dans `package.json` ;
3. supprimer `src/plan-modele.js` et `tests/plan-modele.test.mjs`.

L'import de plan revient de lui-même aux règles. `ouverturesDesMasques` (`src/plan-ouvertures.js`)
peut rester : elle ne connaît que des masques, quels qu'ils soient, et resservirait à un modèle à
nous. Les poids restent dans l'historique git ; seule une réécriture de l'historique les en
retirerait.

**Ce que dit la licence, exactement.** Celle de NVIDIA (section 3.3) limite l'usage au
« non commercial », qu'elle définit comme **« à des fins de recherche ou d'évaluation seulement »**.
C'est plus étroit que « non vendu ». CubiCasa5K (CC BY-NC 4.0) n'interdit, lui, que l'usage
commercial. À Durzo de juger si son usage de Storyboarder entre dans ce cadre. Ce n'est pas un
avis juridique.

## L'architecture proposée : un modèle débranchable

Le principe : **le modèle est un greffon**. Sans lui, l'import fonctionne avec nos règles, comme
aujourd'hui. Le retirer, c'est supprimer un dossier et une dépendance.

1. **Un seul module le connaît : `src/plan-modele.js`.** Il charge le moteur et le modèle, et
   rend des masques (murs, portes, fenêtres, pièces), ou `null` s'ils sont absents. Il est chargé
   par un **import dynamique** : son absence ne casse rien.
2. **Le modèle vit à part** : `assets/modeles/plans/`, avec le fichier ONNX, `NVIDIA_LICENSE.txt` et
   une notice CubiCasa5K. Ce dossier figure dans la liste des fichiers embarqués par
   electron-builder.
3. **Le moteur** : ONNX Runtime Web (MIT), exécuté dans un *Web Worker* pour ne pas figer
   l'interface. Il ne demande ni binaire natif ni carte graphique.
4. **La chaîne** :
   - si le modèle est là, son masque de murs remplace celui de nos règles ;
   - ses portes et ses fenêtres deviennent les ouvertures ;
   - nos étapes suivantes restent : vectorisation, raccords, échelle, redressement des photos ;
   - sinon, ce sont les règles.
5. **Un test garde la porte de sortie** : aucun autre fichier n'importe `onnxruntime-web` ni ne
   lit `assets/modeles/`.
6. **Pour débrancher** :
   - supprimer `assets/modeles/plans/` ;
   - retirer la dépendance ;
   - supprimer `src/plan-modele.js`.

   L'application retombe d'elle-même sur les règles. La marche à suivre sera écrite dans la
   documentation, avec le rappel des licences.

## Comparatif détaillé, par style de plan (complété le 8 novembre 2026)

**Plans modernes, mesurés** : 60 plans de la partie test de CubiCasa5K. Pour les portes et les
fenêtres, le premier chiffre est la part retrouvée, le second la part juste.

| Style | Murs (F1) | Portes | Fenêtres |
|---|---|---|---|
| Plans d'architecte, 41 plans | règles 0,55 · **modèle 0,78** | règles 21 % / 22 % · **modèle 78 % / 72 %** | règles 14 % / 12 % · **modèle 70 % / 78 %** |
| CAO noir et blanc, 11 plans | règles 0,80 · **modèle 0,88** | règles 32 % / 25 % · **modèle 89 % / 76 %** | règles 51 % / 28 % · **modèle 91 % / 87 %** |
| Annonces en couleur, 8 plans | règles 0,70 · **modèle 0,81** | règles 26 % / 30 % · **modèle 82 % / 73 %** | règles 19 % / 27 % · **modèle 75 % / 66 %** |

**Plans anciens et dessinés à la main, jugés à l'œil** (il n'existe pas d'annotations).

| Plan | Murs | Portes et fenêtres |
|---|---|---|
| Tanlay (poché noir) | règles : une partie ; **modèle : presque tous** | modèle : quelques fenêtres |
| Pau (lavis) | les deux corrects, le modèle plus propre | peu, des deux côtés |
| Pierrefonds (Viollet-le-Duc) | les deux corrects, tours comprises | peu, des deux côtés |
| Versailles colorié | les deux peinent sous les aplats | faible des deux côtés |
| Appartement de 1875 (contrôle) | règles : correct ; **modèle : très bon** | **modèle : fenêtres et portes justes** |
| Clagny, lavis (contrôle) | règles : presque rien ; **modèle : la plupart** | faible |
| Maison en U, à la main | règles : un fragment ; **modèle : la plupart** | modèle : quelques-unes |
| Griswold, à la main (contrôle) | règles : fragments ; **modèle : bon** | **modèle : la plupart** |

Défaut récurrent du modèle : il prend les **cours** et l'extérieur proche pour des pièces. C'est
sans effet sur les murs, et notre propre déduction des pièces (par les murs) n'en dépend pas.

## Autres modèles, et leurs licences (complété le 8 novembre 2026)

Aucun modèle de plans n'est à la fois **plus permissif** et **utilisable** :
- presque tous sont entraînés sur CubiCasa5K, donc non commerciaux par leurs poids, quelle que soit
  la licence de leur code : [floorplan-detection](https://github.com/xmarva/floorplan-detection),
  FloorPlanAnalyzer, DeepFloorplan ;
- le [modèle Roboflow de l'IIIT Bangalore](https://universe.roboflow.com/iiitbangalore/floor-plan-segmentation-dtr4r)
  est sous MIT, mais n'a appris que sur 148 images : trop peu ;
- les détecteurs généraux sous Apache 2.0 (RF-DETR) ne connaissent pas les plans : il faudrait les
  entraîner.

Floorplan Studio reste le meilleur choix disponible.

## Entraîner notre propre modèle : estimation (complété le 8 novembre 2026)

**Les données libres existent, mais en VECTEURS, pas en images** :
- **MSD**, *Modified Swiss Dwellings* : 5 300 plans suisses, CC BY 4.0 ([4TU](https://data.4tu.nl/export/cff/datasets/e1d89cb5-6872-48fc-be63-aadd687ee6f9), [article](https://arxiv.org/abs/2407.10121v3)) ;
- **ResPlan** : 17 000 plans d'annonces sud-asiatiques, données CC BY 4.0 et code MIT ([dépôt](https://github.com/m-agour/ResPlan)) ;
- quelques **petits jeux d'images réelles** sous CC BY 4.0 sur Roboflow Universe, de quelques
  centaines d'images (à vérifier un par un).

La méthode serait donc de **dessiner nous-mêmes les images** à partir de ces plans vectoriels, dans
tous les styles que l'on veut reconnaître :
- poché noir, double trait, hachures, lavis rose ;
- mobilier, cotes et texte en bruit ;
- photo de biais, scan jauni.

Les annotations sont alors parfaites par construction. On complète avec les petits jeux réels, et on
mesure sur notre banc (CubiCasa test, plus nos plans). La base de départ doit elle aussi être libre :
par exemple un U-Net sur ResNet de torchvision (BSD), et non SegFormer de NVIDIA.

**Le temps** :

| Étape | De mon côté | De ton côté |
|---|---|---|
| Récupérer et comprendre MSD et ResPlan | 1 à 2 h | télécharger (quelques Go) |
| Le « dessinateur » de plans synthétiques, en plusieurs styles | 4 à 8 h | — |
| L'entraînement | préparer le script | **une carte graphique** : la tienne si tu en as une, sinon Google Colab gratuit ; 3 à 6 h de calcul par essai, 2 ou 3 essais |
| Mesurer, corriger, recommencer | 2 à 4 h | — |
| Export ONNX et intégration | comme pour le modèle existant | — |

**Au total, compter 3 à 5 séances de travail**, plus 10 à 20 h de calcul sur une carte graphique.

Le risque principal : des images de synthèse trop « propres » font un modèle moins bon sur les vrais
scans. On le mesure, et on le corrige en salissant davantage les images de synthèse.

## Ce qui a été décidé (Durzo)

- Le modèle est intégré selon cette architecture (#456g, voir « L'intégration »).
- Puis, le même jour, l'import de plan est abandonné et retiré du code (voir « Bilan, et comment y revenir »).
- Les règles restent en secours, quand le modèle est absent.

## Sources

- Floorplan Studio : [dépôt](https://github.com/ajayfjfj/floorplan-studio), [notices de tiers](https://raw.githubusercontent.com/ajayfjfj/floorplan-studio/main/THIRD_PARTY_NOTICES.md).
- SegFormer-B0 de NVIDIA : [fiche du modèle](https://huggingface.co/nvidia/segformer-b0-finetuned-ade-512-512), [licence](https://github.com/NVlabs/SegFormer/blob/master/LICENSE).
- CubiCasa5K : [licence CC BY-NC 4.0](https://github.com/CubiCasa/CubiCasa5k/blob/master/LICENSE), [archive Zenodo](https://zenodo.org/records/2613548).
- floorplan-to-3d : [fiche du modèle](https://huggingface.co/Yytsi/floorplan-to-3d-walls).
- FloorPlanCAD : [site](https://floorplancad.github.io/) ; ResPlan : [Kaggle](https://www.kaggle.com/datasets/resplan/resplan).
- ONNX Runtime Web : [npm](https://npmjs.com/package/onnxruntime-web).
